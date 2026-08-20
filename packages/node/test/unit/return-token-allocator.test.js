import assert from "node:assert/strict";
import test from "node:test";
import { Uint64ReturnTokenAllocator } from "../../dist/index.js";

test("Given the unsigned-64 terminal range, when tokens are allocated through its end, then no value repeats before exhaustion", () => {
  const allocator = new Uint64ReturnTokenAllocator(
    0xffff_ffff_ffff_fffen,
  );

  assert.deepEqual(allocator.allocate(), {
    kind: "token",
    token: "fffffffffffffffe",
  });
  assert.deepEqual(allocator.allocate(), {
    kind: "token",
    token: "ffffffffffffffff",
  });
  assert.deepEqual(allocator.allocate(), { kind: "exhausted" });
  assert.deepEqual(allocator.allocate(), { kind: "exhausted" });
  assert.deepEqual(allocator.snapshot(), {
    allocationCount: "2",
    exhausted: true,
    domainMaximum: "ffffffffffffffff",
  });
});

test("Given an injected smaller token domain, when its terminal values allocate, then fixed-width wire shape is preserved", () => {
  const allocator = new Uint64ReturnTokenAllocator(1n, 2n);

  assert.equal(allocator.allocate().token, "0000000000000001");
  assert.equal(allocator.allocate().token, "0000000000000002");
  assert.equal(allocator.allocate().kind, "exhausted");
});
