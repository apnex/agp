import test from "node:test";
import assert from "node:assert/strict";
import { derivePeerExport } from "../../dist/index.js";

// Owns: local/transit/capacity export decisions and exact reasons.
test("given selected local and learned routes, when peer export is derived, then transit and capacity reasons are exact", () => {
  const selected = [
    {
      endpoint: "demo/local",
      routeId: "r1",
      originNodeId: "local",
      routeClass: "local",
      sourceKind: "local",
      path: ["local"],
      nextHop: { kind: "local", bindingId: "b1" },
      selectionReason: "ONLY_ELIGIBLE",
      selectedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      endpoint: "demo/transit",
      routeId: "r2",
      originNodeId: "origin",
      routeClass: "learned",
      learnedKind: "transit",
      sourceKind: "session",
      path: ["origin", "local"],
      nextHop: { kind: "session", nodeId: "peer.a", owningSessionId: "000001" },
      selectionReason: "ONLY_ELIGIBLE",
      selectedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const result = derivePeerExport({
    remoteNodeId: "peer.z",
    owningSessionId: "000002",
    selectedRoutes: selected,
    transitEnabled: false,
    maxPathLength: 16,
    maxRoutesPerSnapshot: 1,
  });
  assert.deepEqual(result.routes.map((value) => value.endpoint), ["demo/local"]);
  assert.equal(result.localDecisions[0].reasonCode, "TRANSIT_DISABLED");
});
