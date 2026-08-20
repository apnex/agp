import type {
  CounterValue,
  OperationsReader,
} from "@agp/core";

export type {
  ManagementAdvertisementList,
  ManagementConfiguration,
  ManagementConnectionList,
  ManagementCounters,
  ManagementError,
  ManagementForwardingList,
  ManagementHealth,
  ManagementLocalEndpointList,
  ManagementMeta,
  ManagementOperationsSnapshot,
  ManagementResources,
  ManagementRouteTable,
  ManagementValue,
} from "./types.generated.js";

export type ManagementHttpServerErrorCode =
  | "CONFIG_INVALID"
  | "LIFECYCLE_INVALID"
  | "LISTEN_FAILED"
  | "INTERNAL";

export class ManagementHttpServerError extends Error {
  readonly code: ManagementHttpServerErrorCode;

  constructor(
    code: ManagementHttpServerErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ManagementHttpServerError";
    this.code = code;
  }
}

export interface ManagementHttpConfig {
  readonly host?: "127.0.0.1" | "::1";
  readonly port?: number;
  readonly maxResponseBytes?: number;
}

export interface ManagementHttpServer {
  start(): Promise<{ readonly url: string }>;
  stop(): Promise<void>;
}

export interface ManagementSchemaValidationIssue {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
}

export type ManagementSchemaValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues: readonly ManagementSchemaValidationIssue[];
    };

export type ManagementOperationsReader = OperationsReader;
export type ManagementCounterValue = CounterValue;
