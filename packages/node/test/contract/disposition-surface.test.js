import assert from "node:assert/strict";
import test from "node:test";
import { validateCoreSchema } from "@agp/core";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

// Owns: what an application is told about the fate of a message it sent.
//
// D23 requires the disposition be surfaced per send and per endpoint, and
// requires the SDK to distinguish "at least one outstanding, total unknown"
// from a known count. It also requires that this is not one operational event
// per message, which is why the detail rides its own stream and the operations
// plane is left carrying counters.
//
// Unknown is explicit after session loss, or inferred from a missing outcome, never by the
// absence of a field on the wire: the wire forbids spelling a denominator of
// one, so absence there means one rather than unknown.

/**
 * Await a settlement, but never longer than a bounded wait.
 *
 * The contract is best effort, so a broken mechanism produces silence rather
 * than an error. Awaiting it bare turns a failing gate into a hanging one,
 * which is worse than a red test because nothing reports it.
 */
async function settledWithin(node, messageId, ms = 5_000) {
  let timer;
  const expired = Symbol("expired");
  const result = await Promise.race([
    node.settled(messageId),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(expired), ms);
    }),
  ]);
  clearTimeout(timer);
  assert.notEqual(result, expired, `no disposition settled within ${ms}ms`);
  assert.equal(validateCoreSchema("urn:agp:schema:v1:core:sdk:message-disposition", result).ok, true);
  return result;
}

async function converged(t, disposition = { debounceMs: 0 }, handlers = {}) {
  const network = new MemoryPeerNetwork();
  const listener = createNode({
    nodeId: "node.sink",
    listen: { transportRef: "surface.listener" },
    disposition,
  }, { transport: network.transport({ listeners: ["surface.listener"] }) });
  const dialer = createNode({
    nodeId: "node.origin",
    peers: [{
      adjacencyId: "sink",
      expectedNodeId: "node.sink",
      transportRef: "surface.listener",
    }],
    disposition,
  }, { transport: network.transport({ targets: ["surface.listener"] }) });
  t.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  await listener.expose("sink/service", handlers.request ?? (async () => {}));
  await dialer.expose("origin/source", handlers.reply ?? (async () => {}));
  await dialer.expose("origin/other", async () => {});
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
  return { dialer, listener };
}

test("Given a request with attempt correlation, when the application echoes it in a reply, then both reports retain the label and distinct message identities", { timeout: 5_000 }, async (t) => {
  const received = Promise.withResolvers();
  const replySent = Promise.withResolvers();
  let listener;
  const pair = await converged(t, { debounceMs: 0 }, {
    async request(payload, context) {
      try {
        replySent.resolve(await listener.send("sink/service", context.delivery.source.endpoint,
          { answer: payload.question }, { correlationId: context.delivery.correlationId }));
      } catch (error) { replySent.reject(error); }
    },
    async reply(payload, context) { received.resolve({ payload, context }); },
  });
  listener = pair.listener;
  await eventually(() => listener.operations.routeExports().items.some(
    ({ endpoint, state }) => endpoint === "sink/service" && state === "acked"), "reply source export");
  const requestReceipt = await pair.dialer.send("origin/source", "sink/service",
    { question: "example" }, { correlationId: "attempt-1" });
  const [replyReceipt, reply] = await Promise.all([replySent.promise, received.promise]);
  assert.deepEqual(reply.payload, { answer: "example" });
  assert.equal(reply.context.delivery.correlationId, "attempt-1");
  assert.notEqual(requestReceipt.messageId, replyReceipt.messageId);
  for (const [node, receipt] of [[pair.dialer, requestReceipt], [listener, replyReceipt]]) {
    const disposition = await settledWithin(node, receipt.messageId);
    assert.equal(disposition.correlationId, "attempt-1");
    assert.deepEqual(disposition.outcomes, [{ kind: "delivered" }]);
  }
});

test("Given a message that is delivered, when its disposition returns, then the sender is told it settled and how many destinations owed it", async (t) => {
  const { dialer } = await converged(t);

  const receipt = await dialer.send("origin/source", "sink/service", { a: 1 });
  const settled = await settledWithin(dialer, receipt.messageId);

  assert.equal(settled.messageId, receipt.messageId);
  assert.equal(settled.source, "origin/source");
  assert.equal(settled.destination, "sink/service");
  assert.equal(settled.settled, true);
  assert.equal(settled.outstanding, 0);
  // Known, and known to be one. The wire said so by omitting the field, and
  // the codec turned that absence into a number exactly once.
  assert.equal(settled.total, 1);
  assert.deepEqual(settled.outcomes, [{ kind: "delivered" }]);
});

test("Given a handler that throws, when delivery is reported, then delivered does not claim processing success", async (t) => {
  let invoked = false;
  const { dialer } = await converged(t, { debounceMs: 0 }, {
    async request() { invoked = true; throw new Error("application processing failed"); },
  });
  const receipt = await dialer.send("origin/source", "sink/service", {});
  const disposition = await settledWithin(dialer, receipt.messageId);
  assert.equal(invoked, true);
  assert.deepEqual(disposition.outcomes, [{ kind: "delivered" }]);
});

test("Given a message whose outcome has not arrived, when the sender reads it, then the total is unknown rather than assumed to be one", async (t) => {
  const { dialer } = await converged(t);

  const receipt = await dialer.send("origin/source", "sink/service", { a: 2 });
  const immediate = dialer.disposition(receipt.messageId);

  // Read before any outcome could return. The distinction D23 asks for: at
  // least one outstanding, total not yet known, which is not the same
  // statement as a total of one.
  assert.equal(immediate.settled, false);
  assert.equal(immediate.total, undefined);
  assert.ok(immediate.outstanding >= 1);
  assert.deepEqual(immediate.outcomes, []);

  const settled = await settledWithin(dialer, receipt.messageId);
  assert.equal(settled.total, 1);
});

test("Given a stream filtered to one endpoint, when two endpoints send, then only that endpoint's dispositions arrive", async (t) => {
  const { dialer } = await converged(t);
  const stream = dialer.dispositions({ source: "origin/source" });

  const wanted = dialer.send("origin/source", "sink/service", { a: 3 });
  const unwanted = dialer.send("origin/other", "sink/service", { a: 4 });
  const [wantedReceipt] = await Promise.all([wanted, unwanted]);

  const seen = [];
  const reader = (async () => {
    for await (const disposition of stream) {
      seen.push(disposition);
      if (seen.length === 1) break;
    }
  })();
  // Closing on a deadline, so a stream that never yields fails the assertion
  // below instead of hanging the run.
  const guard = setTimeout(() => stream.close(), 5_000);
  await reader;
  clearTimeout(guard);
  stream.close();

  assert.equal(seen.length, 1);
  assert.equal(seen[0].messageId, wantedReceipt.messageId);
  assert.equal(seen[0].source, "origin/source");
});

test("Given a destination on the sending node itself, when it is sent to, then the surface reports it settled without a binding to carry it", async (t) => {
  const { dialer } = await converged(t);

  const receipt = await dialer.send("origin/source", "origin/other", { a: 5 });

  assert.equal(receipt.nextHop.kind, "local");
  const settled = await settledWithin(dialer, receipt.messageId);
  assert.equal(settled.settled, true);
  assert.equal(settled.total, 1);
  assert.deepEqual(settled.outcomes, [{ kind: "delivered" }]);
});

test("Given a peer that goes away with a message in flight, when the binding dies, then the sender is told rather than left waiting", async (t) => {
  // Both batch bounds are held open, so no disposition can answer first and
  // the loss of the next hop is the only thing that can settle this message.
  // Pinning only the interval would leave the count bound to flush it anyway.
  const { dialer, listener } = await converged(t, {
    debounceMs: 60_000,
    maximumOutcomes: 1_000_000,
  });

  const receipt = await dialer.send("origin/source", "sink/service", { a: 6 });
  assert.equal(dialer.disposition(receipt.messageId).settled, false);

  await listener.stop();

  const settled = await settledWithin(dialer, receipt.messageId);
  assert.equal(settled.settled, true);
  assert.equal(settled.outstanding, 0);
  assert.deepEqual(settled.outcomes, [{ kind: "unknown" }]);
});
