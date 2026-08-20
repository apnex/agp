import assert from "node:assert/strict";
import test from "node:test";

import {
  createLoopbackFabric,
} from "../../dist/index.js";
import {
  CHANNEL_LIMITS,
  FABRIC_LIMITS,
  acquirePair,
  closeFabric,
  createFixture,
  disposePair,
  liveSignal,
} from "../support/topology.js";

test("given equal textual fabric identities when one target connects then it cannot reach the other fabric listener", async () => {
  const first = createFixture({ fabricId: "shared-name" });
  const second = createFixture({ fabricId: "shared-name" });
  const pair = await acquirePair(first);

  await assert.rejects(
    second.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
    { code: "BINDING_UNAVAILABLE", phase: "connect" },
  );

  await disposePair(pair);
  await closeFabric(first.fabric);
  await closeFabric(second.fabric);
});

test("given a reserved transport name when a duplicate is created then the incumbent remains usable", async () => {
  const fabric = createLoopbackFabric({
    fabricId: "unique-names",
    limits: FABRIC_LIMITS,
  });
  const incumbent = fabric.createTransport({
    transportName: "alpha",
    capabilities: { listen: true, connect: false },
  });

  assert.throws(
    () =>
      fabric.createTransport({
        transportName: "alpha",
        capabilities: { listen: false, connect: true },
      }),
    { name: "LoopbackConfigurationError" },
  );
  assert.equal(incumbent.transportName, "alpha");
  await closeFabric(fabric);
});

test("given a scoped resolver when references are resolved then capabilities are stable opaque values and malformed input fails closed", async () => {
  const fixture = createFixture({ fabricId: "resolver-scope" });

  assert.strictEqual(
    fixture.listenCapability,
    fixture.listenCapability,
  );
  assert.strictEqual(
    fixture.connectCapability,
    fixture.connectCapability,
  );
  assert.equal(
    fixture.listenerPort.resolveTarget("service.listen"),
    undefined,
  );
  assert.equal(
    fixture.connectorPort.resolveTarget("unmapped.valid"),
    undefined,
  );
  assert.throws(
    () => fixture.connectorPort.resolveTarget("bad ref!"),
    { code: "REFERENCE_INVALID", phase: "resolve-target" },
  );
  assert.throws(
    () => {
      const builder = fixture.fabric.createTransport({
        transportName: "gamma",
        capabilities: { listen: true, connect: false },
      });
      builder.createPort({
        listeners: new Map([
          ["bad ref!", {
            fabricId: "resolver-scope",
            address: "bad",
          }],
        ]),
        targets: new Map(),
      });
    },
    { name: "LoopbackConfigurationError" },
  );
  assert.throws(
    () => {
      const longAddress = Array(4).fill("a".repeat(60)).join("/");
      const builder = fixture.fabric.createTransport({
        transportName: "delta",
        capabilities: { listen: true, connect: false },
      });
      builder.createPort({
        listeners: new Map([
          ["long.listener", {
            fabricId: "resolver-scope",
            address: longAddress,
          }],
        ]),
        targets: new Map(),
      });
    },
    { name: "LoopbackConfigurationError" },
  );
  await closeFabric(fixture.fabric);
});

test("given a registered listener address when duplicate registration is attempted then the incumbent remains the sole accepting owner", async () => {
  const fixture = createFixture({ fabricId: "listener-uniqueness" });
  let accepted;
  const options = {
    limits: {
      maxPendingAcquisitions: 2,
      maxActiveChannels: 2,
      channel: CHANNEL_LIMITS,
    },
  };
  const incumbent = await fixture.listenCapability.listen(
    options,
    {
      accept(value) {
        accepted = value.channel;
      },
      capacityRejected() {},
    },
    liveSignal(),
  );
  await assert.rejects(
    fixture.listenCapability.listen(
      options,
      { accept() {}, capacityRejected() {} },
      liveSignal(),
    ),
    { code: "BINDING_UNAVAILABLE", phase: "listen" },
  );
  const connected = await fixture.connectCapability.connect(
    { channel: CHANNEL_LIMITS },
    liveSignal(),
  );
  await connected.send({ bytes: new Uint8Array([1]) }, liveSignal());
  assert.equal((await accepted.read(liveSignal())).kind, "packet");

  connected.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await Promise.all([
    connected.read(liveSignal()),
    accepted.read(liveSignal()),
  ]);
  incumbent.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given schema-incomplete or schema-expanded configuration when construction or acquisition validates it then every shape fails before authority or pressure", async () => {
  assert.throws(
    () =>
      createLoopbackFabric({
        fabricId: "invalid-fabric",
        limits: {
          ...FABRIC_LIMITS,
          unexpected: 1,
        },
      }),
    { name: "LoopbackConfigurationError" },
  );
  const { maxListeners: _omitted, ...missingLimit } = FABRIC_LIMITS;
  assert.throws(
    () =>
      createLoopbackFabric({
        fabricId: "missing-limit",
        limits: missingLimit,
      }),
    { name: "LoopbackConfigurationError" },
  );

  const fixture = createFixture({ fabricId: "invalid-acquisition" });
  await assert.rejects(
    fixture.connectCapability.connect(
      {
        channel: {
          maxPacketBytes: 16,
          maxBufferedBytes: 24,
        },
      },
      liveSignal(),
    ),
    { code: "CONNECT_FAILED", phase: "connect" },
  );
  await assert.rejects(
    fixture.listenCapability.listen(
      {
        limits: {
          maxPendingAcquisitions: 1,
          maxActiveChannels: 1,
          channel: CHANNEL_LIMITS,
          unexpected: true,
        },
      },
      { accept() {}, capacityRejected() {} },
      liveSignal(),
    ),
    { code: "LISTEN_FAILED", phase: "listen" },
  );
  assert.deepEqual(fixture.fabric.snapshot().resources, {
    pendingAcquisitions: 0,
    activeChannels: 0,
    pendingSendBytes: 0,
    queuedPackets: 0,
    queuedBytes: 0,
  });
  await closeFabric(fixture.fabric);
});
