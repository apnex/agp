import http from "node:http";

const capturedAt = "2026-07-30T06:00:00.000Z";

export function createOperationsFixture(overrides = {}) {
  const snapshots = createSnapshots();
  const queryNames = [
    "snapshot",
    "configuration",
    "lifecycle",
    "listener",
    "adjacencies",
    "endpoints",
    "connections",
    "advertisements",
    "routes",
    "forwarding",
    "routeExports",
    "labelBindings",
    "resources",
    "counters",
    "events",
  ];
  const calls = Object.fromEntries(queryNames.map((name) => [name, 0]));

  const invoke = (name, fallback) => {
    calls[name] += 1;
    const override = overrides[name];
    return typeof override === "function" ? override() : fallback;
  };

  const operations = {
    snapshot: () => invoke("snapshot", snapshots.aggregate),
    configuration: () =>
      invoke("configuration", snapshots.configurationQuery),
    lifecycle: () => invoke("lifecycle", snapshots.lifecycleQuery),
    listener: () => invoke("listener", snapshots.listenerQuery),
    adjacencies: () => invoke("adjacencies", snapshots.adjacencies),
    endpoints: () => invoke("endpoints", snapshots.endpoints),
    connections: () => invoke("connections", snapshots.connections),
    advertisements: () =>
      invoke("advertisements", snapshots.advertisements),
    routes: () => invoke("routes", snapshots.routes),
    forwarding: () => invoke("forwarding", snapshots.forwarding),
    routeExports: () => invoke("routeExports", snapshots.routeExports),
    labelBindings: () =>
      invoke("labelBindings", snapshots.labelBindings),
    resources: () => invoke("resources", snapshots.resourcesQuery),
    counters: () => invoke("counters", snapshots.countersQuery),
    events: () => {
      calls.events += 1;
      return {
        close() {},
        next: async () => ({ done: true, value: undefined }),
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },
  };

  return {
    calls,
    operations,
    snapshots,
    resetCalls() {
      for (const name of Object.keys(calls)) calls[name] = 0;
    },
  };
}

export function createSnapshots() {
  const meta = {
    schemaVersion: "agp.operations/v1",
    nodeId: "node.management",
    instanceId: "instance-1",
    capturedAt,
    revision: "7",
  };
  const configuration = {
    raw: {
      nodeId: "node.management",
      transit: { enabled: true },
    },
    effective: {
      nodeId: "node.management",
      transit: { enabled: true },
    },
    redactedKeys: [],
  };
  const lifecycle = {
    state: "Running",
    stateSince: capturedAt,
    startedAt: capturedAt,
  };
  const listener = {
    configured: false,
    state: "disabled",
  };
  const localEndpoint = {
    endpoint: "demo/service",
    bindingId: "binding-1",
    registeredAt: capturedAt,
    active: true,
  };
  const candidate = {
    routeId: "route-1",
    endpoint: "demo/service",
    originNodeId: "node.management",
    routeClass: "local",
    source: { kind: "local", bindingId: "binding-1" },
    path: ["node.management"],
    nextHop: { kind: "local", bindingId: "binding-1" },
    eligible: true,
    selectionStatus: "selected",
    selectionReason: "ONLY_ELIGIBLE",
    installedAt: capturedAt,
  };
  const selected = {
    endpoint: "demo/service",
    routeId: "route-1",
    originNodeId: "node.management",
    routeClass: "local",
    sourceKind: "local",
    path: ["node.management"],
    nextHop: { kind: "local", bindingId: "binding-1" },
    selectionReason: "ONLY_ELIGIBLE",
    selectedAt: capturedAt,
  };
  const forwardingEntry = {
    endpoint: "demo/service",
    selectedRouteId: "route-1",
    originNodeId: "node.management",
    nextHop: { kind: "local", bindingId: "binding-1" },
    resolvedAtRevision: "7",
  };
  const resources = {
    gauges: {
      sessions: { current: "0", maximum: "16", highWater: "0" },
    },
  };
  const counters = {
    values: {
      "message.accepted": "2",
    },
  };
  const aggregate = {
    ...meta,
    configuration,
    lifecycle,
    listener,
    adjacencies: [],
    localEndpoints: [localEndpoint],
    connections: [],
    advertisements: [],
    candidateRoutes: [candidate],
    selectedRoutes: [selected],
    forwarding: [forwardingEntry],
    routeExports: [],
    labelBindings: [],
    resources,
    counters,
  };

  return {
    meta,
    configuration,
    configurationQuery: { ...meta, ...configuration },
    lifecycle,
    lifecycleQuery: { ...meta, ...lifecycle },
    listener,
    listenerQuery: { ...meta, ...listener },
    aggregate,
    adjacencies: { ...meta, items: [] },
    endpoints: { ...meta, items: [localEndpoint] },
    connections: { ...meta, items: [] },
    advertisements: { ...meta, items: [] },
    routes: { ...meta, candidates: [candidate], selected: [selected] },
    forwarding: { ...meta, items: [forwardingEntry] },
    routeExports: { ...meta, items: [] },
    labelBindings: { ...meta, items: [] },
    resources,
    resourcesQuery: { ...meta, ...resources },
    counters,
    countersQuery: { ...meta, ...counters },
  };
}

export function requestManagement(
  baseUrl,
  {
    path = "/v1/health",
    method = "GET",
    headers = {},
    body,
  } = {},
) {
  const target = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path,
        method,
        headers,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.once("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              text,
              json: text === "" ? undefined : JSON.parse(text),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.once("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}
