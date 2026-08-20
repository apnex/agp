import assert from "node:assert/strict";
import test from "node:test";

import {
  isMessageId,
  isReturnToken,
  isSessionId,
  validateProtocolSchema,
} from "../../dist/index.js";

const schemaId = "urn:agp:schema:v1:protocol:common:return-token";

test("Given fixed-width lowercase hexadecimal values, when ReturnToken shape is checked, then exactly the unsigned 64-bit lexical domain is accepted", () => {
  for (const token of [
    "0000000000000000",
    "0123456789abcdef",
    "ffffffffffffffff",
  ]) {
    assert.equal(isReturnToken(token), true);
    assert.equal(validateProtocolSchema(schemaId, token).ok, true);
  }
  for (const token of [
    "000000000000000",
    "00000000000000000",
    "0123456789abcdeF",
    "session-token-001",
  ]) {
    assert.equal(isReturnToken(token), false);
    assert.equal(validateProtocolSchema(schemaId, token).ok, false);
  }
});

test("Given the same textual value is considered in distinct identity domains, when scalar guards run, then SessionId and MessageId cannot stand in for ReturnToken shape", () => {
  assert.equal(isSessionId("abcdef"), true);
  assert.equal(isReturnToken("abcdef"), false);
  assert.equal(isMessageId("message-1"), true);
  assert.equal(isReturnToken("message-1"), false);
});
