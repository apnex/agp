// Generated from the sovereign JSON Schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

declare const nodeIdBrand: unique symbol;
declare const sessionIdBrand: unique symbol;
declare const messageIdBrand: unique symbol;
declare const returnTokenBrand: unique symbol;
declare const correlationIdBrand: unique symbol;
declare const endpointNameBrand: unique symbol;
declare const wireRevisionBrand: unique symbol;

export type NodeId = string & { readonly [nodeIdBrand]: "NodeId" };
export type SessionId = string & { readonly [sessionIdBrand]: "SessionId" };
export type MessageId = string & { readonly [messageIdBrand]: "MessageId" };
export type ReturnToken = string & { readonly [returnTokenBrand]: "ReturnToken" };
export type CorrelationId = string & { readonly [correlationIdBrand]: "CorrelationId" };
export type EndpointName = string & { readonly [endpointNameBrand]: "EndpointName" };
export type WireRevision = number & { readonly [wireRevisionBrand]: "WireRevision" };

export type JsonValue =
  | null
  | boolean
  | string
  | number
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonObject = Readonly<Record<string, JsonValue>>;
export type Extensions = JsonObject;
export type NodePath = readonly NodeId[];

export type FatalNotificationCode =
  | "CEASE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_MESSAGE"
  | "UNEXPECTED_MESSAGE"
  | "IDENTITY_REJECTED"
  | "ADJACENCY_COLLISION"
  | "HOLD_TIMEOUT"
  | "ROUTE_REVISION_ERROR"
  | "INTERNAL_ERROR";

export type DeliveryErrorCode =
  | "NO_ROUTE"
  | "HOP_LIMIT_EXCEEDED"
  | "SOURCE_NOT_AUTHORIZED"
  | "SOURCE_NOT_ADVERTISED"
  | "TRANSIT_DISABLED"
  | "NEXT_HOP_UNAVAILABLE"
  | "MESSAGE_TOO_LARGE"
  | "QUEUE_FULL";

export type RouteRejectionCode =
  | "LOOP"
  | "PATH_TOO_LONG"
  | "POLICY"
  | "CAPACITY";

export interface RouteKey {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
}

export interface EndpointSource {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
}

export interface RouteAdvertisement {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly path: NodePath;
}

export interface RouteRejection {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly reasonCode: RouteRejectionCode;
}

export interface AgpEnvelope<
  P extends "control" | "data",
  T extends string,
  B extends object,
> {
  readonly agp: 1;
  readonly plane: P;
  readonly type: T;
  readonly id: MessageId;
  readonly credit?: CreditGrant;
  readonly body: B;
  readonly extensions?: Extensions;
}

/** Receive credit a node grants its peer. Absent means unlimited. */
export interface CreditGrant {
  readonly bytes: number;
  readonly packets: number;
}

export interface OpenBody {
  readonly nodeId: NodeId;
  readonly sessionId: SessionId;
  readonly holdTimeMs: number;
  readonly receiveLimitBytes: number;
  readonly maxRoutesPerSnapshot: number;
  readonly maxPathLength: number;
  readonly maxDataHopLimit: number;
  readonly initialCredit?: CreditGrant;
  readonly transit: boolean;
}

export type KeepaliveBody = Readonly<Record<string, never>>;

export interface RouteUpdateBody {
  readonly revision: WireRevision;
  readonly routes: readonly RouteAdvertisement[];
}

export interface RouteAckBody {
  readonly refId: MessageId;
  readonly revision: WireRevision;
  readonly rejected: readonly RouteRejection[];
}

export interface NotificationBody {
  readonly code: FatalNotificationCode;
  readonly reason: string;
}

interface DeliveryErrorFields {
  readonly refId: MessageId;
  readonly returnToken: ReturnToken;
  readonly failedAtNodeId: NodeId;
}

export type DeliveryErrorBody = DeliveryErrorFields & (
  | { readonly code: "NO_ROUTE"; readonly reason: "no selected route" }
  | { readonly code: "HOP_LIMIT_EXCEEDED"; readonly reason: "hop limit exhausted" }
  | { readonly code: "SOURCE_NOT_AUTHORIZED"; readonly reason: "source not authorized on ingress" }
  | { readonly code: "SOURCE_NOT_ADVERTISED"; readonly reason: "source route not acknowledged by egress" }
  | { readonly code: "TRANSIT_DISABLED"; readonly reason: "transit disabled" }
  | { readonly code: "NEXT_HOP_UNAVAILABLE"; readonly reason: "selected next hop unavailable" }
  | { readonly code: "MESSAGE_TOO_LARGE"; readonly reason: "message exceeds egress receive limit" }
  | { readonly code: "QUEUE_FULL"; readonly reason: "required bounded capacity unavailable" }
);

export interface DataBody {
  readonly source: EndpointSource;
  readonly destination: EndpointName;
  readonly correlationId?: CorrelationId;
  readonly returnToken: ReturnToken;
  readonly hopLimit: number;
  readonly payload: JsonObject;
}

export type OpenMessage = AgpEnvelope<"control", "open", OpenBody>;
export type KeepaliveMessage = AgpEnvelope<"control", "keepalive", KeepaliveBody>;
export type RouteUpdateMessage =
  AgpEnvelope<"control", "route.update", RouteUpdateBody>;
export type RouteAckMessage =
  AgpEnvelope<"control", "route.ack", RouteAckBody>;
export type NotificationMessage =
  AgpEnvelope<"control", "notification", NotificationBody>;
export type ErrorMessage =
  AgpEnvelope<"control", "error", DeliveryErrorBody>;
export type DataMessage = AgpEnvelope<"data", "message", DataBody>;

export type AgpMessage =
  | OpenMessage
  | KeepaliveMessage
  | RouteUpdateMessage
  | RouteAckMessage
  | NotificationMessage
  | ErrorMessage
  | DataMessage;
