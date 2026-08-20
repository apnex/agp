import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  expose,
  listen,
  peer,
  selectedRoute,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given a selected and an alternate diamond branch, when the selected transit node dies at the convergence barrier, then the alternate promotes and exactly one later data path is used", async (context) => {
  const network = new ChaosNetwork();
  const source = createChaosNode(network, {
    nodeId: "loss.source",
    listen: listen(13101),
  });
  const destination = createChaosNode(network, {
    nodeId: "loss.destination",
    listen: listen(13104),
  });
  const selected = createChaosNode(network, {
    nodeId: "loss.branch.a",
    peers: [
      peer("selected-source", "loss.source", 13101),
      peer("selected-destination", "loss.destination", 13104),
    ],
  });
  const alternate = createChaosNode(network, {
    nodeId: "loss.branch.b",
    peers: [
      peer("alternate-source", "loss.source", 13101),
      peer("alternate-destination", "loss.destination", 13104),
    ],
  });
  context.after(() => stopAll(alternate, selected, destination, source));
  const deliveries = [];
  await expose(source, ["loss/source"]);
  await expose(destination, ["loss/destination"], deliveries);
  await Promise.all([source.start(), destination.start()]);
  await Promise.all([selected.start(), alternate.start()]);

  await waitForSnapshot(
    source,
    (snapshot) =>
      snapshot.candidateRoutes.filter(
        (route) => route.endpoint === "loss/destination",
      ).length === 2,
    "both branch candidates",
  );
  assert.equal(
    selectedRoute(source, "loss/destination").nextHop.nodeId,
    "loss.branch.a",
  );
  await source.send(
    "loss/source",
    "loss/destination",
    { phase: "before" },
  );
  await waitForDelivery(deliveries, 1, "pre-fault delivery");

  await selected.stop({ drainTimeoutMs: 250 });
  await waitForSnapshot(
    source,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) =>
        route.endpoint === "loss/destination"
        && route.nextHop.kind === "session"
        && route.nextHop.nodeId === "loss.branch.b",
    ),
    "alternate branch promotion",
  );
  const receipt = await source.send(
    "loss/source",
    "loss/destination",
    { phase: "after" },
  );
  const delivered = await waitForDelivery(
    deliveries,
    2,
    "post-fault delivery",
  );
  const pathWrites = network.entries("delivered", {
    type: "message",
    messageId: receipt.messageId,
  });

  assert.deepEqual(delivered.payload, { phase: "after" });
  assert.deepEqual(
    pathWrites.map(({ from, to }) => [from, to]),
    [
      ["loss.source", "loss.branch.b"],
      ["loss.branch.b", "loss.destination"],
    ],
  );
  assert.equal(
    network.entries("closed").some(
      (entry) =>
        entry.from === "loss.branch.a" || entry.to === "loss.branch.a",
    ),
    true,
  );
});
