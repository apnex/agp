import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANNEL_LIMITS,
  closeFabric,
  createFixture,
  drainToTerminal,
  liveSignal,
} from "../support/topology.js";

test("given a live listener when connect is invoked then accept enters asynchronously before connect settles", async () => {
  const fixture = createFixture({ fabricId: "async-accept" });
  let initiatingStack = true;
  let accepted;
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 2,
        maxActiveChannels: 2,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        assert.equal(initiatingStack, false);
        accepted = value.channel;
      },
      capacityRejected() {
        assert.fail("capacity was not exhausted");
      },
    },
    liveSignal(),
  );
  const connecting = fixture.connectCapability.connect(
    { channel: CHANNEL_LIMITS },
    liveSignal(),
  );
  initiatingStack = false;
  const connected = await connecting;
  assert.ok(accepted);

  connected.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await Promise.all([
    drainToTerminal(connected),
    drainToTerminal(accepted),
  ]);
  listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given one pending acquisition slot when two connects race then pending capacity is reported once after release", async () => {
  const fixture = createFixture({ fabricId: "pending-capacity" });
  const accepted = [];
  const rejected = [];
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 1,
        maxActiveChannels: 2,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        accepted.push(value.channel);
      },
      capacityRejected(kind) {
        rejected.push({
          kind,
          pending:
            fixture.fabric.snapshot().resources.pendingAcquisitions,
        });
      },
    },
    liveSignal(),
  );

  const firstPromise = fixture.connectCapability.connect(
    { channel: CHANNEL_LIMITS },
    liveSignal(),
  );
  const secondPromise = fixture.connectCapability.connect(
    { channel: CHANNEL_LIMITS },
    liveSignal(),
  );
  const first = await firstPromise;
  await assert.rejects(secondPromise, { code: "CAPACITY_EXCEEDED" });
  assert.deepEqual(rejected, [
    { kind: "pending-acquisition", pending: 0 },
  ]);

  first.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await Promise.all([
    drainToTerminal(first),
    drainToTerminal(accepted[0]),
  ]);
  listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given one active channel slot when another connect begins then active capacity is reported without replacing the channel", async () => {
  const fixture = createFixture({ fabricId: "active-capacity" });
  const accepted = [];
  const rejected = [];
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 2,
        maxActiveChannels: 1,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        accepted.push(value.channel);
      },
      capacityRejected(kind) {
        rejected.push(kind);
      },
    },
    liveSignal(),
  );
  const first = await fixture.connectCapability.connect(
    { channel: CHANNEL_LIMITS },
    liveSignal(),
  );
  await assert.rejects(
    fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
    { code: "CAPACITY_EXCEEDED" },
  );
  assert.deepEqual(rejected, ["active-channel"]);

  await first.send({ bytes: new Uint8Array([9]) }, liveSignal());
  assert.equal((await accepted[0].read(liveSignal())).kind, "packet");
  first.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await Promise.all([
    drainToTerminal(first),
    drainToTerminal(accepted[0]),
  ]);
  listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given concurrent successful connects when both commit then each retains a distinct channel row and identity", async () => {
  const fixture = createFixture({ fabricId: "concurrent-identities" });
  const accepted = [];
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 3,
        maxActiveChannels: 3,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        accepted.push(value.channel);
      },
      capacityRejected() {},
    },
    liveSignal(),
  );
  const connected = await Promise.all([
    fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
    fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
  ]);
  const rows = fixture.fabric.snapshot().channels;
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.channelId)).size, 2);
  assert.equal(fixture.fabric.snapshot().resources.activeChannels, 2);

  for (const channel of connected) {
    channel.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  }
  await Promise.all([
    ...connected.map(drainToTerminal),
    ...accepted.map(drainToTerminal),
  ]);
  listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given a synchronous connect burst beyond the fabric ceiling when dispositions are queued then retained callback authority stays bounded", async () => {
  const fixture = createFixture({
    fabricId: "bounded-dispositions",
    fabricLimits: { maxPendingAcquisitions: 2 },
  });
  const accepted = [];
  let capacityCallbacks = 0;
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 1,
        maxActiveChannels: 2,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        accepted.push(value.channel);
      },
      capacityRejected() {
        capacityCallbacks += 1;
      },
    },
    liveSignal(),
  );
  const attempts = Array.from(
    { length: 20 },
    () =>
      fixture.connectCapability.connect(
        { channel: CHANNEL_LIMITS },
        liveSignal(),
      ),
  );
  const results = await Promise.allSettled(attempts);
  const connected = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  assert.equal(connected.length, 1);
  assert.equal(capacityCallbacks, 1);
  assert.equal(
    fixture.fabric.snapshot().counters.connectionsRejected,
    "19",
  );
  assert.equal(
    fixture.fabric.snapshot().resources.pendingAcquisitions,
    0,
  );

  connected[0].abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await Promise.all([
    drainToTerminal(connected[0]),
    drainToTerminal(accepted[0]),
  ]);
  listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});
