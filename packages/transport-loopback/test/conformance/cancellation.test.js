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

test("given a connect callback is still queued when cancellation commits then the callback is suppressed and no authority escapes", async () => {
  const fixture = createFixture({ fabricId: "cancel-before-accept" });
  let callbackCount = 0;
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 2,
        maxActiveChannels: 2,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept() {
        callbackCount += 1;
      },
      capacityRejected() {
        callbackCount += 1;
      },
    },
    liveSignal(),
  );
  const cancellation = new AbortController();
  const connecting = fixture.connectCapability.connect(
    { channel: CHANNEL_LIMITS },
    cancellation.signal,
  );
  cancellation.abort();

  await assert.rejects(connecting, { code: "OPERATION_ABORTED" });
  await Promise.resolve();
  assert.equal(callbackCount, 0);
  assert.equal(fixture.fabric.snapshot().resources.activeChannels, 0);
  listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given accept callback entry wins when cancellation fires reentrantly then both endpoints commit normally", async () => {
  const fixture = createFixture({ fabricId: "accept-wins-cancel" });
  const cancellation = new AbortController();
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
        accepted = value.channel;
        cancellation.abort();
      },
      capacityRejected() {},
    },
    liveSignal(),
  );
  const connected = await fixture.connectCapability.connect(
    { channel: CHANNEL_LIMITS },
    cancellation.signal,
  );
  await connected.send({ bytes: new Uint8Array([5]) }, liveSignal());
  const result = await accepted.read(liveSignal());
  assert.deepEqual([...result.packet.bytes], [5]);

  await disposePair({ left: connected, right: accepted, listener });
  await closeFabric(fixture.fabric);
});

test("given a cancelled pull read when a packet later arrives then the next read retains that packet", async () => {
  const fixture = createFixture({ fabricId: "read-cancel" });
  const pair = await acquirePair(fixture);
  const cancellation = new AbortController();
  const reading = pair.right.read(cancellation.signal);
  cancellation.abort();
  await assert.rejects(reading, {
    code: "OPERATION_ABORTED",
    phase: "read",
  });

  await pair.left.send({ bytes: new Uint8Array([11]) }, liveSignal());
  const result = await pair.right.read(liveSignal());
  assert.deepEqual([...result.packet.bytes], [11]);

  await disposePair(pair);
  await closeFabric(fixture.fabric);
});

test("given fabric close has initiated when its caller cancels then only that wait rejects and transferred channels stay owner-controlled", async () => {
  const fixture = createFixture({ fabricId: "fabric-close-cancel" });
  const pair = await acquirePair(fixture);
  const cancellation = new AbortController();
  const firstClose = fixture.fabric.close(cancellation.signal);
  cancellation.abort();
  await assert.rejects(firstClose, {
    code: "OPERATION_ABORTED",
    phase: "close",
  });
  assert.equal(fixture.fabric.snapshot().state, "Closing");

  await pair.left.send({ bytes: new Uint8Array([12]) }, liveSignal());
  assert.equal((await pair.right.read(liveSignal())).kind, "packet");
  const joinedClose = fixture.fabric.close(liveSignal());
  pair.left.abort({ kind: "forced-stop", code: "OWNER_STOP" });
  await Promise.all([
    pair.left.read(liveSignal()),
    pair.right.read(liveSignal()),
  ]);
  await joinedClose;
  assert.equal(fixture.fabric.snapshot().state, "Closed");
});

test("given fabric close begins reentrantly inside accept when callback returns then the uncommitted acquisition is rejected and no channel row escapes", async () => {
  const fixture = createFixture({ fabricId: "close-inside-accept" });
  let accepted;
  let closing;
  await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 2,
        maxActiveChannels: 2,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        accepted = value.channel;
        closing = fixture.fabric.close(liveSignal());
      },
      capacityRejected() {},
    },
    liveSignal(),
  );

  await assert.rejects(
    fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
    { code: "CONNECT_FAILED", phase: "connect" },
  );
  assert.equal(
    (await accepted.read(liveSignal())).kind,
    "terminal",
  );
  await closing;
  assert.equal(fixture.fabric.snapshot().channels.length, 0);
  assert.equal(fixture.fabric.snapshot().state, "Closed");
});
