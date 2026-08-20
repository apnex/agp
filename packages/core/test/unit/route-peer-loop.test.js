import test from "node:test";
import assert from "node:assert/strict";
import { derivePeerExport } from "../../dist/index.js";

// Owns: peer-containing selected path suppression for only that peer.
test("given a selected learned path, when exporting to different peers, then only a path member is suppressed", () => {
  const selected = [{
    endpoint: "demo/a",
    routeId: "r",
    originNodeId: "origin",
    routeClass: "learned",
    learnedKind: "transit",
    sourceKind: "session",
    path: ["origin", "peer.a", "local"],
    nextHop: { kind: "session", nodeId: "peer.a", owningSessionId: "000001" },
    selectionReason: "ONLY_ELIGIBLE",
    selectedAt: "2026-01-01T00:00:00.000Z",
  }];
  const derive = (remoteNodeId) => derivePeerExport({
    remoteNodeId,
    owningSessionId: "000002",
    selectedRoutes: selected,
    transitEnabled: true,
    maxPathLength: 16,
    maxRoutesPerSnapshot: 16,
  });
  assert.equal(derive("peer.a").localDecisions[0].reasonCode, "PEER_IN_PATH");
  assert.equal(derive("peer.b").routes.length, 1);
});
