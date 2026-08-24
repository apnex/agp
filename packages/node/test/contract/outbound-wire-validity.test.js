import assert from "node:assert/strict";
import test from "node:test";
import {
  AGP_V1_LIMITS,
  parseAgpPacket,
  validateAgpMessage,
} from "@agp/protocol";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: that every packet a node puts on the wire is schema-valid.
//
// This is the gate that replaces validating each outbound message as it is
// encoded. That check cost between a fifth and a quarter of throughput to
// prove, on every message forever, that this node had correctly built a shape
// its own generated types already describe. See `D27`.
//
// It is a gate over bytes rather than over constructors deliberately. A
// constructor gate proves the constructors someone remembered to list; the
// transport is the one place every packet passes whatever produced it, so
// nothing reaches a peer without passing through here.
//
// Parse-side validation of what a peer sends is untouched and is not this
// test's subject. Nothing about trusting a peer changed.

/** Every wire type a converged pair exchanges under load and under teardown. */
const EXPECTED = [
  "open",
  "keepalive",
  "route.update",
  "route.ack",
  "disposition",
  "message",
];

test("Given a node under load and teardown, when every packet it sent is inspected, then each one is schema-valid", async (t) => {
  const network = new MemoryPeerNetwork({ capture: true });
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "wire.listener" },
    disposition: { debounceMs: 0 },
  }, { transport: network.transport({ listeners: ["wire.listener"] }) });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "wire.listener",
    }],
    disposition: { debounceMs: 0 },
  }, { transport: network.transport({ targets: ["wire.listener"] }) });
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

  for (let ordinal = 0; ordinal < 40; ordinal += 1) {
    await dialer.send("origin/source", "sink/service", { ordinal });
  }
  // A pin nobody can serve, so a failure disposition is on the wire too.
  const refused = await dialer.send("origin/source", "sink/service", {
    ordinal: "pinned",
  }, {
    destinationSelector: { originNodeId: "node.absent", mode: "pinned" },
  });
  await dialer.settled(refused.messageId);

  // A late endpoint change puts another route transaction across.
  const extra = await listener.expose("sink/late", async () => {});
  await eventually(
    () => dialer.operations.routes().selected.some(
      ({ endpoint }) => endpoint === "sink/late",
    ),
    "the late endpoint converges",
  );
  await extra.close();
  await dialer.stop();

  const packets = network.captured();
  assert.ok(packets.length > 40, `only ${packets.length} packets captured`);

  const seen = new Set();
  for (const [index, bytes] of packets.entries()) {
    const parsed = parseAgpPacket(bytes, {
      receiveLimitBytes: AGP_V1_LIMITS.maxReceiveBytes,
    });
    assert.equal(
      parsed.ok,
      true,
      `packet ${index} did not parse: ${parsed.ok ? "" : parsed.reasonCode}`,
    );
    // Validated explicitly rather than relying on the parse above, so this
    // still gates if the parse path is ever changed.
    const validation = validateAgpMessage(parsed.message);
    assert.equal(
      validation.ok,
      true,
      `packet ${index} of type ${parsed.message.type} is not schema-valid`,
    );
    seen.add(parsed.message.type);
  }

  for (const type of EXPECTED) {
    assert.ok(seen.has(type), `no ${type} packet was exercised`);
  }
});
