import test from "node:test";
import assert from "node:assert/strict";
import { table } from "../fixtures/core-fixtures.js";

// Owns: binding close removes local candidate, Loc-RIB and FIB in one revision.
test("given an installed local binding, when it closes, then candidate Loc-RIB and FIB disappear in one revision", () => {
  const rib = table();
  rib.installLocal({ endpoint: "demo/local", bindingId: "binding" });
  const before = rib.snapshot().revision;
  rib.removeLocal("binding");
  const after = rib.snapshot();
  assert.equal(BigInt(after.revision), BigInt(before) + 1n);
  assert.equal(after.candidateRoutes.length, 0);
  assert.equal(after.selectedRoutes.length, 0);
  assert.equal(after.forwarding.length, 0);
});
