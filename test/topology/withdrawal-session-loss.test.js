import assert from "node:assert/strict";
import test from "node:test";
import { connectUniformRawPeer } from "../support/uniform-raw-peer.js";
import {
  createWebSocketNode,
  expose,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given one live session owning two learned routes beside a local route, when only that session closes, then all and only its owned routing state disappears atomically", async (context) => {
  const receiver = createWebSocketNode({
    nodeId: "loss.receiver",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  let raw;
  context.after(async () => {
    await Promise.allSettled([raw?.close(), stopAll(receiver)]);
  });
  await expose(receiver, ["loss/local"]);
  const startedReceiver = await receiver.start();
  raw = await connectUniformRawPeer({
    nodeId: "loss.peer",
    targetNodeId: "loss.receiver",
    url: startedReceiver.listener.publication.displayAddress,
    routes: [
      {
        endpoint: "loss/one",
        originNodeId: "loss.peer",
        path: ["loss.peer"],
      },
      {
        endpoint: "loss/two",
        originNodeId: "loss.peer",
        path: ["loss.peer"],
      },
    ],
  });
  await waitForSnapshot(
    receiver,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.selectedRoutes.length === 3,
    "session-owned routes before loss",
  );

  await raw.close();
  raw = undefined;
  const after = await waitForSnapshot(
    receiver,
    (snapshot) =>
      snapshot.connections.length === 0
      && snapshot.selectedRoutes.length === 1
      && snapshot.selectedRoutes[0].endpoint === "loss/local",
    "session-owned route purge",
  );

  assert.deepEqual(
    after.candidateRoutes.map((route) => route.endpoint),
    ["loss/local"],
  );
  assert.deepEqual(
    after.forwarding.map((entry) => entry.endpoint),
    ["loss/local"],
  );
  assert.equal(after.lifecycle.state, "Running");
});
