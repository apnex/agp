import {
  ManualClock,
  OperationsStore,
  RoutingTable,
  SequenceIdSource,
  createPeerSessionState,
  reducePeerSession,
} from "../../dist/index.js";

export const ids = () => new SequenceIdSource("spec");
export const clock = () => new ManualClock({
  wallTime: "2026-07-30T00:00:00.000Z",
});

export function owner(
  controllerId = "controller-a",
  remoteNodeId = "peer.a",
  localSessionId = "000001",
  remoteSessionId = "000002",
) {
  return { controllerId, remoteNodeId, localSessionId, remoteSessionId };
}

export function route(endpoint, originNodeId, path) {
  return { endpoint, originNodeId, path };
}

export function table(options = {}) {
  return new RoutingTable({
    nodeId: "node.local",
    ids: ids(),
    clock: clock(),
    transitEnabled: true,
    maxCandidateRoutes: 64,
    ...options,
  });
}

export function establish(rib, value = owner(), options = {}) {
  rib.establishSession({
    owner: value,
    maxPathLength: 16,
    maxRoutesPerSnapshot: 16,
    ...options,
  });
  return value;
}

export function establishedMachine(direction = "outbound") {
  const acquisition = direction === "outbound"
    ? { kind: "dial", adjacencyId: "adj-a" }
    : { kind: "accept", listenerId: "listener-a" };
  let state = createPeerSessionState({
    controllerId: `controller-${direction}`,
    localNodeId: "node.local",
    acquisition,
  });
  const step = (input) => {
    const reduction = reducePeerSession(state, input);
    state = reduction.state;
    return reduction;
  };
  step({
    type: direction === "outbound" ? "StartDial" : "StartAccept",
    localSessionId: "000001",
  });
  step({
    type: direction === "outbound"
      ? "TransportOpened"
      : "TransportAccepted",
  });
  step({ type: "OpenReceived", continuationToken: "identity-1" });
  step({
    type: "IdentityAdmissionResolved",
    continuationToken: "identity-1",
    admissionAllowed: true,
    admissionResultValid: true,
    collisionWinner: true,
    remoteNodeId: "peer.a",
    remoteSessionId: "000002",
    negotiated: {
      holdTimeMs: 30_000,
      keepaliveTimeMs: 10_000,
      peerReceiveLimitBytes: 65536,
      maxRoutesPerSnapshot: 64,
      maxPathLength: 16,
      maxHopCount: 16,
      transit: true,
    },
  });
  step({ type: "KeepaliveReceived" });
  return { get state() { return state; }, step };
}

export function operations(clockValue = clock()) {
  return new OperationsStore({
    nodeId: "node.local",
    instanceId: "instance-1",
    clock: clockValue,
    configuration: { raw: {}, effective: {}, redactedKeys: [] },
  });
}

export function emptyQueue() {
  return {
    currentMessages: "0",
    maximumMessages: "8",
    highWaterMessages: "0",
    currentBytes: "0",
    maximumBytes: "8192",
    highWaterBytes: "0",
  };
}

export function operationalSession(overrides = {}) {
  const queue = emptyQueue();
  return {
    identityState: "admitted",
    sessionId: "000001",
    remoteNodeId: "peer.a",
    remoteSessionId: "000002",
    direction: "outbound",
    state: "Established",
    stateSince: "2026-07-30T00:00:00.000Z",
    establishedAt: "2026-07-30T00:00:00.000Z",
    establishedMonotonicMs: 0,
    lastTransition: {
      event: "KeepaliveReceived",
      from: "OpenConfirm",
      to: "Established",
      at: "2026-07-30T00:00:00.000Z",
    },
    timers: [{
      name: "hold",
      state: "armed",
      startedAt: "2026-07-30T00:00:00.000Z",
      durationMs: 30_000,
      expiresAt: "2026-07-30T00:00:30.000Z",
      deadlineMonotonicMs: 30_000,
    }],
    queues: { control: queue, data: queue, continuation: queue },
    routeImport: { consumedRevision: 0, routeCount: 0 },
    routeExport: { routeDecisions: [], nextRevision: 1 },
    returnTokenAllocator: {
      allocated: "0",
      exhausted: false,
      maximum: "18446744073709551615",
    },
    ...overrides,
  };
}
