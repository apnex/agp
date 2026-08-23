import assert from "node:assert/strict";
import test from "node:test";

import { immutableClone } from "../../dist/index.js";
import { operations } from "../fixtures/core-fixtures.js";

// Owns: that the cost of a write follows what changed rather than what is held.
//
// This is `D21`, and it is gated here because the fault it corrects was
// invisible from every functional test. Everything passed while the write path
// was quadratic. What it produced was not a wrong answer but a blocked event
// loop, which then corrupted every duration measured anywhere else in the
// system, including the ones being used to diagnose it.
//
// The first three assertions are exact. The last is a coarse budget with a
// wide margin, because the shape of the regression it guards against is an
// order of magnitude rather than a percentage.

function correlations(count, expiry) {
  return Array.from({ length: count }, (_, index) => ({
    messageId: `message-${String(index).padStart(6, "0")}`,
    outboundReturnToken: String(index).padStart(16, "0"),
    source: { endpoint: "cost/source", originNodeId: "cost.node" },
    destination: "cost/sink",
    ingress: { kind: "local" },
    egressNodeId: "cost.peer",
    egressSessionId: "000001",
    admittedAtRevision: "1",
    expiresAt: expiry,
  }));
}

test("Given a committed change, when the write returns, then it reports the revision rather than the state that follows it", () => {
  const store = operations();

  const receipt = store.commit({ labelBindings: correlations(4, "2026-01-01T00:00:00.000Z") });

  assert.equal(typeof receipt.revision, "string");
  // Returning state made every write pay for a read nobody asked for, priced
  // by everything held rather than by anything done.
  for (const collection of ["connections", "labelBindings", "selectedRoutes"]) {
    assert.equal(
      receipt[collection],
      undefined,
      `a commit receipt must not carry ${collection}`,
    );
  }
});

test("Given canonical state that has not changed, when it is read twice, then the same frozen value is shared rather than copied again", () => {
  const store = operations();
  store.commit({ labelBindings: correlations(8, "2026-01-01T00:00:00.000Z") });

  const first = store.snapshot();
  const second = store.snapshot();

  // Sharing is safe precisely because it is frozen: two readers holding one
  // reference can no more disturb each other than two holding copies.
  assert.equal(Object.isFrozen(first.labelBindings), true);
  assert.equal(
    first.labelBindings,
    second.labelBindings,
    "unchanged canonical state must not be re-cloned on every read",
  );
});

test("Given a value already cloned and frozen, when it is cloned again, then the same reference is returned", () => {
  const frozen = immutableClone({ nested: { list: [1, 2, 3] } });

  assert.equal(immutableClone(frozen), frozen);
  assert.equal(immutableClone(frozen.nested), frozen.nested);
  assert.throws(() => {
    frozen.nested.list.push(4);
  });
});

test("Given a commit that changes nothing, when it is applied, then no revision is issued for it", () => {
  const store = operations();
  const rows = correlations(4, "2026-01-01T00:00:00.000Z");
  const first = store.commit({ labelBindings: rows });

  // The caller memoises this projection, so an unchanged set arrives as the
  // same reference. One commit per delivered message supplies exactly that.
  const second = store.commit({ labelBindings: rows });

  assert.equal(
    second.revision,
    first.revision,
    "a revision must denote a change, not that somebody called commit",
  );
  assert.equal(store.snapshot().revision, first.revision);
});

test("Given a commit that changes nothing but announces something, when it is applied, then the event still earns a revision", () => {
  const store = operations();
  const rows = correlations(2, "2026-01-01T00:00:00.000Z");
  const first = store.commit({ labelBindings: rows });

  const second = store.commit({
    labelBindings: rows,
    events: [{ kind: "session.transition", subjectId: "controller-1" }],
  });

  // An event is a change to what the node has said, even when no collection
  // moved, so suppressing its revision would lose the correlation between an
  // event and the state it was emitted against.
  assert.notEqual(second.revision, first.revision);
});

test("Given ten times as much held state, when the same write is repeated, then its cost does not grow in proportion", () => {
  const expiry = "2026-01-01T00:00:00.000Z";
  const measure = (held) => {
    const store = operations();
    const rows = correlations(held, expiry);
    for (let warm = 0; warm < 20; warm += 1) store.commit({ labelBindings: rows });
    const started = process.hrtime.bigint();
    for (let commit = 0; commit < 200; commit += 1) {
      store.commit({ labelBindings: rows });
    }
    return Number(process.hrtime.bigint() - started) / 200;
  };

  const small = measure(50);
  const large = measure(500);
  const growth = large / Math.max(small, 1);

  // Ten times the held state cost roughly ten times as much per write before
  // D21, and three commits land per delivered message, so a stream paid that
  // multiplier squared. The margin here is deliberately wide: this guards
  // against the return of an order of magnitude, not against drift.
  assert.ok(
    growth < 5,
    `per-write cost grew ${growth.toFixed(1)}x for 10x held state`
      + ` (${Math.round(small)}ns to ${Math.round(large)}ns)`,
  );
});
