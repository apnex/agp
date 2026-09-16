import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../", import.meta.url));
const kernelRoot = resolve(directory, "../../cli");
const kernel = process.env.CLI_KERNEL_BIN ?? resolve(kernelRoot, "target/debug/cli");
const write = process.argv.slice(2).length === 1 && process.argv[2] === "--write";
assert.ok(write || process.argv.length === 2, "Use author-specs.mjs [--write]");
const scratch = mkdtempSync(resolve(tmpdir(), "agp-cli-authoring-"));
try {
  writeFileSync(resolve(scratch, "intent.txt"), "Construct AGP's complete read-only CLI and application profile through contextual authoring commands.\n");
  for (const name of ["definition", "application"]) {
    const input = readFileSync(resolve(directory, `spec/${name}.commands`), "utf8");
    const result = spawnSync(kernel, [
      "--definition", resolve(kernelRoot, "docs/authoring/operations.json"),
      "--session", resolve(scratch, `${name}.session.json`),
      "--create", "--intent-file", resolve(scratch, "intent.txt"),
      "--compose", "--commands",
    ], { cwd: scratch, input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    const events = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
    const failures = events.filter((event) => event.status === "error");
    assert.deepEqual(failures, [], `${name}: ${JSON.stringify(failures.slice(0, 3))}`);
    const bytes = readFileSync(resolve(scratch, `${name}.json`));
    const target = resolve(directory, `spec/${name}.json`);
    if (write) writeFileSync(target, bytes);
    else assert.deepEqual(bytes, readFileSync(target), `${name}: embedded data differs from contextual recipe`);
    console.log(`${name}: ${events.length} authoring events; ${bytes.length} bytes; ${write ? "written" : "exact match"}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
