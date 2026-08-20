import assert from "node:assert/strict";
import test from "node:test";
import {
  isTransportOperationError,
  isTransportRef,
  runPacketOrderCase,
  runTerminalOnceCase,
  TransportOperationError,
} from "../../dist/index.js";

test("Given an isolated consumer of the neutral package, when public runtime capabilities are inspected, then no concrete carrier is required or exposed", () => {
  assert.equal(typeof runPacketOrderCase, "function");
  assert.equal(typeof runTerminalOnceCase, "function");
  assert.equal(typeof TransportOperationError, "function");
  assert.equal(isTransportRef("alpha.peer"), true);
  assert.equal(isTransportRef("ws://alpha"), false);
  assert.equal(
    isTransportOperationError(new TransportOperationError({
      code: "CONNECT_FAILED",
      phase: "connect",
      message: "failed",
    })),
    true,
  );
});
