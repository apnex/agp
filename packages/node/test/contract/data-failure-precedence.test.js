import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
  dataMessage,
} from "../support/data-plane-harness.js";
import {
  breadcrumb,
  selectedLocal,
  selectedSession,
} from "../support/fakes.js";

test("Given multi-failure transit frames, when admission runs, then only the first normative failure commits", async (t) => {
  await t.test("Given invalid source and missing destination, when classified, then source failure wins", async () => {
    const { code, writes } = await runTransitCase({
      feasible: false,
      installDestination: false,
      transitEnabled: false,
      hopLimit: 1,
    });
    assert.equal(code, "SOURCE_NOT_AUTHORIZED");
    assert.equal(writes, 0);
  });

  await t.test("Given missing destination plus transit and hop failures, when classified, then route failure wins", async () => {
    const { code, writes } = await runTransitCase({
      installDestination: false,
      transitEnabled: false,
      hopLimit: 1,
    });
    assert.equal(code, "NO_ROUTE");
    assert.equal(writes, 0);
  });

  await t.test("Given local handler saturation and transit failures, when classified, then local capacity wins", async () => {
    const harness = createDataPlaneHarness({
      maximumHandlerBytes: 1,
      transitEnabled: false,
    });
    const ingress = harness.makeController({
      remoteNodeId: "ingress.example",
      controllerId: "ingress-controller",
    });
    const destination = harness.expose("demo/destination");
    harness.installSelected(
      selectedLocal("demo/destination", destination.bindingId),
    );
    const message = dataMessage({ payload: { too: "large" }, hopLimit: 1 });
    harness.authorizeFeasible(ingress, message.body.source);
    await harness.plane.receive(ingress, message);
    harness.flushDispositions();
    assert.equal(lastErrorCode(ingress), "QUEUE_FULL");
  });

  await t.test("Given disabled transit plus hop and egress failures, when classified, then transit capability wins", async () => {
    const { code, writes } = await runTransitCase({
      transitEnabled: false,
      hopLimit: 1,
      sameEgress: true,
    });
    assert.equal(code, "TRANSIT_DISABLED");
    assert.equal(writes, 0);
  });

  await t.test("Given exhausted hop and unusable egress, when classified, then hop failure wins", async () => {
    const { code, writes } = await runTransitCase({
      hopLimit: 1,
      sameEgress: true,
    });
    assert.equal(code, "HOP_LIMIT_EXCEEDED");
    assert.equal(writes, 0);
  });

  await t.test("Given equal ingress-egress plus size and export failures, when classified, then egress failure wins", async () => {
    const { code, writes } = await runTransitCase({
      sameEgress: true,
      payload: { huge: "x".repeat(140_000) },
      ackSource: false,
    });
    assert.equal(code, "NEXT_HOP_UNAVAILABLE");
    assert.equal(writes, 0);
  });

  await t.test("Given an oversized frame and missing source export, when classified, then size failure wins", async () => {
    const { code, writes } = await runTransitCase({
      payload: { huge: "x".repeat(140_000) },
      peerReceiveLimitBytes: 131_072,
      ackSource: false,
    });
    assert.equal(code, "MESSAGE_TOO_LARGE");
    assert.equal(writes, 0);
  });

  await t.test("Given missing source export and breadcrumb saturation, when classified, then export failure wins", async () => {
    const { code, writes } = await runTransitCase({
      ackSource: false,
      fillBreadcrumbCapacity: true,
    });
    assert.equal(code, "SOURCE_NOT_ADVERTISED");
    assert.equal(writes, 0);
  });

  await t.test("Given every prior condition succeeds, when bounded capacity is full, then QUEUE_FULL wins", async () => {
    const { code, writes } = await runTransitCase({
      fillBreadcrumbCapacity: true,
    });
    assert.equal(code, "QUEUE_FULL");
    assert.equal(writes, 0);
  });
});

async function runTransitCase(options = {}) {
  const harness = createDataPlaneHarness({
    transitEnabled: options.transitEnabled ?? true,
    maximumBreadcrumbs: 1,
  });
  const ingress = harness.makeController({
    remoteNodeId: "ingress.example",
    controllerId: "ingress-controller",
  });
  const egress = options.sameEgress === true
    ? ingress
    : harness.makeController({
        remoteNodeId: "egress.example",
        owningSessionId: "000002",
        controllerId: "egress-controller",
        peerReceiveLimitBytes: options.peerReceiveLimitBytes,
      });
  const message = dataMessage({
    hopLimit: options.hopLimit ?? 4,
    payload: options.payload,
  });
  if (options.feasible !== false) {
    harness.authorizeFeasible(ingress, message.body.source);
  }
  if (options.installDestination !== false) {
    harness.installSelected(
      selectedSession(
        message.body.destination,
        egress.remoteNodeId,
        egress.owningSessionId,
      ),
    );
  }
  if (options.ackSource !== false) {
    harness.acknowledgeSource(egress, message.body.source);
  }
  if (options.fillBreadcrumbCapacity === true) {
    const occupiedEgress = harness.makeController({
      remoteNodeId: "occupied.example",
      owningSessionId: "000003",
      controllerId: "occupied-controller",
    });
    harness.breadcrumbs.add(breadcrumb({
      egress: occupiedEgress,
      messageId: "occupied",
    }), 1);
  }

  await harness.plane.receive(ingress, message);
  harness.flushDispositions();
  return {
    code: lastErrorCode(ingress),
    writes: egress.dataWrites.length,
  };
}

function lastErrorCode(controller) {
  assert.equal(controller.controlWrites.length, 1);
  const body = JSON.parse(controller.controlWrites[0]).body;
  assert.equal(body.failed.length, 1);
  return body.failed[0].code;
}
