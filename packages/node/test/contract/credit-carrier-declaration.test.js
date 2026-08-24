import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that a carrier decides whether it is credited, and a deployment does
// not.
//
// This is `D29`. Credit costs about a fifth of throughput and exists to stop a
// sender outrunning its receiver's ring, which is `MX1`. Whether that can
// happen at all is a property of the carrier: one whose send resolves only
// when the receiver has room cannot be outrun, and one sitting behind kernel
// buffers and a congestion window always can.
//
// So neither answer is a preference. `D19` promised a deployment switch, and a
// switch offers a choice whose right value the node already knows.
//
// Absent is the protective answer. An adapter that says nothing is credited.

async function pair(t, network) {
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "credit.listener" },
  }, { transport: network.transport({ listeners: ["credit.listener"] }) });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "credit.listener",
    }],
  }, { transport: network.transport({ targets: ["credit.listener"] }) });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await listener.expose("sink/service", async () => {});
  await dialer.expose("origin/source", async () => {});
  await listener.start();
  await dialer.start();
  await eventually(
    () => dialer.operations.snapshot().connections[0]?.state === "Established",
    "the session establishes",
  );
  return dialer;
}

function outboundCredit(node) {
  return node.operations.snapshot().connections[0]?.credit?.outbound;
}

test("Given a carrier that does not promise to await receiver capacity, when a session establishes, then the peer is credited", async (t) => {
  const dialer = await pair(t, new MemoryPeerNetwork());

  await eventually(() => outboundCredit(dialer) !== undefined, "credit appears");
  const credit = outboundCredit(dialer);
  assert.equal(credit.unlimited, false);
  assert.ok(credit.ceiling, "a credited peer has a ceiling");
});

test("Given a carrier that promises to await receiver capacity, when a session establishes, then the peer is not credited", async (t) => {
  const dialer = await pair(
    t,
    new MemoryPeerNetwork({ sendAwaitsReceiverCapacity: true }),
  );

  // Delivery still works; what is absent is the accounting, because the
  // carrier already bounds what can be in flight and does it exactly.
  await dialer.send("origin/source", "sink/service", { ordinal: 0 });

  const credit = outboundCredit(dialer);
  assert.ok(
    credit === undefined || credit.unlimited === true,
    `a carrier that awaits receiver capacity must not be credited, got `
      + JSON.stringify(credit),
  );
});

test("Given the two production carriers, when each establishes, then only the one that can be outrun is credited", async (t) => {
  // The distinction is not a test fixture. Loopback delivers a pending send
  // only once the receiving side has room; a socket resolves once the kernel
  // has the bytes, which is the measurement behind `MX1`.
  const { GEOMETRIES, awaitConvergence, buildGeometry } = await import(
    "../../../../test/support/geometry.js"
  );
  const seen = {};
  for (const transport of ["loopback", "websocket"]) {
    const deliveries = [];
    const topology = await buildGeometry({
      geometry: GEOMETRIES.line(),
      transport,
      endpointsPerNode: 1,
      deliveries,
    });
    try {
      await awaitConvergence(topology);
      seen[transport] = outboundCredit(topology.nodes[0]);
    } finally {
      await Promise.allSettled(topology.nodes.map((node) => node.stop()));
    }
  }

  assert.ok(
    seen.loopback === undefined || seen.loopback.unlimited === true,
    "loopback awaits receiver capacity and must not be credited",
  );
  assert.equal(
    seen.websocket?.unlimited,
    false,
    "a socket carrier must be credited",
  );
});
