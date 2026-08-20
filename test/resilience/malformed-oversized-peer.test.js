import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  expose,
  listen,
  peer,
  stopAll,
  waitForDelivery,
  waitForSnapshot,
} from "./support/fixture.js";

test("Given two established uniform peers with independent routes, when one connection receives malformed JSON, then only the offender is terminated and the sibling route still delivers", async (context) => {
  const fixture = await startIsolationStar("malformed", 13901);
  context.after(() => fixture.stop());
  fixture.network.injectText(
    "malformed.faulty",
    "malformed.receiver",
    "{",
  );
  const isolated = await waitForSnapshot(
    fixture.receiver,
    siblingOnly("malformed"),
    "malformed peer isolation",
  );
  const receipt = await fixture.receiver.send(
    "malformed/source",
    "malformed/healthy",
    { proof: "sibling" },
  );
  const delivery = await waitForDelivery(
    fixture.deliveries,
    1,
    "healthy delivery after malformed input",
  );

  assert.equal(fixture.network.entries("inject-text", {
    from: "malformed.faulty",
    to: "malformed.receiver",
    type: "invalid",
  }).length, 1);
  assert.equal(isolated.connections[0].remoteNodeId, "malformed.healthy");
  assert.equal(delivery.context.delivery.messageId, receipt.messageId);
  assert.deepEqual(delivery.payload, { proof: "sibling" });
});

test("Given two established uniform peers within a bounded receive envelope, when one transport reports an oversized frame, then only that offender is terminated and canonical sibling routing remains usable", async (context) => {
  const fixture = await startIsolationStar("oversized", 13902);
  context.after(() => fixture.stop());
  fixture.network.injectInputRejected(
    "oversized.faulty",
    "oversized.receiver",
    { code: "MESSAGE_TOO_LARGE", closeCode: 1009 },
  );
  const isolated = await waitForSnapshot(
    fixture.receiver,
    siblingOnly("oversized"),
    "oversized peer isolation",
  );
  const receipt = await fixture.receiver.send(
    "oversized/source",
    "oversized/healthy",
    { proof: "bounded-sibling" },
  );
  const delivery = await waitForDelivery(
    fixture.deliveries,
    1,
    "healthy delivery after oversized input",
  );

  assert.equal(fixture.network.entries("inject-input-rejected", {
    from: "oversized.faulty",
    to: "oversized.receiver",
    code: "MESSAGE_TOO_LARGE",
  }).length, 1);
  assert.equal(isolated.connections[0].remoteNodeId, "oversized.healthy");
  assert.equal(delivery.context.delivery.messageId, receipt.messageId);
  assert.deepEqual(delivery.payload, { proof: "bounded-sibling" });
});

async function startIsolationStar(prefix, port) {
  const network = new ChaosNetwork();
  const receiver = createChaosNode(network, {
    nodeId: `${prefix}.receiver`,
    listen: listen(port),
  });
  const faulty = createChaosNode(network, {
    nodeId: `${prefix}.faulty`,
    peers: [peer("faulty-receiver", `${prefix}.receiver`, port, false)],
  });
  const healthy = createChaosNode(network, {
    nodeId: `${prefix}.healthy`,
    peers: [peer("healthy-receiver", `${prefix}.receiver`, port, false)],
  });
  const deliveries = [];
  await expose(receiver, [`${prefix}/source`]);
  await expose(faulty, [`${prefix}/faulty`]);
  await expose(healthy, [`${prefix}/healthy`], deliveries);
  await receiver.start();
  await Promise.all([faulty.start(), healthy.start()]);
  await waitForSnapshot(
    receiver,
    (snapshot) =>
      snapshot.connections.length === 2
      && [`${prefix}/faulty`, `${prefix}/healthy`].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    `${prefix} initial star`,
  );
  return {
    network,
    receiver,
    faulty,
    healthy,
    deliveries,
    stop: () => stopAll(healthy, faulty, receiver),
  };
}

function siblingOnly(prefix) {
  return (snapshot) =>
    snapshot.connections.length === 1
    && snapshot.connections[0]?.remoteNodeId === `${prefix}.healthy`
    && snapshot.selectedRoutes.some(
      (route) => route.endpoint === `${prefix}/healthy`,
    )
    && snapshot.selectedRoutes.every(
      (route) => route.endpoint !== `${prefix}/faulty`,
    );
}
