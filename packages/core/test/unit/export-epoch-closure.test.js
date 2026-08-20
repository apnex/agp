import test from "node:test";
import assert from "node:assert/strict";
import { establish, table } from "../fixtures/core-fixtures.js";

// Owns: withdrawal closes the ACKed source epoch and returns a writer dependency.
test("given an ACKed source epoch, when its binding withdraws, then the epoch closes before the successor update", () => {
  const rib = table();
  rib.installLocal({ endpoint: "demo/source", bindingId: "binding" });
  const peer = establish(rib);
  let pending = rib.pendingRouteUpdates()[0].snapshot;
  rib.acknowledgeExport({
    owner: peer,
    refId: pending.id,
    revision: pending.revision,
    rejected: [],
  });
  assert.equal(rib.sourceExportEpoch({
    owner: peer,
    endpoint: "demo/source",
    originNodeId: "node.local",
  }), 1);
  const removed = rib.removeLocal("binding");
  assert.deepEqual(removed.closedEpochs.map((item) => item.epoch), [1]);
});
