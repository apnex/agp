import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitFullConvergence,
  buildChain,
  deepen,
  streamMessages,
} from "../support/topology-builders.js";

// Owns: sustained traffic across a transit hop. Every other live test admits a
// single message, which proves a path resolves but says nothing about what
// happens when many messages traverse it: ordering under repeated admission,
// labelBinding allocation and release, return-token cycling, and whether bounded
// resources return to their baseline.
//
// Volume is the dimension this file varies. AGP_DEEPEN_STREAM raises it.
// Ordering is a property of a transit hop rather than of a shape, so one
// geometry carries this and the register excludes the rest under X5.

const BASE = "chain0/ep0";
const FAR = "chain2/ep0";

async function convergedLine(context, deliveries) {
  const chain = await buildChain({ length: 3, deliveries, context });
  await awaitFullConvergence(chain);
  return chain;
}

function resources(node) {
  const snapshot = node.operations.snapshot();
  return {
    labelBindings: snapshot.labelBindings.length,
    handlers: snapshot.resources.handlers?.current ?? 0,
  };
}

test("given a converged transit hop, when many messages stream across it, then every one arrives exactly once in send order", async (context) => {
  const count = deepen("stream", 60);
  const deliveries = [];
  const chain = await convergedLine(context, deliveries);

  const { receipts, arrived } = await streamMessages({
    from: chain.nodes[0],
    source: BASE,
    destination: FAR,
    count,
    deliveries,
  });

  assert.equal(receipts.length, count, "every send must be admitted");
  assert.equal(arrived.length, count, "every message must arrive exactly once");
  assert.deepEqual(
    arrived,
    Array.from({ length: count }, (_, ordinal) => ordinal),
    "arrival order must equal send order across the transit node",
  );
  assert.equal(
    new Set(receipts.map(({ messageId }) => messageId)).size,
    count,
    "no message identity may repeat",
  );
  for (const receipt of receipts) {
    assert.equal(receipt.nextHop.nodeId, "chain.1");
  }
});

test("given a stream that has fully drained, when bounded resources are sampled, then handler capacity returns to baseline and labelBindings stay within their bound", async (context) => {
  const count = deepen("stream", 60);
  const deliveries = [];
  const chain = await convergedLine(context, deliveries);
  const [origin, transit, destination] = chain.nodes;
  const baseline = [origin, transit, destination].map(resources);

  await streamMessages({
    from: origin,
    source: BASE,
    destination: FAR,
    count,
    deliveries,
  });

  // A labelBinding is expiring, not delivery-consumed: it must outlive a
  // successful send so a later downstream error can still resolve against it.
  // The property is therefore boundedness, not a return to zero. Handler
  // capacity is reserved per delivery and must return.
  const limit = origin.operations.snapshot().configuration
    .effective.capacity.maxLabelBindings;
  for (const [index, node] of [origin, transit, destination].entries()) {
    const after = resources(node);
    assert.ok(
      after.labelBindings <= limit,
      `node ${index} exceeded its labelBinding bound: ${after.labelBindings} > ${limit}`,
    );
    assert.equal(
      after.handlers,
      baseline[index].handlers,
      `node ${index} retained handler capacity after the stream drained`,
    );
  }
});

test("given a converged transit hop, when both edges stream simultaneously, then each direction preserves its own order independently", async (context) => {
  const count = deepen("stream", 30);
  const deliveries = [];
  const chain = await convergedLine(context, deliveries);

  const [forward, reverse] = await Promise.all([
    streamMessages({
      from: chain.nodes[0],
      source: BASE,
      destination: FAR,
      count,
      deliveries,
    }),
    streamMessages({
      from: chain.nodes[2],
      source: FAR,
      destination: BASE,
      count,
      deliveries,
    }),
  ]);

  const ordinals = Array.from({ length: count }, (_, ordinal) => ordinal);
  assert.deepEqual(forward.arrived, ordinals, "forward order must be preserved");
  assert.deepEqual(reverse.arrived, ordinals, "reverse order must be preserved");
});
