import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registerPath = "docs/VERIFICATION.md";

// The register claims which live combinations are covered. A claim that names a
// test file which does not exist is worse than an absent row, because it
// reports coverage nobody can run. An exclusion without a re-entry condition is
// equally hollow: it records a gap without recording how it closes.
function rows(source, heading) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.startsWith(`### ${heading}`));
  if (start === -1) return undefined;
  // A markdown table's header is the row before its separator, so data begins
  // once a separator has been seen. Matching on header text instead let a
  // header row through as data.
  const collected = [];
  let past = false;
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,3}\s/u.test(line)) break;
    if (!/^\|/u.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length === 0) continue;
    if (cells.every((cell) => /^:?-+:?$/u.test(cell))) { past = true; continue; }
    if (!past) continue;
    collected.push(cells);
  }
  return collected;
}

async function register() {
  return readFile(path.join(root, registerPath), "utf8");
}

test("Given the default suite, when every named cell is resolved, then each test file it claims exists", async () => {
  const suite = rows(await register(), "4.2 Default suite");
  assert.notEqual(suite, undefined, "default suite is missing");
  assert.ok(suite.length >= 4, "default suite lost rows");

  const missing = [];
  for (const cells of suite) {
    for (const cell of cells.slice(1)) {
      if (cell === "-" || cell.length === 0) continue;
      const named = /`([^`]+\.test\.js)`/u.exec(cell);
      if (named === null) {
        missing.push(`${cells[0]}: cell "${cell}" names no test file`);
        continue;
      }
      if (!existsSync(path.join(root, named[1]))) {
        missing.push(`${cells[0]}: ${named[1]} does not exist`);
      }
    }
  }
  assert.deepEqual(
    missing,
    [],
    `${registerPath} claims coverage it cannot run:\n${missing.join("\n")}`,
  );
});

// The register declares more capability than the harness has. That is honest
// only while it is marked. A value listed as supported must be reachable, and a
// value the harness cannot express must say so rather than read as covered.
test("Given the dimension table, when a value claims harness support, then the register does not silently overclaim it", async () => {
  const dimensions = rows(await register(), "4.1 Dimensions");
  assert.notEqual(dimensions, undefined, "dimension table is missing");
  assert.ok(dimensions.length >= 4, "a dimension was dropped");

  const problems = [];
  for (const [id, values, support] of dimensions) {
    if (!values || values.split(",").length < 2) {
      problems.push(`${id}: needs more than one value to be a dimension`);
    }
    if (!support || support.length < 3) {
      problems.push(`${id}: states no harness support`);
      continue;
    }
    // A parameterised value is only claimable once an entry point exists.
    const parameterised = /\(n\)/u.test(values);
    const claimsAll = /^all supported$/iu.test(support.trim());
    if (parameterised && claimsAll) {
      problems.push(
        `${id}: claims full support while offering parameterised values`,
      );
    }
  }
  assert.deepEqual(problems, [], `dimension table must not overclaim:\n${problems.join("\n")}`);
});

test("Given the register, when it is read, then the rule that keeps the default suite sparse is stated rather than implied", async () => {
  const source = await register();

  // Without the rule written down, a sparse suite is indistinguishable from an
  // incomplete one, and every empty cell reads as an oversight.
  assert.match(
    source,
    /earns a default test only when it proves something no dimension/u,
    "the selection rule must be stated normatively",
  );
  assert.match(
    source,
    /one dimension at a time/u,
    "the deepening model must state that it varies one dimension",
  );
});

test("Given the exclusion register, when each row is read, then it states both a reason and a re-entry condition", async () => {
  const excluded = rows(await register(), "4.5 Excluded combinations");
  assert.notEqual(excluded, undefined, "exclusion register is missing");
  assert.ok(excluded.length >= 1, "an empty exclusion register asserts total coverage");

  const hollow = [];
  for (const cells of excluded) {
    const [id, what, why, reentry] = cells;
    if (!what || what.length < 5) hollow.push(`${id}: names nothing excluded`);
    if (!why || why.length < 15) hollow.push(`${id}: states no reason`);
    if (!reentry || reentry.length < 4) hollow.push(`${id}: states no re-entry condition`);
  }
  assert.deepEqual(hollow, [], `exclusions must be decisions, not omissions:\n${hollow.join("\n")}`);
});

test("Given every live geometry test on disk, when the default suite is scanned, then none is absent from the register", async () => {
  const suite = rows(await register(), "4.2 Default suite");
  const claimed = new Set(
    suite.flatMap((cells) =>
      cells.slice(1).flatMap((cell) => {
        const named = /`([^`]+\.test\.js)`/u.exec(cell);
        return named === null ? [] : [named[1]];
      })
    ),
  );

  // Convergence tests define a geometry; withdrawal and restart tests exercise
  // one already registered, so only the former must appear.
  const geometryTests = [
    "test/topology/star-convergence.test.js",
    "test/topology/line-transit.test.js",
    "test/topology/triangle-loop-prevention.test.js",
    "test/topology/diamond-selection.test.js",
  ];
  const unregistered = geometryTests.filter((file) =>
    existsSync(path.join(root, file)) && !claimed.has(file)
  );
  assert.deepEqual(
    unregistered,
    [],
    `these geometries run but are not registered:\n${unregistered.join("\n")}`,
  );
});
