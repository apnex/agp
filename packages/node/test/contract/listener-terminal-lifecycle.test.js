import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";

// Owns: unexpected listener loss reaching node lifecycle. Terminal observation
// is armed before Running, a terminal observed during start cannot leave a
// listening node behind a dead listener, a runtime terminal fails the node
// exactly once, and node-owned stop suppresses re-entry.

function listenerTransport(reference, terminal) {
  const calls = { listen: 0, waitTerminal: 0, close: 0, abort: 0 };
  let resolveTerminal;
  const pending = new Promise((resolve) => { resolveTerminal = resolve; });
  const port = Object.freeze({
    resolveListener: (value) =>
      value === reference
        ? Object.freeze({
            listen: async () => {
              calls.listen += 1;
              return Object.freeze({
                publication: { displayAddress: `probe://${reference}` },
                waitTerminal: () => {
                  calls.waitTerminal += 1;
                  return terminal === "immediate"
                    ? Promise.resolve({ origin: "carrier", kind: "io-failure" })
                    : pending;
                },
                close: async () => {
                  calls.close += 1;
                  return { origin: "local", kind: "graceful" };
                },
                abort: () => { calls.abort += 1; },
              });
            },
          })
        : undefined,
    resolveTarget: () => undefined,
  });
  return { port, calls, fail: () => resolveTerminal({ origin: "carrier", kind: "io-failure" }) };
}

async function settle(ms = 60) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

test("given a node with a listener, when start completes, then terminal observation was armed before Running was published", async () => {
  const harness = listenerTransport("armed.listener", "pending");
  const node = createNode({
    nodeId: "armed.listener",
    listen: { transportRef: "armed.listener" },
  }, { transport: harness.port });

  await node.start();
  // Arming happens inside start, ahead of the Running commit, so a terminal can
  // never be missed in the window between listening and Running.
  assert.equal(harness.calls.listen, 1);
  assert.equal(harness.calls.waitTerminal, 1);
  assert.equal(node.operations.snapshot().lifecycle.state, "Running");
  await node.stop();
});

test("given a listener that terminalizes while start is still in flight, when the node settles, then it never reports Running behind a dead listener", async () => {
  const harness = listenerTransport("racing.listener", "immediate");
  const node = createNode({
    nodeId: "racing.listener",
    listen: { transportRef: "racing.listener" },
  }, { transport: harness.port });

  // Either ordering is legal: the observation may land before the Running
  // commit and reject start, or after it and fail the running node. Neither may
  // leave a listening node whose listener is gone.
  await node.start().catch(() => undefined);
  await settle();

  const snapshot = node.operations.snapshot();
  assert.equal(snapshot.lifecycle.state, "Failed");
  assert.equal(snapshot.listener.state, "terminal");
  assert.notEqual(snapshot.lifecycle.failure, undefined);
});

test("given a Running node, when its listener terminalizes unexpectedly, then the node fails exactly once with the listener terminal recorded", async () => {
  const harness = listenerTransport("runtime.listener", "pending");
  const diagnostics = [];
  const node = createNode({
    nodeId: "runtime.listener",
    listen: { transportRef: "runtime.listener" },
  }, {
    transport: harness.port,
    diagnostics: { emit: (record) => diagnostics.push(record) },
  });

  await node.start();
  assert.equal(node.operations.snapshot().lifecycle.state, "Running");

  harness.fail();
  await settle();

  const snapshot = node.operations.snapshot();
  assert.equal(snapshot.lifecycle.state, "Failed");
  assert.equal(snapshot.lifecycle.failure.code, "LISTENER_TERMINAL");
  assert.deepEqual(snapshot.lifecycle.failure.terminal, {
    origin: "carrier",
    kind: "io-failure",
  });
  assert.equal(snapshot.listener.state, "terminal");
  assert.equal(snapshot.counters.values["lifecycle.failed"], "1");
  assert.equal(snapshot.counters.values["transport.listener_terminal"], "1");
  assert.equal(
    diagnostics.filter(({ code }) => code === "LISTENER_TERMINAL").length,
    1,
    "the node fails once, so it diagnoses once",
  );
});

test("given a node stopping under its own authority, when its listener closes, then the terminal is not re-entered as a failure", async () => {
  const harness = listenerTransport("stopping.listener", "pending");
  const diagnostics = [];
  const node = createNode({
    nodeId: "stopping.listener",
    listen: { transportRef: "stopping.listener" },
  }, {
    transport: harness.port,
    diagnostics: { emit: (record) => diagnostics.push(record) },
  });

  await node.start();
  await node.stop();
  await settle();

  const snapshot = node.operations.snapshot();
  assert.equal(snapshot.lifecycle.state, "Stopped");
  assert.equal(harness.calls.close, 1, "node-owned stop closes its own listener");
  assert.equal(
    diagnostics.some(({ code }) => code === "LISTENER_TERMINAL"),
    false,
    "an expected close is not a listener failure",
  );
  assert.equal(snapshot.counters.values["lifecycle.failed"], undefined);
});
