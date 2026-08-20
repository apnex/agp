import assert from "node:assert/strict";
import test from "node:test";
import { createNode, NodeImpl } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

test("Given listener-only and dial-only configs, when two nodes start, then one NodeImpl converges and routes delivery", async (t) => {
  const network = new MemoryPeerNetwork();
  const central = createNode({
    nodeId: "node.central",
    listen: { transportRef: "central.listener" },
    transit: { enabled: true },
  }, {
    transport: network.transport({ listeners: ["central.listener"] }),
  });
  const leaf = createNode({
    nodeId: "node.leaf",
    peers: [{
      adjacencyId: "central",
      expectedNodeId: "node.central",
      transportRef: "central.listener",
    }],
    transit: { enabled: false },
  }, {
    transport: network.transport({ targets: ["central.listener"] }),
  });
  t.after(async () => {
    await Promise.allSettled([leaf.stop(), central.stop()]);
  });

  assert.ok(central instanceof NodeImpl);
  assert.ok(leaf instanceof NodeImpl);
  assert.equal("role" in central, false);
  assert.equal("role" in leaf, false);

  let received;
  await central.expose("central/service", async (payload, context) => {
    received = { payload, context };
  });
  await leaf.expose("leaf/client", async () => {});
  await central.start();
  await leaf.start();

  await eventually(() => {
    const leafSession = leaf.operations.connections().items[0];
    const centralSession = central.operations.connections().items[0];
    return leafSession?.state === "Established"
      && centralSession?.state === "Established";
  }, "symmetric Established sessions");

  await eventually(() => {
    const route = leaf.operations.routes().selected.find(
      (candidate) => candidate.endpoint === "central/service",
    );
    const sourceExport = leaf.operations.routeExports().items.find(
      (candidate) =>
        candidate.endpoint === "leaf/client"
        && candidate.state === "acked",
    );
    return route !== undefined && sourceExport !== undefined;
  }, "leaf destination RIB and ACKed source export");

  const receipt = await leaf.send(
    "leaf/client",
    "central/service",
    { hello: "uniform-node" },
  );
  await eventually(() => received, "routed handler delivery");

  assert.equal(receipt.nextHop.kind, "session");
  assert.deepEqual(received.payload, { hello: "uniform-node" });
  assert.equal(received.context.delivery.source.endpoint, "leaf/client");
  assert.equal(
    received.context.delivery.source.originNodeId,
    "node.leaf",
  );
});
