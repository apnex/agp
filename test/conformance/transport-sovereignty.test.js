import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const internalDependencies = new Map([
  ["protocol", []],
  ["transport", []],
  ["binding-websocket", ["@agp/transport"]],
  ["transport-loopback", ["@agp/transport"]],
  ["core", ["@agp/protocol", "@agp/transport"]],
  ["transport-node-ws", ["@agp/binding-websocket", "@agp/transport"]],
  ["node", ["@agp/core", "@agp/protocol", "@agp/transport"]],
  ["management-http", ["@agp/core"]],
]);

async function sourceFiles(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await sourceFiles(candidate, output);
    else if (
      entry.isFile()
      && (entry.name.endsWith(".ts") || entry.name.endsWith(".json"))
    ) {
      output.push(candidate);
    }
  }
  return output;
}

async function joinedSource(packageName) {
  const directory = path.join(root, "packages", packageName, "src");
  const files = await sourceFiles(directory);
  return (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
}

test("Given the frozen package graph and target vocabulary, when AX1-D inspects production manifests and sources, then carrier semantics remain in sovereign adapter owners", async () => {
  for (const [packageName, expected] of internalDependencies) {
    const manifest = JSON.parse(
      await readFile(path.join(root, "packages", packageName, "package.json"), "utf8"),
    );
    const actual = Object.keys(manifest.dependencies ?? {})
      .filter((dependency) => dependency.startsWith("@agp/"))
      .sort();
    assert.deepEqual(actual, [...expected].sort(), packageName);
  }

  const protocol = await joinedSource("protocol");
  const transport = await joinedSource("transport");
  const core = await joinedSource("core");
  const node = await joinedSource("node");
  for (const [owner, source] of [
    ["protocol", protocol],
    ["transport", transport],
    ["core", core],
    ["node", node],
  ]) {
    assert.doesNotMatch(
      source,
      /(?:from\s+["'](?:ws|@agp\/binding-websocket|@agp\/transport-node-ws)|WebSocketServer)/u,
      owner,
    );
  }

  assert.doesNotMatch(transport, /\b(?:sendText|selectedSubprotocol|listenerUrl)\b/u);
  assert.doesNotMatch(node, /\b(?:sendText|selectedSubprotocol|handshakeContext)\b/u);
  assert.doesNotMatch(
    core,
    /configuration:(?:websocket|transport-security)/u,
  );

  const binding = await joinedSource("binding-websocket");
  assert.match(binding, /\bagp\.v1\b/u);
  assert.match(binding, /\bWebSocket/u);
  const loopback = await joinedSource("transport-loopback");
  assert.doesNotMatch(loopback, /@agp\/(?:core|node|protocol)/u);
});
