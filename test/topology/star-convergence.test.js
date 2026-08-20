import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoopbackNode,
  expose,
  hasAckedExport,
  memoryPeer,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given one listening node and two dialing nodes with multiple endpoints, when the star converges, then every endpoint is selected and leaf JSON crosses the center", async (context) => {
  const center = createLoopbackNode({
    nodeId: "node.center",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    transit: true,
  });
  let alpha;
  let beta;
  context.after(() => stopAll(alpha, beta, center));
  const startedCenter = await center.start();
  alpha = createLoopbackNode({
    nodeId: "node.alpha",
    peers: [{
      ...memoryPeer("alpha-center", "node.center", 1),
      url: startedCenter.listener.publication.displayAddress,
    }],
  });
  beta = createLoopbackNode({
    nodeId: "node.beta",
    peers: [{
      ...memoryPeer("beta-center", "node.center", 1),
      url: startedCenter.listener.publication.displayAddress,
    }],
  });
  const atBeta = [];
  await expose(alpha, ["alpha/one", "alpha/two"]);
  await expose(beta, ["beta/one", "beta/two"], atBeta);

  await Promise.all([alpha.start(), beta.start()]);
  const expected = ["alpha/one", "alpha/two", "beta/one", "beta/two"];
  for (const node of [center, alpha, beta]) {
    await waitForSnapshot(
      node,
      (snapshot) =>
        expected.every((endpoint) =>
          snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
        ),
      `${node.nodeId} star routes`,
    );
  }
  await Promise.all([
    waitForSnapshot(
      alpha,
      () => hasAckedExport(alpha, "alpha/one", "node.center"),
      "alpha source export acknowledged by center",
    ),
    waitForSnapshot(
      center,
      () => hasAckedExport(center, "alpha/one", "node.beta"),
      "alpha transit source export acknowledged by beta",
    ),
  ]);

  const receipt = await alpha.send(
    "alpha/one",
    "beta/two",
    { geometry: "star", sequence: 1 },
  );
  const delivered = await waitForDelivery(
    atBeta,
    1,
    "star payload at beta/two",
  );

  assert.deepEqual(delivered.payload, { geometry: "star", sequence: 1 });
  assert.equal(delivered.endpoint, "beta/two");
  assert.equal(receipt.nextHop.nodeId, "node.center");
  assert.deepEqual(
    center.operations.snapshot().selectedRoutes
      .map((route) => route.endpoint)
      .sort(),
    expected,
  );
});
