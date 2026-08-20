import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoopbackNode,
  expose,
  memoryPeer,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given a converged pair that is fully replaced, when new one-shot instances start from empty derived state, then equivalent reachability reconverges under new instance identities", async (context) => {
  const listenerDescription = {
    nodeId: "node.restart.a",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    idNamespace: "node.restart.a.first",
  };
  let listener = createLoopbackNode(listenerDescription);
  let dialer;
  context.after(() => stopAll(dialer, listener));
  await expose(listener, ["restart/a"]);
  const startedListener = await listener.start();
  const dialerDescription = {
    nodeId: "node.restart.b",
    peers: [{
      ...memoryPeer("b-a", "node.restart.a", 1),
      url: startedListener.listener.publication.displayAddress,
    }],
    idNamespace: "node.restart.b.first",
  };
  dialer = createLoopbackNode(dialerDescription);
  await expose(dialer, ["restart/b"]);
  await dialer.start();
  const first = await waitForSnapshot(
    dialer,
    (snapshot) => snapshot.selectedRoutes.length === 2,
    "first pair convergence",
  );

  await stopAll(dialer, listener);
  listener = createLoopbackNode({
    ...listenerDescription,
    idNamespace: "node.restart.a.second",
  });
  const replacementStarted = await listener.start();
  dialer = createLoopbackNode({
    ...dialerDescription,
    peers: [{
      ...memoryPeer("b-a", "node.restart.a", 1),
      url: replacementStarted.listener.publication.displayAddress,
    }],
    idNamespace: "node.restart.b.second",
  });
  const emptyListener = listener.operations.snapshot();
  const emptyDialer = dialer.operations.snapshot();
  assert.equal(emptyListener.connections.length, 0);
  assert.equal(emptyListener.selectedRoutes.length, 0);
  assert.equal(emptyDialer.connections.length, 0);
  assert.equal(emptyDialer.selectedRoutes.length, 0);
  assert.notEqual(emptyDialer.instanceId, first.instanceId);

  await expose(listener, ["restart/a"]);
  await expose(dialer, ["restart/b"]);
  await dialer.start();
  const replacement = await waitForSnapshot(
    dialer,
    (snapshot) => snapshot.selectedRoutes.length === 2,
    "replacement pair reconvergence",
  );

  assert.deepEqual(
    replacement.selectedRoutes.map((route) => route.endpoint).sort(),
    ["restart/a", "restart/b"],
  );
  assert.equal(replacement.connections[0].state, "Established");
});
