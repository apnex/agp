import test from "node:test";
import assert from "node:assert/strict";
import { establishedMachine } from "../fixtures/core-fixtures.js";

// Owns: the closed Established wire-type legality matrix, not payload routing.
test("given an Established controller, when v1 wire families arrive, then the symmetric closed matrix rejects only OPEN", () => {
  for (const type of [
    "KeepaliveReceived",
    "DataReceived",
    "DispositionReceived",
    "NotificationReceived",
  ]) {
    const machine = establishedMachine();
    const reduction = machine.step(
      type === "NotificationReceived"
        ? { type, notificationCode: "CEASE" }
        : { type },
    );
    assert.notEqual(reduction.actions[0]?.type, "SendNotification");
  }
  const machine = establishedMachine();
  const rejected = machine.step({ type: "OpenReceived" });
  assert.equal(rejected.actions[0]?.type, "SendNotification");
  assert.equal(rejected.actions[0]?.code, "UNEXPECTED_MESSAGE");
  assert.equal(rejected.state.forwardable, false);
});
