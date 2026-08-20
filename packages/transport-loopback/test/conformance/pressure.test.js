import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANNEL_LIMITS,
  acquirePair,
  closeFabric,
  createFixture,
  disposePair,
  liveSignal,
} from "../support/topology.js";

async function readByte(channel) {
  const result = await channel.read(liveSignal());
  assert.equal(result.kind, "packet");
  return result.packet.bytes[0];
}

test("given a full receiver queue when another send begins then it waits within bounded pressure and resumes after one read", async () => {
  const fixture = createFixture({ fabricId: "pressure-resume" });
  const pair = await acquirePair(fixture);
  await pair.left.send({ bytes: new Uint8Array([1]) }, liveSignal());
  await pair.left.send({ bytes: new Uint8Array([2]) }, liveSignal());

  let settled = false;
  const third = pair.left
    .send({ bytes: new Uint8Array([3]) }, liveSignal())
    .then(() => {
      settled = true;
    });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.deepEqual(fixture.fabric.snapshot().resources, {
    pendingAcquisitions: 0,
    activeChannels: 1,
    pendingSendBytes: 1,
    queuedPackets: 2,
    queuedBytes: 2,
  });

  assert.equal(await readByte(pair.right), 1);
  await third;
  assert.deepEqual(
    [await readByte(pair.right), await readByte(pair.right)],
    [2, 3],
  );
  assert.equal(
    fixture.fabric.snapshot().counters.backpressureActivations,
    "1",
  );

  await disposePair(pair);
  await closeFabric(fixture.fabric);
});

test("given a pressure-blocked send when its signal is cancelled then no packet is admitted and all reservations release", async () => {
  const fixture = createFixture({ fabricId: "pressure-cancel" });
  const pair = await acquirePair(fixture);
  await pair.left.send({ bytes: new Uint8Array([1]) }, liveSignal());
  await pair.left.send({ bytes: new Uint8Array([2]) }, liveSignal());
  const cancellation = new AbortController();

  const blocked = pair.left.send(
    { bytes: new Uint8Array([3]) },
    cancellation.signal,
  );
  cancellation.abort();
  await assert.rejects(blocked, {
    code: "OPERATION_ABORTED",
    phase: "send",
    acceptance: "not-accepted",
  });
  assert.equal(fixture.fabric.snapshot().resources.pendingSendBytes, 0);
  assert.deepEqual(
    [await readByte(pair.right), await readByte(pair.right)],
    [1, 2],
  );

  await disposePair(pair);
  await closeFabric(fixture.fabric);
});

test("given an earlier large send and a later small send on different channels when only the later packet fits then sequence order still prevents overtaking", async () => {
  const fixture = createFixture({ fabricId: "pressure-sequence" });
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
  await connected[0].send({ bytes: new Uint8Array(16) }, liveSignal());
  const completionOrder = [];
  const earlier = connected[0]
    .send({ bytes: new Uint8Array(9) }, liveSignal())
    .then(() => completionOrder.push("earlier"));
  const later = connected[1]
    .send({ bytes: new Uint8Array([1]) }, liveSignal())
    .then(() => completionOrder.push("later"));
  await Promise.resolve();
  assert.deepEqual(completionOrder, []);

  assert.equal((await accepted[0].read(liveSignal())).kind, "packet");
  await Promise.all([earlier, later]);
  assert.deepEqual(completionOrder, ["earlier", "later"]);
  assert.equal((await accepted[0].read(liveSignal())).kind, "packet");
  assert.equal((await accepted[1].read(liveSignal())).kind, "packet");

  for (const channel of connected) {
    channel.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  }
  await Promise.all([
    ...connected.map((channel) => channel.read(liveSignal())),
    ...accepted.map((channel) => channel.read(liveSignal())),
  ]);
  listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});
