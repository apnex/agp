import type {
  EndpointName,
  MessageId,
  NodeId,
  RouteAdvertisement,
  RouteRejection,
  RouteRejectionCode,
  SessionId,
  WireRevision,
} from "@agp/protocol";
import { AgpError } from "./errors.js";
import { compareUtf8, immutableClone } from "./immutable.js";
import type {
  AdjRibOutRouteSnapshot,
  AdvertisementSnapshot,
  BindingId,
  CandidateRouteSnapshot,
  CandidateSelectionReason,
  ClockPort,
  ControllerId,
  ExactSessionOwner,
  ExportSnapshot,
  ForwardingEntrySnapshot,
  IdSourcePort,
  IneligibleReason,
  LocalRouteInput,
  OperationsRevision,
  RouteExportState,
  RouteExportSuppressionCode,
  RouteId,
  RouteImportState,
  SelectedReason,
  SelectedRouteSnapshot,
  Timestamp,
} from "./types.js";

const ENDPOINT_PATTERN =
  /^[a-z0-9][a-z0-9._-]{0,62}(?:\/[a-z0-9][a-z0-9._-]{0,62})*$/;
const SESSION_ID_PATTERN = /^[0-9a-f]{6}$/;

export interface RouteRejectionRetryConfig {
  readonly initialMs?: number;
  readonly maxMs?: number;
}

export interface RoutingTableOptions {
  readonly nodeId: NodeId;
  readonly ids: IdSourcePort;
  readonly clock: ClockPort;
  readonly transitEnabled?: boolean;
  readonly maxLocalEndpoints?: number;
  readonly maxCandidateRoutes?: number;
  readonly routeRejectionRetry?: RouteRejectionRetryConfig;
  readonly onCommit?: (result: RoutingMutationResult) => void;
}

export interface EstablishedSessionInput {
  readonly owner: ExactSessionOwner;
  readonly maxPathLength: number;
  readonly maxRoutesPerSnapshot: number;
}

export interface ImportPolicyDecision {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly path: readonly NodeId[];
  readonly decision: "allow" | "deny";
}

export interface ImportSnapshotInput {
  readonly owner: ExactSessionOwner;
  readonly updateId: MessageId;
  readonly revision: WireRevision;
  readonly routes: readonly RouteAdvertisement[];
  readonly policyDecisions?: readonly ImportPolicyDecision[];
}

export type RouteImportFatalCode =
  | "INVALID_MESSAGE"
  | "ROUTE_REVISION_ERROR";

export interface RouteImportSuccess {
  readonly ok: true;
  readonly updateId: MessageId;
  readonly revision: WireRevision;
  readonly rejected: readonly RouteRejection[];
  readonly accepted: readonly RouteAdvertisement[];
  readonly mutation: RoutingMutationResult;
}

export interface RouteImportFailure {
  readonly ok: false;
  readonly code: RouteImportFatalCode;
  readonly reason: string;
}

export type RouteImportResult = RouteImportSuccess | RouteImportFailure;

export interface RouteAckInput {
  readonly owner: ExactSessionOwner;
  readonly refId: MessageId;
  readonly revision: WireRevision;
  readonly rejected: readonly RouteRejection[];
}

export type RouteAckResult =
  | {
      readonly ok: true;
      readonly accepted: readonly RouteAdvertisement[];
      readonly rejected: readonly RouteRejection[];
      readonly mutation: RoutingMutationResult;
    }
  | { readonly ok: false; readonly reason: string };

export interface OutboundRouteUpdate {
  readonly owner: ExactSessionOwner;
  readonly snapshot: ExportSnapshot;
  readonly closedEpochs: readonly ExportEpochClosure[];
}

export interface ExportEpochClosure {
  readonly controllerId: ControllerId;
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly epoch: number;
}

export interface RoutingMutationResult {
  readonly revision: OperationsRevision;
  readonly committedAt: Timestamp;
  readonly affectedEndpoints: readonly EndpointName[];
  readonly outboundUpdates: readonly OutboundRouteUpdate[];
  readonly closedEpochs: readonly ExportEpochClosure[];
}

export interface RoutingSnapshot {
  readonly revision: OperationsRevision;
  readonly capturedAt: Timestamp;
  readonly advertisements: readonly AdvertisementSnapshot[];
  readonly candidateRoutes: readonly CandidateRouteSnapshot[];
  readonly selectedRoutes: readonly SelectedRouteSnapshot[];
  readonly forwarding: readonly ForwardingEntrySnapshot[];
  readonly routeExports: readonly AdjRibOutRouteSnapshot[];
  readonly sessionImports: readonly {
    readonly owner: ExactSessionOwner;
    readonly state: RouteImportState;
  }[];
  readonly sessionExports: readonly {
    readonly owner: ExactSessionOwner;
    readonly state: RouteExportState;
  }[];
}

interface StoredLocal {
  readonly input: LocalRouteInput;
  readonly routeId: RouteId;
}

interface StoredAdvertisement {
  advertisementId: string;
  routeId: RouteId;
  endpoint: EndpointName;
  originNodeId: NodeId;
  owner: ExactSessionOwner;
  receivedPath: readonly NodeId[];
  receivedRevision: WireRevision;
  receivedAt: Timestamp;
  installedAt: Timestamp;
}

interface StoredSession {
  readonly owner: ExactSessionOwner;
  readonly maxPathLength: number;
  readonly maxRoutesPerSnapshot: number;
  inboundRevision: WireRevision;
  readonly advertisements: Map<EndpointName, StoredAdvertisement>;
  readonly export: StoredExportStream;
}

interface StoredExport {
  readonly id: MessageId;
  readonly revision: WireRevision;
  readonly routes: readonly RouteAdvertisement[];
}

interface RemoteRejection {
  readonly route: RouteAdvertisement;
  readonly code: RouteRejectionCode;
  readonly revision: WireRevision;
  readonly retryAttempt?: number;
  readonly retryDeadlineMonotonicMs?: number;
  readonly retryAt?: Timestamp;
  retryDue: boolean;
}

interface StoredExportStream {
  nextRevision: number;
  acked?: StoredExport | undefined;
  outstanding?: StoredExport | undefined;
  coalescedDesired?: readonly RouteAdvertisement[] | undefined;
  desired: readonly RouteAdvertisement[];
  decisions: readonly AdjRibOutRouteSnapshot[];
  readonly rejections: Map<string, RemoteRejection>;
  readonly epochs: Map<string, { epoch: number; open: boolean }>;
}

interface InternalCandidate {
  readonly snapshot: CandidateRouteSnapshot;
  readonly controllerId?: ControllerId;
}

interface DerivedExport {
  readonly routes: readonly RouteAdvertisement[];
  readonly localDecisions: readonly AdjRibOutRouteSnapshot[];
  readonly rejectedDecisions: readonly AdjRibOutRouteSnapshot[];
}

/**
 * Transport-independent, serial-command RIB/FIB and Adj-RIB-Out engine.
 *
 * Every mutating public method is one complete routing transaction. A caller
 * must invoke it from the node's serialized executor.
 */
export class RoutingTable {
  readonly #nodeId: NodeId;
  readonly #ids: IdSourcePort;
  readonly #clock: ClockPort;
  readonly #transitEnabled: boolean;
  readonly #maxLocalEndpoints: number;
  readonly #maxCandidateRoutes: number;
  readonly #retryInitialMs: number;
  readonly #retryMaxMs: number;
  readonly #onCommit?: (result: RoutingMutationResult) => void;

  readonly #localsByBinding = new Map<BindingId, StoredLocal>();
  readonly #localBindingByEndpoint = new Map<EndpointName, BindingId>();
  readonly #sessions = new Map<ControllerId, StoredSession>();
  readonly #pairToController = new Map<string, ControllerId>();
  readonly #selected = new Map<EndpointName, SelectedRouteSnapshot>();
  readonly #forwarding = new Map<EndpointName, ForwardingEntrySnapshot>();
  #revision = 0n;
  #capturedAt: Timestamp;
  #snapshotCache: {
    readonly revision: bigint;
    readonly value: RoutingSnapshot;
  } | undefined;

  constructor(options: RoutingTableOptions) {
    this.#nodeId = requireString(options.nodeId, "nodeId") as NodeId;
    this.#ids = options.ids;
    this.#clock = options.clock;
    this.#transitEnabled = options.transitEnabled ?? false;
    this.#maxLocalEndpoints = positiveSafe(
      options.maxLocalEndpoints ?? 256,
      "maxLocalEndpoints",
    );
    this.#maxCandidateRoutes = positiveSafe(
      options.maxCandidateRoutes ?? 4096,
      "maxCandidateRoutes",
    );
    this.#retryInitialMs = positiveSafe(
      options.routeRejectionRetry?.initialMs ?? 1000,
      "routeRejectionRetry.initialMs",
    );
    this.#retryMaxMs = positiveSafe(
      options.routeRejectionRetry?.maxMs ?? 30000,
      "routeRejectionRetry.maxMs",
    );
    if (this.#retryMaxMs < this.#retryInitialMs) {
      throw new AgpError(
        "CONFIG_INVALID",
        "RoutingTable.constructor",
        "route rejection maxMs must be at least initialMs",
      );
    }
    if (options.onCommit !== undefined) this.#onCommit = options.onCommit;
    this.#capturedAt = this.#clock.wallTime();
  }

  installLocal(
    input: Omit<LocalRouteInput, "registeredAt" | "active">
      & { readonly registeredAt?: Timestamp; readonly active?: boolean },
  ): RoutingMutationResult {
    const endpoint = validateEndpoint(input.endpoint);
    const bindingId = requireString(input.bindingId, "bindingId");
    if (input.active === false) {
      throw new AgpError(
        "ENDPOINT_INVALID",
        "RoutingTable.installLocal",
        "an installed local binding must be active",
      );
    }
    if (
      this.#localsByBinding.has(bindingId)
      || this.#localBindingByEndpoint.has(endpoint)
    ) {
      throw new AgpError(
        "ENDPOINT_ALREADY_EXPOSED",
        "RoutingTable.installLocal",
        "endpoint or binding already exists",
      );
    }
    if (this.#localsByBinding.size >= this.#maxLocalEndpoints) {
      throw new AgpError(
        "ENDPOINT_CAPACITY",
        "RoutingTable.installLocal",
        "local endpoint capacity reached",
      );
    }
    this.#requireCandidateCapacity(1);
    const local: StoredLocal = {
      input: {
        endpoint,
        bindingId,
        registeredAt: input.registeredAt ?? this.#clock.wallTime(),
        active: true,
      },
      routeId: this.#id("route"),
    };
    this.#localsByBinding.set(bindingId, local);
    this.#localBindingByEndpoint.set(endpoint, bindingId);
    return this.#commit(new Set([endpoint]));
  }

  removeLocal(bindingId: BindingId): RoutingMutationResult | undefined {
    const local = this.#localsByBinding.get(bindingId);
    if (local === undefined) return undefined;
    this.#localsByBinding.delete(bindingId);
    this.#localBindingByEndpoint.delete(local.input.endpoint);
    return this.#commit(new Set([local.input.endpoint]));
  }

  establishSession(input: EstablishedSessionInput): RoutingMutationResult {
    validateOwner(input.owner);
    const maxPathLength = positiveSafe(input.maxPathLength, "maxPathLength");
    const maxRoutesPerSnapshot = positiveSafe(
      input.maxRoutesPerSnapshot,
      "maxRoutesPerSnapshot",
    );
    if (this.#sessions.has(input.owner.controllerId)) {
      throw new AgpError(
        "INTERNAL",
        "RoutingTable.establishSession",
        "controller is already established",
      );
    }
    const pair = pairKey(input.owner.remoteNodeId, input.owner.localSessionId);
    if (this.#pairToController.has(pair)) {
      throw new AgpError(
        "INTERNAL",
        "RoutingTable.establishSession",
        "pair-scoped session identity is already retained",
      );
    }
    this.#sessions.set(input.owner.controllerId, {
      owner: immutableClone(input.owner),
      maxPathLength,
      maxRoutesPerSnapshot,
      inboundRevision: 0 as WireRevision,
      advertisements: new Map(),
      export: createExportStream(),
    });
    this.#pairToController.set(pair, input.owner.controllerId);
    return this.#commit(new Set(this.#allEndpoints()), new Set([
      input.owner.controllerId,
    ]), true);
  }

  removeSession(
    controllerId: ControllerId,
  ): RoutingMutationResult | undefined {
    const session = this.#sessions.get(controllerId);
    if (session === undefined) return undefined;
    const affected = new Set(session.advertisements.keys());
    for (const selected of this.#selected.values()) {
      if (
        selected.nextHop.kind === "session"
        && selected.nextHop.nodeId === session.owner.remoteNodeId
        && selected.nextHop.owningSessionId === session.owner.localSessionId
      ) {
        affected.add(selected.endpoint);
      }
    }
    this.#sessions.delete(controllerId);
    this.#pairToController.delete(
      pairKey(session.owner.remoteNodeId, session.owner.localSessionId),
    );
    return this.#commit(affected, new Set(this.#sessions.keys()));
  }

  importSnapshot(input: ImportSnapshotInput): RouteImportResult {
    const session = this.#exactSession(input.owner);
    if (session === undefined) {
      return immutableClone({
        ok: false,
        code: "INVALID_MESSAGE",
        reason: "stale or non-Established session owner",
      });
    }
    if (
      !Number.isSafeInteger(input.revision)
      || input.revision < 1
      || session.inboundRevision >= Number.MAX_SAFE_INTEGER
      || input.revision !== session.inboundRevision + 1
    ) {
      return immutableClone({
        ok: false,
        code: "ROUTE_REVISION_ERROR",
        reason: "route revision is not the exact successor",
      });
    }
    if (input.routes.length > session.maxRoutesPerSnapshot) {
      return immutableClone({
        ok: false,
        code: "INVALID_MESSAGE",
        reason: "route count exceeds the negotiated snapshot bound",
      });
    }
    const structural = validateCanonicalSnapshot(
      input.routes,
      session.owner.remoteNodeId,
    );
    if (structural !== undefined) {
      return immutableClone({
        ok: false,
        code: "INVALID_MESSAGE",
        reason: structural,
      });
    }
    const policy = validatePolicyDecisions(
      input.routes,
      input.policyDecisions,
    );
    if (!policy.ok) {
      return immutableClone({
        ok: false,
        code: "INVALID_MESSAGE",
        reason: policy.reason,
      });
    }

    const accepted: RouteAdvertisement[] = [];
    const rejected: RouteRejection[] = [];
    for (const route of input.routes) {
      const classification = classifyImportedRoute({
        localNodeId: this.#nodeId,
        remoteNodeId: session.owner.remoteNodeId,
        maxPathLength: session.maxPathLength,
        route,
      });
      if (classification === "LOOP" || classification === "PATH_TOO_LONG") {
        rejected.push(rejection(route, classification));
      } else if (policy.denied.has(routeTuple(route))) {
        rejected.push(rejection(route, "POLICY"));
      } else {
        accepted.push(route);
      }
    }

    const otherCandidates = this.#candidateCount()
      - session.advertisements.size;
    const available = Math.max(0, this.#maxCandidateRoutes - otherCandidates);
    const capacity = Math.min(session.maxRoutesPerSnapshot, available);
    const capacityAccepted = accepted.slice(0, capacity);
    for (const route of accepted.slice(capacity)) {
      rejected.push(rejection(route, "CAPACITY"));
    }
    rejected.sort(compareRouteRejections);

    const old = session.advertisements;
    const next = new Map<EndpointName, StoredAdvertisement>();
    const now = this.#clock.wallTime();
    for (const route of capacityAccepted) {
      const prior = old.get(route.endpoint);
      const sameOrigin = prior?.originNodeId === route.originNodeId;
      next.set(route.endpoint, {
        advertisementId: sameOrigin
          ? prior.advertisementId
          : this.#id("advertisement"),
        routeId: sameOrigin ? prior.routeId : this.#id("route"),
        endpoint: route.endpoint,
        originNodeId: route.originNodeId,
        owner: session.owner,
        receivedPath: immutableClone(route.path),
        receivedRevision: input.revision,
        receivedAt: now,
        installedAt: sameOrigin ? prior.installedAt : now,
      });
    }
    const affected = new Set<EndpointName>([
      ...old.keys(),
      ...next.keys(),
      ...input.routes.map((route) => route.endpoint),
    ]);
    replaceAdjRibIn(session.advertisements, next);
    session.inboundRevision = input.revision;
    const mutation = this.#commit(affected);
    return immutableClone({
      ok: true,
      updateId: input.updateId,
      revision: input.revision,
      rejected,
      accepted: capacityAccepted,
      mutation,
    });
  }

  acknowledgeExport(input: RouteAckInput): RouteAckResult {
    const session = this.#exactSession(input.owner);
    const outstanding = session?.export.outstanding;
    if (
      session === undefined
      || outstanding === undefined
      || input.refId !== outstanding.id
      || input.revision !== outstanding.revision
    ) {
      return immutableClone({
        ok: false,
        reason: "ACK does not match the exact outstanding export",
      });
    }
    const checked = validateAckRejections(outstanding.routes, input.rejected);
    if (!checked.ok) return immutableClone(checked);

    const applied = applyRouteAck({
      outstanding,
      rejected: input.rejected,
      priorRejections: session.export.rejections,
      clock: this.#clock,
      initialMs: this.#retryInitialMs,
      maxMs: this.#retryMaxMs,
    });
    session.export.acked = applied.acked;
    session.export.outstanding = undefined;
    session.export.rejections.clear();
    for (const [key, value] of applied.rejections) {
      session.export.rejections.set(key, value);
    }
    const affected = new Set(outstanding.routes.map((route) => route.endpoint));
    const mutation = this.#commit(
      affected,
      new Set([session.owner.controllerId]),
    );
    return immutableClone({
      ok: true,
      accepted: applied.acked.routes,
      rejected: input.rejected,
      mutation,
    });
  }

  /**
   * Recomputes only due unchanged POLICY/CAPACITY rejections. No ACK handler
   * invokes this; the injected monotonic clock/scheduler owns invocation.
   */
  advanceRemoteRejectionRetry(
    controllerId: ControllerId,
  ): RoutingMutationResult | undefined {
    const session = this.#sessions.get(controllerId);
    if (session === undefined) return undefined;
    const changed = advanceRemoteRejectionRetry(
      session.export.rejections,
      this.#clock.monotonicMs(),
    );
    if (!changed) return undefined;
    return this.#commit(
      new Set([...session.export.rejections.values()].map(
        (entry) => entry.route.endpoint,
      )),
      new Set([controllerId]),
    );
  }

  selectedRoute(endpoint: EndpointName): SelectedRouteSnapshot | undefined {
    const value = this.#selected.get(validateEndpoint(endpoint));
    return value === undefined ? undefined : immutableClone(value);
  }

  forwardingEntry(endpoint: EndpointName): ForwardingEntrySnapshot | undefined {
    const value = this.#forwarding.get(validateEndpoint(endpoint));
    return value === undefined ? undefined : immutableClone(value);
  }

  feasibleSource(input: {
    readonly owner: ExactSessionOwner;
    readonly endpoint: EndpointName;
    readonly originNodeId: NodeId;
  }): boolean {
    const session = this.#exactSession(input.owner);
    const advertisement = session?.advertisements.get(
      validateEndpoint(input.endpoint),
    );
    return advertisement !== undefined
      && advertisement.originNodeId === input.originNodeId
      && this.#learnedCandidate(advertisement).snapshot.eligible;
  }

  ownsLocalSource(input: {
    readonly endpoint: EndpointName;
    readonly bindingId?: BindingId;
  }): boolean {
    const selected = this.#selected.get(validateEndpoint(input.endpoint));
    if (selected?.routeClass !== "local" || selected.nextHop.kind !== "local") {
      return false;
    }
    return input.bindingId === undefined
      || selected.nextHop.bindingId === input.bindingId;
  }

  hasAckedSource(input: {
    readonly owner: ExactSessionOwner;
    readonly endpoint: EndpointName;
    readonly originNodeId: NodeId;
  }): boolean {
    const session = this.#exactSession(input.owner);
    if (session === undefined) return false;
    const selected = this.#selected.get(validateEndpoint(input.endpoint));
    if (
      selected === undefined
      || selected.originNodeId !== input.originNodeId
    ) {
      return false;
    }
    return session.export.acked?.routes.some(
      (route) =>
        route.endpoint === input.endpoint
        && route.originNodeId === input.originNodeId,
    ) ?? false;
  }

  sourceExportEpoch(input: {
    readonly owner: ExactSessionOwner;
    readonly endpoint: EndpointName;
    readonly originNodeId: NodeId;
  }): number | undefined {
    const session = this.#exactSession(input.owner);
    if (session === undefined) return undefined;
    return sourceExportEpoch(
      session.export,
      input.endpoint,
      input.originNodeId,
    );
  }

  routeImportState(controllerId: ControllerId): RouteImportState | undefined {
    const session = this.#sessions.get(controllerId);
    if (session === undefined) return undefined;
    return immutableClone({
      consumedRevision: session.inboundRevision,
      routeCount: session.advertisements.size,
    });
  }

  routeExportState(controllerId: ControllerId): RouteExportState | undefined {
    const session = this.#sessions.get(controllerId);
    return session === undefined
      ? undefined
      : immutableClone(toRouteExportState(session.export));
  }

  pendingRouteUpdates(): readonly OutboundRouteUpdate[] {
    const updates: OutboundRouteUpdate[] = [];
    for (const session of this.#sessions.values()) {
      if (session.export.outstanding !== undefined) {
        updates.push({
          owner: session.owner,
          snapshot: session.export.outstanding,
          closedEpochs: [],
        });
      }
    }
    return immutableClone(updates.sort(compareOutboundUpdates));
  }

  /**
   * The routing projection, rebuilt only when routing has changed.
   *
   * Every received message publishes a session transition, and every
   * transition commits canonical state, so this was rebuilt and deep-cloned
   * twice per delivered message against routing that had not moved. The
   * revision already increments on every mutation, so it is an exact
   * invalidation signal rather than a heuristic one. See `D21`.
   */
  snapshot(): RoutingSnapshot {
    const cached = this.#snapshotCache;
    if (cached !== undefined && cached.revision === this.#revision) {
      return cached.value;
    }
    const value = this.#buildSnapshot();
    this.#snapshotCache = { revision: this.#revision, value };
    return value;
  }

  #buildSnapshot(): RoutingSnapshot {
    const candidates = this.#allCandidates();
    const advertisements = [...this.#sessions.values()]
      .flatMap((session) => [...session.advertisements.values()])
      .map(toAdvertisementSnapshot)
      .sort(compareAdvertisements);
    const selectedRoutes = [...this.#selected.values()]
      .sort((a, b) => compareUtf8(a.endpoint, b.endpoint));
    const forwarding = [...this.#forwarding.values()]
      .sort((a, b) => compareUtf8(a.endpoint, b.endpoint));
    const routeExports = [...this.#sessions.values()]
      .flatMap((session) => session.export.decisions)
      .sort(compareRouteExportRows);
    const orderedSessions = [...this.#sessions.values()].sort(compareSessions);
    return immutableClone({
      revision: this.#revision.toString(10),
      capturedAt: this.#capturedAt,
      advertisements,
      candidateRoutes: candidates.map((value) => value.snapshot),
      selectedRoutes,
      forwarding,
      routeExports,
      sessionImports: orderedSessions.map((session) => ({
        owner: session.owner,
        state: {
          consumedRevision: session.inboundRevision,
          routeCount: session.advertisements.size,
        },
      })),
      sessionExports: orderedSessions.map((session) => ({
        owner: session.owner,
        state: toRouteExportState(session.export),
      })),
    });
  }

  #commit(
    affected: Set<EndpointName>,
    onlyExportControllers?: Set<ControllerId>,
    forceInitial = false,
  ): RoutingMutationResult {
    const nextRevision = (this.#revision + 1n).toString(10);
    const now = this.#clock.wallTime();
    for (const endpoint of [...affected].sort(compareUtf8)) {
      this.#recomputeEndpoint(endpoint, nextRevision, now);
    }

    const sessions = onlyExportControllers === undefined
      ? [...this.#sessions.values()]
      : [...onlyExportControllers]
        .map((id) => this.#sessions.get(id))
        .filter((value): value is StoredSession => value !== undefined);
    const updates: OutboundRouteUpdate[] = [];
    const closed: ExportEpochClosure[] = [];
    for (const session of sessions.sort(compareSessions)) {
      const exportResult = this.#recomputeExport(session, forceInitial);
      if (exportResult.update !== undefined) updates.push(exportResult.update);
      closed.push(...exportResult.closed);
    }

    this.#revision += 1n;
    this.#capturedAt = now;
    const result = immutableClone({
      revision: this.#revision.toString(10),
      committedAt: now,
      affectedEndpoints: [...affected].sort(compareUtf8),
      outboundUpdates: updates.sort(compareOutboundUpdates),
      closedEpochs: closed.sort(compareEpochClosures),
    });
    this.#onCommit?.(result);
    return result;
  }

  #recomputeEndpoint(
    endpoint: EndpointName,
    nextRevision: OperationsRevision,
    now: Timestamp,
  ): void {
    const candidates = this.#candidatesFor(endpoint);
    const eligible = candidates
      .filter((candidate) => candidate.snapshot.eligible)
      .sort((a, b) => compareCandidates(a.snapshot, b.snapshot));
    const winner = eligible[0];
    if (winner === undefined) {
      this.#selected.delete(endpoint);
      this.#forwarding.delete(endpoint);
      return;
    }
    const runnerUp = eligible[1];
    const winnerReason = runnerUp === undefined
      ? "ONLY_ELIGIBLE"
      : reasonCandidateWins(winner.snapshot, runnerUp.snapshot);
    const selectedAt = this.#selected.get(endpoint)?.routeId
        === winner.snapshot.routeId
      ? this.#selected.get(endpoint)?.selectedAt ?? now
      : now;
    const selected: SelectedRouteSnapshot = {
      endpoint,
      routeId: winner.snapshot.routeId,
      originNodeId: winner.snapshot.originNodeId,
      routeClass: winner.snapshot.routeClass,
      ...(winner.snapshot.learnedKind === undefined
        ? {}
        : { learnedKind: winner.snapshot.learnedKind }),
      sourceKind: winner.snapshot.source.kind,
      path: winner.snapshot.path,
      nextHop: winner.snapshot.nextHop,
      selectionReason: winnerReason,
      selectedAt,
    };
    this.#selected.set(endpoint, immutableClone(selected));
    this.#forwarding.set(endpoint, immutableClone({
      endpoint,
      selectedRouteId: selected.routeId,
      originNodeId: selected.originNodeId,
      nextHop: selected.nextHop,
      resolvedAtRevision: nextRevision,
    }));
  }

  #candidatesFor(endpoint: EndpointName): InternalCandidate[] {
    const raw: InternalCandidate[] = [];
    const binding = this.#localBindingByEndpoint.get(endpoint);
    const local = binding === undefined
      ? undefined
      : this.#localsByBinding.get(binding);
    if (local !== undefined) raw.push(this.#localCandidate(local));
    for (const session of this.#sessions.values()) {
      const advertisement = session.advertisements.get(endpoint);
      if (advertisement !== undefined) {
        raw.push(this.#learnedCandidate(advertisement));
      }
    }
    const eligible = raw
      .filter((candidate) => candidate.snapshot.eligible)
      .sort((a, b) => compareCandidates(a.snapshot, b.snapshot));
    const winner = eligible[0];
    return raw
      .map((candidate) => {
        if (!candidate.snapshot.eligible) return candidate;
        const selected = winner?.snapshot.routeId === candidate.snapshot.routeId;
        const reason = selected
          ? (eligible[1] === undefined
            ? "ONLY_ELIGIBLE"
            : reasonCandidateWins(candidate.snapshot, eligible[1].snapshot))
          : reasonCandidateWins(winner?.snapshot ?? candidate.snapshot, candidate.snapshot);
        const updated: InternalCandidate = {
          ...candidate,
          snapshot: {
            ...candidate.snapshot,
            selectionStatus: selected
              ? ("selected" as const)
              : ("not-selected" as const),
            selectionReason: reason,
          },
        };
        return updated;
      })
      .sort(compareInternalCandidatesForOperations);
  }

  #allCandidates(): InternalCandidate[] {
    const endpoints = this.#allEndpoints();
    return endpoints.flatMap((endpoint) => this.#candidatesFor(endpoint));
  }

  #localCandidate(local: StoredLocal): InternalCandidate {
    const endpointIndexMatches =
      this.#localBindingByEndpoint.get(local.input.endpoint)
        === local.input.bindingId;
    const reason: IneligibleReason | undefined = !local.input.active
      ? "LOCAL_BINDING_INACTIVE"
      : !endpointIndexMatches
      ? "LOCAL_ENDPOINT_INDEX_MISMATCH"
      : !this.#localsByBinding.has(local.input.bindingId)
      ? "NEXT_HOP_UNRESOLVED"
      : undefined;
    return {
      snapshot: {
        routeId: local.routeId,
        endpoint: local.input.endpoint,
        originNodeId: this.#nodeId,
        routeClass: "local",
        source: { kind: "local", bindingId: local.input.bindingId },
        path: [this.#nodeId],
        nextHop: { kind: "local", bindingId: local.input.bindingId },
        eligible: reason === undefined,
        selectionStatus: reason === undefined ? "not-selected" : "ineligible",
        selectionReason: reason ?? "ONLY_ELIGIBLE",
        installedAt: local.input.registeredAt,
      },
    };
  }

  #learnedCandidate(advertisement: StoredAdvertisement): InternalCandidate {
    const session = this.#sessions.get(advertisement.owner.controllerId);
    const activeAdvertisement = session?.advertisements.get(
      advertisement.endpoint,
    );
    let reason: IneligibleReason | undefined;
    if (activeAdvertisement === undefined) reason = "ADVERTISEMENT_INACTIVE";
    else if (
      activeAdvertisement.advertisementId !== advertisement.advertisementId
      || activeAdvertisement.originNodeId !== advertisement.originNodeId
      || !pathsEqual(activeAdvertisement.receivedPath, advertisement.receivedPath)
    ) reason = "ADVERTISEMENT_MISMATCH";
    else if (
      this.#pairToController.get(
        pairKey(
          advertisement.owner.remoteNodeId,
          advertisement.owner.localSessionId,
        ),
      ) !== advertisement.owner.controllerId
    ) reason = "SESSION_CONTROLLER_STALE";
    else if (session === undefined) reason = "SESSION_NOT_ESTABLISHED";
    else if (
      session.owner.remoteNodeId !== advertisement.owner.remoteNodeId
      || session.owner.remoteSessionId !== advertisement.owner.remoteSessionId
    ) reason = "SESSION_IDENTITY_MISMATCH";
    const completePath = [...advertisement.receivedPath, this.#nodeId];
    if (
      reason === undefined
      && (
        completePath.at(-1) !== this.#nodeId
        || new Set(completePath).size !== completePath.length
        || completePath.length > (session?.maxPathLength ?? 0)
      )
    ) reason = "PATH_INVALID";
    if (reason === undefined && session === undefined) {
      reason = "NEXT_HOP_UNRESOLVED";
    }
    return {
      controllerId: advertisement.owner.controllerId,
      snapshot: {
        routeId: advertisement.routeId,
        endpoint: advertisement.endpoint,
        originNodeId: advertisement.originNodeId,
        routeClass: "learned",
        learnedKind: advertisement.receivedPath.length === 1
          ? "direct"
          : "transit",
        source: {
          kind: "session",
          owningSessionId: advertisement.owner.localSessionId,
          advertisingNodeId: advertisement.owner.remoteNodeId,
          advertisementId: advertisement.advertisementId,
        },
        path: completePath,
        nextHop: {
          kind: "session",
          nodeId: advertisement.owner.remoteNodeId,
          owningSessionId: advertisement.owner.localSessionId,
        },
        eligible: reason === undefined,
        selectionStatus: reason === undefined ? "not-selected" : "ineligible",
        selectionReason: reason ?? "ONLY_ELIGIBLE",
        installedAt: advertisement.installedAt,
      },
    };
  }

  #recomputeExport(
    session: StoredSession,
    forceInitial: boolean,
  ): { update?: OutboundRouteUpdate; closed: readonly ExportEpochClosure[] } {
    const selected = [...this.#selected.values()].sort(compareSelected);
    const currentTuples = new Set(selected.map((route) => routeTuple(route)));
    for (const key of session.export.rejections.keys()) {
      if (!currentTuples.has(key)) session.export.rejections.delete(key);
    }
    const derived = derivePeerExport({
      remoteNodeId: session.owner.remoteNodeId,
      owningSessionId: session.owner.localSessionId,
      selectedRoutes: selected,
      transitEnabled: this.#transitEnabled,
      maxPathLength: session.maxPathLength,
      maxRoutesPerSnapshot: session.maxRoutesPerSnapshot,
      rejections: session.export.rejections,
    });
    const closed = closeRemovedEpochs(
      session.owner.controllerId,
      session.export,
      derived.routes,
    );
    session.export.desired = derived.routes;
    const base = session.export.outstanding?.routes
      ?? session.export.acked?.routes
      ?? [];
    const changed = !routeSetsEqual(base, derived.routes);
    let promoted = false;
    if (session.export.outstanding !== undefined) {
      session.export.coalescedDesired = changed
        ? immutableClone(derived.routes)
        : undefined;
    } else if (changed || forceInitial) {
      session.export.outstanding = this.#newExport(derived.routes, session.export);
      session.export.coalescedDesired = undefined;
      promoted = true;
    } else {
      session.export.coalescedDesired = undefined;
    }
    session.export.decisions = buildExportRows(
      session,
      derived,
    );
    const outstanding = promoted ? session.export.outstanding : undefined;
    return {
      ...(outstanding === undefined
        ? {}
        : {
            update: immutableClone({
              owner: session.owner,
              snapshot: outstanding,
              closedEpochs: closed,
            }),
          }),
      closed,
    };
  }

  #newExport(
    routes: readonly RouteAdvertisement[],
    stream: StoredExportStream,
  ): StoredExport {
    if (stream.nextRevision > Number.MAX_SAFE_INTEGER) {
      throw new AgpError(
        "INTERNAL",
        "RoutingTable.routeExport",
        "wire revision rollover requires controller replacement",
      );
    }
    const snapshot: StoredExport = {
      id: this.#id("message") as MessageId,
      revision: stream.nextRevision as WireRevision,
      routes: immutableClone(routes),
    };
    stream.nextRevision += 1;
    return snapshot;
  }

  #exactSession(owner: ExactSessionOwner): StoredSession | undefined {
    const session = this.#sessions.get(owner.controllerId);
    return session !== undefined && ownersEqual(session.owner, owner)
      ? session
      : undefined;
  }

  #allEndpoints(): EndpointName[] {
    const endpoints = new Set<EndpointName>(this.#localBindingByEndpoint.keys());
    for (const session of this.#sessions.values()) {
      for (const endpoint of session.advertisements.keys()) endpoints.add(endpoint);
    }
    for (const endpoint of this.#selected.keys()) endpoints.add(endpoint);
    return [...endpoints].sort(compareUtf8);
  }

  #candidateCount(): number {
    let count = this.#localsByBinding.size;
    for (const session of this.#sessions.values()) {
      count += session.advertisements.size;
    }
    return count;
  }

  #requireCandidateCapacity(additional: number): void {
    if (additional > this.#maxCandidateRoutes - this.#candidateCount()) {
      throw new AgpError(
        "ENDPOINT_CAPACITY",
        "RoutingTable.capacity",
        "candidate route capacity reached",
      );
    }
  }

  #id(scope: "route" | "advertisement" | "message"): string {
    const value = this.#ids.next(scope);
    if (value.length === 0) {
      throw new AgpError("INTERNAL", "RoutingTable.id", "ID source returned empty");
    }
    return value;
  }
}

export type ImportedRouteClassification =
  | "ACCEPT"
  | "LOOP"
  | "PATH_TOO_LONG";

export function classifyImportedRoute(input: {
  readonly localNodeId: NodeId;
  readonly remoteNodeId: NodeId;
  readonly maxPathLength: number;
  readonly route: RouteAdvertisement;
}): ImportedRouteClassification {
  if (input.route.path.includes(input.localNodeId)) return "LOOP";
  if (input.route.path.length + 1 > input.maxPathLength) return "PATH_TOO_LONG";
  return "ACCEPT";
}

/**
 * Atomic in-memory replacement primitive for one exact session's Adj-RIB-In.
 * All validation and capacity admission must finish before this infallible
 * operation is called.
 */
export function replaceAdjRibIn<K, V>(
  target: Map<K, V>,
  replacement: ReadonlyMap<K, V>,
): void {
  target.clear();
  for (const [key, value] of replacement) target.set(key, value);
}

/**
 * Public total route-decision order. It deliberately excludes route IDs.
 */
export function compareCandidates(
  left: CandidateRouteSnapshot,
  right: CandidateRouteSnapshot,
): number {
  if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
  if (left.routeClass !== right.routeClass) {
    return left.routeClass === "local" ? -1 : 1;
  }
  if (left.path.length !== right.path.length) {
    return left.path.length - right.path.length;
  }
  const origin = compareUtf8(left.originNodeId, right.originNodeId);
  if (origin !== 0) return origin;
  const path = comparePaths(left.path, right.path);
  if (path !== 0) return path;
  if (left.source.kind === "local" && right.source.kind === "local") {
    return compareUtf8(left.source.bindingId, right.source.bindingId);
  }
  return 0;
}

export function derivePeerExport(input: {
  readonly remoteNodeId: NodeId;
  readonly owningSessionId: SessionId;
  readonly selectedRoutes: readonly SelectedRouteSnapshot[];
  readonly transitEnabled: boolean;
  readonly maxPathLength: number;
  readonly maxRoutesPerSnapshot: number;
  readonly rejections?: ReadonlyMap<string, RemoteRejection>;
}): DerivedExport {
  const routes: RouteAdvertisement[] = [];
  const localDecisions: AdjRibOutRouteSnapshot[] = [];
  const rejectedDecisions: AdjRibOutRouteSnapshot[] = [];
  const candidates: RouteAdvertisement[] = [];
  for (const selected of [...input.selectedRoutes].sort(compareSelected)) {
    const route: RouteAdvertisement = {
      endpoint: selected.endpoint,
      originNodeId: selected.originNodeId,
      path: immutableClone(selected.path),
    };
    let reason: RouteExportSuppressionCode | undefined;
    if (selected.routeClass === "learned" && !input.transitEnabled) {
      reason = "TRANSIT_DISABLED";
    } else if (selected.path.includes(input.remoteNodeId)) {
      reason = "PEER_IN_PATH";
    } else if (selected.path.length + 1 > input.maxPathLength) {
      reason = "PATH_TOO_LONG";
    }
    if (reason !== undefined) {
      localDecisions.push(exportRow(
        input,
        route,
        "suppressed",
        { reasonCode: reason },
      ));
      continue;
    }
    const remembered = input.rejections?.get(routeTuple(route));
    if (remembered !== undefined && !remembered.retryDue) {
      rejectedDecisions.push(exportRow(
        input,
        route,
        "rejected",
        {
          remoteRejectionCode: remembered.code,
          revision: remembered.revision,
          ...(remembered.retryAttempt === undefined
            ? {}
            : { remoteRetryAttempt: remembered.retryAttempt }),
          ...(remembered.retryAt === undefined
            ? {}
            : { remoteRetryAt: remembered.retryAt }),
        },
      ));
      continue;
    }
    candidates.push(route);
  }
  candidates.sort(compareRouteAdvertisements);
  for (const route of candidates.slice(0, input.maxRoutesPerSnapshot)) {
    routes.push(route);
  }
  for (const route of candidates.slice(input.maxRoutesPerSnapshot)) {
    localDecisions.push(exportRow(
      input,
      route,
      "suppressed",
      { reasonCode: "CAPACITY" },
    ));
  }
  return immutableClone({
    routes,
    localDecisions: localDecisions.sort(compareRouteExportRows),
    rejectedDecisions: rejectedDecisions.sort(compareRouteExportRows),
  });
}

export function applyRouteAck(input: {
  readonly outstanding: StoredExport;
  readonly rejected: readonly RouteRejection[];
  readonly priorRejections: ReadonlyMap<string, RemoteRejection>;
  readonly clock: ClockPort;
  readonly initialMs: number;
  readonly maxMs: number;
}): {
  readonly acked: StoredExport;
  readonly rejections: ReadonlyMap<string, RemoteRejection>;
} {
  const rejectedKeys = new Set(
    input.rejected.map((value) => routeKey(value.endpoint, value.originNodeId)),
  );
  const accepted = input.outstanding.routes.filter(
    (route) => !rejectedKeys.has(routeKey(route.endpoint, route.originNodeId)),
  );
  const memories = new Map<string, RemoteRejection>();
  for (const rejectionValue of input.rejected) {
    const route = input.outstanding.routes.find(
      (candidate) =>
        candidate.endpoint === rejectionValue.endpoint
        && candidate.originNodeId === rejectionValue.originNodeId,
    );
    if (route === undefined) continue;
    const tuple = routeTuple(route);
    const prior = input.priorRejections.get(tuple);
    if (
      rejectionValue.reasonCode === "POLICY"
      || rejectionValue.reasonCode === "CAPACITY"
    ) {
      const attempt = prior?.retryAttempt === undefined
        ? 0
        : prior.retryAttempt + 1;
      const delay = rejectionRetryDelay(input.initialMs, input.maxMs, attempt);
      memories.set(tuple, {
        route: immutableClone(route),
        code: rejectionValue.reasonCode,
        revision: input.outstanding.revision,
        retryAttempt: attempt,
        retryDeadlineMonotonicMs: input.clock.monotonicMs() + delay,
        retryAt: new Date(Date.parse(input.clock.wallTime()) + delay).toISOString(),
        retryDue: false,
      });
    } else {
      memories.set(tuple, {
        route: immutableClone(route),
        code: rejectionValue.reasonCode,
        revision: input.outstanding.revision,
        retryDue: false,
      });
    }
  }
  return {
    acked: {
      id: input.outstanding.id,
      revision: input.outstanding.revision,
      routes: immutableClone(accepted),
    },
    rejections: memories,
  };
}

export function advanceRemoteRejectionRetry(
  rejections: Map<string, RemoteRejection>,
  nowMonotonicMs: number,
): boolean {
  let changed = false;
  for (const entry of rejections.values()) {
    if (
      !entry.retryDue
      && entry.retryDeadlineMonotonicMs !== undefined
      && entry.retryDeadlineMonotonicMs <= nowMonotonicMs
    ) {
      entry.retryDue = true;
      changed = true;
    }
  }
  return changed;
}

export function sourceExportEpoch(
  stream: Pick<StoredExportStream, "acked" | "epochs">,
  endpoint: EndpointName,
  originNodeId: NodeId,
): number | undefined {
  const key = routeKey(endpoint, originNodeId);
  const acked = stream.acked?.routes.some(
    (route) =>
      route.endpoint === endpoint && route.originNodeId === originNodeId,
  ) ?? false;
  const epoch = stream.epochs.get(key);
  return acked && epoch?.open === true ? epoch.epoch : undefined;
}

export function rejectionRetryDelay(
  initialMs: number,
  maxMs: number,
  attempt: number,
): number {
  const raw = initialMs * 2 ** attempt;
  return Math.min(maxMs, Number.isFinite(raw) ? Math.floor(raw) : maxMs);
}

function createExportStream(): StoredExportStream {
  return {
    nextRevision: 1,
    desired: Object.freeze([]),
    decisions: Object.freeze([]),
    rejections: new Map(),
    epochs: new Map(),
  };
}

function closeRemovedEpochs(
  controllerId: ControllerId,
  stream: StoredExportStream,
  desired: readonly RouteAdvertisement[],
): ExportEpochClosure[] {
  const desiredKeys = new Set(desired.map(
    (route) => routeKey(route.endpoint, route.originNodeId),
  ));
  const ackedKeys = new Set((stream.acked?.routes ?? []).map(
    (route) => routeKey(route.endpoint, route.originNodeId),
  ));
  const closed: ExportEpochClosure[] = [];
  for (const route of stream.acked?.routes ?? []) {
    const key = routeKey(route.endpoint, route.originNodeId);
    let epoch = stream.epochs.get(key);
    if (epoch === undefined) {
      epoch = { epoch: 1, open: true };
      stream.epochs.set(key, epoch);
    }
    if (!desiredKeys.has(key) && epoch.open) {
      epoch.open = false;
      closed.push({
        controllerId,
        endpoint: route.endpoint,
        originNodeId: route.originNodeId,
        epoch: epoch.epoch,
      });
    }
  }
  for (const route of desired) {
    const key = routeKey(route.endpoint, route.originNodeId);
    if (!ackedKeys.has(key)) continue;
    const epoch = stream.epochs.get(key);
    if (epoch === undefined) stream.epochs.set(key, { epoch: 1, open: true });
    else if (!epoch.open) stream.epochs.set(key, {
      epoch: epoch.epoch + 1,
      open: true,
    });
  }
  return closed;
}

function buildExportRows(
  session: StoredSession,
  derived: DerivedExport,
): readonly AdjRibOutRouteSnapshot[] {
  const rows: AdjRibOutRouteSnapshot[] = [
    ...derived.localDecisions,
    ...derived.rejectedDecisions,
  ];
  if (session.export.coalescedDesired !== undefined) {
    for (const route of session.export.coalescedDesired) {
      rows.push(exportRowForSession(session, route, "desired"));
    }
  }
  if (session.export.outstanding !== undefined) {
    for (const route of session.export.outstanding.routes) {
      rows.push(exportRowForSession(
        session,
        route,
        "outstanding",
        { revision: session.export.outstanding.revision },
      ));
    }
  }
  if (session.export.acked !== undefined) {
    for (const route of session.export.acked.routes) {
      rows.push(exportRowForSession(
        session,
        route,
        "acked",
        { revision: session.export.acked.revision },
      ));
    }
  }
  return immutableClone(rows.sort(compareRouteExportRows));
}

function toRouteExportState(stream: StoredExportStream): RouteExportState {
  return {
    routeDecisions: stream.decisions,
    nextRevision: stream.nextRevision as WireRevision,
    ...(stream.acked === undefined ? {} : { acked: stream.acked }),
    ...(stream.outstanding === undefined
      ? {}
      : { outstanding: stream.outstanding }),
    ...(stream.coalescedDesired === undefined
      ? {}
      : { coalescedDesired: stream.coalescedDesired }),
  };
}

function validateCanonicalSnapshot(
  routes: readonly RouteAdvertisement[],
  remoteNodeId: NodeId,
): string | undefined {
  let prior: RouteAdvertisement | undefined;
  const endpoints = new Set<EndpointName>();
  for (const route of routes) {
    if (
      route.path.length < 1
      || route.path[0] !== route.originNodeId
      || route.path.at(-1) !== remoteNodeId
      || new Set(route.path).size !== route.path.length
    ) {
      return "route path origin/sender/uniqueness semantics are invalid";
    }
    if (endpoints.has(route.endpoint)) return "snapshot repeats an endpoint";
    endpoints.add(route.endpoint);
    if (prior !== undefined && compareRouteAdvertisements(prior, route) >= 0) {
      return "snapshot routes are not in strict canonical order";
    }
    prior = route;
  }
  return undefined;
}

function validatePolicyDecisions(
  routes: readonly RouteAdvertisement[],
  decisions: readonly ImportPolicyDecision[] | undefined,
): { ok: true; denied: Set<string> } | { ok: false; reason: string } {
  if (decisions === undefined) return { ok: true, denied: new Set() };
  if (decisions.length !== routes.length) {
    return { ok: false, reason: "route admission result is incomplete" };
  }
  const requested = new Set(routes.map(routeTuple));
  const seen = new Set<string>();
  const denied = new Set<string>();
  for (const decision of decisions) {
    const tuple = routeTuple(decision);
    if (!requested.has(tuple) || seen.has(tuple)) {
      return { ok: false, reason: "route admission result is duplicate or unknown" };
    }
    seen.add(tuple);
    if (decision.decision === "deny") denied.add(tuple);
  }
  return { ok: true, denied };
}

function validateAckRejections(
  routes: readonly RouteAdvertisement[],
  rejected: readonly RouteRejection[],
): { ok: true } | { ok: false; reason: string } {
  const available = new Set(routes.map(
    (route) => routeKey(route.endpoint, route.originNodeId),
  ));
  const seen = new Set<string>();
  let prior: RouteRejection | undefined;
  for (const rejectionValue of rejected) {
    const key = routeKey(rejectionValue.endpoint, rejectionValue.originNodeId);
    if (!available.has(key) || seen.has(key)) {
      return { ok: false, reason: "ACK rejection is unknown or duplicate" };
    }
    if (prior !== undefined && compareRouteRejections(prior, rejectionValue) >= 0) {
      return { ok: false, reason: "ACK rejections are not canonical" };
    }
    seen.add(key);
    prior = rejectionValue;
  }
  return { ok: true };
}

function reasonCandidateWins(
  winner: CandidateRouteSnapshot,
  loser: CandidateRouteSnapshot,
): SelectedReason {
  if (winner.routeClass !== loser.routeClass) return "PREFER_LOCAL";
  if (winner.path.length !== loser.path.length) return "SHORTEST_PATH";
  if (winner.originNodeId !== loser.originNodeId) return "LOWEST_ORIGIN_NODE_ID";
  if (comparePaths(winner.path, loser.path) !== 0) return "LOWEST_NODE_PATH";
  return "LOWEST_BINDING_ID";
}

function exportRow(
  input: {
    readonly remoteNodeId: NodeId;
    readonly owningSessionId: SessionId;
  },
  route: RouteAdvertisement,
  state: AdjRibOutRouteSnapshot["state"],
  fields: Partial<AdjRibOutRouteSnapshot> = {},
): AdjRibOutRouteSnapshot {
  return {
    remoteNodeId: input.remoteNodeId,
    owningSessionId: input.owningSessionId,
    endpoint: route.endpoint,
    originNodeId: route.originNodeId,
    path: immutableClone(route.path),
    state,
    ...fields,
  };
}

function exportRowForSession(
  session: StoredSession,
  route: RouteAdvertisement,
  state: AdjRibOutRouteSnapshot["state"],
  fields: Partial<AdjRibOutRouteSnapshot> = {},
): AdjRibOutRouteSnapshot {
  return exportRow({
    remoteNodeId: session.owner.remoteNodeId,
    owningSessionId: session.owner.localSessionId,
  }, route, state, fields);
}

function rejection(
  route: RouteAdvertisement,
  reasonCode: RouteRejectionCode,
): RouteRejection {
  return {
    endpoint: route.endpoint,
    originNodeId: route.originNodeId,
    reasonCode,
  };
}

function toAdvertisementSnapshot(
  value: StoredAdvertisement,
): AdvertisementSnapshot {
  return {
    advertisementId: value.advertisementId,
    endpoint: value.endpoint,
    originNodeId: value.originNodeId,
    owningSessionId: value.owner.localSessionId,
    advertisingNodeId: value.owner.remoteNodeId,
    remoteSessionId: value.owner.remoteSessionId,
    receivedPath: value.receivedPath,
    receivedRevision: value.receivedRevision,
    receivedAt: value.receivedAt,
  };
}

function compareInternalCandidatesForOperations(
  left: InternalCandidate,
  right: InternalCandidate,
): number {
  const endpoint = compareUtf8(left.snapshot.endpoint, right.snapshot.endpoint);
  return endpoint
    || compareCandidates(left.snapshot, right.snapshot)
    || compareUtf8(left.snapshot.routeId, right.snapshot.routeId);
}

function compareAdvertisements(
  left: AdvertisementSnapshot,
  right: AdvertisementSnapshot,
): number {
  return compareUtf8(left.endpoint, right.endpoint)
    || compareUtf8(left.originNodeId, right.originNodeId)
    || comparePaths(left.receivedPath, right.receivedPath)
    || compareUtf8(left.owningSessionId, right.owningSessionId);
}

function compareSelected(
  left: SelectedRouteSnapshot,
  right: SelectedRouteSnapshot,
): number {
  return compareUtf8(left.endpoint, right.endpoint);
}

function compareSessions(left: StoredSession, right: StoredSession): number {
  return compareUtf8(left.owner.remoteNodeId, right.owner.remoteNodeId)
    || compareUtf8(left.owner.localSessionId, right.owner.localSessionId);
}

function compareOutboundUpdates(
  left: OutboundRouteUpdate,
  right: OutboundRouteUpdate,
): number {
  return compareUtf8(left.owner.remoteNodeId, right.owner.remoteNodeId)
    || compareUtf8(left.owner.localSessionId, right.owner.localSessionId);
}

function compareEpochClosures(
  left: ExportEpochClosure,
  right: ExportEpochClosure,
): number {
  return compareUtf8(left.controllerId, right.controllerId)
    || compareUtf8(left.endpoint, right.endpoint)
    || compareUtf8(left.originNodeId, right.originNodeId)
    || left.epoch - right.epoch;
}

export function compareRouteAdvertisements(
  left: Pick<RouteAdvertisement, "endpoint" | "originNodeId" | "path">,
  right: Pick<RouteAdvertisement, "endpoint" | "originNodeId" | "path">,
): number {
  return compareUtf8(left.endpoint, right.endpoint)
    || compareUtf8(left.originNodeId, right.originNodeId)
    || comparePaths(left.path, right.path);
}

function compareRouteRejections(
  left: RouteRejection,
  right: RouteRejection,
): number {
  return compareUtf8(left.endpoint, right.endpoint)
    || compareUtf8(left.originNodeId, right.originNodeId);
}

export function compareRouteExportRows(
  left: AdjRibOutRouteSnapshot,
  right: AdjRibOutRouteSnapshot,
): number {
  const stateRank = ["desired", "outstanding", "acked", "rejected", "suppressed"];
  const localRank = [
    undefined,
    "TRANSIT_DISABLED",
    "PEER_IN_PATH",
    "PATH_TOO_LONG",
    "CAPACITY",
  ];
  const remoteRank = [undefined, "LOOP", "PATH_TOO_LONG", "POLICY", "CAPACITY"];
  return compareUtf8(left.remoteNodeId, right.remoteNodeId)
    || compareUtf8(left.owningSessionId, right.owningSessionId)
    || compareUtf8(left.endpoint, right.endpoint)
    || compareUtf8(left.originNodeId, right.originNodeId)
    || comparePaths(left.path, right.path)
    || stateRank.indexOf(left.state) - stateRank.indexOf(right.state)
    || compareOptionalNumber(left.revision, right.revision)
    || localRank.indexOf(left.reasonCode) - localRank.indexOf(right.reasonCode)
    || remoteRank.indexOf(left.remoteRejectionCode)
      - remoteRank.indexOf(right.remoteRejectionCode)
    || compareOptionalNumber(left.remoteRetryAttempt, right.remoteRetryAttempt)
    || compareOptionalInstant(left.remoteRetryAt, right.remoteRetryAt);
}

function comparePaths(
  left: readonly string[],
  right: readonly string[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined || b === undefined) break;
    const compared = compareUtf8(a, b);
    if (compared !== 0) return compared;
  }
  return left.length - right.length;
}

function compareOptionalNumber(
  left: number | undefined,
  right: number | undefined,
): number {
  if (left === undefined) return right === undefined ? 0 : -1;
  if (right === undefined) return 1;
  return left - right;
}

function compareOptionalInstant(
  left: Timestamp | undefined,
  right: Timestamp | undefined,
): number {
  if (left === undefined) return right === undefined ? 0 : -1;
  if (right === undefined) return 1;
  return Date.parse(left) - Date.parse(right);
}

function routeTuple(
  route: Pick<RouteAdvertisement, "endpoint" | "originNodeId" | "path">,
): string {
  return JSON.stringify([route.endpoint, route.originNodeId, route.path]);
}

function routeKey(endpoint: EndpointName, originNodeId: NodeId): string {
  return JSON.stringify([endpoint, originNodeId]);
}

function pairKey(remoteNodeId: NodeId, localSessionId: SessionId): string {
  return JSON.stringify([remoteNodeId, localSessionId]);
}

function routeSetsEqual(
  left: readonly RouteAdvertisement[],
  right: readonly RouteAdvertisement[],
): boolean {
  return left.length === right.length
    && left.every((route, index) => {
      const other = right[index];
      return other !== undefined && compareRouteAdvertisements(route, other) === 0;
    });
}

function pathsEqual(left: readonly NodeId[], right: readonly NodeId[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function ownersEqual(left: ExactSessionOwner, right: ExactSessionOwner): boolean {
  return left.controllerId === right.controllerId
    && left.remoteNodeId === right.remoteNodeId
    && left.localSessionId === right.localSessionId
    && left.remoteSessionId === right.remoteSessionId;
}

function validateOwner(owner: ExactSessionOwner): void {
  requireString(owner.controllerId, "controllerId");
  requireString(owner.remoteNodeId, "remoteNodeId");
  if (
    !SESSION_ID_PATTERN.test(owner.localSessionId)
    || !SESSION_ID_PATTERN.test(owner.remoteSessionId)
  ) {
    throw new AgpError(
      "INTERNAL",
      "RoutingTable.sessionOwner",
      "session IDs must be six lowercase hexadecimal characters",
    );
  }
}

function validateEndpoint(value: EndpointName): EndpointName {
  if (!ENDPOINT_PATTERN.test(value)) {
    throw new AgpError(
      "ENDPOINT_INVALID",
      "RoutingTable.endpoint",
      "invalid endpoint name",
    );
  }
  return value;
}

function positiveSafe(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgpError(
      "CONFIG_INVALID",
      "RoutingTable.constructor",
      `${name} must be a positive safe integer`,
    );
  }
  return value;
}

function requireString(value: string, name: string): string {
  if (value.length === 0) {
    throw new AgpError(
      "CONFIG_INVALID",
      "RoutingTable",
      `${name} must be non-empty`,
    );
  }
  return value;
}
