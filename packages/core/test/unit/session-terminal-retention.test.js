import assert from "node:assert/strict";
import test from "node:test";

import {
  emptyQueue,
  operationalSession,
  operations,
} from "../fixtures/core-fixtures.js";

test("given an admitted dial retained for retry, when unrelated state changes and the next attempt starts, then one terminal survives only until the fresh pre-identity record replaces it", () => {
  const store = operations();
  const terminal = { origin: "carrier", kind: "io-failure" };
  store.commit({
    connections: [{
      controllerId: "controller-a",
      snapshot: operationalSession({
        state: "Active",
        lastTransportTerminal: terminal,
      }),
    }],
  });

  store.commit({
    localEndpoints: [{
      endpoint: "demo/local",
      bindingId: "binding-local",
      registeredAt: "2026-07-30T00:00:00.000Z",
      active: true,
    }],
  });
  assert.deepEqual(
    store.connections().items[0].lastTransportTerminal,
    terminal,
  );

  store.commit({
    connections: [{
      controllerId: "controller-a",
      snapshot: pendingAttempt(),
    }],
  });
  const [replacement] = store.connections().items;
  assert.equal(replacement.identityState, "pending");
  assert.equal(replacement.localSessionId, "0000aa");
  assert.equal("remoteNodeId" in replacement, false);
  assert.equal("lastTransportTerminal" in replacement, false);
  assert.equal(store.connections().items.length, 1);
});

function pendingAttempt() {
  const queue = emptyQueue();
  return {
    identityState: "pending",
    localSessionId: "0000aa",
    direction: "outbound",
    adjacencyId: "peer-a",
    state: "Connect",
    stateSince: "2026-07-30T00:00:01.000Z",
    lastTransition: {
      event: "StartDial",
      from: "Idle",
      to: "Connect",
      at: "2026-07-30T00:00:01.000Z",
    },
    timers: [],
    queues: { control: queue, data: queue, continuation: queue },
  };
}
