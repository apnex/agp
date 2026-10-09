import assert from "node:assert/strict";
import test from "node:test";
import { waitForTestEvent } from "../support/test-waits.js";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  listen,
  peer,
  stopAll,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given two identical listening nodes with reciprocal adjacencies, when both dial attempts are released from one named barrier, then both retain the higher-node-initiated physical session and suppress the loser", async (context) => {
  const network = new ChaosNetwork();
  const lower = createChaosNode(network, {
    nodeId: "cross.a",
    listen: listen(13501),
    peers: [peer("a-b", "cross.b", 13502)],
  });
  const higher = createChaosNode(network, {
    nodeId: "cross.b",
    listen: listen(13502),
    peers: [peer("b-a", "cross.a", 13501)],
  });
  const dialBarrier = network.dialBarrier(2);
  context.after(() => {
    dialBarrier.release();
    return stopAll(higher, lower);
  });
  const starting = Promise.allSettled([lower.start(), higher.start()]);
  assert.equal(await waitForTestEvent(dialBarrier.reached, "both reciprocal dials at barrier", { signal: context.signal }), 2);
  dialBarrier.release();
  const started = await waitForTestEvent(starting, "reciprocal nodes started", { signal: context.signal });
  for (const result of started) if (result.status === "rejected") throw result.reason;

  const [atLower, atHigher] = await Promise.all([
    waitForSnapshot(
      lower,
      (snapshot) =>
        snapshot.connections.length === 1
        && snapshot.connections[0].state === "Established",
      "one retained session at lower node",
    ),
    waitForSnapshot(
      higher,
      (snapshot) =>
        snapshot.connections.length === 1
        && snapshot.connections[0].state === "Established",
      "one retained session at higher node",
    ),
  ]);
  const lowerSession = atLower.connections[0];
  const higherSession = atHigher.connections[0];

  assert.equal(lowerSession.remoteNodeId, "cross.b");
  assert.equal(lowerSession.direction, "inbound");
  assert.equal(higherSession.remoteNodeId, "cross.a");
  assert.equal(higherSession.direction, "outbound");
  assert.equal(lowerSession.sessionId, higherSession.remoteSessionId);
  assert.equal(lowerSession.remoteSessionId, higherSession.sessionId);
  assert.equal(network.entries("dial-connected").length, 2);
  assert.equal(network.entries("close-attempt").length >= 1, true);
});
