import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitFullConvergence,
  buildChain,
  burstMessages,
  deepen,
} from "../support/topology-builders.js";
import { eventually } from "../support/uniform-topology.js";

// Owns: concurrent admission against a bound, through the whole stack.
//
// A stream admits one message at a time, so capacity is never contended. A
// burst fires every send at once, which is the only way to reach a bound from
// the public API rather than by holding a reservation at a barrier. The
// resilience suite proves exact saturation with one slot held open; this proves
// the behavior a caller actually sees when many sends compete.
//
// Concurrency is the dimension this file varies. AGP_DEEPEN_BURST raises it.

const NEAR = "chain0/ep0";
const FAR = "chain2/ep0";

async function convergedLine(context, deliveries, capacity, disposition) {
  const chain = await buildChain({
    length: 3,
    deliveries,
    context,
    capacity,
    ...(disposition === undefined ? {} : { disposition }),
  });
  await awaitFullConvergence(chain);
  return chain;
}

test("given a converged transit hop, when many sends are issued concurrently, then every one reaches a definite outcome and no admitted message is lost", async (context) => {
  const count = deepen("burst", 40);
  const deliveries = [];
  const chain = await convergedLine(context, deliveries);

  const { admitted, rejected, arrived } = await burstMessages({
    from: chain.nodes[0],
    source: NEAR,
    destination: FAR,
    count,
    deliveries,
  });

  // Nothing may hang. A send either produced a receipt or a typed rejection.
  assert.equal(
    admitted.length + rejected.length,
    count,
    "every concurrent send must settle",
  );
  assert.equal(
    arrived.length,
    admitted.length,
    "every admitted message must arrive exactly once",
  );
  assert.equal(
    new Set(arrived).size,
    arrived.length,
    "no admitted message may be delivered twice",
  );
  for (const receipt of admitted) {
    assert.equal(receipt.nextHop.nodeId, "chain.1");
  }
});

test("given capacity smaller than the burst, when the bound is reached, then excess sends fail QUEUE_FULL promptly rather than waiting", async (context) => {
  const count = deepen("burst", 40);
  const deliveries = [];
  // The labelBinding bound is the one that reliably fills, but since D23 a
  // successful send no longer leaves a binding behind: the disposition that
  // returns releases it. So the bound is held open deliberately here, by
  // telling the table to refuse rather than evict and by pushing the batch
  // interval past the life of the test. What is under test is that reaching a
  // bound produces a prompt typed rejection rather than a hang, and that is
  // still worth gating whichever bound it is.
  const chain = await convergedLine(context, deliveries, {
    maxLabelBindings: 8,
  }, { debounceMs: 60_000, onCapacity: "refuse" });

  const started = performance.now();
  const { admitted, rejected, arrived } = await burstMessages({
    from: chain.nodes[0],
    source: NEAR,
    destination: FAR,
    count,
    deliveries,
  });
  const elapsed = performance.now() - started;

  assert.equal(admitted.length + rejected.length, count);
  assert.ok(rejected.length > 0, "a burst past the bound must reject something");
  for (const failure of rejected) {
    assert.equal(
      failure.code,
      "QUEUE_FULL",
      `rejection carried ${failure.code} rather than a capacity code`,
    );
    assert.equal(failure.retryable, true, "capacity rejection is retryable");
  }
  // Rejection is immediate rather than a queued wait for a slot.
  assert.ok(elapsed < 20_000, `burst took ${Math.round(elapsed)}ms to settle`);
  assert.equal(arrived.length, admitted.length, "admitted messages still deliver");
});

test("given a burst that has fully drained, when the node is sampled, then handler capacity is released and the control plane stayed responsive", async (context) => {
  const count = deepen("burst", 40);
  const deliveries = [];
  const chain = await convergedLine(context, deliveries, {
    maxLabelBindings: 8,
  });
  const [origin, , destination] = chain.nodes;
  const baseline = destination.operations.snapshot().resources.handlers?.current ?? 0;

  await burstMessages({
    from: origin,
    source: NEAR,
    destination: FAR,
    count,
    deliveries,
  });

  await eventually(
    () => (destination.operations.snapshot().resources.handlers?.current ?? 0) === baseline,
    "handler capacity returns to baseline after the burst drains",
  );

  // Data saturation must not starve routing. A fresh endpoint still converges
  // across the transit node after the burst.
  const binding = await destination.expose("chain2/after-burst", async () => {});
  context.after(() => binding.close().catch(() => undefined));
  await eventually(
    () => origin.operations.routes().selected
      .some((route) => route.endpoint === "chain2/after-burst"),
    "the control plane still converges a new endpoint after saturation",
  );
});
