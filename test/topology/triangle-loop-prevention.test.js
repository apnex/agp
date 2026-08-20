import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoopbackNode,
  expose,
  memoryPeer,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given three identical transit nodes forming a triangle, when all endpoint routes converge, then no candidate selected or exported path repeats a node", async (context) => {
  const nodeA = createLoopbackNode({
    nodeId: "node.a",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  let nodeB;
  let nodeC;
  context.after(() => stopAll(nodeC, nodeB, nodeA));
  const startedA = await nodeA.start();
  nodeB = createLoopbackNode({
    nodeId: "node.b",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    peers: [{
      ...memoryPeer("b-a", "node.a", 1),
      url: startedA.listener.publication.displayAddress,
    }],
  });
  const startedB = await nodeB.start();
  nodeC = createLoopbackNode({
    nodeId: "node.c",
    peers: [
      { ...memoryPeer("c-a", "node.a", 1), url: startedA.listener.publication.displayAddress },
      { ...memoryPeer("c-b", "node.b", 1), url: startedB.listener.publication.displayAddress },
    ],
  });
  await expose(nodeA, ["triangle/a"]);
  await expose(nodeB, ["triangle/b"]);
  await expose(nodeC, ["triangle/c"]);

  await nodeC.start();
  const nodes = [nodeA, nodeB, nodeC];
  const snapshots = await Promise.all(nodes.map((node) =>
    waitForSnapshot(
      node,
      (snapshot) => snapshot.selectedRoutes.length === 3,
      `${node.nodeId} triangle convergence`,
    )
  ));

  for (const snapshot of snapshots) {
    for (const route of [
      ...snapshot.candidateRoutes,
      ...snapshot.selectedRoutes,
      ...snapshot.routeExports,
    ]) {
      assert.equal(
        new Set(route.path).size,
        route.path.length,
        `${snapshot.nodeId} exposed repeated path ${route.path.join(" -> ")}`,
      );
    }
  }
  assert.equal(
    snapshots.some((snapshot) =>
      snapshot.routeExports.some(
        (route) =>
          route.state === "suppressed"
          && route.reasonCode === "PEER_IN_PATH",
      )
    ),
    true,
  );
});
