import {
  LabelTable,
  DataPlane,
  EndpointRegistry,
  HandlerLedger,
  DispositionEngine,
  SerializedExecutor,
  SessionWriter,
  Uint64ReturnTokenAllocator,
} from "../../dist/index.js";
import {
  fakeConnection,
  fakeController,
} from "./fakes.js";

export function createDataPlaneHarness(overrides = {}) {
  const nodeId = "local.example";
  const selected = new Map();
  const forwarding = new Map();
  const feasible = new Set();
  const acked = new Set();
  const epochs = new Map();
  const controllers = new Map();
  const endpoints = new EndpointRegistry(overrides.maximumEndpoints ?? 8);
  const handlers = new HandlerLedger({
    maximumConcurrent: overrides.maximumHandlers ?? 8,
    maximumBytes: overrides.maximumHandlerBytes ?? 64_000,
  });
  const labelBindings = new LabelTable({
    maximumEntries: overrides.maximumLabelBindings ?? 8,
    maximumBytes: overrides.maximumLabelBindingBytes ?? 64_000,
    onCapacity: overrides.onCapacity ?? "refuse",
  }, () => now);
  const commits = [];
  const localErrors = [];
  let revision = 0;
  let messageSequence = 0;
  let now = 1_000;
  const executor = new SerializedExecutor();
  const routing = {
    selectedRoute: (endpoint) => selected.get(endpoint),
    forwardingEntry: (endpoint) => forwarding.get(endpoint),
    feasibleSource: (ingress, source) =>
      feasible.has(sourceKey(ingress.controllerId, source)),
    hasAckedSource: (egress, source) =>
      acked.has(sourceKey(egress.controllerId, source)),
    sourceExportEpoch: (egress, source) =>
      epochs.get(sourceKey(egress.controllerId, source)),
  };
  // Timers are held rather than run, so a test decides when a batch is sent
  // and never races a real debounce interval.
  const scheduled = [];
  const dispositions = new DispositionEngine({
    localNodeId: nodeId,
    labelBindings,
    batch: {
      debounceMs: overrides.debounceMs ?? 50,
      maximumOutcomes: overrides.maximumOutcomes ?? 256,
      maximumInboundOutcomes: overrides.maximumInboundOutcomes ?? 4096,
    },
    monotonicNow: () => now,
    nextMessageId: () => `disposition-${++messageSequence}`,
    schedule: (delayMs, callback) => {
      const entry = { delayMs, callback, cancelled: false };
      scheduled.push(entry);
      return { cancel: () => { entry.cancelled = true; } };
    },
    encode: (message) =>
      new TextEncoder().encode(JSON.stringify(message)),
    publishLocal: (outcome) => localErrors.push(outcome),
    onWriteFailure: (controller, cause) => {
      throw cause;
    },
  });
  const exhausted = [];
  const plane = new DataPlane({
    localNodeId: nodeId,
    transitEnabled: overrides.transitEnabled ?? true,
    defaultHopLimit: overrides.defaultHopLimit ?? 8,
    labelBindingLifetimeMs: 30_000,
    routing,
    sessions: {
      resolve(node, session) {
        return controllers.get(`${node}@${session}`);
      },
    },
    endpoints,
    handlers,
    labelBindings,
    dispositions,
    executor,
    nextMessageId: () => `data-${++messageSequence}`,
    wallTime: () => "2026-07-30T00:00:00.000Z",
    monotonicNow: () => now,
    commit: {
      commit(input) {
        revision += 1;
        commits.push({ ...input, revision: String(revision) });
        return String(revision);
      },
    },
    onTokenExhausted(controller) {
      exhausted.push(controller);
      controller.terminate("return-token-exhausted");
    },
  });

  return {
    nodeId,
    plane,
    routing,
    endpoints,
    handlers,
    labelBindings,
    dispositions,
    scheduled,
    selected,
    forwarding,
    feasible,
    acked,
    epochs,
    controllers,
    commits,
    localErrors,
    exhausted,
    executor,
    advance(ms) {
      now += ms;
    },
    /** Send every pending disposition batch, as the debounce timer would. */
    flushDispositions() {
      dispositions.flushAll();
    },
    expose(endpoint, handler = async () => {}) {
      return endpoints.register({
        endpoint,
        bindingId: `binding:${endpoint}`,
        registeredAt: "2026-07-30T00:00:00.000Z",
        handler,
      });
    },
    installSelected(route) {
      selected.set(route.endpoint, route);
      forwarding.set(route.endpoint, {
        endpoint: route.endpoint,
        selectedRouteId: route.routeId,
        originNodeId: route.originNodeId,
        nextHop: route.nextHop,
        resolvedAtRevision: String(revision),
      });
    },
    makeController(input = {}) {
      const base = fakeController({
        remoteNodeId: input.remoteNodeId ?? "peer.example",
        owningSessionId: input.owningSessionId ?? "000001",
      });
      const connection = fakeConnection();
      const controller = {
        ...base,
        owner: {
          controllerId: input.controllerId ?? `controller:${base.remoteNodeId}`,
          remoteNodeId: base.remoteNodeId,
          localSessionId: base.owningSessionId,
          remoteSessionId: input.remoteSessionId ?? "0000ff",
        },
        writer: new SessionWriter(connection.connection, {
          maximumQueuedDataMessages: input.maximumQueuedDataMessages ?? 8,
          maximumQueuedDataBytes: input.maximumQueuedDataBytes ?? 64_000,
          maximumQueuedControlMessages: 8,
        }),
        returnTokens: input.returnTokens ?? new Uint64ReturnTokenAllocator(),
        peerReceiveLimitBytes: input.peerReceiveLimitBytes ?? 1_048_576,
        maximumDataHopLimit: input.maximumDataHopLimit ?? 8,
        dataWrites: connection.writes,
      };
      controllers.set(
        `${controller.remoteNodeId}@${controller.owningSessionId}`,
        controller,
      );
      return controller;
    },
    authorizeFeasible(controller, source) {
      feasible.add(sourceKey(controller.owner.controllerId, source));
    },
    acknowledgeSource(controller, source, epoch = "epoch-1") {
      const key = sourceKey(controller.owner.controllerId, source);
      acked.add(key);
      epochs.set(key, epoch);
    },
  };
}

export function dataMessage(overrides = {}) {
  return {
    agp: 1,
    plane: "data",
    type: "message",
    id: overrides.id ?? "incoming-1",
    body: {
      source: overrides.source ?? {
        endpoint: "demo/source",
        originNodeId: "origin.example",
      },
      destination: overrides.destination ?? "demo/destination",
      returnToken: overrides.returnToken ?? "00000000000000aa",
      hopLimit: overrides.hopLimit ?? 4,
      payload: overrides.payload ?? {},
    },
  };
}

function sourceKey(controllerId, source) {
  return `${controllerId}\0${source.endpoint}\0${source.originNodeId}`;
}
