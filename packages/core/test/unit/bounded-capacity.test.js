import test from "node:test";
import assert from "node:assert/strict";
import { BoundedCapacity, ResourceLedger } from "../../dist/index.js";

// Owns: generic count/byte and multi-resource reservations, not route policy.
test("given finite count byte and resource limits, when reservations succeed or fail, then accounting is atomic and release is idempotent", () => {
  const capacity = new BoundedCapacity({
    maximumMessages: 1,
    maximumBytes: 8,
  });
  const reservation = capacity.tryReserve(1, 8);
  assert.notEqual(reservation, undefined);
  assert.equal(capacity.tryReserve(1, 1), undefined);
  reservation.release();
  reservation.release();
  assert.equal(capacity.snapshot().currentMessages, "0");

  const ledger = new ResourceLedger({ routes: 1, bytes: 2 });
  assert.equal(ledger.tryReserve({ routes: 1, bytes: 3 }), undefined);
  assert.equal(ledger.snapshot("routes").current, "0");
});
