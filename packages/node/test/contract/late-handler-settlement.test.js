import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import { waitForTestEvent } from "../../../../test/support/test-waits.js";

test("Given a handler held beyond the stop deadline, when its revoked binding settles late, then its signal is aborted and terminal operations cannot advance", async (context) => {
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
  context.after(() => {
    release();
    return waitForTestEvent(node.stop({ drainTimeoutMs: 0 }), "late handler node cleanup");
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
  await waitForTestEvent(started, "late handler started", { signal: context.signal });

  await node.stop({ drainTimeoutMs: 0 });
  const terminal = node.operations.snapshot();
  assert.equal(handlerSignal.aborted, true);
  assert.equal(terminal.lifecycle.state, "Stopped");

  release();
  await waitForTestEvent(returned, "late handler returned", { signal: context.signal });
  await new Promise((resolve) => setImmediate(resolve));
  await node.executor.quiesce();
  const afterLateSettlement = node.operations.snapshot();

  assert.equal(afterLateSettlement.revision, terminal.revision);
  assert.deepEqual(afterLateSettlement.counters, terminal.counters);
  assert.equal(afterLateSettlement.lifecycle.state, "Stopped");
});
