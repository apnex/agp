import assert from "node:assert/strict";
import test from "node:test";

import {
  AGP_V1_LIMITS,
  parseAgpPacket,
  validateAgpMessage,
} from "../../dist/index.js";

const limits = { receiveLimitBytes: AGP_V1_LIMITS.defaultReceiveBytes };
const bytes = (value) => new TextEncoder().encode(value);

test("Given malformed JSON or a duplicate object member, when raw preflight runs before JSON.parse, then the erased evidence receives its exact fatal classification", () => {
  assert.deepEqual(parseAgpPacket(bytes('{"agp":1'), limits), {
    ok: false,
    reasonCode: "INVALID_JSON",
    notificationCode: "INVALID_MESSAGE",
  });
  assert.deepEqual(
    parseAgpPacket(
      bytes('{"agp":1,"agp":1,"plane":"control","type":"keepalive","id":"k-1","body":{}}'),
      limits,
    ),
    {
      ok: false,
      reasonCode: "DUPLICATE_MEMBER",
      notificationCode: "INVALID_MESSAGE",
    },
  );
});

test("Given lossy integer tokens or hostile in-memory graphs, when preflight inspects them, then numeric-profile and runtime-shape failures precede schema validation", () => {
  assert.deepEqual(
    parseAgpPacket(
      bytes('{"agp":1,"plane":"control","type":"keepalive","id":"k-1","body":{},"extensions":{"example.value":9007199254740992}}'),
      limits,
    ),
    {
      ok: false,
      reasonCode: "NUMERIC_PROFILE",
      notificationCode: "INVALID_MESSAGE",
    },
  );

  const cyclic = {};
  cyclic.self = cyclic;
  assert.deepEqual(validateAgpMessage(cyclic), {
    ok: false,
    reasonCode: "SCHEMA",
    notificationCode: "INVALID_MESSAGE",
  });
});

test("Given invalid UTF-8 bytes or an oversized packet, when protocol byte admission runs, then neutral invalid-message classifications precede JSON semantics", () => {
  assert.deepEqual(parseAgpPacket(Uint8Array.from([0xc3, 0x28]), limits), {
    ok: false,
    reasonCode: "INVALID_UTF8",
    notificationCode: "INVALID_MESSAGE",
  });

  const oversized = new Uint8Array(AGP_V1_LIMITS.minReceiveBytes + 1);
  assert.deepEqual(
    parseAgpPacket(oversized, {
      receiveLimitBytes: AGP_V1_LIMITS.minReceiveBytes,
    }),
    {
      ok: false,
      reasonCode: "MESSAGE_TOO_LARGE",
      notificationCode: "INVALID_MESSAGE",
    },
  );
});
