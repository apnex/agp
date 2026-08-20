import test from "node:test";
import assert from "node:assert/strict";
import { compareConnectionCandidates } from "../../dist/index.js";

// Owns: arrival-order-independent canonical physical winner.
test("given simultaneous cross-dial candidates, when either arrival order is compared, then the higher-node initiator wins", () => {
  const higherDial = {
    controllerId: "a",
    localNodeId: "node.z",
    remoteNodeId: "node.a",
    localSessionId: "000010",
    remoteSessionId: "000011",
    direction: "outbound",
  };
  const lowerDial = {
    controllerId: "b",
    localNodeId: "node.z",
    remoteNodeId: "node.a",
    localSessionId: "000020",
    remoteSessionId: "000021",
    direction: "inbound",
  };
  assert.ok(compareConnectionCandidates(higherDial, lowerDial) < 0);
  assert.ok(compareConnectionCandidates(lowerDial, higherDial) > 0);
});
