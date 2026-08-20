import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock } from "@agp/core";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

test("Given an Established session with continuing outbound JSON traffic, when the keepalive interval passes, then successful writes postpone KeepaliveExpired while the hold timer remains peer-driven", async (t) => {
  const network = new MemoryPeerNetwork();
  const clock = new ManualClock({
    wallTime: "2026-07-30T00:00:00.000Z",
  });
  const listener = createNode({
    nodeId: "node.listener",
    listen: { transportRef: "keepalive.listener" },
    timers: { holdTimeMs: 30_000 },
  }, {
    transport: network.transport({ listeners: ["keepalive.listener"] }),
    clock,
  });
  const dialer = createNode({
    nodeId: "node.dialer",
    peers: [{
      adjacencyId: "listener",
      expectedNodeId: "node.listener",
      transportRef: "keepalive.listener",
    }],
    timers: { holdTimeMs: 30_000 },
  }, {
    transport: network.transport({ targets: ["keepalive.listener"] }),
    clock,
  });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });

  await listener.expose("listener/service", async () => {});
  await dialer.expose("dialer/source", async () => {});
  await listener.start();
  await dialer.start();
  await eventually(() => {
    const route = dialer.operations.routes().selected.find(
      ({ endpoint }) => endpoint === "listener/service",
    );
    const source = dialer.operations.routeExports().items.find(
      ({ endpoint, state }) =>
        endpoint === "dialer/source" && state === "acked",
    );
    return route !== undefined && source !== undefined;
  }, "route and ACKed source export");

  clock.advanceBy(9_000);
  await dialer.send(
    "dialer/source",
    "listener/service",
    { keeps: "session-active" },
  );
  await eventually(() => {
    const keepalive = dialer.operations.connections().items[0]?.timers.find(
      ({ name }) => name === "keepalive",
    );
    return keepalive?.remainingMs === 10_000;
  }, "outbound activity keepalive reset");

  clock.advanceBy(1_000);
  const session = dialer.operations.connections().items[0];
  const keepalive = session.timers.find(({ name }) => name === "keepalive");
  const hold = session.timers.find(({ name }) => name === "hold");

  assert.notEqual(session.lastTransition.event, "KeepaliveExpired");
  assert.equal(keepalive.remainingMs, 9_000);
  assert.equal(hold.remainingMs, 20_000);
});
