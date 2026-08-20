import assert from "node:assert/strict";
import test from "node:test";
import {
  BreadcrumbStore,
  ReverseErrorEngine,
} from "../../dist/index.js";
import {
  breadcrumb,
  fakeController,
} from "../support/fakes.js";

test("Given a transit breadcrumb, when an error returns, then relay uses recorded ingress and translates only hop-local identity", async () => {
  const ingress = fakeController({
    remoteNodeId: "upstream.example",
    owningSessionId: "000001",
  });
  const egress = fakeController({
    remoteNodeId: "downstream.example",
    owningSessionId: "000002",
  });
  const store = new BreadcrumbStore({
    maximumEntries: 4,
    maximumBytes: 1_024,
  });
  store.add(breadcrumb({
    egress,
    messageId: "data-1",
    outboundReturnToken: "000000000000000b",
    ingress: {
      kind: "session",
      controller: ingress,
      nodeId: ingress.remoteNodeId,
      owningSessionId: ingress.owningSessionId,
      upstreamReturnToken: "000000000000000a",
    },
  }), 100);
  const engine = new ReverseErrorEngine({
    localNodeId: "middle.example",
    breadcrumbs: store,
    monotonicNow: () => 1_000,
    nextMessageId: () => "relay-1",
    encode: (message) =>
      new TextEncoder().encode(JSON.stringify(message)),
    publishLocal() {
      assert.fail("transit breadcrumb must not publish locally");
    },
  });
  const received = {
    agp: 1,
    plane: "control",
    type: "error",
    id: "downstream-error",
    body: {
      code: "NO_ROUTE",
      refId: "data-1",
      returnToken: "000000000000000b",
      failedAtNodeId: "failure.example",
      reason: "no selected route",
    },
    extensions: { trace: "bounded" },
  };

  assert.equal((await engine.receive(egress, received)).kind, "relayed");
  const relayed = JSON.parse(ingress.controlWrites[0]);
  assert.equal(relayed.id, "relay-1");
  assert.equal(relayed.body.returnToken, "000000000000000a");
  assert.deepEqual(
    { ...relayed, id: received.id, body: received.body },
    received,
  );
});
