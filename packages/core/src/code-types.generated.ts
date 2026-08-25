// Generated from the sovereign code schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

export type AgpErrorCode =
  | "CONFIG_INVALID"
  | "OPTIONS_INVALID"
  | "LIFECYCLE_INVALID"
  | "NOT_RUNNING"
  | "ABORTED"
  | "ENDPOINT_INVALID"
  | "HANDLER_INVALID"
  | "ENDPOINT_ALREADY_EXPOSED"
  | "ENDPOINT_CAPACITY"
  | "CORRELATION_INVALID"
  | "SOURCE_NOT_OWNED"
  | "PAYLOAD_NOT_JSON"
  | "MESSAGE_TOO_LARGE"
  | "NO_ROUTE"
  | "SOURCE_NOT_ADVERTISED"
  | "NEXT_HOP_UNAVAILABLE"
  | "INSTANCE_UNREACHABLE"
  | "QUEUE_FULL"
  | "TRANSPORT_FAILURE"
  | "INTERNAL";

export type SessionEventCode =
  | "StartDial"
  | "StartAccept"
  | "Stop"
  | "TransportOpened"
  | "TransportAccepted"
  | "TransportFailed"
  | "TransportClosed"
  | "TransportInputRejected"
  | "OpenReceived"
  | "KeepaliveReceived"
  | "RouteUpdateReceived"
  | "RouteAckReceived"
  | "DataReceived"
  | "DispositionReceived"
  | "NotificationReceived"
  | "InvalidMessage"
  | "UnexpectedMessage"
  | "IdentityAdmissionResolved"
  | "RouteAdmissionResolved"
  | "AdmissionExpired"
  | "AdmissionFaulted"
  | "LocalRoutesChanged"
  | "RouteUpdateWritten"
  | "RetryExpired"
  | "OpenExpired"
  | "KeepaliveExpired"
  | "HoldExpired"
  | "RouteWriteExpired"
  | "RouteAckExpired"
  | "RouteRevisionRollover"
  | "ControlQueueOverflow";

export type ConnectionState =
  | "Idle"
  | "Connect"
  | "Active"
  | "OpenSent"
  | "OpenConfirm"
  | "Established";

export type HostState =
  | "Created"
  | "Starting"
  | "Running"
  | "Stopping"
  | "Stopped"
  | "Failed";

export type DiagnosticDomain =
  | "lifecycle"
  | "protocol"
  | "transport"
  | "session"
  | "routing"
  | "admission"
  | "handler"
  | "operations"
  | "sdk";

export type IdentityDenialCode =
  | "POLICY"
  | "EXPECTED_NODE_MISMATCH"
  | "SECURITY_EVIDENCE"
  | "CAPACITY";

export type CounterKey =
  | "capacity.session_rejected"
  | "handler.completed"
  | "handler.failed"
  | "lifecycle.failed"
  | "lifecycle.started"
  | "lifecycle.stopped"
  | "message.accepted"
  | "message.forwarded"
  | "message.received"
  | "message.rejected_before_admission"
  | "transport.error"
  | "transport.listener_terminal";

export type SelectedReason =
  | "ONLY_ELIGIBLE"
  | "PREFER_LOCAL"
  | "SHORTEST_PATH"
  | "LOWEST_ORIGIN_NODE_ID"
  | "LOWEST_NODE_PATH"
  | "LOWEST_BINDING_ID";

export type IneligibleReason =
  | "LOCAL_BINDING_INACTIVE"
  | "LOCAL_ENDPOINT_INDEX_MISMATCH"
  | "ADVERTISEMENT_INACTIVE"
  | "ADVERTISEMENT_MISMATCH"
  | "SESSION_CONTROLLER_STALE"
  | "SESSION_NOT_ESTABLISHED"
  | "SESSION_IDENTITY_MISMATCH"
  | "PATH_INVALID"
  | "NEXT_HOP_UNRESOLVED";
