// Generated from sovereign core event schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

import type { DeliveryErrorCode, NodeId, SessionId } from "@agp/protocol";
import type { TransportTerminal } from "@agp/transport";

export const OPERATIONAL_EVENT_KINDS = Object.freeze([
  "lifecycle.starting",
  "lifecycle.running",
  "lifecycle.stopped",
  "endpoint.exposed",
  "endpoint.closed",
  "session.established",
  "session.transition",
  "session.routes-purged",
  "session.closed",
  "connection.preidentity-closed",
  "route.imported",
  "route.export-acked",
  "message.accepted",
  "message.forwarded",
  "message.received",
  "message.failed",
  "handler.completed",
  "handler.failed",
  "observer.gap",
] as const);

export type OperationalEventKind =
  typeof OPERATIONAL_EVENT_KINDS[number];

export type EmptyOperationalEventKind =
  | "lifecycle.starting"
  | "lifecycle.running"
  | "lifecycle.stopped"
  | "endpoint.exposed"
  | "endpoint.closed"
  | "session.established"
  | "session.transition"
  | "session.routes-purged"
  | "route.imported"
  | "route.export-acked"
  | "message.accepted"
  | "message.forwarded"
  | "message.received"
  | "handler.completed"
  | "handler.failed";

export type EmptyOperationalEventData =
  Readonly<Record<string, never>>;

export type LifecycleStartingData = EmptyOperationalEventData;

export type LifecycleRunningData = EmptyOperationalEventData;

export type LifecycleStoppedData = EmptyOperationalEventData;

export type EndpointExposedData = EmptyOperationalEventData;

export type EndpointClosedData = EmptyOperationalEventData;

export type SessionEstablishedData = EmptyOperationalEventData;

export type SessionTransitionData = EmptyOperationalEventData;

export type SessionRoutesPurgedData = EmptyOperationalEventData;

export interface SessionClosedData {
  readonly remoteNodeId: NodeId;
  readonly localSessionId: SessionId;
  readonly reason: string;
  readonly terminal?: TransportTerminal;
}

export interface ConnectionPreidentityClosedData {
  readonly localSessionId: SessionId;
  readonly direction: "inbound" | "outbound";
  readonly reason: string;
  readonly terminal?: TransportTerminal;
}

export type RouteImportedData = EmptyOperationalEventData;

export type RouteExportAckedData = EmptyOperationalEventData;

export type MessageAcceptedData = EmptyOperationalEventData;

export type MessageForwardedData = EmptyOperationalEventData;

export type MessageReceivedData = EmptyOperationalEventData;

export interface MessageFailedData {
  readonly code?: DeliveryErrorCode;
}

export type HandlerCompletedData = EmptyOperationalEventData;

export type HandlerFailedData = EmptyOperationalEventData;

export interface ObserverGapData {
  readonly droppedFrom: string;
  readonly droppedTo: string;
}

export interface OperationalEventDataByKind {
  readonly "lifecycle.starting": LifecycleStartingData;
  readonly "lifecycle.running": LifecycleRunningData;
  readonly "lifecycle.stopped": LifecycleStoppedData;
  readonly "endpoint.exposed": EndpointExposedData;
  readonly "endpoint.closed": EndpointClosedData;
  readonly "session.established": SessionEstablishedData;
  readonly "session.transition": SessionTransitionData;
  readonly "session.routes-purged": SessionRoutesPurgedData;
  readonly "session.closed": SessionClosedData;
  readonly "connection.preidentity-closed": ConnectionPreidentityClosedData;
  readonly "route.imported": RouteImportedData;
  readonly "route.export-acked": RouteExportAckedData;
  readonly "message.accepted": MessageAcceptedData;
  readonly "message.forwarded": MessageForwardedData;
  readonly "message.received": MessageReceivedData;
  readonly "message.failed": MessageFailedData;
  readonly "handler.completed": HandlerCompletedData;
  readonly "handler.failed": HandlerFailedData;
  readonly "observer.gap": ObserverGapData;
}

export type OperationalEventInput =
  | {
      readonly kind: EmptyOperationalEventKind;
      readonly subjectId: string;
      readonly data?: never;
    }
  | {
      readonly kind: "message.failed";
      readonly subjectId: string;
      readonly data?: MessageFailedData;
    }
  | {
      readonly kind: "observer.gap";
      readonly subjectId: string;
      readonly data: ObserverGapData;
    }
  | {
      readonly kind: "session.closed";
      readonly subjectId: string;
      readonly data: SessionClosedData;
    }
  | {
      readonly kind: "connection.preidentity-closed";
      readonly subjectId: string;
      readonly data: ConnectionPreidentityClosedData;
    };

interface OperationalEventBase {
  readonly schemaVersion: "agp.event/v1";
  readonly sequence: string;
  readonly revision: string;
  readonly nodeId: NodeId;
  readonly instanceId: string;
  readonly occurredAt: string;
  readonly subjectId: string;
}

type OperationalEventOf<K extends OperationalEventKind> =
  OperationalEventBase & {
    readonly kind: K;
    readonly data: Readonly<OperationalEventDataByKind[K]>;
  };

export type LifecycleStarting = OperationalEventOf<"lifecycle.starting">;
export type LifecycleRunning = OperationalEventOf<"lifecycle.running">;
export type LifecycleStopped = OperationalEventOf<"lifecycle.stopped">;
export type EndpointExposed = OperationalEventOf<"endpoint.exposed">;
export type EndpointClosed = OperationalEventOf<"endpoint.closed">;
export type SessionEstablished = OperationalEventOf<"session.established">;
export type SessionTransition = OperationalEventOf<"session.transition">;
export type SessionRoutesPurged = OperationalEventOf<"session.routes-purged">;
export type SessionClosed = OperationalEventOf<"session.closed">;
export type ConnectionPreidentityClosed = OperationalEventOf<"connection.preidentity-closed">;
export type RouteImported = OperationalEventOf<"route.imported">;
export type RouteExportAcked = OperationalEventOf<"route.export-acked">;
export type MessageAccepted = OperationalEventOf<"message.accepted">;
export type MessageForwarded = OperationalEventOf<"message.forwarded">;
export type MessageReceived = OperationalEventOf<"message.received">;
export type MessageFailed = OperationalEventOf<"message.failed">;
export type HandlerCompleted = OperationalEventOf<"handler.completed">;
export type HandlerFailed = OperationalEventOf<"handler.failed">;
export type ObserverGap = OperationalEventOf<"observer.gap">;

export type OperationalEvent =
  | LifecycleStarting
  | LifecycleRunning
  | LifecycleStopped
  | EndpointExposed
  | EndpointClosed
  | SessionEstablished
  | SessionTransition
  | SessionRoutesPurged
  | SessionClosed
  | ConnectionPreidentityClosed
  | RouteImported
  | RouteExportAcked
  | MessageAccepted
  | MessageForwarded
  | MessageReceived
  | MessageFailed
  | HandlerCompleted
  | HandlerFailed
  | ObserverGap;
