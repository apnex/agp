import assert from "node:assert/strict";
import test from "node:test";

import { emptyQueue, operations } from "../fixtures/core-fixtures.js";

// Owns: that the canonical revision advances when canonical state changed, and
// not when a value moved because traffic crossed the node.
//
// This is `D25`. A revision is the change signal `D10` gives a consumer to poll
// on, and four values inside a session record move once per message: the hold
// timer, the token allocator's count, the timestamp on the self-transition
// `D22` records without announcing, and the credit counters `D20` projects.
// While any of them advanced the revision, a polling consumer re-read on every
// message and the signal carried no information.
//
// The suppression is deliberately narrow, and both directions are gated here.
// A missed change cannot be recovered by re-reading, so anything this cannot
// prove to be traffic-rated must still signal: exhaustion is structural even
// though the count beside it is not, a real transition is structural even
// though its timestamp is not, and a re-granted ceiling is structural even
// though what has been sent against it is not.

function session(overrides = {}) {
  return {
    controllerId: "controller-1",
    snapshot: {
      identityState: "admitted",
      direction: "outbound",
      state: "Established",
      stateSince: "2026-08-23T00:00:00.000Z",
      sessionId: "000001",
      remoteNodeId: "node.peer",
      routeImport: "idle",
      routeExport: "idle",
      queues: {
        control: emptyQueue(),
        data: emptyQueue(),
        continuation: emptyQueue(),
      },
      lastTransition: {
        event: "DataReceived",
        from: "Established",
        to: "Established",
        at: "2026-08-23T00:00:00.000Z",
      },
      timers: [],
      returnTokenAllocator: {
        allocated: "0",
        exhausted: false,
        maximum: "18446744073709551615",
      },
      credit: {
        outbound: {
          unlimited: false,
          ceiling: { bytes: "1024", packets: "8" },
          sent: { bytes: "0", packets: "0" },
          remaining: { bytes: "1024", packets: "8" },
          stalls: "0",
          stalledUs: 0,
        },
        inbound: {
          capacity: { bytes: "1024", packets: "8" },
          read: { bytes: "0", packets: "0" },
          advertised: { bytes: "1024", packets: "8" },
          announcements: "0",
        },
      },
      ...overrides,
    },
  };
}

function revisionAfter(store, snapshot) {
  return Number(store.commit({ connections: [snapshot] }).revision);
}

function settled() {
  const store = operations();
  const base = session();
  const first = revisionAfter(store, base);
  return { store, base, first };
}

test("Given a session record whose only movement is traffic-rated, when it is committed, then the revision does not advance", () => {
  const { store, base, first } = settled();

  const moved = session({
    timers: [{
      name: "hold",
      state: "armed",
      startedAt: "2026-08-23T00:00:09.000Z",
      durationMs: 30_000,
      expiresAt: "2026-08-23T00:00:39.000Z",
    }],
    returnTokenAllocator: {
      ...base.snapshot.returnTokenAllocator,
      allocated: "412",
    },
    lastTransition: {
      ...base.snapshot.lastTransition,
      at: "2026-08-23T00:00:09.000Z",
    },
    credit: {
      outbound: {
        ...base.snapshot.credit.outbound,
        sent: { bytes: "900", packets: "7" },
        remaining: { bytes: "124", packets: "1" },
        stalls: "3",
        stalledUs: 812,
      },
      inbound: {
        ...base.snapshot.credit.inbound,
        read: { bytes: "900", packets: "7" },
      },
    },
  });

  assert.equal(revisionAfter(store, moved), first);

  // Suppressed from the signal, not from the plane: an operator still reads
  // every one of them.
  const held = store.snapshot().connections[0];
  assert.equal(held.returnTokenAllocator.allocated, "412");
  assert.equal(held.credit.inbound.read.packets, "7");
  assert.equal(held.timers[0].startedAt, "2026-08-23T00:00:09.000Z");
  assert.equal(held.lastTransition.at, "2026-08-23T00:00:09.000Z");
});

test("Given a structural change beside a traffic-rated one, when it is committed, then the revision advances", () => {
  const cases = {
    "a real transition": {
      lastTransition: {
        event: "NotificationReceived",
        from: "Established",
        to: "Idle",
        at: "2026-08-23T00:00:09.000Z",
      },
    },
    "token exhaustion": {
      returnTokenAllocator: {
        allocated: "412",
        exhausted: true,
        maximum: "18446744073709551615",
      },
    },
    "a re-granted ceiling": {
      credit: {
        outbound: {
          unlimited: false,
          ceiling: { bytes: "4096", packets: "32" },
          sent: { bytes: "900", packets: "7" },
          remaining: { bytes: "3196", packets: "25" },
          stalls: "0",
          stalledUs: 0,
        },
        inbound: {
          capacity: { bytes: "1024", packets: "8" },
          read: { bytes: "900", packets: "7" },
          advertised: { bytes: "1024", packets: "8" },
          announcements: "0",
        },
      },
    },
    "a state change": { state: "Idle" },
    "a new announcement": {
      credit: {
        outbound: { ...session().snapshot.credit.outbound },
        inbound: {
          capacity: { bytes: "1024", packets: "8" },
          read: { bytes: "900", packets: "7" },
          advertised: { bytes: "2048", packets: "16" },
          announcements: "1",
        },
      },
    },
  };

  for (const [name, overrides] of Object.entries(cases)) {
    const { store, first } = settled();
    assert.ok(
      revisionAfter(store, session(overrides)) > first,
      `${name} must advance the revision`,
    );
  }
});

test("Given a different set of controllers, when it is committed, then the revision advances whatever the values are", () => {
  const { store, first } = settled();

  // The comparison must refuse anything it cannot prove, because a change that
  // never signalled cannot be recovered by re-reading.
  const second = store.commit({
    connections: [session(), { ...session(), controllerId: "controller-2" }],
  });
  assert.ok(Number(second.revision) > first);

  const third = store.commit({ connections: [] });
  assert.ok(Number(third.revision) > Number(second.revision));
});
