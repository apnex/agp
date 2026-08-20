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
  const events = node.operations.events({ bufferSize: 16 });

  const completedReceipt = await node.send(
    "handler/source",
    "handler/success",
    { outcome: "completed" },
  );
  const completed = await nextKind(events, "handler.completed");
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
});

async function nextKind(subscription, expected) {
  for (;;) {
    const result = await subscription.next();
    assert.equal(result.done, false, `events ended before ${expected}`);
    if (result.value.kind === expected) return result.value;
  }
}
