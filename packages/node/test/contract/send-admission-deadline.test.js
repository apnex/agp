import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock, SystemClock } from "@agp/core";
import { createNode } from "../../dist/index.js";

async function localSender(t, beforeStop = () => {}, clock = new ManualClock()) {
  const node = createNode({ nodeId: "admission.local" }, { clock });
  const received = [];
  await node.expose("local/source", async () => {});
  await node.expose("local/destination", async (payload) => { received.push(payload); });
  await node.start();
  t.after(async () => { beforeStop(); await node.stop(); });
  return { node, clock, received };
}

for (const cancellation of ["deadline", "abort"]) {
  test(`Given a send waiting for admission, when ${cancellation} wins, then it rejects promptly and never delivers after the queue drains`,
    { timeout: 5_000 }, async (t) => {
      const blocker = Promise.withResolvers();
      const { node, clock, received } = await localSender(t, () => blocker.resolve());
      const blocked = node.executor.run(() => blocker.promise);
      const controller = new AbortController();
      const sending = node.send("local/source", "local/destination", { cancelled: true }, {
        timeoutMs: 10,
        signal: controller.signal,
      });
      const rejected = assert.rejects(sending, {
        code: cancellation === "deadline" ? "TIMEOUT" : "ABORTED",
        operation: "node.send",
      });
      // A positive turn barrier places the send behind the blocked executor.
      await new Promise((resolve) => setImmediate(resolve));
      if (cancellation === "deadline") clock.advanceBy(10);
      else controller.abort();
      await rejected;
      assert.deepEqual(received, []);
      blocker.resolve();
      await blocked;
      await node.executor.quiesce();
      await node.send("local/source", "local/destination", { marker: true });
      assert.deepEqual(received, [{ marker: true }]);
    });
}

test("Given a send admitted before its deadline, when cancellation and expiry follow, then the receipt and delivery remain valid",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, received } = await localSender(t);
    const controller = new AbortController();
    const timersBefore = clock.pendingTasks();
    const receipt = await node.send("local/source", "local/destination", { accepted: true }, {
      timeoutMs: 10, signal: controller.signal,
    });
    assert.equal(clock.pendingTasks(), timersBefore);
    controller.abort();
    clock.advanceBy(100);
    assert.deepEqual(received, [{ accepted: true }]);
    assert.deepEqual(node.disposition(receipt.messageId).outcomes, [{ kind: "delivered" }]);
  });

test("Given an admitted handler, when it aborts before the receipt continuation, then cancellation cannot undo admission",
  { timeout: 5_000 }, async (t) => {
    const { node } = await localSender(t);
    const controller = new AbortController();
    let handled = false;
    await node.expose("local/abort", async () => { handled = true; controller.abort(); });
    const receipt = await node.send("local/source", "local/abort", {}, { signal: controller.signal });
    assert.equal(handled, true);
    assert.equal(controller.signal.aborted, true);
    assert.deepEqual(node.disposition(receipt.messageId).outcomes, [{ kind: "delivered" }]);
  });

test("Given the production clock, when a valid send timeout is supplied, then fractional elapsed time still schedules a valid timer",
  { timeout: 5_000 }, async (t) => {
    const { node, received } = await localSender(t, undefined, new SystemClock());
    await node.send("local/source", "local/destination", { realClock: true }, { timeoutMs: 10_000 });
    assert.deepEqual(received, [{ realClock: true }]);
  });

test("Given delayed timer callbacks, when the executor reaches a send after its deadline, then admission itself rejects the expired work",
  { timeout: 5_000 }, async (t) => {
    class DelayedClock extends ManualClock {
      schedule(delayMs, callback) { return super.schedule(delayMs + 100, callback); }
    }
    const blocker = Promise.withResolvers();
    const { node, clock, received } = await localSender(t, () => blocker.resolve(), new DelayedClock());
    const blocked = node.executor.run(() => blocker.promise);
    const sending = node.send("local/source", "local/destination", {}, { timeoutMs: 10 });
    const rejected = assert.rejects(sending, { code: "TIMEOUT" });
    await new Promise((resolve) => setImmediate(resolve));
    clock.advanceBy(10);
    blocker.resolve();
    await Promise.all([blocked, rejected]);
    await node.executor.quiesce();
    assert.deepEqual(received, []);
  });

test("Given a long valid send timeout, when a short interval passes before admission, then timer width does not cause early refusal",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, received } = await localSender(t);
    const sending = node.send("local/source", "local/destination", { long: true }, {
      timeoutMs: 4_294_967_294,
    });
    clock.advanceBy(2_147_483_647);
    await sending;
    assert.deepEqual(received, [{ long: true }]);
  });
