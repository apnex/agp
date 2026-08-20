import {
  TransportOperationError,
  type TransportOperationErrorCode,
  type TransportOperationPhase,
} from "@agp/transport";

export function operationError(
  code: TransportOperationErrorCode,
  phase: TransportOperationPhase,
  message: string,
  options: {
    readonly acceptance?: "not-accepted" | "unknown";
    readonly cause?: unknown;
  } = {},
): TransportOperationError {
  return new TransportOperationError({
    code,
    phase,
    message,
    ...(options.acceptance === undefined
      ? {}
      : { acceptance: options.acceptance }),
    ...(options.cause === undefined ? {} : { cause: options.cause }),
  });
}

export function configurationError(message: string): RangeError {
  const error = new RangeError(message);
  error.name = "LoopbackConfigurationError";
  return error;
}
