import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyWebSocketMessage,
} from "../../dist/index.js";

test("Given binary and text WebSocket messages, when binding classification runs, then one binary message is one opaque packet and text is rejected before protocol decoding", () => {
  const bytes = new Uint8Array([0, 255, 193, 40]);
  const binary = classifyWebSocketMessage({
    bytes,
    isBinary: true,
    maxPacketBytes: 16,
  });
  assert.equal(binary.kind, "packet");
  assert.equal(binary.packet.bytes, bytes);

  const text = classifyWebSocketMessage({
    bytes: new TextEncoder().encode("{}"),
    isBinary: false,
    maxPacketBytes: 16,
  });
  assert.deepEqual(text, {
    kind: "input-rejected",
    bindingCode: "TEXT_MESSAGE",
    rejection: {
      kind: "input-rejected",
      code: "MALFORMED_CARRIER_INPUT",
    },
    terminal: {
      origin: "remote",
      kind: "binding-violation",
      diagnostic: { code: "MALFORMED_CARRIER_INPUT" },
    },
    close: { code: 1003, reason: "" },
  });
});

test("Given an over-limit WebSocket message of either data kind, when binding classification runs, then size precedence selects PACKET_TOO_LARGE and Close 1009", () => {
  for (const isBinary of [true, false]) {
    const result = classifyWebSocketMessage({
      bytes: new Uint8Array(5),
      isBinary,
      maxPacketBytes: 4,
    });
    assert.equal(result.kind, "input-rejected");
    assert.equal(result.bindingCode, "PACKET_TOO_LARGE");
    assert.equal(result.rejection.code, "PACKET_TOO_LARGE");
    assert.deepEqual(result.close, { code: 1009, reason: "" });
  }
});
