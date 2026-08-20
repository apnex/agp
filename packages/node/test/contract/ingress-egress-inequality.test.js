import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
  dataMessage,
} from "../support/data-plane-harness.js";
import { selectedSession } from "../support/fakes.js";

test("Given a FIB that points back to exact ingress, when transit is admitted, then ingress is never used as egress", async () => {
  const harness = createDataPlaneHarness();
  const ingress = harness.makeController({
    remoteNodeId: "peer.example",
    controllerId: "controller-1",
  });
  const message = dataMessage();
  harness.authorizeFeasible(ingress, message.body.source);
  harness.installSelected(
    selectedSession(
      message.body.destination,
      ingress.remoteNodeId,
      ingress.owningSessionId,
    ),
  );

  await harness.plane.receive(ingress, message);
  assert.equal(ingress.dataWrites.length, 0);
  assert.equal(
    JSON.parse(ingress.controlWrites[0]).body.code,
    "NEXT_HOP_UNAVAILABLE",
  );
});
