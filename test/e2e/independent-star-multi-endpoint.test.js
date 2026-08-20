import assert from "node:assert/strict";
import test from "node:test";

import {
  IndependentProcessTopology,
  STAR_ENDPOINTS,
  eventuallyProcess,
  getProcessManagement,
  startIndependentStar,
} from "./support/independent-processes.js";

test("given three independently started uniform-node processes in a star when every source export is ACKed then all uniquely owned leaf endpoints route JSON in both directions", async (context) => {
  const topology = await IndependentProcessTopology.create();
  context.after(() => topology.dispose());
  const star = await startIndependentStar(topology);

  const [hubSnapshot, alphaSnapshot, betaSnapshot] = await Promise.all([
    waitForSnapshot(
      star.hub,
      (snapshot) =>
        hasSelectedEndpoints(snapshot, STAR_ENDPOINTS.all)
        && STAR_ENDPOINTS.alphaExclusive.every((endpoint) =>
          hasAckedExport(snapshot, endpoint, "spoke.beta")
        )
        && STAR_ENDPOINTS.betaExclusive.every((endpoint) =>
          hasAckedExport(snapshot, endpoint, "spoke.alpha")
        ),
      "hub selected RIB and opposite-leaf ACKed exports",
    ),
    waitForSnapshot(
      star.alpha,
      (snapshot) =>
        hasSelectedEndpoints(snapshot, STAR_ENDPOINTS.all)
        && STAR_ENDPOINTS.alpha.every((endpoint) =>
          hasAckedExport(snapshot, endpoint, "hub")
        ),
      "alpha selected RIB and ACKed local source exports",
    ),
    waitForSnapshot(
      star.beta,
      (snapshot) =>
        hasSelectedEndpoints(snapshot, STAR_ENDPOINTS.all)
        && STAR_ENDPOINTS.beta.every((endpoint) =>
          hasAckedExport(snapshot, endpoint, "hub")
        ),
      "beta selected RIB and ACKed local source exports",
    ),
  ]);

  assert.deepEqual(selectedEndpoints(hubSnapshot), STAR_ENDPOINTS.all);
  assert.deepEqual(selectedEndpoints(alphaSnapshot), STAR_ENDPOINTS.all);
  assert.deepEqual(selectedEndpoints(betaSnapshot), STAR_ENDPOINTS.all);
  assert.deepEqual(
    selected(alphaSnapshot, STAR_ENDPOINTS.beta[0]).path,
    ["spoke.beta", "hub", "spoke.alpha"],
  );
  assert.deepEqual(
    selected(betaSnapshot, STAR_ENDPOINTS.alpha[0]).path,
    ["spoke.alpha", "hub", "spoke.beta"],
  );

  const deliveries = [];
  for (
    let index = 0;
    index < STAR_ENDPOINTS.betaExclusive.length;
    index += 1
  ) {
    deliveries.push(await exercise(
      star.alpha,
      star.beta,
      STAR_ENDPOINTS.alphaExclusive[index],
      STAR_ENDPOINTS.betaExclusive[index],
      `star-alpha-beta-${index}`,
    ));
  }
  for (
    let index = 0;
    index < STAR_ENDPOINTS.alphaExclusive.length;
    index += 1
  ) {
    deliveries.push(await exercise(
      star.beta,
      star.alpha,
      STAR_ENDPOINTS.betaExclusive[index],
      STAR_ENDPOINTS.alphaExclusive[index],
      `star-beta-alpha-${index}`,
    ));
  }

  assert.deepEqual(
    deliveries.map(({ delivery }) => delivery.endpoint).sort(),
    [
      ...STAR_ENDPOINTS.alphaExclusive,
      ...STAR_ENDPOINTS.betaExclusive,
    ].sort(),
  );
  assert.equal(topology.nodes.every((node) => node.alive), true);
});

async function exercise(source, destination, sourceEndpoint, endpoint, id) {
  const payload = { kind: "process-star", id };
  const delivered = destination.waitForDelivery(endpoint, id);
  const receipt = await source.send(
    sourceEndpoint,
    endpoint,
    payload,
    { correlationId: id, timeoutMs: 5_000 },
  );
  const delivery = await delivered;

  assert.equal(receipt.nextHop.nodeId, "hub");
  assert.deepEqual(delivery.payload, payload);
  assert.equal(delivery.delivery.source.endpoint, sourceEndpoint);
  assert.equal(delivery.delivery.destination, endpoint);
  return { receipt, delivery };
}

async function waitForSnapshot(node, predicate, description) {
  return eventuallyProcess(async () => {
    const response = await getProcessManagement(node, "snapshot");
    return predicate(response.data) ? response.data : undefined;
  }, description);
}

function selectedEndpoints(snapshot) {
  return snapshot.selectedRoutes.map(({ endpoint }) => endpoint).sort();
}

function hasSelectedEndpoints(snapshot, endpoints) {
  const actual = selectedEndpoints(snapshot);
  return actual.length === endpoints.length
    && actual.every((endpoint, index) => endpoint === endpoints[index]);
}

function selected(snapshot, endpoint) {
  return snapshot.selectedRoutes.find((route) => route.endpoint === endpoint);
}

function hasAckedExport(snapshot, endpoint, remoteNodeId) {
  return snapshot.routeExports.some((route) =>
    route.endpoint === endpoint
    && route.remoteNodeId === remoteNodeId
    && route.state === "acked"
  );
}
