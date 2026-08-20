import type {
  TransportOperationErrorCode,
  TransportOperationPhase,
} from "./types.generated.js";

export type TransportSendAcceptance = "not-accepted" | "unknown";

const LEGAL_PHASES = Object.freeze({
  REFERENCE_INVALID: ["resolve-listener", "resolve-target"],
  BINDING_UNAVAILABLE: ["listen", "connect"],
  LISTEN_FAILED: ["listen"],
  CONNECT_FAILED: ["connect"],
  CAPACITY_EXCEEDED: ["listen", "connect"],
  PACKET_TOO_LARGE: ["send"],
  CONCURRENT_OPERATION: ["send", "read", "close"],
  CHANNEL_TERMINAL: ["send"],
  OPERATION_ABORTED: [
    "listen",
    "connect",
    "send",
    "read",
    "close",
    "wait-terminal",
  ],
  SEND_FAILED: ["send"],
  ADAPTER_FAULT: [
    "resolve-listener",
    "resolve-target",
    "listen",
    "connect",
    "send",
    "read",
  ],
} satisfies Readonly<
  Record<TransportOperationErrorCode, readonly TransportOperationPhase[]>
>);

const SEND_ACCEPTANCE_REQUIRED = new Set<TransportOperationErrorCode>([
  "PACKET_TOO_LARGE",
  "CONCURRENT_OPERATION",
  "CHANNEL_TERMINAL",
  "OPERATION_ABORTED",
  "SEND_FAILED",
  "ADAPTER_FAULT",
]);

export interface TransportOperationErrorInput {
  readonly code: TransportOperationErrorCode;
  readonly phase: TransportOperationPhase;
  readonly message: string;
  readonly acceptance?: TransportSendAcceptance;
  readonly cause?: unknown;
}

export class TransportOperationError extends Error {
  readonly code: TransportOperationErrorCode;
  readonly phase: TransportOperationPhase;
  readonly acceptance?: TransportSendAcceptance;

  constructor(input: TransportOperationErrorInput) {
    assertLegalTransportError(input);
    super(
      input.message,
      input.cause === undefined ? undefined : { cause: input.cause },
    );
    this.name = "TransportOperationError";
    this.code = input.code;
    this.phase = input.phase;
    if (input.acceptance !== undefined) this.acceptance = input.acceptance;
  }
}

export function assertLegalTransportError(
  input: Pick<
    TransportOperationErrorInput,
    "code" | "phase" | "acceptance"
  >,
): void {
  const legalPhases =
    LEGAL_PHASES[input.code] as readonly TransportOperationPhase[];
  if (!legalPhases.includes(input.phase)) {
    throw new TypeError(
      `illegal transport operation error pairing: ${input.code}/${input.phase}`,
    );
  }
  if (input.phase === "send" && SEND_ACCEPTANCE_REQUIRED.has(input.code)) {
    if (input.acceptance === undefined) {
      throw new TypeError(`${input.code}/send requires acceptance`);
    }
    if (
      input.code !== "SEND_FAILED"
      && input.code !== "ADAPTER_FAULT"
      && input.acceptance !== "not-accepted"
    ) {
      throw new TypeError(`${input.code}/send must be not-accepted`);
    }
  } else if (input.acceptance !== undefined) {
    throw new TypeError("acceptance is legal only for a failed send");
  }
}

export function isTransportOperationError(
  value: unknown,
): value is TransportOperationError {
  return value instanceof TransportOperationError;
}

export function operationAborted(
  phase: TransportOperationPhase,
  message: string,
): TransportOperationError {
  return new TransportOperationError({
    code: "OPERATION_ABORTED",
    phase,
    message,
    ...(phase === "send"
      ? { acceptance: "not-accepted" as const }
      : {}),
  });
}
