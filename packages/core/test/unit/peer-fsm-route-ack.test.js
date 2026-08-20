import test from "node:test";
import assert from "node:assert/strict";
import { validateRouteAck } from "../../dist/index.js";

// Owns: exact ACK correlation and unique rejection entries.
test("given one outstanding snapshot, when ACKs are validated, then exact message revision and unique results are required", () => {
  assert.equal(validateRouteAck({
    outstandingRefId: "m1",
    outstandingRevision: 1,
    refId: "m1",
    revision: 1,
    rejected: [],
  }).ok, true);
  assert.equal(validateRouteAck({
    outstandingRefId: "m1",
    outstandingRevision: 1,
    refId: "m2",
    revision: 1,
    rejected: [],
  }).ok, false);
  const duplicate = {
    endpoint: "demo/a",
    originNodeId: "origin",
    reasonCode: "POLICY",
  };
  assert.equal(validateRouteAck({
    outstandingRefId: "m1",
    outstandingRevision: 1,
    refId: "m1",
    revision: 1,
    rejected: [duplicate, duplicate],
  }).ok, false);
});
