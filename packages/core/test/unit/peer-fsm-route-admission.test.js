import test from "node:test";
import assert from "node:assert/strict";
import { establishedMachine, route } from "../fixtures/core-fixtures.js";

// Owns: tokened route-admission continuation outcomes, not policy logic.
test("given a pending route continuation, when current stale and fault results arrive, then each exact disposition applies", () => {
  const machine = establishedMachine();
  machine.step({
    type: "RouteUpdateReceived",
    continuationToken: "route-1",
    updateId: "update-1",
    revision: 1,
    routes: [route("demo/a", "peer.a", ["peer.a"])],
  });
  const stale = machine.step({
    type: "RouteAdmissionResolved",
    continuationToken: "stale",
  });
  assert.equal(stale.ignored, true);
  const applied = machine.step({
    type: "RouteAdmissionResolved",
    continuationToken: "route-1",
    admissionResultValid: true,
    updateId: "update-1",
    revision: 1,
    rejected: [],
  });
  assert.equal(
    applied.actions.some((action) => action.type === "ApplyRouteSnapshot"),
    true,
  );
  const faulted = establishedMachine();
  faulted.step({
    type: "RouteUpdateReceived",
    continuationToken: "route-2",
    updateId: "update-2",
    revision: 1,
    routes: [],
  });
  assert.equal(faulted.step({ type: "AdmissionFaulted" }).state.forwardable, false);
});
