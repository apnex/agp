import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoopbackNode,
  expose,
  hasAckedExport,
  memoryPeer,
  selectedRoute,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given a healthy four-node diamond with two equal paths, when one message is sent, then deterministic selection uses only the preferred branch and leaves the alternate observable", async (context) => {
  const source = createLoopbackNode({
    nodeId: "node.a",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  const destination = createLoopbackNode({
    nodeId: "node.d",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
  });
  let left;
  let right;
  context.after(() => stopAll(right, left, destination, source));
  const [startedSource, startedDestination] = await Promise.all([
    source.start(),
    destination.start(),
  ]);
  left = createLoopbackNode({
    nodeId: "node.b",
    peers: [
      { ...memoryPeer("b-a", "node.a", 1), url: startedSource.listener.publication.displayAddress },
      { ...memoryPeer("b-d", "node.d", 1), url: startedDestination.listener.publication.displayAddress },
    ],
  });
  right = createLoopbackNode({
    nodeId: "node.c",
    peers: [
      { ...memoryPeer("c-a", "node.a", 1), url: startedSource.listener.publication.displayAddress },
      { ...memoryPeer("c-d", "node.d", 1), url: startedDestination.listener.publication.displayAddress },
    ],
  });
  const atDestination = [];
  await expose(source, ["diamond/source"]);
  await expose(destination, ["diamond/destination"], atDestination);

  await Promise.all([left.start(), right.start()]);
  const converged = await waitForSnapshot(
    source,
    (snapshot) =>
      snapshot.candidateRoutes.filter(
        (route) => route.endpoint === "diamond/destination",
      ).length === 2,
    "both diamond candidates at source",
  );
  const initial = selectedRoute(source, "diamond/destination");
  assert.equal(initial.nextHop.nodeId, "node.b");
  assert.equal(
    converged.candidateRoutes.filter(
      (route) => route.endpoint === "diamond/destination",
    ).length,
    2,
  );
  await Promise.all([
    waitForSnapshot(
      source,
      () => hasAckedExport(source, "diamond/source", "node.b"),
      "source export acknowledged by preferred branch",
    ),
    waitForSnapshot(
      left,
      () => hasAckedExport(left, "diamond/source", "node.d"),
      "preferred transit source export acknowledged by destination",
    ),
  ]);
  const leftBefore = BigInt(
    left.operations.snapshot().counters.values["message.forwarded"] ?? "0",
  );
  const rightBefore = BigInt(
    right.operations.snapshot().counters.values["message.forwarded"] ?? "0",
  );

  await source.send(
    "diamond/source",
    "diamond/destination",
    { branch: "preferred" },
  );
  const delivered = await waitForDelivery(
    atDestination,
    1,
    "selected diamond delivery",
  );
  const leftAfter = await waitForSnapshot(
    left,
    (snapshot) =>
      BigInt(snapshot.counters.values["message.forwarded"] ?? "0")
        === leftBefore + 1n,
    "one preferred-branch forward",
  );

  assert.deepEqual(delivered.payload, { branch: "preferred" });
  assert.equal(atDestination.length, 1);
  assert.equal(
    BigInt(leftAfter.counters.values["message.forwarded"]),
    leftBefore + 1n,
  );
  assert.equal(
    BigInt(
      right.operations.snapshot().counters.values["message.forwarded"] ?? "0",
    ),
    rightBefore,
  );
  assert.equal(
    source.operations.snapshot().candidateRoutes.filter(
      (route) => route.endpoint === "diamond/destination",
    ).length,
    2,
  );
  assert.equal(
    selectedRoute(source, "diamond/destination").nextHop.nodeId,
    "node.b",
  );
});
