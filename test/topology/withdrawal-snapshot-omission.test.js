import assert from "node:assert/strict";
import test from "node:test";
import { connectUniformRawPeer } from "../support/uniform-raw-peer.js";
import {
  createWebSocketNode,
  expose,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given an established peer whose authoritative snapshot contains two routes, when its successor snapshot omits one route, then the receiver replaces that peer set without retaining a stale candidate", async (context) => {
  const receiver = createWebSocketNode({
    nodeId: "omission.receiver",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  let raw;
  context.after(async () => {
    await Promise.allSettled([raw?.close(), stopAll(receiver)]);
  });
  await expose(receiver, ["omission/local"]);
  const startedReceiver = await receiver.start();
  raw = await connectUniformRawPeer({
    nodeId: "omission.peer",
    targetNodeId: "omission.receiver",
    url: startedReceiver.listener.publication.displayAddress,
    routes: [
      {
        endpoint: "omission/removed",
        originNodeId: "omission.peer",
        path: ["omission.peer"],
      },
      {
        endpoint: "omission/retained",
        originNodeId: "omission.peer",
        path: ["omission.peer"],
      },
    ],
  });
  const before = await waitForSnapshot(
    receiver,
    (snapshot) =>
      ["omission/removed", "omission/retained"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "initial authoritative route set",
  );

  const ack = await raw.sendUpdate([{
    endpoint: "omission/retained",
    originNodeId: "omission.peer",
    path: ["omission.peer"],
  }]);
  const after = await waitForSnapshot(
    receiver,
    (snapshot) =>
      !snapshot.candidateRoutes.some(
        (route) => route.endpoint === "omission/removed",
      )
      && snapshot.selectedRoutes.some(
        (route) => route.endpoint === "omission/retained",
      ),
    "successor authoritative omission",
  );

  assert.equal(BigInt(after.revision) > BigInt(before.revision), true);
  assert.equal(ack.body.rejected.length, 0);
  assert.equal(
    after.forwarding.some(
      (entry) => entry.endpoint === "omission/removed",
    ),
    false,
  );
  assert.equal(
    after.advertisements.some(
      (route) => route.endpoint === "omission/removed",
    ),
    false,
  );
  assert.equal(after.connections[0].routeImport.routeCount, 1);
});
