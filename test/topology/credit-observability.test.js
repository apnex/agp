import assert from "node:assert/strict";
import test from "node:test";

import {
  createWebSocketNode,
  eventually,
  expose,
  memoryPeer,
  selectedRoute,
} from "../support/uniform-topology.js";

// Owns: whether a paced session can be read rather than reconstructed.
//
// `credit-flow-control` owns the behaviour, which is that nothing is lost.
// This owns the projection, which is that the pacing is visible while it
// happens. The two are separate because a mechanism can be correct and still
// undiagnosable, and that combination is what `D20` was written after.
//
// The first investigation into credit timing was run by patching console
// output into built artifacts. Every assertion here is a question that had to
// be answered that way and now resolves from one query.

const RING_PACKETS = 16;
const OFFERED = 90;
const SOURCE = "obs.sender/ep0";
const SINK = "obs.receiver/ep0";

async function pacedPair(context, deliveries) {
  const receiver = createWebSocketNode({
    nodeId: "obs.receiver",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    transit: false,
    transportReceivePackets: RING_PACKETS,
  });
  context.after(() => receiver.stop().catch(() => undefined));
  await expose(receiver, [SINK], deliveries);
  const started = await receiver.start();

  const sender = createWebSocketNode({
    nodeId: "obs.sender",
    transit: false,
    peers: [{
      ...memoryPeer("obs", "obs.receiver", 1),
      url: started.listener.publication.displayAddress,
    }],
  });
  context.after(() => sender.stop().catch(() => undefined));
  await expose(sender, [SOURCE], deliveries);
  await sender.start();

  await eventually(
    () => selectedRoute(sender, SINK) !== undefined,
    "the sender selects the sink",
    20_000,
  );
  const at = () => deliveries.filter((entry) => entry.endpoint === SINK).length;
  for (let ordinal = 0; ordinal < OFFERED; ordinal += 1) {
    try {
      await sender.send(SOURCE, SINK, { ordinal });
    } catch {
      ordinal -= 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  await eventually(() => at() >= OFFERED, "every message arrives", 20_000);
  return { sender, receiver };
}

const connection = (node) => node.operations.snapshot().connections[0];

test("given a sender paced by a peer grant, when the operations plane is queried, then the ceiling, the spend and the room left are all readable", async (context) => {
  const { sender } = await pacedPair(context, []);
  const outbound = connection(sender).credit.outbound;

  assert.equal(outbound.unlimited, false, "a paced sender is not unlimited");
  assert.ok(BigInt(outbound.sent.packets) >= BigInt(OFFERED));
  assert.ok(
    BigInt(outbound.ceiling.packets) >= BigInt(outbound.sent.packets),
    "a sender may never pass the ceiling it was granted",
  );
  assert.equal(
    BigInt(outbound.remaining.packets),
    BigInt(outbound.ceiling.packets) - BigInt(outbound.sent.packets),
    "room left must be the ceiling less the spend, not an estimate",
  );
});

test("given traffic offered past the ring, when the sender is queried, then the pacing it suffered is counted and timed", async (context) => {
  const { sender } = await pacedPair(context, []);
  const { credit, latency } = connection(sender);

  assert.ok(
    BigInt(credit.outbound.stalls) > 0n,
    "offering past the ring must be recorded as pacing, not pass silently",
  );
  assert.equal(
    latency.creditReplenishment.count,
    credit.outbound.stalls,
    "every stall must contribute one replenishment measurement",
  );
  assert.ok(
    latency.creditReplenishment.highWaterUs >= latency.creditReplenishment.lastUs
      || latency.creditReplenishment.count === "1",
  );
  assert.ok(
    credit.outbound.stalledUs > 0,
    "time spent waiting on a peer must be readable, not inferred",
  );
});

test("given a receiver that drained a stream, when it is queried, then what it read and what it advertised are both readable", async (context) => {
  const { receiver } = await pacedPair(context, []);
  const inbound = connection(receiver).credit.inbound;

  assert.ok(BigInt(inbound.read.packets) >= BigInt(OFFERED));
  assert.ok(
    BigInt(inbound.capacity.packets) < BigInt(RING_PACKETS),
    "advertised capacity must sit below the ring, leaving the control reserve",
  );
  // The advertised ceiling is the last one actually put on the wire, so it
  // trails what the receiver could now offer. Both bounds on that lag matter:
  // ahead of read plus capacity would oversubscribe the ring, and further
  // behind than the announcement threshold would strand a sender that stopped.
  const offerable = BigInt(inbound.read.packets)
    + BigInt(inbound.capacity.packets);
  const lag = offerable - BigInt(inbound.advertised.packets);
  assert.ok(lag >= 0n, "an advertised ceiling may never exceed the ring");
  assert.ok(
    lag <= BigInt(inbound.capacity.packets) / 2n,
    `announcement lagged ${lag} packets, past the half-window threshold`,
  );
  assert.ok(
    BigInt(inbound.announcements) > 0n,
    "a receiver that replenished a sender must say how often it did so",
  );
});

test("given a session that exchanged a route snapshot, when it is queried, then the acknowledgement round trip is a measurement rather than only a deadline", async (context) => {
  const { sender, receiver } = await pacedPair(context, []);

  for (const node of [sender, receiver]) {
    const { routeAck } = connection(node).latency;
    assert.ok(BigInt(routeAck.count) > 0n, "the round trip must be observed");
    assert.ok(routeAck.highWaterUs >= 0);
    // The deadline already knows this number and discards it, reporting only
    // that it was exceeded. Keeping it is what separates slow from stuck.
    assert.ok(
      routeAck.highWaterUs < 20_000,
      "an observed acknowledgement cannot exceed the deadline that allowed it",
    );
  }
});

test("given a receiver that sent no data of its own, when it is queried, then it reports no pacing rather than zeroes that look measured", async (context) => {
  const { receiver } = await pacedPair(context, []);
  const { credit, latency } = connection(receiver);

  assert.equal(credit.outbound.stalls, "0");
  assert.equal(
    latency.creditReplenishment,
    undefined,
    "a sender that never waited must report no measurement at all",
  );
});
