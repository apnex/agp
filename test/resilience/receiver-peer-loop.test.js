import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import { connectRawPeer } from "./support/raw-peer.js";
import {
  createChaosNode,
  expose,
  listen,
  peer,
  stopAll,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given an established raw peer and a healthy sibling route, when a schema-valid successor path contains the local receiver, then that route receives nonfatal LOOP and is never installed", async (context) => {
  const network = new ChaosNetwork();
  const receiver = createChaosNode(network, {
    nodeId: "loop.receiver",
    listen: listen(13601),
  });
  let raw;
  context.after(async () => {
    await Promise.allSettled([raw?.close(), stopAll(receiver)]);
  });
  await expose(receiver, ["loop/local"]);
  await receiver.start();
  raw = await connectRawPeer({
    network,
    nodeId: "loop.raw",
    targetNodeId: "loop.receiver",
    port: 13601,
    routes: [{
      endpoint: "loop/healthy",
      originNodeId: "loop.raw",
      path: ["loop.raw"],
    }],
  });
  await waitForSnapshot(
    receiver,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) => route.endpoint === "loop/healthy",
    ),
    "healthy raw route",
  );

  const ack = await raw.sendUpdate([
    {
      endpoint: "loop/healthy",
      originNodeId: "loop.raw",
      path: ["loop.raw"],
    },
    {
      endpoint: "loop/rejected",
      originNodeId: "loop.origin",
      path: ["loop.origin", "loop.receiver", "loop.raw"],
    },
  ]);
  const after = receiver.operations.snapshot();

  assert.deepEqual(ack.body.rejected, [{
    endpoint: "loop/rejected",
    originNodeId: "loop.origin",
    reasonCode: "LOOP",
  }]);
  assert.equal(
    after.selectedRoutes.some(
      (route) => route.endpoint === "loop/rejected",
    ),
    false,
  );
  assert.equal(
    after.selectedRoutes.some(
      (route) => route.endpoint === "loop/healthy",
    ),
    true,
  );
  assert.equal(after.connections[0].state, "Established");
});

test("Given a center that learned one route from a path member and has another peer, when exports are derived for both peers, then only the path member is visibly suppressed as PEER_IN_PATH", async (context) => {
  const network = new ChaosNetwork();
  const center = createChaosNode(network, {
    nodeId: "peerloop.center",
    listen: listen(13602),
  });
  const origin = createChaosNode(network, {
    nodeId: "peerloop.origin",
    peers: [peer("origin-center", "peerloop.center", 13602)],
  });
  const sibling = createChaosNode(network, {
    nodeId: "peerloop.sibling",
    peers: [peer("sibling-center", "peerloop.center", 13602)],
  });
  context.after(() => stopAll(sibling, origin, center));
  await expose(origin, ["peerloop/service"]);
  await center.start();
  await Promise.all([origin.start(), sibling.start()]);
  const atCenter = await waitForSnapshot(
    center,
    (snapshot) =>
      snapshot.routeExports.some(
        (route) =>
          route.remoteNodeId === "peerloop.origin"
          && route.endpoint === "peerloop/service"
          && route.state === "suppressed",
      )
      && snapshot.routeExports.some(
        (route) =>
          route.remoteNodeId === "peerloop.sibling"
          && route.endpoint === "peerloop/service"
          && route.state === "acked",
      ),
    "peer-specific loop decisions",
  );
  await waitForSnapshot(
    sibling,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) => route.endpoint === "peerloop/service",
    ),
    "non-path peer export",
  );

  const suppressed = atCenter.routeExports.find(
    (route) =>
      route.remoteNodeId === "peerloop.origin"
      && route.endpoint === "peerloop/service",
  );
  assert.equal(suppressed.reasonCode, "PEER_IN_PATH");
  assert.equal(
    network.entries("delivered", {
      from: "peerloop.center",
      to: "peerloop.origin",
      type: "route.update",
    }).some((entry) => entry.document.includes("peerloop/service")),
    false,
  );
  assert.equal(
    network.entries("delivered", {
      from: "peerloop.center",
      to: "peerloop.sibling",
      type: "route.update",
    }).some((entry) => entry.document.includes("peerloop/service")),
    true,
  );
});
