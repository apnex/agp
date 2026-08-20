import assert from "node:assert/strict";
import test from "node:test";

import { runTerminalOnceCase } from "@agp/transport/conformance";

import {
  acquirePair,
  closeFabric,
  createFixture,
  drainToTerminal,
  liveSignal,
} from "../support/topology.js";

test("given repeated abort calls when neutral terminal-once runs then every later read returns the stable first terminal", async () => {
  const fixture = createFixture({ fabricId: "terminal-once" });
  const pair = await acquirePair(fixture);
  const result = await runTerminalOnceCase(pair.left, {
    kind: "forced-stop",
    code: "FIRST_ABORT",
  });

  assert.deepEqual(result.terminal, {
    origin: "local",
    kind: "aborted",
    diagnostic: { code: "FIRST_ABORT" },
  });
  const remote = await drainToTerminal(pair.right);
  assert.equal(remote.origin, "remote");
  pair.listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given an initiated graceful close when its signal is cancelled before terminal commit then aborted wins for every joined close", async () => {
  const fixture = createFixture({ fabricId: "close-cancel" });
  const pair = await acquirePair(fixture);
  const cancellation = new AbortController();
  const first = pair.left.close(
    { kind: "normal", code: "NORMAL_CLOSE" },
    cancellation.signal,
  );
  const second = pair.left.close(
    { kind: "node-stop", code: "JOINED_CLOSE" },
    liveSignal(),
  );
  cancellation.abort();

  const [firstTerminal, secondTerminal] = await Promise.all([
    first,
    second,
  ]);
  assert.strictEqual(firstTerminal, secondTerminal);
  assert.deepEqual(firstTerminal, {
    origin: "local",
    kind: "aborted",
    diagnostic: { code: "CLOSE_CANCELLED" },
  });
  await drainToTerminal(pair.left);
  await drainToTerminal(pair.right);
  pair.listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given a fabric close with a transferred channel when listeners finish then close still waits for the channel owner", async () => {
  const fixture = createFixture({ fabricId: "fabric-close-wait" });
  const pair = await acquirePair(fixture);
  let closed = false;
  const closing = fixture.fabric.close(liveSignal()).then(() => {
    closed = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, false);
  assert.equal(fixture.fabric.snapshot().state, "Closing");

  pair.left.abort({ kind: "forced-stop", code: "OWNER_STOP" });
  await Promise.all([
    drainToTerminal(pair.left),
    drainToTerminal(pair.right),
  ]);
  await closing;
  assert.equal(fixture.fabric.snapshot().state, "Closed");
});
