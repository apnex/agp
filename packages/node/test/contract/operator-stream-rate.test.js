import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that the operations stream carries what an operator must act on, at a
// rate set by what happens to the node rather than by how much traffic crosses
// it.
//
// This is `D24`. While per-message events rode the operations stream, a
// subscriber that yields to the macrotask queue, which is what any subscriber
// doing real work does, received almost exactly its buffer size and then
// nothing: it was scheduled about as often as the loop drained, and under a
// stream that is close to never. Measured before the split, a 600-message
// stream lost 256 events at a buffer of 256 and 175 at the default of 1024.
//
// The buffer was not bridging consumer latency, it was absorbing the whole
// burst, so no buffer size was a property the operator could choose from
// anything they knew. Raising it moves the cliff, which is the `MX1` shape.
//
// Every subscriber here yields a macrotask deliberately. A subscriber that
// stays on the microtask queue never showed this fault and would not gate it.

const BURST = 300;

async function converged(t) {
  const network = new MemoryPeerNetwork();
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "rate.listener" },
  }, { transport: network.transport({ listeners: ["rate.listener"] }) });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "rate.listener",
    }],
  }, { transport: network.transport({ targets: ["rate.listener"] }) });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await listener.expose("sink/service", async () => {});
  await dialer.expose("origin/source", async () => {});
  await listener.start();
  await dialer.start();
  await eventually(() => {
    const route = dialer.operations.routes().selected.find(
      ({ endpoint }) => endpoint === "sink/service",
    );
    const source = dialer.operations.routeExports().items.find(
      ({ endpoint, state }) => endpoint === "origin/source" && state === "acked",
    );
    return route !== undefined && source !== undefined;
  }, "route and ACKed source export");
  return { dialer, listener };
}

/** A subscriber doing real work: it yields the loop for every event. */
function readWhileWorking(subscription, seen) {
  return (async () => {
    for await (const event of subscription) {
      seen.push(event);
      await new Promise((resolve) => setImmediate(resolve));
    }
  })();
}

function lost(seen) {
  return seen
    .filter(({ kind }) => kind === "observer.gap")
    .reduce(
      (total, { data }) =>
        total + (BigInt(data.droppedTo) - BigInt(data.droppedFrom) + 1n),
      0n,
    );
}

test("Given an operator subscriber doing real work, when a stream crosses the node, then it loses nothing even at the smallest buffer", async (t) => {
  const { dialer, listener } = await converged(t);
  const seen = [];
  // The smallest buffer the contract allows a consumer to pick. Before the
  // split this lost a burst's worth of events at any size.
  const subscription = listener.operations.events({ bufferSize: 1 });
  const reader = readWhileWorking(subscription, seen);

  for (let ordinal = 0; ordinal < BURST; ordinal += 1) {
    await dialer.send("origin/source", "sink/service", { ordinal });
  }
  await eventually(
    () => Number(listener.operations.counters().values["message.received"] ?? 0)
      >= BURST,
    "every message arrives",
  );
  subscription.close();
  await reader;

  assert.equal(lost(seen), 0n, "an operator stream must not drop under traffic");
  assert.equal(
    seen.filter(({ kind }) => PER_MESSAGE.has(kind)).length,
    0,
    "no per-message event may reach the operator stream",
  );
});

const PER_MESSAGE = new Set([
  "message.accepted",
  "message.forwarded",
  "message.received",
  "handler.completed",
]);

test("Given a consumer that asks for per-message detail, when a stream crosses the node, then it still receives it", async (t) => {
  const { dialer, listener } = await converged(t);
  const seen = [];
  // Sized for the burst, because this stream is traffic-rated by construction
  // and its consumer knows that. That is the whole point of separating it.
  const subscription = listener.operations.messages({ bufferSize: 4096 });
  const reader = readWhileWorking(subscription, seen);

  for (let ordinal = 0; ordinal < BURST; ordinal += 1) {
    await dialer.send("origin/source", "sink/service", { ordinal });
  }
  // This reader is macrotask-paced too, and this stream really does carry two
  // events per message, so draining it takes more loop turns than the operator
  // stream ever needs. That asymmetry is the design, not a defect.
  await eventually(
    () => seen.length >= BURST * 2,
    "the detail arrives",
    20_000,
  );
  subscription.close();
  await reader;

  assert.equal(lost(seen), 0n);
  assert.equal(
    seen.filter(({ kind }) => kind === "message.received").length,
    BURST,
  );
  assert.equal(
    seen.filter(({ kind }) => kind === "handler.completed").length,
    BURST,
  );
});

test("Given a delivery that fails, when it is reported, then the anomaly stays where an operator is watching", async (t) => {
  const { dialer } = await converged(t);
  const operator = [];
  const perMessage = [];
  const events = dialer.operations.events({ bufferSize: 256 });
  const messages = dialer.operations.messages({ bufferSize: 256 });
  const readers = [
    readWhileWorking(events, operator),
    readWhileWorking(messages, perMessage),
  ];

  // A rate set by how often something goes wrong is a rate an operator wants,
  // which is why `message.failed` and `handler.failed` did not move.
  await assert.rejects(
    dialer.send("origin/source", "sink/absent", { ordinal: 0 }),
    (error) => error.code === "NO_ROUTE",
  );
  await dialer.send("origin/source", "sink/service", { ordinal: 1 });

  await eventually(
    () => perMessage.some(({ kind }) => kind === "message.accepted"),
    "the successful path reaches the per-message stream",
  );
  events.close();
  messages.close();
  await Promise.all(readers);

  assert.equal(
    operator.some(({ kind }) => PER_MESSAGE.has(kind)),
    false,
    "the operator stream stays free of the successful path",
  );
});
