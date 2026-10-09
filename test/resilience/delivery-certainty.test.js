import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "@agp/node";
import { createLoopbackFabric } from "@agp/transport-loopback";

async function untilObserved(predicate, description) {
  const deadline = performance.now() + 5_000;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`Delivery certainty probe did not observe ${description}`);
}

async function assertDeliveryUncertainty(nodeCount) {
  const fabricId = `delivery-certainty-${nodeCount}`;
  const fabric = createLoopbackFabric({
    fabricId,
    limits: {
      maxTransports: 4,
      maxListeners: 4,
      maxPendingAcquisitions: 4,
      maxActiveChannels: 4,
      maxPacketBytes: 16_777_216,
      maxBufferedPacketsPerChannel: 1_024,
      maxBufferedBytesPerChannel: 33_554_432,
      maxQueuedPacketsTotal: 65_536,
      maxQueuedBytesTotal: 268_435_456,
      maxPendingSendBytesTotal: 17_179_869_184,
    },
  });
  const nodes = [];
  let finalChannel;
  let handlerCalls = 0;
  try {
    for (let index = 0; index < nodeCount; index += 1) {
      const port = fabric.createTransport({
        transportName: `node-${index}`,
        capabilities: { listen: index > 0, connect: index < nodeCount - 1 },
      }).createPort({
        listeners: new Map(index === 0 ? [] : [["listen", { fabricId, address: `node-${index}` }]]),
        targets: new Map(index === nodeCount - 1 ? [] : [["next", { fabricId, address: `node-${index + 1}` }]]),
      });
      const transport = {
        resolveListener: (reference) => port.resolveListener(reference),
        resolveTarget(reference) {
          const target = port.resolveTarget(reference);
          if (target === undefined) return undefined;
          return {
            async connect(options, signal) {
              const acquired = await target.connect(options, signal);
              if (index === nodeCount - 2) finalChannel = acquired;
              return acquired;
            },
          };
        },
      };
      nodes.push(createNode({
        nodeId: `node.${index}`,
        ...(index === 0 ? {} : { listen: { transportRef: "listen" } }),
        peers: index === nodeCount - 1 ? [] : [{
          adjacencyId: "next",
          expectedNodeId: `node.${index + 1}`,
          transportRef: "next",
        }],
        transit: { enabled: true },
        capacity: { maxSessions: 4, maxPendingHandshakes: 4 },
        timers: { holdTimeMs: 0 },
        disposition: index === nodeCount - 1
          ? { debounceMs: 60_000, maximumOutcomes: 1_000_000 }
          : { debounceMs: 0 },
      }, { transport }));
    }
    await nodes[0].expose("origin/source", async () => {});
    await nodes.at(-1).expose("sink/service", async () => { handlerCalls += 1; });
    for (const node of [...nodes].reverse()) await node.start();
    await untilObserved(() => nodes.slice(0, -1).every((node, index) =>
      node.operations.routes().selected.some(({ endpoint }) => endpoint === "sink/service")
      && node.operations.routeExports().items.some(({ endpoint, remoteNodeId, state }) =>
        endpoint === "origin/source" && remoteNodeId === `node.${index + 1}` && state === "acked")),
    "destination routes and acknowledged source exports");
    const receipt = await nodes[0].send("origin/source", "sink/service", { operation: "observe" });
    await untilObserved(() => handlerCalls === 1, "destination handler invocation");
    assert.equal(nodes[0].disposition(receipt.messageId).settled, false);
    assert.ok(finalChannel);
    finalChannel.abort({ kind: "abort" });
    await untilObserved(() => nodes[0].disposition(receipt.messageId)?.settled === true,
      "origin disposition after channel loss");
    const disposition = nodes[0].disposition(receipt.messageId);
    assert.equal(handlerCalls, 1);
    assert.deepEqual(disposition.outcomes, [{ kind: "unknown" }]);
  } finally {
    await Promise.allSettled(nodes.map((node) => node.stop()));
    await fabric.close(AbortSignal.timeout(5_000));
  }
}

for (const nodeCount of [2, 3]) {
  test(`Given a delivered message across ${nodeCount} nodes, when its return channel is lost, then the origin reports unknown rather than non-delivery`,
    { timeout: 10_000 }, () => assertDeliveryUncertainty(nodeCount));
}
