import assert from "node:assert/strict";
import test from "node:test";

import {
  UNSIGNED_64_MAX,
} from "../../dist/domain.js";
import {
  createLoopbackFabricWithMonotonicSeedForTest,
  failLoopbackFabricForTest,
} from "../../dist/fabric.js";
import {
  CHANNEL_LIMITS,
  FABRIC_LIMITS,
  liveSignal,
} from "../support/topology.js";

function seededFixture(seed, suffix) {
  const fabricId = `monotonic-${suffix}`;
  const fabric = createLoopbackFabricWithMonotonicSeedForTest(
    { fabricId, limits: FABRIC_LIMITS },
    {},
    seed,
  );
  const listenerPort = fabric.createTransport({
    transportName: "alpha",
    capabilities: { listen: true, connect: false },
  }).createPort({
    listeners: new Map([
      ["listen", { fabricId, address: "service" }],
    ]),
    targets: new Map(),
  });
  const connectorPort = fabric.createTransport({
    transportName: "beta",
    capabilities: { listen: false, connect: true },
  }).createPort({
    listeners: new Map(),
    targets: new Map([
      ["connect", { fabricId, address: "service" }],
    ]),
  });
  return {
    fabric,
    listen: listenerPort.resolveListener("listen"),
    connect: connectorPort.resolveTarget("connect"),
  };
}

async function acquire(fixture) {
  let right;
  const listener = await fixture.listen.listen(
    {
      limits: {
        maxPendingAcquisitions: 2,
        maxActiveChannels: 2,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        right = value.channel;
      },
      capacityRejected() {},
    },
    liveSignal(),
  );
  const left = await fixture.connect.connect(
    { channel: CHANNEL_LIMITS },
    liveSignal(),
  );
  return { listener, left, right };
}

function assertFrozenFailure(fabric, expected) {
  const first = fabric.snapshot();
  const second = fabric.snapshot();
  assert.strictEqual(first, second);
  assert.equal(first.state, "Failed");
  assert.deepEqual(first.failure, expected);
  assert.deepEqual(first.resources, {
    pendingAcquisitions: 0,
    activeChannels: 0,
    pendingSendBytes: 0,
    queuedPackets: 0,
    queuedBytes: 0,
  });
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.channels));
  return first;
}

test("given the reserved ordinary revision boundary when a listener mutation is attempted then one exact terminal failure revision commits", async () => {
  const fixture = seededFixture(
    { revision: UNSIGNED_64_MAX - 1n },
    "revision",
  );
  await assert.rejects(
    fixture.listen.listen(
      {
        limits: {
          maxPendingAcquisitions: 1,
          maxActiveChannels: 1,
          channel: CHANNEL_LIMITS,
        },
      },
      { accept() {}, capacityRejected() {} },
      liveSignal(),
    ),
    { code: "ADAPTER_FAULT", phase: "listen" },
  );
  const failed = assertFrozenFailure(fixture.fabric, {
    code: "MONOTONIC_DOMAIN_EXHAUSTED",
    domain: "revision",
  });
  assert.equal(failed.revision, UNSIGNED_64_MAX.toString());
  await fixture.fabric.close(liveSignal());
});

test("given a counter at its unsigned limit when one packet would increment it then the send is not accepted and terminal rows freeze at zero occupancy", async () => {
  const fixture = seededFixture(
    {
      counters: {
        packetsAcceptedLeftToRight: UNSIGNED_64_MAX,
      },
    },
    "counter",
  );
  const pair = await acquire(fixture);
  await assert.rejects(
    pair.left.send({ bytes: new Uint8Array([1]) }, liveSignal()),
    {
      code: "ADAPTER_FAULT",
      phase: "send",
      acceptance: "not-accepted",
    },
  );
  const failed = assertFrozenFailure(fixture.fabric, {
    code: "MONOTONIC_DOMAIN_EXHAUSTED",
    domain: "counter",
    counterKey: "packetsAcceptedLeftToRight",
  });
  assert.equal(
    failed.counters.packetsAcceptedLeftToRight,
    UNSIGNED_64_MAX.toString(),
  );
  assert.equal(failed.channels.length, 1);
  assert.equal(failed.channels[0].state, "Terminal");
  assert.equal(failed.channels[0].queuedPacketsLeft, 0);
  assert.equal(failed.channels[0].queuedPacketsRight, 0);
  assert.equal(failed.listeners[0].state, "Terminal");
  await fixture.fabric.close(liveSignal());
});

test("given an exhausted arbitration sequence when pressure needs a FIFO ticket then the fabric fails without admitting the blocked packet", async () => {
  const fixture = seededFixture(
    { arbitrationSequence: UNSIGNED_64_MAX },
    "arbitration",
  );
  const pair = await acquire(fixture);
  await pair.left.send({ bytes: new Uint8Array([1]) }, liveSignal());
  await pair.left.send({ bytes: new Uint8Array([2]) }, liveSignal());
  await assert.rejects(
    pair.left.send({ bytes: new Uint8Array([3]) }, liveSignal()),
    {
      code: "ADAPTER_FAULT",
      phase: "send",
      acceptance: "not-accepted",
    },
  );
  const failed = assertFrozenFailure(fixture.fabric, {
    code: "MONOTONIC_DOMAIN_EXHAUSTED",
    domain: "arbitration-sequence",
  });
  assert.equal(failed.resources.queuedPackets, 0);
  assert.equal(failed.resources.pendingSendBytes, 0);
  await fixture.fabric.close(liveSignal());
});

test("given an exhausted adapter-invariant counter when an invariant fault occurs then monotonic exhaustion truthfully owns the terminal class", async () => {
  const fixture = seededFixture(
    {
      counters: {
        adapterInvariantFaults: UNSIGNED_64_MAX,
      },
    },
    "invariant-counter",
  );

  failLoopbackFabricForTest(
    fixture.fabric,
    "UNCOUNTABLE_ADAPTER_INVARIANT",
  );

  const failed = assertFrozenFailure(fixture.fabric, {
    code: "MONOTONIC_DOMAIN_EXHAUSTED",
    domain: "counter",
    counterKey: "adapterInvariantFaults",
  });
  assert.equal(
    failed.counters.adapterInvariantFaults,
    UNSIGNED_64_MAX.toString(),
  );
  await fixture.fabric.close(liveSignal());
});
