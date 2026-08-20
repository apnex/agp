import assert from "node:assert/strict";
import test from "node:test";

import { validateCoreSchema } from "../../dist/index.js";

const SCHEMA_ID = "urn:agp:schema:v1:core:sdk:diagnostic-record";
const DOMAINS = [
  "lifecycle",
  "protocol",
  "transport",
  "session",
  "routing",
  "admission",
  "handler",
  "operations",
  "sdk",
];
const SEVERITIES = ["warning", "error", "critical"];

test("given every closed diagnostic domain and severity, when the sovereign record is validated, then only bounded canonical observation is accepted", () => {
  for (const domain of DOMAINS) {
    for (const severity of SEVERITIES) {
      assert.equal(validateCoreSchema(SCHEMA_ID, record({
        domain,
        severity,
      })).ok, true, `${domain}/${severity}`);
    }
  }
  assert.equal(validateCoreSchema(
    SCHEMA_ID,
    record({ message: "x".repeat(256) }),
  ).ok, true);
});

test("given extension, raw-cause, control-text, and size violations, when diagnostic records are validated, then none can cross the closed sink boundary", () => {
  for (const invalid of [
    record({ context: {} }),
    record({ details: {} }),
    record({ cause: "native failure" }),
    record({ message: "line one\nline two" }),
    record({ message: "x".repeat(257) }),
    record({ code: "lowercase" }),
    record({ domain: "carrier" }),
    record({ severity: "info" }),
  ]) {
    assert.equal(validateCoreSchema(SCHEMA_ID, invalid).ok, false);
  }
});

function record(overrides = {}) {
  return {
    schemaVersion: "agp.diagnostic/v1",
    nodeId: "node.diagnostics",
    instanceId: "instance-diagnostics",
    occurredAt: "2026-07-30T00:00:00.000Z",
    operationsRevision: "7",
    domain: "transport",
    severity: "error",
    code: "CONNECT_FAILED",
    message: "Transport acquisition failed",
    ...overrides,
  };
}
