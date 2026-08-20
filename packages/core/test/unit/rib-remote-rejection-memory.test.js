import test from "node:test";
import assert from "node:assert/strict";
import { establish, table } from "../fixtures/core-fixtures.js";

// Owns: unchanged rejected tuple memory; excludes timer scheduling.
test("given a nonretryable peer rejection, when its route tuple stays unchanged, then it remains filtered without resend", () => {
  const rib = table();
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
      reasonCode: "LOOP",
    }],
  });
  const state = rib.routeExportState(peer.controllerId);
  assert.equal(
    state.routeDecisions.some((row) =>
      row.state === "rejected" && row.remoteRejectionCode === "LOOP"),
    true,
  );
  assert.equal(rib.pendingRouteUpdates().length, 0);
});
