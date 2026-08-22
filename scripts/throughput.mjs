import {
  GEOMETRIES,
  awaitConvergence,
  buildGeometry,
} from "../test/support/geometry.js";
import { sampleLoopLag } from "../test/support/loop-lag.js";
import { eventually } from "../test/support/uniform-topology.js";

// Delivered messages per second, per carrier, against Loopback.
//
// This is not the latency ladder. The ladder awaits each send and so measures
// what one message costs when nothing is queued, which is a latency figure
// wearing throughput units. A ceiling needs the pipeline kept full, so this
// offers messages as fast as admission accepts them and retries the ones the
// queue refuses.
//
// Loopback is the baseline because it is a real transport that still encodes,
// validates and parses every packet, but hands the bytes over in process. The
// difference between it and a socket carrier is therefore what the carrier
// costs, and Loopback itself is the node's own ceiling.
//
// Every figure here is one process on one machine. Compare the columns to each
// other, never to a figure from another run or another day. See
// VERIFICATION.md section 4.9.
//
// Usage:
//   node scripts/throughput.mjs
//   node scripts/throughput.mjs --count=4000 --repeat=5
//   node scripts/throughput.mjs --hops=2

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const found = argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};
const COUNT = Number.parseInt(flag("count", "3000"), 10);
const REPEAT = Number.parseInt(flag("repeat", "3"), 10);
const HOPS = Number.parseInt(flag("hops", "1"), 10);
const TRANSPORTS = flag("transport", "loopback,websocket,websocket-psk")
  .split(",");
// Nodes in one process share an event loop, a heap and a compilation state.
// Isolation is the honest default for a carrier comparison; Loopback has no
// cross-process carrier yet, so it stays co-located and is labelled as such.
const ISOLATION = flag("isolation", "in-process");

// One hop is two nodes; each further hop adds a transit node between them.
const geometry = () => GEOMETRIES.chain(HOPS + 1);

/**
 * Offer `count` messages as fast as the node will admit them.
 *
 * `send` resolves at admission rather than at delivery, so a caller that
 * awaits each one still leaves the wire idle between admissions. Keeping a
 * window of outstanding admissions in flight is what saturates the path, and
 * a refusal is capacity backpressure rather than an error, so it is retried.
 */
async function saturate({ node, source, destination, count, arrived }) {
  // An isolated node generates its own load. Driving it over IPC would put a
  // round trip in front of every send and measure the harness.
  if (typeof node.burst === "function") {
    const result = await node.burst(source, destination, count);
    await eventually(() => arrived() >= count, "throughput drain", 120_000);
    return { refusals: result.refusals };
  }
  // `send` resolves at admission, not at delivery, and admission is cheap, so
  // offering one at a time still keeps the writer queue full and the wire
  // busy. An earlier version held sixty-four admissions outstanding and
  // retried refusals on `setImmediate`; that spun the loop hard enough to
  // measure itself, reporting a hundred thousand refusals and a throughput
  // below the sequential case. Backing off on refusal instead of spinning is
  // both honest and faster.
  let offered = 0;
  let refusals = 0;
  while (offered < count) {
    try {
      await node.send(source, destination, { ordinal: offered });
      offered += 1;
    } catch (error) {
      if (error?.code !== "QUEUE_FULL") throw error;
      refusals += 1;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  await eventually(() => arrived() >= count, "throughput drain", 120_000);
  return { refusals };
}

async function measure(transport) {
  const deliveries = [];
  const topology = await buildGeometry({
    geometry: geometry(),
    transport,
    endpointsPerNode: 1,
    deliveries,
    // A breadcrumb is retained per sent message and released by expiry rather
    // than by delivery, so its bound is a sustained-rate ceiling and not a
    // carrier property. It is lifted here so this measures the carrier. The
    // ceiling it imposes is measured on its own terms; see `MX6`.
    capacity: { maxReverseCorrelations: 500_000 },
    ...(ISOLATION === "process" && transport !== "loopback"
      ? { isolation: "process" }
      : {}),
  });
  try {
    await awaitConvergence(topology);
    const from = topology.nodes[0];
    const source = topology.endpoints[0];
    const destination = topology.endpoints.at(-1);
    const isolated = topology.isolation === "process";
    const arrivedAt = () =>
      deliveries.filter((entry) => entry.endpoint === destination).length;

    // Warm the path so compilation and first-touch allocation land outside the
    // measured window.
    let base = arrivedAt();
    await saturate({
      node: from,
      source,
      destination,
      count: Math.min(300, COUNT),
      arrived: () => arrivedAt() - base,
    });

    const runs = [];
    let refusals = 0;
    for (let attempt = 0; attempt < REPEAT; attempt += 1) {
      base = arrivedAt();
      const lag = sampleLoopLag();
      const started = process.hrtime.bigint();
      const result = await saturate({
        node: from,
        source,
        destination,
        count: COUNT,
        arrived: () => arrivedAt() - base,
      });
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      const loop = lag.stop();
      refusals += result.refusals;
      runs.push({ perSecond: COUNT / seconds, loopMaxUs: loop.maxUs });
    }
    runs.sort((a, b) => a.perSecond - b.perSecond);
    const median = runs[Math.floor(runs.length / 2)];
    return {
      best: Math.round(runs.at(-1).perSecond),
      median: Math.round(median.perSecond),
      worst: Math.round(runs[0].perSecond),
      loopMaxUs: median.loopMaxUs,
      refusals,
      isolated,
    };
  } finally {
    for (const node of [...topology.nodes].reverse()) {
      await node.stop().catch(() => undefined);
    }
  }
}

// One transport per process. Measuring all three in one run gave the later
// ones warm compilation and a grown heap, and reported TLS as faster than an
// in-process fabric. A comparison has to control for the thing it compares.
if (TRANSPORTS.length === 1) {
  const only = TRANSPORTS[0];
  const result = await measure(only);
  process.stdout.write(
    `RESULT ${only} ${result.median} ${result.best} ${result.worst}`
      + ` ${result.loopMaxUs} ${result.refusals} ${result.isolated}\n`,
  );
} else {
  const { execFileSync } = await import("node:child_process");
  process.stdout.write(
    `throughput | ${HOPS} hop${HOPS === 1 ? "" : "s"}`
      + ` | ${COUNT} messages x ${REPEAT} runs`
      + ` | one process per carrier, one machine\n\n`,
  );
  const rows = [];
  for (const transport of TRANSPORTS) {
    const out = execFileSync(process.execPath, [
      new URL(import.meta.url).pathname,
      `--transport=${transport}`,
      `--count=${COUNT}`,
      `--repeat=${REPEAT}`,
      `--hops=${HOPS}`,
      `--isolation=${ISOLATION}`,
    ], { encoding: "utf8" });
    const line = out.split("\n").find((value) => value.startsWith("RESULT "));
    if (line === undefined) throw new Error(`no result for ${transport}`);
    const [, name, median, best, worst, loopMaxUs, refusals, isolated] =
      line.split(" ");
    rows.push({
      transport: name,
      median: Number(median),
      best: Number(best),
      worst: Number(worst),
      loopMaxUs: Number(loopMaxUs),
      refusals: Number(refusals),
      isolated: isolated === "true",
    });
  }
  const baseline = rows.find(({ transport }) => transport === "loopback");
  const header =
    "carrier            median msg/s     best     worst   vs loopback";
  process.stdout.write(`${header}\n${"-".repeat(header.length)}\n`);
  for (const row of rows) {
    const relative = baseline === undefined
      ? "n/a"
      : `${((row.median / baseline.median) * 100).toFixed(0)}%`;
    process.stdout.write(
      `${row.transport.padEnd(18)}`
        + `${String(row.median).padStart(12)}`
        + `${String(row.best).padStart(9)}`
        + `${String(row.worst).padStart(10)}`
        + `${relative.padStart(14)}`
        + `${(row.isolated ? "  isolated" : "  co-located").padStart(13)}\n`,
    );
  }
  process.stdout.write("\n");
  for (const row of rows) {
    // With the nodes elsewhere the sampler measures this driver, not them, so
    // reporting its figure under the same heading would compare two different
    // loops. It is named for what it is instead.
    process.stdout.write(
      `  ${row.transport.padEnd(16)}`
        + `${row.isolated ? "driver" : "node"} loop stall worst ${row.loopMaxUs}us`
        + `  capacity refusals ${row.refusals}\n`,
    );
  }
}
