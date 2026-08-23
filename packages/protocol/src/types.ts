export type {
  AgpEnvelope,
  CreditGrant,
  AgpMessage,
  CorrelationId,
  DataBody,
  DataMessage,
  DeliveryFailure,
  DispositionBody,
  DispositionMessage,
  LabelRange,
  DeliveryErrorCode,
  EndpointName,
  EndpointSource,
  Extensions,
  FatalNotificationCode,
  JsonObject,
  JsonValue,
  KeepaliveBody,
  KeepaliveMessage,
  MessageId,
  NodeId,
  NodePath,
  NotificationBody,
  NotificationMessage,
  OpenBody,
  OpenMessage,
  ReturnToken,
  RouteAckBody,
  RouteAckMessage,
  RouteAdvertisement,
  RouteKey,
  RouteRejection,
  RouteRejectionCode,
  RouteUpdateBody,
  RouteUpdateMessage,
  SessionId,
  WireRevision,
} from "./types.generated.js";

import type { AgpMessage } from "./types.generated.js";

export interface ParseLimits {
  readonly receiveLimitBytes: number;
}

export type InvalidValueReasonCode =
  | "TOP_LEVEL_NOT_OBJECT"
  | "SCHEMA"
  | "NUMERIC_PROFILE"
  | "DEPTH_LIMIT";

export type InvalidTextReasonCode =
  | "INVALID_JSON"
  | "DUPLICATE_MEMBER"
  | InvalidValueReasonCode;

export type ValidationReasonCode =
  | InvalidValueReasonCode
  | "UNSUPPORTED_VERSION";

export type ParseReasonCode =
  | InvalidTextReasonCode
  | "UNSUPPORTED_VERSION"
  | "INVALID_UTF8"
  | "MESSAGE_TOO_LARGE"
  | "LIMIT_INVALID";

export type ValidationFailure =
  | {
      readonly ok: false;
      readonly reasonCode: InvalidValueReasonCode;
      readonly notificationCode: "INVALID_MESSAGE";
    }
  | {
      readonly ok: false;
      readonly reasonCode: "UNSUPPORTED_VERSION";
      readonly notificationCode: "UNSUPPORTED_VERSION";
    };

export type ValidationResult =
  | { readonly ok: true; readonly message: AgpMessage }
  | ValidationFailure;

export type ParseFailure =
  | ValidationFailure
  | {
      readonly ok: false;
      readonly reasonCode: "INVALID_JSON" | "DUPLICATE_MEMBER";
      readonly notificationCode: "INVALID_MESSAGE";
    }
  | {
      readonly ok: false;
      readonly reasonCode: "INVALID_UTF8" | "MESSAGE_TOO_LARGE";
      readonly notificationCode: "INVALID_MESSAGE";
    }
  | {
      readonly ok: false;
      readonly reasonCode: "LIMIT_INVALID";
      readonly notificationCode?: never;
    };

export type ParseResult =
  | {
      readonly ok: true;
      readonly message: AgpMessage;
      readonly utf8Bytes: number;
    }
  | ParseFailure;

export type EncodeResult =
  | {
      readonly ok: true;
      readonly bytes: Readonly<Uint8Array>;
      readonly utf8Bytes: number;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "INVALID_MESSAGE";
      readonly notificationCode?: never;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "MESSAGE_TOO_LARGE";
      readonly notificationCode?: never;
    }
  | {
      readonly ok: false;
      readonly reasonCode: "LIMIT_INVALID";
      readonly notificationCode?: never;
    };

export interface SchemaValidationIssue {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
}

export type SchemaValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reasonCode: "SCHEMA";
      readonly issues: readonly SchemaValidationIssue[];
    };
