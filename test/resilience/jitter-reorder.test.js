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

test("Given two legal route revisions already linearized in order, when the transport deterministically replays the older revision after the newer barrier, then the stale order is rejected exactly and local sibling state survives", async (context) => {
  const network = new ChaosNetwork();
  const receiver = createChaosNode(network, {
    nodeId: "reorder.receiver",
    listen: listen(13401),
  });
  const sender = createChaosNode(network, {
    nodeId: "reorder.sender",
    peers: [peer("sender-receiver", "reorder.receiver", 13401, false)],
  });
  context.after(() => stopAll(sender, receiver));
  await expose(receiver, ["reorder/local"]);
  await expose(sender, ["reorder/one"]);
  await receiver.start();
  await sender.start();
  await waitForSnapshot(
    receiver,
    (snapshot) =>
      snapshot.connections[0]?.routeImport.consumedRevision === 1
      && snapshot.selectedRoutes.some(
        (route) => route.endpoint === "reorder/one",
      ),
    "first legal revision",
  );
  const oldFrame = network.entries("delivered", {
    from: "reorder.sender",
    to: "reorder.receiver",
    type: "route.update",
  })[0];
  assert.equal(JSON.parse(oldFrame.document).body.revision, 1);

  await expose(sender, ["reorder/two"]);
  await waitForSnapshot(
    receiver,
    (snapshot) =>
      snapshot.connections[0]?.routeImport.consumedRevision === 2
      && snapshot.selectedRoutes.some(
        (route) => route.endpoint === "reorder/two",
      ),
    "second legal revision",
  );
  network.injectText(
    "reorder.sender",
    "reorder.receiver",
    oldFrame.document,
  );
  const isolated = await waitForSnapshot(
    receiver,
    (snapshot) =>
      snapshot.connections.length === 0
      && snapshot.selectedRoutes.length === 1
      && snapshot.selectedRoutes[0]?.endpoint === "reorder/local",
    "stale revision isolation",
  );

  assert.equal(
    network.entries("inject-text", {
      from: "reorder.sender",
      to: "reorder.receiver",
      type: "route.update",
    }).length,
    1,
  );
  assert.deepEqual(
    isolated.selectedRoutes.map((route) => route.endpoint),
    ["reorder/local"],
  );
  assert.equal(
    network.entries("delivered", {
      from: "reorder.receiver",
      to: "reorder.sender",
      type: "notification",
    }).some(
      (entry) =>
        JSON.parse(entry.document).body.code === "ROUTE_REVISION_ERROR",
    ),
    true,
  );
});
