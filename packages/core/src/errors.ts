import type { JsonValue } from "@agp/protocol";
import { immutableClone } from "./immutable.js";
import type { AgpErrorCode } from "./types.js";

const RETRYABLE_CODES: ReadonlySet<AgpErrorCode> = new Set([
  "NOT_RUNNING",
  "SOURCE_NOT_ADVERTISED",
  "NEXT_HOP_UNAVAILABLE",
  "QUEUE_FULL",
  "TRANSPORT_FAILURE",
]);

export interface AgpErrorOptions {
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, JsonValue>>;
  readonly cause?: unknown;
}

export class AgpError extends Error {
  readonly code: AgpErrorCode;
  readonly operation: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, JsonValue>>;
  override readonly cause?: unknown;

  constructor(
    code: AgpErrorCode,
    operation: string,
    message: string,
    options: AgpErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AgpError";
    this.code = code;
    this.operation = operation;
    this.retryable = options.retryable ?? RETRYABLE_CODES.has(code);
    if (options.details !== undefined) this.details = immutableClone(options.details);
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export function isAgpError(value: unknown): value is AgpError {
  return value instanceof AgpError;
}

export function agpError(
  code: AgpErrorCode,
  operation: string,
  message = code,
  options?: AgpErrorOptions,
): AgpError {
  return new AgpError(code, operation, message, options);
}

export function normalizeAgpError(value: unknown, operation: string): AgpError {
  if (value instanceof AgpError) return value;
  return new AgpError("INTERNAL", operation, "Unexpected AGP failure", {
    cause: value,
  });
}
