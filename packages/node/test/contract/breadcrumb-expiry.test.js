import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock } from "@agp/core";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that reverse-correlation capacity is a rate bound and not a lifetime
// total, in the one case where nothing reports back.
//
// A breadcrumb is retained for every message a node originates and released
// only by expiry. The sweep that releases them existed and was called from
// nowhere, so a node accepted exactly `maxReverseCorrelations` messages and
// then refused every further one for the rest of its life, returning a code
// documented as retryable for a condition that could never clear.
//
// No test caught it because no test sent four thousand messages. This one
// lowers the bound instead of raising the volume, and moves a manual clock
// rather than waiting thirty seconds.
//
// Since D23 a binding is normally released by the disposition that returns for
// it, so expiry is the backstop rather than the mechanism. These cases pin the
// backstop, and so must hold the disposition off: the debounce is set past the
// life of the test, and the table is told to refuse rather than evict, which is
// the configuration a deployment picks when it would rather stop than lose a
// disposition. Release-on-success is gated by disposition-release.test.js.

const CAPACITY = 8;

async function converged(t) {
  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({ wallTime: "2026-07-30T00:00:00.000Z" });
  // The hold timer is disabled so the only deadline the clock crosses is the
  // correlation lifetime. With it enabled, advancing past a thirty second
  // lifetime also expires a thirty second hold and the routes go with it.
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "expiry.listener" },
    timers: { holdTimeMs: 0 },
  }, {
    transport: network.transport({ listeners: ["expiry.listener"] }),
    clock,
  });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "expiry.listener",
    }],
    timers: { holdTimeMs: 0 },
    capacity: { maxReverseCorrelations: CAPACITY },
    disposition: { debounceMs: 60_000, onCapacity: "refuse" },
  }, {
    transport: network.transport({ targets: ["expiry.listener"] }),
    clock,
  });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await listener.expose("sink/service", async () => {});
  await dialer.expose("origin/source", async () => {});
  await listener.start();
  await dialer.start();
  await eventually(() => {
    const route = dialer.operations.routes().selected.find(
      ({ endpoint }) => endpoint === "sink/service",
    );
    const source = dialer.operations.routeExports().items.find(
      ({ endpoint, state }) => endpoint === "origin/source" && state === "acked",
    );
    return route !== undefined && source !== undefined;
  }, "route and ACKed source export");
  return { dialer, clock };
}

async function offer(dialer, count) {
  let accepted = 0;
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    try {
      await dialer.send("origin/source", "sink/service", { ordinal });
      accepted += 1;
    } catch (error) {
      assert.equal(error.code, "QUEUE_FULL");
      break;
    }
  }
  return accepted;
}

test("Given reverse-correlation capacity reached, when more is offered, then it is refused with a retryable capacity code", async (t) => {
  const { dialer } = await converged(t);

  const accepted = await offer(dialer, CAPACITY * 4);

  assert.equal(accepted, CAPACITY, "capacity bounds what may be outstanding");
  await assert.rejects(
    dialer.send("origin/source", "sink/service", { ordinal: "past" }),
    (error) => error.code === "QUEUE_FULL" && error.retryable === true,
  );
});

test("Given the correlation lifetime has elapsed, when sending resumes, then the capacity is available again", async (t) => {
  const { dialer, clock } = await converged(t);
  assert.equal(await offer(dialer, CAPACITY * 4), CAPACITY);

  // Past the lifetime, which is at least thirty seconds. Before the sweep was
  // wired this recovered nothing, whatever the wait.
  clock.advanceBy(31_000);

  assert.equal(
    await offer(dialer, CAPACITY * 4),
    CAPACITY,
    "a retryable refusal must describe a condition that can clear",
  );
});

test("Given breadcrumbs that have expired, when sending resumes, then the retained set is replaced rather than grown", async (t) => {
  const { dialer, clock } = await converged(t);
  await offer(dialer, CAPACITY * 4);
  const before = new Set(
    dialer.operations.snapshot().reverseCorrelations.map(({ messageId }) => messageId),
  );
  assert.ok(before.size > 0 && before.size <= CAPACITY);

  clock.advanceBy(31_000);
  await offer(dialer, CAPACITY);

  const after = dialer.operations.snapshot().reverseCorrelations;
  assert.ok(
    after.length <= CAPACITY,
    "the retained set may never exceed the bound it is admitted against",
  );
  assert.ok(
    after.some(({ messageId }) => !before.has(messageId)),
    "sending after expiry must retain the new correlations",
  );
  assert.ok(
    after.some(({ messageId }) => before.has(messageId)) === false,
    "and must have released the expired ones rather than kept them",
  );
});
