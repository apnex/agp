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

test("Given a three-node line with a remote route and an unrelated transit-local route, when the origin session closes, then withdrawal cascades atomically through each RIB while the unrelated route remains deliverable", async (context) => {
  const network = new ChaosNetwork();
  const edge = createChaosNode(network, {
    nodeId: "cascade.edge",
    listen: listen(14001),
  });
  const transit = createChaosNode(network, {
    nodeId: "cascade.transit",
    listen: listen(14002),
    peers: [peer("transit-edge", "cascade.edge", 14001)],
  });
  const origin = createChaosNode(network, {
    nodeId: "cascade.origin",
    peers: [peer("origin-transit", "cascade.transit", 14002, false)],
  });
  context.after(() => stopAll(origin, transit, edge));
  const atTransit = [];
  await expose(edge, ["cascade/source"]);
  await expose(transit, ["cascade/unrelated"], atTransit);
  await expose(origin, ["cascade/remote"]);
  await edge.start();
  await transit.start();
  await origin.start();
  const before = await waitForSnapshot(
    edge,
    (snapshot) =>
      ["cascade/remote", "cascade/unrelated"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "line routes before origin loss",
  );
  const beforeRevision = BigInt(before.revision);
  const ledgerBarrier = network.ledger.at(-1)?.sequence ?? 0;

  await origin.stop({ drainTimeoutMs: 100 });
  const [atEdge, atTransitAfter] = await Promise.all([
    waitForSnapshot(
      edge,
      (snapshot) =>
        snapshot.selectedRoutes.every(
          (route) => route.endpoint !== "cascade/remote",
        )
        && snapshot.selectedRoutes.some(
          (route) => route.endpoint === "cascade/unrelated",
        ),
      "edge cascading withdrawal",
    ),
    waitForSnapshot(
      transit,
      (snapshot) =>
        snapshot.selectedRoutes.every(
          (route) => route.endpoint !== "cascade/remote",
        )
        && snapshot.selectedRoutes.some(
          (route) => route.endpoint === "cascade/unrelated",
        ),
      "transit origin purge",
    ),
  ]);
  await edge.send(
    "cascade/source",
    "cascade/unrelated",
    { proof: "unrelated-survived" },
  );
  const delivered = await waitForDelivery(
    atTransit,
    1,
    "unrelated post-withdrawal delivery",
  );
  const successor = network.entries("delivered", {
    from: "cascade.transit",
    to: "cascade.edge",
    type: "route.update",
  }).findLast((entry) => entry.sequence > ledgerBarrier);

  assert.equal(BigInt(atEdge.revision) > beforeRevision, true);
  assert.equal(atTransitAfter.advertisements.length, 1);
  assert.equal(successor.document.includes("cascade/remote"), false);
  assert.equal(successor.document.includes("cascade/unrelated"), true);
  assert.deepEqual(delivered.payload, { proof: "unrelated-survived" });
  assert.equal(
    network.entries("closed").some(
      (entry) =>
        entry.from === "cascade.origin" && entry.to === "cascade.transit",
    ),
    true,
  );
});
