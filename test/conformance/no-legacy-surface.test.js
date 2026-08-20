import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("given the ratified in-place v1 replacement, when the public workspace surface is inspected, then only the uniform node runtime remains and no router or spoke package survives", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const lock = await readFile(path.join(root, "package-lock.json"), "utf8");

  assert.equal(manifest.workspaces.includes("packages/node"), true);
  assert.equal(manifest.workspaces.includes("packages/transport"), true);
  assert.equal(manifest.workspaces.includes("packages/binding-websocket"), true);
  assert.equal(manifest.workspaces.includes("packages/transport-loopback"), true);
  assert.equal(manifest.workspaces.includes("packages/transport-node-ws"), true);
  assert.equal(manifest.workspaces.includes("packages/router"), false);
  assert.equal(manifest.workspaces.includes("packages/spoke"), false);
  assert.equal(existsSync(path.join(root, "packages/router/package.json")), false);
  assert.equal(existsSync(path.join(root, "packages/spoke/package.json")), false);
  assert.doesNotMatch(lock, /@agp\/(?:router|spoke)|packages\/(?:router|spoke)/u);
});
