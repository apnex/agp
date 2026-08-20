import assert from "node:assert/strict";
import test from "node:test";
import { validateCoreSchema } from "../../dist/index.js";

const SESSION_TRANSITION_SCHEMA_ID =
  "urn:agp:schema:v1:core:operations:session-transition-snapshot";

test("given a canonical session transition whose optional reason is absent, when the sovereign runtime schema validates it, then the transition is accepted unchanged", () => {
  const transition = {
    event: "TransportAccepted",
    from: "Active",
    to: "OpenSent",
    at: "2026-07-30T00:00:00.000Z",
  };

  const result = validateCoreSchema(
    SESSION_TRANSITION_SCHEMA_ID,
    transition,
  );

  assert.deepEqual(result, {
    ok: true,
    value: transition,
  });
  assert.equal("reasonCode" in result.value, false);
});
