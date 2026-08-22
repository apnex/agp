import {
  AGP_V1,
  encodeAgpPacket,
  negotiateOpenLimits,
  parseAgpPacket,
  validateOpenIdentity,
  type AgpMessage,
  type CreditGrant,
  type DataMessage,
  type ErrorMessage,
  type MessageId,
  type NodeId,
  type NotificationMessage,
  type OpenBody,
  type OpenMessage,
  type RouteAckMessage,
  type RouteAdvertisement,
  type RouteRejection,
  type RouteUpdateMessage,
  type SessionId,
} from "@agp/protocol";
import {
  CreditGrantor,
  CreditSpend,
  createPeerSessionState,
  reducePeerSession,
  type Acquisition,
  type Cancellable,
  type ClockPort,
  type ExactSessionOwner,
  type IdentityAdmissionPort,
  type ImportPolicyDecision,
  type OutboundRouteUpdate,
  type PeerSessionAction,
  type PeerSessionCommand,
  type PeerSessionState,
  type RouteAdmissionDecision,
  type RouteAdmissionPort,
  type RouteImportResult,
  type TimerRuntimeInput,
} from "@agp/core";
import type {
  TransportChannelPort,
  TransportTerminal,
} from "@agp/transport";
import type {
  DataSessionController,
} from "./data-plane.js";
import type { ReturnTokenAllocatorPort } from "./return-token.js";
import type { SerializedExecutor } from "./serialized-executor.js";
import { SessionWriter, type WriterCreditPort } from "./session-writer.js";

export interface SessionRuntimeConfig {
  readonly localOpen: OpenBody;
  readonly openTimeoutMs: number;
  readonly routeAckTimeoutMs: number;
  readonly transportCloseTimeoutMs: number;
  readonly writer: {
    readonly maximumQueuedDataMessages: number;
    readonly maximumQueuedDataBytes: number;
    readonly maximumQueuedControlMessages: number;
  };
  /**
   * Data capacity this node grants a peer, already reduced by the reserve it
   * holds back for control. Absent disables credit, which is the behaviour of
   * a peer that never negotiated it.
   */
  readonly credit?: {
    readonly bytes: number;
    readonly packets: number;
  };
  readonly expectedNodeId?: NodeId;
}

export interface SessionHost {
  readonly localNodeId: NodeId;
  readonly executor: SerializedExecutor;
  readonly clock: ClockPort;
  readonly identityAdmission: IdentityAdmissionPort;
  readonly routeAdmission: RouteAdmissionPort;

  nextMessageId(): MessageId;
  nextContinuationId(): string;
  retainIdentity(
    controller: PeerController,
    owner: ExactSessionOwner,
  ): { readonly winner: boolean };
  identityCommitted(controller: PeerController): void;
  established(controller: PeerController): void;
  applyRouteSnapshot(
    controller: PeerController,
    message: RouteUpdateMessage,
    policyDecisions: readonly ImportPolicyDecision[],
  ): RouteImportResult;
  acceptRouteAck(
    controller: PeerController,
    message: RouteAckMessage,
  ): boolean;
  outstandingRouteUpdate(
    controller: PeerController,
  ): { readonly id: MessageId; readonly revision: number } | undefined;
  routesChanged(controller: PeerController): void;
  purgeSession(controller: PeerController): void;
  controllerReleased(controller: PeerController, reason: string): void;
  sessionTransitioned(
    controller: PeerController,
    previous: PeerSessionState,
  ): void;
  sessionTimersChanged(controller: PeerController): void;
  dispatchData(controller: PeerController, message: DataMessage): void;
  dispatchError(controller: PeerController, message: ErrorMessage): void;
}

interface PendingRouteAdmission {
  readonly message: RouteUpdateMessage;
  readonly decisions: readonly ImportPolicyDecision[];
}

/**
 * One symmetric peer controller. Acquisition direction only decides reconnect
 * ownership; both directions execute the same OPEN/route/data language.
 */
export class PeerController implements DataSessionController {
  readonly #host: SessionHost;
  readonly #channel: TransportChannelPort;
  readonly #config: SessionRuntimeConfig;
  readonly #localSessionId: SessionId;
  readonly #identity = Object.freeze({});
  readonly writer: SessionWriter;
  readonly returnTokens: ReturnTokenAllocatorPort;
  readonly #timers = new Map<string, Cancellable>();
  readonly #timerRuntime = new Map<string, TimerRuntimeInput>();
  #state: PeerSessionState;
  #owner?: ExactSessionOwner;
  #pendingOpen?: OpenMessage;
  #pendingRoute: PendingRouteAdmission | undefined;
  #released = false;
  #transportDispositionClaimed = false;
  #lastTransportTerminal?: TransportTerminal;
  #notificationWrite?: Promise<void>;
  readonly #readAbort = new AbortController();
  #readCompletion?: Promise<void>;
  // Two halves of one concern. The grantor is what this node will accept of a
  // peer; the spend is what the peer will accept of this node.
  readonly #grantor: CreditGrantor | undefined;
  readonly #spend = new CreditSpend();

  constructor(input: {
    readonly host: SessionHost;
    readonly channel: TransportChannelPort;
    readonly acquisition: Acquisition;
    readonly controllerId: string;
    readonly localSessionId: SessionId;
    readonly config: SessionRuntimeConfig;
    readonly returnTokens: ReturnTokenAllocatorPort;
  }) {
    this.#host = input.host;
    this.#channel = input.channel;
    this.#config = input.config;
    this.#localSessionId = input.localSessionId;
    this.returnTokens = input.returnTokens;
    this.#state = createPeerSessionState({
      controllerId: input.controllerId,
      localNodeId: input.host.localNodeId,
      acquisition: input.acquisition,
    });
    this.writer = new SessionWriter(
      input.channel,
      input.config.writer,
      (error) => this.#transportFailed(error),
      () => this.#recordOutboundActivity(),
    );
    this.#grantor = input.config.credit === undefined
      ? undefined
      : new CreditGrantor(input.config.credit);
    this.writer.useCredit(this.#creditPort());
  }

  /** The writer's view of the peer's grant. */
  #creditPort(): WriterCreditPort {
    return {
      canSendData: (bytes) => this.#spend.canAdmit(bytes),
      recordDataSent: (bytes) => {
        if (this.#spend.unlimited) return;
        this.#spend.admit(bytes);
      },
      whenCreditAdvances: (signal) => this.#spend.whenAdvanced(signal),
    };
  }

  /** The cumulative ceiling this node currently offers its peer. */
  get creditGrant(): CreditGrant | undefined {
    return this.#grantor?.grant;
  }

  get controllerId(): string {
    return this.#state.controllerId;
  }

  get remoteNodeId(): NodeId {
    if (this.#owner === undefined) {
      throw new Error("remote identity is not committed");
    }
    return this.#owner.remoteNodeId;
  }

  get owningSessionId(): SessionId {
    return this.#localSessionId;
  }

  get identity(): object {
    return this.#identity;
  }

  get owner(): ExactSessionOwner {
    if (this.#owner === undefined) {
      throw new Error("session owner is not established");
    }
    return this.#owner;
  }

  get peerReceiveLimitBytes(): number {
    return this.#state.negotiated?.peerReceiveLimitBytes
      ?? this.#config.localOpen.receiveLimitBytes;
  }

  get maximumDataHopLimit(): number {
    return this.#state.negotiated?.maxHopCount
      ?? this.#config.localOpen.maxDataHopLimit;
  }

  get state(): PeerSessionState {
    return this.#state;
  }

  get lastTransportTerminal(): TransportTerminal | undefined {
    return this.#lastTransportTerminal;
  }

  timerRuntimeInputs(): readonly TimerRuntimeInput[] {
    return Object.freeze(
      [...this.#timerRuntime.values()].map((timer) =>
        Object.freeze({ ...timer })),
    );
  }

  isLive(): boolean {
    return this.#state.state === "Established"
      && this.#state.forwardable
      && !this.#released
      && this.#owner !== undefined;
  }

  async start(): Promise<void> {
    await this.#host.executor.run(() => {
      const start: PeerSessionCommand = this.#state.acquisition.kind === "dial"
        ? {
            type: "StartDial",
            localSessionId: this.#localSessionId,
          }
        : {
            type: "StartAccept",
            localSessionId: this.#localSessionId,
          };
      this.#dispatch(start);
      this.#dispatch({
        type: this.#state.acquisition.kind === "dial"
          ? "TransportOpened"
          : "TransportAccepted",
      });
    });
    this.#readCompletion = this.#readLoop();
    void this.#readCompletion;
  }

  writeControl(packet: Readonly<Uint8Array>): Promise<void> {
    return this.writer.enqueueControl(
      packet,
      packet.byteLength,
    );
  }

  terminate(reason: string): void {
    if (this.#released) return;
    void this.#host.executor.run(() => {
      if (this.#released) return;
      const type = reason === "Stop"
        ? "Stop"
        : reason === "INVALID_MESSAGE"
        ? "InvalidMessage"
        : "TransportFailed";
      this.#dispatch({ type });
    });
  }

  sendRouteUpdate(update: OutboundRouteUpdate): void {
    if (
      this.#owner === undefined
      || update.owner.controllerId !== this.#owner.controllerId
      || this.#released
    ) {
      return;
    }
    const message: RouteUpdateMessage = {
      agp: AGP_V1,
      plane: "control",
      type: "route.update",
      id: update.snapshot.id,
      body: {
        revision: update.snapshot.revision,
        routes: update.snapshot.routes,
      },
    };
    const encoded = this.#encode(message);
    if (encoded === undefined) {
      this.terminate("INVALID_MESSAGE");
      return;
    }
    const closedEpochs = update.closedEpochs.map((closure) =>
      epochKey(
        closure.controllerId,
        closure.endpoint,
        closure.originNodeId,
        closure.epoch,
      ));
    const written = this.writer.enqueueRouteSnapshot(
      encoded.bytes,
      encoded.utf8Bytes,
      closedEpochs,
    );
    void written.then(
      () => {
        void this.#host.executor.run(() => {
          this.#dispatch({ type: "RouteUpdateWritten" });
          this.#arm(
            "routeAck",
            this.#config.routeAckTimeoutMs,
            "RouteAckExpired",
          );
        });
      },
      () => this.terminate("TransportFailed"),
    );
  }

  async #readLoop(): Promise<void> {
    try {
      for (;;) {
        const event = await this.#channel.read(this.#readAbort.signal);
        if (event.kind === "packet") {
          // Release revokes all protocol authority, but the transport read
          // authority remains live until terminal. Reliable transports may
          // retain packets accepted before close and cannot truthfully
          // complete close until their consumer drains those packets.
          if (this.#released) continue;
          const parsed = parseAgpPacket(event.packet.bytes, {
            receiveLimitBytes: this.#config.localOpen.receiveLimitBytes,
          });
          if (!parsed.ok) {
            await this.#host.executor.run(() => {
              this.#dispatch({
                type: parsed.reasonCode === "UNSUPPORTED_VERSION"
                  ? "InvalidMessage"
                  : "InvalidMessage",
              });
            });
            if (this.#released) continue;
            return;
          }
          if (this.#released) continue;
          this.#observePeerCredit(parsed.message);
          // The ring slot is already free at this point, which is what credit
          // governs. What the handler queue does with the payload afterwards
          // is a separate bound, held by the capacity ledger, and conflating
          // the two would let a slow handler withhold ring capacity it is not
          // occupying.
          if (parsed.message.type === "message") {
            this.#consumeCredit(parsed.utf8Bytes);
          }
          await this.#handleMessage(parsed.message);
        } else if (event.kind === "input-rejected") {
          if (this.#released) continue;
          await this.#host.executor.run(() => {
            if (this.#claimTransportDisposition()) {
              this.#dispatch({ type: "TransportInputRejected" });
            }
          });
          if (this.#released) continue;
          return;
        } else {
          if (this.#released) {
            this.#lastTransportTerminal ??= event.terminal;
            return;
          }
          await this.#host.executor.run(() => {
            if (!this.#claimTransportDisposition(event.terminal)) return;
            this.#dispatch({
              type:
                event.terminal.kind === "graceful"
                && event.terminal.origin === "remote"
                  ? "TransportClosed"
                  : "TransportFailed",
            });
          });
          return;
        }
      }
    } catch {
      await this.#host.executor.run(() => {
        if (!this.#released && this.#claimTransportDisposition()) {
          this.#dispatch({ type: "TransportFailed" });
        }
      });
    }
  }

  #observePeerCredit(message: AgpMessage): void {
    this.#spend.observeGrant(
      message.type === "open" ? message.body.initialCredit : message.credit,
    );
  }

  /**
   * Records a drained packet and announces the room it made.
   *
   * A sender stopped at its ceiling sends nothing, so nothing arrives to carry
   * the replenishment back and the receiver has to volunteer it. Announcing
   * per packet would put a control message on the wire for every data message,
   * so this waits for half the window, which is TCP's rule for TCP's reason.
   *
   * This is deliberately not the keepalive timer. A deployment with
   * `holdTimeMs` at zero has no keepalive at all, and it still needs credit.
   */
  #consumeCredit(bytes: number): void {
    const grantor = this.#grantor;
    if (grantor === undefined) return;
    grantor.consumed(bytes);
    if (!grantor.shouldAdvertise) return;
    this.#enqueueControl({
      agp: AGP_V1,
      plane: "control",
      type: "keepalive",
      id: this.#host.nextMessageId(),
      body: {},
    });
  }

  async #handleMessage(message: AgpMessage): Promise<void> {
    switch (message.type) {
      case "open":
        await this.#handleOpen(message);
        break;
      case "keepalive":
        await this.#host.executor.run(() => {
          this.#dispatch({ type: "KeepaliveReceived" });
        });
        break;
      case "route.update":
        await this.#handleRouteUpdate(message);
        break;
      case "route.ack":
        await this.#host.executor.run(() => {
          const outstanding = this.#host.outstandingRouteUpdate(this);
          this.#dispatch({
            type: "RouteAckReceived",
            ...(outstanding === undefined
              ? {}
              : {
                  outstandingRefId: outstanding.id,
                  outstandingRevision: outstanding.revision as never,
                }),
            refId: message.body.refId,
            revision: message.body.revision,
            rejected: message.body.rejected,
          }, message);
        });
        break;
      case "message":
        await this.#host.executor.run(() => {
          this.#dispatch({ type: "DataReceived" }, message);
        });
        break;
      case "error":
        await this.#host.executor.run(() => {
          this.#dispatch({ type: "ErrorReceived" }, message);
        });
        break;
      case "notification":
        await this.#host.executor.run(() => {
          this.#dispatch({
            type: "NotificationReceived",
            notificationCode: message.body.code,
          }, message);
        });
        break;
    }
  }

  async #handleOpen(message: OpenMessage): Promise<void> {
    const token = this.#host.nextContinuationId();
    await this.#host.executor.run(() => {
      this.#pendingOpen = message;
      this.#dispatch({
        type: "OpenReceived",
        continuationToken: token,
      }, message);
    });

    let admitted = false;
    try {
      const result = await this.#evaluateIdentityAdmission(message);
      admitted = result.decision === "allow";
    } catch {
      await this.#host.executor.run(() => {
        this.#dispatch({
          type: "AdmissionFaulted",
          continuationToken: token,
        });
      });
      return;
    }

    await this.#host.executor.run(() => {
      const staticIdentity = validateOpenIdentity(message.body, {
        localNodeId: this.#host.localNodeId,
        ...(this.#config.expectedNodeId === undefined
          ? {}
          : { expectedNodeId: this.#config.expectedNodeId }),
        identityAdmitted: admitted,
      });
      const limits = negotiateOpenLimits(
        this.#config.localOpen,
        message.body,
      );
      const owner: ExactSessionOwner = {
        controllerId: this.controllerId,
        remoteNodeId: message.body.nodeId,
        localSessionId: this.#localSessionId,
        remoteSessionId: message.body.sessionId,
      };
      const collision = staticIdentity.ok
        ? this.#host.retainIdentity(this, owner)
        : { winner: false };
      this.#dispatch({
        type: "IdentityAdmissionResolved",
        continuationToken: token,
        admissionAllowed: staticIdentity.ok,
        admissionResultValid: true,
        collisionWinner: collision.winner,
        remoteNodeId: message.body.nodeId,
        remoteSessionId: message.body.sessionId,
        negotiated: {
          holdTimeMs: limits.holdTimeMs,
          keepaliveTimeMs: limits.holdTimeMs === 0
            ? 0
            : Math.max(1, Math.floor(limits.holdTimeMs / 3)),
          peerReceiveLimitBytes: limits.receiveLimitBytes,
          maxRoutesPerSnapshot: limits.maxRoutesPerSnapshot,
          maxPathLength: limits.maxPathLength,
          maxHopCount: limits.maxDataHopLimit,
          transit: message.body.transit,
        },
      }, message);
    });
  }

  #evaluateIdentityAdmission(
    message: OpenMessage,
  ): Promise<import("@agp/core").IdentityAdmissionResult> {
    return this.#host.identityAdmission.evaluate({
      localNodeId: this.#host.localNodeId,
      remoteNodeId: message.body.nodeId,
      localSessionId: this.#localSessionId,
      remoteSessionId: message.body.sessionId,
      direction: this.#state.direction,
      ...(this.#state.acquisition.kind === "dial"
        ? { adjacencyId: this.#state.acquisition.adjacencyId }
        : {}),
      ...(this.#config.expectedNodeId === undefined
        ? {}
        : { expectedRemoteNodeId: this.#config.expectedNodeId }),
      peerEvidence: this.#channel.peerEvidence,
    });
  }

  async #handleRouteUpdate(message: RouteUpdateMessage): Promise<void> {
    const token = this.#host.nextContinuationId();
    await this.#host.executor.run(() => {
      this.#dispatch({
        type: "RouteUpdateReceived",
        continuationToken: token,
        updateId: message.id,
        revision: message.body.revision,
        routes: message.body.routes,
      }, message);
    });

    let decisions: readonly RouteAdmissionDecision[];
    try {
      const owner = this.owner;
      const result = await this.#host.routeAdmission.evaluate({
        localNodeId: this.#host.localNodeId,
        remoteNodeId: owner.remoteNodeId,
        localSessionId: owner.localSessionId,
        revision: message.body.revision,
        updateId: message.id,
        routes: message.body.routes,
      });
      decisions = result.decisions;
    } catch {
      await this.#host.executor.run(() => {
        this.#dispatch({
          type: "AdmissionFaulted",
          continuationToken: token,
        });
      });
      return;
    }
    const policyDecisions = decisions.map((decision) => ({
      endpoint: decision.endpoint,
      originNodeId: decision.originNodeId,
      path: decision.path,
      decision: decision.decision,
    })) satisfies readonly ImportPolicyDecision[];
    const preliminary = decisions
      .filter((decision) => decision.decision === "deny")
      .map((decision) => ({
        endpoint: decision.endpoint,
        originNodeId: decision.originNodeId,
        reasonCode: "POLICY" as const,
      }));
    await this.#host.executor.run(() => {
      this.#pendingRoute = { message, decisions: policyDecisions };
      this.#dispatch({
        type: "RouteAdmissionResolved",
        continuationToken: token,
        admissionAllowed: true,
        admissionResultValid: true,
        updateId: message.id,
        revision: message.body.revision,
        rejected: preliminary,
      }, message);
    });
  }

  #dispatch(command: PeerSessionCommand, message?: AgpMessage): void {
    const previous = this.#state;
    const reduction = reducePeerSession(this.#state, command);
    this.#state = reduction.state;
    for (const action of reduction.actions) {
      this.#apply(action, message, previous);
    }
  }

  #apply(
    action: PeerSessionAction,
    message: AgpMessage | undefined,
    previous: PeerSessionState,
  ): void {
    switch (action.type) {
      case "SendOpen":
        this.#sendOpen();
        break;
      case "CommitIdentity":
        this.#owner = action.owner;
        this.#host.identityCommitted(this);
        break;
      case "SendKeepalive":
        this.#sendKeepalive();
        break;
      case "ArmOpenTimer":
        this.#arm("open", this.#config.openTimeoutMs, "OpenExpired");
        break;
      case "ArmProtocolTimers":
        this.#cancel("open");
        this.#resetProtocolTimers();
        break;
      case "ResetHoldTimer":
        this.#resetHold();
        break;
      case "ResetKeepaliveTimer":
        this.#resetKeepalive();
        break;
      case "ScheduleInitialRouteSnapshot":
        this.#host.established(this);
        break;
      case "ApplyRouteSnapshot": {
        const pending = this.#pendingRoute;
        if (pending === undefined) {
          this.terminate("INVALID_MESSAGE");
          break;
        }
        this.#pendingRoute = undefined;
        const result = this.#host.applyRouteSnapshot(
          this,
          pending.message,
          pending.decisions,
        );
        if (!result.ok) {
          this.terminate(result.code);
          break;
        }
        this.#sendRouteAck(pending.message, result.rejected);
        break;
      }
      case "AcceptRouteAck":
        this.#cancel("routeAck");
        if (message?.type !== "route.ack" || !this.#host.acceptRouteAck(this, message)) {
          this.terminate("INVALID_MESSAGE");
        }
        break;
      case "RecomputeRouteExport":
        this.#host.routesChanged(this);
        break;
      case "DispatchData":
        if (message?.type === "message") {
          queueMicrotask(() => this.#host.dispatchData(this, message));
        }
        break;
      case "DispatchDeliveryError":
        if (message?.type === "error") {
          queueMicrotask(() => this.#host.dispatchError(this, message));
        }
        break;
      case "SendNotification":
        this.#sendNotification(action.code);
        break;
      case "PurgeSessionRoutes":
        this.#host.purgeSession(this);
        break;
      case "StopTimers":
        this.#cancelAllTimers();
        break;
      case "ReleaseTransport":
        this.#release(this.#state.lastReason ?? "TransportClosed");
        break;
      case "PublishTransition":
        this.#host.sessionTransitioned(this, previous);
        break;
      case "AllocateSession":
      case "Dial":
      case "AdoptTransport":
      case "BeginIdentityAdmission":
      case "BeginRouteAdmission":
      case "MarkRouteUpdateWritten":
      case "MarkNonForwardable":
      case "InvalidateContinuations":
      case "InvalidateRouteExport":
      case "ScheduleRetry":
      case "SuppressRetryForCollision":
      case "DisableRetry":
      case "Ignore":
        break;
    }
  }

  #sendOpen(): void {
    const message: OpenMessage = {
      agp: AGP_V1,
      plane: "control",
      type: "open",
      id: this.#host.nextMessageId(),
      body: {
        ...this.#config.localOpen,
        nodeId: this.#host.localNodeId,
        sessionId: this.#localSessionId,
        ...(this.#grantor === undefined
          ? {}
          : { initialCredit: this.#grantor.grant }),
      },
    };
    this.#enqueueControl(message);
  }

  #sendKeepalive(): void {
    this.#enqueueControl({
      agp: AGP_V1,
      plane: "control",
      type: "keepalive",
      id: this.#host.nextMessageId(),
      body: {},
    });
  }

  #sendRouteAck(
    update: RouteUpdateMessage,
    rejected: readonly RouteRejection[],
  ): void {
    this.#enqueueControl({
      agp: AGP_V1,
      plane: "control",
      type: "route.ack",
      id: this.#host.nextMessageId(),
      body: {
        refId: update.id,
        revision: update.body.revision,
        rejected,
      },
    });
  }

  #sendNotification(code: NotificationMessage["body"]["code"]): void {
    const reason = code.toLowerCase().replaceAll("_", " ");
    const encoded = this.#encode({
      agp: AGP_V1,
      plane: "control",
      type: "notification",
      id: this.#host.nextMessageId(),
      body: { code, reason },
    });
    if (encoded !== undefined) {
      this.#notificationWrite = this.writer.enqueueControl(
        encoded.bytes,
        encoded.utf8Bytes,
      );
      void this.#notificationWrite.catch(() => undefined);
    }
  }

  #enqueueControl(message: AgpMessage): void {
    const encoded = this.#encode(message);
    if (encoded === undefined) {
      this.terminate("INVALID_MESSAGE");
      return;
    }
    void this.writer.enqueueControl(encoded.bytes, encoded.utf8Bytes).catch(
      () => this.terminate("TransportFailed"),
    );
  }

  /**
   * Encodes a control envelope and rides this node's ceiling on it.
   *
   * Credit travels on traffic that is already flowing, which costs nothing and
   * correlates exactly with the need. `OPEN` is the exception: its body
   * carries `initialCredit`, so stamping the envelope too would put the same
   * grant on one message twice.
   *
   * The ceiling is marked announced here rather than after the write. Claiming
   * an announcement that never reached the wire could suppress the one that
   * would clear a stall, so this is only safe because a discarded control
   * packet means the session is already going away.
   */
  #encode(message: AgpMessage) {
    const grant = message.type === "open" ? undefined : this.#grantor?.grant;
    const encoded = encodeAgpPacket(
      grant === undefined ? message : { ...message, credit: grant },
      this.peerReceiveLimitBytes,
    );
    if (!encoded.ok) return undefined;
    if (grant !== undefined) this.#grantor?.advertised();
    return encoded;
  }

  #resetProtocolTimers(): void {
    this.#resetHold();
    this.#resetKeepalive();
  }

  #resetHold(): void {
    const duration = this.#state.negotiated?.holdTimeMs ?? 0;
    this.#cancel("hold");
    if (duration > 0) this.#arm("hold", duration, "HoldExpired");
  }

  #resetKeepalive(): void {
    const duration = this.#state.negotiated?.keepaliveTimeMs ?? 0;
    this.#cancel("keepalive");
    if (duration > 0) {
      this.#arm("keepalive", duration, "KeepaliveExpired");
    }
  }

  #recordOutboundActivity(): void {
    void this.#host.executor.run(() => {
      if (
        this.#released
        || (this.#state.state !== "OpenConfirm"
          && this.#state.state !== "Established")
      ) {
        return;
      }
      this.#resetKeepalive();
      this.#host.sessionTimersChanged(this);
    });
  }

  #arm(
    name: string,
    durationMs: number,
    event: PeerSessionCommand["type"],
  ): void {
    this.#cancel(name);
    const startedAt = this.#host.clock.wallTime();
    const deadlineMonotonicMs = this.#host.clock.monotonicMs() + durationMs;
    this.#timerRuntime.set(name, {
      name: name as TimerRuntimeInput["name"],
      state: "armed",
      startedAt,
      durationMs,
      expiresAt: new Date(Date.parse(startedAt) + durationMs).toISOString(),
      deadlineMonotonicMs,
    });
    this.#timers.set(name, this.#host.clock.schedule(durationMs, () => {
      void this.#host.executor.run(() => {
        this.#timers.delete(name);
        this.#timerRuntime.delete(name);
        if (!this.#released) this.#dispatch({ type: event });
      });
    }));
  }

  #cancel(name: string): void {
    this.#timers.get(name)?.cancel();
    this.#timers.delete(name);
    this.#timerRuntime.delete(name);
  }

  #cancelAllTimers(): void {
    for (const timer of this.#timers.values()) timer.cancel();
    this.#timers.clear();
    this.#timerRuntime.clear();
  }

  #release(reason: string): void {
    if (this.#released) return;
    this.#released = true;
    this.#transportDispositionClaimed = true;
    const finish = async () => {
      const closeAbort = new AbortController();
      const deadline = this.#host.clock.schedule(
        this.#config.transportCloseTimeoutMs,
        () => closeAbort.abort("transport close deadline"),
      );
      try {
        await this.#notificationWrite;
        const terminal = await this.#channel.close(
          {
            kind:
              reason === "Stop" ? "node-stop"
              : reason === "ADJACENCY_COLLISION" ? "session-replaced"
              : reason === "TransportClosed" ? "normal"
              : "protocol-fatal",
            code: diagnosticCode(reason),
          },
          closeAbort.signal,
        );
        this.#lastTransportTerminal ??= terminal;
      } catch {
        this.#channel.abort({
          kind: closeAbort.signal.aborted ? "deadline" : "forced-stop",
          code: closeAbort.signal.aborted
            ? "TRANSPORT_CLOSE_DEADLINE"
            : "TRANSPORT_CLOSE_FAILED",
        });
      } finally {
        deadline.cancel();
        this.writer.stop(reason);
        // A terminal disposition is ordered after every packet the transport
        // already accepted. Waiting for the sole reader here preserves that
        // no-drop contract while released packets remain protocol-inert.
        await this.#readCompletion;
        this.#readAbort.abort("session transport terminal observed");
        this.#host.controllerReleased(this, reason);
      }
    };
    void finish();
  }

  #claimTransportDisposition(terminal?: TransportTerminal): boolean {
    if (this.#transportDispositionClaimed) return false;
    this.#transportDispositionClaimed = true;
    if (terminal !== undefined) this.#lastTransportTerminal = terminal;
    return true;
  }

  #transportFailed(_error: unknown): void {
    void this.#host.executor.run(() => {
      if (this.#released || !this.#claimTransportDisposition()) return;
      this.#dispatch({ type: "TransportFailed" });
    });
  }
}

export function epochKey(
  controllerId: string,
  endpoint: string,
  originNodeId: string,
  epoch: number,
): string {
  return `${controllerId}:${endpoint}:${originNodeId}:${epoch}`;
}

function diagnosticCode(reason: string): string {
  const normalized = reason.toUpperCase().replaceAll(/[^A-Z0-9_]/g, "_");
  return /^[A-Z]/.test(normalized)
    ? normalized.slice(0, 64)
    : `SESSION_${normalized}`.slice(0, 64);
}
