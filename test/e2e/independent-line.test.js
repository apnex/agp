import assert from "node:assert/strict";
import test from "node:test";

import {
  IndependentProcessTopology,
  LINE_ENDPOINTS,
  eventuallyProcess,
  getProcessManagement,
  startIndependentLine,
} from "./support/independent-processes.js";

test("given three independently started uniform-node processes in a line when source exports converge through the transit node then edge JSON routes symmetrically over two hops", async (context) => {
  const topology = await IndependentProcessTopology.create();
  context.after(() => topology.dispose());
  const line = await startIndependentLine(topology);
  const expectedEndpoints = [LINE_ENDPOINTS.a, LINE_ENDPOINTS.c];

  const [aSnapshot, bSnapshot, cSnapshot] = await Promise.all([
    waitForSnapshot(
      line.a,
      (snapshot) =>
        hasSelected(snapshot, expectedEndpoints)
        && hasAckedExport(snapshot, LINE_ENDPOINTS.a, "line.b"),
      "line A selected routes and ACKed source export",
    ),
    waitForSnapshot(
      line.b,
      (snapshot) =>
        hasSelected(snapshot, expectedEndpoints)
        && hasAckedExport(snapshot, LINE_ENDPOINTS.a, "line.c")
        && hasAckedExport(snapshot, LINE_ENDPOINTS.c, "line.a"),
      "line B selected routes and both ACKed transit exports",
    ),
    waitForSnapshot(
      line.c,
      (snapshot) =>
        hasSelected(snapshot, expectedEndpoints)
        && hasAckedExport(snapshot, LINE_ENDPOINTS.c, "line.b"),
      "line C selected routes and ACKed source export",
    ),
  ]);

  assert.deepEqual(
    selected(aSnapshot, LINE_ENDPOINTS.c).path,
    ["line.c", "line.b", "line.a"],
  );
  assert.deepEqual(
    selected(cSnapshot, LINE_ENDPOINTS.a).path,
    ["line.a", "line.b", "line.c"],
  );
  assert.deepEqual(
    selected(bSnapshot, LINE_ENDPOINTS.a).path,
    ["line.a", "line.b"],
  );
  assert.deepEqual(
    selected(bSnapshot, LINE_ENDPOINTS.c).path,
    ["line.c", "line.b"],
  );

  const atC = line.c.waitForDelivery(LINE_ENDPOINTS.c, "line-a-to-c");
  const toC = await line.a.send(
    LINE_ENDPOINTS.a,
    LINE_ENDPOINTS.c,
    { direction: "a-to-c", hops: 2 },
    { correlationId: "line-a-to-c", timeoutMs: 5_000 },
  );
  const deliveredAtC = await atC;
  const atA = line.a.waitForDelivery(LINE_ENDPOINTS.a, "line-c-to-a");
  const toA = await line.c.send(
    LINE_ENDPOINTS.c,
    LINE_ENDPOINTS.a,
    { direction: "c-to-a", hops: 2 },
    { correlationId: "line-c-to-a", timeoutMs: 5_000 },
  );
  const deliveredAtA = await atA;

  assert.equal(toC.nextHop.nodeId, "line.b");
  assert.equal(toA.nextHop.nodeId, "line.b");
  assert.deepEqual(deliveredAtC.payload, { direction: "a-to-c", hops: 2 });
  assert.deepEqual(deliveredAtA.payload, { direction: "c-to-a", hops: 2 });
  assert.equal(deliveredAtC.delivery.source.originNodeId, "line.a");
  assert.equal(deliveredAtA.delivery.source.originNodeId, "line.c");
  assert.equal(topology.nodes.every((node) => node.alive), true);
});

async function waitForSnapshot(node, predicate, description) {
  return eventuallyProcess(async () => {
    const response = await getProcessManagement(node, "snapshot");
    return predicate(response.data) ? response.data : undefined;
  }, description);
}

function selected(snapshot, endpoint) {
  return snapshot.selectedRoutes.find((route) => route.endpoint === endpoint);
}

function hasSelected(snapshot, endpoints) {
  return endpoints.every((endpoint) => selected(snapshot, endpoint) !== undefined);
}

function hasAckedExport(snapshot, endpoint, remoteNodeId) {
  return snapshot.routeExports.some((route) =>
    route.endpoint === endpoint
    && route.remoteNodeId === remoteNodeId
    && route.state === "acked"
  );
}
