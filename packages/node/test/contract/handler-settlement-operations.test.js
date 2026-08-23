import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";

test("given successful and failed local handlers, when each settles, then its exact event and closed counter commit once", async (context) => {
  const node = createNode({ nodeId: "handler-settlement.local" });
  context.after(async () => {
    await node.stop();
  });
  await node.expose("handler/source", () => undefined);
  await node.expose("handler/success", () => undefined);
  await node.expose("handler/failure", async () => {
    throw new Error("expected handler failure");
  });
  await node.start();
  // Two streams since D24. A completed handler is the successful path of one
  // message and rides the traffic-rated stream; a failed one is an anomaly and
  // stays where an operator is already watching.
  const events = node.operations.events({ bufferSize: 16 });
  const messages = node.operations.messages({ bufferSize: 16 });

  const completedReceipt = await node.send(
    "handler/source",
    "handler/success",
    { outcome: "completed" },
  );
  const completed = await nextKind(messages, "handler.completed");
  assert.equal(completed.subjectId, completedReceipt.messageId);

  const failedReceipt = await node.send(
    "handler/source",
    "handler/failure",
    { outcome: "failed" },
  );
  const failed = await nextKind(events, "handler.failed");
  assert.equal(failed.subjectId, failedReceipt.messageId);

  const counters = node.operations.counters().values;
  assert.equal(counters["handler.completed"], "1");
  assert.equal(counters["handler.failed"], "1");
  await events.return();
  await messages.return();
});

/**
 * Read until an expected kind arrives, but never without a deadline.
 *
 * A subscription that never yields it would otherwise stall the run instead of
 * failing it, and a hanging gate reports nothing at all.
 */
async function nextKind(subscription, expected, ms = 5_000) {
  const expired = Symbol("expired");
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(expired), ms);
  });
  try {
    for (;;) {
      const result = await Promise.race([subscription.next(), deadline]);
      assert.notEqual(result, expired, `no ${expected} within ${ms}ms`);
      assert.equal(result.done, false, `events ended before ${expected}`);
      if (result.value.kind === expected) return result.value;
    }
  } finally {
    clearTimeout(timer);
  }
}
