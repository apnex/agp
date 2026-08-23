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

test("Given a held final handler slot and an ACKed remote binding, when exact saturation overlaps that binding withdrawal, then admission rejects promptly while withdrawal converges and control readiness survives", async (context) => {
  const network = new ChaosNetwork();
  const occupied = barrier("C2 handler occupied");
  const node = createChaosNode(network, {
    nodeId: "c2saturation.node",
    listen: listen(14401),
    capacity: { maxActiveHandlers: 1 },
  });
  const remote = createChaosNode(network, {
    nodeId: "c2saturation.remote",
    peers: [peer("remote-node", "c2saturation.node", 14401)],
  });
  context.after(() => {
    occupied.release();
    return stopAll(remote, node);
  });
  await expose(node, ["c2saturation/source"]);
  await node.expose("c2saturation/blocked", async () => {
    occupied.reach();
    await occupied.released;
  });
  const [remoteBinding] = await expose(remote, ["c2saturation/remote"]);
  await node.start();
  await remote.start();
  await waitForSnapshot(
    node,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) => route.endpoint === "c2saturation/remote",
    ),
    "ACKed remote route",
  );
  const subscription = node.operations.messages();
  const completed = nextEvent(
    subscription,
    (event) => event.kind === "handler.completed",
    "occupied handler completion",
  );
  const occupying = await node.send(
    "c2saturation/source",
    "c2saturation/blocked",
    { phase: "occupy" },
  );
  await occupied.reached;
  const ledgerBarrier = network.ledger.at(-1)?.sequence ?? 0;

  const withdrawing = remoteBinding.close();
  await assert.rejects(
    node.send(
      "c2saturation/source",
      "c2saturation/blocked",
      { phase: "reject" },
    ),
    { code: "QUEUE_FULL" },
  );
  await withdrawing;
  const afterWithdrawal = await waitForSnapshot(
    node,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.selectedRoutes.every(
        (route) => route.endpoint !== "c2saturation/remote",
      ),
    "withdrawal during saturation",
  );
  occupied.release();
  const completion = await completed;
  subscription.close();
  const withdrawalFrame = network.entries("delivered", {
    from: "c2saturation.remote",
    to: "c2saturation.node",
    type: "route.update",
  }).findLast((entry) => entry.sequence > ledgerBarrier);

  assert.equal(completion.subjectId, occupying.messageId);
  assert.equal(afterWithdrawal.connections.length, 1);
  assert.equal(withdrawalFrame.document.includes("c2saturation/remote"), false);
  assert.equal(
    network.entries("delivered", {
      from: "c2saturation.node",
      to: "c2saturation.remote",
      type: "route.ack",
    }).some((entry) => entry.sequence > ledgerBarrier),
    true,
  );
});
