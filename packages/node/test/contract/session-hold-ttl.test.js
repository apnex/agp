import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock } from "@agp/core";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

test("Given an Established session, when monotonic time advances, then hold TTL decreases without a state revision", async (t) => {
  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({
    wallTime: "2026-07-30T00:00:00.000Z",
  });
  const listener = createNode({
    nodeId: "node.listener",
    listen: { transportRef: "ttl.listener" },
    timers: { holdTimeMs: 30_000 },
  }, {
    transport: network.transport({ listeners: ["ttl.listener"] }),
    clock,
  });
  const dialer = createNode({
    nodeId: "node.dialer",
    peers: [{
      adjacencyId: "listener",
      expectedNodeId: "node.listener",
      transportRef: "ttl.listener",
    }],
    timers: { holdTimeMs: 30_000 },
  }, {
    transport: network.transport({ targets: ["ttl.listener"] }),
    clock,
  });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });

  await listener.start();
  await dialer.start();
  const before = await eventually(() => {
    const snapshot = dialer.operations.connections();
    const session = snapshot.items[0];
    const hold = session?.timers.find((timer) => timer.name === "hold");
    return session?.state === "Established" && hold?.state === "armed"
      ? { revision: snapshot.revision, hold }
      : undefined;
  }, "armed hold timer");

  assert.equal(before.hold.durationMs, 30_000);
  assert.equal(before.hold.remainingMs, 30_000);
  clock.advanceBy(1_000);
  const after = dialer.operations.connections();
  const holdAfter = after.items[0].timers.find(
    (timer) => timer.name === "hold",
  );

  assert.equal(after.revision, before.revision);
  assert.equal(holdAfter.remainingMs, 29_000);
});
