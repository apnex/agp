import test from "node:test";
import assert from "node:assert/strict";
import { establish, owner, route, table } from "../fixtures/core-fixtures.js";

// Owns: exact session loss removes all and only its routing state.
test("given routes from two controllers, when one session withdraws, then only its advertisements disappear", () => {
  const rib = table();
  const a = establish(rib, owner("a", "peer.a", "000001", "000002"));
  const b = establish(rib, owner("b", "peer.b", "000003", "000004"));
  rib.importSnapshot({
    owner: a,
    updateId: "a1",
    revision: 1,
    routes: [route("demo/a", "peer.a", ["peer.a"])],
  });
  rib.importSnapshot({
    owner: b,
    updateId: "b1",
    revision: 1,
    routes: [route("demo/b", "peer.b", ["peer.b"])],
  });
  rib.removeSession("a");
  assert.deepEqual(
    rib.snapshot().advertisements.map((value) => value.endpoint),
    ["demo/b"],
  );
});
