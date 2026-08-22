import assert from "node:assert/strict";
import test from "node:test";

import { LatencyRecorder } from "../../dist/index.js";

// Owns: the one primitive every measured duration in AGP reports through.
//
// It exists so a timing added later reuses a shape rather than inventing
// another pair of fields, which is why its behaviour is pinned here rather
// than left implicit in whichever caller happened to be written first.

test("Given nothing measured, when the sample is read, then it reports nothing rather than a zero that looks measured", () => {
  const recorder = new LatencyRecorder();

  assert.equal(recorder.observed, false);
  assert.equal(
    recorder.sample,
    undefined,
    "an unobserved timing must be absent, because zero is a measurement",
  );
});

test("Given several durations, when the sample is read, then it carries the count, the last, and the highest", () => {
  const recorder = new LatencyRecorder();

  recorder.record(12);
  recorder.record(40);
  recorder.record(7);

  assert.deepEqual(recorder.sample, {
    count: "3",
    lastUs: 7,
    highWaterUs: 40,
  });
});

test("Given a count alongside a high-water mark, when both are read, then the count is present so the mark can be weighed", () => {
  const sparse = new LatencyRecorder();
  const dense = new LatencyRecorder();

  sparse.record(100);
  for (let sample = 0; sample < 500; sample += 1) dense.record(100);

  // Identical marks, different confidence. A reader that cannot tell these
  // apart will over-trust the one drawn from a single observation.
  assert.equal(sparse.sample.highWaterUs, dense.sample.highWaterUs);
  assert.notEqual(sparse.sample.count, dense.sample.count);
});

test("Given an impossible duration, when it is offered, then it is refused rather than recorded", () => {
  const recorder = new LatencyRecorder();

  recorder.record(-1);
  recorder.record(Number.NaN);
  recorder.record(Number.POSITIVE_INFINITY);

  assert.equal(
    recorder.sample,
    undefined,
    "a negative or non-finite duration is not an observation",
  );

  recorder.record(0);
  assert.deepEqual(recorder.sample, { count: "1", lastUs: 0, highWaterUs: 0 });
});

test("Given a returned sample, when a caller tries to alter it, then the projection cannot be rewritten by its reader", () => {
  const recorder = new LatencyRecorder();
  recorder.record(5);
  const sample = recorder.sample;

  assert.throws(() => {
    sample.lastUs = 9999;
  });
  assert.equal(recorder.sample.lastUs, 5);
});
