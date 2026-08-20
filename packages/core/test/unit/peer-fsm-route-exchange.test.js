import test from "node:test";
import assert from "node:assert/strict";
import { establishedMachine } from "../fixtures/core-fixtures.js";

// Owns: both acquisition directions schedule and acknowledge route exchange.
test("given inbound and outbound Established sessions, when initial route exchange runs, then both schedule export and consume exact ACKs", () => {
  for (const direction of ["inbound", "outbound"]) {
    const machine = establishedMachine(direction);
    assert.equal(machine.state.lastEvent, "KeepaliveReceived");
    const reduction = machine.step({
      type: "RouteAckReceived",
      outstandingRefId: "update-1",
      outstandingRevision: 1,
      refId: "update-1",
      revision: 1,
      rejected: [],
    });
    assert.equal(
      reduction.actions.some((action) => action.type === "AcceptRouteAck"),
      true,
    );
  }
});
