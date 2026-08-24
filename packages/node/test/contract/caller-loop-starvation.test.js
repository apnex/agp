import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that a caller cannot stop this node's event loop from turning.
//
// This is `D28`. Every step of admission settles as a microtask, and microtasks
// are drained to exhaustion before a timer is allowed to fire, so a caller that
// awaits `send()` in a loop never reaches the macrotask queue. Nothing it does
// wrong causes that; it is what a tight await loop is.
//
// The timers it starves include this node's own hold and route-acknowledgement
// deadlines, and a starved deadline is how healthy sessions were torn down in
// `MX2`. A document cannot guarantee a caller yields, so the node does.
//
// The probe is a plain interval timer, which is what every deadline in the
// node ultimately is. If it fires while a tight loop runs, so do they.

const BURST = 400;

test("Given a caller sending in a tight await loop, when the burst runs, then a macrotask timer still fires throughout", async (t) => {
  const network = new MemoryPeerNetwork();
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "starve.listener" },
  }, { transport: network.transport({ listeners: ["starve.listener"] }) });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "starve.listener",
    }],
  }, { transport: network.transport({ targets: ["starve.listener"] }) });
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

  let fired = 0;
  const timer = setInterval(() => { fired += 1; }, 1);

  // Deliberately the shape that starves a loop: no yield of any kind between
  // sends, which is what an application streaming work naturally writes.
  for (let ordinal = 0; ordinal < BURST; ordinal += 1) {
    await dialer.send("origin/source", "sink/service", { ordinal });
  }
  clearInterval(timer);

  // The node yields every sixteenth send, so a burst of four hundred owes at
  // least twenty-five turns. Asserting well below that keeps this a gate on
  // the mechanism existing rather than on the machine's speed.
  assert.ok(
    fired >= BURST / 32,
    `a one-millisecond timer fired ${fired} times across ${BURST} sends, `
      + "so the caller starved the loop",
  );
});
