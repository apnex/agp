import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoopbackNode,
  expose,
  memoryPeer,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given a converged three-node star with unrelated leaf reachability, when one leaf stops orderly, then surviving nodes remove every phantom next hop and remain established with each other", async (context) => {
  const center = createLoopbackNode({
    nodeId: "stop.center",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  let departing;
  let survivor;
  context.after(() => stopAll(survivor, departing, center));
  const startedCenter = await center.start();
  departing = createLoopbackNode({
    nodeId: "stop.departing",
    peers: [{
      ...memoryPeer("departing-center", "stop.center", 1),
      url: startedCenter.listener.publication.displayAddress,
    }],
  });
  survivor = createLoopbackNode({
    nodeId: "stop.survivor",
    peers: [{
      ...memoryPeer("survivor-center", "stop.center", 1),
      url: startedCenter.listener.publication.displayAddress,
    }],
  });
  await expose(departing, ["stop/departing"]);
  await expose(survivor, ["stop/survivor"]);
  await Promise.all([departing.start(), survivor.start()]);
  await waitForSnapshot(
    survivor,
    (snapshot) =>
      ["stop/departing", "stop/survivor"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "star before orderly node stop",
  );

  await departing.stop({ drainTimeoutMs: 500 });
  const [centerAfter, survivorAfter] = await Promise.all([
    waitForSnapshot(
      center,
      (snapshot) =>
        snapshot.connections.length === 1
        && !snapshot.selectedRoutes.some(
          (route) => route.endpoint === "stop/departing",
        ),
      "center purge after node stop",
    ),
    waitForSnapshot(
      survivor,
      (snapshot) =>
        snapshot.connections[0]?.state === "Established"
        && !snapshot.selectedRoutes.some(
          (route) => route.endpoint === "stop/departing",
        )
        && snapshot.selectedRoutes.some(
          (route) => route.endpoint === "stop/survivor",
        ),
      "survivor convergence after node stop",
    ),
  ]);

  assert.equal(
    [...centerAfter.forwarding, ...survivorAfter.forwarding].some(
      (entry) => entry.endpoint === "stop/departing",
    ),
    false,
  );
  assert.equal(centerAfter.lifecycle.state, "Running");
  assert.equal(survivorAfter.lifecycle.state, "Running");
});
