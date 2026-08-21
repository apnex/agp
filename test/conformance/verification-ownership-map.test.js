import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mapPath = "docs/design/agp-uniform-node/verification.md";

// Rows may name a family with a wildcard or an axis placeholder instead of one
// literal file. Those are covered by their package ownership README instead.
const TEMPLATE = /[*<>]/u;

const SUITE_ROOTS = [
  "test/conformance",
  "test/integration",
  "test/topology",
  "test/resilience",
  "test/e2e",
  "cli/test",
  "packages",
];

async function testFilesOnDisk() {
  const found = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      if (entry.isDirectory()) await walk(candidate);
      else if (entry.isFile() && entry.name.endsWith(".test.js")) {
        found.push(path.relative(root, candidate));
      }
    }
  };
  for (const suite of SUITE_ROOTS) await walk(path.join(root, suite));
  return found.sort();
}

function mapRows(source) {
  const rows = [];
  for (const line of source.split(/\r?\n/u)) {
    const match = /^\|\s*(AX[0-8](?:-[PTBLD])?)\s*\|\s*`([^`]+)`\s*\|/u.exec(line);
    if (match) rows.push({ gate: match[1], file: match[2] });
  }
  return rows;
}

test("Given the verification ownership map, when its rows are resolved, then every named test file exists and no gate claims a missing oracle", async () => {
  const rows = mapRows(await readFile(path.join(root, mapPath), "utf8"));
  assert.ok(rows.length > 0, "the ownership map must contain rows");

  const missing = rows
    .filter(({ file }) => !TEMPLATE.test(file))
    .filter(({ file }) => !existsSync(path.join(root, file)))
    .map(({ gate, file }) => `${gate} -> ${file}`);

  assert.deepEqual(
    missing,
    [],
    `${mapPath} names test files that do not exist:\n${missing.join("\n")}`,
  );
});

test("Given the verification ownership map, when one file is claimed by several gates, then each claim is a distinct gate so no oracle is duplicated within a layer", async () => {
  const rows = mapRows(await readFile(path.join(root, mapPath), "utf8"));
  const seen = new Set();
  const duplicates = [];
  for (const { gate, file } of rows) {
    const key = `${gate} ${file}`;
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }
  assert.deepEqual(
    duplicates,
    [],
    `${mapPath} repeats the same gate and file:\n${duplicates.join("\n")}`,
  );
});

test("Given the verification ownership map, when a gate names a package test file, then that file is also owned by its package suite README", async () => {
  const rows = mapRows(await readFile(path.join(root, mapPath), "utf8"));
  const disk = new Set(await testFilesOnDisk());
  const unowned = [];

  for (const { file } of rows) {
    if (TEMPLATE.test(file) || !disk.has(file)) continue;
    const suite = /^(packages\/[^/]+\/test|cli\/test|test\/[^/]+)\//u.exec(file);
    if (suite === null) continue;
    const readme = path.join(root, suite[1], "README.md");
    if (!existsSync(readme)) {
      unowned.push(`${file}: no suite README at ${suite[1]}`);
      continue;
    }
    const source = await readFile(readme, "utf8");
    if (!source.includes(path.basename(file))) {
      unowned.push(`${file}: absent from ${suite[1]}/README.md`);
    }
  }

  assert.deepEqual(
    unowned,
    [],
    `gate evidence must also carry suite ownership:\n${unowned.join("\n")}`,
  );
});
