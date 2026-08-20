import assert from "node:assert/strict";
import test from "node:test";
import { createDataPlaneHarness } from "../support/data-plane-harness.js";
import { selectedLocal } from "../support/fakes.js";

test("Given selected local endpoints, when a local send is admitted, then one route revision and exact binding are used", async () => {
  let delivery;
  const harness = createDataPlaneHarness();
  const source = harness.expose("demo/source");
  const destination = harness.expose(
    "demo/destination",
    async (payload, context) => {
      delivery = { payload, context };
    },
  );
  harness.installSelected(
    selectedLocal("demo/source", source.bindingId),
  );
  harness.installSelected(
    selectedLocal("demo/destination", destination.bindingId),
  );

  const receipt = await harness.plane.send(
    "demo/source",
    "demo/destination",
    { hello: "world" },
  );
  await harness.handlers.drain();

  assert.equal(receipt.selectedRouteId, "route:demo/destination:local");
  assert.equal(receipt.operationsRevision, "1");
  assert.deepEqual(receipt.nextHop, {
    kind: "local",
    bindingId: destination.bindingId,
  });
  assert.deepEqual(delivery.payload, { hello: "world" });
  assert.equal(delivery.context.delivery.operationsRevision, "1");
});
