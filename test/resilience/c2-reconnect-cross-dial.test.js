import assert from "node:assert/strict";
import test from "node:test";
import { waitForTestEvent } from "../support/test-waits.js";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  eventually,
  expose,
  listen,
  peer,
  stopAll,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given a canonical reciprocal session with both adjacencies suppressed or satisfied, when link loss overlaps two barrier-released reconnect dials, then the same higher-node direction wins with fresh exact sessions and complete snapshots", async (context) => {
  const network = new ChaosNetwork();
  const lower = createChaosNode(network, {
    nodeId: "c2dial.a",
    listen: listen(14301),
    peers: [peer("a-b", "c2dial.b", 14302)],
  });
  const higher = createChaosNode(network, {
    nodeId: "c2dial.b",
    listen: listen(14302),
    peers: [peer("b-a", "c2dial.a", 14301)],
  });
  let firstBarrier;
  let reconnectBarrier;
  context.after(() => {
    firstBarrier?.release();
    reconnectBarrier?.release();
    return stopAll(higher, lower);
  });
  await expose(lower, ["c2dial/lower"]);
  await expose(higher, ["c2dial/higher"]);
  firstBarrier = network.dialBarrier(2);
  const starting = Promise.allSettled([lower.start(), higher.start()]);
  await waitForTestEvent(firstBarrier.reached, "initial reciprocal dials at barrier", { signal: context.signal });
  firstBarrier.release();
  const started = await waitForTestEvent(starting, "initial reciprocal nodes started", { signal: context.signal });
  for (const result of started) if (result.status === "rejected") throw result.reason;
  const [firstLower, firstHigher] = await Promise.all([
    waitForSnapshot(
      lower,
      converged("c2dial.b"),
      "initial canonical lower view",
    ),
    waitForSnapshot(
      higher,
      converged("c2dial.a"),
      "initial canonical higher view",
    ),
  ]);
  const firstLowerSession = firstLower.connections[0].sessionId;
  const firstHigherSession = firstHigher.connections[0].sessionId;

  reconnectBarrier = network.dialBarrier(2);
  network.forceLink("c2dial.a", "c2dial.b", "C2_RECONNECT");
  await eventually(
    () => network.entries("dial-barrier-reached").length === 4,
    "both reconnect dials at overlap barrier",
  );
  reconnectBarrier.release();
  const [secondLower, secondHigher] = await Promise.all([
    waitForSnapshot(
      lower,
      (snapshot) =>
        converged("c2dial.b")(snapshot)
        && snapshot.connections[0].sessionId !== firstLowerSession,
      "replacement canonical lower view",
    ),
    waitForSnapshot(
      higher,
      (snapshot) =>
        converged("c2dial.a")(snapshot)
        && snapshot.connections[0].sessionId !== firstHigherSession,
      "replacement canonical higher view",
    ),
  ]);

  assert.equal(secondLower.connections[0].direction, "inbound");
  assert.equal(secondHigher.connections[0].direction, "outbound");
  assert.equal(
    secondLower.connections[0].sessionId,
    secondHigher.connections[0].remoteSessionId,
  );
  assert.equal(
    secondLower.connections[0].remoteSessionId,
    secondHigher.connections[0].sessionId,
  );
  assert.equal(network.entries("dial-connected").length, 4);
  assert.equal(
    network.entries("force-abort", {
      from: "c2dial.a",
      to: "c2dial.b",
    }).length,
    1,
  );
});

function converged(remoteNodeId) {
  return (snapshot) =>
    snapshot.connections.length === 1
    && snapshot.connections[0]?.state === "Established"
    && snapshot.connections[0]?.remoteNodeId === remoteNodeId
    && ["c2dial/higher", "c2dial/lower"].every((endpoint) =>
      snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
    );
}
