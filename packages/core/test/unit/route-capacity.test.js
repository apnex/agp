import test from "node:test";
import assert from "node:assert/strict";
import { establish, route, table } from "../fixtures/core-fixtures.js";

// Owns: canonical all-or-nothing local capacity and partial import capacity.
test("given bounded candidate capacity, when a snapshot exceeds it, then a canonical prefix is admitted atomically", () => {
  const rib = table({ maxCandidateRoutes: 1, maxLocalEndpoints: 1 });
  const peer = establish(rib);
  const result = rib.importSnapshot({
    owner: peer,
    updateId: "u1",
    revision: 1,
    routes: [
      route("demo/a", "peer.a", ["peer.a"]),
      route("demo/b", "peer.a", ["peer.a"]),
    ],
  });
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].endpoint, "demo/a");
  assert.equal(result.rejected[0].reasonCode, "CAPACITY");
  assert.throws(() => rib.installLocal({
    endpoint: "demo/local",
    bindingId: "binding",
  }));
  assert.equal(rib.snapshot().candidateRoutes.length, 1);
});
