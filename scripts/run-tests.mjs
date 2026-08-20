import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const requested = process.argv.slice(2);
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

const files = [];
for (const target of requested) {
  await collect(path.resolve(target), files);
}
files.sort();

if (files.length === 0) {
  process.stdout.write("No test files found for requested scope.\n");
  process.exit(0);
}

const child = spawn(
  process.execPath,
  ["--test", "--test-concurrency=1", ...files],
  { stdio: "inherit" },
);
child.once("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
