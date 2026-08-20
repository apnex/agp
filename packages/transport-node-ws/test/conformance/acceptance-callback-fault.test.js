import assert from "node:assert/strict";
import test from "node:test";
import {
  runAcceptanceCallbackFaultCase,
} from "@agp/transport";
import {
  exerciseActualCallbackFault,
} from "../support/callback-fault.js";

test("Given real accept and capacity callbacks that throw Error and non-Error values, when the neutral callback-fault case runs, then Node ws contains the throw, releases authority, terminalizes once, and preserves transferred channels", async () => {
  const result = await runAcceptanceCallbackFaultCase({
    exerciseCallbackFault: exerciseActualCallbackFault,
  });

  assert.equal(result.observations.length, 3);
  assert.deepEqual(
    result.observations.map((entry) => entry.diagnostic.code),
    [
      "ACCEPT_CALLBACK_FAILED",
      "CAPACITY_REJECTED_CALLBACK_FAILED",
      "CAPACITY_REJECTED_CALLBACK_FAILED",
    ],
  );
});
