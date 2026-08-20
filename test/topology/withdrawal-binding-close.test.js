import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoopbackNode,
  expose,
  hasAckedExport,
  memoryPeer,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given one node with two local endpoint bindings and a converged peer, when one exact binding closes, then both local and remote RIBs remove only that endpoint and the sibling remains deliverable", async (context) => {
  const owner = createLoopbackNode({
    nodeId: "binding.owner",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  let peer;
  context.after(() => stopAll(peer, owner));
  const startedOwner = await owner.start();
  peer = createLoopbackNode({
    nodeId: "binding.peer",
    peers: [{
      ...memoryPeer("peer-owner", "binding.owner", 1),
      url: startedOwner.listener.publication.displayAddress,
    }],
  });
  const atOwner = [];
  const [withdrawn] = await expose(owner, [
    "binding/withdrawn",
    "binding/sibling",
  ], atOwner);
  await expose(peer, ["binding/source"]);
  await peer.start();
  await waitForSnapshot(
    peer,
    (snapshot) =>
      ["binding/withdrawn", "binding/sibling"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "both owner bindings at peer",
  );
  await waitForSnapshot(
    peer,
    () => hasAckedExport(peer, "binding/source", "binding.owner"),
    "peer source export acknowledged by owner",
  );

  await withdrawn.close();
  const [localAfter, remoteAfter] = await Promise.all([
    waitForSnapshot(
      owner,
      (snapshot) =>
        !snapshot.selectedRoutes.some(
          (route) => route.endpoint === "binding/withdrawn",
        )
        && snapshot.selectedRoutes.some(
          (route) => route.endpoint === "binding/sibling",
        ),
      "local binding removal",
    ),
    waitForSnapshot(
      peer,
      (snapshot) =>
        !snapshot.selectedRoutes.some(
          (route) => route.endpoint === "binding/withdrawn",
        )
        && snapshot.selectedRoutes.some(
          (route) => route.endpoint === "binding/sibling",
        ),
      "remote binding withdrawal",
    ),
  ]);
  await peer.send(
    "binding/source",
    "binding/sibling",
    { sibling: "reachable" },
  );
  const delivered = await waitForDelivery(
    atOwner,
    1,
    "sibling delivery after binding close",
  );

  assert.equal(
    localAfter.forwarding.some(
      (entry) => entry.endpoint === "binding/withdrawn",
    ),
    false,
  );
  assert.equal(
    remoteAfter.forwarding.some(
      (entry) => entry.endpoint === "binding/withdrawn",
    ),
    false,
  );
  await assert.rejects(
    peer.send("binding/source", "binding/withdrawn", { stale: true }),
    (error) => error.code === "NO_ROUTE",
  );
  assert.deepEqual(delivered.payload, { sibling: "reachable" });
});
