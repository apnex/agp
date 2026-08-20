import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  expose,
  listen,
  peer,
  stopAll,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given an ACKed pair, when one exact route update is lost, then the finite ACK timer replaces the session and a fresh authoritative snapshot restores every route", async (context) => {
  const network = new ChaosNetwork();
  const hub = createChaosNode(network, {
    nodeId: "update.hub",
    listen: listen(13201),
  });
  const leaf = createChaosNode(network, {
    nodeId: "update.leaf",
    peers: [peer("leaf-hub", "update.hub", 13201)],
    routeAckTimeoutMs: 30,
  });
  context.after(() => stopAll(leaf, hub));
  await expose(leaf, ["update/first"]);
  await hub.start();
  await leaf.start();
  const initial = await waitForSnapshot(
    hub,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.selectedRoutes.some(
        (route) => route.endpoint === "update/first",
      ),
    "initial update convergence",
  );
  const initialSession = initial.connections[0].sessionId;

  const ruleId = network.fault("drop", {
    from: "update.leaf",
    to: "update.hub",
    type: "route.update",
  });
  await expose(leaf, ["update/second"]);
  const recovered = await waitForSnapshot(
    hub,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.connections[0]?.sessionId !== initialSession
      && ["update/first", "update/second"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "replacement snapshot after update loss",
  );

  assert.equal(network.entries("write-dropped", { ruleId }).length, 1);
  assert.notEqual(recovered.connections[0].sessionId, initialSession);
  assert.equal(
    network.entries("dial-connected", {
      from: "update.leaf",
      to: "update.hub",
    }).length,
    2,
  );
});

test("Given an established pair with an acknowledged revision, when one exact route ACK is lost, then ambiguity is bounded by replacement and the new session re-ACKs the complete desired set", async (context) => {
  const network = new ChaosNetwork();
  const hub = createChaosNode(network, {
    nodeId: "ack.hub",
    listen: listen(13202),
  });
  const leaf = createChaosNode(network, {
    nodeId: "ack.leaf",
    peers: [peer("leaf-hub", "ack.hub", 13202)],
    routeAckTimeoutMs: 30,
  });
  context.after(() => stopAll(leaf, hub));
  await expose(leaf, ["ack/first"]);
  await hub.start();
  await leaf.start();
  const initial = await waitForSnapshot(
    leaf,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.connections[0]?.routeExport.acked?.routes.length === 1,
    "initial acknowledged export",
  );
  const initialSession = initial.connections[0].sessionId;

  const ruleId = network.fault("drop", {
    from: "ack.hub",
    to: "ack.leaf",
    type: "route.ack",
  });
  await expose(leaf, ["ack/second"]);
  const recovered = await waitForSnapshot(
    leaf,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.connections[0]?.sessionId !== initialSession
      && snapshot.connections[0]?.routeExport.acked?.routes.length === 2,
    "replacement session acknowledged export",
  );

  assert.equal(network.entries("write-dropped", { ruleId }).length, 1);
  assert.deepEqual(
    recovered.connections[0].routeExport.acked.routes.map(
      (route) => route.endpoint,
    ),
    ["ack/first", "ack/second"],
  );
  assert.equal(
    network.entries("delivered", {
      from: "ack.hub",
      to: "ack.leaf",
      type: "route.ack",
    }).length >= 2,
    true,
  );
});
