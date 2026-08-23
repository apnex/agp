import { readFileSync } from "node:fs";

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

/**
 * Processor clock sampler.
 *
 * A quiet machine is not a comparable one. On a host whose governor scales
 * frequency, a run can begin at turbo and finish near the floor, and two runs
 * minutes apart then differ by more than any change being measured. Measured
 * on the development host, one run spanned 4200 MHz to 800 MHz, which is
 * enough on its own to reorder three carriers.
 *
 * Sampling it does not fix it. It makes a figure quotable or not quotable,
 * which is the part that was missing when three attempts produced three
 * orderings and the machine was blamed for being busy.
 */
export function sampleCpuClock({ intervalMs = 250 } = {}) {
  const samples = [];
  const read = () => {
    try {
      const text = readFileSync("/proc/cpuinfo", "utf8");
      const values = [...text.matchAll(/cpu MHz\s*:\s*([\d.]+)/g)]
        .map((match) => Number(match[1]));
      if (values.length > 0) {
        samples.push(values.reduce((sum, v) => sum + v, 0) / values.length);
      }
    } catch {
      // No /proc/cpuinfo. The figure is simply unqualified rather than wrong.
    }
  };
  read();
  const handle = setInterval(read, intervalMs);
  handle.unref?.();
  return {
    stop() {
      clearInterval(handle);
      read();
      if (samples.length === 0) return undefined;
      const min = Math.round(Math.min(...samples));
      const max = Math.round(Math.max(...samples));
      const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
      return {
        samples: samples.length,
        minMhz: min,
        maxMhz: max,
        // Absolute, because the swing that reorders carriers happens between
        // invocations rather than inside one. A run steady at 4 GHz and a run
        // steady at 1.5 GHz each look perfectly stable from the inside.
        meanMhz: Math.round(mean),
        spread: min === 0 ? 0 : Number((max / min).toFixed(2)),
      };
    },
  };
}
