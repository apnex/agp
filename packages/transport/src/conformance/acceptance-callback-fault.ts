import type {
  AcceptanceCallbackFaultHarness,
  AcceptanceCallbackFaultKind,
  AcceptanceCallbackFaultObservation,
} from "./harness.js";
import { TransportConformanceViolation } from "./harness.js";

export interface AcceptanceCallbackFaultCaseResult {
  readonly id: "acceptance-callback-fault";
  readonly observations: readonly AcceptanceCallbackFaultObservation[];
}

export async function runAcceptanceCallbackFaultCase(
  harness: AcceptanceCallbackFaultHarness,
): Promise<AcceptanceCallbackFaultCaseResult> {
  const observations: AcceptanceCallbackFaultObservation[] = [];
  const inputs: readonly {
    readonly kind: AcceptanceCallbackFaultKind;
    readonly thrown: unknown;
  }[] = [
    { kind: "accept", thrown: new Error("private callback failure") },
    { kind: "pending-acquisition", thrown: 17 },
    { kind: "active-channel", thrown: Object.freeze({ private: true }) },
  ];
  for (const input of inputs) {
    const observation = await harness.exerciseCallbackFault(input);
    assertObservation(input.kind, input.thrown, observation);
    observations.push(Object.freeze(observation));
  }
  return Object.freeze({
    id: "acceptance-callback-fault",
    observations: Object.freeze(observations),
  });
}

function assertObservation(
  kind: AcceptanceCallbackFaultKind,
  thrown: unknown,
  value: AcceptanceCallbackFaultObservation,
): void {
  const code = kind === "accept"
    ? "ACCEPT_CALLBACK_FAILED"
    : "CAPACITY_REJECTED_CALLBACK_FAILED";
  if (value.callbackEscaped) fail("callback throw escaped its adapter boundary");
  if (!value.triggeringAuthorityReleasedBeforeDiagnostic) {
    fail("triggering acquisition authority was retained through diagnostics");
  }
  if (value.laterCallbackCount !== 0) {
    fail("a later acceptance callback began after callback fault");
  }
  if (!value.transferredChannelSurvived) {
    fail("listener fault closed an already transferred channel");
  }
  if (
    value.terminal.origin !== "carrier"
    || value.terminal.kind !== "adapter-fault"
    || value.terminal.diagnostic?.code !== code
  ) {
    fail(`callback fault terminal did not use ${code}`);
  }
  if (value.diagnostic?.code !== code) {
    fail(`callback diagnostic did not use ${code}`);
  }
  if (value.diagnosticCause !== thrown) {
    fail("raw callback cause did not remain a separate process-local value");
  }
}

function fail(message: string): never {
  throw new TransportConformanceViolation(
    "acceptance-callback-fault",
    message,
  );
}
