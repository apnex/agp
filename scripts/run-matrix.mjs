import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GEOMETRIES, PROTOCOL_MAX_ROUTES_PER_SNAPSHOT, awaitConvergence, buildGeometry } from "../test/support/geometry.js";
import { burstMessages, streamMessages } from "../test/support/traffic.js";
import { eventually, selectedRoute } from "../test/support/uniform-topology.js";
import {
  collectMatrixCoverage, enumerateMatrixCells, readMatrixCoverage, resolveMatrixParameters, selectMatrixCover,
} from "./matrix-coverage.mjs";

// A diagnostic instrument, not a correctness gate. Ordinary invocation still
// runs every legal cell. --cover is explicitly a declared-coverage subset, not
// all interactions; --plan --json inspects it without starting any nodes.
export function parseMatrixOptions(argv) {
  const options = { geometry: "all", transport: "loopback", deep: false, cover: false, plan: false, json: false };
  const seen = new Set();
  for (const value of argv) {
    const match = /^--(geometry|transport)=(.+)$/u.exec(value);
    const name = match?.[1] ?? value.slice(2);
    if ((!match && !["--deep", "--cover", "--plan", "--json"].includes(value)) || seen.has(name)) {
      throw new Error(`Unknown or repeated matrix option: ${value}`);
    }
    seen.add(name);
    options[name] = match ? match[2] : true;
  }
  return options;
}

export async function createMatrixPlan(options, env = process.env) {
  const model = await readMatrixCoverage();
  const parameters = resolveMatrixParameters(model, { deep: options.deep, env });
  const cells = enumerateMatrixCells(model, options).map((cell) => {
    const shape = GEOMETRIES[cell.geometry](cell.geometry === "chain" ? parameters.chain : undefined);
    const endpointsPerNode = cell.routes === "minimal" ? 1 : parameters.routes;
    const totalEndpoints = shape.nodes.length * endpointsPerNode;
    if (totalEndpoints > PROTOCOL_MAX_ROUTES_PER_SNAPSHOT) {
      throw new Error(`${cell.id} requires ${totalEndpoints} routes, above snapshot ceiling ${PROTOCOL_MAX_ROUTES_PER_SNAPSHOT}`);
    }
    return {
      ...cell,
      execution: {
        nodes: shape.nodes.length, endpointsPerNode, totalEndpoints,
        messageCount: cell.traffic === "single" ? 1 : parameters[cell.traffic], isolation: "in-process",
      },
    };
  });
  const selected = options.cover ? selectMatrixCover(cells) : cells;
  const register = await readFile(new URL("../docs/design/mechanisms.md", import.meta.url), "utf8");
  const mechanisms = [...register.matchAll(/^\| (M\d{2}) \|/gmu)].map((match) => match[1]);
  const exercised = new Set(cells.flatMap((cell) => cell.exercisedMechanisms));
  return {
    schemaVersion: 1, mode: options.plan ? "plan" : "execution", scope: model.scope,
    selection: options.cover ? "declared-coverage-subset" : "full-legal-sweep",
    requested: { geometry: options.geometry, transport: options.transport, deep: options.deep },
    parameters, candidateCount: cells.length, selectedCount: selected.length,
    targetCoverage: collectMatrixCoverage(cells), selectedCoverage: collectMatrixCoverage(selected),
    mechanismsNotExercised: mechanisms.filter((id) => !exercised.has(id)),
    exclusions: model.exclusions, rules: model.rules, assertionDefinitions: model.assertions, cells: selected,
  };
}

async function executeMatrixCell(cell) {
  const cleanups = [];
  const passedAssertions = [];
  const observed = (id) => passedAssertions.push(id);
  const deliveries = [];
  try {
    const topology = await buildGeometry({
      geometry: GEOMETRIES[cell.geometry](cell.execution.nodes), transport: cell.transport,
      endpointsPerNode: cell.execution.endpointsPerNode, deliveries,
      context: { after: (cleanup) => cleanups.push(cleanup) },
    });
    await awaitConvergence(topology);
    const from = topology.nodes[0];
    const target = topology.nodes.at(-1);
    const source = topology.endpoints[0];
    const destination = topology.endpoints.at(-1);
    assert.notEqual(selectedRoute(from, destination), undefined, "far endpoint selected before traffic");
    observed("convergence");

    const count = cell.execution.messageCount;
    if (cell.traffic === "single") {
      await from.send(source, destination, { cell: true });
      await eventually(() => deliveries.some((entry) => entry.endpoint === destination), "single delivery", 20_000);
      assert.deepEqual(deliveries.filter((entry) => entry.endpoint === destination).map((entry) => entry.payload), [{ cell: true }]);
      observed("single-delivery");
    } else if (cell.traffic === "stream") {
      const { arrived } = await streamMessages({ from, source, destination, count, deliveries });
      assert.deepEqual(arrived, Array.from({ length: count }, (_, ordinal) => ordinal), "stream order");
      observed("stream-order");
    } else if (cell.traffic === "burst") {
      const { admitted, rejected, arrived } = await burstMessages({ from, source, destination, count, deliveries });
      assert.ok(admitted.length > 0, "some concurrent sends must be admitted");
      assert.equal(admitted.length + rejected.length, count, "every concurrent send settles");
      assert.equal(arrived.length, admitted.length, "every admission has one observed delivery");
      assert.equal(new Set(arrived).size, arrived.length, "no observed duplicates");
      assert.ok(rejected.every(({ code }) => code === "QUEUE_FULL"), "only bounded admission refusals are expected");
      observed("burst-accounting");
    } else {
      throw new Error(`No matrix traffic driver for ${cell.traffic}`);
    }
    assert.notEqual(selectedRoute(target, source), undefined, "reverse reachability survives traffic");
    observed("surviving-route");
    assert.deepEqual([...passedAssertions].sort(), [...cell.assertions].sort(), "declared assertions match executed oracles");
    return { ok: true, passedAssertions };
  } catch (error) {
    return { ok: false, passedAssertions, error: error.message };
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup();
  }
}

async function runMatrix() {
  const options = parseMatrixOptions(process.argv.slice(2));
  const plan = await createMatrixPlan(options);
  if (options.plan) {
    process.stdout.write(options.json ? `${JSON.stringify(plan, null, 2)}\n`
      : `matrix plan: ${plan.selectedCount}/${plan.candidateCount} cells (${plan.selection})\n`
        + `${plan.cells.map(({ id }) => id).join("\n")}\n`);
    return;
  }
  if (!options.json) process.stdout.write(`matrix: ${plan.selectedCount}/${plan.candidateCount} cells (${plan.selection})\n`);
  const results = [];
  for (const cell of plan.cells) {
    const started = Date.now();
    const result = { id: cell.id, ...await executeMatrixCell(cell), ms: Date.now() - started };
    results.push(result);
    if (!options.json) {
      process.stdout.write(`${result.ok ? "PASS" : "FAIL"}  ${cell.id.padEnd(46)} ${result.ms}ms${result.error ? `  ${result.error}` : ""}\n`);
    }
  }
  const passed = results.filter(({ ok }) => ok).length;
  if (options.json) process.stdout.write(`${JSON.stringify({ ...plan, passed, failed: results.length - passed, results }, null, 2)}\n`);
  else process.stdout.write(`\n${passed}/${results.length} cells passed. Failures require a named owning-layer reproduction.\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runMatrix();
}
