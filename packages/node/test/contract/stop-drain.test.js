import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import { eventually } from "../support/memory-transport.js";
import { waitForTestEvent } from "../../../../test/support/test-waits.js";

test("Given admitted handler work, when stop begins, then new work is gated and admitted work drains once", async (context) => {
  const node = createNode({ nodeId: "node.local" });
  let releaseHandler;
  const handlerStarted = new Promise((resolveStarted) => {
    releaseHandler = resolveStarted;
  });
  context.after(() => {
    releaseHandler();
    return waitForTestEvent(node.stop({ drainTimeoutMs: 0 }), "draining node cleanup");
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
  }, () => {}); // The awaited stopping promise below retains the rejection.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolved, false);
  releaseHandler();
  const report = await waitForTestEvent(stopping, "cooperative stop completed", { signal: context.signal });

  assert.equal(report.discardedMessages, "0");
  assert.equal(node.operations.lifecycle().state, "Stopped");
  await Promise.all([source.close(), destination.close()]);
});
