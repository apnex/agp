import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";

test("Given a handler held beyond the stop deadline, when its revoked binding settles late, then its signal is aborted and terminal operations cannot advance", async () => {
  const node = createNode({ nodeId: "late-handler.local" });
  let markStarted;
  let release;
  let markReturned;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const released = new Promise((resolve) => {
    release = resolve;
  });
  const returned = new Promise((resolve) => {
    markReturned = resolve;
  });
  let handlerSignal;

  await node.expose("late-handler/source", () => undefined);
  await node.expose("late-handler/destination", async (_payload, context) => {
    handlerSignal = context.signal;
    markStarted();
    await released;
    markReturned();
  });
  await node.start();
  await node.send(
    "late-handler/source",
    "late-handler/destination",
    { held: true },
  );
  await started;

  await node.stop({ drainTimeoutMs: 0 });
  const terminal = node.operations.snapshot();
  assert.equal(handlerSignal.aborted, true);
  assert.equal(terminal.lifecycle.state, "Stopped");

  release();
  await returned;
  await new Promise((resolve) => setImmediate(resolve));
  await node.executor.quiesce();
  const afterLateSettlement = node.operations.snapshot();

  assert.equal(afterLateSettlement.revision, terminal.revision);
  assert.deepEqual(afterLateSettlement.counters, terminal.counters);
  assert.equal(afterLateSettlement.lifecycle.state, "Stopped");
});
