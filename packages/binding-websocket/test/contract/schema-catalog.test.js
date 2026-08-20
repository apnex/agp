import assert from "node:assert/strict";
import test from "node:test";
import {
  AGP_WEBSOCKET_BINDING_V1_SCHEMA_IDS,
  getWebSocketBindingSchema,
  validateWebSocketBindingSchema,
} from "../../dist/index.js";

const TRANSPORT =
  "urn:agp:schema:v1:binding-websocket:configuration:transport";

test("Given the WebSocket binding catalog, when generated records are resolved and validated, then every carrier-owned schema is sovereign and closed", () => {
  assert.equal(AGP_WEBSOCKET_BINDING_V1_SCHEMA_IDS.length, 9);
  for (const id of AGP_WEBSOCKET_BINDING_V1_SCHEMA_IDS) {
    assert.equal(getWebSocketBindingSchema(id)?.$id, id);
  }
  assert.equal(validateWebSocketBindingSchema(TRANSPORT, {
    listeners: [],
    targets: [],
  }).ok, true);
  assert.equal(validateWebSocketBindingSchema(TRANSPORT, {
    listeners: [],
    targets: [],
    receiveLimits: {},
  }).ok, false);
});
