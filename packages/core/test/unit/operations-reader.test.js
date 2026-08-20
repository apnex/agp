import test from "node:test";
import assert from "node:assert/strict";
import {
  operations,
  operationalSession,
} from "../fixtures/core-fixtures.js";

// Owns: immutable, total-order, revision-consistent canonical queries.
test("given unordered canonical entities, when the operations reader captures them, then one frozen ordered revision is returned", () => {
  const store = operations();
  store.commit({
    localEndpoints: [
      {
        endpoint: "demo/z",
        bindingId: "z",
        registeredAt: "2026-07-30T00:00:00.000Z",
        active: true,
      },
      {
        endpoint: "demo/a",
        bindingId: "a",
        registeredAt: "2026-07-30T00:00:00.000Z",
        active: true,
      },
    ],
    connections: [{
      controllerId: "controller",
      snapshot: operationalSession(),
    }],
  });
  const snapshot = store.snapshot();
  assert.deepEqual(
    snapshot.localEndpoints.map((item) => item.endpoint),
    ["demo/a", "demo/z"],
  );
  assert.equal(snapshot.revision, store.connections().revision);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.throws(() => snapshot.localEndpoints.push({}));
});
