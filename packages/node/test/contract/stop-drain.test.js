import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import { eventually } from "../support/memory-transport.js";

test("Given admitted handler work, when stop begins, then new work is gated and admitted work drains once", async () => {
  const node = createNode({ nodeId: "node.local" });
  let releaseHandler;
  const handlerStarted = new Promise((resolveStarted) => {
    releaseHandler = resolveStarted;
  });
  const source = await node.expose("local/source", async () => {});
  const destination = await node.expose("local/destination", async () => {
    await handlerStarted;
  });
  await node.start();
  await node.send("local/source", "local/destination", { admitted: true });

  const stopping = node.stop({ drainTimeoutMs: 1_000 });
  await eventually(
    () => node.operations.lifecycle().state === "Stopping",
    "Stopping gate",
  );
  await assert.rejects(
    node.send("local/source", "local/destination", {}),
    { code: "NOT_RUNNING" },
  );

  let resolved = false;
  void stopping.then(() => {
    resolved = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolved, false);
  releaseHandler();
  const report = await stopping;

  assert.equal(report.discardedMessages, "0");
  assert.equal(node.operations.lifecycle().state, "Stopped");
  await Promise.all([source.close(), destination.close()]);
});
