import assert from "node:assert/strict";
import test from "node:test";
import {
  AGP_WEBSOCKET_SUBPROTOCOL,
  assertWebSocketTransportConfig,
  validateTrustedDevelopmentWebSocketUrl,
} from "../../dist/index.js";

const config = (url) => ({
  listeners: [],
  targets: [{
    transportRef: "peer",
    url,
    compression: { mode: "disabled" },
    security: { mode: "trusted-development" },
  }],
});

test("Given the certified profile, when configuration and locators are validated, then only exact agp.v1 over credential-free ws is admitted", () => {
  assert.equal(AGP_WEBSOCKET_SUBPROTOCOL, "agp.v1");
  assert.doesNotThrow(() =>
    assertWebSocketTransportConfig(config("ws://127.0.0.1:47000/agp?q=1")));
  assert.equal(
    validateTrustedDevelopmentWebSocketUrl("ws://localhost/agp").protocol,
    "ws:",
  );
  assert.throws(
    () => assertWebSocketTransportConfig(config("wss://localhost/agp")),
    (error) => error.code === "PROFILE_UNSUPPORTED",
  );
  assert.throws(
    () => assertWebSocketTransportConfig(config("ws://user@localhost/agp")),
    (error) => error.code === "URL_INVALID",
  );
});
