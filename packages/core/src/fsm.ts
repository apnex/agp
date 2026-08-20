import type {
  FatalNotificationCode,
  MessageId,
  NodeId,
  RouteAdvertisement,
  RouteRejection,
  SessionId,
  WireRevision,
} from "@agp/protocol";
import { AgpError } from "./errors.js";
import { compareUtf8, immutableClone } from "./immutable.js";
import type {
  AdjacencyId,
  ConnectionState,
  ControllerId,
  Direction,
  ExactSessionOwner,
  IdSourcePort,
  ReconnectPolicyConfig,
  SessionEventCode,
  SessionReasonCode,
  Timestamp,
} from "./types.js";

/**
 * The acquisition evidence changes reconnect ownership, never protocol
 * legality. It is exported here (and re-exported by types below) because the
 * reducer and the supervisor are its sole semantic owners.
 */
export type Acquisition =
  | { readonly kind: "dial"; readonly adjacencyId: AdjacencyId }
  | { readonly kind: "accept"; readonly listenerId: string };

export interface NegotiatedSession {
  readonly holdTimeMs: number;
  readonly keepaliveTimeMs: number;
  readonly peerReceiveLimitBytes: number;
  readonly maxRoutesPerSnapshot: number;
  readonly maxPathLength: number;
  readonly maxHopCount: number;
  readonly transit: boolean;
}

export interface PendingAdmission {
  readonly kind: "identity" | "route";
  readonly token: string;
}

export interface PeerSessionState {
  readonly controllerId: ControllerId;
  readonly localNodeId: NodeId;
  readonly acquisition: Acquisition;
  readonly direction: Direction;
  readonly state: ConnectionState;
  readonly localSessionId?: SessionId | undefined;
  readonly remoteNodeId?: NodeId | undefined;
  readonly remoteSessionId?: SessionId | undefined;
  readonly negotiated?: NegotiatedSession | undefined;
  readonly pendingAdmission?: PendingAdmission | undefined;
  readonly inboundRevision: WireRevision;
  readonly retryAttempt: number;
  readonly stopped: boolean;
  readonly forwardable: boolean;
  readonly lastEvent?: SessionEventCode | undefined;
  readonly lastReason?: SessionReasonCode | undefined;
}

export interface PeerSessionCommand {
  readonly type: SessionEventCode;
  readonly localSessionId?: SessionId;
  readonly remoteNodeId?: NodeId;
  readonly remoteSessionId?: SessionId;
  readonly negotiated?: NegotiatedSession;
  readonly continuationToken?: string;
  readonly admissionAllowed?: boolean;
  readonly admissionResultValid?: boolean;
  readonly collisionWinner?: boolean;
  readonly revision?: WireRevision;
  readonly updateId?: MessageId;
  readonly routes?: readonly RouteAdvertisement[];
  readonly rejected?: readonly RouteRejection[];
  readonly refId?: MessageId;
  readonly outstandingRefId?: MessageId;
  readonly outstandingRevision?: WireRevision;
  readonly notificationCode?: FatalNotificationCode;
}

export type PeerSessionAction =
  | { readonly type: "AllocateSession" }
  | { readonly type: "Dial"; readonly adjacencyId: AdjacencyId }
  | { readonly type: "AdoptTransport" }
  | { readonly type: "SendOpen" }
  | { readonly type: "BeginIdentityAdmission"; readonly token: string }
  | { readonly type: "CommitIdentity"; readonly owner: ExactSessionOwner }
  | { readonly type: "SendKeepalive" }
  | { readonly type: "ArmOpenTimer" }
  | { readonly type: "ArmProtocolTimers" }
  | { readonly type: "ResetHoldTimer" }
  | { readonly type: "ResetKeepaliveTimer" }
  | {
      readonly type: "BeginRouteAdmission";
      readonly token: string;
      readonly updateId: MessageId;
      readonly revision: WireRevision;
      readonly routes: readonly RouteAdvertisement[];
    }
  | {
      readonly type: "ApplyRouteSnapshot";
      readonly updateId: MessageId;
      readonly revision: WireRevision;
      readonly rejected: readonly RouteRejection[];
    }
  | {
      readonly type: "AcceptRouteAck";
      readonly refId: MessageId;
      readonly revision: WireRevision;
      readonly rejected: readonly RouteRejection[];
    }
  | { readonly type: "ScheduleInitialRouteSnapshot" }
  | { readonly type: "RecomputeRouteExport" }
  | { readonly type: "MarkRouteUpdateWritten" }
  | { readonly type: "DispatchData" }
  | { readonly type: "DispatchDeliveryError" }
  | {
      readonly type: "SendNotification";
      readonly code: FatalNotificationCode;
    }
  | { readonly type: "MarkNonForwardable" }
  | { readonly type: "InvalidateContinuations" }
  | { readonly type: "PurgeSessionRoutes" }
  | { readonly type: "InvalidateRouteExport" }
  | { readonly type: "StopTimers" }
  | { readonly type: "ReleaseTransport" }
  | { readonly type: "ScheduleRetry" }
  | { readonly type: "SuppressRetryForCollision" }
  | { readonly type: "DisableRetry" }
  | { readonly type: "PublishTransition" }
  | { readonly type: "Ignore"; readonly reason: string };

export interface PeerSessionReduction {
  readonly previous: PeerSessionState;
  readonly state: PeerSessionState;
  readonly input: PeerSessionCommand;
  readonly actions: readonly PeerSessionAction[];
  readonly ignored: boolean;
}

const ESTABLISHED_WIRE_TYPES = new Set<SessionEventCode>([
  "KeepaliveReceived",
  "RouteUpdateReceived",
  "RouteAckReceived",
  "DataReceived",
  "ErrorReceived",
  "NotificationReceived",
]);

const ALL_WIRE_INPUTS = new Set<SessionEventCode>([
  "OpenReceived",
  ...ESTABLISHED_WIRE_TYPES,
  "InvalidMessage",
  "UnexpectedMessage",
  "TransportInputRejected",
]);

const RETRYABLE_NOTIFICATIONS = new Set<FatalNotificationCode>([
  "HOLD_TIMEOUT",
  "ROUTE_REVISION_ERROR",
  "INTERNAL_ERROR",
]);

const TERMINAL_NOTIFICATIONS = new Set<FatalNotificationCode>([
  "CEASE",
  "UNSUPPORTED_VERSION",
  "INVALID_MESSAGE",
  "UNEXPECTED_MESSAGE",
  "IDENTITY_REJECTED",
]);

export function createPeerSessionState(input: {
  readonly controllerId: ControllerId;
  readonly localNodeId: NodeId;
  readonly acquisition: Acquisition;
}): PeerSessionState {
  return immutableClone({
    controllerId: input.controllerId,
    localNodeId: input.localNodeId,
    acquisition: input.acquisition,
    direction: input.acquisition.kind === "dial" ? "outbound" : "inbound",
    state: "Idle",
    inboundRevision: 0 as WireRevision,
    retryAttempt: 0,
    stopped: false,
    forwardable: false,
  });
}

/**
 * Pure BGP-shaped session reducer. All returned effects are declarative and
 * transport-free. The node executor applies them in order.
 */
export function reducePeerSession(
  current: PeerSessionState,
  input: PeerSessionCommand,
): PeerSessionReduction {
  const previous = immutableClone(current);
  if (current.stopped && input.type !== "Stop") {
    return ignoredReduction(previous, input, "controller-stopped");
  }

  let next = current;
  let actions: readonly PeerSessionAction[] | undefined;

  if (input.type === "Stop") {
    const terminal = terminalReduction(current, "Stop", "CEASE", "disable");
    next = terminal.state;
    actions = terminal.actions;
  } else {
    switch (current.state) {
      case "Idle": {
        if (input.type === "StartDial" && current.acquisition.kind === "dial") {
          next = transition(current, "Connect", input.type, {
            localSessionId: input.localSessionId,
            stopped: false,
          });
          actions = publish([
            { type: "AllocateSession" },
            { type: "Dial", adjacencyId: current.acquisition.adjacencyId },
          ]);
        } else if (
          input.type === "StartAccept"
          && current.acquisition.kind === "accept"
        ) {
          next = transition(current, "Active", input.type, {
            localSessionId: input.localSessionId,
            stopped: false,
          });
          actions = publish([{ type: "AllocateSession" }]);
        }
        break;
      }
      case "Connect": {
        if (input.type === "TransportOpened") {
          next = transition(current, "OpenSent", input.type);
          actions = publish([
            { type: "AdoptTransport" },
            { type: "SendOpen" },
            { type: "ArmOpenTimer" },
          ]);
        } else if (
          input.type === "TransportFailed"
          || input.type === "TransportClosed"
        ) {
          const terminal = terminalReduction(
            current,
            input.type,
            input.type,
            "retry",
          );
          next = terminal.state;
          actions = terminal.actions;
        }
        break;
      }
      case "Active": {
        if (
          input.type === "RetryExpired"
          && current.acquisition.kind === "dial"
        ) {
          next = transition(current, "Connect", input.type, {
            localSessionId: input.localSessionId,
          });
          actions = publish([
            { type: "AllocateSession" },
            { type: "Dial", adjacencyId: current.acquisition.adjacencyId },
          ]);
        } else if (
          input.type === "TransportAccepted"
          && current.acquisition.kind === "accept"
        ) {
          next = transition(current, "OpenSent", input.type);
          actions = publish([
            { type: "AdoptTransport" },
            { type: "SendOpen" },
            { type: "ArmOpenTimer" },
          ]);
        } else if (
          input.type === "TransportOpened"
          && current.acquisition.kind === "dial"
        ) {
          next = transition(current, "OpenSent", input.type);
          actions = publish([
            { type: "AdoptTransport" },
            { type: "SendOpen" },
            { type: "ArmOpenTimer" },
          ]);
        } else if (
          input.type === "TransportFailed"
          || input.type === "TransportClosed"
        ) {
          const disposition = current.acquisition.kind === "dial"
            ? "retry"
            : "none";
          const terminal = terminalReduction(
            current,
            input.type,
            input.type,
            disposition,
          );
          next = terminal.state;
          actions = terminal.actions;
        }
        break;
      }
      case "OpenSent": {
        ({ next, actions } = reduceOpenSent(current, input));
        break;
      }
      case "OpenConfirm": {
        ({ next, actions } = reduceOpenConfirm(current, input));
        break;
      }
      case "Established": {
        ({ next, actions } = reduceEstablished(current, input));
        break;
      }
    }
  }

  if (actions === undefined) {
    if (ALL_WIRE_INPUTS.has(input.type)) {
      const terminal = terminalReduction(
        current,
        input.type,
        "UNEXPECTED_MESSAGE",
        dispositionForCause(current, "UNEXPECTED_MESSAGE"),
        "UNEXPECTED_MESSAGE",
      );
      next = terminal.state;
      actions = terminal.actions;
    } else {
      return ignoredReduction(previous, input, "event-not-applicable");
    }
  }

  return immutableClone({
    previous,
    state: next,
    input,
    actions,
    ignored: actions.length === 1 && actions[0]?.type === "Ignore",
  });
}

function reduceOpenSent(
  current: PeerSessionState,
  input: PeerSessionCommand,
): { next: PeerSessionState; actions?: readonly PeerSessionAction[] } {
  if (input.type === "OpenReceived") {
    if (current.pendingAdmission !== undefined) {
      return fatal(current, input, "UNEXPECTED_MESSAGE");
    }
    const token = input.continuationToken;
    if (token === undefined) return fatal(current, input, "INTERNAL_ERROR");
    return {
      next: transition(current, "OpenSent", input.type, {
        pendingAdmission: { kind: "identity", token },
      }),
      actions: publish([{ type: "BeginIdentityAdmission", token }]),
    };
  }
  if (input.type === "IdentityAdmissionResolved") {
    if (
      current.pendingAdmission?.kind !== "identity"
      || input.continuationToken !== current.pendingAdmission.token
    ) {
      return {
        next: current,
        actions: [{ type: "Ignore", reason: "stale-identity-admission" }],
      };
    }
    if (
      input.admissionResultValid === false
      || input.admissionAllowed === undefined
    ) {
      return fatal(current, input, "INTERNAL_ERROR");
    }
    if (!input.admissionAllowed) {
      return fatal(current, input, "IDENTITY_REJECTED");
    }
    if (input.collisionWinner === false) {
      return fatal(current, input, "ADJACENCY_COLLISION");
    }
    if (
      input.remoteNodeId === undefined
      || input.remoteSessionId === undefined
      || input.negotiated === undefined
      || current.localSessionId === undefined
    ) {
      return fatal(current, input, "INTERNAL_ERROR");
    }
    const owner: ExactSessionOwner = {
      controllerId: current.controllerId,
      remoteNodeId: input.remoteNodeId,
      localSessionId: current.localSessionId,
      remoteSessionId: input.remoteSessionId,
    };
    return {
      next: transition(current, "OpenConfirm", input.type, {
        remoteNodeId: input.remoteNodeId,
        remoteSessionId: input.remoteSessionId,
        negotiated: input.negotiated,
        pendingAdmission: undefined,
      }),
      actions: publish([
        { type: "CommitIdentity", owner },
        { type: "SendKeepalive" },
        { type: "ArmProtocolTimers" },
      ]),
    };
  }
  if (
    input.type === "AdmissionExpired"
    || input.type === "TransportFailed"
    || input.type === "TransportClosed"
    || input.type === "OpenExpired"
  ) {
    const terminal = terminalReduction(
      current,
      input.type,
      input.type,
      dispositionForCause(current, input.type),
    );
    return { next: terminal.state, actions: terminal.actions };
  }
  if (input.type === "AdmissionFaulted") {
    return fatal(current, input, "INTERNAL_ERROR");
  }
  if (input.type === "NotificationReceived") {
    return remoteNotification(current, input);
  }
  if (input.type === "InvalidMessage" || input.type === "TransportInputRejected") {
    return fatal(current, input, "INVALID_MESSAGE");
  }
  return { next: current };
}

function reduceOpenConfirm(
  current: PeerSessionState,
  input: PeerSessionCommand,
): { next: PeerSessionState; actions?: readonly PeerSessionAction[] } {
  if (input.type === "KeepaliveReceived") {
    return {
      next: transition(current, "Established", input.type, {
        retryAttempt: 0,
        forwardable: true,
      }),
      actions: publish([
        { type: "ResetHoldTimer" },
        { type: "ScheduleInitialRouteSnapshot" },
      ]),
    };
  }
  if (input.type === "KeepaliveExpired") {
    return {
      next: transition(current, "OpenConfirm", input.type),
      actions: publish([
        { type: "SendKeepalive" },
        { type: "ResetKeepaliveTimer" },
      ]),
    };
  }
  if (input.type === "HoldExpired" || input.type === "OpenExpired") {
    return fatal(current, input, "HOLD_TIMEOUT");
  }
  if (input.type === "TransportFailed" || input.type === "TransportClosed") {
    const terminal = terminalReduction(
      current,
      input.type,
      input.type,
      dispositionForCause(current, input.type),
    );
    return { next: terminal.state, actions: terminal.actions };
  }
  if (input.type === "NotificationReceived") {
    return remoteNotification(current, input);
  }
  if (input.type === "InvalidMessage" || input.type === "TransportInputRejected") {
    return fatal(current, input, "INVALID_MESSAGE");
  }
  return { next: current };
}

function reduceEstablished(
  current: PeerSessionState,
  input: PeerSessionCommand,
): { next: PeerSessionState; actions?: readonly PeerSessionAction[] } {
  if (input.type === "KeepaliveReceived") {
    return {
      next: transition(current, "Established", input.type),
      actions: publish([{ type: "ResetHoldTimer" }]),
    };
  }
  if (input.type === "KeepaliveExpired") {
    return {
      next: transition(current, "Established", input.type),
      actions: publish([
        { type: "SendKeepalive" },
        { type: "ResetKeepaliveTimer" },
      ]),
    };
  }
  if (input.type === "RouteUpdateReceived") {
    if (current.pendingAdmission !== undefined) {
      return fatal(current, input, "UNEXPECTED_MESSAGE");
    }
    const revisionResult = validateInboundRouteRevision(
      current.inboundRevision,
      input.revision,
    );
    if (!revisionResult.ok) return fatal(current, input, revisionResult.code);
    if (
      input.continuationToken === undefined
      || input.updateId === undefined
      || input.routes === undefined
    ) {
      return fatal(current, input, "INVALID_MESSAGE");
    }
    const token = input.continuationToken;
    return {
      next: transition(current, "Established", input.type, {
        pendingAdmission: { kind: "route", token },
      }),
      actions: publish([
        { type: "ResetHoldTimer" },
        {
          type: "BeginRouteAdmission",
          token,
          updateId: input.updateId,
          revision: revisionResult.revision,
          routes: immutableClone(input.routes),
        },
      ]),
    };
  }
  if (input.type === "RouteAdmissionResolved") {
    if (
      current.pendingAdmission?.kind !== "route"
      || input.continuationToken !== current.pendingAdmission.token
    ) {
      return {
        next: current,
        actions: [{ type: "Ignore", reason: "stale-route-admission" }],
      };
    }
    if (
      input.admissionResultValid === false
      || input.updateId === undefined
      || input.revision === undefined
      || input.rejected === undefined
    ) {
      return fatal(current, input, "INTERNAL_ERROR");
    }
    return {
      next: transition(current, "Established", input.type, {
        pendingAdmission: undefined,
        inboundRevision: input.revision,
      }),
      actions: publish([{
        type: "ApplyRouteSnapshot",
        updateId: input.updateId,
        revision: input.revision,
        rejected: immutableClone(input.rejected),
      }]),
    };
  }
  if (input.type === "RouteAckReceived") {
    const ack = validateRouteAck({
      outstandingRefId: input.outstandingRefId,
      outstandingRevision: input.outstandingRevision,
      refId: input.refId,
      revision: input.revision,
      rejected: input.rejected,
    });
    if (!ack.ok) return fatal(current, input, "INVALID_MESSAGE");
    return {
      next: transition(current, "Established", input.type),
      actions: publish([
        { type: "ResetHoldTimer" },
        {
          type: "AcceptRouteAck",
          refId: ack.refId,
          revision: ack.revision,
          rejected: ack.rejected,
        },
      ]),
    };
  }
  if (input.type === "DataReceived") {
    return {
      next: transition(current, "Established", input.type),
      actions: publish([
        { type: "ResetHoldTimer" },
        { type: "DispatchData" },
      ]),
    };
  }
  if (input.type === "ErrorReceived") {
    return {
      next: transition(current, "Established", input.type),
      actions: publish([
        { type: "ResetHoldTimer" },
        { type: "DispatchDeliveryError" },
      ]),
    };
  }
  if (input.type === "LocalRoutesChanged") {
    return {
      next: transition(current, "Established", input.type),
      actions: publish([{ type: "RecomputeRouteExport" }]),
    };
  }
  if (input.type === "RouteUpdateWritten") {
    return {
      next: transition(current, "Established", input.type),
      actions: publish([{ type: "MarkRouteUpdateWritten" }]),
    };
  }
  if (input.type === "AdmissionExpired" || input.type === "AdmissionFaulted") {
    return fatal(current, input, "INTERNAL_ERROR");
  }
  if (input.type === "HoldExpired") return fatal(current, input, "HOLD_TIMEOUT");
  if (
    input.type === "RouteWriteExpired"
    || input.type === "RouteAckExpired"
    || input.type === "RouteRevisionRollover"
  ) {
    const terminal = terminalReduction(
      current,
      input.type,
      input.type,
      current.acquisition.kind === "dial" ? "retry" : "none",
      "CEASE",
    );
    return { next: terminal.state, actions: terminal.actions };
  }
  if (input.type === "ControlQueueOverflow") {
    const terminal = terminalReduction(
      current,
      input.type,
      input.type,
      dispositionForCause(current, input.type),
    );
    return { next: terminal.state, actions: terminal.actions };
  }
  if (input.type === "TransportFailed" || input.type === "TransportClosed") {
    const terminal = terminalReduction(
      current,
      input.type,
      input.type,
      dispositionForCause(current, input.type),
    );
    return { next: terminal.state, actions: terminal.actions };
  }
  if (input.type === "NotificationReceived") {
    return remoteNotification(current, input);
  }
  if (input.type === "InvalidMessage" || input.type === "TransportInputRejected") {
    return fatal(current, input, "INVALID_MESSAGE");
  }
  return { next: current };
}

export type InboundRevisionResult =
  | { readonly ok: true; readonly revision: WireRevision }
  | { readonly ok: false; readonly code: "ROUTE_REVISION_ERROR" };

export function validateInboundRouteRevision(
  consumed: WireRevision,
  proposed: WireRevision | undefined,
): InboundRevisionResult {
  if (
    proposed === undefined
    || !Number.isSafeInteger(proposed)
    || proposed < 1
    || consumed >= Number.MAX_SAFE_INTEGER
    || proposed !== consumed + 1
  ) {
    return { ok: false, code: "ROUTE_REVISION_ERROR" };
  }
  return { ok: true, revision: proposed };
}

export type RouteAckValidation =
  | {
      readonly ok: true;
      readonly refId: MessageId;
      readonly revision: WireRevision;
      readonly rejected: readonly RouteRejection[];
    }
  | { readonly ok: false; readonly reason: string };

export function validateRouteAck(input: {
  readonly outstandingRefId?: MessageId | undefined;
  readonly outstandingRevision?: WireRevision | undefined;
  readonly refId?: MessageId | undefined;
  readonly revision?: WireRevision | undefined;
  readonly rejected?: readonly RouteRejection[] | undefined;
}): RouteAckValidation {
  if (
    input.outstandingRefId === undefined
    || input.outstandingRevision === undefined
    || input.refId !== input.outstandingRefId
    || input.revision !== input.outstandingRevision
    || input.rejected === undefined
  ) {
    return { ok: false, reason: "ACK does not match the exact outstanding snapshot" };
  }
  const seen = new Set<string>();
  for (const rejection of input.rejected) {
    const key = `${rejection.endpoint}\u0000${rejection.originNodeId}`;
    if (seen.has(key)) {
      return { ok: false, reason: "ACK contains a duplicate rejection" };
    }
    seen.add(key);
  }
  return {
    ok: true,
    refId: input.refId,
    revision: input.revision,
    rejected: immutableClone(input.rejected),
  };
}

export interface ConnectionCandidate extends ExactSessionOwner {
  readonly localNodeId: NodeId;
  readonly direction: Direction;
}

/**
 * Negative means `left` is the canonical retained physical connection.
 */
export function compareConnectionCandidates(
  left: ConnectionCandidate,
  right: ConnectionCandidate,
): number {
  requireSameNodePair(left, right);
  const a = orientCandidate(left);
  const b = orientCandidate(right);
  const initiator = compareUtf8(a.initiatorNodeId, b.initiatorNodeId);
  if (initiator !== 0) return -initiator; // lexically higher initiator wins
  const lower = compareUtf8(a.lowerSessionId, b.lowerSessionId);
  if (lower !== 0) return lower;
  return compareUtf8(a.higherSessionId, b.higherSessionId);
}

export function sessionPublicKey(
  remoteNodeId: NodeId,
  localSessionId: SessionId,
): string {
  return `${new TextEncoder().encode(remoteNodeId).length}:${remoteNodeId}:${localSessionId}`;
}

export class SessionDirectory<T extends ConnectionCandidate> {
  readonly #byPair = new Map<string, T>();
  readonly #byController = new Map<ControllerId, T>();

  retain(candidate: T): {
    readonly winner: T;
    readonly loser?: T;
    readonly inserted: boolean;
  } {
    const key = sessionPublicKey(candidate.remoteNodeId, candidate.localSessionId);
    const exactPair = this.#byPair.get(key);
    if (
      exactPair !== undefined
      && exactPair.controllerId !== candidate.controllerId
    ) {
      throw new AgpError(
        "INTERNAL",
        "SessionDirectory.retain",
        "duplicate live pair-scoped session identity",
      );
    }
    const incumbent = [...this.#byController.values()].find(
      (item) => item.remoteNodeId === candidate.remoteNodeId,
    );
    if (incumbent === undefined) {
      this.#insert(key, candidate);
      return immutableClone({ winner: candidate, inserted: true });
    }
    if (incumbent.controllerId === candidate.controllerId) {
      return immutableClone({ winner: incumbent, inserted: false });
    }
    if (compareConnectionCandidates(candidate, incumbent) < 0) {
      this.remove(incumbent.controllerId);
      this.#insert(key, candidate);
      return immutableClone({
        winner: candidate,
        loser: incumbent,
        inserted: true,
      });
    }
    return immutableClone({
      winner: incumbent,
      loser: candidate,
      inserted: false,
    });
  }

  get(remoteNodeId: NodeId, localSessionId: SessionId): T | undefined {
    const value = this.#byPair.get(sessionPublicKey(remoteNodeId, localSessionId));
    return value === undefined ? undefined : immutableClone(value);
  }

  exact(controllerId: ControllerId): T | undefined {
    const value = this.#byController.get(controllerId);
    return value === undefined ? undefined : immutableClone(value);
  }

  satisfying(remoteNodeId: NodeId): T | undefined {
    const value = [...this.#byController.values()].find(
      (item) => item.remoteNodeId === remoteNodeId,
    );
    return value === undefined ? undefined : immutableClone(value);
  }

  remove(controllerId: ControllerId): T | undefined {
    const value = this.#byController.get(controllerId);
    if (value === undefined) return undefined;
    this.#byController.delete(controllerId);
    this.#byPair.delete(
      sessionPublicKey(value.remoteNodeId, value.localSessionId),
    );
    return immutableClone(value);
  }

  values(): readonly T[] {
    return immutableClone(
      [...this.#byController.values()].sort((a, b) => {
        const node = compareUtf8(a.remoteNodeId, b.remoteNodeId);
        return node || compareUtf8(a.localSessionId, b.localSessionId);
      }),
    );
  }

  #insert(key: string, candidate: T): void {
    this.#byPair.set(key, candidate);
    this.#byController.set(candidate.controllerId, candidate);
  }
}

export type ReconnectDisposition = "retry" | "suppress" | "terminal";

export function reconnectDisposition(
  cause: SessionReasonCode,
): ReconnectDisposition {
  if (cause === "ADJACENCY_COLLISION") return "suppress";
  if (
    cause === "CEASE"
    || cause === "UNSUPPORTED_VERSION"
    || cause === "INVALID_MESSAGE"
    || cause === "UNEXPECTED_MESSAGE"
    || cause === "IDENTITY_REJECTED"
    || cause === "Stop"
  ) {
    return "terminal";
  }
  return "retry";
}

export interface AdjacencySupervisorState {
  readonly adjacencyId: AdjacencyId;
  readonly expectedNodeId?: NodeId | undefined;
  readonly enabled: boolean;
  readonly state: "idle" | "dialing" | "satisfied" | "retry-wait" | "terminal";
  readonly retryAttempt: number;
  readonly retryDelayMs?: number | undefined;
  readonly activeControllerId?: ControllerId | undefined;
  readonly lastReason?: SessionReasonCode | undefined;
}

export class AdjacencySupervisor {
  readonly #policy: Required<ReconnectPolicyConfig>;
  #state: AdjacencySupervisorState;

  constructor(input: {
    readonly adjacencyId: AdjacencyId;
    readonly expectedNodeId?: NodeId;
    readonly policy: ReconnectPolicyConfig;
  }) {
    const enabled = input.policy.enabled ?? true;
    const multiplier = input.policy.multiplier ?? 2;
    const jitterRatio = input.policy.jitterRatio ?? 0;
    if (
      !Number.isSafeInteger(input.policy.initialDelayMs)
      || input.policy.initialDelayMs <= 0
      || !Number.isSafeInteger(input.policy.maximumDelayMs)
      || input.policy.maximumDelayMs < input.policy.initialDelayMs
      || !Number.isFinite(multiplier)
      || multiplier < 1
      || !Number.isFinite(jitterRatio)
      || jitterRatio < 0
      || jitterRatio > 1
    ) {
      throw new AgpError(
        "CONFIG_INVALID",
        "AdjacencySupervisor.constructor",
        "invalid bounded reconnect policy",
      );
    }
    this.#policy = {
      enabled,
      initialDelayMs: input.policy.initialDelayMs,
      maximumDelayMs: input.policy.maximumDelayMs,
      multiplier,
      jitterRatio,
    };
    this.#state = {
      adjacencyId: input.adjacencyId,
      ...(input.expectedNodeId === undefined
        ? {}
        : { expectedNodeId: input.expectedNodeId }),
      enabled,
      state: enabled ? "idle" : "terminal",
      retryAttempt: 0,
    };
  }

  beginDial(): AdjacencySupervisorState {
    if (!this.#state.enabled || this.#state.state === "terminal") {
      return this.snapshot();
    }
    if (this.#state.state === "satisfied") return this.snapshot();
    this.#state = { ...this.#state, state: "dialing", retryDelayMs: undefined };
    return this.snapshot();
  }

  satisfied(controllerId: ControllerId): AdjacencySupervisorState {
    this.#state = {
      ...this.#state,
      state: "satisfied",
      activeControllerId: controllerId,
      retryAttempt: 0,
      retryDelayMs: undefined,
      lastReason: undefined,
    };
    return this.snapshot();
  }

  lost(
    controllerId: ControllerId,
    cause: SessionReasonCode,
  ): AdjacencySupervisorState {
    if (
      this.#state.activeControllerId !== undefined
      && this.#state.activeControllerId !== controllerId
    ) {
      return this.snapshot();
    }
    const disposition = reconnectDisposition(cause);
    if (!this.#state.enabled || disposition === "terminal") {
      this.#state = {
        ...this.#state,
        state: "terminal",
        activeControllerId: undefined,
        retryDelayMs: undefined,
        lastReason: cause,
      };
      return this.snapshot();
    }
    if (disposition === "suppress") {
      this.#state = {
        ...this.#state,
        state: "idle",
        activeControllerId: undefined,
        retryDelayMs: undefined,
        lastReason: cause,
      };
      return this.snapshot();
    }
    const delay = retryDelay(
      this.#policy,
      this.#state.retryAttempt,
    );
    this.#state = {
      ...this.#state,
      state: "retry-wait",
      activeControllerId: undefined,
      retryAttempt: this.#state.retryAttempt + 1,
      retryDelayMs: delay,
      lastReason: cause,
    };
    return this.snapshot();
  }

  winningSessionExists(controllerId: ControllerId): AdjacencySupervisorState {
    return this.satisfied(controllerId);
  }

  winnerLost(controllerId: ControllerId): AdjacencySupervisorState {
    if (this.#state.activeControllerId !== controllerId) return this.snapshot();
    return this.lost(controllerId, "TransportClosed");
  }

  stop(): AdjacencySupervisorState {
    this.#state = {
      ...this.#state,
      enabled: false,
      state: "terminal",
      activeControllerId: undefined,
      retryDelayMs: undefined,
      lastReason: "Stop",
    };
    return this.snapshot();
  }

  snapshot(): AdjacencySupervisorState {
    return immutableClone(this.#state);
  }
}

export function retryDelay(
  policy: ReconnectPolicyConfig,
  attempt: number,
): number {
  if (!Number.isSafeInteger(attempt) || attempt < 0) {
    throw new AgpError(
      "CONFIG_INVALID",
      "retryDelay",
      "attempt must be a non-negative safe integer",
    );
  }
  const multiplier = policy.multiplier ?? 2;
  const raw = policy.initialDelayMs * multiplier ** attempt;
  return Math.min(
    policy.maximumDelayMs,
    Number.isFinite(raw) ? Math.floor(raw) : policy.maximumDelayMs,
  );
}

function fatal(
  current: PeerSessionState,
  input: PeerSessionCommand,
  code: FatalNotificationCode,
): { next: PeerSessionState; actions: readonly PeerSessionAction[] } {
  const terminal = terminalReduction(
    current,
    input.type,
    code,
    dispositionForCause(current, code),
    code,
  );
  return { next: terminal.state, actions: terminal.actions };
}

function remoteNotification(
  current: PeerSessionState,
  input: PeerSessionCommand,
): { next: PeerSessionState; actions: readonly PeerSessionAction[] } {
  const code = input.notificationCode ?? "INVALID_MESSAGE";
  const terminal = terminalReduction(
    current,
    input.type,
    code,
    dispositionForCause(current, code),
  );
  return { next: terminal.state, actions: terminal.actions };
}

function terminalReduction(
  current: PeerSessionState,
  event: SessionEventCode,
  reason: SessionReasonCode,
  disposition: "retry" | "suppress" | "disable" | "none",
  notification?: FatalNotificationCode,
): { state: PeerSessionState; actions: readonly PeerSessionAction[] } {
  const wasEstablished = current.state === "Established";
  const dial = current.acquisition.kind === "dial";
  const nextState: ConnectionState = dial && disposition === "retry"
    ? "Active"
    : "Idle";
  const actions: PeerSessionAction[] = [];
  if (notification !== undefined) {
    actions.push({ type: "SendNotification", code: notification });
  }
  actions.push(
    { type: "MarkNonForwardable" },
    { type: "InvalidateContinuations" },
  );
  if (wasEstablished) {
    actions.push(
      { type: "PurgeSessionRoutes" },
      { type: "InvalidateRouteExport" },
    );
  }
  actions.push({ type: "StopTimers" }, { type: "ReleaseTransport" });
  if (dial && disposition === "retry") actions.push({ type: "ScheduleRetry" });
  else if (dial && disposition === "suppress") {
    actions.push({ type: "SuppressRetryForCollision" });
  } else if (dial && disposition === "disable") {
    actions.push({ type: "DisableRetry" });
  }
  actions.push({ type: "PublishTransition" });
  return {
    state: transition(current, nextState, event, {
      pendingAdmission: undefined,
      forwardable: false,
      stopped: disposition === "disable",
      lastReason: reason,
      retryAttempt: dial && disposition === "retry"
        ? current.retryAttempt + 1
        : current.retryAttempt,
    }),
    actions: immutableClone(actions),
  };
}

function dispositionForCause(
  state: PeerSessionState,
  cause: SessionReasonCode,
): "retry" | "suppress" | "none" {
  if (state.acquisition.kind !== "dial") return "none";
  const value = reconnectDisposition(cause);
  if (value === "retry") return "retry";
  if (value === "suppress") return "suppress";
  return "none";
}

function transition(
  current: PeerSessionState,
  state: ConnectionState,
  event: SessionEventCode,
  patch: Partial<PeerSessionState> = {},
): PeerSessionState {
  return immutableClone({
    ...current,
    ...patch,
    state,
    lastEvent: event,
  });
}

function publish(actions: readonly PeerSessionAction[]): readonly PeerSessionAction[] {
  return immutableClone([...actions, { type: "PublishTransition" as const }]);
}

function ignoredReduction(
  previous: PeerSessionState,
  input: PeerSessionCommand,
  reason: string,
): PeerSessionReduction {
  return immutableClone({
    previous,
    state: previous,
    input,
    actions: [{ type: "Ignore", reason }],
    ignored: true,
  });
}

function orientCandidate(candidate: ConnectionCandidate): {
  readonly initiatorNodeId: NodeId;
  readonly lowerSessionId: SessionId;
  readonly higherSessionId: SessionId;
} {
  const localLower = compareUtf8(candidate.localNodeId, candidate.remoteNodeId) < 0;
  return {
    initiatorNodeId: candidate.direction === "outbound"
      ? candidate.localNodeId
      : candidate.remoteNodeId,
    lowerSessionId: localLower
      ? candidate.localSessionId
      : candidate.remoteSessionId,
    higherSessionId: localLower
      ? candidate.remoteSessionId
      : candidate.localSessionId,
  };
}

function requireSameNodePair(
  left: ConnectionCandidate,
  right: ConnectionCandidate,
): void {
  const leftNodes = [left.localNodeId, left.remoteNodeId].sort(compareUtf8);
  const rightNodes = [right.localNodeId, right.remoteNodeId].sort(compareUtf8);
  if (leftNodes[0] !== rightNodes[0] || leftNodes[1] !== rightNodes[1]) {
    throw new AgpError(
      "INTERNAL",
      "compareConnectionCandidates",
      "connection candidates must describe the same node pair",
    );
  }
}
