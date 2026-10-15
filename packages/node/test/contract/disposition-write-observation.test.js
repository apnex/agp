import assert from "node:assert/strict";
import test from "node:test";
import { DispositionEngine, LabelTable } from "../../dist/index.js";
import { fakeController } from "../support/fakes.js";

// Owns rejection-handler registration at the exact-controller write boundary.
// The write fulfills: this checks observation wiring, not failure recovery or
// process survival after a rejected write.
for (const flushMode of ["explicit", "all", "timer", "count"]) {
  test(`Given a successful disposition write, when the ${flushMode} flush path sends it, then rejection observation is registered before the flush returns`, async () => {
    const controller = fakeController();
    const writeCompletion = Promise.resolve();
    const observeCompletion = writeCompletion.then.bind(writeCompletion);
    const rejectionHandlers = [];
    writeCompletion.then = (onFulfilled, onRejected) => {
      rejectionHandlers.push(onRejected);
      return observeCompletion(onFulfilled, onRejected);
    };
    controller.writeControl = (packet) => {
      controller.controlWrites.push(new TextDecoder().decode(packet));
      return writeCompletion;
    };

    let flushTimer;
    const writeFailures = [];
    const engine = new DispositionEngine({
      localNodeId: "local.example",
      labelBindings: new LabelTable({
        maximumEntries: 4,
        maximumBytes: 1_024,
        onCapacity: "refuse",
      }, () => 0),
      batch: {
        debounceMs: 50,
        maximumOutcomes: flushMode === "count" ? 1 : 256,
        maximumInboundOutcomes: 4096,
      },
      monotonicNow: () => 0,
      nextMessageId: () => "disposition-write-1",
      schedule: (_delayMs, callback) => {
        flushTimer = callback;
        return { cancel() {} };
      },
      encode: (message) => new TextEncoder().encode(JSON.stringify(message)),
      publishLocal() {
        assert.fail("an outbound disposition must not publish locally");
      },
      onWriteFailure(failedController, cause) {
        writeFailures.push({ controller: failedController, cause });
      },
    });

    engine.reportDelivered(controller, "0000000000000001");
    if (flushMode === "explicit") engine.flush(controller);
    if (flushMode === "all") engine.flushAll();
    if (flushMode === "timer") {
      assert.equal(typeof flushTimer, "function");
      flushTimer();
    }

    assert.equal(controller.controlWrites.length, 1);
    assert.equal(rejectionHandlers.length, 1);
    assert.equal(typeof rejectionHandlers[0], "function");
    assert.deepEqual(JSON.parse(controller.controlWrites[0]).body, {
      delivered: [{ from: "0000000000000001", to: "0000000000000001" }],
    });
    await writeCompletion;
    assert.deepEqual(writeFailures, []);
  });
}
