import {
  TransportOperationError,
} from "@agp/transport";
import type {
  TransportOperationErrorCode,
  TransportOperationPhase,
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

export class NodeWsConfigurationError extends TypeError {
  readonly code:
    | "CAPABILITIES_INVALID"
    | "COMPRESSION_UNSUPPORTED"
    | "LIMITS_INVALID";

  constructor(code: NodeWsConfigurationError["code"], message: string) {
    super(message);
    this.name = "NodeWsConfigurationError";
    this.code = code;
  }
}
