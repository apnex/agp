import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
  dataMessage,
} from "../support/data-plane-harness.js";

test("Given a feasible transit source with no destination route, when admitted, then one direct NO_ROUTE and zero onward data result", async () => {
  const harness = createDataPlaneHarness();
  const ingress = harness.makeController({
    remoteNodeId: "ingress.example",
    controllerId: "ingress-controller",
  });
  const possibleEgress = harness.makeController({
    remoteNodeId: "elsewhere.example",
    owningSessionId: "000002",
    controllerId: "egress-controller",
  });
  const message = dataMessage();
  harness.authorizeFeasible(ingress, message.body.source);

  await harness.plane.receive(ingress, message);
  assert.equal(possibleEgress.dataWrites.length, 0);
  assert.deepEqual(possibleEgress.writer.usage(), {
    dataMessages: 0,
    dataBytes: 0,
    controlMessages: 0,
  });
  assert.equal(ingress.controlWrites.length, 1);
  assert.equal(JSON.parse(ingress.controlWrites[0]).body.code, "NO_ROUTE");
});
