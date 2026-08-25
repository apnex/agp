// The closed code domains are generated from their sovereign schemas rather
// than written again here. Section 3.1 of `sdk.md` says the SDK does not
// create a second handwritten representation, and it used to. See `B31`.
import type {
  AgpErrorCode,
  ConnectionState,
  CounterKey,
  DiagnosticDomain,
  DiagnosticSeverity,
  Direction,
  HostState,
  IdentityDenialCode,
  IneligibleReason,
  RouteExportSuppressionCode,
  SelectedReason,
  SessionEventCode,
  SessionTimerName,
} from "./code-types.generated.js";

export type {
  AgpErrorCode,
  ConnectionState,
  CounterKey,
  DiagnosticDomain,
  DiagnosticSeverity,
  Direction,
  HostState,
  IdentityDenialCode,
  IneligibleReason,
  RouteExportSuppressionCode,
  SelectedReason,
  SessionEventCode,
  SessionTimerName,
} from "./code-types.generated.js";

import type {
  CorrelationId,
  DeliveryErrorCode,
  DestinationSelector,
  EndpointName,
  EndpointSource,
  JsonObject,
  JsonValue,
  MessageId,
  NodeId,
  NodePath,
  ReturnToken,
  RouteAdvertisement,
  RouteRejection,
  SessionId,
  WireRevision,
} from "@agp/protocol";
import type {
  TransportListenerPublication,
  TransportListenerTerminal,
  TransportPeerEvidence,
  TransportRef,
  TransportTerminal,
} from "@agp/transport";
import type { OperationalEvent } from "./event-types.generated.js";

export * from "./event-types.generated.js";

export type {
  CorrelationId,
  EndpointName,
  EndpointSource,
  JsonObject,
  JsonValue,
  MessageId,
  NodeId,
  NodePath,
  ReturnToken,
  RouteAdvertisement,
  RouteRejection,
  SessionId,
  WireRevision,
};

export type Timestamp = string;
export type DurationMs = number;
export type OperationsRevision = string;
export type EventSequence = string;
export type CounterValue = string;
export type InstanceId = string;
export type RouteId = string;
export type BindingId = string;
export type AdjacencyId = string;
export type ControllerId = string;

export interface Cancellable {
  cancel(): void;
}

export interface ClockPort {
  wallTime(): Timestamp;
  monotonicMs(): number;
  schedule(delayMs: number, callback: () => void): Cancellable;
}

export interface RandomPort {
  nextUnit(): number;
}

export type IdScope =
  | "instance"
  | "controller"
  | "session"
  | "message"
  | "route"
  | "advertisement"
  | "binding"
  | "adjacency"
  | "event"
  | "continuation";

export interface IdSourcePort {
  next(scope: IdScope): string;
}

export type DiagnosticCode = string;

export interface DiagnosticRecord {
  readonly schemaVersion: "agp.diagnostic/v1";
  readonly nodeId: NodeId;
  readonly instanceId: InstanceId;
  readonly occurredAt: Timestamp;
  readonly operationsRevision: OperationsRevision;
  readonly domain: DiagnosticDomain;
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  readonly message?: string;
}

export interface DiagnosticSinkPort {
  emit(record: DiagnosticRecord, cause?: unknown): void;
}

export interface ExactSessionOwner {
  /**
   * Private, non-wire identity for one exact controller incarnation.
   * It is the authority used to reject stale callbacks.
   */
  readonly controllerId: ControllerId;
  readonly remoteNodeId: NodeId;
  readonly localSessionId: SessionId;
  readonly remoteSessionId: SessionId;
}

export type NextHopRef =
  | { readonly kind: "local"; readonly bindingId: BindingId }
  | {
      readonly kind: "session";
      readonly nodeId: NodeId;
      readonly owningSessionId: SessionId;
    };

export type CandidateSelectionReason = SelectedReason | IneligibleReason;

export interface LocalRouteInput {
  readonly endpoint: EndpointName;
  readonly bindingId: BindingId;
  readonly registeredAt: Timestamp;
  readonly active: boolean;
}

export interface AdvertisementSnapshot {
  readonly advertisementId: string;
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly owningSessionId: SessionId;
  readonly advertisingNodeId: NodeId;
  readonly remoteSessionId: SessionId;
  readonly receivedPath: readonly NodeId[];
  readonly receivedRevision: WireRevision;
  readonly receivedAt: Timestamp;
}

export interface CandidateRouteSnapshot {
  readonly routeId: RouteId;
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly routeClass: "local" | "learned";
  readonly learnedKind?: "direct" | "transit";
  readonly source:
    | { readonly kind: "local"; readonly bindingId: BindingId }
    | {
        readonly kind: "session";
        readonly owningSessionId: SessionId;
        readonly advertisingNodeId: NodeId;
        readonly advertisementId: string;
      };
  readonly path: readonly NodeId[];
  readonly nextHop: NextHopRef;
  readonly eligible: boolean;
  readonly selectionStatus: "selected" | "not-selected" | "ineligible";
  readonly selectionReason: CandidateSelectionReason;
  readonly installedAt: Timestamp;
}

export interface SelectedRouteSnapshot {
  readonly endpoint: EndpointName;
  readonly routeId: RouteId;
  readonly originNodeId: NodeId;
  readonly routeClass: "local" | "learned";
  readonly learnedKind?: "direct" | "transit";
  readonly sourceKind: "local" | "session";
  readonly path: readonly NodeId[];
  readonly nextHop: NextHopRef;
  readonly selectionReason: SelectedReason;
  readonly selectedAt: Timestamp;
}

export interface ForwardingEntrySnapshot {
  readonly endpoint: EndpointName;
  readonly selectedRouteId: RouteId;
  readonly originNodeId: NodeId;
  readonly nextHop: NextHopRef;
  readonly resolvedAtRevision: OperationsRevision;
}

export interface ExportSnapshot {
  readonly id: MessageId;
  readonly revision: WireRevision;
  readonly routes: readonly RouteAdvertisement[];
}


export interface AdjRibOutRouteSnapshot {
  readonly remoteNodeId: NodeId;
  readonly owningSessionId: SessionId;
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly path: readonly NodeId[];
  readonly state:
    | "desired"
    | "outstanding"
    | "acked"
    | "rejected"
    | "suppressed";
  readonly reasonCode?: RouteExportSuppressionCode;
  readonly remoteRejectionCode?: "LOOP" | "PATH_TOO_LONG" | "POLICY" | "CAPACITY";
  readonly remoteRetryAttempt?: number;
  readonly remoteRetryAt?: Timestamp;
  readonly revision?: WireRevision;
}

export interface RouteExportState {
  readonly routeDecisions: readonly AdjRibOutRouteSnapshot[];
  readonly nextRevision: WireRevision;
  readonly acked?: ExportSnapshot;
  readonly outstanding?: ExportSnapshot;
  readonly coalescedDesired?: readonly RouteAdvertisement[];
}

export interface RouteImportState {
  readonly consumedRevision: WireRevision;
  readonly routeCount: number;
}

export interface LabelBindingSnapshot {
  readonly messageId: MessageId;
  readonly outboundReturnToken: ReturnToken;
  readonly source: EndpointSource;
  readonly destination: EndpointName;
  readonly ingress:
    | { readonly kind: "local" }
    | {
        readonly kind: "session";
        readonly nodeId: NodeId;
        readonly owningSessionId: SessionId;
        readonly upstreamReturnToken: ReturnToken;
      };
  readonly egressNodeId: NodeId;
  readonly egressSessionId: SessionId;
  readonly admittedAtRevision: OperationsRevision;
  readonly expiresAt: Timestamp;
}

export interface SnapshotMeta {
  readonly schemaVersion: "agp.operations/v1";
  readonly nodeId: NodeId;
  readonly instanceId: InstanceId;
  readonly capturedAt: Timestamp;
  readonly revision: OperationsRevision;
}

export interface ConfigurationSnapshot {
  readonly raw: JsonObject;
  readonly effective: JsonObject;
  readonly redactedKeys: readonly string[];
}

export type HostFailureSnapshot =
  | { readonly code: "START_FAILED" }
  | {
      readonly code: "LISTENER_TERMINAL";
      readonly terminal: TransportListenerTerminal;
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "operations-revision" | "event-sequence";
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "counter";
      readonly counterKey: CounterKey;
    }
  | { readonly code: "INTERNAL_INVARIANT" };

interface LifecycleSnapshotBase {
  readonly state: HostState;
  readonly stateSince: Timestamp;
  readonly startedAt?: Timestamp;
  readonly stoppedAt?: Timestamp;
}

export type LifecycleSnapshot =
  | (LifecycleSnapshotBase & {
      readonly state: Exclude<HostState, "Failed">;
      readonly failure?: never;
    })
  | (LifecycleSnapshotBase & {
      readonly state: "Failed";
      readonly failure: HostFailureSnapshot;
    });

export interface ListenerSnapshot {
  readonly configured: boolean;
  readonly transportRef?: TransportRef;
  readonly state: "disabled" | "stopped" | "starting" | "listening" | "terminal";
  readonly publication?: TransportListenerPublication;
  readonly terminal?: TransportListenerTerminal;
  readonly lastErrorCode?: AgpErrorCode;
}

export interface AdjacencySnapshot {
  readonly adjacencyId: AdjacencyId;
  readonly expectedNodeId?: NodeId;
  readonly transportRef: TransportRef;
  readonly desired: boolean;
  readonly state: "idle" | "dialing" | "satisfied" | "retry-wait" | "terminal";
  readonly activeControllerId?: ControllerId;
  readonly retryAttempt: number;
  readonly retryAt?: Timestamp;
  readonly lastReason?: string;
}

export interface LocalEndpointSnapshot {
  readonly endpoint: EndpointName;
  readonly bindingId: BindingId;
  readonly registeredAt: Timestamp;
  readonly active: boolean;
}

export type SessionReasonCode =
  | SessionEventCode
  | "CEASE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_MESSAGE"
  | "UNEXPECTED_MESSAGE"
  | "IDENTITY_REJECTED"
  | "ADJACENCY_COLLISION"
  | "HOLD_TIMEOUT"
  | "ROUTE_REVISION_ERROR"
  | "INTERNAL_ERROR";

export interface SessionTransitionSnapshot {
  readonly event: SessionEventCode;
  readonly from: ConnectionState;
  readonly to: ConnectionState;
  readonly at: Timestamp;
  readonly reasonCode?: SessionReasonCode;
}

export interface NegotiatedCapabilitiesSnapshot {
  readonly holdTimeMs: number;
  readonly keepaliveTimeMs: number;
  readonly peerReceiveLimitBytes: number;
  readonly maxRoutesPerSnapshot: number;
  readonly maxPathLength: number;
  readonly maxHopCount: number;
  readonly transit: boolean;
}


export interface TimerSnapshot {
  readonly name: SessionTimerName;
  readonly state: "armed" | "disabled";
  readonly startedAt?: Timestamp;
  readonly durationMs?: number;
  readonly expiresAt?: Timestamp;
  readonly remainingMs?: number;
}

export interface TimerRuntimeInput {
  readonly name: SessionTimerName;
  readonly state: "armed" | "disabled";
  readonly startedAt?: Timestamp;
  readonly durationMs?: number;
  readonly expiresAt?: Timestamp;
  readonly deadlineMonotonicMs?: number;
}

export interface ReturnTokenAllocatorSnapshot {
  readonly allocated: CounterValue;
  readonly exhausted: boolean;
  readonly maximum: "18446744073709551615";
}

export interface BoundedQueueSnapshot {
  readonly currentMessages: CounterValue;
  readonly maximumMessages: CounterValue;
  readonly highWaterMessages: CounterValue;
  readonly currentBytes: CounterValue;
  readonly maximumBytes: CounterValue;
  readonly highWaterBytes: CounterValue;
}

export interface SessionQueuesSnapshot {
  readonly control: BoundedQueueSnapshot;
  readonly data: BoundedQueueSnapshot;
  readonly continuation: BoundedQueueSnapshot;
}

/**
 * One shape for every duration the node measures.
 *
 * The count is carried because a high-water mark drawn from three samples and
 * one drawn from three thousand are not the same claim. See `D20`.
 */
export interface LatencySample {
  readonly count: CounterValue;
  readonly lastUs: number;
  readonly highWaterUs: number;
}

export interface CreditDimensions {
  readonly bytes: CounterValue;
  readonly packets: CounterValue;
}

/** What the peer permits this node to send, and what that permission cost. */
export interface OutboundCreditSnapshot {
  readonly unlimited: boolean;
  readonly ceiling?: CreditDimensions;
  readonly sent: CreditDimensions;
  readonly remaining?: CreditDimensions;
  readonly stalls: CounterValue;
  readonly stalledUs: number;
  readonly stalledSince?: Timestamp;
}

/** What this node permits its peer to send, and what it has drained. */
export interface InboundCreditSnapshot {
  readonly capacity: CreditDimensions;
  readonly read: CreditDimensions;
  readonly advertised: CreditDimensions;
  readonly announcements: CounterValue;
}

export interface SessionCreditSnapshot {
  readonly outbound: OutboundCreditSnapshot;
  readonly inbound?: InboundCreditSnapshot;
}

export interface SessionLatencySnapshot {
  readonly routeAck?: LatencySample;
  readonly creditReplenishment?: LatencySample;
}

interface ConnectionSnapshotBase {
  readonly direction: Direction;
  readonly state: ConnectionState;
  readonly stateSince: Timestamp;
  readonly lastTransition: SessionTransitionSnapshot;
  readonly timers: readonly TimerSnapshot[];
  readonly queues: SessionQueuesSnapshot;
  readonly latency?: SessionLatencySnapshot;
  readonly credit?: SessionCreditSnapshot;
  readonly lastTransportTerminal?: TransportTerminal;
}

export interface PreIdentityControllerSnapshot extends ConnectionSnapshotBase {
  readonly identityState: "pending";
  readonly localSessionId: SessionId;
  readonly adjacencyId?: AdjacencyId;
}

export interface SessionSnapshot extends ConnectionSnapshotBase {
  readonly identityState: "admitted";
  readonly sessionId: SessionId;
  readonly remoteNodeId: NodeId;
  readonly remoteSessionId?: SessionId;
  readonly establishedAt?: Timestamp;
  readonly establishedDurationMs?: number;
  readonly negotiated?: NegotiatedCapabilitiesSnapshot;
  readonly routeImport: RouteImportState;
  readonly routeExport: RouteExportState;
  readonly returnTokenAllocator: ReturnTokenAllocatorSnapshot;
}

export type ConnectionSnapshot =
  | PreIdentityControllerSnapshot
  | SessionSnapshot;

/**
 * Runtime-only source for a public session snapshot. Monotonic anchors never
 * cross the operations boundary.
 */
export interface SessionOperationalInput
  extends Omit<SessionSnapshot, "establishedDurationMs" | "timers"> {
  readonly establishedMonotonicMs?: number;
  readonly timers: readonly TimerRuntimeInput[];
}

export interface PreIdentityOperationalInput
  extends Omit<PreIdentityControllerSnapshot, "timers"> {
  readonly timers: readonly TimerRuntimeInput[];
}

export type ConnectionOperationalInput =
  | SessionOperationalInput
  | PreIdentityOperationalInput;

export interface UsageGauge {
  readonly current: CounterValue;
  readonly maximum: CounterValue;
  readonly highWater: CounterValue;
}

export interface ResourcesSnapshot {
  readonly gauges: Readonly<Record<string, UsageGauge>>;
}

export interface CountersSnapshot {
  readonly values: Readonly<Record<string, CounterValue>>;
}

export interface EventSubscriptionOptions {
  readonly signal?: AbortSignal;
  readonly bufferSize?: number;
}

export interface EventSubscription
  extends AsyncIterable<OperationalEvent>, AsyncIterator<OperationalEvent> {
  close(): void;
}

export interface OperationsSnapshot extends SnapshotMeta {
  readonly configuration: ConfigurationSnapshot;
  readonly lifecycle: LifecycleSnapshot;
  readonly listener: ListenerSnapshot;
  readonly adjacencies: readonly AdjacencySnapshot[];
  readonly localEndpoints: readonly LocalEndpointSnapshot[];
  readonly connections: readonly ConnectionSnapshot[];
  readonly advertisements: readonly AdvertisementSnapshot[];
  readonly candidateRoutes: readonly CandidateRouteSnapshot[];
  readonly selectedRoutes: readonly SelectedRouteSnapshot[];
  readonly forwarding: readonly ForwardingEntrySnapshot[];
  readonly routeExports: readonly AdjRibOutRouteSnapshot[];
  readonly labelBindings: readonly LabelBindingSnapshot[];
  readonly resources: ResourcesSnapshot;
  readonly counters: CountersSnapshot;
}

export interface MetaList<T> extends SnapshotMeta {
  readonly items: readonly T[];
}

export type AdjacencyListSnapshot = MetaList<AdjacencySnapshot>;
export type LocalEndpointListSnapshot = MetaList<LocalEndpointSnapshot>;
export type ConnectionListSnapshot = MetaList<ConnectionSnapshot>;
export type AdvertisementListSnapshot = MetaList<AdvertisementSnapshot>;
export interface RouteTableSnapshot extends SnapshotMeta {
  readonly candidates: readonly CandidateRouteSnapshot[];
  readonly selected: readonly SelectedRouteSnapshot[];
}
export type ForwardingListSnapshot = MetaList<ForwardingEntrySnapshot>;
export type AdjRibOutListSnapshot = MetaList<AdjRibOutRouteSnapshot>;
export type LabelBindingListSnapshot = MetaList<LabelBindingSnapshot>;

export interface OperationsReader {
  snapshot(): OperationsSnapshot;
  configuration(): ConfigurationSnapshot & SnapshotMeta;
  lifecycle(): LifecycleSnapshot & SnapshotMeta;
  listener(): ListenerSnapshot & SnapshotMeta;
  adjacencies(): AdjacencyListSnapshot;
  endpoints(): LocalEndpointListSnapshot;
  connections(): ConnectionListSnapshot;
  advertisements(): AdvertisementListSnapshot;
  routes(): RouteTableSnapshot;
  forwarding(): ForwardingListSnapshot;
  routeExports(): AdjRibOutListSnapshot;
  labelBindings(): LabelBindingListSnapshot;
  resources(): ResourcesSnapshot & SnapshotMeta;
  counters(): CountersSnapshot & SnapshotMeta;
  /**
   * Lifecycle, anomalies and everything else an operator must act on.
   *
   * Its rate is set by what happens to the node rather than by how much
   * traffic crosses it, so a consumer doing real work keeps up on a bounded
   * buffer of its own choosing. See `D24`.
   */
  events(options?: EventSubscriptionOptions): EventSubscription;
  /**
   * The successful path of each message, for a consumer that asks for it.
   *
   * Traffic-rated by construction. A consumer sizes its buffer against the
   * burst it expects, and a subscriber that cannot keep up is told through the
   * same gap record the other stream uses.
   */
  messages(options?: EventSubscriptionOptions): EventSubscription;
}

export interface ReconnectPolicyConfig {
  readonly enabled?: boolean;
  readonly initialDelayMs: number;
  readonly maximumDelayMs: number;
  readonly multiplier?: number;
  readonly jitterRatio?: number;
}

export interface ListenerConfig {
  readonly transportRef: TransportRef;
}

export interface PeerConfig {
  readonly adjacencyId: AdjacencyId;
  readonly expectedNodeId: NodeId;
  readonly transportRef: TransportRef;
  readonly reconnect?: ReconnectPolicyConfig;
}

export interface RouteRejectionRetryPolicy {
  readonly initialMs?: number;
  readonly maxMs?: number;
}

export interface TransitConfig {
  readonly enabled: boolean;
  readonly defaultHopLimit?: number;
}

export interface TimerConfig {
  readonly holdTimeMs?: number;
  readonly openTimeoutMs?: number;
  readonly identityAdmissionTimeoutMs?: number;
  readonly routeAdmissionTimeoutMs?: number;
  readonly routeWriteTimeoutMs?: number;
  readonly routeAckTimeoutMs?: number;
  readonly transportWriteTimeoutMs?: number;
  readonly transportCloseTimeoutMs?: number;
}

export interface LimitConfig {
  readonly receiveLimitBytes?: number;
  readonly maxRoutesPerSnapshot?: number;
  readonly maxPathLength?: number;
  readonly maxHopCount?: number;
  readonly maxLocalEndpoints?: number;
  readonly maxCandidateRoutes?: number;
}

export interface CapacityConfig {
  readonly maxSessions?: number;
  readonly maxPendingHandshakes?: number;
  readonly controlQueueMessages?: number;
  readonly controlQueueBytes?: number;
  readonly dataQueueMessages?: number;
  readonly dataQueueBytes?: number;
  readonly continuationQueueMessages?: number;
  readonly continuationQueueBytes?: number;
  readonly maxActiveHandlers?: number;
  readonly maxActiveHandlerBytes?: number;
  readonly maxLabelBindings?: number;
  readonly maxEventSubscribers?: number;
  readonly eventSubscriberBuffer?: number;
  readonly transportReceivePackets?: number;
  readonly transportReceiveBytes?: number;
}

/**
 * How the reverse-path label table reports the fate of what it forwards, and
 * what it does when it is full.
 *
 * A binding is released when a disposition for it returns, so the table is
 * sized by the offered rate over an end-to-end round trip plus the debounce
 * interval, rather than over the expiry window. See D23.
 */
export interface DispositionConfig {
  /** How long a batch may wait before it is sent. */
  readonly debounceMs?: number;
  /** How large a batch may grow before it is sent without waiting. */
  readonly maximumOutcomes?: number;
  /** The most outcomes this node will read out of one arriving batch. */
  readonly maximumInboundOutcomes?: number;
  /**
   * What a full label table does.
   *
   * The default evicts the oldest binding, so a reverse-path quality concern
   * can never stop the data plane. A deployment that would rather stop than
   * lose a disposition sets `refuse` and accepts that the table can cap
   * throughput.
   */
  readonly onCapacity?: "evict-oldest" | "refuse";
}

export interface IdentityAdmissionPolicyConfig {
  readonly mode?: "allow" | "port";
}

export interface RouteAdmissionPolicyConfig {
  readonly mode?: "allow" | "port";
}

/**
 * One topology-neutral configuration. Omitted nested values are resolved by
 * the @agp/node factory and exposed in its effective configuration snapshot.
 */
export interface NodeConfig {
  readonly nodeId: NodeId;
  readonly listen?: ListenerConfig;
  readonly peers?: readonly PeerConfig[];
  readonly transit?: TransitConfig;
  readonly routeRejectionRetry?: RouteRejectionRetryPolicy;
  readonly timers?: TimerConfig;
  readonly limits?: LimitConfig;
  readonly capacity?: CapacityConfig;
  readonly disposition?: DispositionConfig;
  readonly identityAdmission?: IdentityAdmissionPolicyConfig;
  readonly routeAdmission?: RouteAdmissionPolicyConfig;
}

export interface StartOptions {
  readonly signal?: AbortSignal;
}

export interface StopPolicy {
  readonly drainTimeoutMs?: number;
}

export interface StopOptions extends StopPolicy {
  readonly signal?: AbortSignal;
}

export interface StartedNode {
  readonly nodeId: NodeId;
  readonly instanceId: InstanceId;
  readonly startedAt: Timestamp;
  readonly listener?: {
    readonly transportRef: TransportRef;
    readonly publication?: TransportListenerPublication;
  };
  readonly operationsRevision: OperationsRevision;
}

export interface StopReport {
  readonly operationsRevision: OperationsRevision;
  readonly stoppedAt: Timestamp;
  readonly drainedMessages: CounterValue;
  readonly discardedMessages: CounterValue;
}

export interface EndpointBindingInfo {
  readonly endpoint: EndpointName;
  readonly bindingId: BindingId;
  readonly registeredAt: Timestamp;
  readonly operationsRevision: OperationsRevision;
}

export interface EndpointDeliveryContext {
  readonly messageId: MessageId;
  readonly correlationId?: CorrelationId;
  readonly source: EndpointSource;
  readonly destination: EndpointName;
  readonly receivedAt: Timestamp;
  readonly ingressNodeId?: NodeId;
  readonly ingressSessionId?: SessionId;
  readonly operationsRevision: OperationsRevision;
}

export interface SendPolicy {
  readonly correlationId?: CorrelationId;
  readonly timeoutMs?: number;
  /**
   * Which advertiser of the destination this message is for.
   *
   * Absent means any of them, which is what a destination name alone has
   * always meant. A pin yields that instance or a refusal, never a different
   * instance; it guards against misdelivery rather than guaranteeing
   * reachability. See `D26`.
   */
  readonly destinationSelector?: DestinationSelector;
}

export interface SendOptions extends SendPolicy {
  readonly signal?: AbortSignal;
}

/** One terminal thing that happened to a message, at one destination. */
export interface MessageOutcome {
  readonly kind: "delivered" | "failed";
  readonly code?: DeliveryErrorCode;
  readonly reason?: string;
  readonly failedAtNodeId?: NodeId;
}

/**
 * What an origin knows about the fate of one message it sent.
 *
 * The signal is best effort. A lost disposition leaves an application with
 * neither outcome, so an application building reliable delivery on this still
 * needs its own timeout. This is stated plainly because a signal that usually
 * arrives is the easiest kind to over-trust. See D23 section 4.7.
 */
export interface MessageDisposition {
  readonly messageId: MessageId;
  readonly correlationId?: CorrelationId;
  readonly source: EndpointName;
  readonly destination: EndpointName;
  /** Terminal outcomes received so far, in arrival order. */
  readonly outcomes: readonly MessageOutcome[];
  /** Destinations still owed. Zero with `settled` true means nothing is left. */
  readonly outstanding: number;
  /**
   * Destinations the message was divided into.
   *
   * Undefined means at least one outcome is outstanding and the total is not
   * yet known, which is a different statement from a total of one. The
   * denominator is stamped by the hop that enumerated the destinations and
   * rides on every disposition, so it becomes known as soon as any outcome
   * arrives, and never by the absence of a field. See D23.
   */
  readonly total: number | undefined;
  /**
   * Whether the origin will learn anything further about this message.
   *
   * False with a non-zero `outstanding` is a stall an application can see,
   * rather than one it has to infer from a timeout.
   */
  readonly settled: boolean;
}

export interface SendReceipt {
  readonly messageId: MessageId;
  readonly correlationId?: CorrelationId;
  readonly acceptedAt: Timestamp;
  readonly operationsRevision: OperationsRevision;
  readonly selectedRouteId: RouteId;
  readonly nextHop: NextHopRef;
}

export interface IdentityAdmissionRequest {
  readonly localNodeId: NodeId;
  readonly remoteNodeId: NodeId;
  readonly localSessionId: SessionId;
  readonly remoteSessionId: SessionId;
  readonly direction: Direction;
  readonly adjacencyId?: AdjacencyId;
  readonly expectedRemoteNodeId?: NodeId;
  readonly peerEvidence: TransportPeerEvidence;
}

export type IdentityAdmissionResult =
  | { readonly decision: "allow" }
  | { readonly decision: "deny"; readonly reasonCode: IdentityDenialCode };

export interface IdentityAdmissionPort {
  evaluate(request: IdentityAdmissionRequest): Promise<IdentityAdmissionResult>;
}

export interface RouteAdmissionRequest {
  readonly localNodeId: NodeId;
  readonly remoteNodeId: NodeId;
  readonly localSessionId: SessionId;
  readonly revision: WireRevision;
  readonly updateId: MessageId;
  readonly routes: readonly RouteAdvertisement[];
}

export type RouteAdmissionDecision =
  | {
      readonly endpoint: EndpointName;
      readonly originNodeId: NodeId;
      readonly path: readonly NodeId[];
      readonly decision: "allow";
    }
  | {
      readonly endpoint: EndpointName;
      readonly originNodeId: NodeId;
      readonly path: readonly NodeId[];
      readonly decision: "deny";
      readonly reason: string;
    };

export interface RouteAdmissionResult {
  readonly decisions: readonly RouteAdmissionDecision[];
}

export interface RouteAdmissionPort {
  evaluate(request: RouteAdmissionRequest): Promise<RouteAdmissionResult>;
}
