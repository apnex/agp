import test from "node:test";
import assert from "node:assert/strict";
import { operations, table } from "../fixtures/core-fixtures.js";

// Owns: one route transaction becomes one complete operations revision.
test("given a canonical before-state, when one route transaction commits, then operations exposes one complete after-revision", () => {
  const rib = table();
  const store = operations();
  const before = store.snapshot();
  rib.installLocal({ endpoint: "demo/local", bindingId: "binding" });
  const after = store.commit({ routing: rib.snapshot() });
  assert.equal(BigInt(after.revision), BigInt(before.revision) + 1n);
  assert.equal(after.candidateRoutes.length, 1);
  assert.equal(after.selectedRoutes.length, 1);
  assert.equal(after.forwarding.length, 1);
});
