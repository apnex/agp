import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// Each workspace suite runs in its own `node --test` process.
//
// Sharing one runner across every suite made an unrelated destabilisation
// cancel every file after it, and the cancellation point moved between runs
// because it depended on load rather than on any one test. The suites are
// already declared orthogonal in TESTING.md, so giving each one its own
// process turns a cascade into an isolated, attributable failure.
//
// Suites run in the gate order declared by verification.md section 2.1, which
// is also lexical order. By default every suite runs even after one fails, so
// a single invocation reports the whole picture; that is worth more than a
// purity claim when triaging a shared runner.
//
// --fail-fast stops at the first failing suite, which is gated ascension read
// literally: a higher gate may not report over an unsealed predecessor. Use it
// when you want the lowest broken layer and nothing else.
//
// Usage:  node scripts/run-tests.mjs [--fail-fast] [TARGET ...]   default: test

const argv = process.argv.slice(2);
const failFast = argv.includes("--fail-fast");
const requested = argv.filter((value) => value !== "--fail-fast");
if (requested.length === 0) requested.push("test");

async function collect(target, output) {
  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const candidate = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await collect(candidate, output);
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      output.push(candidate);
    }
  }
}

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

// A requested target that holds suite subdirectories expands into one group per
// suite. Anything else stays a single group, so a narrow scope such as
// `test/topology` or one explicit file still runs exactly as asked.
async function groupsFor(target) {
  const resolved = path.resolve(target);
  if (!await isDirectory(resolved)) return [{ name: target, roots: [resolved] }];

  const entries = await readdir(resolved, { withFileTypes: true });
  const subdirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const ownFiles = entries.some(
    (entry) => entry.isFile() && entry.name.endsWith(".test.js"),
  );
  if (subdirectories.length === 0 || ownFiles) {
    return [{ name: target, roots: [resolved] }];
  }
  return subdirectories.map((name) => ({
    name: `${target}/${name}`,
    roots: [path.join(resolved, name)],
  }));
}

function run(files) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["--test", "--test-concurrency=1", ...files],
      { stdio: "inherit" },
    );
    child.once("exit", (code, signal) => {
      resolve(signal !== null ? 1 : code ?? 1);
    });
  });
}

const groups = [];
for (const target of requested) groups.push(...await groupsFor(target));

let total = 0;
let failed = 0;
let sealed = true;
const results = [];

for (const group of groups) {
  const files = [];
  for (const root of group.roots) await collect(root, files);
  files.sort();
  if (files.length === 0) continue;

  // Under --fail-fast a suite below an unsealed predecessor is not run and not
  // reported as passing. Recording it as skipped keeps the summary honest about
  // what was actually proved.
  if (!sealed) {
    results.push({ name: group.name, files: files.length, code: undefined });
    continue;
  }

  total += files.length;
  process.stdout.write(`\n=== ${group.name} (${files.length} files) ===\n`);
  const code = await run(files);
  results.push({ name: group.name, files: files.length, code });
  if (code !== 0) {
    failed += 1;
    if (failFast) sealed = false;
  }
}

if (results.length === 0) {
  process.stdout.write("No test files found for requested scope.\n");
  process.exit(0);
}

const label = (code) =>
  code === undefined ? "SKIP" : code === 0 ? "PASS" : "FAIL";

process.stdout.write("\n=== suite summary ===\n");
for (const { name, files, code } of results) {
  process.stdout.write(`${label(code)}  ${name} (${files} files)\n`);
}
const ran = results.filter(({ code }) => code !== undefined);
const skipped = results.length - ran.length;
process.stdout.write(
  `${ran.length - failed}/${ran.length} suites passed, ${total} files`
    + (skipped > 0 ? `, ${skipped} suite(s) not run behind a failed gate` : "")
    + ".\n",
);
process.exit(failed === 0 ? 0 : 1);
