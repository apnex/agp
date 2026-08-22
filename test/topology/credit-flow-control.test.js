import assert from "node:assert/strict";
import test from "node:test";

import {
  createWebSocketNode,
  eventually,
  expose,
  memoryPeer,
  selectedRoute,
} from "../support/uniform-topology.js";
import { streamMessages } from "../support/traffic.js";

// Owns: traffic offered faster than the peer can drain it, over a carrier that
// will not push back in time to help.
//
// This is the one axis no other topology file can carry. `stream-ordering`
// varies volume against a ring large enough to hold it, so it never reaches a
// bound. `burst-admission` varies concurrency against the local queue, which
// is this node's own resource. Here the bound belongs to the *peer*, and the
// only thing that can respect it is a grant the peer issued.
//
// The receive ring is set below the offered volume deliberately. Finding MX1
// recorded that AGP delivered exactly `maxBufferedPackets` messages and then
// reset the session, purged its routes and reconverged, after every `send()`
// had already resolved. A local kernel send buffer, a TCP window and a peer
// kernel receive buffer together hold megabytes, so the carrier's own
// backpressure cannot engage before a ring of tens of packets is exceeded.
// Enlarging the ring only moves the cliff, which is why the fix is a grant
// rather than a bigger number.

const RING_PACKETS = 16;
const OFFERED = 120;
const SOURCE = "credit.sender/ep0";
const SINK = "credit.receiver/ep0";
// A selected route is not yet a sendable one: the source export must also be
// ACKed, and that ACK travels the other way. Probing a sibling endpoint proves
// the same export is usable without putting an ordinal into the stream.
const PROBE = "credit.receiver/probe";

async function convergedPair(context, deliveries) {
  const receiver = createWebSocketNode({
    nodeId: "credit.receiver",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    transit: false,
    // Smaller than the traffic about to be offered, so the bound is reached
    // rather than assumed.
    transportReceivePackets: RING_PACKETS,
  });
  context.after(() => receiver.stop().catch(() => undefined));
  await expose(receiver, [SINK, PROBE], deliveries);
  const started = await receiver.start();

  const sender = createWebSocketNode({
    nodeId: "credit.sender",
    transit: false,
    peers: [{
      ...memoryPeer("sender-receiver", "credit.receiver", 1),
      url: started.listener.publication.displayAddress,
    }],
  });
  context.after(() => sender.stop().catch(() => undefined));
  await expose(sender, [SOURCE], deliveries);
  await sender.start();

  await eventually(
    () => selectedRoute(sender, SINK) !== undefined
      && selectedRoute(receiver, SOURCE) !== undefined,
    "the pair selects both endpoints",
    20_000,
  );
  await sendable(sender);
  return { sender, receiver };
}

/**
 * Wait until the path actually carries a message.
 *
 * `eventually` takes a synchronous probe, and a send is not one.
 */
async function sendable(sender, timeoutMs = 20_000) {
  const deadline = performance.now() + timeoutMs;
  let last;
  while (performance.now() < deadline) {
    try {
      await sender.send(SOURCE, PROBE, { probe: true });
      return;
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  throw new Error(`the source export never became sendable: ${last?.code}`);
}

function sessionIdentities(node) {
  return node.operations.snapshot().connections
    .map((connection) => `${connection.localSessionId}:${connection.state}`);
}

test("given a receiver whose ring is smaller than the offered stream, when more messages are sent than it can hold, then every one arrives in order rather than the excess being lost", async (context) => {
  const deliveries = [];
  const { sender } = await convergedPair(context, deliveries);

  const { receipts, arrived } = await streamMessages({
    from: sender,
    source: SOURCE,
    destination: SINK,
    count: OFFERED,
    deliveries,
  });

  assert.equal(receipts.length, OFFERED, "every send must be admitted");
  assert.ok(
    OFFERED > RING_PACKETS,
    "the offered volume must exceed the ring for this to prove anything",
  );
  assert.deepEqual(
    arrived,
    Array.from({ length: OFFERED }, (_, ordinal) => ordinal),
    "every message must arrive exactly once in send order",
  );
});

test("given a stream that exceeded the receive ring, when the session is inspected afterwards, then it was paced rather than reset and its routes never withdrew", async (context) => {
  const deliveries = [];
  const { sender, receiver } = await convergedPair(context, deliveries);
  const before = sessionIdentities(sender);

  await streamMessages({
    from: sender,
    source: SOURCE,
    destination: SINK,
    count: OFFERED,
    deliveries,
  });

  // A reset would have produced a new local session identity, which is the
  // observable signature MX1 left behind: the route purge and reconvergence
  // that followed were consequences of the session dying, not causes.
  assert.deepEqual(
    sessionIdentities(sender),
    before,
    "the session that carried the stream must be the one that started it",
  );
  assert.notEqual(
    selectedRoute(sender, SINK),
    undefined,
    "the destination route must never have withdrawn",
  );
  assert.notEqual(
    selectedRoute(receiver, SOURCE),
    undefined,
    "the reverse route must never have withdrawn",
  );
});
