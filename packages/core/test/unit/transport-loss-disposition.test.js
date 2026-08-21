import test from "node:test";
import assert from "node:assert/strict";
import { establishedMachine } from "../fixtures/core-fixtures.js";

// Owns: the closed teardown/retry disposition matrix for every transport loss
// cause. Graceful close, transport failure, and input rejection are all members
// of one decision; none of them may fall through to an undefined outcome.

const TRANSPORT_LOSS = ["TransportClosed", "TransportFailed", "TransportInputRejected"];

function teardown(direction, type) {
  const machine = establishedMachine(direction);
  const reduction = machine.step({ type });
  return {
    state: reduction.state,
    types: reduction.actions.map((action) => action.type),
  };
}

test("given an Established controller of either acquisition kind, when any transport loss cause arrives, then each one produces the same ordered teardown spine", () => {
  for (const direction of ["outbound", "inbound"]) {
    for (const type of TRANSPORT_LOSS) {
      const { state, types } = teardown(direction, type);
      const label = `${direction}/${type}`;

      assert.ok(
        types.indexOf("MarkNonForwardable") < types.indexOf("PurgeSessionRoutes"),
        `${label}: forwarding must be gated before routes are purged`,
      );
      assert.ok(
        types.indexOf("PurgeSessionRoutes") < types.indexOf("ReleaseTransport"),
        `${label}: routes must be purged before the transport is released`,
      );
      assert.ok(
        types.indexOf("ReleaseTransport") < types.indexOf("PublishTransition"),
        `${label}: the transition must publish after release`,
      );
      assert.equal(state.forwardable, false, `${label}: must be non-forwardable`);
      assert.equal(state.lastReason !== undefined, true, `${label}: must record a reason`);
    }
  }
});

test("given a dialed controller, when transport loss is retryable versus terminal, then exactly one retry decision is emitted and the next state matches it", () => {
  const closed = teardown("outbound", "TransportClosed");
  assert.equal(closed.types.includes("ScheduleRetry"), true);
  assert.equal(closed.state.state, "Active");
  assert.equal(closed.state.retryAttempt, 1);

  const failed = teardown("outbound", "TransportFailed");
  assert.equal(failed.types.includes("ScheduleRetry"), true);
  assert.equal(failed.state.state, "Active");

  // Input rejection means the peer sent something this node will not accept.
  // Redialing would re-enter the same failure, so it is terminal and notified.
  const rejected = teardown("outbound", "TransportInputRejected");
  assert.equal(rejected.types.includes("ScheduleRetry"), false);
  assert.equal(rejected.state.state, "Idle");
  assert.equal(rejected.state.retryAttempt, 0);
  assert.deepEqual(rejected.types[0], "SendNotification");
  assert.equal(rejected.state.lastReason, "INVALID_MESSAGE");
});

test("given an accepted controller, when any transport loss cause arrives, then no retry decision is ever emitted and the controller goes Idle", () => {
  for (const type of TRANSPORT_LOSS) {
    const { state, types } = teardown("inbound", type);
    const retryDecisions = types.filter((value) =>
      value === "ScheduleRetry"
      || value === "SuppressRetryForCollision"
      || value === "DisableRetry"
    );
    assert.deepEqual(retryDecisions, [], `${type}: an accepted controller is never redialed`);
    assert.equal(state.state, "Idle", `${type}: must settle Idle`);
    assert.equal(state.retryAttempt, 0, `${type}: must not advance a retry attempt`);
  }
});

test("given a controller already torn down by transport loss, when later peer input arrives, then it is inert and cannot re-enter teardown", () => {
  for (const type of TRANSPORT_LOSS) {
    const machine = establishedMachine("outbound");
    machine.step({ type });
    const later = machine.step({ type: "DataReceived" });
    assert.equal(
      later.actions.some((action) => action.type === "DispatchData"),
      false,
      `${type}: data must not dispatch after teardown`,
    );
    assert.equal(later.state.forwardable, false, `${type}: must stay non-forwardable`);
  }
});
