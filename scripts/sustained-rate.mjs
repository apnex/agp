import {
  GEOMETRIES,
  awaitConvergence,
  buildGeometry,
} from "../test/support/geometry.js";

// Sustained delivered messages per second, against the reverse-path label bound.
//
// This is not throughput.mjs. That script lifts `maxReverseCorrelations` to
// half a million so that what it measures is the carrier, and says so. The
// number it cannot report is what happens when the label table is left at a
// realistic size and the offered volume exceeds it, which is a different
// ceiling with a different cause.
//
// Before D23 a binding was released by a failure or by expiry and never by
// success, so a flow that never failed filled the table and the sustained rate
// was capacity divided by the retention window: about 136 messages a second at
// defaults against a burst ceiling near 2850. See MX7.
//
// The two columns are the same binary in the same process, seconds apart, and
// differ only by configuration:
//
//   held     the table is told to refuse rather than evict, and the batch
//            interval is pushed past the life of the run, so no disposition
//            returns and no binding is released by success. This reproduces
//            the pre-D23 behaviour without reverting the code.
//   released defaults, so a delivery releases its binding.
//
// Compare the columns to each other and never to a figure from another run or
// another day. See VERIFICATION.md section 4.9.
//
// Usage:
//   node scripts/sustained-rate.mjs
//   node scripts/sustained-rate.mjs --count=20000 --labels=512 --repeat=3

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const found = argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};
const COUNT = Number.parseInt(flag("count", "20000"), 10);
const LABELS = Number.parseInt(flag("labels", "512"), 10);
const REPEAT = Number.parseInt(flag("repeat", "3"), 10);
const PAYLOAD = { proof: "sustained", filler: "x".repeat(160) };

// Holding the arm open takes both bounds. Pinning only the interval leaves the
// count bound at its default of 256, which flushes the batch anyway and makes
// the two arms behave identically. That mistake is worth naming: it is the
// count bound doing exactly the job it exists for.
const ARMS = Object.freeze({
  held: {
    debounceMs: 60_000,
    maximumOutcomes: 1_000_000,
    onCapacity: "refuse",
  },
  released: { debounceMs: 50, maximumOutcomes: 256, onCapacity: "refuse" },
});

async function measure(arm) {
  const deliveries = [];
  const topology = await buildGeometry({
    geometry: GEOMETRIES.line(),
    transport: "loopback",
    endpointsPerNode: 1,
    deliveries,
    capacity: { maxReverseCorrelations: LABELS },
    disposition: ARMS[arm],
  });
  try {
    await awaitConvergence(topology);
    const from = topology.nodes[0];
    const source = topology.endpoints[0];
    const destination = topology.endpoints.at(-1);

    let admitted = 0;
    let refused = 0;
    const deadlineMs = 5_000;
    const started = performance.now();
    while (admitted < COUNT && performance.now() - started < deadlineMs) {
      try {
        await from.send(source, destination, PAYLOAD);
        admitted += 1;
      } catch (error) {
        if (error.code !== "QUEUE_FULL") throw error;
        refused += 1;
        // Yield so the reverse path can run. A tight retry loop measures the
        // retry loop rather than the node.
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    const elapsedMs = performance.now() - started;
    return {
      admitted,
      refused,
      elapsedMs,
      perSecond: Math.round((admitted / elapsedMs) * 1000),
    };
  } finally {
    await Promise.allSettled(topology.nodes.map((node) => node.stop()));
  }
}

const results = new Map();
for (const arm of Object.keys(ARMS)) {
  const runs = [];
  for (let attempt = 0; attempt < REPEAT; attempt += 1) {
    runs.push(await measure(arm));
  }
  results.set(arm, runs);
}

console.log(
  `line, loopback, ${LABELS} labels, up to ${COUNT} messages, `
    + `${REPEAT} runs per arm`,
);
console.log("");
console.log("arm       | admitted | refused | msg/s in window | best");
console.log("----------|----------|---------|-----------------|-----");
for (const [arm, runs] of results) {
  const best = Math.max(...runs.map((run) => run.perSecond));
  const median = runs.map((run) => run.perSecond).sort((a, b) => a - b)[
    Math.floor(runs.length / 2)
  ];
  const last = runs.at(-1);
  console.log(
    `${arm.padEnd(9)} | ${String(last.admitted).padStart(8)} | `
      + `${String(last.refused).padStart(7)} | ${String(median).padStart(15)} | `
      + `${String(best).padStart(4)}`,
  );
}
console.log("");
// The rate column understates how bad the held arm is, because it divides a
// fixed number of admissions by the length of the window rather than by the
// time they took. What the held arm actually shows is the admitted count: it
// stops at the label count exactly and then refuses everything, so its true
// sustained rate is the label count over the retention window and nothing the
// measurement window is set to will change it.
const held = results.get("held").at(-1);
if (held.admitted <= LABELS) {
  console.log(
    `held stopped at ${held.admitted} admissions against ${LABELS} labels: `
      + "the table fills once and never empties, so the sustained rate is "
      + `${LABELS} over the retention window and not the figure above.`,
  );
}
