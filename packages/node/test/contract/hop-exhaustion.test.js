import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
  dataMessage,
} from "../support/data-plane-harness.js";
import { selectedSession } from "../support/fakes.js";

test("Given the last usable hop, when transit is attempted, then HOP_LIMIT_EXCEEDED is returned with no onward data", async () => {
  const harness = createDataPlaneHarness();
  const ingress = harness.makeController({
    remoteNodeId: "ingress.example",
    controllerId: "ingress-controller",
  });
  const egress = harness.makeController({
    remoteNodeId: "egress.example",
    owningSessionId: "000002",
    controllerId: "egress-controller",
  });
  const message = dataMessage({ hopLimit: 1 });
  harness.authorizeFeasible(ingress, message.body.source);
  harness.installSelected(
    selectedSession(
      message.body.destination,
      egress.remoteNodeId,
      egress.owningSessionId,
    ),
  );

  await harness.plane.receive(ingress, message);
  assert.equal(egress.dataWrites.length, 0);
  assert.equal(
    JSON.parse(ingress.controlWrites[0]).body.code,
    "HOP_LIMIT_EXCEEDED",
  );
});
