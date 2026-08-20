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

test("given three identical nodes arranged as a line, when edge nodes exchange JSON, then the middle node forwards both directions through selected two-hop routes", async (context) => {
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
    transit: true,
  });
  const startedB = await nodeB.start();
  nodeC = createLoopbackNode({
    nodeId: "node.c",
    peers: [{
      ...memoryPeer("c-b", "node.b", 1),
      url: startedB.listener.publication.displayAddress,
    }],
  });
  const atA = [];
  const atC = [];
  await expose(nodeA, ["edge/a"], atA);
  await expose(nodeC, ["edge/c"], atC);

  await nodeC.start();
  await Promise.all([
    waitForSnapshot(
      nodeA,
      (snapshot) => snapshot.selectedRoutes.some(
        (route) => route.endpoint === "edge/c" && route.path.length === 3,
      ),
      "A selecting C through B",
    ),
    waitForSnapshot(
      nodeC,
      (snapshot) => snapshot.selectedRoutes.some(
        (route) => route.endpoint === "edge/a" && route.path.length === 3,
      ),
      "C selecting A through B",
    ),
    waitForSnapshot(
      nodeA,
      () => hasAckedExport(nodeA, "edge/a", "node.b"),
      "A source export acknowledged by B",
    ),
    waitForSnapshot(
      nodeB,
      () => hasAckedExport(nodeB, "edge/a", "node.c"),
      "A source transit export acknowledged by C",
    ),
    waitForSnapshot(
      nodeC,
      () => hasAckedExport(nodeC, "edge/c", "node.b"),
      "C source export acknowledged by B",
    ),
    waitForSnapshot(
      nodeB,
      () => hasAckedExport(nodeB, "edge/c", "node.a"),
      "C source transit export acknowledged by A",
    ),
  ]);

  await nodeA.send("edge/a", "edge/c", { direction: "a-to-c" });
  await nodeC.send("edge/c", "edge/a", { direction: "c-to-a" });
  const [atCEnd, atAEnd] = await Promise.all([
    waitForDelivery(atC, 1, "A to C line delivery"),
    waitForDelivery(atA, 1, "C to A line delivery"),
  ]);

  assert.deepEqual(atCEnd.payload, { direction: "a-to-c" });
  assert.deepEqual(atAEnd.payload, { direction: "c-to-a" });
  assert.equal(
    nodeB.operations.snapshot().selectedRoutes
      .filter((route) => route.endpoint.startsWith("edge/"))
      .every((route) => route.path.length <= 2),
    true,
  );
});
