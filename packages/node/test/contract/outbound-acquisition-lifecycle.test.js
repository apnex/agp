import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock } from "@agp/core";
import { TransportOperationError } from "@agp/transport";
import { createNode } from "../../dist/index.js";
import {
  ControlledChannel,
  ControlledListenerTransport,
  eventually,
} from "../support/controlled-transport.js";

// Native acquisition commit and node adoption are deliberately separate. Each
// request honours signal cancellation before commit; committed channels belong
// to the caller even when cancellation arrives before its promise continuation.
function controlledDialTransport({ deferredCleanup = false, listener } = {}) {
  const requests = [];
  const port = {
    resolveListener: (reference) => listener?.port().resolveListener(reference),
    resolveTarget: () => ({
      connect(_options, signal) {
        const result = Promise.withResolvers();
        let committed = false;
        const cleanup = () => signal.removeEventListener("abort", aborted);
        const request = {
          signal,
          succeed(channel = new ControlledChannel()) {
            assert.equal(signal.aborted, false, "native commit must precede cancellation");
            committed = true;
            cleanup();
            result.resolve(channel);
            return channel;
          },
          fail() {
            cleanup();
            result.reject(new TransportOperationError({
              phase: "connect", code: "CONNECT_FAILED", message: "Controlled acquisition failed",
            }));
          },
          finishCleanup() {
            cleanup();
            result.reject(new TransportOperationError({
              phase: "connect", code: "OPERATION_ABORTED", message: "Controlled acquisition cancelled",
            }));
          },
        };
        function aborted() {
          if (!committed && !deferredCleanup) request.finishCleanup();
        }
        signal.addEventListener("abort", aborted, { once: true });
        requests.push(request);
        if (signal.aborted) aborted();
        return result.promise;
      },
    }),
  };
  return { port, requests };
}

async function dialer(t, {
  clock = new ManualClock(), timeoutMs = 20, reconnect = true,
  deferredCleanup = false, listener,
} = {}) {
  const transport = controlledDialTransport({ deferredCleanup, listener });
  const diagnostics = [];
  const node = createNode({
    nodeId: "acquisition.local",
    ...(listener ? { listen: { transportRef: "acquisition.listener" } } : {}),
    peers: [{
      adjacencyId: "remote", expectedNodeId: "acquisition.remote", transportRef: "remote",
      reconnect: { enabled: reconnect, initialDelayMs: 5, maximumDelayMs: 20, multiplier: 2 },
    }],
    timers: { transportConnectTimeoutMs: timeoutMs, openTimeoutMs: 1_000 },
  }, { clock, transport: transport.port, diagnostics: { emit: (record) => diagnostics.push(record) } });
  t.after(async () => {
    await node.stop({ drainTimeoutMs: 0 });
    for (const request of transport.requests) request.finishCleanup();
    await turnBarrier(node);
  });
  await node.start();
  assert.equal(transport.requests.length, 1);
  return { node, clock, requests: transport.requests, diagnostics };
}

async function turnBarrier(node) {
  await new Promise((resolve) => setImmediate(resolve));
  await node.executor.quiesce();
}

test("Given an outstanding acquisition, when its deadline expires, then the signal aborts and exactly one policy retry follows settlement",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests, diagnostics } = await dialer(t);
    clock.advanceBy(19);
    assert.equal(requests[0].signal.aborted, false);
    clock.advanceBy(1);
    assert.equal(requests[0].signal.aborted, true);
    await turnBarrier(node);
    assert.deepEqual(diagnostics.map(({ code }) => code), ["CONNECT_TIMEOUT"]);
    assert.equal(node.operations.adjacencies().items[0].retryAttempt, 1);
    assert.equal(node.operations.adjacencies().items[0].state, "retry-wait");
    assert.equal(clock.pendingTasks(), 1);
    clock.advanceBy(5);
    await turnBarrier(node);
    assert.equal(requests.length, 2);
    assert.notEqual(requests[0].signal, requests[1].signal);
    assert.equal(requests[1].signal.aborted, false);
    assert.equal(clock.pendingTasks(), 1);
    assert.equal(node.operations.connections().items.length, 0);
  });

test("Given cancellation awaiting native cleanup, when retry time passes, then no replacement acquisition allocates until cleanup settles",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests, diagnostics } = await dialer(t, { deferredCleanup: true });
    clock.advanceBy(100);
    await turnBarrier(node);
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(requests.length, 1);
    assert.equal(clock.pendingTasks(), 0);
    requests[0].finishCleanup();
    await turnBarrier(node);
    assert.deepEqual(diagnostics.map(({ code }) => code), ["CONNECT_TIMEOUT"]);
    assert.equal(clock.pendingTasks(), 1);
    clock.advanceBy(5);
    await turnBarrier(node);
    assert.equal(requests.length, 2);
  });

test("Given an acquisition cancelled by stop, when native cleanup finishes later, then it changes neither terminal state nor retry ownership",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests, diagnostics } = await dialer(t, { deferredCleanup: true });
    await node.stop();
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(clock.pendingTasks(), 0);
    const stopped = node.operations.snapshot();
    requests[0].finishCleanup();
    await turnBarrier(node);
    clock.advanceBy(10_000);
    await turnBarrier(node);
    assert.equal(requests.length, 1);
    assert.equal(node.operations.snapshot().revision, stopped.revision);
    assert.equal(node.operations.snapshot().lifecycle.state, "Stopped");
    assert.equal(node.operations.connections().items.length, 0);
    assert.deepEqual(diagnostics, []);
  });

test("Given native commit before a stop racing node adoption, when the completion is consumed, then the exact channel aborts without a session or OPEN",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests, diagnostics } = await dialer(t);
    const channel = requests[0].succeed();
    await node.stop();
    await turnBarrier(node);
    assert.equal(channel.abortCalls, 1);
    assert.equal(channel.sendCalls, 0);
    assert.equal(channel.readCalls, 0);
    assert.equal(node.operations.connections().items.length, 0);
    assert.equal(clock.pendingTasks(), 0);
    assert.deepEqual(diagnostics, []);
  });

test("Given a committed channel awaiting node adoption, when the acquisition deadline wins, then no OPEN is written and one retry follows",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests, diagnostics } = await dialer(t);
    const blocker = Promise.withResolvers();
    t.after(() => blocker.resolve());
    const blocked = node.executor.run(() => blocker.promise);
    const channel = requests[0].succeed();
    clock.advanceBy(20);
    blocker.resolve();
    await blocked;
    await turnBarrier(node);
    assert.equal(channel.abortCalls, 1);
    assert.equal(channel.sendCalls, 0);
    assert.equal(node.operations.connections().items.length, 0);
    assert.deepEqual(diagnostics.map(({ code }) => code), ["CONNECT_TIMEOUT"]);
    assert.equal(clock.pendingTasks(), 1);
    clock.advanceBy(5);
    await turnBarrier(node);
    assert.equal(requests.length, 2);
  });

test("Given delayed deadline callbacks, when adoption observes elapsed acquisition time, then it rejects the expired channel before OPEN",
  { timeout: 5_000 }, async (t) => {
    class DelayedClock extends ManualClock {
      schedule(delayMs, callback) { return super.schedule(delayMs + 100, callback); }
    }
    const { node, clock, requests, diagnostics } = await dialer(t, { clock: new DelayedClock() });
    clock.advanceBy(20);
    assert.equal(requests[0].signal.aborted, false);
    const channel = requests[0].succeed();
    await turnBarrier(node);
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(channel.abortCalls, 1);
    assert.equal(channel.sendCalls, 0);
    assert.deepEqual(diagnostics.map(({ code }) => code), ["CONNECT_TIMEOUT"]);
  });

test("Given timely adoption, when the old acquisition deadline and stop pass, then acquisition cancellation cannot revoke the session-owned channel",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests, diagnostics } = await dialer(t);
    const channel = requests[0].succeed();
    await eventually(() => channel.sendCalls === 1 && channel.readCalls === 1, "adopted controller");
    assert.equal(clock.pendingTasks(), 1, "only the OPEN timer remains");
    clock.advanceBy(20);
    assert.equal(requests[0].signal.aborted, false);
    assert.equal(channel.abortCalls, 0);
    assert.equal(channel.closeCalls, 0);
    await node.stop();
    await eventually(() => channel.closeCalls === 1, "session-owned teardown");
    await turnBarrier(node);
    assert.equal(requests[0].signal.aborted, false);
    assert.equal(channel.abortCalls, 0);
    assert.equal(clock.pendingTasks(), 0);
    assert.deepEqual(diagnostics, []);
  });

test("Given a listener failure with acquisition pending, when the host fails, then dial cancellation and timer cleanup prevent further retries",
  { timeout: 5_000 }, async (t) => {
    const listener = new ControlledListenerTransport("acquisition.listener");
    const { node, clock, requests, diagnostics } = await dialer(t, { listener });
    listener.terminalize({ origin: "carrier", kind: "io-failure" });
    await turnBarrier(node);
    assert.equal(node.operations.snapshot().lifecycle.state, "Failed");
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(clock.pendingTasks(), 0);
    clock.advanceBy(10_000);
    await turnBarrier(node);
    assert.equal(requests.length, 1);
    assert.deepEqual(diagnostics.map(({ code }) => code), ["LISTENER_TERMINAL"]);
  });

for (const reconnect of [false, true]) {
  test(`Given a settled connect failure with reconnect ${reconnect}, when its disposition commits, then deadline cleanup preserves the configured retry policy`,
    { timeout: 5_000 }, async (t) => {
      const { node, clock, requests, diagnostics } = await dialer(t, { reconnect });
      requests[0].fail();
      await turnBarrier(node);
      assert.equal(requests[0].signal.aborted, false);
      assert.deepEqual(diagnostics.map(({ code }) => code), ["CONNECT_FAILED"]);
      assert.equal(clock.pendingTasks(), reconnect ? 1 : 0);
      clock.advanceBy(5);
      await turnBarrier(node);
      assert.equal(requests.length, reconnect ? 2 : 1);
      await node.stop();
      assert.equal(clock.pendingTasks(), 0);
    });
}

test("Given a connect deadline beyond native timer width, when one timer chunk elapses, then acquisition remains eligible until its full deadline",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests, diagnostics } = await dialer(t, { timeoutMs: 4_294_967_294 });
    clock.advanceBy(2_147_483_647);
    assert.equal(requests[0].signal.aborted, false);
    assert.equal(clock.pendingTasks(), 1);
    clock.advanceBy(2_147_483_647);
    await turnBarrier(node);
    assert.equal(requests[0].signal.aborted, true);
    assert.deepEqual(diagnostics.map(({ code }) => code), ["CONNECT_TIMEOUT"]);
  });

test("Given an adopted channel that later closes, when controller release owns retry, then exactly one new acquisition starts with fresh deadline authority",
  { timeout: 5_000 }, async (t) => {
    const { node, clock, requests } = await dialer(t);
    const channel = requests[0].succeed();
    await eventually(() => channel.sendCalls === 1 && channel.readCalls === 1, "adopted controller");
    channel.terminalize({ origin: "carrier", kind: "io-failure" });
    await eventually(() => channel.closeCalls === 1, "controller release");
    await turnBarrier(node);
    assert.equal(node.operations.connections().items.length, 0);
    assert.equal(clock.pendingTasks(), 1, "one retry and no old acquisition/OPEN timer");
    clock.advanceBy(5);
    await turnBarrier(node);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].signal.aborted, false);
    assert.equal(requests[1].signal.aborted, false);
    clock.advanceBy(20);
    await turnBarrier(node);
    assert.equal(requests[1].signal.aborted, true);
    assert.equal(requests[0].signal.aborted, false);
    assert.equal(clock.pendingTasks(), 1);
  });

test("Given a configured acquisition timeout, when configuration is validated, then nonpositive and nonintegral values fail before resolving transport authority", () => {
  for (const timeoutMs of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createNode({
      nodeId: "acquisition.invalid", timers: { transportConnectTimeoutMs: timeoutMs },
    }), { code: "CONFIG_INVALID" });
  }
});
