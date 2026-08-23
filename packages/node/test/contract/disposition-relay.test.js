import assert from "node:assert/strict";
import test from "node:test";
import {
  LabelTable,
  DispositionEngine,
} from "../../dist/index.js";
import {
  labelBinding,
  fakeController,
} from "../support/fakes.js";

function scenario() {
  const ingress = fakeController({
    remoteNodeId: "upstream.example",
    owningSessionId: "000001",
  });
  const egress = fakeController({
    remoteNodeId: "downstream.example",
    owningSessionId: "000002",
  });
  const store = new LabelTable({
    maximumEntries: 4,
    maximumBytes: 1_024,
    onCapacity: "refuse",
  }, () => 0);
  const engine = new DispositionEngine({
    localNodeId: "middle.example",
    labelBindings: store,
    batch: {
      debounceMs: 50,
      maximumOutcomes: 256,
      maximumInboundOutcomes: 4096,
    },
    monotonicNow: () => 1_000,
    nextMessageId: () => "relay-1",
    schedule: () => ({ cancel() {} }),
    encode: (message) => new TextEncoder().encode(JSON.stringify(message)),
    publishLocal() {
      assert.fail("a transit binding must not publish locally");
    },
    onWriteFailure(_controller, cause) {
      throw cause;
    },
  });
  const bind = (messageId, outbound, upstream) => {
    store.add(labelBinding({
      egress,
      messageId,
      outboundReturnToken: outbound,
      ingress: {
        kind: "session",
        controller: ingress,
        nodeId: ingress.remoteNodeId,
        owningSessionId: ingress.owningSessionId,
        upstreamReturnToken: upstream,
      },
    }), 100);
  };
  return { ingress, egress, store, engine, bind };
}

test("Given a transit binding, when a failure returns, then relay uses recorded ingress and translates only hop-local identity", () => {
  const { ingress, egress, engine, bind } = scenario();
  bind("data-1", "000000000000000b", "000000000000000a");

  const settled = engine.receive(egress, {
    agp: 1,
    plane: "control",
    type: "disposition",
    id: "downstream-disposition",
    body: {
      failed: [{
        code: "NO_ROUTE",
        refId: "data-1",
        returnToken: "000000000000000b",
        failedAtNodeId: "failure.example",
        reason: "no selected route",
      }],
    },
  });
  assert.deepEqual(settled.map((entry) => entry.kind), ["relayed"]);

  engine.flush(ingress);
  const relayed = JSON.parse(ingress.controlWrites[0]);
  assert.equal(relayed.id, "relay-1");
  assert.deepEqual(relayed.body.failed, [{
    code: "NO_ROUTE",
    refId: "data-1",
    // The only field the hop rewrites: the label the upstream peer knows.
    returnToken: "000000000000000a",
    failedAtNodeId: "failure.example",
    reason: "no selected route",
  }]);
});

test("Given a transit binding, when a delivery returns, then the binding releases and the delivery relays under the upstream label", () => {
  const { ingress, egress, store, engine, bind } = scenario();
  bind("data-1", "000000000000000b", "000000000000000a");
  assert.equal(store.usage().entries, 1);

  const settled = engine.receive(egress, {
    agp: 1,
    plane: "control",
    type: "disposition",
    id: "downstream-disposition",
    body: {
      delivered: [{ from: "000000000000000b", to: "000000000000000b" }],
    },
  });
  assert.deepEqual(settled.map((entry) => entry.kind), ["relayed"]);
  // The whole point of D23: success releases the binding, not only failure.
  assert.equal(store.usage().entries, 0);

  engine.flush(ingress);
  const relayed = JSON.parse(ingress.controlWrites[0]);
  assert.deepEqual(relayed.body, {
    delivered: [{ from: "000000000000000a", to: "000000000000000a" }],
  });
  assert.equal(relayed.body.failed, undefined);
});

test("Given several bound labels, when their deliveries return, then the relayed batch compresses them to one run", () => {
  const { ingress, egress, store, engine, bind } = scenario();
  bind("data-1", "0000000000000010", "0000000000000001");
  bind("data-2", "0000000000000011", "0000000000000002");
  bind("data-3", "0000000000000012", "0000000000000003");

  engine.receive(egress, {
    agp: 1,
    plane: "control",
    type: "disposition",
    id: "downstream-disposition",
    body: {
      delivered: [{ from: "0000000000000010", to: "0000000000000012" }],
    },
  });
  assert.equal(store.usage().entries, 0);

  engine.flush(ingress);
  assert.deepEqual(JSON.parse(ingress.controlWrites[0]).body, {
    delivered: [{ from: "0000000000000001", to: "0000000000000003" }],
  });
});

test("Given a range wider than the inbound bound, when it arrives, then nothing settles and the session is answered as a violation", () => {
  const { egress, store, engine, bind } = scenario();
  bind("data-1", "0000000000000010", "0000000000000001");

  const settled = engine.receive(egress, {
    agp: 1,
    plane: "control",
    type: "disposition",
    id: "hostile",
    body: {
      // Fifty bytes to write, and the whole label domain to read.
      delivered: [{ from: "0000000000000000", to: "ffffffffffffffff" }],
    },
  });

  assert.deepEqual(settled.map((entry) => entry.kind), ["invalid-ref"]);
  assert.equal(egress.terminationReason(), "INVALID_MESSAGE");
  // Measured before anything was applied, so the batch had no partial effect.
  assert.equal(store.usage().entries, 1);
});
