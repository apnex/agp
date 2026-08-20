import assert from "node:assert/strict";
import test from "node:test";
import { TRANSPORT_CONFORMANCE_CASES } from "../../dist/index.js";

test("Given the ratified neutral invariants and obligations, when conformance coverage is indexed, then every T01 through T21 and obligation 1 through 24 has a reusable named case", () => {
  const invariants = new Set(
    TRANSPORT_CONFORMANCE_CASES.flatMap((entry) => entry.invariants),
  );
  const obligations = new Set(
    TRANSPORT_CONFORMANCE_CASES.flatMap((entry) => entry.obligations),
  );

  assert.deepEqual(
    [...invariants].sort(),
    Array.from({ length: 21 }, (_, index) =>
      `T${String(index + 1).padStart(2, "0")}`),
  );
  assert.deepEqual(
    [...obligations].sort((left, right) => left - right),
    Array.from({ length: 24 }, (_, index) => index + 1),
  );
  assert.equal(
    new Set(TRANSPORT_CONFORMANCE_CASES.map((entry) => entry.id)).size,
    TRANSPORT_CONFORMANCE_CASES.length,
  );
});
