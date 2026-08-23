import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that a message may name which advertiser of an endpoint it is for.
//
// This is `D26`, and it is the only thing the amendment to confirmed intent
// `Q1(b)` permits: a data path gated by the candidate routing table rather than
// only by the selected one. Everything else holds. `D6` still selects, still
// governs what is advertised, and still decides what an unqualified message
// follows.
//
// Two leaves advertise the same endpoint, which is the situation that made
// addressing by name alone into anycast: `D6` resolves it deterministically, so
// one leaf always wins and a sender had no way to reach the other. That is the
// fixture here, because a topology with one advertiser cannot fail this test.

async function star(t) {
  const network = new MemoryPeerNetwork();
  const hub = createNode({
    nodeId: "hub",
    listen: { transportRef: "selector.hub" },
    transit: { enabled: true, defaultHopLimit: 8 },
  }, { transport: network.transport({ listeners: ["selector.hub"] }) });
  const leaf = (name) =>
    createNode({
      nodeId: name,
      peers: [{
        adjacencyId: "to-hub",
        expectedNodeId: "hub",
        transportRef: "selector.hub",
      }],
    }, { transport: network.transport({ targets: ["selector.hub"] }) });
  const alpha = leaf("leaf.alpha");
  const beta = leaf("leaf.beta");
  // A third leaf so that a message can cross the hub as transit. With the hub
  // as origin the pin is resolved once, at admission, and a hop that has to
  // honour it never exists.
  const sender = leaf("leaf.sender");
  t.after(async () => {
    await Promise.allSettled([
      sender.stop(), alpha.stop(), beta.stop(), hub.stop(),
    ]);
  });

  const served = [];
  await hub.expose("hub/source", async () => {});
  await sender.expose("sender/source", async () => {});
  await alpha.expose("shared/service", async () => { served.push("alpha"); });
  await beta.expose("shared/service", async () => { served.push("beta"); });
  await hub.start();
  await alpha.start();
  await beta.start();
  await sender.start();

  await eventually(() => {
    const candidates = hub.operations.snapshot().candidateRoutes
      .filter(({ endpoint }) => endpoint === "shared/service");
    return candidates.length === 2
      && candidates.some(({ selectionStatus }) => selectionStatus === "selected");
  }, "both advertisers known to the hub");

  const candidates = hub.operations.snapshot().candidateRoutes
    .filter(({ endpoint }) => endpoint === "shared/service");
  const selected = candidates.find(
    ({ selectionStatus }) => selectionStatus === "selected",
  ).originNodeId;
  const other = candidates.find(
    ({ originNodeId }) => originNodeId !== selected,
  ).originNodeId;
  await eventually(() => {
    const route = sender.operations.routes().selected.find(
      ({ endpoint }) => endpoint === "shared/service",
    );
    const exported = sender.operations.routeExports().items.find(
      ({ endpoint, state }) => endpoint === "sender/source" && state === "acked",
    );
    return route !== undefined && exported !== undefined;
  }, "the sender can reach the shared endpoint through the hub");

  return { hub, sender, served, selected, other };
}

test("Given two advertisers of one endpoint, when no instance is named, then the selected route still decides", async (t) => {
  const { hub, served, selected } = await star(t);

  await hub.send("hub/source", "shared/service", { ordinal: 0 });
  await eventually(() => served.length === 1, "the message arrives");

  assert.equal(served[0], selected.split(".")[1]);
});

test("Given the advertiser that was not selected, when a message pins it, then that instance serves the message", async (t) => {
  const { hub, served, selected, other } = await star(t);

  await hub.send("hub/source", "shared/service", { ordinal: 1 }, {
    destinationSelector: { originNodeId: other, mode: "pinned" },
  });
  await eventually(() => served.length === 1, "the message arrives");

  // The whole point of D26: a route the node held, had validated, and could
  // not previously use.
  assert.equal(served[0], other.split(".")[1]);
  assert.notEqual(served[0], selected.split(".")[1]);
});

test("Given an instance nobody advertises, when a message pins it, then it is refused at delivery rather than served by the wrong one", async (t) => {
  const { hub, served } = await star(t);

  // Admitted, because this hop cannot know that no hop further on can resolve
  // the name. It follows the selected route and is refused by the node that
  // would have served it, so the refusal returns as a disposition rather than
  // as a rejected send. That is D26 composing with D23.
  const receipt = await hub.send("hub/source", "shared/service", { ordinal: 2 }, {
    destinationSelector: { originNodeId: "leaf.absent", mode: "pinned" },
  });
  const settled = await hub.settled(receipt.messageId);

  assert.equal(settled.settled, true);
  assert.equal(settled.outcomes.length, 1);
  // An application that named an instance must be able to tell a moved
  // instance from a withdrawn service, because the remedies are opposite.
  assert.equal(settled.outcomes[0].code, "INSTANCE_UNREACHABLE");
  assert.equal(served.length, 0, "no instance may serve a pin it does not match");
});

test("Given an endpoint nobody advertises, when a message names no instance, then it is refused before the wire", async (t) => {
  const { hub } = await star(t);

  await assert.rejects(
    hub.send("hub/source", "no/such/endpoint", { ordinal: 3 }),
    (error) => error.code === "NO_ROUTE",
  );
});

test("Given an instance that advertises nothing, when a message prefers it, then the selected route carries it instead", async (t) => {
  const { hub, served, selected } = await star(t);

  await hub.send("hub/source", "shared/service", { ordinal: 4 }, {
    destinationSelector: { originNodeId: "leaf.absent", mode: "preferred" },
  });
  await eventually(() => served.length === 1, "the message still arrives");

  assert.equal(served[0], selected.split(".")[1]);
});

test("Given a pinned message crossing a transit hop, when the hop forwards it, then the selector crosses with it", async (t) => {
  const { sender, served, selected, other } = await star(t);

  // The sender admits the pin, and the hub is the node that actually resolves
  // this name. A pin honoured only where it was admitted pins nothing, so the
  // selector has to be on the wire. Arrival at the named instance rather than
  // the selected one is what proves it travelled and was re-resolved.
  await sender.send("sender/source", "shared/service", { ordinal: 5 }, {
    destinationSelector: { originNodeId: other, mode: "pinned" },
  });
  await eventually(() => served.length === 1, "the message arrives");

  assert.equal(served[0], other.split(".")[1]);
  assert.notEqual(served[0], selected.split(".")[1]);
});

test("Given a hop that cannot resolve the pin, when it forwards, then the selector survives for a hop that can", async (t) => {
  // A chain, because a star cannot exercise this: there, the one transit hop
  // always holds both advertisers and resolves the pin before forwarding, so
  // the selector never has to survive a hop that could not use it.
  //
  // Here it does. Only `relay` holds both instances, and the message reaches
  // it through `near`, which holds one. If the selector did not cross that
  // hop, `relay` would deliver locally and, not being the named instance,
  // refuse.
  const network = new MemoryPeerNetwork();
  const node = (name, listen, dial) =>
    createNode({
      nodeId: name,
      transit: { enabled: true, defaultHopLimit: 8 },
      ...(listen === undefined ? {} : { listen: { transportRef: listen } }),
      ...(dial === undefined ? {} : {
        peers: [{
          adjacencyId: `to-${dial}`,
          expectedNodeId: dial.replace("link.", ""),
          transportRef: dial,
        }],
      }),
    }, {
      transport: network.transport({
        ...(listen === undefined ? {} : { listeners: [listen] }),
        ...(dial === undefined ? {} : { targets: [dial] }),
      }),
    });

  const far = node("far", "link.far", undefined);
  const relay = node("relay", "link.relay", "link.far");
  const near = node("near", "link.near", "link.relay");
  const sender = node("sender", undefined, "link.near");
  t.after(async () => {
    await Promise.allSettled(
      [sender, near, relay, far].map((n) => n.stop()),
    );
  });

  const served = [];
  await sender.expose("sender/source", async () => {});
  await relay.expose("shared/service", async () => { served.push("relay"); });
  await far.expose("shared/service", async () => { served.push("far"); });
  for (const n of [far, relay, near, sender]) await n.start();

  await eventually(() => {
    const seen = relay.operations.snapshot().candidateRoutes
      .filter(({ endpoint }) => endpoint === "shared/service");
    const reachable = sender.operations.routes().selected.some(
      ({ endpoint }) => endpoint === "shared/service",
    );
    const exported = sender.operations.routeExports().items.some(
      ({ endpoint, state }) => endpoint === "sender/source" && state === "acked",
    );
    return seen.length === 2 && reachable && exported;
  }, "relay holds both advertisers and the sender can reach the endpoint");

  // `relay` prefers its own local route, so `far` is the instance no selected
  // route leads to, and the one only `relay` can reach.
  await sender.send("sender/source", "shared/service", { ordinal: 6 }, {
    destinationSelector: { originNodeId: "far", mode: "pinned" },
  });
  await eventually(() => served.length === 1, "the message arrives");

  assert.deepEqual(served, ["far"]);
});
