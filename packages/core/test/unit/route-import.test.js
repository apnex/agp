import test from "node:test";
import assert from "node:assert/strict";
import { establish, owner, route, table } from "../fixtures/core-fixtures.js";

// Owns: full authoritative replacement of only one session's Adj-RIB-In.
test("given two session-owned Adj-RIB-In sets, when one authoritative snapshot omits a route, then only that slot withdraws", () => {
  const rib = table();
  const a = establish(rib, owner("a", "peer.a", "000001", "000002"));
  const b = establish(rib, owner("b", "peer.b", "000003", "000004"));
  assert.equal(rib.importSnapshot({
    owner: a,
    updateId: "a1",
    revision: 1,
    routes: [route("demo/a", "peer.a", ["peer.a"])],
  }).ok, true);
  assert.equal(rib.importSnapshot({
    owner: b,
    updateId: "b1",
    revision: 1,
    routes: [route("demo/b", "peer.b", ["peer.b"])],
  }).ok, true);
  rib.importSnapshot({ owner: a, updateId: "a2", revision: 2, routes: [] });
  assert.deepEqual(
    rib.snapshot().advertisements.map((item) => item.endpoint),
    ["demo/b"],
  );
});
