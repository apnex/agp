import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
  dataMessage,
} from "../support/data-plane-harness.js";
import { selectedSession } from "../support/fakes.js";

test("Given nonlocal input with transit disabled, when admission runs, then one ingress error and zero onward data are written", async () => {
  const harness = createDataPlaneHarness({ transitEnabled: false });
  const ingress = harness.makeController({
    remoteNodeId: "ingress.example",
    controllerId: "ingress-controller",
  });
  const egress = harness.makeController({
    remoteNodeId: "egress.example",
    owningSessionId: "000002",
    controllerId: "egress-controller",
  });
  const message = dataMessage();
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
  assert.equal(ingress.controlWrites.length, 1);
  assert.equal(
    JSON.parse(ingress.controlWrites[0]).body.code,
    "TRANSIT_DISABLED",
  );
});
