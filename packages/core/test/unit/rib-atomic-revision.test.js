import test from "node:test";
import assert from "node:assert/strict";
import { operations, table } from "../fixtures/core-fixtures.js";

// Owns: one route transaction becomes one complete operations revision.
test("given a canonical before-state, when one route transaction commits, then operations exposes one complete after-revision", () => {
  const rib = table();
  const store = operations();
  const before = store.snapshot();
  rib.installLocal({ endpoint: "demo/local", bindingId: "binding" });
  const receipt = store.commit({ routing: rib.snapshot() });
  assert.equal(BigInt(receipt.revision), BigInt(before.revision) + 1n);

  // A commit reports the revision it wrote; state is asked for separately,
  // under `D21`. Atomicity is the claim under test either way: one
  // transaction must leave every derived collection at one revision, and the
  // receipt must name the revision the snapshot carries.
  const after = store.snapshot();
  assert.equal(after.revision, receipt.revision);
  assert.equal(after.candidateRoutes.length, 1);
  assert.equal(after.selectedRoutes.length, 1);
  assert.equal(after.forwarding.length, 1);
});
