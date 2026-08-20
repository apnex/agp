import test from "node:test";
import assert from "node:assert/strict";
import {
  clock,
  operations,
  operationalSession,
} from "../fixtures/core-fixtures.js";

// Owns: query-time monotonic uptime/TTL without revision mutation.
test("given a frozen operations revision, when monotonic time advances, then uptime and hold TTL materialize each second", () => {
  const time = clock();
  const store = operations(time);
  store.commit({
    connections: [{
      controllerId: "controller",
      snapshot: operationalSession(),
    }],
  });
  const revision = store.currentRevision;
  time.advanceBy(1000);
  const first = store.connections().items[0];
  assert.equal(first.establishedDurationMs, 1000);
  assert.equal(first.timers[0].remainingMs, 29000);
  time.advanceBy(1000);
  const second = store.connections().items[0];
  assert.equal(second.establishedDurationMs, 2000);
  assert.equal(second.timers[0].remainingMs, 28000);
  assert.equal(store.currentRevision, revision);
});
