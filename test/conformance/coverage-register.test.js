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
  const collected = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,3}\s/u.test(line)) break;
    if (!/^\|/u.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length === 0) continue;
    if (/^-+$/u.test(cells[0]) || cells[0] === "ID") continue;
    collected.push(cells);
  }
  return collected;
}

async function register() {
  return readFile(path.join(root, registerPath), "utf8");
}

test("Given the geometry axis, when each covered row is resolved, then the test file it names exists", async () => {
  const geometry = rows(await register(), "4.1 Geometry axis");
  assert.notEqual(geometry, undefined, "geometry axis is missing");
  assert.ok(geometry.length >= 4, "geometry axis lost rows");

  const missing = [];
  for (const cells of geometry) {
    const named = /`([^`]+\.test\.js)`/u.exec(cells.at(-1));
    if (named === null) {
      missing.push(`${cells[0]}: names no test file`);
      continue;
    }
    if (!existsSync(path.join(root, named[1]))) {
      missing.push(`${cells[0]}: ${named[1]} does not exist`);
    }
  }
  assert.deepEqual(missing, [], `${registerPath} claims coverage it cannot run:\n${missing.join("\n")}`);
});

test("Given the traffic and transport axes, when they are read, then each declares at least one profile with a stated purpose", async () => {
  const source = await register();
  for (const heading of ["4.2 Traffic axis", "4.3 Transport axis"]) {
    const axis = rows(source, heading);
    assert.notEqual(axis, undefined, `${heading} is missing`);
    assert.ok(axis.length >= 2, `${heading} needs more than one value to be an axis`);
    for (const cells of axis) {
      assert.ok(
        cells.at(-1).length > 10,
        `${heading} row ${cells[0]} states no purpose`,
      );
    }
  }
});

test("Given the exclusion register, when each row is read, then it states both a reason and a re-entry condition", async () => {
  const excluded = rows(await register(), "4.4 Excluded combinations");
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

test("Given every live topology test on disk, when the geometry axis is scanned, then none is absent from the register", async () => {
  const geometry = rows(await register(), "4.1 Geometry axis");
  const claimed = new Set(
    geometry.flatMap((cells) => {
      const named = /`([^`]+\.test\.js)`/u.exec(cells.at(-1));
      return named === null ? [] : [named[1]];
    }),
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
