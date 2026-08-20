import {
  createLoopbackNode,
  expose,
  memoryPeer,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "../../support/uniform-topology.js";
import {
  IndependentProcessTopology,
  LINE_ENDPOINTS,
  STAR_ENDPOINTS,
  eventuallyProcess,
  getProcessManagement,
  startIndependentLine,
  startIndependentStar,
} from "./independent-processes.js";

export async function captureLoopbackStar() {
  const hub = createLoopbackNode({
    nodeId: "hub",
    listen: { host: "loopback", port: 15101, path: "/agp" },
    transit: true,
    ...equivalenceProtocolLimits(),
  });
  let alpha;
  let beta;
  const betaDeliveries = [];
  try {
    await expose(hub, STAR_ENDPOINTS.hub);
    const started = await hub.start();
    const address = started.listener.publication.displayAddress;
    alpha = createLoopbackNode({
      nodeId: "spoke.alpha",
      peers: [{
        ...memoryPeer("to-hub", "hub", 15101),
        url: address,
      }],
      transit: false,
      ...equivalenceProtocolLimits(),
    });
    beta = createLoopbackNode({
      nodeId: "spoke.beta",
      peers: [{
        ...memoryPeer("to-hub", "hub", 15101),
        url: address,
      }],
      transit: false,
      ...equivalenceProtocolLimits(),
    });
    await expose(alpha, STAR_ENDPOINTS.alpha);
    await expose(beta, STAR_ENDPOINTS.beta, betaDeliveries);
    await Promise.all([alpha.start(), beta.start()]);

    const [hubSnapshot, alphaSnapshot, betaSnapshot] = await Promise.all([
      waitForSnapshot(
        hub,
        (snapshot) =>
          hasSelected(snapshot, STAR_ENDPOINTS.all)
          && hasAcked(snapshot, STAR_ENDPOINTS.betaExclusive[0], "spoke.alpha")
          && exportsSettled(snapshot),
        "Loopback star hub convergence",
      ),
      waitForSnapshot(
        alpha,
        (snapshot) =>
          hasSelected(snapshot, STAR_ENDPOINTS.all)
          && hasAcked(snapshot, STAR_ENDPOINTS.alphaExclusive[0], "hub")
          && exportsSettled(snapshot),
        "Loopback star Alpha convergence",
      ),
      waitForSnapshot(
        beta,
        (snapshot) =>
          hasSelected(snapshot, STAR_ENDPOINTS.all)
          && hasAcked(snapshot, STAR_ENDPOINTS.betaExclusive[0], "hub")
          && exportsSettled(snapshot),
        "Loopback star Beta convergence",
      ),
    ]);
    const source = STAR_ENDPOINTS.alphaExclusive[0];
    const destination = STAR_ENDPOINTS.betaExclusive[0];
    const payload = { geometry: "star", transportInvariant: true };
    const receipt = await alpha.send(source, destination, payload, {
      correlationId: "transport-equivalence-star",
    });
    const delivered = await waitForDelivery(
      betaDeliveries,
      1,
      "Loopback star delivery",
    );
    return normalizeTopology(
      { hub: hubSnapshot, alpha: alphaSnapshot, beta: betaSnapshot },
      normalizeDelivery(receipt, delivered.payload, delivered.context.delivery),
    );
  } finally {
    await stopAll(beta, alpha, hub);
  }
}

export async function captureWebSocketStar() {
  const topology = await IndependentProcessTopology.create();
  try {
    const star = await startIndependentStar(topology);
    const [hubSnapshot, alphaSnapshot, betaSnapshot] = await Promise.all([
      processSnapshot(
        star.hub,
        (snapshot) =>
          hasSelected(snapshot, STAR_ENDPOINTS.all)
          && hasAcked(snapshot, STAR_ENDPOINTS.betaExclusive[0], "spoke.alpha")
          && exportsSettled(snapshot),
        "WebSocket star hub convergence",
      ),
      processSnapshot(
        star.alpha,
        (snapshot) =>
          hasSelected(snapshot, STAR_ENDPOINTS.all)
          && hasAcked(snapshot, STAR_ENDPOINTS.alphaExclusive[0], "hub")
          && exportsSettled(snapshot),
        "WebSocket star Alpha convergence",
      ),
      processSnapshot(
        star.beta,
        (snapshot) =>
          hasSelected(snapshot, STAR_ENDPOINTS.all)
          && hasAcked(snapshot, STAR_ENDPOINTS.betaExclusive[0], "hub")
          && exportsSettled(snapshot),
        "WebSocket star Beta convergence",
      ),
    ]);
    const source = STAR_ENDPOINTS.alphaExclusive[0];
    const destination = STAR_ENDPOINTS.betaExclusive[0];
    const payload = { geometry: "star", transportInvariant: true };
    const pending = star.beta.waitForDelivery(
      destination,
      "transport-equivalence-star",
    );
    const receipt = await star.alpha.send(source, destination, payload, {
      correlationId: "transport-equivalence-star",
    });
    const delivered = await pending;
    return normalizeTopology(
      { hub: hubSnapshot, alpha: alphaSnapshot, beta: betaSnapshot },
      normalizeDelivery(receipt, delivered.payload, delivered.delivery),
    );
  } finally {
    await topology.dispose();
  }
}

export async function captureLoopbackLine() {
  const a = createLoopbackNode({
    nodeId: "line.a",
    listen: { host: "loopback", port: 15201, path: "/agp" },
    transit: false,
    ...equivalenceProtocolLimits(),
  });
  let b;
  let c;
  const atA = [];
  const atC = [];
  try {
    await expose(a, [LINE_ENDPOINTS.a], atA);
    const startedA = await a.start();
    b = createLoopbackNode({
      nodeId: "line.b",
      listen: { host: "loopback", port: 15202, path: "/agp" },
      peers: [{
        ...memoryPeer("b-a", "line.a", 15201),
        url: startedA.listener.publication.displayAddress,
      }],
      transit: true,
      ...equivalenceProtocolLimits(),
    });
    const startedB = await b.start();
    c = createLoopbackNode({
      nodeId: "line.c",
      peers: [{
        ...memoryPeer("c-b", "line.b", 15202),
        url: startedB.listener.publication.displayAddress,
      }],
      transit: false,
      ...equivalenceProtocolLimits(),
    });
    await expose(c, [LINE_ENDPOINTS.c], atC);
    await c.start();
    const expected = [LINE_ENDPOINTS.a, LINE_ENDPOINTS.c];
    const [aSnapshot, bSnapshot, cSnapshot] = await Promise.all([
      waitForSnapshot(
        a,
        (snapshot) =>
          hasSelected(snapshot, expected)
          && hasAcked(snapshot, LINE_ENDPOINTS.a, "line.b")
          && exportsSettled(snapshot),
        "Loopback line A convergence",
      ),
      waitForSnapshot(
        b,
        (snapshot) =>
          hasSelected(snapshot, expected)
          && hasAcked(snapshot, LINE_ENDPOINTS.a, "line.c")
          && hasAcked(snapshot, LINE_ENDPOINTS.c, "line.a")
          && exportsSettled(snapshot),
        "Loopback line B convergence",
      ),
      waitForSnapshot(
        c,
        (snapshot) =>
          hasSelected(snapshot, expected)
          && hasAcked(snapshot, LINE_ENDPOINTS.c, "line.b")
          && exportsSettled(snapshot),
        "Loopback line C convergence",
      ),
    ]);
    const deliveries = await exerciseLoopbackLine(a, c, atA, atC);
    return normalizeTopology(
      { a: aSnapshot, b: bSnapshot, c: cSnapshot },
      deliveries,
    );
  } finally {
    await stopAll(c, b, a);
  }
}

export async function captureWebSocketLine() {
  const topology = await IndependentProcessTopology.create();
  try {
    const line = await startIndependentLine(topology);
    const expected = [LINE_ENDPOINTS.a, LINE_ENDPOINTS.c];
    const [aSnapshot, bSnapshot, cSnapshot] = await Promise.all([
      processSnapshot(
        line.a,
        (snapshot) =>
          hasSelected(snapshot, expected)
          && hasAcked(snapshot, LINE_ENDPOINTS.a, "line.b")
          && exportsSettled(snapshot),
        "WebSocket line A convergence",
      ),
      processSnapshot(
        line.b,
        (snapshot) =>
          hasSelected(snapshot, expected)
          && hasAcked(snapshot, LINE_ENDPOINTS.a, "line.c")
          && hasAcked(snapshot, LINE_ENDPOINTS.c, "line.a")
          && exportsSettled(snapshot),
        "WebSocket line B convergence",
      ),
      processSnapshot(
        line.c,
        (snapshot) =>
          hasSelected(snapshot, expected)
          && hasAcked(snapshot, LINE_ENDPOINTS.c, "line.b")
          && exportsSettled(snapshot),
        "WebSocket line C convergence",
      ),
    ]);
    const deliveries = await exerciseWebSocketLine(line);
    return normalizeTopology(
      { a: aSnapshot, b: bSnapshot, c: cSnapshot },
      deliveries,
    );
  } finally {
    await topology.dispose();
  }
}

async function exerciseLoopbackLine(a, c, atA, atC) {
  const payloadToC = { direction: "a-to-c", geometry: "line" };
  const receiptToC = await a.send(
    LINE_ENDPOINTS.a,
    LINE_ENDPOINTS.c,
    payloadToC,
    { correlationId: "transport-equivalence-line-a-c" },
  );
  const deliveredAtC = await waitForDelivery(atC, 1, "Loopback A-to-C delivery");
  const payloadToA = { direction: "c-to-a", geometry: "line" };
  const receiptToA = await c.send(
    LINE_ENDPOINTS.c,
    LINE_ENDPOINTS.a,
    payloadToA,
    { correlationId: "transport-equivalence-line-c-a" },
  );
  const deliveredAtA = await waitForDelivery(atA, 1, "Loopback C-to-A delivery");
  return [
    normalizeDelivery(
      receiptToC,
      deliveredAtC.payload,
      deliveredAtC.context.delivery,
    ),
    normalizeDelivery(
      receiptToA,
      deliveredAtA.payload,
      deliveredAtA.context.delivery,
    ),
  ];
}

async function exerciseWebSocketLine(line) {
  const payloadToC = { direction: "a-to-c", geometry: "line" };
  const atC = line.c.waitForDelivery(
    LINE_ENDPOINTS.c,
    "transport-equivalence-line-a-c",
  );
  const receiptToC = await line.a.send(
    LINE_ENDPOINTS.a,
    LINE_ENDPOINTS.c,
    payloadToC,
    { correlationId: "transport-equivalence-line-a-c" },
  );
  const deliveredAtC = await atC;
  const payloadToA = { direction: "c-to-a", geometry: "line" };
  const atA = line.a.waitForDelivery(
    LINE_ENDPOINTS.a,
    "transport-equivalence-line-c-a",
  );
  const receiptToA = await line.c.send(
    LINE_ENDPOINTS.c,
    LINE_ENDPOINTS.a,
    payloadToA,
    { correlationId: "transport-equivalence-line-c-a" },
  );
  const deliveredAtA = await atA;
  return [
    normalizeDelivery(receiptToC, deliveredAtC.payload, deliveredAtC.delivery),
    normalizeDelivery(receiptToA, deliveredAtA.payload, deliveredAtA.delivery),
  ];
}

function normalizeTopology(nodes, deliveries) {
  return {
    nodes: Object.fromEntries(
      Object.entries(nodes).map(([name, snapshot]) => [
        name,
        normalizeSnapshot(snapshot),
      ]),
    ),
    deliveries,
  };
}

function normalizeSnapshot(snapshot) {
  return {
    connections: snapshot.connections
      .filter(({ identityState }) => identityState === "admitted")
      .map(({ remoteNodeId, direction, state, negotiated }) => ({
        remoteNodeId,
        direction,
        state,
        negotiated,
      })),
    candidates: snapshot.candidateRoutes.map((route) => ({
      endpoint: route.endpoint,
      originNodeId: route.originNodeId,
      routeClass: route.routeClass,
      learnedKind: route.learnedKind,
      path: route.path,
      eligible: route.eligible,
      selectionStatus: route.selectionStatus,
      selectionReason: route.selectionReason,
      nextHop: normalizeNextHop(route.nextHop),
    })),
    selected: snapshot.selectedRoutes.map((route) => ({
      endpoint: route.endpoint,
      originNodeId: route.originNodeId,
      routeClass: route.routeClass,
      sourceKind: route.sourceKind,
      learnedKind: route.learnedKind,
      path: route.path,
      selectionReason: route.selectionReason,
      nextHop: normalizeNextHop(route.nextHop),
    })),
    exports: snapshot.routeExports.map((route) => ({
      remoteNodeId: route.remoteNodeId,
      endpoint: route.endpoint,
      originNodeId: route.originNodeId,
      path: route.path,
      state: route.state,
      reasonCode: route.reasonCode,
      remoteRejectionCode: route.remoteRejectionCode,
    })),
  };
}

function normalizeNextHop(nextHop) {
  return nextHop.kind === "local"
    ? { kind: "local" }
    : { kind: "session", nodeId: nextHop.nodeId };
}

function normalizeDelivery(receipt, payload, delivery) {
  return {
    nextHop: normalizeNextHop(receipt.nextHop),
    payload,
    source: delivery.source,
    destination: delivery.destination,
    correlationId: delivery.correlationId,
  };
}

function hasSelected(snapshot, endpoints) {
  return endpoints.every((endpoint) =>
    snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
  );
}

function hasAcked(snapshot, endpoint, remoteNodeId) {
  return snapshot.routeExports.some((route) =>
    route.endpoint === endpoint
    && route.remoteNodeId === remoteNodeId
    && route.state === "acked"
  );
}

function exportsSettled(snapshot) {
  return snapshot.routeExports.every((route) => route.state !== "outstanding");
}

function equivalenceProtocolLimits() {
  return {
    holdTimeMs: 30_000,
    receiveLimitBytes: 1_048_576,
    maxPathLength: 64,
  };
}

function processSnapshot(node, predicate, description) {
  return eventuallyProcess(async () => {
    const response = await getProcessManagement(node, "snapshot");
    return predicate(response.data) ? response.data : undefined;
  }, description);
}
