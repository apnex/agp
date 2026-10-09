import assert from "node:assert/strict";
import test from "node:test";
import { validateCoreSchema } from "../../dist/index.js";

const outcomeId = "urn:agp:schema:v1:core:sdk:message-outcome";
const dispositionId = "urn:agp:schema:v1:core:sdk:message-disposition";

test("Given SDK outcomes, when validated, then uncertainty cannot masquerade as refusal and refusal requires its evidence", () => {
  for (const outcome of [
    { kind: "delivered" },
    { kind: "unknown" },
    { kind: "failed", code: "NEXT_HOP_UNAVAILABLE", reason: "selected next hop unavailable", failedAtNodeId: "node.example" },
  ]) assert.equal(validateCoreSchema(outcomeId, outcome).ok, true);
  for (const outcome of [
    { kind: "failed" },
    { kind: "unknown", code: "NEXT_HOP_UNAVAILABLE" },
    { kind: "delivered", failedAtNodeId: "node.example" },
  ]) assert.equal(validateCoreSchema(outcomeId, outcome).ok, false);
});

test("Given an unsettled SDK disposition, when no denominator is known, then the observation is valid without claiming a total", () => {
  assert.equal(validateCoreSchema(dispositionId, {
    messageId: "message-1", correlationId: "attempt-1", source: "origin/source",
    destination: "sink/service", outcomes: [], outstanding: 1, settled: false,
  }).ok, true);
});
