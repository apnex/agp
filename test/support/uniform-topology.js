import { createNode } from "@agp/node";
import { createLoopbackFabric } from "@agp/transport-loopback";
import { createNodeWsTransport } from "@agp/transport-node-ws";

const topologyFabric = createLoopbackFabric({
  fabricId: "agp-topology-tests",
  limits: {
    maxTransports: 2_048,
    maxListeners: 512,
    maxPendingAcquisitions: 2_048,
    maxActiveChannels: 512,
    maxPacketBytes: 16_777_216,
    maxBufferedPacketsPerChannel: 1_024,
    maxBufferedBytesPerChannel: 33_554_432,
    maxQueuedPacketsTotal: 65_536,
    maxQueuedBytesTotal: 268_435_456,
    maxPendingSendBytesTotal: 17_179_869_184,
  },
});
let topologyTransportSequence = 0;

export function uniformConfig({
  nodeId,
  listen,
  peers = [],
  transit = true,
  holdTimeMs = 0,
  receiveLimitBytes = 262_144,
  maxPathLength = 16,
  routeAdmissionMode = "allow",
  // Volumetric tests raise these; the default suite leaves them alone.
  maxLocalEndpoints = 64,
  maxRoutesPerSnapshot = 256,
  maxCandidateRoutes = 1024,
  maxActiveHandlers = 32,
  dataQueueMessages = 256,
  maxReverseCorrelations = 1024,
  transportReceivePackets,
  eventSubscriberBuffer = 256,
}) {
  return {
    nodeId,
    ...(listen === undefined ? {} : { listen }),
    ...(peers.length === 0 ? {} : { peers }),
    transit: { enabled: transit, defaultHopLimit: 16 },
    identityAdmission: { mode: "allow" },
    routeAdmission: { mode: routeAdmissionMode },
    timers: {
      holdTimeMs,
      openTimeoutMs: 2_000,
      routeAckTimeoutMs: 2_000,
    },
    limits: {
      receiveLimitBytes,
      maxRoutesPerSnapshot,
      maxPathLength,
      maxHopCount: 16,
      maxLocalEndpoints,
      maxCandidateRoutes,
    },
    capacity: {
      maxSessions: 16,
      maxPendingHandshakes: 16,
      ...(transportReceivePackets === undefined ? {} : { transportReceivePackets }),
      controlQueueMessages: 256,
      dataQueueMessages,
      dataQueueBytes: 1_048_576,
      maxActiveHandlers,
      maxActiveHandlerBytes: 1_048_576,
      maxReverseCorrelations,
      maxEventSubscribers: 16,
      eventSubscriberBuffer,
    },
  };
}

export function memoryListen(port) {
  return { host: "loopback", port, path: "/agp" };
}

export function memoryPeer(adjacencyId, expectedNodeId, port) {
  return {
    adjacencyId,
    expectedNodeId,
    transportRef: `peer.${adjacencyId}`,
    url: `loopback://agp-topology-tests/port-${port}`,
    reconnect: {
      enabled: true,
      initialDelayMs: 5,
      maximumDelayMs: 50,
      multiplier: 2,
      jitterRatio: 0,
    },
  };
}

export function createLoopbackNode(description) {
  const sequence = ++topologyTransportSequence;
  const transportName = `node-${sequence}-${description.nodeId}`;
  const listenerRef = `listener.${sequence}`;
  const listenerAddress = `node-${sequence}`;
  const normalizedPeers = normalizePeers(description.peers, true);
  const builder = topologyFabric.createTransport({
    transportName,
    capabilities: {
      listen: description.listen !== undefined,
      connect: normalizedPeers.length > 0,
    },
  });
  const transport = builder.createPort({
    listeners: description.listen === undefined
      ? new Map()
      : new Map([[
        listenerRef,
        {
          fabricId: topologyFabric.fabricId,
          address: listenerAddress,
        },
      ]]),
    targets: new Map(normalizedPeers.map(({ config, targetAddress }) => [
      config.transportRef,
      {
        fabricId: topologyFabric.fabricId,
        address: targetAddress,
      },
    ])),
  });
  return createComposedNode(
    description,
    {
      ...(description.listen === undefined
        ? {}
        : { listen: { transportRef: listenerRef } }),
      peers: normalizedPeers.map(({ config }) => config),
    },
    transport,
  );
}

export function createWebSocketNode(description) {
  const sequence = ++topologyTransportSequence;
  const listenerRef = `listener.${sequence}`;
  const normalizedPeers = normalizePeers(description.peers, false);
  const listeners = description.listen === undefined
    ? []
    : [{
        transportRef: listenerRef,
        url: webSocketListenerUrl(description.listen),
        compression: { mode: "disabled" },
        security: { mode: "trusted-development" },
      }];
  const targets = normalizedPeers.map(({ config, locator }) => ({
    transportRef: config.transportRef,
    url: locator,
    compression: { mode: "disabled" },
    security: { mode: "trusted-development" },
  }));
  const transport = createNodeWsTransport({ listeners, targets });
  return createComposedNode(
    description,
    {
      ...(description.listen === undefined
        ? {}
        : { listen: { transportRef: listenerRef } }),
      peers: normalizedPeers.map(({ config }) => config),
    },
    transport,
  );
}

class DeterministicIdSource {
  #nodeId;
  #byScope = new Map();

  constructor(nodeId) {
    this.#nodeId = nodeId;
  }

  next(scope) {
    const value = (this.#byScope.get(scope) ?? 0) + 1;
    this.#byScope.set(scope, value);
    if (scope === "session") return value.toString(16).padStart(6, "0");
    return `${scope}-${this.#nodeId}-${value}`;
  }
}

export async function expose(node, endpoints, deliveries = []) {
  const bindings = [];
  for (const endpoint of endpoints) {
    bindings.push(await node.expose(endpoint, (payload, context) => {
      deliveries.push({ endpoint, payload, context });
    }));
  }
  return bindings;
}

export async function eventually(probe, description, timeoutMs = 5_000) {
  const deadline = performance.now() + timeoutMs;
  let lastError;
  while (performance.now() < deadline) {
    try {
      const result = probe();
      if (result !== undefined && result !== false) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(
    `did not observe ${description}`
      + (lastError instanceof Error ? `: ${lastError.message}` : ""),
  );
}

export function waitForSnapshot(node, predicate, description, timeoutMs) {
  return eventually(() => {
    const snapshot = node.operations.snapshot();
    return predicate(snapshot) ? snapshot : undefined;
  }, description, timeoutMs);
}

export function waitForDelivery(deliveries, count, description, timeoutMs) {
  return eventually(
    () => deliveries.length >= count ? deliveries[count - 1] : undefined,
    description,
    timeoutMs,
  );
}

export function selectedRoute(node, endpoint) {
  return node.operations.snapshot().selectedRoutes.find(
    (route) => route.endpoint === endpoint,
  );
}

export function establishedWith(node, remoteNodeId) {
  return node.operations.snapshot().connections.some(
    (session) =>
      session.identityState === "admitted"
      &&
      session.remoteNodeId === remoteNodeId
      && session.state === "Established",
  );
}

export function hasAckedExport(node, endpoint, remoteNodeId) {
  return node.operations.snapshot().routeExports.some(
    (route) =>
      route.endpoint === endpoint
      && route.remoteNodeId === remoteNodeId
      && route.state === "acked",
  );
}

export async function stopAll(...nodes) {
  await Promise.allSettled(
    nodes.filter(Boolean).reverse().map((node) =>
      node.stop({ drainTimeoutMs: 500 })
    ),
  );
}

function createComposedNode(description, topology, transport) {
  return createNode(
    uniformConfig({
      ...description,
      ...topology,
    }),
    {
      ids: new DeterministicIdSource(
        description.idNamespace ?? description.nodeId,
      ),
      ...(description.dependencies ?? {}),
      transport,
    },
  );
}

function normalizePeers(peers = [], loopback) {
  return peers.map((peer) => {
    const {
      url,
      adjacencyId,
      expectedNodeId,
      transportRef = `peer.${adjacencyId}`,
      reconnect,
    } = peer;
    if (typeof url !== "string") {
      throw new Error(`peer ${adjacencyId} requires one adapter locator`);
    }
    return {
      config: {
        adjacencyId,
        expectedNodeId,
        transportRef,
        ...(reconnect === undefined ? {} : { reconnect }),
      },
      locator: url,
      ...(loopback ? { targetAddress: loopbackTargetAddress(url) } : {}),
    };
  });
}

function loopbackTargetAddress(publication) {
  let url;
  try {
    url = new URL(publication);
  } catch {
    throw new Error(`invalid Loopback listener publication: ${publication}`);
  }
  if (
    url.protocol !== "loopback:"
    || url.hostname !== topologyFabric.fabricId
    || url.pathname.length < 2
  ) {
    throw new Error(`foreign Loopback listener publication: ${publication}`);
  }
  return decodeURIComponent(url.pathname.slice(1));
}

function webSocketListenerUrl(listen) {
  if (
    typeof listen !== "object"
    || listen === null
    || typeof listen.host !== "string"
    || !Number.isSafeInteger(listen.port)
  ) {
    throw new Error("WebSocket listener test configuration is invalid");
  }
  return `ws://${listen.host}:${listen.port}${listen.path ?? "/"}`;
}
