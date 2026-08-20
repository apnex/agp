import assert from "node:assert/strict";
import test from "node:test";

import {
  IndependentProcessTopology,
  STAR_ENDPOINTS,
  STAR_HUB_ENDPOINT,
  eventuallyProcess,
  getProcessManagement,
  startIndependentStar,
} from "./support/independent-processes.js";

test("given the independent hub advertises its own endpoint when both spokes converge then each spoke routes JSON to the hub-local handler", async (context) => {
  const topology = await IndependentProcessTopology.create();
  context.after(() => topology.dispose());
  const star = await startIndependentStar(topology);

  const [hubSnapshot, alphaSnapshot, betaSnapshot] = await Promise.all([
    waitForSnapshot(
      star.hub,
      (snapshot) =>
        isSelectedHubRoute(snapshot, "local", ["hub"])
        && hasAckedExport(snapshot, STAR_HUB_ENDPOINT, "spoke.alpha")
        && hasAckedExport(snapshot, STAR_HUB_ENDPOINT, "spoke.beta"),
      "hub-local route and both ACKed spoke exports",
    ),
    waitForSnapshot(
      star.alpha,
      (snapshot) =>
        isSelectedHubRoute(
          snapshot,
          "learned",
          ["hub", "spoke.alpha"],
        )
        && hasAckedExport(
          snapshot,
          STAR_ENDPOINTS.alphaExclusive[0],
          "hub",
        ),
      "Alpha direct hub route and ACKed source export",
    ),
    waitForSnapshot(
      star.beta,
      (snapshot) =>
        isSelectedHubRoute(
          snapshot,
          "learned",
          ["hub", "spoke.beta"],
        )
        && hasAckedExport(
          snapshot,
          STAR_ENDPOINTS.betaExclusive[0],
          "hub",
        ),
      "Beta direct hub route and ACKed source export",
    ),
  ]);

  assertHubSelection(hubSnapshot, {
    routeClass: "local",
    path: ["hub"],
    nextHopKind: "local",
  });
  assertHubSelection(alphaSnapshot, {
    routeClass: "learned",
    learnedKind: "direct",
    path: ["hub", "spoke.alpha"],
    nextHopKind: "session",
  });
  assertHubSelection(betaSnapshot, {
    routeClass: "learned",
    learnedKind: "direct",
    path: ["hub", "spoke.beta"],
    nextHopKind: "session",
  });

  const deliveries = await Promise.all([
    exerciseHubDelivery({
      source: star.alpha,
      hub: star.hub,
      sourceEndpoint: STAR_ENDPOINTS.alphaExclusive[0],
      correlationId: "hub-service-from-alpha",
    }),
    exerciseHubDelivery({
      source: star.beta,
      hub: star.hub,
      sourceEndpoint: STAR_ENDPOINTS.betaExclusive[0],
      correlationId: "hub-service-from-beta",
    }),
  ]);

  assert.deepEqual(
    deliveries.map(({ delivery }) => delivery.source.endpoint).sort(),
    [
      STAR_ENDPOINTS.alphaExclusive[0],
      STAR_ENDPOINTS.betaExclusive[0],
    ].sort(),
  );
  assert.equal(topology.nodes.every((node) => node.alive), true);
});

async function exerciseHubDelivery({
  source,
  hub,
  sourceEndpoint,
  correlationId,
}) {
  const payload = { kind: "hub-service", correlationId };
  const delivered = hub.waitForDelivery(
    STAR_HUB_ENDPOINT,
    correlationId,
  );
  const receipt = await source.send(
    sourceEndpoint,
    STAR_HUB_ENDPOINT,
    payload,
    { correlationId, timeoutMs: 5_000 },
  );
  const delivery = await delivered;

  assert.equal(receipt.nextHop.nodeId, "hub");
  assert.deepEqual(delivery.payload, payload);
  assert.equal(delivery.delivery.destination, STAR_HUB_ENDPOINT);
  assert.equal(delivery.delivery.source.endpoint, sourceEndpoint);
  return delivery;
}

async function waitForSnapshot(node, predicate, description) {
  return eventuallyProcess(async () => {
    const response = await getProcessManagement(node, "snapshot");
    return predicate(response.data) ? response.data : undefined;
  }, description);
}

function selectedHubRoute(snapshot) {
  return snapshot.selectedRoutes.find(
    ({ endpoint }) => endpoint === STAR_HUB_ENDPOINT,
  );
}

function isSelectedHubRoute(snapshot, routeClass, path) {
  const route = selectedHubRoute(snapshot);
  return route?.routeClass === routeClass
    && route.originNodeId === "hub"
    && path.every((nodeId, index) => route.path[index] === nodeId)
    && route.path.length === path.length;
}

function assertHubSelection(
  snapshot,
  {
    routeClass,
    learnedKind,
    path,
    nextHopKind,
  },
) {
  const route = selectedHubRoute(snapshot);
  assert.equal(route.originNodeId, "hub");
  assert.equal(route.routeClass, routeClass);
  assert.equal(route.learnedKind, learnedKind);
  assert.deepEqual(route.path, path);
  assert.equal(route.nextHop.kind, nextHopKind);
  if (nextHopKind === "session") {
    assert.equal(route.nextHop.nodeId, "hub");
  }
}

function hasAckedExport(snapshot, endpoint, remoteNodeId) {
  return snapshot.routeExports.some((route) =>
    route.endpoint === endpoint
    && route.remoteNodeId === remoteNodeId
    && route.state === "acked"
  );
}
