import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  expose,
  listen,
  nextEvent,
  peer,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given a converged three-node line and a source limited to the last usable hop, when it sends across the transit node, then zero onward data and one correlated reverse HOP_LIMIT_EXCEEDED are observed while reverse traffic remains usable", async (context) => {
  const network = new ChaosNetwork();
  const source = createChaosNode(network, {
    nodeId: "hop.source",
    listen: listen(13701),
    defaultHopLimit: 1,
  });
  const transit = createChaosNode(network, {
    nodeId: "hop.transit",
    listen: listen(13702),
    peers: [peer("transit-source", "hop.source", 13701)],
  });
  const destination = createChaosNode(network, {
    nodeId: "hop.destination",
    peers: [peer("destination-transit", "hop.transit", 13702)],
  });
  context.after(() => stopAll(destination, transit, source));
  const atSource = [];
  await expose(source, ["hop/source"], atSource);
  await expose(destination, ["hop/destination"]);
  await source.start();
  await transit.start();
  await destination.start();
  await waitForSnapshot(
    source,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) =>
        route.endpoint === "hop/destination"
        && route.path.length === 3,
    ),
    "two-hop destination route",
  );

  const subscription = source.operations.events();
  const failed = nextEvent(
    subscription,
    (event) =>
      event.kind === "message.failed"
      && event.data.code === "HOP_LIMIT_EXCEEDED",
    "correlated hop failure",
  );
  const receipt = await source.send(
    "hop/source",
    "hop/destination",
    { proof: "exhaust" },
  );
  const failure = await failed;
  subscription.close();
  await destination.send(
    "hop/destination",
    "hop/source",
    { proof: "reverse-still-usable" },
  );
  const reverse = await waitForDelivery(
    atSource,
    1,
    "reverse sibling delivery",
  );

  assert.equal(failure.subjectId, receipt.messageId);
  assert.equal(
    network.entries("delivered", {
      from: "hop.source",
      to: "hop.transit",
      type: "message",
      messageId: receipt.messageId,
    }).length,
    1,
  );
  assert.equal(
    network.entries("write-attempt", {
      from: "hop.transit",
      to: "hop.destination",
      type: "message",
      messageId: receipt.messageId,
    }).length,
    0,
  );
  assert.equal(
    network.entries("delivered", {
      from: "hop.transit",
      to: "hop.source",
      type: "error",
    }).length,
    1,
  );
  assert.deepEqual(reverse.payload, { proof: "reverse-still-usable" });
});
