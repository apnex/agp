import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { GEOMETRIES, TRANSPORTS } from "../support/geometry.js";
import {
  collectMatrixCoverage, enumerateMatrixCells, readMatrixCoverage, resolveMatrixParameters,
  selectMatrixCover, validateMatrixCoverage,
} from "../../scripts/matrix-coverage.mjs";
import { createMatrixPlan, parseMatrixOptions } from "../../scripts/run-matrix.mjs";

const run = promisify(execFile);
const root = new URL("../../", import.meta.url);
const model = await readMatrixCoverage();
const all = enumerateMatrixCells(model, { transport: "all" });

test("Given the coverage declaration, when its dimensions mechanisms and sources are resolved, then every entry has a real owner and an executable witness", async () => {
  assert.deepEqual([...model.dimensions.geometry].sort(), Object.keys(GEOMETRIES).sort());
  assert.deepEqual([...model.dimensions.transport].sort(), Object.keys(TRANSPORTS).sort());
  const register = await readFile(new URL("docs/design/mechanisms.md", root), "utf8");
  const mechanisms = new Set([...register.matchAll(/^\| (M\d{2}) \|/gmu)].map((match) => match[1]));
  assert.ok(mechanisms.size >= 30, "mechanism register must not parse vacuously");
  for (const rule of model.rules) {
    await access(new URL(rule.source, root));
    assert.ok(all.some((cell) => cell.rules.includes(rule.id)), `unused rule ${rule.id}`);
    for (const id of rule.mechanisms) assert.ok(mechanisms.has(id), `unregistered mechanism ${id}`);
  }
  const runner = await readFile(new URL("scripts/run-matrix.mjs", root), "utf8");
  const executed = [...runner.matchAll(/observed\("([^"]+)"\)/gu)].map((match) => match[1]);
  assert.deepEqual(executed.sort(), model.assertions.map(({ id }) => id).sort());
  for (const assertion of model.assertions) assert.ok(all.some((cell) => cell.assertions.includes(assertion.id)));
  for (const exclusion of model.exclusions) {
    const record = await readFile(new URL(exclusion.owner.split("#")[0], root), "utf8");
    assert.ok(record.includes(`| \`${exclusion.id}\` |`));
  }
});

test("Given the full dimension space, when cells are enumerated, then all seventy legal combinations and the X3 exclusion are preserved", () => {
  assert.equal(all.length, 70);
  assert.equal(enumerateMatrixCells(model).length, 30);
  assert.equal(new Set(all.map(({ id }) => id)).size, 70);
  assert.ok(all.every((cell) => cell.traffic !== "burst" || cell.transport === "loopback"));
  const loopback = all.find((cell) => cell.transport === "loopback");
  const socket = all.find((cell) => cell.transport === "websocket");
  const protectedSocket = all.find((cell) => cell.transport === "websocket-psk");
  assert.ok(loopback.exercisedMechanisms.includes("M32"));
  assert.ok(!loopback.exercisedMechanisms.includes("M37"));
  assert.ok(socket.exercisedMechanisms.includes("M31") && socket.exercisedMechanisms.includes("M37"));
  assert.ok(!socket.exercisedMechanisms.includes("M36"));
  assert.ok(protectedSocket.exercisedMechanisms.includes("M36"));
  assert.deepEqual(loopback.assertions, ["convergence", "single-delivery", "surviving-route"]);
});

test("Given all or filtered matrix cells, when a cover is selected, then it deterministically preserves every declared key without redundant cells", () => {
  for (const cells of [all, enumerateMatrixCells(model), enumerateMatrixCells(model, { geometry: "chain", transport: "all" })]) {
    const selected = selectMatrixCover(cells);
    const coverage = collectMatrixCoverage(cells);
    assert.ok(selected.length < cells.length);
    assert.deepEqual(collectMatrixCoverage(selected), coverage);
    assert.deepEqual(selectMatrixCover([...cells].reverse()), selected, "ties do not depend on input ordering");
    for (const cell of selected) {
      assert.notDeepEqual(collectMatrixCoverage(selected.filter((candidate) => candidate !== cell)), coverage);
    }
  }
});

test("Given malformed coverage or CLI input, when a plan is requested, then invalid declarations fail instead of silently losing cells", () => {
  for (const mutate of [
    (copy) => { copy.dimensions.traffic.push("single"); },
    (copy) => { copy.rules[0].when = { trafffic: ["single"] }; },
    (copy) => { copy.rules[0].when = { traffic: ["unknown"] }; },
    (copy) => { copy.rules[0].mechanisms = []; },
    (copy) => { copy.rules[0].mechanisms = ["not-a-mechanism"]; },
    (copy) => { copy.assertions.push(copy.assertions[0]); },
  ]) {
    const copy = structuredClone(model);
    mutate(copy);
    assert.throws(() => validateMatrixCoverage(copy), /matrix/iu);
  }
  assert.throws(() => enumerateMatrixCells(model, { transport: "udp" }), /Unknown matrix transport/u);
  assert.throws(() => enumerateMatrixCells(model, { geometry: "mesh" }), /Unknown matrix geometry/u);
  for (const args of [["--typo"], ["--deep", "--deep"], ["--geometry="], ["--json=false"]]) {
    assert.throws(() => parseMatrixOptions(args), /matrix option/u);
  }
});

test("Given depth and environment overrides, when the executable plan is produced, then it reports actual counts and rejects impossible snapshots before starting nodes", async () => {
  const options = parseMatrixOptions(["--plan", "--transport=all", "--deep"]);
  const plan = await createMatrixPlan(options, { AGP_DEEPEN_CHAIN: "7", AGP_DEEPEN_ROUTES: "12", AGP_DEEPEN_STREAM: "37" });
  const cell = plan.cells.find((entry) => entry.geometry === "chain" && entry.routes === "moderate" && entry.traffic === "stream");
  assert.deepEqual(cell.execution, { nodes: 7, endpointsPerNode: 12, totalEndpoints: 84, messageCount: 37, isolation: "in-process" });
  assert.equal(plan.parameters.burst, 200);
  assert.ok(plan.mechanismsNotExercised.includes("M26"), "healthy composition does not certify restart");
  await assert.rejects(createMatrixPlan(options, { AGP_DEEPEN_ROUTES: "100" }), /snapshot ceiling/u);
  for (const value of ["0", "-1", "1.5", "02", "Infinity", "9007199254740992"]) {
    assert.throws(() => resolveMatrixParameters(model, { env: { AGP_DEEPEN_STREAM: value } }), /positive safe integer/u);
  }
  assert.throws(() => resolveMatrixParameters(model, { env: { AGP_DEEPEN_CHAIN: "1" } }), /at least three/u);
});

test("Given the public plan command, when JSON output is requested, then stdout is one parseable artifact with complete coverage and no execution claim", async () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("AGP_DEEPEN_")) delete env[key];
  const { stdout, stderr } = await run(process.execPath, [
    "scripts/run-matrix.mjs", "--plan", "--json", "--cover", "--transport=all",
  ], { cwd: fileURLToPath(root), env, timeout: 10_000 });
  const plan = JSON.parse(stdout);
  assert.equal(stderr, "");
  assert.equal(plan.mode, "plan");
  assert.equal(plan.candidateCount, 70);
  assert.equal(plan.selectedCount, plan.cells.length);
  assert.deepEqual(plan.targetCoverage, plan.selectedCoverage);
  assert.equal(plan.results, undefined);
});
