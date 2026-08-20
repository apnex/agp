import { AGP_V1_DELIVERY_ERROR_REASONS, AGP_V1_LIMITS } from "./constants.js";
import type {
  CorrelationId,
  DeliveryErrorBody,
  EndpointName,
  MessageId,
  NodeId,
  OpenBody,
  ReturnToken,
  RouteAdvertisement,
  RouteRejection,
  SessionId,
  WireRevision,
} from "./types.generated.js";

const NODE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SESSION_ID_PATTERN = /^[0-9a-f]{6}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RETURN_TOKEN_PATTERN = /^[0-9a-f]{16}$/;
const ENDPOINT_NAME_PATTERN =
  /^[a-z0-9][a-z0-9._-]{0,62}(?:\/[a-z0-9][a-z0-9._-]{0,62})*$/;

export function isNodeId(value: unknown): value is NodeId {
  return typeof value === "string" && NODE_ID_PATTERN.test(value);
}

export function isSessionId(value: unknown): value is SessionId {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

export function isMessageId(value: unknown): value is MessageId {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

export function isReturnToken(value: unknown): value is ReturnToken {
  return typeof value === "string" && RETURN_TOKEN_PATTERN.test(value);
}

export function isCorrelationId(value: unknown): value is CorrelationId {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

export function isEndpointName(value: unknown): value is EndpointName {
  return (
    typeof value === "string" &&
    value.length <= 253 &&
    ENDPOINT_NAME_PATTERN.test(value)
  );
}

export function isWireRevision(value: unknown): value is WireRevision {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= AGP_V1_LIMITS.maxWireRevision
  );
}

export interface OpenIdentityContext {
  readonly localNodeId: NodeId;
  readonly expectedNodeId?: NodeId;
  readonly identityAdmitted: boolean;
}

export type OpenIdentityResult =
  | { readonly ok: true; readonly code: "ACCEPT" }
  | {
      readonly ok: false;
      readonly code: "IDENTITY_REJECTED";
      readonly reason:
        | "SAME_NODE"
        | "EXPECTED_NODE_MISMATCH"
        | "ADMISSION_DENIED";
    };

/**
 * Implements semantic rule OPEN-IDENTITY-1 after OpenMessage schema
 * validation. Pair allocation and collision handling intentionally belong to
 * the session owner rather than this context-free rule.
 */
export function validateOpenIdentity(
  open: OpenBody,
  context: OpenIdentityContext,
): OpenIdentityResult {
  if (open.nodeId === context.localNodeId) {
    return {
      ok: false,
      code: "IDENTITY_REJECTED",
      reason: "SAME_NODE",
    };
  }
  if (
    context.expectedNodeId !== undefined &&
    open.nodeId !== context.expectedNodeId
  ) {
    return {
      ok: false,
      code: "IDENTITY_REJECTED",
      reason: "EXPECTED_NODE_MISMATCH",
    };
  }
  if (!context.identityAdmitted) {
    return {
      ok: false,
      code: "IDENTITY_REJECTED",
      reason: "ADMISSION_DENIED",
    };
  }
  return { ok: true, code: "ACCEPT" };
}

export type RoutePathOwnershipResult =
  | { readonly ok: true; readonly code: "ACCEPT" }
  | {
      readonly ok: false;
      readonly code: "INVALID_MESSAGE";
      readonly reason:
        | "ORIGIN_MISMATCH"
        | "ADVERTISING_PEER_MISMATCH"
        | "REPEATED_NODE";
    };

/**
 * Implements semantic rule ROUTE-PATH-OWNERSHIP-1. The precedence is stable:
 * forged origin, forged sender, then repeated path element. Receiver presence
 * is deliberately excluded because it is the recoverable LOOP rule owned by
 * the RIB.
 */
export function validateRoutePathOwnership(
  route: RouteAdvertisement,
  admittedRemoteNodeId: NodeId,
): RoutePathOwnershipResult {
  if (route.path[0] !== route.originNodeId) {
    return {
      ok: false,
      code: "INVALID_MESSAGE",
      reason: "ORIGIN_MISMATCH",
    };
  }
  if (route.path[route.path.length - 1] !== admittedRemoteNodeId) {
    return {
      ok: false,
      code: "INVALID_MESSAGE",
      reason: "ADVERTISING_PEER_MISMATCH",
    };
  }
  if (new Set(route.path).size !== route.path.length) {
    return {
      ok: false,
      code: "INVALID_MESSAGE",
      reason: "REPEATED_NODE",
    };
  }
  return { ok: true, code: "ACCEPT" };
}

export type ImportedPathLengthResult =
  | { readonly ok: true; readonly code: "ACCEPT" }
  | { readonly ok: false; readonly code: "PATH_TOO_LONG" };

/**
 * Implements semantic rule ROUTE-PATH-LIMIT-1. The receiver append is
 * included, so equality at the complete negotiated bound is accepted.
 */
export function validateImportedPathLength(
  route: RouteAdvertisement,
  negotiatedMaxPathLength: number,
): ImportedPathLengthResult {
  return route.path.length + 1 <= negotiatedMaxPathLength
    ? { ok: true, code: "ACCEPT" }
    : { ok: false, code: "PATH_TOO_LONG" };
}

export type CanonicalRouteSnapshotResult =
  | { readonly ok: true; readonly code: "ACCEPT" }
  | {
      readonly ok: false;
      readonly code: "INVALID_MESSAGE";
      readonly reason: "DUPLICATE_ENDPOINT" | "NONCANONICAL_ORDER";
    };

/**
 * Checks the snapshot-local ordering/uniqueness invariant that JSON Schema
 * cannot express without copying the RouteAdvertisement contract.
 */
export function validateCanonicalRouteSnapshot(
  routes: readonly RouteAdvertisement[],
): CanonicalRouteSnapshotResult {
  const endpoints = new Set<string>();
  for (let index = 0; index < routes.length; index += 1) {
    const current = routes[index];
    if (current === undefined) {
      continue;
    }
    if (endpoints.has(current.endpoint)) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        reason: "DUPLICATE_ENDPOINT",
      };
    }
    endpoints.add(current.endpoint);
    const previous = routes[index - 1];
    if (
      previous !== undefined &&
      compareRouteAdvertisements(previous, current) >= 0
    ) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        reason: "NONCANONICAL_ORDER",
      };
    }
  }
  return { ok: true, code: "ACCEPT" };
}

export type CanonicalRouteRejectionsResult =
  | { readonly ok: true; readonly code: "ACCEPT" }
  | {
      readonly ok: false;
      readonly code: "INVALID_MESSAGE";
      readonly reason: "DUPLICATE_ROUTE" | "NONCANONICAL_ORDER";
    };

export function validateCanonicalRouteRejections(
  rejected: readonly RouteRejection[],
): CanonicalRouteRejectionsResult {
  const keys = new Set<string>();
  for (let index = 0; index < rejected.length; index += 1) {
    const current = rejected[index];
    if (current === undefined) {
      continue;
    }
    const key = `${current.endpoint}\u0000${current.originNodeId}`;
    if (keys.has(key)) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        reason: "DUPLICATE_ROUTE",
      };
    }
    keys.add(key);
    const previous = rejected[index - 1];
    if (
      previous !== undefined &&
      compareRouteRejections(previous, current) >= 0
    ) {
      return {
        ok: false,
        code: "INVALID_MESSAGE",
        reason: "NONCANONICAL_ORDER",
      };
    }
  }
  return { ok: true, code: "ACCEPT" };
}

export function compareRouteAdvertisements(
  left: RouteAdvertisement,
  right: RouteAdvertisement,
): number {
  return (
    compareCanonicalStrings(left.endpoint, right.endpoint) ||
    compareCanonicalStrings(left.originNodeId, right.originNodeId) ||
    compareNodePaths(left.path, right.path)
  );
}

export function compareRouteRejections(
  left: RouteRejection,
  right: RouteRejection,
): number {
  return (
    compareCanonicalStrings(left.endpoint, right.endpoint) ||
    compareCanonicalStrings(left.originNodeId, right.originNodeId)
  );
}

export function isCanonicalDeliveryErrorReason(
  body: DeliveryErrorBody,
): boolean {
  return AGP_V1_DELIVERY_ERROR_REASONS[body.code] === body.reason;
}

export interface NegotiatedOpenLimits {
  readonly holdTimeMs: number;
  readonly receiveLimitBytes: number;
  readonly maxRoutesPerSnapshot: number;
  readonly maxPathLength: number;
  readonly maxDataHopLimit: number;
}

/**
 * Negotiates symmetric lower safe bounds. A zero hold offer disables the hold
 * timer for the pair; otherwise the lower positive offer wins.
 */
export function negotiateOpenLimits(
  local: OpenBody,
  remote: OpenBody,
): NegotiatedOpenLimits {
  return {
    holdTimeMs:
      local.holdTimeMs === 0 || remote.holdTimeMs === 0
        ? 0
        : Math.min(local.holdTimeMs, remote.holdTimeMs),
    receiveLimitBytes: Math.min(
      local.receiveLimitBytes,
      remote.receiveLimitBytes,
    ),
    maxRoutesPerSnapshot: Math.min(
      local.maxRoutesPerSnapshot,
      remote.maxRoutesPerSnapshot,
    ),
    maxPathLength: Math.min(local.maxPathLength, remote.maxPathLength),
    maxDataHopLimit: Math.min(
      local.maxDataHopLimit,
      remote.maxDataHopLimit,
    ),
  };
}

function compareNodePaths(
  left: readonly NodeId[],
  right: readonly NodeId[],
): number {
  const commonLength = Math.min(left.length, right.length);
  for (let index = 0; index < commonLength; index += 1) {
    const leftNode = left[index];
    const rightNode = right[index];
    if (leftNode !== undefined && rightNode !== undefined) {
      const comparison = compareCanonicalStrings(leftNode, rightNode);
      if (comparison !== 0) {
        return comparison;
      }
    }
  }
  return left.length - right.length;
}

/**
 * All schema-valid route-order strings are ASCII, so JavaScript lexical order
 * is exactly unsigned UTF-8 byte order. Keeping this helper explicit avoids
 * locale-sensitive comparators.
 */
function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
