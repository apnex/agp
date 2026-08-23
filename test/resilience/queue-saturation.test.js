import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  barrier,
  createChaosNode,
  expose,
  listen,
  nextEvent,
  peer,
  stopAll,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given the sole local handler reservation is held at a named barrier, when another delivery reaches exact saturation, then it fails QUEUE_FULL without waiting while control-plane route convergence remains responsive", async (context) => {
  const network = new ChaosNetwork();
  const occupied = barrier("handler occupied");
  const node = createChaosNode(network, {
    nodeId: "saturation.node",
    listen: listen(13801),
    capacity: { maxActiveHandlers: 1 },
  });
  const peerNode = createChaosNode(network, {
    nodeId: "saturation.peer",
    peers: [peer("peer-node", "saturation.node", 13801)],
  });
  context.after(() => {
    occupied.release();
    return stopAll(peerNode, node);
  });
  await expose(node, ["saturation/source"]);
  await node.expose("saturation/blocked", async () => {
    occupied.reach();
    await occupied.released;
  });
  await node.start();
  await peerNode.start();
  await waitForSnapshot(
    node,
    (snapshot) => snapshot.connections[0]?.state === "Established",
    "initial peer readiness",
  );
  const subscription = node.operations.messages();
  const completed = nextEvent(
    subscription,
    (event) => event.kind === "handler.completed",
    "held handler completion",
  );

  const first = await node.send(
    "saturation/source",
    "saturation/blocked",
    { slot: "occupy" },
  );
  await occupied.reached;
  await assert.rejects(
    node.send(
      "saturation/source",
      "saturation/blocked",
      { slot: "reject" },
    ),
    { code: "QUEUE_FULL" },
  );
  await expose(peerNode, ["saturation/control-proof"]);
  const responsive = await waitForSnapshot(
    node,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.selectedRoutes.some(
        (route) => route.endpoint === "saturation/control-proof",
      ),
    "control route under handler saturation",
  );
  occupied.release();
  const completion = await completed;
  subscription.close();

  assert.equal(completion.subjectId, first.messageId);
  assert.equal(responsive.connections.length, 1);
  assert.equal(
    network.entries("delivered", {
      from: "saturation.peer",
      to: "saturation.node",
      type: "route.update",
    }).some((entry) => entry.document.includes("saturation/control-proof")),
    true,
  );
});
