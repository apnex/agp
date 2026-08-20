import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const failures = [];

async function exists(target) {
  try {
    await readFile(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function collectTests(target, output) {
  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const candidate = path.join(target, entry.name);
    if (entry.isDirectory()) await collectTests(candidate, output);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      output.push(candidate);
    }
  }
}

async function auditOwnershipMap(owner, readme, tests) {
  const source = await readFile(readme, "utf8");
  const tableRows = source.split(/\r?\n/).filter(
    (line) => line.trimStart().startsWith("|"),
  );
  for (const file of tests) {
    const basename = path.basename(file);
    const rows = tableRows.filter((line) => line.includes(basename));
    if (rows.length === 0) {
      failures.push(`${owner}: README ownership map omits ${basename}`);
    } else if (rows.length > 1) {
      failures.push(
        `${owner}: README ownership map lists ${basename} ${rows.length} times`,
      );
    }
  }
}

const rootManifest = JSON.parse(
  await readFile(path.join(workspace, "package.json"), "utf8"),
);
const packageDirectories = rootManifest.workspaces
  .filter((entry) => typeof entry === "string" && !entry.includes("*"))
  .map((entry) => path.join(workspace, entry));
const allTests = [];
for (const directory of packageDirectories) {
  const packageName = path.basename(directory);
  if (!(await exists(path.join(directory, "package.json")))) continue;
  if (!(await exists(path.join(directory, "src", "index.ts")))) continue;

  const tests = [];
  await collectTests(path.join(directory, "test"), tests);
  if (tests.length === 0) {
    failures.push(`${packageName}: no package-owned tests`);
    continue;
  }
  const readme = path.join(directory, "test", "README.md");
  if (!(await exists(readme))) {
    failures.push(`${packageName}: missing test/README.md ownership map`);
  } else {
    await auditOwnershipMap(packageName, readme, tests);
  }
  const manifest = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  if (typeof manifest.scripts?.test !== "string") {
    failures.push(`${packageName}: missing package-local test script`);
  }
  allTests.push(...tests);
}

const cliDirectory = path.join(workspace, "cli");
const cliTests = [];
await collectTests(path.join(cliDirectory, "test"), cliTests);
if (cliTests.length === 0) {
  failures.push("cli: no component-owned tests");
}
const cliReadme = path.join(cliDirectory, "test", "README.md");
if (!(await exists(cliReadme))) {
  failures.push("cli: missing test/README.md ownership map");
} else {
  await auditOwnershipMap("cli", cliReadme, cliTests);
}
if (!(await exists(path.join(cliDirectory, "test", "run.sh")))) {
  failures.push("cli: missing component-local test script");
}
allTests.push(...cliTests);

for (const suiteName of [
  "conformance",
  "integration",
  "topology",
  "resilience",
  "e2e",
]) {
  const suiteDirectory = path.join(workspace, "test", suiteName);
  const suiteTests = [];
  await collectTests(suiteDirectory, suiteTests);
  if (suiteTests.length === 0) {
    failures.push(`test/${suiteName}: no suite-owned tests`);
    continue;
  }
  const suiteReadme = path.join(suiteDirectory, "README.md");
  if (!(await exists(suiteReadme))) {
    failures.push(`test/${suiteName}: missing README.md ownership map`);
  } else {
    await auditOwnershipMap(`test/${suiteName}`, suiteReadme, suiteTests);
  }
  allTests.push(...suiteTests);
}

const titlePattern =
  /^\s*(?:test|it)\s*\(\s*[\"'`]given\b[^\"'`]*\bwhen\b[^\"'`]*\bthen\b/im;
for (const file of allTests) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(workspace, file);
  const lines = source.split(/\r?\n/).length;
  if (lines > 300) failures.push(`${relative}: ${lines} lines exceeds 300`);
  if (/\.(?:only)\s*\(/.test(source)) {
    failures.push(`${relative}: focused test is forbidden`);
  }
  if (
    /\.(?:skip|todo)\s*\(/.test(source)
    || /\b(?:skip|todo)\s*:/.test(source)
  ) {
    failures.push(`${relative}: skipped or todo test is forbidden`);
  }
  if (/\b(?:TODO|FIXME|TBD)\b/.test(source)) {
    failures.push(`${relative}: placeholder marker is forbidden`);
  }
  if (
    relative.startsWith("packages/")
    && /(?:from|import)\s*\(?[\"'][^\"']*packages\/[^\"']*\/src\//.test(source)
  ) {
    failures.push(`${relative}: imports a private package source tree`);
  }
  const testCalls = source.match(/^\s*(?:test|it)\s*\(/gm)?.length ?? 0;
  const descriptive = source.match(
    /^\s*(?:test|it)\s*\(\s*[\"'`]given\b[^\"'`]*\bwhen\b[^\"'`]*\bthen\b/gim,
  )?.length ?? 0;
  if (
    testCalls > 0
    && (
      descriptive !== testCalls
      || !titlePattern.test(source)
    )
  ) {
    failures.push(
      `${relative}: every test title must state given/when/then `
        + `(${descriptive}/${testCalls} conform)`,
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(
  `Test architecture PASS: ${allTests.length} orthogonally owned files.\n`,
);
