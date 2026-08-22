import assert from "node:assert/strict";
import test from "node:test";

import { compareUtf8 } from "../../dist/index.js";

// Owns: that canonical ordering is UTF-8 byte order, whichever path computes it.
//
// Canonical collections are ordered so two readers of the same revision see the
// same sequence. The comparator has a fast path for the common case where both
// operands are ASCII, and a fast path that disagrees with the slow one would
// reorder canonical state depending on its content, which is the kind of fault
// that surfaces as an unreproducible diff rather than as an error.

const encoder = new TextEncoder();

/** The definition the comparator must agree with, computed the slow way. */
function byUtf8Bytes(left, right) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

const CORPUS = [
  "", "a", "b", "ab", "abc", "A", "Z", "z",
  "0", "9", "/", ":", "-", "_", ".",
  "node.a", "node.b", "node.a/ep0", "node.a/ep1", "node.ab",
  "message-000001", "message-000002", "message-1",
  // Above ASCII, where UTF-16 code-unit order and UTF-8 byte order can differ.
  "\u00e9", "e\u0301", "\u00ff", "\u0100", "\u07ff", "\u0800", "\ufffd",
  // A supplementary character. Its surrogate pair sorts below U+E000 by code
  // unit and above it by UTF-8 byte, which is exactly why a naive comparison
  // cannot be used for every input.
  "\u{10000}", "\u{1f600}", "\ue000", "\uffff",
  "caf\u00e9", "cafe", "caf",
];

test("Given any pair in the corpus, when the comparator runs, then it agrees in sign with UTF-8 byte order", () => {
  for (const left of CORPUS) {
    for (const right of CORPUS) {
      assert.equal(
        Math.sign(compareUtf8(left, right)),
        Math.sign(byUtf8Bytes(left, right)),
        `compareUtf8(${JSON.stringify(left)}, ${JSON.stringify(right)})`,
      );
    }
  }
});

test("Given the corpus sorted by the comparator, when it is compared with a byte sort, then the sequences are identical", () => {
  assert.deepEqual(
    [...CORPUS].sort(compareUtf8),
    [...CORPUS].sort(byUtf8Bytes),
  );
});

test("Given a supplementary character beside one below it in UTF-8, when they are ordered, then code-unit order is not used", () => {
  // U+FFFF encodes as ef bf bf and U+10000 as f0 90 80 80, so the
  // supplementary character sorts after. By UTF-16 code unit it sorts before,
  // because its lead surrogate is D800.
  assert.ok(compareUtf8("\uffff", "\u{10000}") < 0);
  assert.ok("\uffff" > "\u{10000}", "the naive comparison disagrees, as expected");
});

test("Given equal strings and prefixes, when they are ordered, then equality is zero and a prefix sorts first", () => {
  assert.equal(compareUtf8("same", "same"), 0);
  assert.equal(compareUtf8("", ""), 0);
  assert.ok(compareUtf8("caf", "cafe") < 0);
  assert.ok(compareUtf8("cafe", "caf") > 0);
  assert.ok(compareUtf8("", "a") < 0);
});
