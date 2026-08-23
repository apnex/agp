import assert from "node:assert/strict";
import test from "node:test";
import {
  LabelTable,
  DispositionEngine,
} from "../../dist/index.js";
import { fakeController } from "../support/fakes.js";

function engineFor(ingress, held) {
  return new DispositionEngine({
    localNodeId: "middle.example",
    labelBindings: new LabelTable({
      maximumEntries: 4,
      maximumBytes: 1_024,
      onCapacity: "refuse",
    }, () => 0),
    batch: {
      debounceMs: 50,
      maximumOutcomes: 256,
      maximumInboundOutcomes: 4096,
    },
    monotonicNow: () => 1_000,
    nextMessageId: () => "disposition-1",
    schedule: (delayMs, callback) => {
      held.push({ delayMs, callback });
      return { cancel() {} };
    },
    encode: (message) => new TextEncoder().encode(JSON.stringify(message)),
    publishLocal() {
      assert.fail("an ingress failure report is not local delivery");
    },
    onWriteFailure(_controller, cause) {
      throw cause;
    },
  });
}

const refused = {
  agp: 1,
  plane: "data",
  type: "message",
  id: "data-1",
  body: {
    source: {
      endpoint: "demo/source",
      originNodeId: "origin.example",
    },
    destination: "missing/destination",
    returnToken: "0000000000000007",
    hopLimit: 3,
    payload: {},
  },
};

test("Given a current-node data failure, when its batch is sent, then one exact disposition writes directly to ingress", () => {
  const ingress = fakeController();
  const held = [];
  const engine = engineFor(ingress, held);

  engine.reportImmediateFailure(ingress, refused, "NO_ROUTE");
  engine.flush(ingress);

  assert.equal(ingress.controlWrites.length, 1);
  assert.deepEqual(JSON.parse(ingress.controlWrites[0]), {
    agp: 1,
    plane: "control",
    type: "disposition",
    id: "disposition-1",
    body: {
      failed: [{
        code: "NO_ROUTE",
        refId: "data-1",
        returnToken: "0000000000000007",
        failedAtNodeId: "middle.example",
        reason: "no selected route",
      }],
    },
  });
});

test("Given a current-node data failure, when nothing sends the batch, then ingress has not been written to yet", () => {
  const ingress = fakeController();
  const held = [];
  const engine = engineFor(ingress, held);

  engine.reportImmediateFailure(ingress, refused, "NO_ROUTE");

  // The report is owed, not sent. A failure now rides the same batch a
  // delivery does, so the debounce interval is what puts it on the wire.
  assert.equal(ingress.controlWrites.length, 0);
  assert.equal(held.length, 1);
  assert.equal(held[0].delayMs, 50);

  held[0].callback();
  assert.equal(ingress.controlWrites.length, 1);
});
