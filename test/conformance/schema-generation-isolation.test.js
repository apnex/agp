import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const owners = [
  "protocol",
  "transport",
  "binding-websocket",
  "transport-loopback",
  "core",
  "management-http",
];

async function run(executable, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null || code !== 0) {
        reject(new Error(`${args.join(" ")} failed: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
}

async function sourceFiles(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await sourceFiles(candidate, output);
    else if (entry.isFile() && entry.name.endsWith(".ts")) output.push(candidate);
  }
  return output;
}

test("Given every schema-owning package in an isolated consumer, when generation and declaration resolution run, then outputs are byte-current and all internal imports are declared", async (context) => {
  for (const owner of owners) {
    const packageRoot = path.join(root, "packages", owner);
    await run(process.execPath, ["scripts/generate-contracts.mjs", "--check"], packageRoot);
    const manifest = JSON.parse(
      await readFile(path.join(packageRoot, "package.json"), "utf8"),
    );
    const declared = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const file of await sourceFiles(path.join(packageRoot, "src"))) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/from\s+["'](@agp\/[^"']+)["']/gu)) {
        assert.equal(
          declared.has(match[1]),
          true,
          `${owner} undeclared import ${match[1]} in ${path.relative(root, file)}`,
        );
      }
    }
    await readFile(path.join(packageRoot, "dist/index.d.ts"), "utf8");
  }

  const temporary = await mkdtemp(path.join(os.tmpdir(), "agp-consumer-"));
  context.after(() => rm(temporary, { recursive: true, force: true }));
  await symlink(path.join(root, "node_modules"), path.join(temporary, "node_modules"));
  await writeFile(
    path.join(temporary, "consumer.ts"),
    owners
      .map((owner, index) => `import * as p${index} from "@agp/${owner}";`)
      .concat(["void [" + owners.map((_, index) => `p${index}`).join(",") + "];"])
      .join("\n"),
    "utf8",
  );
  await run(
    path.join(root, "node_modules/.bin/tsc"),
    [
      "--noEmit",
      "--strict",
      "--target", "ES2022",
      "--module", "NodeNext",
      "--moduleResolution", "NodeNext",
      "--lib", "ES2022,DOM",
      "consumer.ts",
    ],
    temporary,
  );
});
