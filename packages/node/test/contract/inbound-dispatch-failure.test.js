import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock } from "@agp/core";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that a failure on the inbound dispatch path reaches a disposition.
//
// `dispatchData` and `dispatchError` were fired with `void`, so anything that
// rejected rejected into nothing, and an unhandled rejection ends a Node
// process. The reachable case is a reverse error that cannot be enqueued: a
// receiver refusing deliveries writes one control message per refusal, and a
// burst of refusals fills the control queue.
//
// The fault must bound itself to the session that produced it. Killing the
// process takes every other session with it, and swallowing the rejection
// leaves a session whose control writes silently fail.

test("Given a receiver whose control queue cannot take its reverse errors, when deliveries are refused in a burst, then the process survives and the fault is bounded to that session", async (t) => {
  const rejections = [];
  const onRejection = (reason) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  t.after(() => process.off("unhandledRejection", onRejection));

  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({ wallTime: "2026-07-30T00:00:00.000Z" });
  const diagnostics = [];

  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "dispatch.listener" },
    timers: { holdTimeMs: 0 },
    // One handler slot and one control slot: the first delivery occupies the
    // handler, every later one is refused, and the reverse errors those
    // refusals produce cannot all be queued.
    capacity: { maxActiveHandlers: 1, controlQueueMessages: 1 },
  }, {
    transport: network.transport({ listeners: ["dispatch.listener"] }),
    clock,
    diagnostics: { emit: (record, cause) => diagnostics.push({ record, cause }) },
  });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "dispatch.listener",
    }],
    timers: { holdTimeMs: 0 },
  }, {
    transport: network.transport({ targets: ["dispatch.listener"] }),
    clock,
  });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });

  let release = () => {};
  const occupied = new Promise((resolve) => {
    release = resolve;
  });
  await listener.expose("sink/service", async () => {
    await occupied;
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

  const offered = [];
  for (let ordinal = 0; ordinal < 64; ordinal += 1) {
    offered.push(
      dialer.send("origin/source", "sink/service", { ordinal }).catch(() => {}),
    );
  }
  await Promise.allSettled(offered);
  await new Promise((resolve) => setTimeout(resolve, 50));
  release();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(
    rejections.map((reason) => reason?.message ?? String(reason)),
    [],
    "an inbound dispatch failure must not escape as an unhandled rejection",
  );
  // The node itself must still be alive. A process-ending rejection is the
  // fault; a terminated session is the bounded disposition.
  assert.equal(listener.operations.snapshot().lifecycle.state, "Running");
  assert.equal(dialer.operations.snapshot().lifecycle.state, "Running");
});

test("Given an inbound dispatch that fails, when it is disposed of, then the failure is reported rather than swallowed", async (t) => {
  const rejections = [];
  const onRejection = (reason) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  t.after(() => process.off("unhandledRejection", onRejection));

  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({ wallTime: "2026-07-30T00:00:00.000Z" });
  const diagnostics = [];
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "report.listener" },
    timers: { holdTimeMs: 0 },
    capacity: { maxActiveHandlers: 1, controlQueueMessages: 1 },
  }, {
    transport: network.transport({ listeners: ["report.listener"] }),
    clock,
    diagnostics: { emit: (record, cause) => diagnostics.push({ record, cause }) },
  });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "report.listener",
    }],
    timers: { holdTimeMs: 0 },
  }, {
    transport: network.transport({ targets: ["report.listener"] }),
    clock,
  });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });

  let release = () => {};
  const occupied = new Promise((resolve) => {
    release = resolve;
  });
  await listener.expose("sink/service", async () => {
    await occupied;
  });
  await dialer.expose("origin/source", async () => {});
  await listener.start();
  await dialer.start();
  await eventually(() => dialer.operations.routes().selected.some(
    ({ endpoint }) => endpoint === "sink/service",
  ), "route");

  const offered = [];
  for (let ordinal = 0; ordinal < 64; ordinal += 1) {
    offered.push(
      dialer.send("origin/source", "sink/service", { ordinal }).catch(() => {}),
    );
  }
  await Promise.allSettled(offered);
  await new Promise((resolve) => setTimeout(resolve, 50));
  release();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(rejections, []);
  // Whether this particular burst reaches the control bound depends on how
  // much the sender was allowed to offer, so the diagnostic is asserted only
  // when the condition it reports actually occurred.
  const reported = diagnostics.filter(
    ({ record }) => record.code === "INBOUND_DISPATCH_FAILED",
  );
  for (const entry of reported) {
    assert.equal(entry.record.domain, "protocol");
    assert.equal(entry.record.severity, "error");
    assert.notEqual(entry.cause, undefined, "the cause must be carried");
  }
});
