import type { NodeId } from "@agp/protocol";
import { counter } from "./bounded.js";
import { AgpError } from "./errors.js";
import { compareUtf8, immutableClone } from "./immutable.js";
import {
  compareCandidates,
  compareRouteExportRows,
  type RoutingSnapshot,
} from "./routing.js";
import type {
  AdjacencySnapshot,
  AdvertisementListSnapshot,
  AdvertisementSnapshot,
  AdjRibOutListSnapshot,
  AdjRibOutRouteSnapshot,
  ClockPort,
  ConnectionListSnapshot,
  ConnectionOperationalInput,
  ConnectionSnapshot,
  ConfigurationSnapshot,
  ControllerId,
  CounterKey,
  CounterValue,
  CountersSnapshot,
  EventSubscription,
  EventSubscriptionOptions,
  ForwardingEntrySnapshot,
  ForwardingListSnapshot,
  HostState,
  InstanceId,
  LifecycleSnapshot,
  ListenerSnapshot,
  LocalEndpointListSnapshot,
  LocalEndpointSnapshot,
  MetaList,
  OperationalEvent,
  OperationalEventInput,
  OperationsReader,
  OperationsRevision,
  OperationsSnapshot,
  ResourcesSnapshot,
  LabelBindingListSnapshot,
  LabelBindingSnapshot,
  RouteTableSnapshot,
  SessionSnapshot,
  SnapshotMeta,
  Timestamp,
  UsageGauge,
} from "./types.js";

export interface ConnectionRecordInput {
  readonly controllerId: ControllerId;
  readonly snapshot: ConnectionOperationalInput;
}

export interface ResourceGaugeInput {
  readonly current: number | bigint;
  readonly maximum: number | bigint;
  readonly highWater: number | bigint;
}

export interface OperationsCommit {
  readonly lifecycle?: LifecycleSnapshot;
  readonly listener?: ListenerSnapshot;
  readonly adjacencies?: readonly AdjacencySnapshot[];
  readonly localEndpoints?: readonly LocalEndpointSnapshot[];
  readonly connections?: readonly ConnectionRecordInput[];
  readonly routing?: RoutingSnapshot;
  readonly routeExports?: readonly AdjRibOutRouteSnapshot[];
  readonly labelBindings?: readonly LabelBindingSnapshot[];
  readonly resources?: Readonly<Record<string, ResourceGaugeInput>>;
  readonly incrementCounters?: Readonly<Record<string, number | bigint>>;
  readonly events?: readonly OperationalEventInput[];
}

export interface OperationsStoreOptions {
  readonly nodeId: NodeId;
  readonly instanceId: InstanceId;
  readonly clock: ClockPort;
  readonly configuration: ConfigurationSnapshot;
  readonly listener?: ListenerSnapshot;
  readonly resources?: Readonly<Record<string, ResourceGaugeInput>>;
  readonly maxEventSubscribers?: number;
  readonly eventSubscriberBuffer?: number;
  /**
   * Exact-domain seam used only by the sovereign near-boundary test. Runtime
   * callers omit it and begin every node instance at zero.
   * @internal
   */
  readonly initialMonotonicState?: {
    readonly revision?: bigint;
    readonly eventSequence?: bigint;
    readonly counters?: Readonly<Partial<Record<CounterKey, bigint>>>;
  };
}

interface StoredResource {
  current: bigint;
  maximum: bigint;
  highWater: bigint;
}

interface Capture {
  readonly meta: SnapshotMeta;
  readonly monotonicMs: number;
}

interface MonotonicPreflight {
  readonly increments: ReadonlyMap<string, bigint>;
  readonly exhausted?:
    | {
        readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
        readonly domain: "operations-revision" | "event-sequence";
      }
    | {
        readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
        readonly domain: "counter";
        readonly counterKey: CounterKey;
      };
}

const UNSIGNED_64_MAX = 18_446_744_073_709_551_615n;
const LAST_ORDINARY_REVISION = UNSIGNED_64_MAX - 1n;
const COUNTER_KEYS = new Set<string>([
  "capacity.session_rejected",
  "handler.completed",
  "handler.failed",
  "lifecycle.failed",
  "lifecycle.started",
  "lifecycle.stopped",
  "message.accepted",
  "message.forwarded",
  "message.received",
  "message.rejected_before_admission",
  "transport.error",
  "transport.listener_terminal",
]);

/**
 * One bounded, canonical operational truth for SDK, HTTP and CLI adapters.
 * Query methods never perform I/O and never advance the revision.
 */
export class OperationsStore implements OperationsReader {
  readonly #nodeId: NodeId;
  readonly #instanceId: InstanceId;
  readonly #clock: ClockPort;
  readonly #configurationData: ConfigurationSnapshot;
  readonly #maxEventSubscribers: number;
  readonly #eventSubscriberBuffer: number;
  readonly #subscribers = new Set<OperationsSubscription>();
  readonly #connections = new Map<ControllerId, ConnectionOperationalInput>();
  readonly #counters = new Map<string, bigint>();
  readonly #resources = new Map<string, StoredResource>();

  #lifecycleData: LifecycleSnapshot;
  #listenerData: ListenerSnapshot;
  #adjacenciesData: readonly AdjacencySnapshot[] = Object.freeze([]);
  #localEndpointsData: readonly LocalEndpointSnapshot[] = Object.freeze([]);
  #advertisementsData: readonly AdvertisementSnapshot[] = Object.freeze([]);
  #candidateRoutesData: RoutingSnapshot["candidateRoutes"] = Object.freeze([]);
  #selectedRoutesData: RoutingSnapshot["selectedRoutes"] = Object.freeze([]);
  #forwardingData: readonly ForwardingEntrySnapshot[] = Object.freeze([]);
  #routeExportsData: readonly AdjRibOutRouteSnapshot[] = Object.freeze([]);
  // Held unordered as written, ordered when read. Sorting on the write path
  // cost a date parse per comparison against the whole live set, on every
  // committed message; sorting on the read path costs it once per query and
  // is reused until the set next changes. See `D21`.
  #reverseSource: readonly LabelBindingSnapshot[] = Object.freeze([]);
  // The exact array last accepted, kept so an unchanged set is recognised by
  // identity rather than by comparison.
  #reverseInput: readonly LabelBindingSnapshot[] | undefined;
  #reverseOrdered: readonly LabelBindingSnapshot[] | undefined =
    Object.freeze([]);
  #revision = 0n;
  #eventSequence = 0n;
  #capturedAt: Timestamp;
  #eventsTerminal = false;
  #terminal = false;

  constructor(options: OperationsStoreOptions) {
    if (options.nodeId.length === 0 || options.instanceId.length === 0) {
      throw new AgpError(
        "CONFIG_INVALID",
        "OperationsStore.constructor",
        "nodeId and instanceId must be non-empty",
      );
    }
    this.#nodeId = options.nodeId;
    this.#instanceId = options.instanceId;
    this.#clock = options.clock;
    this.#configurationData = immutableClone(options.configuration);
    this.#capturedAt = this.#clock.wallTime();
    this.#lifecycleData = {
      state: "Created",
      stateSince: this.#capturedAt,
    };
    this.#listenerData = immutableClone(options.listener ?? {
      configured: false,
      state: "disabled",
    });
    this.#maxEventSubscribers = positiveSafe(
      options.maxEventSubscribers ?? 32,
      "maxEventSubscribers",
    );
    this.#eventSubscriberBuffer = positiveSafe(
      options.eventSubscriberBuffer ?? 1024,
      "eventSubscriberBuffer",
    );
    const initial = options.initialMonotonicState;
    if (initial !== undefined) {
      this.#revision = unsigned64(
        initial.revision ?? 0n,
        "initial operations revision",
      );
      this.#eventSequence = unsigned64(
        initial.eventSequence ?? 0n,
        "initial event sequence",
      );
      for (const [key, value] of Object.entries(initial.counters ?? {})) {
        if (!isCounterKey(key)) {
          throw new AgpError(
            "CONFIG_INVALID",
            "OperationsStore.constructor",
            "initial counter key is outside the closed catalog",
          );
        }
        this.#counters.set(
          key,
          unsigned64(value, `initial counter ${key}`),
        );
      }
    }
    for (const [name, value] of Object.entries(options.resources ?? {})) {
      this.#resources.set(name, normalizeGauge(value, name));
    }
  }

  get currentRevision(): OperationsRevision {
    return this.#revision.toString(10);
  }

  /**
   * Applies one change and returns the receipt for it.
   *
   * The receipt is the committed identity, not the state. Returning a
   * materialised snapshot made every write pay for a read nobody had asked
   * for: three commits per delivered message, each deep-cloning the whole of
   * canonical state, which is quadratic in a stream and blocked the event
   * loop for hundreds of milliseconds at a time. A caller that wants state
   * calls `snapshot()`. See `D21`.
   */
  commit(change: OperationsCommit): SnapshotMeta {
    const now = this.#clock.wallTime();
    if (this.#terminal) return this.snapshot();
    const preflight = this.#preflightMonotonicDomain(change);
    if (preflight.exhausted !== undefined) {
      return this.#commitMonotonicExhaustion(preflight.exhausted, now);
    }
    // A revision denotes a change to canonical state. Emitting one for a
    // commit that wrote nothing makes the revision useless as a change
    // signal, and forces every consumer polling on it to re-read. See `D21`.
    let wrote = false;
    if (change.lifecycle !== undefined) {
      this.#lifecycleData = immutableClone(change.lifecycle);
      wrote = true;
    }
    if (change.listener !== undefined) {
      this.#listenerData = immutableClone(change.listener);
      wrote = true;
    }
    if (change.adjacencies !== undefined) {
      this.#adjacenciesData = immutableClone(
        [...change.adjacencies].sort(compareAdjacencies),
      );
      wrote = true;
    }
    if (change.localEndpoints !== undefined) {
      this.#localEndpointsData = immutableClone(
        [...change.localEndpoints].sort(compareEndpoints),
      );
      wrote = true;
    }
    if (change.connections !== undefined) {
      const replacement = new Map<ControllerId, ConnectionOperationalInput>();
      for (const record of change.connections) {
        if (replacement.has(record.controllerId)) {
          throw new AgpError(
            "INTERNAL",
            "OperationsStore.commit",
            "duplicate exact session controller",
          );
        }
        replacement.set(record.controllerId, immutableClone(record.snapshot));
      }
      this.#connections.clear();
      for (const [id, value] of replacement) this.#connections.set(id, value);
      wrote = true;
    }
    if (change.routing !== undefined) {
      this.#advertisementsData = immutableClone(
        [...change.routing.advertisements].sort(compareAdvertisements),
      );
      this.#candidateRoutesData = immutableClone(
        [...change.routing.candidateRoutes].sort(compareCandidateRows),
      );
      this.#selectedRoutesData = immutableClone(
        [...change.routing.selectedRoutes].sort(
          (a, b) => compareUtf8(a.endpoint, b.endpoint),
        ),
      );
      this.#forwardingData = immutableClone(
        [...change.routing.forwarding].sort(
          (a, b) => compareUtf8(a.endpoint, b.endpoint),
        ),
      );
      this.#routeExportsData = immutableClone(
        [...change.routing.routeExports].sort(compareRouteExportRows),
      );
      wrote = true;
    }
    if (change.routeExports !== undefined) {
      this.#routeExportsData = immutableClone(
        [...change.routeExports].sort(compareRouteExportRows),
      );
      wrote = true;
    }
    if (change.labelBindings !== undefined) {
      // A shallow copy detaches the caller's array. Its elements are already
      // frozen canonical values, so nothing below the array is touched.
      //
      // The caller memoises this projection, so an unchanged set arrives as
      // the same reference and is recognised without inspecting it. One
      // commit per delivered message supplies a reverse set that a local
      // delivery never altered, and that commit now writes nothing.
      if (change.labelBindings !== this.#reverseInput) {
        this.#reverseInput = change.labelBindings;
        this.#reverseSource = Object.freeze([...change.labelBindings]);
        this.#reverseOrdered = undefined;
        wrote = true;
      }
    }
    if (change.resources !== undefined) {
      for (const [name, value] of Object.entries(change.resources)) {
        this.#resources.set(name, normalizeGauge(value, name));
      }
      wrote = true;
    }
    for (const [key, delta] of preflight.increments) {
      this.#counters.set(key, (this.#counters.get(key) ?? 0n) + delta);
      wrote = true;
    }
    // Nothing was written and nothing is announced, so there is nothing for a
    // revision to denote. The caller still receives the current identity.
    if (!wrote && (change.events ?? []).length === 0) {
      return this.#capture().meta;
    }

    this.#revision += 1n;
    this.#capturedAt = now;
    const committedRevision = this.#revision.toString(10);
    const events: readonly OperationalEvent[] = (change.events ?? []).map((input) => {
      this.#eventSequence += 1n;
      // The generated input union has already correlated kind and data.
      // TypeScript cannot retain that correlation through this object
      // materialization, so the cast is confined to this single boundary.
      return immutableClone({
        schemaVersion: "agp.event/v1" as const,
        sequence: this.#eventSequence.toString(10),
        revision: committedRevision,
        nodeId: this.#nodeId,
        instanceId: this.#instanceId,
        occurredAt: now,
        kind: input.kind,
        subjectId: input.subjectId,
        data: input.data ?? {},
      }) as OperationalEvent;
    });
    for (const event of events) {
      for (const subscriber of this.#subscribers) subscriber.publish(event);
    }
    return this.#capture().meta;
  }

  #preflightMonotonicDomain(change: OperationsCommit): MonotonicPreflight {
    const increments = new Map<string, bigint>();
    for (const [key, increment] of Object.entries(
      change.incrementCounters ?? {},
    )) {
      if (!isCounterKey(key)) {
        throw new AgpError(
          "INTERNAL",
          "OperationsStore.commit",
          "counter key is outside the closed catalog",
        );
      }
      increments.set(key, nonNegativeBigInt(increment, `counter ${key}`));
    }
    if (this.#revision >= LAST_ORDINARY_REVISION) {
      return {
        increments,
        exhausted: {
          code: "MONOTONIC_DOMAIN_EXHAUSTED",
          domain: "operations-revision",
        },
      };
    }
    const eventCount = BigInt(change.events?.length ?? 0);
    if (this.#eventSequence + eventCount > UNSIGNED_64_MAX) {
      return {
        increments,
        exhausted: {
          code: "MONOTONIC_DOMAIN_EXHAUSTED",
          domain: "event-sequence",
        },
      };
    }
    for (const [key, delta] of increments) {
      if ((this.#counters.get(key) ?? 0n) + delta > UNSIGNED_64_MAX) {
        return {
          increments,
          exhausted: {
            code: "MONOTONIC_DOMAIN_EXHAUSTED",
            domain: "counter",
            counterKey: key as CounterKey,
          },
        };
      }
    }
    return { increments };
  }

  #commitMonotonicExhaustion(
    failure: NonNullable<MonotonicPreflight["exhausted"]>,
    now: Timestamp,
  ): OperationsSnapshot {
    this.#revision += 1n;
    this.#capturedAt = now;
    this.#lifecycleData = immutableClone({
      state: "Failed",
      stateSince: now,
      failure,
    });
    this.#adjacenciesData = Object.freeze([]);
    this.#localEndpointsData = Object.freeze([]);
    this.#connections.clear();
    this.#advertisementsData = Object.freeze([]);
    this.#candidateRoutesData = Object.freeze([]);
    this.#selectedRoutesData = Object.freeze([]);
    this.#forwardingData = Object.freeze([]);
    this.#routeExportsData = Object.freeze([]);
    this.#reverseSource = Object.freeze([]);
    this.#reverseOrdered = Object.freeze([]);
    for (const value of this.#resources.values()) value.current = 0n;
    this.#terminal = true;
    this.#eventsTerminal = true;
    const snapshot = this.snapshot();
    for (const subscriber of [...this.#subscribers]) subscriber.close();
    return snapshot;
  }

  /**
   * Terminal runtimes remain queryable but live observation completes.
   */
  terminateEvents(): void {
    if (this.#eventsTerminal) return;
    this.#eventsTerminal = true;
    for (const subscriber of [...this.#subscribers]) subscriber.close();
  }

  snapshot(): OperationsSnapshot {
    const capture = this.#capture();
    return immutableClone({
      ...capture.meta,
      configuration: this.#configurationData,
      lifecycle: this.#lifecycleData,
      listener: this.#listenerData,
      adjacencies: this.#adjacenciesData,
      localEndpoints: this.#localEndpointsData,
      connections: this.#materializeConnections(capture.monotonicMs),
      advertisements: this.#advertisementsData,
      candidateRoutes: this.#candidateRoutesData,
      selectedRoutes: this.#selectedRoutesData,
      forwarding: this.#forwardingData,
      routeExports: this.#routeExportsData,
      labelBindings: this.#orderedReverse(),
      resources: this.#resourcesSnapshot(),
      counters: this.#countersSnapshot(),
    });
  }

  configuration(): ConfigurationSnapshot & SnapshotMeta {
    const capture = this.#capture();
    return immutableClone({ ...capture.meta, ...this.#configurationData });
  }

  lifecycle(): LifecycleSnapshot & SnapshotMeta {
    const capture = this.#capture();
    return immutableClone({ ...capture.meta, ...this.#lifecycleData });
  }

  listener(): ListenerSnapshot & SnapshotMeta {
    const capture = this.#capture();
    return immutableClone({ ...capture.meta, ...this.#listenerData });
  }

  adjacencies(): MetaList<AdjacencySnapshot> {
    return this.#list(this.#adjacenciesData);
  }

  endpoints(): LocalEndpointListSnapshot {
    return this.#list(this.#localEndpointsData);
  }

  connections(): ConnectionListSnapshot {
    const capture = this.#capture();
    return immutableClone({
      ...capture.meta,
      items: this.#materializeConnections(capture.monotonicMs),
    });
  }

  advertisements(): AdvertisementListSnapshot {
    return this.#list(this.#advertisementsData);
  }

  routes(): RouteTableSnapshot {
    const capture = this.#capture();
    return immutableClone({
      ...capture.meta,
      candidates: this.#candidateRoutesData,
      selected: this.#selectedRoutesData,
    });
  }

  forwarding(): ForwardingListSnapshot {
    return this.#list(this.#forwardingData);
  }

  routeExports(): AdjRibOutListSnapshot {
    return this.#list(this.#routeExportsData);
  }

  labelBindings(): LabelBindingListSnapshot {
    return this.#list(this.#orderedReverse());
  }

  resources(): ResourcesSnapshot & SnapshotMeta {
    const capture = this.#capture();
    return immutableClone({ ...capture.meta, ...this.#resourcesSnapshot() });
  }

  counters(): CountersSnapshot & SnapshotMeta {
    const capture = this.#capture();
    return immutableClone({ ...capture.meta, ...this.#countersSnapshot() });
  }

  events(options: EventSubscriptionOptions = {}): EventSubscription {
    if (
      options.bufferSize !== undefined
      && (
        !Number.isSafeInteger(options.bufferSize)
        || options.bufferSize <= 0
        || options.bufferSize > 65536
      )
    ) {
      throw new AgpError(
        "OPTIONS_INVALID",
        "operations.events",
        "bufferSize must be a positive safe integer no greater than 65536",
      );
    }
    if (options.signal?.aborted) {
      throw new AgpError("ABORTED", "operations.events", "subscription aborted");
    }
    if (this.#eventsTerminal) return OperationsSubscription.completed();
    if (this.#subscribers.size >= this.#maxEventSubscribers) {
      throw new AgpError(
        "QUEUE_FULL",
        "operations.events",
        "event subscriber capacity reached",
      );
    }
    const subscriber = new OperationsSubscription(
      options.bufferSize ?? this.#eventSubscriberBuffer,
      () => this.#subscribers.delete(subscriber),
    );
    this.#subscribers.add(subscriber);
    if (options.signal !== undefined) {
      const signal = options.signal;
      const abort = (): void => subscriber.close();
      signal.addEventListener("abort", abort, { once: true });
      subscriber.onClose(() => signal.removeEventListener("abort", abort));
    }
    return subscriber;
  }

  #capture(): Capture {
    const monotonicMs = this.#clock.monotonicMs();
    return {
      monotonicMs,
      meta: {
        schemaVersion: "agp.operations/v1",
        nodeId: this.#nodeId,
        instanceId: this.#instanceId,
        capturedAt: this.#clock.wallTime(),
        revision: this.#revision.toString(10),
      },
    };
  }

  #list<T>(items: readonly T[]): MetaList<T> {
    const capture = this.#capture();
    return immutableClone({ ...capture.meta, items });
  }

  /** Orders the reverse set on demand, and reuses that order until it changes. */
  #orderedReverse(): readonly LabelBindingSnapshot[] {
    const cached = this.#reverseOrdered;
    if (cached !== undefined) return cached;
    const ordered = immutableClone(
      [...this.#reverseSource].sort(compareLabelTable),
    );
    this.#reverseOrdered = ordered;
    return ordered;
  }

  #materializeConnections(monotonicMs: number): readonly ConnectionSnapshot[] {
    return [...this.#connections.values()]
      .map((input) => materializeConnection(input, monotonicMs))
      .sort(compareConnections);
  }

  #resourcesSnapshot(): ResourcesSnapshot {
    const gauges: Record<string, UsageGauge> = {};
    for (const name of [...this.#resources.keys()].sort(compareUtf8)) {
      const value = this.#resources.get(name);
      if (value === undefined) continue;
      gauges[name] = {
        current: value.current.toString(10),
        maximum: value.maximum.toString(10),
        highWater: value.highWater.toString(10),
      };
    }
    return immutableClone({ gauges });
  }

  #countersSnapshot(): CountersSnapshot {
    const values: Record<string, CounterValue> = {};
    for (const key of [...this.#counters.keys()].sort(compareUtf8)) {
      values[key] = (this.#counters.get(key) ?? 0n).toString(10);
    }
    return immutableClone({ values });
  }
}

function materializeConnection(
  input: ConnectionOperationalInput,
  monotonicMs: number,
): ConnectionSnapshot {
  const establishedDurationMs =
    input.identityState === "admitted"
    && input.establishedMonotonicMs !== undefined
      ? Math.max(0, Math.floor(monotonicMs - input.establishedMonotonicMs))
      : undefined;
  const timers = input.timers
    .map((timer) => {
      if (timer.state === "disabled") {
        return { name: timer.name, state: "disabled" as const };
      }
      const remainingMs = timer.deadlineMonotonicMs === undefined
        ? undefined
        : Math.max(0, Math.ceil(timer.deadlineMonotonicMs - monotonicMs));
      return {
        name: timer.name,
        state: "armed" as const,
        ...(timer.startedAt === undefined ? {} : { startedAt: timer.startedAt }),
        ...(timer.durationMs === undefined ? {} : { durationMs: timer.durationMs }),
        ...(timer.expiresAt === undefined ? {} : { expiresAt: timer.expiresAt }),
        ...(remainingMs === undefined ? {} : { remainingMs }),
      };
    })
    .sort((a, b) => compareUtf8(a.name, b.name));
  if (input.identityState === "admitted") {
    const {
      establishedMonotonicMs: _privateAnchor,
      timers: _runtimeTimers,
      ...fields
    } = input;
    return immutableClone({
      ...fields,
      ...(establishedDurationMs === undefined ? {} : { establishedDurationMs }),
      timers,
    });
  }
  const { timers: _runtimeTimers, ...fields } = input;
  return immutableClone({ ...fields, timers });
}

/**
 * Memoised timestamp parse.
 *
 * The same instants are compared over and over: one live labelBinding keeps its
 * expiry string for its whole lifetime, and the set is re-sorted on every
 * committed message. Parsing a date is not cheap, and doing it inside a
 * comparator multiplies it by the log of the set size, on the write path.
 *
 * The cache is bounded and dropped whole rather than evicted piecewise, so it
 * cannot grow with uptime and needs no eviction policy to reason about.
 */
const MAX_PARSED_TIMESTAMPS = 8_192;
const parsedTimestamps = new Map<string, number>();

function timestampMs(value: string): number {
  const cached = parsedTimestamps.get(value);
  if (cached !== undefined) return cached;
  const parsed = Date.parse(value);
  if (parsedTimestamps.size >= MAX_PARSED_TIMESTAMPS) parsedTimestamps.clear();
  parsedTimestamps.set(value, parsed);
  return parsed;
}

export function compareLabelTable(
  left: LabelBindingSnapshot,
  right: LabelBindingSnapshot,
): number {
  return timestampMs(left.expiresAt) - timestampMs(right.expiresAt)
    || compareUtf8(left.messageId, right.messageId)
    || compareUtf8(left.egressNodeId, right.egressNodeId)
    || compareUtf8(left.egressSessionId, right.egressSessionId)
    || compareHex(left.outboundReturnToken, right.outboundReturnToken)
    || compareUtf8(left.source.endpoint, right.source.endpoint)
    || compareUtf8(left.source.originNodeId, right.source.originNodeId)
    || compareUtf8(left.destination, right.destination)
    || ingressRank(left.ingress) - ingressRank(right.ingress)
    || compareSessionIngress(left.ingress, right.ingress)
    || compareUnsignedDecimal(
      left.admittedAtRevision,
      right.admittedAtRevision,
    );
}

function compareAdjacencies(
  left: AdjacencySnapshot,
  right: AdjacencySnapshot,
): number {
  return compareUtf8(left.adjacencyId, right.adjacencyId);
}

function compareEndpoints(
  left: LocalEndpointSnapshot,
  right: LocalEndpointSnapshot,
): number {
  return compareUtf8(left.endpoint, right.endpoint)
    || compareUtf8(left.bindingId, right.bindingId);
}

function compareAdvertisements(
  left: AdvertisementSnapshot,
  right: AdvertisementSnapshot,
): number {
  return compareUtf8(left.endpoint, right.endpoint)
    || compareUtf8(left.originNodeId, right.originNodeId)
    || compareStringArrays(left.receivedPath, right.receivedPath)
    || compareUtf8(left.owningSessionId, right.owningSessionId);
}

function compareCandidateRows(
  left: OperationsSnapshot["candidateRoutes"][number],
  right: OperationsSnapshot["candidateRoutes"][number],
): number {
  return compareUtf8(left.endpoint, right.endpoint)
    || compareCandidates(left, right)
    || compareUtf8(left.routeId, right.routeId);
}

function compareConnections(
  left: ConnectionSnapshot,
  right: ConnectionSnapshot,
): number {
  if (left.identityState !== right.identityState) {
    return left.identityState === "pending" ? -1 : 1;
  }
  if (left.identityState === "pending" && right.identityState === "pending") {
    return compareUtf8(left.localSessionId, right.localSessionId);
  }
  if (left.identityState === "admitted" && right.identityState === "admitted") {
    return compareUtf8(left.remoteNodeId, right.remoteNodeId)
      || compareUtf8(left.sessionId, right.sessionId);
  }
  return 0;
}

function compareStringArrays(
  left: readonly string[],
  right: readonly string[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined || b === undefined) break;
    const result = compareUtf8(a, b);
    if (result !== 0) return result;
  }
  return left.length - right.length;
}

function ingressRank(
  value: LabelBindingSnapshot["ingress"],
): number {
  return value.kind === "local" ? 0 : 1;
}

function compareSessionIngress(
  left: LabelBindingSnapshot["ingress"],
  right: LabelBindingSnapshot["ingress"],
): number {
  if (left.kind !== "session" || right.kind !== "session") return 0;
  return compareUtf8(left.nodeId, right.nodeId)
    || compareUtf8(left.owningSessionId, right.owningSessionId)
    || compareHex(left.upstreamReturnToken, right.upstreamReturnToken);
}

function compareHex(left: string, right: string): number {
  const a = BigInt(`0x${left}`);
  const b = BigInt(`0x${right}`);
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareUnsignedDecimal(left: string, right: string): number {
  const a = BigInt(left);
  const b = BigInt(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeGauge(value: ResourceGaugeInput, name: string): StoredResource {
  const current = nonNegativeBigInt(value.current, `${name}.current`);
  const maximum = nonNegativeBigInt(value.maximum, `${name}.maximum`);
  const highWater = nonNegativeBigInt(value.highWater, `${name}.highWater`);
  if (current > maximum || highWater < current || highWater > maximum) {
    throw new AgpError(
      "INTERNAL",
      "OperationsStore.resource",
      "resource gauge ordering is invalid",
    );
  }
  return { current, maximum, highWater };
}

function nonNegativeBigInt(value: number | bigint, name: string): bigint {
  if (
    typeof value === "number"
    && (!Number.isSafeInteger(value) || value < 0)
  ) {
    throw new AgpError(
      "INTERNAL",
      "OperationsStore",
      `${name} must be a non-negative integer`,
    );
  }
  const result = BigInt(value);
  if (result < 0n) {
    throw new AgpError(
      "INTERNAL",
      "OperationsStore",
      `${name} must be non-negative`,
    );
  }
  return result;
}

function unsigned64(value: bigint, name: string): bigint {
  if (value < 0n || value > UNSIGNED_64_MAX) {
    throw new AgpError(
      "CONFIG_INVALID",
      "OperationsStore.constructor",
      `${name} is outside the unsigned 64-bit domain`,
    );
  }
  return value;
}

function isCounterKey(value: string): value is CounterKey {
  return COUNTER_KEYS.has(value);
}

function positiveSafe(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgpError(
      "CONFIG_INVALID",
      "OperationsStore.constructor",
      `${name} must be a positive safe integer`,
    );
  }
  return value;
}

interface WaitingConsumer {
  readonly resolve: (result: IteratorResult<OperationalEvent>) => void;
  readonly reject: (reason: unknown) => void;
}

class OperationsSubscription implements EventSubscription {
  readonly #capacity: number;
  readonly #onClosed: () => void;
  readonly #queue: OperationalEvent[] = [];
  readonly #waiters: WaitingConsumer[] = [];
  readonly #closeCallbacks: (() => void)[] = [];
  #closed = false;
  #droppedFrom: bigint | undefined;
  #droppedTo: bigint | undefined;

  constructor(capacity: number, onClosed: () => void) {
    this.#capacity = capacity;
    this.#onClosed = onClosed;
  }

  static completed(): EventSubscription {
    const value = new OperationsSubscription(1, () => {});
    value.close();
    return value;
  }

  [Symbol.asyncIterator](): AsyncIterator<OperationalEvent> {
    return this;
  }

  next(): Promise<IteratorResult<OperationalEvent>> {
    const queued = this.#queue.shift();
    if (queued !== undefined) {
      return Promise.resolve({ done: false, value: queued });
    }
    if (this.#closed) return Promise.resolve({ done: true, value: undefined });
    return new Promise((resolve, reject) => this.#waiters.push({ resolve, reject }));
  }

  return(): Promise<IteratorResult<OperationalEvent>> {
    this.close();
    return Promise.resolve({ done: true, value: undefined });
  }

  throw(reason?: unknown): Promise<IteratorResult<OperationalEvent>> {
    this.close();
    return Promise.reject(reason);
  }

  publish(event: OperationalEvent): void {
    if (this.#closed) return;
    const waiter = this.#waiters.shift();
    if (waiter !== undefined) {
      waiter.resolve({ done: false, value: event });
      return;
    }
    if (this.#queue.length >= this.#capacity) {
      const dropped = this.#queue.shift();
      if (dropped !== undefined) {
        const sequence = BigInt(dropped.sequence);
        this.#droppedFrom ??= sequence;
        this.#droppedTo = sequence;
      }
    }
    if (this.#droppedFrom !== undefined && this.#queue.length < this.#capacity) {
      const gap = immutableClone({
        ...event,
        kind: "observer.gap" as const,
        subjectId: "operations.events",
        data: {
          droppedFrom: this.#droppedFrom.toString(10),
          droppedTo: (this.#droppedTo ?? this.#droppedFrom).toString(10),
        },
      }) as OperationalEvent;
      this.#droppedFrom = undefined;
      this.#droppedTo = undefined;
      this.#queue.push(gap);
      if (this.#queue.length >= this.#capacity) return;
    }
    this.#queue.push(event);
  }

  onClose(callback: () => void): void {
    if (this.#closed) callback();
    else this.#closeCallbacks.push(callback);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#queue.length = 0;
    for (const waiter of this.#waiters.splice(0)) {
      waiter.resolve({ done: true, value: undefined });
    }
    for (const callback of this.#closeCallbacks.splice(0)) callback();
    this.#onClosed();
  }
}
