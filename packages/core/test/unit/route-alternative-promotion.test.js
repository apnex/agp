import test from "node:test";
import assert from "node:assert/strict";
import { establish, owner, route, table } from "../fixtures/core-fixtures.js";

// Owns: pure candidate loss atomically promotes one deterministic alternative.
test("given two eligible alternatives, when the selected session is removed, then the remaining candidate is promoted atomically", () => {
  const rib = table();
  const a = establish(rib, owner("a", "peer.a", "000001", "000002"));
  const b = establish(rib, owner("b", "peer.b", "000003", "000004"));
  rib.importSnapshot({
    owner: a,
    updateId: "a1",
    revision: 1,
    routes: [route("demo/x", "peer.a", ["peer.a"])],
  });
  rib.importSnapshot({
    owner: b,
    updateId: "b1",
    revision: 1,
    routes: [route("demo/x", "peer.b", ["peer.b"])],
  });
  assert.equal(rib.selectedRoute("demo/x").originNodeId, "peer.a");
  rib.removeSession("a");
  assert.equal(rib.selectedRoute("demo/x").originNodeId, "peer.b");
});
