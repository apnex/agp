import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";

test("Given a Created runtime, when it reaches Stopped, then restart is rejected and repeated stop is stable", async () => {
  const node = createNode({ nodeId: "node.local" });
  const beforeStart = await node.expose("local/source", async () => {});
  assert.equal(node.operations.lifecycle().state, "Created");

  const started = await node.start();
  assert.equal(node.operations.lifecycle().state, "Running");
  assert.equal(started.nodeId, "node.local");

  const stopped = await node.stop();
  assert.equal(node.operations.lifecycle().state, "Stopped");
  assert.equal((await node.stop()).operationsRevision, stopped.operationsRevision);
  await assert.rejects(node.start(), {
    code: "LIFECYCLE_INVALID",
  });
  await beforeStart.close();
  assert.equal(node.operations.lifecycle().state, "Stopped");
});

test("Given transport acquisition fails, when start is retried, then Failed remains terminal", async () => {
  const transport = {
    resolveListener(reference) {
      if (reference !== "failed.listener") return undefined;
      return {
        async listen() {
          throw new Error("bind failed");
        },
      };
    },
    resolveTarget() {
      return undefined;
    },
  };
  const node = createNode({
    nodeId: "node.failed",
    listen: { transportRef: "failed.listener" },
  }, { transport });

  await assert.rejects(node.start(), { code: "TRANSPORT_FAILURE" });
  assert.equal(node.operations.lifecycle().state, "Failed");
  await assert.rejects(node.start(), { code: "LIFECYCLE_INVALID" });
});
