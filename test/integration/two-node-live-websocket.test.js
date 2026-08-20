import assert from "node:assert/strict";
import test from "node:test";
import {
  createWebSocketNode,
  establishedWith,
  expose,
  hasAckedExport,
  memoryPeer,
  selectedRoute,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given two public nodes on a real loopback WebSocket, when they establish and exchange JSON, then routing and delivery work in both directions", async (context) => {
  const listener = createWebSocketNode({
    nodeId: "node.ws-listener",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  context.after(() => stopAll(listener));
  const listenerDeliveries = [];
  await expose(listener, ["ws/listener"], listenerDeliveries);
  const startedListener = await listener.start();
  assert.match(startedListener.listener.publication.displayAddress, /^ws:\/\/127\.0\.0\.1:\d+\/agp$/);

  const dialer = createWebSocketNode({
    nodeId: "node.ws-dialer",
    peers: [{
      ...memoryPeer("dialer-listener", "node.ws-listener", 1),
      url: startedListener.listener.publication.displayAddress,
    }],
  });
  context.after(() => stopAll(dialer));
  const dialerDeliveries = [];
  await expose(dialer, ["ws/dialer"], dialerDeliveries);
  await dialer.start();

  await waitForSnapshot(
    listener,
    () =>
      establishedWith(listener, "node.ws-dialer")
      && selectedRoute(listener, "ws/dialer") !== undefined
      && hasAckedExport(
        listener,
        "ws/listener",
        "node.ws-dialer",
      ),
    "listener Established session, dialer route, and ACKed source export over WebSocket",
  );
  await waitForSnapshot(
    dialer,
    () =>
      establishedWith(dialer, "node.ws-listener")
      && selectedRoute(dialer, "ws/listener") !== undefined
      && hasAckedExport(
        dialer,
        "ws/dialer",
        "node.ws-listener",
      ),
    "dialer Established session, listener route, and ACKed source export over WebSocket",
  );

  const toListener = await dialer.send(
    "ws/dialer",
    "ws/listener",
    { direction: "dialer-to-listener" },
  );
  const atListener = await waitForDelivery(
    listenerDeliveries,
    1,
    "JSON delivery to loopback listener",
  );
  const toDialer = await listener.send(
    "ws/listener",
    "ws/dialer",
    { direction: "listener-to-dialer" },
  );
  const atDialer = await waitForDelivery(
    dialerDeliveries,
    1,
    "JSON delivery to loopback dialer",
  );

  assert.equal(toListener.nextHop.kind, "session");
  assert.deepEqual(atListener.payload, {
    direction: "dialer-to-listener",
  });
  assert.equal(toDialer.nextHop.kind, "session");
  assert.deepEqual(atDialer.payload, {
    direction: "listener-to-dialer",
  });
});
