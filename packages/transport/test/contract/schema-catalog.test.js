import assert from "node:assert/strict";
import test from "node:test";
import {
  AGP_TRANSPORT_V1_SCHEMA_IDS,
  getTransportSchema,
  validateTransportSchema,
} from "../../dist/index.js";

const TERMINAL =
  "urn:agp:schema:v1:transport:contracts:transport-terminal";

test("Given the neutral schema catalog, when generated documents are resolved and impossible terminal products are validated, then every catalog entry exists and closed products fail", () => {
  assert.equal(AGP_TRANSPORT_V1_SCHEMA_IDS.length, 19);
  for (const id of AGP_TRANSPORT_V1_SCHEMA_IDS) {
    assert.equal(getTransportSchema(id)?.$id, id);
  }
  assert.equal(validateTransportSchema(TERMINAL, {
    origin: "local",
    kind: "aborted",
    diagnostic: { code: "STOPPED" },
  }).ok, true);
  assert.equal(validateTransportSchema(TERMINAL, {
    origin: "remote",
    kind: "aborted",
  }).ok, false);
  assert.equal(validateTransportSchema(TERMINAL, {
    origin: "local",
    kind: "adapter-fault",
  }).ok, false);
});
