import test from "node:test";
import assert from "node:assert/strict";
import {
  rejectionRetryDelay,
} from "../../dist/index.js";
import { clock, establish, ids } from "../fixtures/core-fixtures.js";
import { RoutingTable } from "../../dist/index.js";

// Owns: deterministic recovery delay, expiry and no immediate resend.
test("given an unchanged POLICY rejection, when monotonic backoff expires, then exactly one saturated retry becomes pending", () => {
  assert.equal(rejectionRetryDelay(1000, 30000, 0), 1000);
  assert.equal(rejectionRetryDelay(1000, 30000, 10), 30000);
  const time = clock();
  const rib = new RoutingTable({
    nodeId: "node.local",
    ids: ids(),
    clock: time,
    transitEnabled: true,
    routeRejectionRetry: { initialMs: 1000, maxMs: 30000 },
  });
  rib.installLocal({ endpoint: "demo/source", bindingId: "binding" });
  const peer = establish(rib);
  const update = rib.pendingRouteUpdates()[0].snapshot;
  rib.acknowledgeExport({
    owner: peer,
    refId: update.id,
    revision: update.revision,
    rejected: [{
      endpoint: "demo/source",
      originNodeId: "node.local",
      reasonCode: "POLICY",
    }],
  });
  assert.equal(rib.pendingRouteUpdates().length, 0);
  time.advanceBy(999);
  assert.equal(rib.advanceRemoteRejectionRetry(peer.controllerId), undefined);
  time.advanceBy(1);
  assert.notEqual(rib.advanceRemoteRejectionRetry(peer.controllerId), undefined);
  assert.equal(rib.pendingRouteUpdates().length, 1);
});
