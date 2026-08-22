/**
 * Event-loop lag sampler.
 *
 * Separates "our code was slow" from "our code never got scheduled". Without
 * it, every latency number in a single-process topology is ambiguous: four
 * nodes sharing one loop can starve each other, and the resulting delay looks
 * identical to a slow code path.
 *
 * The sampler measures how late a zero-delay timer actually fires. That lateness
 * is the floor under every other duration measured while it runs.
 */
export function sampleLoopLag({ intervalMs = 1 } = {}) {
  let count = 0;
  let maxUs = 0;
  let totalUs = 0;
  let previous = process.hrtime.bigint();

  // A fixed-rate timer rather than a self-rearming one. A timer that re-arms
  // only after it fires stops sampling exactly when the loop is busiest, so it
  // reports few samples and understates the stall it exists to detect. An
  // interval keeps its schedule, and the lateness of each fire is the lag.
  const handle = setInterval(() => {
    const now = process.hrtime.bigint();
    const observedUs = Number(now - previous) / 1000;
    previous = now;
    const lateUs = Math.max(0, observedUs - intervalMs * 1000);
    count += 1;
    totalUs += lateUs;
    if (lateUs > maxUs) maxUs = lateUs;
  }, intervalMs);
  handle.unref?.();

  return {
    stop() {
      clearInterval(handle);
      return {
        samples: count,
        maxUs: Math.round(maxUs),
        meanUs: count === 0 ? 0 : Math.round(totalUs / count),
      };
    },
  };
}

/** Summarise a set of observed durations without pulling in a dependency. */
export function summarise(samplesUs) {
  if (samplesUs.length === 0) return { count: 0 };
  const sorted = [...samplesUs].sort((left, right) => left - right);
  const at = (fraction) =>
    Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]);
  return {
    count: sorted.length,
    minUs: Math.round(sorted[0]),
    p50Us: at(0.5),
    p99Us: at(0.99),
    maxUs: Math.round(sorted.at(-1)),
    meanUs: Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
  };
}
