import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  expose,
  listen,
  peer,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given a selected diamond branch and a successor export blocked in the alternate writer, when selected-branch death overlaps that outstanding export, then promotion is atomic and release converges the complete successor set", async (context) => {
  const network = new ChaosNetwork();
  const source = createChaosNode(network, {
    nodeId: "c2branch.source",
    listen: listen(14201),
  });
  const destination = createChaosNode(network, {
    nodeId: "c2branch.destination",
    listen: listen(14204),
  });
  const selected = createChaosNode(network, {
    nodeId: "c2branch.branch.a",
    peers: [
      peer("a-source", "c2branch.source", 14201),
      peer("a-destination", "c2branch.destination", 14204),
    ],
  });
  const alternate = createChaosNode(network, {
    nodeId: "c2branch.branch.b",
    peers: [
      peer("b-source", "c2branch.source", 14201),
      peer("b-destination", "c2branch.destination", 14204),
    ],
  });
  context.after(() => stopAll(
    alternate,
    selected,
    destination,
    source,
  ));
  const deliveries = [];
  await expose(source, ["c2branch/source"]);
  await expose(
    destination,
    ["c2branch/destination"],
    deliveries,
  );
  await Promise.all([source.start(), destination.start()]);
  await Promise.all([selected.start(), alternate.start()]);
  await waitForSnapshot(
    source,
    (snapshot) =>
      snapshot.candidateRoutes.filter(
        (route) => route.endpoint === "c2branch/destination",
      ).length === 2,
    "healthy diamond before C2",
  );

  const blockedRule = network.fault("block", {
    from: "c2branch.branch.b",
    to: "c2branch.source",
    type: "route.update",
  });
  await expose(destination, ["c2branch/successor"], deliveries);
  await waitForSnapshot(
    alternate,
    (snapshot) =>
      network.entries("write-blocked", { ruleId: blockedRule }).length === 1
      && snapshot.routeExports.some(
        (route) =>
          route.remoteNodeId === "c2branch.source"
          && route.endpoint === "c2branch/successor"
          && route.state === "outstanding",
      ),
    "alternate outstanding successor export",
  );

  await selected.stop({ drainTimeoutMs: 100 });
  await waitForSnapshot(
    source,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) =>
        route.endpoint === "c2branch/destination"
        && route.nextHop.kind === "session"
        && route.nextHop.nodeId === "c2branch.branch.b",
    ),
    "alternative promotion during blocked export",
  );
  assert.equal(network.release(blockedRule), 1);
  await waitForSnapshot(
    source,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) =>
        route.endpoint === "c2branch/successor"
        && route.nextHop.kind === "session"
        && route.nextHop.nodeId === "c2branch.branch.b",
    ),
    "successor export convergence after release",
  );
  await source.send(
    "c2branch/source",
    "c2branch/successor",
    { proof: "c2-converged" },
  );
  const delivered = await waitForDelivery(
    deliveries,
    1,
    "C2 successor delivery",
  );

  assert.equal(network.entries("write-blocked", {
    ruleId: blockedRule,
  }).length, 1);
  assert.deepEqual(delivered.payload, { proof: "c2-converged" });
  assert.equal(
    network.entries("closed").some(
      (entry) =>
        entry.from === "c2branch.branch.a"
        || entry.to === "c2branch.branch.a",
    ),
    true,
  );
});
