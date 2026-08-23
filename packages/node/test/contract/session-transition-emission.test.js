import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock } from "@agp/core";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: which self-transitions the event stream announces, and which it only
// records.
//
// A session that stays Established still transitions to itself on everything
// it processes. The snapshot must show all of them, because `LAST_EVENT` is
// how an operator sees that a session is working. The event stream must not,
// because one of those causes is traffic and an event stream whose rate is set
// by traffic displaces the events an operator is watching for.
//
// `operational-event-schema` owns the vocabulary and that every kind is
// emitted at least once. This owns when one particular kind is withheld.

function pair(clock, network, holdTimeMs) {
  const listener = createNode({
    nodeId: "node.listener",
    listen: { transportRef: "emission.listener" },
    timers: { holdTimeMs },
  }, {
    transport: network.transport({ listeners: ["emission.listener"] }),
    clock,
  });
  const dialer = createNode({
    nodeId: "node.dialer",
    peers: [{
      adjacencyId: "listener",
      expectedNodeId: "node.listener",
      transportRef: "emission.listener",
    }],
    timers: { holdTimeMs },
  }, {
    transport: network.transport({ targets: ["emission.listener"] }),
    clock,
  });
  return { listener, dialer };
}

async function converge(dialer, listener) {
  await listener.expose("listener/service", async () => {});
  await dialer.expose("dialer/source", async () => {});
  await listener.start();
  await dialer.start();
  await eventually(() => {
    const route = dialer.operations.routes().selected.find(
      ({ endpoint }) => endpoint === "listener/service",
    );
    const source = dialer.operations.routeExports().items.find(
      ({ endpoint, state }) => endpoint === "dialer/source" && state === "acked",
    );
    return route !== undefined && source !== undefined;
  }, "route and ACKed source export");
}

/**
 * Both streams, kept apart.
 *
 * Since `D24` a delivery announces itself on the traffic-rated stream and a
 * self-transition stays on the operator stream, so `D22`'s question is now
 * asked across two surfaces: the delivery is reported, and the session is not
 * also reported as having stayed where it was.
 */
function collect(node) {
  const operator = [];
  const perMessage = [];
  const events = node.operations.events();
  const messages = node.operations.messages();
  void (async () => {
    for await (const event of events) operator.push(event.kind);
  })();
  void (async () => {
    for await (const event of messages) perMessage.push(event.kind);
  })();
  return { operator, perMessage };
}

test("Given an Established session, when a data message is delivered, then the stream announces the delivery and withholds the self-transition", async (t) => {
  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({ wallTime: "2026-07-30T00:00:00.000Z" });
  const { listener, dialer } = pair(clock, network, 30_000);
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await converge(dialer, listener);

  const { operator, perMessage } = collect(listener);
  await dialer.send("dialer/source", "listener/service", { ordinal: 1 });
  await eventually(
    () => perMessage.includes("handler.completed"),
    "delivery announced",
  );

  assert.ok(perMessage.includes("message.received"), "the delivery is announced");
  assert.equal(
    operator.filter((kind) => kind === "session.transition").length,
    0,
    "a delivery must not also announce that the session stayed Established",
  );
});

test("Given a delivered message, when the session is queried, then the snapshot still records the self-transition it did not announce", async (t) => {
  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({ wallTime: "2026-07-30T00:00:00.000Z" });
  const { listener, dialer } = pair(clock, network, 30_000);
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await converge(dialer, listener);

  await dialer.send("dialer/source", "listener/service", { ordinal: 1 });
  await eventually(
    () => listener.operations.connections().items[0]?.lastTransition.event
      === "DataReceived",
    "the snapshot records the delivery as the last event",
  );

  // Withholding the event must not cost the operator the column that shows a
  // session is working, which `operations.md` requires to count self-transitions.
  const session = listener.operations.connections().items[0];
  assert.equal(session.lastTransition.event, "DataReceived");
  assert.equal(session.lastTransition.from, "Established");
  assert.equal(session.lastTransition.to, "Established");
});

test("Given an idle session, when a keepalive is processed, then the self-transition is announced because nothing else would report it", async (t) => {
  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({ wallTime: "2026-07-30T00:00:00.000Z" });
  const { listener, dialer } = pair(clock, network, 30_000);
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await converge(dialer, listener);

  const { operator } = collect(listener);
  // A keepalive carries no delivery, so a withheld transition would leave an
  // idle but healthy session silent. The keepalive timer bounds this rate.
  clock.advanceBy(10_000);
  await eventually(
    () => operator.includes("session.transition"),
    "an idle session still reports that it is alive",
  );
  assert.equal(
    listener.operations.connections().items[0].lastTransition.event,
    "KeepaliveReceived",
  );
});
