import test from "node:test";
import assert from "node:assert/strict";
import { establish, route, table } from "../fixtures/core-fixtures.js";

// Owns: receiver-in-path is nonfatal LOOP and never installed.
test("given a receiver-containing path, when it is imported, then LOOP is committed without installation", () => {
  const rib = table();
  const peer = establish(rib);
  const result = rib.importSnapshot({
    owner: peer,
    updateId: "u1",
    revision: 1,
    routes: [route("demo/loop", "origin", ["origin", "node.local", "peer.a"])],
  });
  assert.equal(result.ok, true);
  assert.equal(result.rejected[0].reasonCode, "LOOP");
  assert.equal(rib.selectedRoute("demo/loop"), undefined);
  assert.equal(rib.routeImportState(peer.controllerId).consumedRevision, 1);
});
