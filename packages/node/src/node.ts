import { randomBytes, randomUUID } from "node:crypto";

import {
  AGP_V1_LIMITS,
  encodeAgpPacket,
  isCorrelationId,
  isEndpointName,
  isMessageId,
  isNodeId,
  isSessionId,
  type CorrelationId,
  type DataMessage,
  type DeliveryErrorBody,
  type DeliveryErrorCode,
  type EndpointName,
  type EndpointSource,
  type ErrorMessage,
  type JsonObject,
  type MessageId,
  type NodeId,
  type OpenBody,
  type SessionId,
} from "@agp/protocol";
import {
  immutableClone,
  AgpError,
  assertCoreSchema,
  compareConnectionCandidates,
  OperationsStore,
  RoutingTable,
  SystemClock,
  type AdjacencySnapshot,
  type ClockPort,
  type ConfigurationSnapshot,
  type DiagnosticRecord,
  type DiagnosticSinkPort,
  type ExactSessionOwner,
  type IdScope,
  type IdSourcePort,
  type IdentityAdmissionPort,
  type ImportPolicyDecision,
  type InstanceId,
  type ListenerSnapshot,
  type LocalEndpointSnapshot,
  type NodeConfig,
  type OperationsReader,
  type OperationsRevision,
  type OperationalEventInput,
  type PeerConfig,
  type RandomPort,
  type ReverseCorrelationSnapshot,
  type RouteAdmissionPort,
  type RouteImportResult,
  type RoutingMutationResult,
  type SendOptions,
  type SendReceipt,
  type SessionOperationalInput,
  type ConnectionOperationalInput,
  type StartOptions,
  type StartedNode,
  type StopOptions,
  type StopReport,
} from "@agp/core";
import {
  isTransportOperationError,
  type PeerTransportPort,
  type TransportChannelLimits,
  type TransportChannelPort,
  type TransportConnectCapability,
  type TransportListenCapability,
  type TransportListenerPort,
  type TransportListenerTerminal,
} from "@agp/transport";

import { BreadcrumbStore } from "./breadcrumbs.js";
import {
  DataPlane,
  DataPlaneFailure,
  type DataPlaneCommitPort,
} from "./data-plane.js";
import {
  EndpointRegistry,
  type EndpointHandler,
} from "./endpoint-registry.js";
import { HandlerLedger } from "./handler-ledger.js";
import { ReturnTokenAllocator } from "./return-token.js";
import { ReverseErrorEngine } from "./reverse-errors.js";
import { CoreDataRoutingAdapter } from "./routing-adapter.js";
import { SerializedExecutor } from "./serialized-executor.js";
import {
  PeerController,
  epochKey,
  type SessionHost,
  type SessionRuntimeConfig,
} from "./session-controller.js";

export interface NodeDependencies {
  readonly clock?: ClockPort;
  readonly random?: RandomPort;
  readonly ids?: IdSourcePort;
  readonly diagnostics?: DiagnosticSinkPort;
  readonly transport?: PeerTransportPort;
  readonly identityAdmission?: IdentityAdmissionPort;
  readonly routeAdmission?: RouteAdmissionPort;
}

export interface EndpointBinding {
  readonly info: Readonly<{
    endpoint: EndpointName;
    bindingId: string;
    registeredAt: string;
    operationsRevision: OperationsRevision;
  }>;
  close(): Promise<void>;
}

export interface EndpointHandlerContext {
  readonly delivery: import("@agp/core").EndpointDeliveryContext;
  readonly signal: AbortSignal;
}

export interface AgpNode {
  readonly nodeId: NodeId;
  readonly operations: OperationsReader;
  start(options?: StartOptions): Promise<StartedNode>;
  stop(options?: StopOptions): Promise<StopReport>;
  expose(endpoint: EndpointName, handler: EndpointHandler): Promise<EndpointBinding>;
  send(
    source: EndpointName,
    destination: EndpointName,
    payload: JsonObject,
    options?: SendOptions,
  ): Promise<SendReceipt>;
}

interface EffectiveConfig {
  readonly raw: NodeConfig;
  readonly nodeId: NodeId;
  readonly listen?: NonNullable<NodeConfig["listen"]>;
  readonly peers: readonly PeerConfig[];
  readonly transitEnabled: boolean;
  readonly defaultHopLimit: number;
  readonly holdTimeMs: number;
  readonly openTimeoutMs: number;
  readonly routeAckTimeoutMs: number;
  readonly transportWriteTimeoutMs: number;
  readonly transportCloseTimeoutMs: number;
  readonly receiveLimitBytes: number;
  readonly maxRoutesPerSnapshot: number;
  readonly maxPathLength: number;
  readonly maxHopCount: number;
  readonly maxLocalEndpoints: number;
  readonly maxCandidateRoutes: number;
  readonly maxSessions: number;
  readonly maxPendingHandshakes: number;
  readonly channelLimits: TransportChannelLimits;
  readonly credit?: {
    readonly bytes: number;
    readonly packets: number;
  };
  readonly controlQueueMessages: number;
  readonly dataQueueMessages: number;
  readonly dataQueueBytes: number;
  readonly maxActiveHandlers: number;
  readonly maxActiveHandlerBytes: number;
  readonly maxReverseCorrelations: number;
  readonly maxReverseCorrelationBytes: number;
  readonly maxEventSubscribers: number;
  readonly eventSubscriberBuffer: number;
  readonly reverseCorrelationLifetimeMs: number;
}

interface SessionEvidence {
  stateSince: string;
  establishedAt?: string;
  establishedMonotonicMs?: number;
  lastTransition: SessionOperationalInput["lastTransition"];
}

export function createNode(
  config: NodeConfig,
  dependencies: NodeDependencies = {},
): AgpNode {
  return new NodeImpl(config, dependencies);
}

export class NodeImpl implements AgpNode, SessionHost {
  readonly nodeId: NodeId;
  readonly operations: OperationsReader;
  readonly executor = new SerializedExecutor();
  readonly clock: ClockPort;
  readonly identityAdmission: IdentityAdmissionPort;
  readonly routeAdmission: RouteAdmissionPort;

  readonly #config: EffectiveConfig;
  readonly #ids: IdSourcePort;
  readonly #diagnostics: DiagnosticSinkPort | undefined;
  readonly #instanceId: InstanceId;
  #listenerCapability?: TransportListenCapability;
  readonly #targetCapabilities = new Map<string, TransportConnectCapability>();
  readonly #operations: OperationsStore;
  readonly #routing: RoutingTable;
  readonly #endpoints: EndpointRegistry;
  readonly #handlers: HandlerLedger;
  readonly #breadcrumbs: BreadcrumbStore;
  // A breadcrumb is immutable once admitted, so its projection is built once
  // and shared. The map is weak because the breadcrumb owns the lifetime.
  readonly #reverseProjections = new WeakMap<
    object,
    ReverseCorrelationSnapshot
  >();
  // The whole list, memoised against breadcrumb membership. Several commits
  // land per delivered message and the set changes at most once between them.
  #reverseListCache: {
    readonly version: number;
    readonly value: readonly ReverseCorrelationSnapshot[];
  } | undefined;
  #endpointListCache: {
    readonly version: number;
    readonly value: readonly LocalEndpointSnapshot[];
  } | undefined;
  readonly #reverseErrors: ReverseErrorEngine;
  readonly #dataPlane: DataPlane;
  readonly #controllers = new Map<string, PeerController>();
  readonly #controllerByPair = new Map<string, PeerController>();
  readonly #sessionEvidence = new Map<string, SessionEvidence>();
  readonly #adjacencyAttempts = new Map<string, number>();
  readonly #adjacencyTimers = new Map<string, { cancel(): void }>();
  #listener?: TransportListenerPort;
  #listenerTerminal?: TransportListenerTerminal;
  readonly #listenerWatchAbort = new AbortController();
  #hostState: "Created" | "Starting" | "Running" | "Stopping" | "Stopped" | "Failed" =
    "Created";
  #startPromise?: Promise<StartedNode>;
  #started?: StartedNode;
  #stopPromise?: Promise<StopReport>;
  #stopped?: StopReport;
  #discardedMessages = 0n;

  get localNodeId(): NodeId {
    return this.nodeId;
  }

  constructor(config: NodeConfig, dependencies: NodeDependencies = {}) {
    try {
      assertCoreSchema<NodeConfig>(
        "urn:agp:schema:v1:core:configuration:node-config",
        config,
      );
    } catch (error) {
      throw new AgpError(
        "CONFIG_INVALID",
        "createNode",
        "NodeConfig failed its sovereign schema",
        { cause: error },
      );
    }
    this.#config = resolveConfig(config);
    this.nodeId = this.#config.nodeId;
    this.clock = dependencies.clock ?? new SystemClock();
    this.#ids = dependencies.ids ?? new CryptoIdSource();
    this.#diagnostics = dependencies.diagnostics;
    const transport = dependencies.transport;
    if (
      (this.#config.listen !== undefined || this.#config.peers.length > 0)
      && transport === undefined
    ) {
      throw new AgpError(
        "CONFIG_INVALID",
        "createNode",
        "configured network facilities require a peer transport",
      );
    }
    try {
      const capabilities = resolveTransportCapabilities(
        this.#config,
        transport,
      );
      if (capabilities.listener !== undefined) {
        this.#listenerCapability = capabilities.listener;
      }
      for (const [adjacencyId, capability] of capabilities.targets) {
        this.#targetCapabilities.set(adjacencyId, capability);
      }
    } catch (error) {
      throw new AgpError(
        "CONFIG_INVALID",
        "createNode",
        "transport reference resolution failed",
        { cause: error },
      );
    }
    if (
      config.identityAdmission?.mode === "port"
      && dependencies.identityAdmission === undefined
    ) {
      throw new AgpError(
        "CONFIG_INVALID",
        "createNode",
        "identity admission mode port requires identityAdmission",
      );
    }
    if (
      config.routeAdmission?.mode === "port"
      && dependencies.routeAdmission === undefined
    ) {
      throw new AgpError(
        "CONFIG_INVALID",
        "createNode",
        "route admission mode port requires routeAdmission",
      );
    }
    this.identityAdmission = dependencies.identityAdmission ?? ALLOW_IDENTITY;
    this.routeAdmission = dependencies.routeAdmission ?? ALLOW_ROUTES;

    const instanceId = this.#nextIdentifier("instance") as InstanceId;
    this.#instanceId = instanceId;
    const configuration: ConfigurationSnapshot = {
      raw: jsonClone(config),
      effective: jsonClone(effectiveDocument(this.#config)),
      redactedKeys: [],
    };
    this.#operations = new OperationsStore({
      nodeId: this.nodeId,
      instanceId,
      clock: this.clock,
      configuration,
      listener: this.#listenerSnapshot("stopped"),
      maxEventSubscribers: this.#config.maxEventSubscribers,
      eventSubscriberBuffer: this.#config.eventSubscriberBuffer,
    });
    this.operations = this.#operations;
    this.#routing = new RoutingTable({
      nodeId: this.nodeId,
      ids: this.#ids,
      clock: this.clock,
      transitEnabled: this.#config.transitEnabled,
      maxLocalEndpoints: this.#config.maxLocalEndpoints,
      maxCandidateRoutes: this.#config.maxCandidateRoutes,
      ...(config.routeRejectionRetry === undefined
        ? {}
        : { routeRejectionRetry: config.routeRejectionRetry }),
    });
    this.#endpoints = new EndpointRegistry(this.#config.maxLocalEndpoints);
    this.#handlers = new HandlerLedger({
      maximumConcurrent: this.#config.maxActiveHandlers,
      maximumBytes: this.#config.maxActiveHandlerBytes,
    });
    this.#breadcrumbs = new BreadcrumbStore({
      maximumEntries: this.#config.maxReverseCorrelations,
      maximumBytes: this.#config.maxReverseCorrelationBytes,
    }, () => this.clock.monotonicMs());
    this.#reverseErrors = new ReverseErrorEngine({
      localNodeId: this.nodeId,
      breadcrumbs: this.#breadcrumbs,
      monotonicNow: () => this.clock.monotonicMs(),
      nextMessageId: () => this.nextMessageId(),
      encode: (message) => {
        const result = encodeAgpPacket(
          message,
          AGP_V1_LIMITS.maxReceiveBytes,
        );
        if (!result.ok) {
          throw new AgpError(
            "INTERNAL",
            "reverse-error.encode",
            "reverse error did not encode",
          );
        }
        return result.bytes;
      },
      publishLocal: (error) => {
        this.#commitMessageOutcome("message.failed", error.refId, error.code);
      },
    });
    this.#dataPlane = new DataPlane({
      localNodeId: this.nodeId,
      transitEnabled: this.#config.transitEnabled,
      defaultHopLimit: this.#config.defaultHopLimit,
      reverseCorrelationLifetimeMs: this.#config.reverseCorrelationLifetimeMs,
      routing: new CoreDataRoutingAdapter(this.#routing),
      sessions: {
        resolve: (nodeId, sessionId) =>
          this.#controllerByPair.get(pairKey(nodeId, sessionId)),
      },
      endpoints: this.#endpoints,
      handlers: this.#handlers,
      breadcrumbs: this.#breadcrumbs,
      reverseErrors: this.#reverseErrors,
      executor: this.executor,
      nextMessageId: () => this.nextMessageId(),
      wallTime: () => this.clock.wallTime(),
      monotonicNow: () => this.clock.monotonicMs(),
      commit: {
        commit: (input) =>
          this.#commitMessageOutcome(input.kind, input.messageId, input.code),
      },
      onTokenExhausted: (controller) =>
        controller.terminate("return-token-exhausted"),
    });
  }

  start(options: StartOptions = {}): Promise<StartedNode> {
    if (this.#hostState === "Running" && this.#started !== undefined) {
      return Promise.resolve(this.#started);
    }
    if (this.#hostState === "Stopped" || this.#hostState === "Failed") {
      return Promise.reject(new AgpError(
        "LIFECYCLE_INVALID",
        "node.start",
        `cannot start a ${this.#hostState} node`,
      ));
    }
    if (this.#startPromise !== undefined) return this.#startPromise;
    if (this.#hostState !== "Created") {
      return Promise.reject(new AgpError(
        "LIFECYCLE_INVALID",
        "node.start",
        `cannot start a ${this.#hostState} node`,
      ));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new AgpError("ABORTED", "node.start", "start aborted"));
    }
    this.#startPromise = this.#start(options).catch((error: unknown) => {
      throw error instanceof AgpError
        ? error
        : new AgpError("TRANSPORT_FAILURE", "node.start", "start failed", {
            cause: error,
          });
    });
    return this.#startPromise;
  }

  stop(options: StopOptions = {}): Promise<StopReport> {
    if (this.#stopPromise !== undefined) return this.#stopPromise;
    if (this.#stopped !== undefined) return Promise.resolve(this.#stopped);
    if (
      options.drainTimeoutMs !== undefined
      && (!Number.isSafeInteger(options.drainTimeoutMs) || options.drainTimeoutMs < 0)
    ) {
      return Promise.reject(new AgpError(
        "OPTIONS_INVALID",
        "node.stop",
        "drainTimeoutMs must be a non-negative safe integer",
      ));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new AgpError("ABORTED", "node.stop", "stop aborted"));
    }
    this.#stopPromise = this.#stop(options);
    return this.#stopPromise;
  }

  async expose(
    endpoint: EndpointName,
    handler: EndpointHandler,
  ): Promise<EndpointBinding> {
    if (!isEndpointName(endpoint)) {
      throw new AgpError("ENDPOINT_INVALID", "node.expose", "invalid endpoint");
    }
    if (typeof handler !== "function") {
      throw new AgpError("HANDLER_INVALID", "node.expose", "handler is not callable");
    }
    return this.executor.run(() => {
      if (this.#hostState !== "Created" && this.#hostState !== "Running") {
        throw new AgpError(
          "LIFECYCLE_INVALID",
          "node.expose",
          `cannot expose while ${this.#hostState}`,
        );
      }
      const bindingId = this.#nextIdentifier("binding");
      const registeredAt = this.clock.wallTime();
      let registered;
      try {
        registered = this.#endpoints.register({
          endpoint,
          bindingId,
          registeredAt,
          handler,
        });
      } catch (error) {
        throw new AgpError(
          this.#endpoints.has(endpoint)
            ? "ENDPOINT_ALREADY_EXPOSED"
            : "ENDPOINT_CAPACITY",
          "node.expose",
          error instanceof Error ? error.message : "endpoint rejected",
        );
      }
      let mutation: RoutingMutationResult;
      try {
        mutation = this.#routing.installLocal({
          endpoint,
          bindingId,
          registeredAt,
        });
      } catch (error) {
        this.#endpoints.remove(bindingId);
        throw error;
      }
      this.#applyRoutingMutation(mutation, {
        kind: "endpoint.exposed",
        subjectId: endpoint,
      });
      const info = Object.freeze({
        endpoint,
        bindingId,
        registeredAt,
        operationsRevision: this.#operations.currentRevision,
      });
      let closed = false;
      return Object.freeze({
        info,
        close: async (): Promise<void> => {
          if (closed) return;
          closed = true;
          await this.executor.run(() => this.#closeBinding(bindingId));
        },
      });
    });
  }

  async send(
    source: EndpointName,
    destination: EndpointName,
    payload: JsonObject,
    options: SendOptions = {},
  ): Promise<SendReceipt> {
    if (this.#hostState !== "Running") {
      throw new AgpError("NOT_RUNNING", "node.send", "node is not running");
    }
    if (!isEndpointName(source) || !isEndpointName(destination)) {
      throw new AgpError("ENDPOINT_INVALID", "node.send", "invalid endpoint");
    }
    if (!isJsonObject(payload)) {
      throw new AgpError("PAYLOAD_NOT_JSON", "node.send", "payload is not JSON");
    }
    if (
      options.correlationId !== undefined
      && !isCorrelationId(options.correlationId)
    ) {
      throw new AgpError(
        "CORRELATION_INVALID",
        "node.send",
        "invalid correlation identifier",
      );
    }
    if (
      options.timeoutMs !== undefined
      && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0)
    ) {
      throw new AgpError("OPTIONS_INVALID", "node.send", "invalid timeoutMs");
    }
    if (options.signal?.aborted) {
      throw new AgpError("ABORTED", "node.send", "send aborted");
    }
    try {
      return await this.#dataPlane.send(
        source,
        destination,
        payload,
        options.correlationId,
      );
    } catch (error) {
      if (error instanceof DataPlaneFailure) {
        throw new AgpError(error.code, "node.send", error.message);
      }
      throw error;
    }
  }

  nextMessageId(): MessageId {
    const value = this.#nextIdentifier("message");
    if (!isMessageId(value)) {
      throw new AgpError("INTERNAL", "node.identifier", "invalid message ID source");
    }
    return value;
  }

  nextContinuationId(): string {
    return this.#nextIdentifier("continuation");
  }

  retainIdentity(
    controller: PeerController,
    owner: ExactSessionOwner,
  ): { readonly winner: boolean } {
    const incumbent = [...this.#controllers.values()].find(
      (candidate) =>
        candidate.controllerId !== controller.controllerId
        && safeRemoteNode(candidate) === owner.remoteNodeId
        && !candidate.state.stopped,
    );
    if (incumbent === undefined) {
      this.#controllerByPair.set(
        pairKey(owner.remoteNodeId, owner.localSessionId),
        controller,
      );
      return Object.freeze({ winner: true });
    }
    const comparison = compareConnectionCandidates({
      ...owner,
      localNodeId: this.nodeId,
      direction: controller.state.direction,
    }, {
      ...incumbent.owner,
      localNodeId: this.nodeId,
      direction: incumbent.state.direction,
    });
    if (comparison < 0) {
      incumbent.terminate("ADJACENCY_COLLISION");
      this.#controllerByPair.set(
        pairKey(owner.remoteNodeId, owner.localSessionId),
        controller,
      );
      return Object.freeze({ winner: true });
    }
    return Object.freeze({ winner: false });
  }

  identityCommitted(controller: PeerController): void {
    this.#controllerByPair.set(
      pairKey(controller.owner.remoteNodeId, controller.owner.localSessionId),
      controller,
    );
  }

  established(controller: PeerController): void {
    const negotiated = controller.state.negotiated;
    if (negotiated === undefined) {
      controller.terminate("INVALID_MESSAGE");
      return;
    }
    const mutation = this.#routing.establishSession({
      owner: controller.owner,
      maxPathLength: negotiated.maxPathLength,
      maxRoutesPerSnapshot: negotiated.maxRoutesPerSnapshot,
    });
    const evidence = this.#sessionEvidence.get(controller.controllerId);
    if (evidence !== undefined) {
      evidence.establishedAt = this.clock.wallTime();
      evidence.establishedMonotonicMs = this.clock.monotonicMs();
    }
    this.#applyRoutingMutation(mutation, {
      kind: "session.established",
      subjectId: controller.controllerId,
    });
  }

  applyRouteSnapshot(
    controller: PeerController,
    message: import("@agp/protocol").RouteUpdateMessage,
    policyDecisions: readonly ImportPolicyDecision[],
  ): RouteImportResult {
    const result = this.#routing.importSnapshot({
      owner: controller.owner,
      updateId: message.id,
      revision: message.body.revision,
      routes: message.body.routes,
      policyDecisions,
    });
    if (result.ok) {
      this.#applyRoutingMutation(result.mutation, {
        kind: "route.imported",
        subjectId: controller.controllerId,
      });
    }
    return result;
  }

  acceptRouteAck(
    controller: PeerController,
    message: import("@agp/protocol").RouteAckMessage,
  ): boolean {
    const result = this.#routing.acknowledgeExport({
      owner: controller.owner,
      refId: message.body.refId,
      revision: message.body.revision,
      rejected: message.body.rejected,
    });
    if (!result.ok) return false;
    this.#applyRoutingMutation(result.mutation, {
      kind: "route.export-acked",
      subjectId: controller.controllerId,
    });
    return true;
  }

  outstandingRouteUpdate(controller: PeerController) {
    const value = this.#routing.routeExportState(controller.controllerId)
      ?.outstanding;
    return value === undefined
      ? undefined
      : { id: value.id, revision: value.revision };
  }

  routesChanged(_controller: PeerController): void {
    // Every core routing mutation already derives all affected peer exports.
  }

  purgeSession(controller: PeerController): void {
    const mutation = this.#routing.removeSession(controller.controllerId);
    if (mutation !== undefined) {
      this.#applyRoutingMutation(mutation, {
        kind: "session.routes-purged",
        subjectId: controller.controllerId,
      });
    }
  }

  controllerReleased(controller: PeerController, reason: string): void {
    void this.executor.run(() => {
      this.#controllers.delete(controller.controllerId);
      this.#sessionEvidence.delete(controller.controllerId);
      const remote = safeRemoteNode(controller);
      if (remote !== undefined) {
        const key = pairKey(remote, controller.owningSessionId);
        if (this.#controllerByPair.get(key)?.controllerId === controller.controllerId) {
          this.#controllerByPair.delete(key);
        }
      }
      const removed = this.#breadcrumbs.removeForController(controller);
      this.#discardedMessages += BigInt(
        removed.asIngress.length + removed.asEgress.length,
      );
      const mutation = this.#routing.removeSession(controller.controllerId);
      if (mutation !== undefined) this.#applyRoutingMutation(mutation);
      const closedReason = controller.state.lastReason ?? "TransportFailed";
      const terminal = controller.lastTransportTerminal;
      this.#commitCanonical(remote === undefined
        ? {
            kind: "connection.preidentity-closed",
            subjectId: controller.owningSessionId,
            data: {
              localSessionId: controller.owningSessionId,
              direction: controller.state.direction,
              reason: closedReason,
              ...(terminal === undefined ? {} : { terminal }),
            },
          }
        : {
            kind: "session.closed",
            subjectId: `${remote}@${controller.owningSessionId}`,
            data: {
              remoteNodeId: remote,
              localSessionId: controller.owningSessionId,
              reason: closedReason,
              ...(terminal === undefined ? {} : { terminal }),
            },
          });
      if (
        this.#hostState === "Running"
        && controller.state.acquisition.kind === "dial"
        && !["Stop", "CEASE", "INVALID_MESSAGE", "IDENTITY_REJECTED"].includes(reason)
      ) {
        const adjacencyId = controller.state.acquisition.adjacencyId;
        const peer = this.#config.peers.find(
          (candidate) => candidate.adjacencyId === adjacencyId,
        );
        if (peer !== undefined) this.#scheduleDial(peer);
      }
    });
  }

  sessionTransitioned(
    controller: PeerController,
    previous: import("@agp/core").PeerSessionState,
  ): void {
    const now = this.clock.wallTime();
    const current = controller.state;
    const prior = this.#sessionEvidence.get(controller.controllerId);
    const event = current.lastEvent ?? (
      current.direction === "outbound" ? "StartDial" : "StartAccept"
    );
    this.#sessionEvidence.set(controller.controllerId, {
      stateSince: current.state === previous.state
        ? prior?.stateSince ?? now
        : now,
      ...(prior?.establishedAt === undefined
        ? {}
        : { establishedAt: prior.establishedAt }),
      ...(prior?.establishedMonotonicMs === undefined
        ? {}
        : { establishedMonotonicMs: prior.establishedMonotonicMs }),
      lastTransition: {
        event,
        from: previous.state,
        to: current.state,
        at: now,
        ...(current.lastReason === undefined
          ? {}
          : { reasonCode: current.lastReason }),
      },
    });
    // The snapshot records every self-transition, because `LAST_EVENT` must
    // show that a session is processing keepalives and data even while its
    // state name does not move. The event stream does not.
    //
    // A delivered message already announces itself three times, so a fourth
    // event saying the session stayed Established tells a subscriber nothing
    // the other three did not, and it is the only one of the four whose rate
    // is set by traffic rather than by anything happening. A self-transition
    // driven by a keepalive is kept: it is the sole sign of life on an idle
    // session, and the keepalive timer already bounds it to a few a minute.
    const announced = current.state !== previous.state
      || event !== "DataReceived";
    this.#commitSessionState(
      announced
        ? { kind: "session.transition", subjectId: controller.controllerId }
        : undefined,
    );
  }

  sessionTimersChanged(_controller: PeerController): void {
    this.#commitSessionState();
  }

  dispatchData(controller: PeerController, message: DataMessage): void {
    void this.#dispatchInbound(controller, this.admitData(controller, message));
  }

  dispatchError(controller: PeerController, message: ErrorMessage): void {
    void this.#dispatchInbound(
      controller,
      this.receiveDeliveryError(controller, message),
    );
  }

  /**
   * Carries an inbound dispatch to a disposition rather than discarding it.
   *
   * These were fired with `void`, so anything that rejected here rejected into
   * nothing and ended the process. The reachable case is a reverse error that
   * cannot be enqueued: a receiver refusing deliveries emits one control
   * message per refusal, and a refusal burst fills the control queue.
   *
   * A session whose control writes are failing cannot carry the protocol, so
   * it is terminated. That is the disposition every other failed control write
   * already takes, and it bounds the fault to one session instead of the
   * process. See `MX6`.
   */
  async #dispatchInbound(
    controller: PeerController,
    work: Promise<void>,
  ): Promise<void> {
    try {
      await work;
    } catch (cause) {
      this.#emitDiagnostic(
        this.#captureDiagnostic(
          this.#operations.currentRevision,
          "protocol",
          "error",
          "INBOUND_DISPATCH_FAILED",
        ),
        cause,
      );
      controller.terminate("TransportFailed");
    }
  }

  /** Registry-owned ingress admission entry point. */
  async admitData(
    ingress: PeerController,
    message: DataMessage,
  ): Promise<void> {
    await this.admitTransit(ingress, message);
  }

  /** Registry-owned uniform local/transit RIB-gated admission. */
  async admitTransit(
    ingress: PeerController,
    message: DataMessage,
  ): Promise<void> {
    await this.#dataPlane.receive(ingress, message);
    this.#commitReverseOnly();
  }

  /** Registry-owned feasible-path ingress source authorization. */
  authorizeIngressSource(
    ingress: PeerController,
    source: EndpointSource,
  ): boolean {
    return this.#routing.feasibleSource({
      owner: ingress.owner,
      endpoint: source.endpoint,
      originNodeId: source.originNodeId,
    });
  }

  /** Registry-owned exact ACKed source export barrier. */
  requireSourceExport(
    egress: PeerController,
    source: EndpointSource,
  ): boolean {
    return this.#routing.hasAckedSource({
      owner: egress.owner,
      endpoint: source.endpoint,
      originNodeId: source.originNodeId,
    });
  }

  /** Registry-owned returned-error handling; it has no destination RIB input. */
  async receiveDeliveryError(
    egress: PeerController,
    message: ErrorMessage,
  ): Promise<void> {
    await this.#reverseErrors.receive(egress, message);
    this.#commitReverseOnly();
  }

  /** Registry-owned exact-controller/token/refId breadcrumb consumption. */
  consumeBreadcrumb(
    egress: PeerController,
    body: DeliveryErrorBody,
  ) {
    return this.#breadcrumbs.consume(
      egress,
      body.returnToken,
      body.refId,
      this.clock.monotonicMs(),
    );
  }

  async #start(options: StartOptions): Promise<StartedNode> {
    await this.executor.run(() => {
      this.#hostState = "Starting";
      this.#operations.commit({
        lifecycle: {
          state: "Starting",
          stateSince: this.clock.wallTime(),
        },
        listener: this.#listenerSnapshot(
          this.#config.listen === undefined ? "disabled" : "starting",
        ),
        events: [{ kind: "lifecycle.starting", subjectId: this.nodeId }],
      });
    });
    if (options.signal?.aborted) {
      throw new AgpError("ABORTED", "node.start", "start aborted");
    }

    try {
      if (
        this.#config.listen !== undefined
        && this.#listenerCapability !== undefined
      ) {
        this.#listener = await this.#listenerCapability.listen({
          limits: {
            maxPendingAcquisitions: this.#config.maxPendingHandshakes,
            maxActiveChannels: this.#config.maxSessions,
            channel: this.#config.channelLimits,
          },
        }, {
          accept: ({ channel }) => {
            this.#accept(channel);
          },
          capacityRejected: () => {
            this.#operations.commit({
              incrementCounters: { "capacity.session_rejected": 1 },
            });
          },
        }, options.signal ?? new AbortController().signal);
        void this.#listener.waitTerminal(this.#listenerWatchAbort.signal).then(
          (terminal) => this.#listenerEnded(terminal),
          (error: unknown) => {
            if (!this.#listenerWatchAbort.signal.aborted) {
              void this.#listenerWatchFailed(error);
            }
          },
        );
      }
      for (const peer of this.#config.peers) void this.#dial(peer);
      return await this.executor.run(() => {
        // The listener may terminalize while start is still in flight. Both
        // that observation and this commit run inside the serialized executor,
        // so whichever lands first is authoritative. Committing Running over an
        // already-failed host would publish a listening node with a dead
        // listener and silently discard its failure counters.
        if (
          this.#hostState === "Failed"
          || this.#listenerTerminal !== undefined
        ) {
          throw new AgpError(
            "TRANSPORT_FAILURE",
            "node.start",
            "listener terminalized during start",
          );
        }
        const startedAt = this.clock.wallTime();
        this.#hostState = "Running";
        const snapshot = this.#operations.commit({
          lifecycle: {
            state: "Running",
            stateSince: startedAt,
            startedAt,
          },
          listener: this.#listenerSnapshot(
            this.#listener === undefined ? "disabled" : "listening",
          ),
          adjacencies: this.#adjacencySnapshots(),
          incrementCounters: { "lifecycle.started": 1 },
          events: [{ kind: "lifecycle.running", subjectId: this.nodeId }],
        });
        const result = Object.freeze({
          nodeId: this.nodeId,
          instanceId: snapshot.instanceId,
          startedAt,
          ...(this.#listener === undefined
            ? {}
            : {
                listener: {
                  transportRef: this.#config.listen?.transportRef as never,
                  publication: this.#listener.publication,
                },
              }),
          operationsRevision: snapshot.revision,
        });
        this.#started = result;
        return result;
      });
    } catch (error) {
      let diagnostic: DiagnosticRecord | undefined;
      await this.executor.run(() => {
        if (this.#hostState === "Failed") return;
        this.#hostState = "Failed";
        const snapshot = this.#operations.commit({
          lifecycle: {
            state: "Failed",
            stateSince: this.clock.wallTime(),
            failure: { code: "START_FAILED" },
          },
          listener: this.#listenerSnapshot("terminal"),
          incrementCounters: {
            "lifecycle.failed": 1,
            "transport.error": 1,
          },
        });
        diagnostic = this.#captureDiagnostic(
          snapshot.revision,
          "lifecycle",
          "error",
          "START_FAILED",
        );
        this.#operations.terminateEvents();
      });
      if (diagnostic !== undefined) this.#emitDiagnostic(diagnostic, error);
      throw error;
    }
  }

  async #stop(options: StopOptions): Promise<StopReport> {
    await this.executor.run(() => {
      if (this.#hostState === "Stopped" && this.#stopped !== undefined) return;
      this.#hostState = "Stopping";
      const bindings = this.#endpoints.closeAll();
      for (const binding of bindings) {
        const mutation = this.#routing.removeLocal(binding.bindingId);
        if (mutation !== undefined) this.#applyRoutingMutation(mutation);
      }
      this.#operations.commit({
        lifecycle: {
          state: "Stopping",
          stateSince: this.clock.wallTime(),
          ...(this.#started === undefined
            ? {}
            : { startedAt: this.#started.startedAt }),
        },
        localEndpoints: [],
      });
    });
    for (const timer of this.#adjacencyTimers.values()) timer.cancel();
    this.#adjacencyTimers.clear();
    const drain = Promise.all([
      ...[...this.#controllers.values()].map((controller) =>
        controller.writer.drain()),
      this.#handlers.drain(),
    ]);
    const timeout = options.drainTimeoutMs ?? 5_000;
    const drained = await settleWithin(drain, timeout);
    if (!drained) {
      for (const controller of this.#controllers.values()) {
        this.#discardedMessages += BigInt(controller.writer.stop("stop deadline"));
      }
    }
    for (const controller of [...this.#controllers.values()]) {
      controller.terminate("Stop");
    }
    if (this.#listener !== undefined) {
      this.#listenerWatchAbort.abort("node-owned listener teardown");
      this.#listenerTerminal = await this.#listener.close(
        options.signal ?? new AbortController().signal,
      );
    }
    return this.executor.run(() => {
      this.#hostState = "Stopped";
      this.#breadcrumbs.clear();
      const stoppedAt = this.clock.wallTime();
      const snapshot = this.#operations.commit({
        lifecycle: {
          state: "Stopped",
          stateSince: stoppedAt,
          ...(this.#started === undefined
            ? {}
            : { startedAt: this.#started.startedAt }),
          stoppedAt,
        },
        listener: this.#listenerSnapshot(
          this.#config.listen === undefined ? "disabled" : "stopped",
        ),
        reverseCorrelations: [],
        incrementCounters: { "lifecycle.stopped": 1 },
        events: [{ kind: "lifecycle.stopped", subjectId: this.nodeId }],
      });
      const report = Object.freeze({
        operationsRevision: snapshot.revision,
        stoppedAt,
        drainedMessages: drained ? "0" : "0",
        discardedMessages: this.#discardedMessages.toString(10),
      });
      this.#stopped = report;
      this.#operations.terminateEvents();
      return report;
    });
  }

  async #listenerEnded(
    terminal: TransportListenerTerminal,
    cause?: unknown,
  ): Promise<void> {
    let failControllers = false;
    let diagnostic: DiagnosticRecord | undefined;
    await this.executor.run(() => {
      this.#listenerTerminal = terminal;
      if (
        this.#hostState === "Stopping"
        || this.#hostState === "Stopped"
        || this.#hostState === "Failed"
      ) {
        return;
      }
      this.#hostState = "Failed";
      failControllers = true;
      const snapshot = this.#operations.commit({
        lifecycle: {
          state: "Failed",
          stateSince: this.clock.wallTime(),
          failure: {
            code: "LISTENER_TERMINAL",
            terminal,
          },
        },
        listener: this.#listenerSnapshot("terminal"),
        incrementCounters: {
          "lifecycle.failed": 1,
          "transport.listener_terminal": 1,
        },
      });
      diagnostic = this.#captureDiagnostic(
        snapshot.revision,
        "transport",
        "critical",
        "LISTENER_TERMINAL",
      );
      this.#operations.terminateEvents();
    });
    if (diagnostic !== undefined) this.#emitDiagnostic(diagnostic, cause);
    if (failControllers) {
      for (const controller of [...this.#controllers.values()]) {
        controller.terminate("TransportFailed");
      }
    }
  }

  async #listenerWatchFailed(error: unknown): Promise<void> {
    await this.#listenerEnded({
      origin: "carrier",
      kind: "adapter-fault",
      diagnostic: { code: "LISTENER_TERMINAL_OBSERVATION_FAILED" },
    }, error);
  }

  #accept(channel: TransportChannelPort): void {
    if (this.#hostState !== "Starting" && this.#hostState !== "Running") {
      channel.abort({ kind: "forced-stop", code: "NODE_NOT_ACCEPTING" });
      return;
    }
    if (this.#controllers.size >= this.#config.maxSessions) {
      channel.abort({ kind: "capacity", code: "SESSION_CAPACITY" });
      return;
    }
    void this.#createController(
      channel,
      { kind: "accept", listenerId: "listener" },
    );
  }

  async #dial(peer: PeerConfig): Promise<void> {
    if (this.#hostState !== "Starting" && this.#hostState !== "Running") return;
    const capability = this.#targetCapabilities.get(peer.adjacencyId);
    if (capability === undefined) return;
    try {
      const channel = await capability.connect({
        channel: this.#config.channelLimits,
      }, new AbortController().signal);
      await this.#createController(
        channel,
        { kind: "dial", adjacencyId: peer.adjacencyId },
        peer.expectedNodeId,
      );
      this.#adjacencyAttempts.set(peer.adjacencyId, 0);
    } catch (error) {
      this.#scheduleDial(peer);
      const diagnostic = this.#captureDiagnostic(
        this.#operations.currentRevision,
        "transport",
        "warning",
        isTransportOperationError(error)
          ? error.code
          : "CONNECT_FAILED",
      );
      this.#emitDiagnostic(
        diagnostic,
        isTransportOperationError(error) ? error.cause : error,
      );
    }
  }

  #scheduleDial(peer: PeerConfig): void {
    if (this.#hostState !== "Running" && this.#hostState !== "Starting") return;
    const policy = peer.reconnect ?? {
      enabled: true,
      initialDelayMs: 250,
      maximumDelayMs: 5_000,
      multiplier: 2,
    };
    if (policy.enabled === false) return;
    const attempt = this.#adjacencyAttempts.get(peer.adjacencyId) ?? 0;
    const delay = Math.min(
      policy.maximumDelayMs,
      Math.floor(policy.initialDelayMs * (policy.multiplier ?? 2) ** attempt),
    );
    this.#adjacencyAttempts.set(peer.adjacencyId, attempt + 1);
    this.#adjacencyTimers.get(peer.adjacencyId)?.cancel();
    this.#adjacencyTimers.set(
      peer.adjacencyId,
      this.clock.schedule(delay, () => {
        this.#adjacencyTimers.delete(peer.adjacencyId);
        void this.#dial(peer);
      }),
    );
  }

  async #createController(
    channel: TransportChannelPort,
    acquisition: import("@agp/core").Acquisition,
    expectedNodeId?: NodeId,
  ): Promise<void> {
    const controllerId = this.#nextIdentifier("controller");
    const localSessionId = this.#nextSessionId();
    const config: SessionRuntimeConfig = {
      localOpen: this.#localOpen(localSessionId),
      openTimeoutMs: this.#config.openTimeoutMs,
      routeAckTimeoutMs: this.#config.routeAckTimeoutMs,
      transportCloseTimeoutMs: this.#config.transportCloseTimeoutMs,
      writer: {
        maximumQueuedDataMessages: this.#config.dataQueueMessages,
        maximumQueuedDataBytes: this.#config.dataQueueBytes,
        maximumQueuedControlMessages: this.#config.controlQueueMessages,
      },
      ...(this.#config.credit === undefined
        ? {}
        : { credit: this.#config.credit }),
      ...(expectedNodeId === undefined ? {} : { expectedNodeId }),
    };
    const controller = new PeerController({
      host: this,
      channel,
      acquisition,
      controllerId,
      localSessionId,
      config,
      returnTokens: new ReturnTokenAllocator(),
    });
    this.#controllers.set(controllerId, controller);
    const now = this.clock.wallTime();
    this.#sessionEvidence.set(controllerId, {
      stateSince: now,
      lastTransition: {
        event: acquisition.kind === "dial" ? "StartDial" : "StartAccept",
        from: "Idle",
        to: "Idle",
        at: now,
      },
    });
    await controller.start();
  }

  #localOpen(sessionId: SessionId): OpenBody {
    return {
      nodeId: this.nodeId,
      sessionId,
      holdTimeMs: this.#config.holdTimeMs,
      receiveLimitBytes: this.#config.receiveLimitBytes,
      maxRoutesPerSnapshot: this.#config.maxRoutesPerSnapshot,
      maxPathLength: this.#config.maxPathLength,
      maxDataHopLimit: this.#config.maxHopCount,
      transit: this.#config.transitEnabled,
    };
  }

  #applyRoutingMutation(
    mutation: RoutingMutationResult,
    event?: OperationalEventInput,
  ): void {
    for (const closure of mutation.closedEpochs) {
      this.#controllers.get(closure.controllerId)?.writer.closeEpochs([
        epochKey(
          closure.controllerId,
          closure.endpoint,
          closure.originNodeId,
          closure.epoch,
        ),
      ]);
    }
    this.#operations.commit({
      localEndpoints: this.#localEndpointSnapshots(),
      connections: this.#connectionSnapshots(),
      routing: this.#routing.snapshot(),
      reverseCorrelations: this.#reverseSnapshots(),
      ...(event === undefined ? {} : { events: [event] }),
    });
    for (const update of mutation.outboundUpdates) {
      this.#controllers.get(update.owner.controllerId)?.sendRouteUpdate(update);
    }
  }

  /**
   * Commits a change to session state alone.
   *
   * A session transition and a timer reset each land on every delivered
   * message, and neither can alter routing, endpoints or adjacencies. A full
   * canonical commit for them made a message pay twice over for four
   * collections it never touched. Omitted collections are left as they stand,
   * so this narrows what is written rather than what is held.
   *
   * Routing changes keep their own commit, so `D10` still gets one canonical
   * revision per routing change; this adds none and removes none.
   */
  #commitSessionState(event?: OperationalEventInput): void {
    this.#operations.commit({
      connections: this.#connectionSnapshots(),
      ...(event === undefined ? {} : { events: [event] }),
    });
  }

  #commitCanonical(event?: OperationalEventInput): void {
    this.#operations.commit({
      localEndpoints: this.#localEndpointSnapshots(),
      connections: this.#connectionSnapshots(),
      routing: this.#routing.snapshot(),
      reverseCorrelations: this.#reverseSnapshots(),
      adjacencies: this.#adjacencySnapshots(),
      ...(event === undefined ? {} : { events: [event] }),
    });
  }

  #commitReverseOnly(): void {
    this.#operations.commit({
      reverseCorrelations: this.#reverseSnapshots(),
    });
  }

  #commitMessageOutcome(
    kind: Parameters<DataPlaneCommitPort["commit"]>[0]["kind"],
    messageId: MessageId,
    code?: DeliveryErrorCode,
  ): OperationsRevision {
    const event: OperationalEventInput = kind === "message.failed"
      ? {
          kind,
          subjectId: messageId,
          ...(code === undefined ? {} : { data: { code } }),
        }
      : { kind, subjectId: messageId };
    const snapshot = this.#operations.commit({
      reverseCorrelations: this.#reverseSnapshots(),
      incrementCounters: {
        [kind === "message.failed" ? "message.rejected_before_admission" : kind]: 1,
      },
      events: [event],
    });
    return snapshot.revision;
  }

  #closeBinding(bindingId: string): void {
    const binding = this.#endpoints.remove(bindingId);
    if (binding === undefined) return;
    const mutation = this.#routing.removeLocal(bindingId);
    if (mutation !== undefined) {
      this.#applyRoutingMutation(mutation, {
        kind: "endpoint.closed",
        subjectId: binding.endpoint,
      });
    }
  }

  /**
   * The local-endpoint projection, rebuilt only when the set changes.
   *
   * Two full canonical commits land per delivered message, and this changes
   * on `expose` and `close` alone. Rebuilding it per commit made a message
   * pay for a set it never touched. Same construction as routing and
   * breadcrumbs: memoise against an exact change signal. See `D21`.
   */
  #localEndpointSnapshots(): readonly LocalEndpointSnapshot[] {
    const version = this.#endpoints.version;
    const cached = this.#endpointListCache;
    if (cached !== undefined && cached.version === version) return cached.value;
    const value = this.#buildLocalEndpointSnapshots();
    this.#endpointListCache = { version, value };
    return value;
  }

  #buildLocalEndpointSnapshots(): readonly LocalEndpointSnapshot[] {
    return [...this.#endpoints.values()].map((binding) => ({
      endpoint: binding.endpoint,
      bindingId: binding.bindingId,
      registeredAt: binding.registeredAt,
      active: true,
    }));
  }

  #connectionSnapshots(): readonly {
    readonly controllerId: string;
    readonly snapshot: ConnectionOperationalInput;
  }[] {
    return [...this.#controllers.values()].map((controller) => {
      const evidence = this.#sessionEvidence.get(controller.controllerId);
      const state = controller.state;
      const queues = controller.writer.usage();
      const token = controller.returnTokens.snapshot();
      const remoteNodeId = safeRemoteNode(controller);
      const common = {
        direction: state.direction,
        state: state.state,
        stateSince: evidence?.stateSince ?? this.clock.wallTime(),
        lastTransition: evidence?.lastTransition ?? {
          event: state.direction === "outbound" ? "StartDial" : "StartAccept",
          from: "Idle" as const,
          to: state.state,
          at: this.clock.wallTime(),
        },
        timers: controller.timerRuntimeInputs(),
        queues: {
          control: queueSnapshot(
            queues.controlMessages,
            this.#config.controlQueueMessages,
            0,
            this.#config.dataQueueBytes,
          ),
          data: queueSnapshot(
            queues.dataMessages,
            this.#config.dataQueueMessages,
            queues.dataBytes,
            this.#config.dataQueueBytes,
          ),
          continuation: queueSnapshot(0, 1, 0, 1),
        },
        ...(controller.latencySnapshot === undefined
          ? {}
          : { latency: controller.latencySnapshot }),
        ...(controller.creditSnapshot === undefined
          ? {}
          : { credit: controller.creditSnapshot }),
        ...(controller.lastTransportTerminal === undefined
          ? {}
          : { lastTransportTerminal: controller.lastTransportTerminal }),
      };
      if (remoteNodeId === undefined) {
        const snapshot: ConnectionOperationalInput = {
          identityState: "pending",
          localSessionId: controller.owningSessionId,
          ...common,
          ...(state.acquisition.kind === "dial"
            ? { adjacencyId: state.acquisition.adjacencyId }
            : {}),
        };
        return { controllerId: controller.controllerId, snapshot };
      }
      const snapshot: SessionOperationalInput = {
        identityState: "admitted",
        sessionId: controller.owningSessionId,
        remoteNodeId,
        ...(state.remoteSessionId === undefined
          ? {}
          : { remoteSessionId: state.remoteSessionId }),
        ...common,
        ...(evidence?.establishedAt === undefined
          ? {}
          : { establishedAt: evidence.establishedAt }),
        ...(evidence?.establishedMonotonicMs === undefined
          ? {}
          : { establishedMonotonicMs: evidence.establishedMonotonicMs }),
        ...(state.negotiated === undefined
          ? {}
          : {
              negotiated: {
                holdTimeMs: state.negotiated.holdTimeMs,
                keepaliveTimeMs: state.negotiated.keepaliveTimeMs,
                peerReceiveLimitBytes: state.negotiated.peerReceiveLimitBytes,
                maxRoutesPerSnapshot: state.negotiated.maxRoutesPerSnapshot,
                maxPathLength: state.negotiated.maxPathLength,
                maxHopCount: state.negotiated.maxHopCount,
                transit: state.negotiated.transit,
              },
            }),
        routeImport: this.#routing.routeImportState(controller.controllerId) ?? {
          consumedRevision: 0 as never,
          routeCount: 0,
        },
        routeExport: this.#routing.routeExportState(controller.controllerId) ?? {
          routeDecisions: [],
          nextRevision: 1 as never,
        },
        returnTokenAllocator: {
          allocated: token.allocationCount,
          exhausted: token.exhausted,
          maximum: "18446744073709551615",
        },
      };
      return { controllerId: controller.controllerId, snapshot };
    });
  }

  /**
   * The reverse-correlation projection, built once per breadcrumb.
   *
   * A breadcrumb never changes after admission, so its projection never needs
   * rebuilding. It used to be rebuilt on every committed message, against the
   * whole live set, and then deep-cloned and re-sorted: quadratic in a stream
   * and the largest single consumer of the event loop. Caching against the
   * entry keeps the write path proportional to what changed. See `D21`.
   */
  #reverseSnapshots(): readonly ReverseCorrelationSnapshot[] {
    const version = this.#breadcrumbs.version;
    const cached = this.#reverseListCache;
    if (cached !== undefined && cached.version === version) return cached.value;
    const value = this.#buildReverseSnapshots();
    this.#reverseListCache = { version, value };
    return value;
  }

  #buildReverseSnapshots(): readonly ReverseCorrelationSnapshot[] {
    return this.#breadcrumbs.snapshot().map((entry) => {
      const cached = this.#reverseProjections.get(entry);
      if (cached !== undefined) return cached;
      const projection = this.#projectBreadcrumb(entry);
      this.#reverseProjections.set(entry, projection);
      return projection;
    });
  }

  #projectBreadcrumb(
    entry: ReturnType<BreadcrumbStore["snapshot"]>[number],
  ): ReverseCorrelationSnapshot {
    return immutableClone({
      messageId: entry.messageId,
      outboundReturnToken: entry.outboundReturnToken,
      source: {
        endpoint: entry.sourceEndpoint as EndpointName,
        originNodeId: entry.sourceOriginNodeId,
      },
      destination: entry.destination as EndpointName,
      ingress: entry.ingress.kind === "local"
        ? { kind: "local" }
        : {
            kind: "session",
            nodeId: entry.ingress.nodeId,
            owningSessionId: entry.ingress.owningSessionId,
            upstreamReturnToken: entry.ingress.upstreamReturnToken,
          },
      egressNodeId: entry.egress.remoteNodeId,
      egressSessionId: entry.egress.owningSessionId,
      admittedAtRevision: entry.admittedAtRevision,
      expiresAt: entry.expiresAt,
    });
  }

  #adjacencySnapshots(): readonly AdjacencySnapshot[] {
    return this.#config.peers.map((peer) => {
      const active = [...this.#controllers.values()].find(
        (controller) =>
          controller.state.acquisition.kind === "dial"
          && controller.state.acquisition.adjacencyId === peer.adjacencyId
          && controller.isLive(),
      );
      const attempt = this.#adjacencyAttempts.get(peer.adjacencyId) ?? 0;
      return {
        adjacencyId: peer.adjacencyId,
        expectedNodeId: peer.expectedNodeId,
        transportRef: peer.transportRef,
        desired: this.#hostState !== "Stopping" && this.#hostState !== "Stopped",
        state: active !== undefined
          ? "satisfied"
          : this.#adjacencyTimers.has(peer.adjacencyId)
          ? "retry-wait"
          : "dialing",
        ...(active === undefined
          ? {}
          : { activeControllerId: active.controllerId }),
        retryAttempt: attempt,
      };
    });
  }

  #listenerSnapshot(
    state: ListenerSnapshot["state"],
  ): ListenerSnapshot {
    return {
      configured: this.#config.listen !== undefined,
      ...(this.#config.listen === undefined
        ? {}
        : { transportRef: this.#config.listen.transportRef }),
      state: this.#config.listen === undefined ? "disabled" : state,
      ...(this.#listener === undefined
        ? {}
        : { publication: this.#listener.publication }),
      ...(this.#listenerTerminal === undefined
        ? {}
        : { terminal: this.#listenerTerminal }),
    };
  }

  #captureDiagnostic(
    operationsRevision: OperationsRevision,
    domain: DiagnosticRecord["domain"],
    severity: DiagnosticRecord["severity"],
    code: string,
  ): DiagnosticRecord {
    return Object.freeze({
      schemaVersion: "agp.diagnostic/v1",
      nodeId: this.nodeId,
      instanceId: this.#instanceId,
      occurredAt: this.clock.wallTime(),
      operationsRevision,
      domain,
      severity,
      code,
    });
  }

  #emitDiagnostic(record: DiagnosticRecord, cause?: unknown): void {
    try {
      this.#diagnostics?.emit(record, cause);
    } catch {
      // Diagnostics are supplementary observation and cannot alter canonical
      // state or recursively diagnose a failing sink.
    }
  }

  #nextIdentifier(scope: IdScope): string {
    const value = this.#ids.next(scope);
    if (typeof value !== "string" || value.length === 0) {
      throw new AgpError("INTERNAL", "node.identifier", `invalid ${scope} ID`);
    }
    return value;
  }

  #nextSessionId(): SessionId {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const candidate = this.#ids.next("session");
      // Session identifiers are public only as (remoteNodeId, sessionId).
      // Allocation precedes identity admission for accepted transports, so
      // global pre-reservation would incorrectly forbid the same value on
      // distinct node pairs. Exact same-peer collisions are resolved when
      // OPEN commits the remote identity.
      if (isSessionId(candidate)) return candidate;
    }
    throw new AgpError("INTERNAL", "node.identifier", "session ID space unavailable");
  }
}

class CryptoIdSource implements IdSourcePort {
  next(scope: IdScope): string {
    if (scope === "session") return randomBytes(3).toString("hex");
    return `${scope}-${randomUUID()}`;
  }
}

const ALLOW_IDENTITY: IdentityAdmissionPort = Object.freeze({
  async evaluate(): Promise<import("@agp/core").IdentityAdmissionResult> {
    return { decision: "allow" as const };
  },
});

const ALLOW_ROUTES: RouteAdmissionPort = Object.freeze({
  async evaluate(
    request: import("@agp/core").RouteAdmissionRequest,
  ): Promise<import("@agp/core").RouteAdmissionResult> {
    return {
      decisions: request.routes.map((route) => ({
        endpoint: route.endpoint,
        originNodeId: route.originNodeId,
        path: route.path,
        decision: "allow" as const,
      })),
    };
  },
});

function resolveConfig(config: NodeConfig): EffectiveConfig {
  if (typeof config !== "object" || config === null || !isNodeId(config.nodeId)) {
    throw new AgpError("CONFIG_INVALID", "createNode", "invalid nodeId");
  }
  const peers = Object.freeze([...(config.peers ?? [])]);
  validatePeerAdjacencyUniqueness(peers);
  for (const peer of peers) {
    if (
      typeof peer.adjacencyId !== "string"
      || peer.adjacencyId.length === 0
      || !isNodeId(peer.expectedNodeId)
      || peer.expectedNodeId === config.nodeId
    ) {
      throw new AgpError("CONFIG_INVALID", "createNode", "invalid peer identity");
    }
  }
  const receiveLimitBytes = ranged(
    config.limits?.receiveLimitBytes
      ?? AGP_V1_LIMITS.defaultReceiveBytes,
    AGP_V1_LIMITS.minReceiveBytes,
    AGP_V1_LIMITS.maxReceiveBytes,
    "limits.receiveLimitBytes",
  );
  const transportReceivePackets = positive(
    config.capacity?.transportReceivePackets ?? 64,
    "capacity.transportReceivePackets",
  );
  const transportReceiveBytes = positive(
    config.capacity?.transportReceiveBytes
      ?? Math.max(receiveLimitBytes, 4_194_304),
    "capacity.transportReceiveBytes",
  );
  if (transportReceiveBytes < receiveLimitBytes) {
    throw new AgpError(
      "CONFIG_INVALID",
      "createNode",
      "capacity.transportReceiveBytes must admit one maximum packet",
    );
  }
  const creditCapacity = resolveCreditCapacity(
    transportReceivePackets,
    transportReceiveBytes,
    receiveLimitBytes,
  );
  return Object.freeze({
    raw: config,
    nodeId: config.nodeId,
    ...(config.listen === undefined ? {} : { listen: config.listen }),
    peers,
    transitEnabled: config.transit?.enabled ?? false,
    defaultHopLimit: ranged(
      config.transit?.defaultHopLimit ?? 16,
      1,
      AGP_V1_LIMITS.maxDataHopLimit,
      "transit.defaultHopLimit",
    ),
    holdTimeMs: ranged(config.timers?.holdTimeMs ?? 30_000, 0, 3_600_000, "timers.holdTimeMs"),
    openTimeoutMs: positive(config.timers?.openTimeoutMs ?? 10_000, "timers.openTimeoutMs"),
    routeAckTimeoutMs: positive(
      config.timers?.routeAckTimeoutMs ?? 10_000,
      "timers.routeAckTimeoutMs",
    ),
    transportWriteTimeoutMs: positive(
      config.timers?.transportWriteTimeoutMs ?? 10_000,
      "timers.transportWriteTimeoutMs",
    ),
    transportCloseTimeoutMs: positive(
      config.timers?.transportCloseTimeoutMs ?? 5_000,
      "timers.transportCloseTimeoutMs",
    ),
    receiveLimitBytes,
    channelLimits: Object.freeze({
      maxPacketBytes: receiveLimitBytes,
      maxBufferedPackets: transportReceivePackets,
      maxBufferedBytes: transportReceiveBytes,
    }),
    ...(creditCapacity === undefined ? {} : { credit: creditCapacity }),
    maxRoutesPerSnapshot: ranged(
      config.limits?.maxRoutesPerSnapshot ?? 256,
      1,
      AGP_V1_LIMITS.maxRoutesPerSnapshot,
      "limits.maxRoutesPerSnapshot",
    ),
    maxPathLength: ranged(
      config.limits?.maxPathLength ?? 64,
      2,
      AGP_V1_LIMITS.maxPathLength,
      "limits.maxPathLength",
    ),
    maxHopCount: ranged(
      config.limits?.maxHopCount ?? 16,
      1,
      AGP_V1_LIMITS.maxDataHopLimit,
      "limits.maxHopCount",
    ),
    maxLocalEndpoints: positive(
      config.limits?.maxLocalEndpoints ?? 256,
      "limits.maxLocalEndpoints",
    ),
    maxCandidateRoutes: positive(
      config.limits?.maxCandidateRoutes ?? 4096,
      "limits.maxCandidateRoutes",
    ),
    maxSessions: positive(config.capacity?.maxSessions ?? 64, "capacity.maxSessions"),
    maxPendingHandshakes: positive(
      config.capacity?.maxPendingHandshakes ?? 64,
      "capacity.maxPendingHandshakes",
    ),
    controlQueueMessages: positive(
      config.capacity?.controlQueueMessages ?? 64,
      "capacity.controlQueueMessages",
    ),
    dataQueueMessages: positive(
      config.capacity?.dataQueueMessages ?? 256,
      "capacity.dataQueueMessages",
    ),
    dataQueueBytes: positive(
      config.capacity?.dataQueueBytes ?? 4_194_304,
      "capacity.dataQueueBytes",
    ),
    maxActiveHandlers: positive(
      config.capacity?.maxActiveHandlers ?? 64,
      "capacity.maxActiveHandlers",
    ),
    maxActiveHandlerBytes: positive(
      config.capacity?.maxActiveHandlerBytes ?? 4_194_304,
      "capacity.maxActiveHandlerBytes",
    ),
    maxReverseCorrelations: positive(
      config.capacity?.maxReverseCorrelations ?? 4096,
      "capacity.maxReverseCorrelations",
    ),
    maxReverseCorrelationBytes: positive(
      (config.capacity?.maxReverseCorrelations ?? 4096) * 2048,
      "capacity.maxReverseCorrelationBytes",
    ),
    maxEventSubscribers: positive(
      config.capacity?.maxEventSubscribers ?? 32,
      "capacity.maxEventSubscribers",
    ),
    eventSubscriberBuffer: positive(
      config.capacity?.eventSubscriberBuffer ?? 1024,
      "capacity.eventSubscriberBuffer",
    ),
    reverseCorrelationLifetimeMs: Math.max(
      30_000,
      config.timers?.holdTimeMs ?? 30_000,
    ),
  });
}

function validatePeerAdjacencyUniqueness(
  peers: readonly PeerConfig[],
): void {
  const seen = new Set<string>();
  for (const peer of peers) {
    if (seen.has(peer.adjacencyId)) {
      throw new AgpError(
        "CONFIG_INVALID",
        "createNode",
        "duplicate adjacencyId",
      );
    }
    seen.add(peer.adjacencyId);
  }
}

function resolveTransportCapabilities(
  config: Pick<EffectiveConfig, "listen" | "peers">,
  transport: PeerTransportPort | undefined,
): Readonly<{
  listener?: TransportListenCapability;
  targets: ReadonlyMap<string, TransportConnectCapability>;
}> {
  let listener: TransportListenCapability | undefined;
  if (config.listen !== undefined) {
    listener = transport?.resolveListener(config.listen.transportRef);
    if (listener === undefined) {
      throw new Error("listener transport reference is not mapped");
    }
  }
  const targets = new Map<string, TransportConnectCapability>();
  for (const peer of config.peers) {
    const capability = transport?.resolveTarget(peer.transportRef);
    if (capability === undefined) {
      throw new Error(
        `peer transport reference is not mapped: ${peer.adjacencyId}`,
      );
    }
    targets.set(peer.adjacencyId, capability);
  }
  return Object.freeze({
    ...(listener === undefined ? {} : { listener }),
    targets,
  });
}

function effectiveDocument(config: EffectiveConfig): JsonObject {
  return jsonClone({
    ...config.raw,
    peers: config.peers,
    transit: {
      enabled: config.transitEnabled,
      defaultHopLimit: config.defaultHopLimit,
    },
    limits: {
      receiveLimitBytes: config.receiveLimitBytes,
      maxRoutesPerSnapshot: config.maxRoutesPerSnapshot,
      maxPathLength: config.maxPathLength,
      maxHopCount: config.maxHopCount,
      maxLocalEndpoints: config.maxLocalEndpoints,
      maxCandidateRoutes: config.maxCandidateRoutes,
    },
    effectiveTransportChannel: config.channelLimits,
  });
}

function jsonClone<T>(value: T): T & JsonObject {
  return JSON.parse(JSON.stringify(value)) as T & JsonObject;
}

function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  try {
    const seen = new Set<object>();
    const visit = (candidate: unknown): boolean => {
      if (candidate === null || typeof candidate === "string" || typeof candidate === "boolean") {
        return true;
      }
      if (typeof candidate === "number") return Number.isFinite(candidate);
      if (typeof candidate !== "object") return false;
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      const values = Array.isArray(candidate)
        ? candidate
        : Object.values(candidate as Record<string, unknown>);
      const valid = values.every(visit);
      seen.delete(candidate);
      return valid;
    };
    return visit(value);
  } catch {
    return false;
  }
}

function pairKey(nodeId: NodeId, sessionId: string): string {
  return `${nodeId}\0${sessionId}`;
}

function safeRemoteNode(controller: PeerController): NodeId | undefined {
  try {
    return controller.remoteNodeId;
  } catch {
    return undefined;
  }
}

function queueSnapshot(
  messages: number,
  maximumMessages: number,
  bytes: number,
  maximumBytes: number,
) {
  return {
    currentMessages: String(messages),
    maximumMessages: String(maximumMessages),
    highWaterMessages: String(messages),
    currentBytes: String(bytes),
    maximumBytes: String(maximumBytes),
    highWaterBytes: String(bytes),
  };
}

/**
 * The data ceiling a node offers a peer, derived from the ring it gave its
 * adapter and reduced by a reserve it keeps for control.
 *
 * The reserve is what makes the arrangement deadlock free. A node whose send
 * queue is stalled on credit must still be able to announce the room its own
 * reads have made, and that announcement needs somewhere to land in the
 * peer's ring that the peer's data grant has not already promised away.
 *
 * Control is otherwise ungoverned, exactly as it is today. Crediting it as
 * well is the next increment, not this one.
 */
function resolveCreditCapacity(
  ringPackets: number,
  ringBytes: number,
  maxPacketBytes: number,
): { readonly bytes: number; readonly packets: number } | undefined {
  const reservePackets = Math.min(
    Math.max(1, Math.ceil(ringPackets / 8)),
    Math.max(0, ringPackets - 1),
  );
  const reserveBytes = Math.min(
    Math.ceil(ringBytes / 8),
    Math.max(0, ringBytes - maxPacketBytes),
  );
  const packets = ringPackets - reservePackets;
  const bytes = ringBytes - reserveBytes;
  // A ring that cannot hold one maximum packet beside a reserve is too small
  // to pace anything. Such a node keeps the unnegotiated behaviour rather
  // than gaining a bound it would immediately stall against.
  if (packets < 1 || bytes < maxPacketBytes) return undefined;
  return Object.freeze({ bytes, packets });
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgpError("CONFIG_INVALID", "createNode", `${name} must be positive`);
  }
  return value;
}

function ranged(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new AgpError("CONFIG_INVALID", "createNode", `${name} is out of range`);
  }
  return value;
}

async function settleWithin(work: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  if (timeoutMs === 0) return false;
  let handle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    handle = setTimeout(() => resolve(false), timeoutMs);
  });
  const result = await Promise.race([work.then(() => true as const), timeout]);
  if (handle !== undefined) clearTimeout(handle);
  return result;
}
