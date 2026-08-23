import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that a reverse-path binding is released by a delivery and not only by
// a failure or by expiry.
//
// This is the defect D23 corrects. AGP had no positive acknowledgement, so a
// flow that never failed filled the label table and the node was capped at
// capacity divided by the retention window: about 136 messages a second
// sustained against a burst ceiling near 2850. See MX7.
//
// The bound is lowered rather than the volume raised, and the table is told to
// refuse rather than evict, so that eviction cannot pass this test on
// release-on-success's behalf. Nothing here waits out an expiry: the clock is
// real and the test is far shorter than the thirty second lifetime, so a
// binding that is still held when the assertion runs was never released.

const CAPACITY = 8;

async function converged(t, overrides = {}) {
  const network = new MemoryPeerNetwork();
  const received = [];
  // The debounce that decides when the origin's table drains is the one held
  // by the node that reports, which is the far end. Setting it only on the
  // sender configures the wrong half.
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "release.listener" },
    disposition: { debounceMs: 0, ...overrides },
  }, { transport: network.transport({ listeners: ["release.listener"] }) });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "release.listener",
    }],
    capacity: { maxReverseCorrelations: CAPACITY },
    disposition: { debounceMs: 0, onCapacity: "refuse", ...overrides },
  }, { transport: network.transport({ targets: ["release.listener"] }) });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await listener.expose("sink/service", async (payload) => {
    received.push(payload);
  });
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
  return { dialer, received };
}

function held(dialer) {
  return dialer.operations.snapshot().reverseCorrelations.length;
}

test("Given messages that all succeed, when their dispositions return, then the label table empties without waiting for expiry", async (t) => {
  const { dialer, received } = await converged(t);

  for (let ordinal = 0; ordinal < CAPACITY; ordinal += 1) {
    await dialer.send("origin/source", "sink/service", { ordinal });
  }
  await eventually(() => received.length === CAPACITY, "every message arrives");

  await eventually(
    () => held(dialer) === 0,
    "every binding is released by the disposition that returned for it",
  );
});

test("Given far more messages than the table holds, when each is reported, then none is refused for want of a label", async (t) => {
  const { dialer, received } = await converged(t);
  const offered = CAPACITY * 10;

  let accepted = 0;
  for (let ordinal = 0; ordinal < offered; ordinal += 1) {
    // Drained between sends, which is what completion buys: the table is
    // sized by the offered rate over a round trip rather than over the expiry
    // window. Waiting for empty rather than for room keeps the assertion about
    // release and not about how close to the bound a race lands.
    // See D23 section 4.4.
    await eventually(() => held(dialer) === 0, "the table drains");
    await dialer.send("origin/source", "sink/service", { ordinal });
    accepted += 1;
  }

  assert.equal(accepted, offered);
  await eventually(() => received.length === offered, "every message arrives");
  assert.ok(
    held(dialer) <= CAPACITY,
    "the retained set never exceeds the bound it is admitted against",
  );
});

test("Given a table told to evict, when it fills, then the data plane keeps moving rather than being refused", async (t) => {
  // The other side of the configurable pressure rule: a reverse-path quality
  // concern must never be able to stop the data plane, so the default drops
  // the oldest binding instead of refusing the newest message.
  const { dialer, received } = await converged(t, {
    debounceMs: 60_000,
    onCapacity: "evict-oldest",
  });
  const offered = CAPACITY * 4;

  for (let ordinal = 0; ordinal < offered; ordinal += 1) {
    await dialer.send("origin/source", "sink/service", { ordinal });
  }

  await eventually(() => received.length === offered, "every message arrives");
  assert.ok(held(dialer) <= CAPACITY, "the bound still holds");
});
