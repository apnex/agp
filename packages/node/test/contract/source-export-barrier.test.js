import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
} from "../support/data-plane-harness.js";
import {
  selectedLocal,
  selectedSession,
} from "../support/fakes.js";

test("Given a peer route, when its exact source identity is not ACKed, then send fails without hidden queuing", async () => {
  const harness = createDataPlaneHarness();
  const source = harness.expose("demo/source");
  harness.installSelected(selectedLocal("demo/source", source.bindingId));
  const peer = harness.makeController();
  harness.installSelected(
    selectedSession(
      "demo/destination",
      peer.remoteNodeId,
      peer.owningSessionId,
    ),
  );

  await assert.rejects(
    harness.plane.send("demo/source", "demo/destination", {}),
    { code: "SOURCE_NOT_ADVERTISED" },
  );
  assert.deepEqual(peer.dataWrites, []);
  assert.equal(harness.labelBindings.usage().entries, 0);

  harness.acknowledgeSource(peer, {
    endpoint: "demo/source",
    originNodeId: harness.nodeId,
  });
  await harness.plane.send("demo/source", "demo/destination", {});
  await peer.writer.drain();
  assert.equal(peer.dataWrites.length, 1);
});
