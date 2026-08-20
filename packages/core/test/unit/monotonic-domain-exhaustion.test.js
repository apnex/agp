import assert from "node:assert/strict";
import test from "node:test";

import {
  ManualClock,
  OperationsStore,
} from "../../dist/index.js";

const MAX = 18_446_744_073_709_551_615n;

test("given the last ordinary revision, when an ordinary mutation would consume the reserved terminal value, then it is replaced atomically by one inspectable revision-exhaustion failure", () => {
  const store = operations({
    revision: MAX - 1n,
  });

  const snapshot = store.commit({
    localEndpoints: [endpoint()],
    events: [{ kind: "endpoint.exposed", subjectId: "demo/unsafe" }],
  });

  assert.equal(snapshot.revision, MAX.toString());
  assert.deepEqual(snapshot.lifecycle.failure, {
    code: "MONOTONIC_DOMAIN_EXHAUSTED",
    domain: "operations-revision",
  });
  assert.deepEqual(snapshot.localEndpoints, []);
  assert.equal(store.commit({ localEndpoints: [endpoint()] }).revision, snapshot.revision);
  assert.deepEqual(store.endpoints().items, []);
});

test("given the maximum event sequence, when a transaction needs one more event, then no event or proposed state escapes and observation completes on the terminal snapshot", async () => {
  const store = operations({
    revision: 41n,
    eventSequence: MAX,
  });
  const events = store.events();

  const snapshot = store.commit({
    localEndpoints: [endpoint()],
    events: [{ kind: "endpoint.exposed", subjectId: "demo/unsafe" }],
  });

  assert.equal(snapshot.revision, "42");
  assert.deepEqual(snapshot.lifecycle.failure, {
    code: "MONOTONIC_DOMAIN_EXHAUSTED",
    domain: "event-sequence",
  });
  assert.deepEqual(snapshot.localEndpoints, []);
  assert.deepEqual(await events.next(), { done: true, value: undefined });
});

test("given a counter near its unsigned-64 limit, when one transaction supplies a multi-unit overflowing delta, then the counter is retained and all other proposed mutations are discarded", () => {
  const store = operations({
    revision: 11n,
    counters: {
      "message.accepted": MAX - 5n,
    },
  });

  const snapshot = store.commit({
    localEndpoints: [endpoint()],
    incrementCounters: { "message.accepted": 6n },
    events: [{ kind: "message.accepted", subjectId: "message-unsafe" }],
  });

  assert.equal(snapshot.revision, "12");
  assert.deepEqual(snapshot.lifecycle.failure, {
    code: "MONOTONIC_DOMAIN_EXHAUSTED",
    domain: "counter",
    counterKey: "message.accepted",
  });
  assert.equal(snapshot.counters.values["message.accepted"], (MAX - 5n).toString());
  assert.deepEqual(snapshot.localEndpoints, []);
});

function operations(initialMonotonicState) {
  return new OperationsStore({
    nodeId: "node.exhaustion",
    instanceId: "instance-exhaustion",
    clock: new ManualClock({
      wallTime: "2026-07-30T00:00:00.000Z",
    }),
    configuration: { raw: {}, effective: {}, redactedKeys: [] },
    initialMonotonicState,
  });
}

function endpoint() {
  return {
    endpoint: "demo/unsafe",
    bindingId: "binding-unsafe",
    registeredAt: "2026-07-30T00:00:00.000Z",
    active: true,
  };
}
