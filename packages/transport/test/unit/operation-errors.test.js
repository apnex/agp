import assert from "node:assert/strict";
import test from "node:test";
import {
  operationAborted,
  TransportOperationError,
} from "../../dist/index.js";

test("Given the closed transport operation matrix, when legal and illegal errors are constructed, then phase pairing and send acceptance are enforced", () => {
  const unknown = new TransportOperationError({
    code: "SEND_FAILED",
    phase: "send",
    acceptance: "unknown",
    message: "uncertain send",
  });
  assert.equal(unknown.acceptance, "unknown");
  assert.equal(operationAborted("send", "cancelled").acceptance, "not-accepted");
  assert.throws(
    () => new TransportOperationError({
      code: "LISTEN_FAILED",
      phase: "read",
      message: "illegal",
    }),
    /illegal transport operation error pairing/u,
  );
  assert.throws(
    () => new TransportOperationError({
      code: "PACKET_TOO_LARGE",
      phase: "send",
      message: "missing acceptance",
    }),
    /requires acceptance/u,
  );
});
