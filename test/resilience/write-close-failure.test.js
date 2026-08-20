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
  waitForSnapshot,
} from "./support/fixture.js";

test("Given a healthy session with empty writer queues, when one exact route write fails, then its reservation releases once and replacement converges without stale forwarding", async (context) => {
  const network = new ChaosNetwork();
  const hub = createChaosNode(network, {
    nodeId: "write.hub",
    listen: listen(13301),
  });
  const leaf = createChaosNode(network, {
    nodeId: "write.leaf",
    peers: [peer("leaf-hub", "write.hub", 13301)],
  });
  context.after(() => stopAll(leaf, hub));
  await expose(leaf, ["write/first"]);
  await hub.start();
  await leaf.start();
  const initial = await waitForSnapshot(
    hub,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.selectedRoutes.some(
        (route) => route.endpoint === "write/first",
      ),
    "initial write session",
  );
  const firstSession = initial.connections[0].sessionId;
  const ruleId = network.fault("fail-write", {
    from: "write.leaf",
    to: "write.hub",
    type: "route.update",
  });

  await expose(leaf, ["write/second"]);
  const recovered = await waitForSnapshot(
    leaf,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.connections[0]?.sessionId !== firstSession
      && snapshot.connections[0]?.routeExport.acked?.routes.length === 2,
    "post-write-failure replacement",
  );
  await waitForSnapshot(
    hub,
    (snapshot) =>
      ["write/first", "write/second"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "authoritative routes after write failure",
  );

  assert.equal(network.entries("write-failed", { ruleId }).length, 1);
  assert.equal(recovered.connections[0].queues.control.currentMessages, "0");
  assert.equal(recovered.connections[0].queues.data.currentMessages, "0");
  assert.equal(
    network.entries("delivered", {
      from: "write.leaf",
      to: "write.hub",
      type: "route.update",
    }).at(-1).document.includes("write/second"),
    true,
  );
});

test("Given one established physical connection, when its exact orderly carrier close faults, then one neutral terminal completes bounded teardown and the peer purges the owning session", async (context) => {
  const network = new ChaosNetwork();
  const hub = createChaosNode(network, {
    nodeId: "close.hub",
    listen: listen(13302),
  });
  const leaf = createChaosNode(network, {
    nodeId: "close.leaf",
    peers: [peer("leaf-hub", "close.hub", 13302, false)],
  });
  context.after(() => stopAll(leaf, hub));
  await expose(leaf, ["close/owned"]);
  await hub.start();
  await leaf.start();
  await waitForSnapshot(
    hub,
    (snapshot) => snapshot.selectedRoutes.some(
      (route) => route.endpoint === "close/owned",
    ),
    "owned route before close",
  );
  const subscription = hub.operations.events();
  const closed = nextEvent(
    subscription,
    (event) => event.kind === "session.closed",
    "session close with carrier terminal",
  );
  const ruleId = network.fault("fail-close", {
    from: "close.leaf",
    to: "close.hub",
  });

  const report = await leaf.stop({ drainTimeoutMs: 25 });
  const closedEvent = await closed;
  subscription.close();
  const purged = await waitForSnapshot(
    hub,
    (snapshot) =>
      snapshot.connections.length === 0
      && snapshot.selectedRoutes.every(
        (route) => route.endpoint !== "close/owned",
      ),
    "peer session purge",
  );

  assert.equal(network.entries("close-failed", { ruleId }).length, 1);
  assert.deepEqual(closedEvent.data.terminal, {
    origin: "carrier",
    kind: "io-failure",
    diagnostic: { code: "PEER_CLOSE_FAILED" },
  });
  assert.equal(
    network.entries("force-abort", {
      from: "close.leaf",
      to: "close.hub",
    }).length,
    0,
  );
  assert.equal(report.discardedMessages, "0");
  assert.equal(purged.advertisements.length, 0);
  assert.equal(leaf.operations.lifecycle().state, "Stopped");
});
