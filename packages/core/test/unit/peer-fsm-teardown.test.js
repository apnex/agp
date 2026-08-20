import test from "node:test";
import assert from "node:assert/strict";
import { establishedMachine } from "../fixtures/core-fixtures.js";

// Owns: fatal teardown ordering and post-fatal non-forwardability.
test("given an Established controller, when fatal input arrives, then forwarding is gated before purge and release", () => {
  const machine = establishedMachine();
  const reduction = machine.step({ type: "InvalidMessage" });
  const types = reduction.actions.map((action) => action.type);
  assert.ok(types.indexOf("MarkNonForwardable") < types.indexOf("PurgeSessionRoutes"));
  assert.ok(types.indexOf("PurgeSessionRoutes") < types.indexOf("ReleaseTransport"));
  assert.equal(reduction.state.forwardable, false);
  const later = machine.step({ type: "DataReceived" });
  assert.equal(
    later.actions.some((action) => action.type === "DispatchData"),
    false,
  );
  assert.equal(later.state.forwardable, false);
});
