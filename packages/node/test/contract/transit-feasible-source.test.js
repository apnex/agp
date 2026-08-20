import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
  dataMessage,
} from "../support/data-plane-harness.js";
import { selectedLocal } from "../support/fakes.js";

test("Given asymmetric reverse selection, when inbound source is checked, then exact-ingress feasibility authorizes it", async () => {
  let delivered = 0;
  const harness = createDataPlaneHarness();
  const destination = harness.expose("demo/destination", async () => {
    delivered += 1;
  });
  harness.installSelected(
    selectedLocal("demo/destination", destination.bindingId),
  );
  const ingress = harness.makeController({
    remoteNodeId: "ingress.example",
    controllerId: "ingress-controller",
  });
  const other = harness.makeController({
    remoteNodeId: "selected-reverse.example",
    owningSessionId: "000002",
    controllerId: "other-controller",
  });
  const message = dataMessage();
  // The selected reverse path is deliberately irrelevant to feasible RPF.
  harness.selected.set(message.body.source.endpoint, {
    ...selectedLocal(message.body.source.endpoint, "not-local"),
    sourceKind: "session",
    originNodeId: message.body.source.originNodeId,
    nextHop: {
      kind: "session",
      nodeId: other.remoteNodeId,
      owningSessionId: other.owningSessionId,
    },
  });
  harness.authorizeFeasible(ingress, message.body.source);

  await harness.plane.receive(ingress, message);
  await harness.handlers.drain();
  assert.equal(delivered, 1);

  const wrongIngress = harness.makeController({
    remoteNodeId: "wrong.example",
    owningSessionId: "000003",
    controllerId: "wrong-controller",
  });
  await harness.plane.receive(wrongIngress, {
    ...message,
    id: "incoming-2",
  });
  assert.equal(wrongIngress.controlWrites.length, 1);
  assert.equal(
    JSON.parse(wrongIngress.controlWrites[0]).body.code,
    "SOURCE_NOT_AUTHORIZED",
  );
});
