import assert from "node:assert/strict";
import test from "node:test";

import {
  failLoopbackFabricForTest,
} from "../../dist/fabric.js";
import {
  acquirePair,
  createFixture,
  liveSignal,
} from "../support/topology.js";

const ADAPTER_TERMINAL = Object.freeze({
  origin: "carrier",
  kind: "adapter-fault",
  diagnostic: { code: "ADAPTER_FAULT" },
});

test("given live retained resources when an adapter invariant fails then one truthful frozen terminal snapshot and diagnostic commit", async () => {
  const emissions = [];
  let fabric;
  const cause = new Error("private invariant detail");
  const fixture = createFixture({
    fabricId: "adapter-invariant-failure",
    dependencies: {
      diagnostics: {
        emit(diagnostic, emittedCause) {
          emissions.push({
            diagnostic,
            cause: emittedCause,
            snapshot: fabric.snapshot(),
          });
        },
      },
    },
  });
  fabric = fixture.fabric;
  const pair = await acquirePair(fixture);
  const before = fabric.snapshot();

  failLoopbackFabricForTest(
    fabric,
    "TEST_ADAPTER_INVARIANT",
    cause,
  );

  const failed = fabric.snapshot();
  assert.strictEqual(fabric.snapshot(), failed);
  assert.equal(failed.state, "Failed");
  assert.deepEqual(failed.failure, { code: "ADAPTER_FAULT" });
  assert.equal(
    failed.revision,
    (BigInt(before.revision) + 1n).toString(),
  );
  assert.equal(failed.counters.adapterInvariantFaults, "1");
  assert.deepEqual(failed.resources, {
    pendingAcquisitions: 0,
    activeChannels: 0,
    pendingSendBytes: 0,
    queuedPackets: 0,
    queuedBytes: 0,
  });
  assert.equal(failed.listeners.length, 1);
  assert.equal(failed.listeners[0].state, "Terminal");
  assert.deepEqual(failed.listeners[0].terminal, ADAPTER_TERMINAL);
  assert.equal(failed.channels.length, 1);
  assert.equal(failed.channels[0].state, "Terminal");
  assert.deepEqual(failed.channels[0].leftTerminal, ADAPTER_TERMINAL);
  assert.deepEqual(failed.channels[0].rightTerminal, ADAPTER_TERMINAL);
  assert.equal(failed.channels[0].queuedPacketsLeft, 0);
  assert.equal(failed.channels[0].queuedPacketsRight, 0);
  assert.ok(Object.isFrozen(failed));
  assert.ok(Object.isFrozen(failed.failure));

  assert.equal(emissions.length, 1);
  assert.deepEqual(emissions[0].diagnostic, {
    code: "ADAPTER_FAULT",
    message: "TEST_ADAPTER_INVARIANT",
  });
  assert.strictEqual(emissions[0].cause, cause);
  assert.strictEqual(emissions[0].snapshot, failed);

  assert.deepEqual(
    await pair.listener.waitTerminal(liveSignal()),
    ADAPTER_TERMINAL,
  );
  assert.deepEqual(
    await pair.left.read(liveSignal()),
    { kind: "terminal", terminal: ADAPTER_TERMINAL },
  );
  assert.deepEqual(
    await pair.right.read(liveSignal()),
    { kind: "terminal", terminal: ADAPTER_TERMINAL },
  );
  await fabric.close(liveSignal());
  assert.strictEqual(fabric.snapshot(), failed);
});
