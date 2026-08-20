import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGP_V1_LIMITS,
  encodeAgpPacket,
  parseAgpPacket,
  validateAgpMessage,
} from "../../dist/index.js";

const messages = JSON.parse(
  await readFile(
    new URL("../fixtures/valid-wire-messages.json", import.meta.url),
    "utf8",
  ),
);

test("Given one fixture for every v1 wire variant, when each is validated, encoded, and decoded, then the same closed message survives the round trip", () => {
  assert.deepEqual(
    messages.map((message) => message.type),
    [
      "open",
      "keepalive",
      "route.update",
      "route.ack",
      "notification",
      "error",
      "message",
    ],
  );

  for (const message of messages) {
    assert.deepEqual(validateAgpMessage(message), { ok: true, message });
    const encoded = encodeAgpPacket(message, AGP_V1_LIMITS.defaultReceiveBytes);
    assert.equal(encoded.ok, true);
    const parsed = parseAgpPacket(
      encoded.bytes,
      { receiveLimitBytes: AGP_V1_LIMITS.defaultReceiveBytes },
    );
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.message, message);
    assert.equal(parsed.utf8Bytes, encoded.utf8Bytes);
  }
});
