import assert from "node:assert/strict";
import test from "node:test";
import {
  runAcceptanceCallbackFaultCase,
} from "../../dist/index.js";

test("Given accept and capacity callbacks that throw private values, when the reusable callback-fault case runs, then cleanup precedes bounded diagnostics and transferred channels survive one listener terminal", async () => {
  const result = await runAcceptanceCallbackFaultCase({
    async exerciseCallbackFault({ kind, thrown }) {
      const code = kind === "accept"
        ? "ACCEPT_CALLBACK_FAILED"
        : "CAPACITY_REJECTED_CALLBACK_FAILED";
      return {
        callbackEscaped: false,
        triggeringAuthorityReleasedBeforeDiagnostic: true,
        laterCallbackCount: 0,
        transferredChannelSurvived: true,
        terminal: {
          origin: "carrier",
          kind: "adapter-fault",
          diagnostic: { code },
        },
        diagnostic: { code },
        diagnosticCause: thrown,
      };
    },
  });

  assert.equal(result.observations.length, 3);
  assert.equal(result.observations[0].terminal.origin, "carrier");
});
