import { createNode } from "@agp/node";

export function createChaosNode(network, description) {
  const listenerRef = description.listen === undefined
    ? undefined
    : `listen.${description.listen.port}`;
  const peers = (description.peers ?? []).map(
    ({ url: _url, ...configuredPeer }) => configuredPeer,
  );
  return createNode(
    nodeConfig({
      ...description,
      ...(listenerRef === undefined
        ? {}
        : { listen: { transportRef: listenerRef } }),
      peers,
    }),
    {
      transport: network.transport(description.nodeId, {
        listeners: listenerRef === undefined
          ? []
          : [[listenerRef, chaosUrl(description.listen.port)]],
        targets: (description.peers ?? []).map((peer) => [
          peer.transportRef,
          peer.url,
        ]),
      }),
      ids: new DeterministicIdSource(
        description.idNamespace ?? description.nodeId,
      ),
      ...(description.dependencies ?? {}),
    },
  );
}

export function nodeConfig({
  nodeId,
  listen,
  peers = [],
  transit = true,
  defaultHopLimit = 16,
  holdTimeMs = 0,
  routeAckTimeoutMs = 150,
  capacity = {},
  limits = {},
}) {
  return {
    nodeId,
    ...(listen === undefined ? {} : { listen }),
    ...(peers.length === 0 ? {} : { peers }),
    transit: { enabled: transit, defaultHopLimit },
    identityAdmission: { mode: "allow" },
    routeAdmission: { mode: "allow" },
    timers: {
      holdTimeMs,
      openTimeoutMs: 250,
      routeWriteTimeoutMs: 250,
      routeAckTimeoutMs,
      transportWriteTimeoutMs: 250,
      transportCloseTimeoutMs: 250,
    },
    limits: {
      receiveLimitBytes: 262_144,
      maxRoutesPerSnapshot: 256,
      maxPathLength: 16,
      maxHopCount: 16,
      maxLocalEndpoints: 64,
      maxCandidateRoutes: 1024,
      ...limits,
    },
    capacity: {
      maxSessions: 16,
      maxPendingHandshakes: 16,
      controlQueueMessages: 256,
      controlQueueBytes: 1_048_576,
      dataQueueMessages: 256,
      dataQueueBytes: 1_048_576,
      continuationQueueMessages: 256,
      continuationQueueBytes: 1_048_576,
      maxActiveHandlers: 32,
      maxActiveHandlerBytes: 1_048_576,
      maxLabelBindings: 1024,
      maxEventSubscribers: 16,
      eventSubscriberBuffer: 256,
      ...capacity,
    },
  };
}

export function listen(port) {
  return { host: "chaos", port, path: "/agp" };
}

export function peer(adjacencyId, expectedNodeId, port, reconnect = true) {
  return {
    adjacencyId,
    expectedNodeId,
    transportRef: `peer.${adjacencyId}`,
    url: chaosUrl(port),
    reconnect: {
      enabled: reconnect,
      initialDelayMs: 5,
      maximumDelayMs: 25,
      multiplier: 1,
      jitterRatio: 0,
    },
  };
}

function chaosUrl(port) {
  return `chaos://network/port-${port}`;
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

export function barrier(name) {
  let reach;
  let release;
  const reached = new Promise((resolve) => {
    reach = resolve;
  });
  const released = new Promise((resolve) => {
    release = resolve;
  });
  return Object.freeze({
    name,
    reached,
    released,
    reach(value = name) {
      reach(value);
    },
    release(value = name) {
      release(value);
    },
  });
}

export async function eventually(probe, description, attempts = 1_000) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = probe();
      if (result !== undefined && result !== false) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(
    `did not observe ${description}`
      + (lastError instanceof Error ? `: ${lastError.message}` : ""),
  );
}

export function waitForSnapshot(node, predicate, description, attempts) {
  return eventually(() => {
    const snapshot = node.operations.snapshot();
    return predicate(snapshot) ? snapshot : undefined;
  }, description, attempts);
}

export function waitForDelivery(deliveries, count, description, attempts) {
  return eventually(
    () => deliveries.length >= count ? deliveries[count - 1] : undefined,
    description,
    attempts,
  );
}

export async function nextEvent(subscription, predicate, description) {
  for await (const event of subscription) {
    if (predicate(event)) return event;
  }
  throw new Error(`event stream ended before ${description}`);
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

export async function stopAll(...nodes) {
  await Promise.allSettled(
    nodes.filter(Boolean).reverse().map((node) =>
      node.stop({ drainTimeoutMs: 250 })
    ),
  );
}

class DeterministicIdSource {
  #namespace;
  #byScope = new Map();

  constructor(namespace) {
    this.#namespace = namespace;
  }

  next(scope) {
    const value = (this.#byScope.get(scope) ?? 0) + 1;
    this.#byScope.set(scope, value);
    if (scope === "session") return value.toString(16).padStart(6, "0");
    return `${scope}:${this.#namespace}:${value}`;
  }
}
