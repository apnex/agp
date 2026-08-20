// Generated from the sovereign JSON Schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

import type {
  DeliveryErrorCode,
  FatalNotificationCode,
  RouteRejectionCode,
} from "./types.generated.js";

export const AGP_V1_FATAL_NOTIFICATION_CODES = Object.freeze(
  [
  "CEASE",
  "UNSUPPORTED_VERSION",
  "INVALID_MESSAGE",
  "UNEXPECTED_MESSAGE",
  "IDENTITY_REJECTED",
  "ADJACENCY_COLLISION",
  "HOLD_TIMEOUT",
  "ROUTE_REVISION_ERROR",
  "INTERNAL_ERROR"
] as const satisfies readonly FatalNotificationCode[],
);

export const AGP_V1_DELIVERY_ERROR_CODES = Object.freeze(
  [
  "NO_ROUTE",
  "HOP_LIMIT_EXCEEDED",
  "SOURCE_NOT_AUTHORIZED",
  "SOURCE_NOT_ADVERTISED",
  "TRANSIT_DISABLED",
  "NEXT_HOP_UNAVAILABLE",
  "MESSAGE_TOO_LARGE",
  "QUEUE_FULL"
] as const satisfies readonly DeliveryErrorCode[],
);

export const AGP_V1_ROUTE_REJECTION_CODES = Object.freeze(
  [
  "LOOP",
  "PATH_TOO_LONG",
  "POLICY",
  "CAPACITY"
] as const satisfies readonly RouteRejectionCode[],
);

export const AGP_V1_DELIVERY_ERROR_REASONS = Object.freeze(
  {
  "NO_ROUTE": "no selected route",
  "HOP_LIMIT_EXCEEDED": "hop limit exhausted",
  "SOURCE_NOT_AUTHORIZED": "source not authorized on ingress",
  "SOURCE_NOT_ADVERTISED": "source route not acknowledged by egress",
  "TRANSIT_DISABLED": "transit disabled",
  "NEXT_HOP_UNAVAILABLE": "selected next hop unavailable",
  "MESSAGE_TOO_LARGE": "message exceeds egress receive limit",
  "QUEUE_FULL": "required bounded capacity unavailable"
} as const satisfies Readonly<Record<DeliveryErrorCode, string>>,
);
