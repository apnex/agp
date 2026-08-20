import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("Given the semantic rule registry, when AX2 resolves its ownership graph, then every rule has one schema reference, implementation, and orthogonal primary test", async () => {
  const registry = JSON.parse(
    await readFile(path.join(root, "schemas/agp-v1.semantic-rules.json"), "utf8"),
  );
  const schema = JSON.parse(
    await readFile(
      path.join(root, "schemas/agp-v1.semantic-rules.schema.json"),
      "utf8",
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  assert.equal(
    ajv.validate(schema, registry),
    true,
    ajv.errorsText(ajv.errors),
  );

  const ids = registry.rules.map(({ id }) => id);
  const tests = registry.rules.map(({ owningTest }) => owningTest);
  assert.equal(new Set(ids).size, ids.length, "semantic IDs are unique");
  assert.equal(new Set(tests).size, tests.length, "primary tests are orthogonal");

  const schemaRuleReferences = new Set();
  const schemaIds = new Set();
  const queue = [
    path.join(root, "packages/protocol/src/schemas/v1"),
    path.join(root, "packages/transport/src/schemas/v1"),
    path.join(root, "packages/binding-websocket/src/schemas/v1"),
    path.join(root, "packages/transport-loopback/src/schemas/v1"),
    path.join(root, "packages/core/src/schemas/v1"),
  ];
  while (queue.length > 0) {
    const directory = queue.pop();
    let entries;
    try {
      entries = await import("node:fs/promises").then(({ readdir }) =>
        readdir(directory, { withFileTypes: true }),
      );
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) queue.push(candidate);
      else if (entry.isFile() && entry.name.endsWith(".schema.json")) {
        const document = JSON.parse(await readFile(candidate, "utf8"));
        if (typeof document.$id === "string") schemaIds.add(document.$id);
        const encoded = JSON.stringify(document);
        for (const rule of registry.rules) {
          if (encoded.includes(`"${rule.id}"`)) schemaRuleReferences.add(rule.id);
        }
      }
    }
  }

  for (const rule of registry.rules) {
    for (const inputSchemaId of rule.inputSchemaIds) {
      assert.equal(
        schemaIds.has(inputSchemaId),
        true,
        `${rule.id} input schema ${inputSchemaId}`,
      );
    }
    assert.equal(
      schemaRuleReferences.has(rule.id),
      true,
      `${rule.id} must be named by x-agp.semanticRules`,
    );
    const implementationFile = path.join(
      root,
      rule.implementation.split("#")[0],
    );
    const implementationSymbol = rule.implementation.split("#")[1];
    const source = await readFile(implementationFile, "utf8");
    assert.match(
      source,
      new RegExp(`\\b${implementationSymbol}\\b`, "u"),
      rule.implementation,
    );
    const testSource = await readFile(path.join(root, rule.owningTest), "utf8");
    assert.match(testSource, /\btest\s*\(/u, rule.owningTest);
  }
});
