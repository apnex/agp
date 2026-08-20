import test from "node:test";
import assert from "node:assert/strict";
import { validateInboundRouteRevision } from "../../dist/index.js";

// Owns: exact successor and no-wrap inbound revision semantics.
test("given a consumed inbound revision, when revisions are validated, then only the exact safe successor is accepted", () => {
  assert.deepEqual(validateInboundRouteRevision(0, 1), {
    ok: true,
    revision: 1,
  });
  for (const proposed of [1, 3, undefined]) {
    assert.equal(validateInboundRouteRevision(1, proposed).ok, false);
  }
  assert.equal(
    validateInboundRouteRevision(
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    ).ok,
    false,
  );
});
