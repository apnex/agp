import assert from "node:assert/strict";
import test from "node:test";
import {
  BreadcrumbStore,
  ReverseErrorEngine,
} from "../../dist/index.js";
import { fakeController } from "../support/fakes.js";

test("Given a current-node data failure, when it is returned, then one exact error writes directly to ingress", async () => {
  const ingress = fakeController();
  const engine = new ReverseErrorEngine({
    localNodeId: "middle.example",
    breadcrumbs: new BreadcrumbStore({
      maximumEntries: 4,
      maximumBytes: 1_024,
    }),
    monotonicNow: () => 1_000,
    nextMessageId: () => "error-1",
    encode: (message) =>
      new TextEncoder().encode(JSON.stringify(message)),
    publishLocal() {
      assert.fail("an immediate ingress error is not local delivery");
    },
  });

  await engine.sendImmediateFailure(ingress, {
    agp: 1,
    plane: "data",
    type: "message",
    id: "data-1",
    body: {
      source: {
        endpoint: "demo/source",
        originNodeId: "origin.example",
      },
      destination: "missing/destination",
      returnToken: "0000000000000007",
      hopLimit: 3,
      payload: {},
    },
  }, "NO_ROUTE");

  assert.equal(ingress.controlWrites.length, 1);
  assert.deepEqual(JSON.parse(ingress.controlWrites[0]), {
    agp: 1,
    plane: "control",
    type: "error",
    id: "error-1",
    body: {
      code: "NO_ROUTE",
      refId: "data-1",
      returnToken: "0000000000000007",
      failedAtNodeId: "middle.example",
      reason: "no selected route",
    },
  });
});
