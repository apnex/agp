import assert from "node:assert/strict";
import test from "node:test";
import {
  emitTransportDiagnostic,
  validateTransportSchema,
} from "../../dist/index.js";

const DIAGNOSTIC =
  "urn:agp:schema:v1:transport:contracts:transport-diagnostic";

test("Given absent, observing, and throwing diagnostic sinks, when a generated diagnostic and private cause are emitted, then absence and throws are inert while cause remains a separate process-local argument", () => {
  const diagnostic = Object.freeze({ code: "ADAPTER_FAILED" });
  const cause = new Error("private native detail");
  assert.equal(
    validateTransportSchema(DIAGNOSTIC, diagnostic).ok,
    true,
  );
  assert.doesNotThrow(() =>
    emitTransportDiagnostic(undefined, diagnostic, cause));

  const calls = [];
  emitTransportDiagnostic({
    emit(value, rawCause) {
      calls.push({ value, rawCause });
    },
  }, diagnostic, cause);
  assert.deepEqual(calls, [{ value: diagnostic, rawCause: cause }]);
  assert.equal(JSON.stringify(diagnostic).includes("private native"), false);

  assert.doesNotThrow(() =>
    emitTransportDiagnostic({
      emit() {
        throw new Error("sink failure");
      },
    }, diagnostic, cause));
});
