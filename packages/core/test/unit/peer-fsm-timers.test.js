import test from "node:test";
import assert from "node:assert/strict";
import { establishedMachine } from "../fixtures/core-fixtures.js";

// Owns: protocol timer event outcomes, not scheduler accuracy.
test("given an Established controller, when protocol timers expire, then keepalive self-transitions and fatal deadlines teardown", () => {
  const live = establishedMachine();
  const keepalive = live.step({ type: "KeepaliveExpired" });
  assert.equal(keepalive.state.state, "Established");
  assert.equal(
    keepalive.actions.some((action) => action.type === "SendKeepalive"),
    true,
  );
  for (const type of ["HoldExpired", "RouteWriteExpired", "RouteAckExpired"]) {
    const machine = establishedMachine();
    const reduction = machine.step({ type });
    assert.equal(reduction.state.forwardable, false);
    assert.equal(
      reduction.actions.some((action) => action.type === "ScheduleRetry"),
      true,
    );
  }
});
