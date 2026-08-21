import assert from "node:assert/strict";

import {
  GEOMETRIES,
  awaitConvergence,
  buildGeometry,
  deepen,
} from "../test/support/geometry.js";
import { burstMessages, streamMessages } from "../test/support/traffic.js";
import { eventually, selectedRoute } from "../test/support/uniform-topology.js";

// The matrix runner is a diagnostic instrument, not a gate.
//
// It sweeps the declared dimension space and reports which combinations hold.
// It deliberately does not run in `npm test`: a failing cell says a combination
// broke, not which layer owns it, and section 2.1 of VERIFICATION.md requires a
// failure to name its owning layer. Use it to find where to look, then
// reproduce what it found in a named file with a specific oracle.
//
// Usage:
//   node scripts/run-matrix.mjs                    loopback sweep, defaults
//   node scripts/run-matrix.mjs --transport=all    every carrier
//   node scripts/run-matrix.mjs --deep             deepened values
//   node scripts/run-matrix.mjs --geometry=chain   one geometry

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const found = argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};
const deep = argv.includes("--deep");

const GEOMETRY_SET = {
  star: () => GEOMETRIES.star(3),
  line: () => GEOMETRIES.line(),
  triangle: () => GEOMETRIES.triangle(),
  diamond: () => GEOMETRIES.diamond(),
  chain: () => GEOMETRIES.chain(deepen("chain", deep ? 6 : 4)),
};
const TRAFFIC = ["single", "stream", "burst"];
const ROUTES = { minimal: 1, moderate: deep ? 24 : 4 };

const requestedGeometry = flag("geometry", "all");
const requestedTransport = flag("transport", "loopback");
const geometries = requestedGeometry === "all"
  ? Object.keys(GEOMETRY_SET)
  : [requestedGeometry];
const transports = requestedTransport === "all"
  ? ["loopback", "websocket", "websocket-psk"]
  : [requestedTransport];

const streamCount = deepen("stream", deep ? 200 : 20);
const burstCount = deepen("burst", deep ? 200 : 20);

/**
 * The invariant every geometry must satisfy, whatever its shape.
 *
 * Shape-specific properties stay in named tests: only a triangle test can
 * assert that no exported path repeats a node, and only a diamond test can
 * assert an alternate candidate stays observable. What a matrix cell proves is
 * that the combination converges, delivers, and stays bounded.
 */
async function runCell({ geometry, transport, traffic, routes }) {
  const deliveries = [];
  const topology = await buildGeometry({
    geometry: GEOMETRY_SET[geometry](),
    transport,
    endpointsPerNode: ROUTES[routes],
    deliveries,
  });
  try {
    await awaitConvergence(topology);

    const from = topology.nodes[0];
    const target = topology.nodes.at(-1);
    const source = topology.endpoints[0];
    const destination = topology.endpoints.at(-1);
    assert.notEqual(
      selectedRoute(from, destination),
      undefined,
      "the far endpoint must be selected before traffic",
    );

    if (traffic === "single") {
      const before = deliveries.length;
      await from.send(source, destination, { cell: true });
      await eventually(
        () => deliveries.length > before,
        "single delivery",
        20_000,
      );
    } else if (traffic === "stream") {
      const { arrived } = await streamMessages({
        from, source, destination, count: streamCount, deliveries,
      });
      assert.deepEqual(
        arrived,
        Array.from({ length: streamCount }, (_, ordinal) => ordinal),
        "stream order must be preserved",
      );
    } else {
      const { admitted, rejected, arrived } = await burstMessages({
        from, source, destination, count: burstCount, deliveries,
      });
      assert.equal(
        admitted.length + rejected.length,
        burstCount,
        "every concurrent send must settle",
      );
      assert.equal(
        new Set(arrived).size,
        arrived.length,
        "no admitted message may deliver twice",
      );
    }

    // Reachability survives the traffic that just crossed it.
    assert.notEqual(selectedRoute(target, source), undefined);
    return { ok: true };
  } finally {
    for (const node of [...topology.nodes].reverse()) {
      await node.stop().catch(() => undefined);
    }
  }
}

const cells = [];
for (const transport of transports) {
  for (const geometry of geometries) {
    for (const traffic of TRAFFIC) {
      for (const routes of Object.keys(ROUTES)) {
        // Concurrency against a real carrier makes the oracle timing
        // dependent, and the same bound is proved deterministically over
        // Loopback. This is exclusion X3 in the register.
        if (traffic === "burst" && transport !== "loopback") continue;
        cells.push({ geometry, transport, traffic, routes });
      }
    }
  }
}

process.stdout.write(
  `matrix: ${cells.length} cells`
    + ` | transports ${transports.join(",")}`
    + ` | ${deep ? "deepened" : "default"}`
    + ` | stream=${streamCount} burst=${burstCount} routes=${ROUTES.moderate}\n\n`,
);

const results = [];
for (const cell of cells) {
  const label = `${cell.transport}/${cell.geometry}/${cell.traffic}/${cell.routes}`;
  const started = Date.now();
  try {
    await runCell(cell);
    const ms = Date.now() - started;
    results.push({ ...cell, ok: true, ms });
    process.stdout.write(`PASS  ${label.padEnd(46)} ${ms}ms\n`);
  } catch (error) {
    const ms = Date.now() - started;
    results.push({ ...cell, ok: false, ms, error: error.message });
    process.stdout.write(`FAIL  ${label.padEnd(46)} ${ms}ms  ${error.message}\n`);
  }
}

const failed = results.filter(({ ok }) => !ok);
const elapsed = results.reduce((total, { ms }) => total + ms, 0);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} cells passed`
    + ` in ${(elapsed / 1000).toFixed(1)}s\n`,
);
if (failed.length > 0) {
  process.stdout.write(
    "\nA failing cell names a combination, not an owning layer.\n"
      + "Reproduce it in a named test before treating it as a defect.\n",
  );
}
process.exit(failed.length === 0 ? 0 : 1);
