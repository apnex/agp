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

const LISTEN_OPTIONS = Object.freeze({
  limits: {
    maxPendingAcquisitions: 2,
    maxActiveChannels: 2,
    channel: CHANNEL_LIMITS,
  },
});

test("given a live listener when one terminal wait is cancelled then listener ownership and later observation remain intact", async () => {
  const fixture = createFixture({ fabricId: "listener-wait" });
  const pair = await acquirePair(fixture);
  const cancellation = new AbortController();
  const waiting = pair.listener.waitTerminal(cancellation.signal);
  cancellation.abort();
  await assert.rejects(waiting, {
    code: "OPERATION_ABORTED",
    phase: "wait-terminal",
  });

  await pair.left.send({ bytes: new Uint8Array([8]) }, liveSignal());
  assert.equal((await pair.right.read(liveSignal())).kind, "packet");
  pair.listener.abort({ kind: "forced-stop", code: "WAIT_TEST_DONE" });
  const terminal = await pair.listener.waitTerminal(liveSignal());
  assert.equal(terminal.diagnostic.code, "WAIT_TEST_DONE");

  await disposePair(pair);
  await closeFabric(fixture.fabric);
});

test("given a transferred channel when its listener closes then the address and sole listener slot are reusable before close resolves", async () => {
  const fixture = createFixture({
    fabricId: "listener-reuse",
    fabricLimits: { maxListeners: 1 },
  });
  const pair = await acquirePair(fixture);
  const publication = pair.listener.publication;
  const originalListenerId =
    fixture.fabric.snapshot().listeners[0].listenerId;
  const terminal = await pair.listener.close(liveSignal());
  assert.deepEqual(terminal, { origin: "local", kind: "graceful" });
  assert.strictEqual(pair.listener.publication, publication);

  await pair.left.send({ bytes: new Uint8Array([4]) }, liveSignal());
  assert.equal((await pair.right.read(liveSignal())).kind, "packet");
  await assert.rejects(
    fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
    { code: "BINDING_UNAVAILABLE" },
  );
  const replacement = await fixture.listenCapability.listen(
    LISTEN_OPTIONS,
    { accept() {}, capacityRejected() {} },
    liveSignal(),
  );
  const replacementRow = fixture.fabric
    .snapshot()
    .listeners.find((row) => row.state === "Listening");
  assert.ok(replacementRow);
  assert.notEqual(
    replacementRow.listenerId,
    originalListenerId,
  );

  replacement.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await disposePair(pair);
  await closeFabric(fixture.fabric);
});
