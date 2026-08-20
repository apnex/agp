import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const roots = [
  path.join(root, "packages/protocol/src/schemas/v1"),
  path.join(root, "packages/transport/src/schemas/v1"),
  path.join(root, "packages/binding-websocket/src/schemas/v1"),
  path.join(root, "packages/transport-loopback/src/schemas/v1"),
  path.join(root, "packages/core/src/schemas/v1"),
  path.join(root, "packages/management-http/src/schemas/v1"),
];

async function schemaFiles(directory, output = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return output;
    throw error;
  }
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await schemaFiles(candidate, output);
    else if (entry.isFile() && entry.name.endsWith(".schema.json")) {
      output.push(candidate);
    }
  }
  return output;
}

test("Given package-owned sovereign schemas, when AX1 composes the root catalog, then identities, references, and committed digests are exact", async () => {
  const files = (await Promise.all(roots.map((directory) => schemaFiles(directory))))
    .flat()
    .sort();
  assert.ok(files.length > 0, "sovereign schema files exist");

  const documents = [];
  const calculated = [];
  for (const file of files) {
    const bytes = await readFile(file);
    const document = JSON.parse(bytes.toString("utf8"));
    assert.equal(typeof document.$id, "string", file);
    assert.equal(document.$schema, "https://json-schema.org/draft/2020-12/schema");
    documents.push(document);
    calculated.push({
      id: document.$id,
      path: path.relative(root, file).replaceAll(path.sep, "/"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const identities = documents.map(({ $id }) => $id);
  assert.equal(new Set(identities).size, identities.length, "$id values are unique");

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
  for (const document of documents) ajv.addSchema(document);
  for (const identity of identities) {
    assert.ok(ajv.getSchema(identity), `compiled schema ${identity}`);
  }

  const catalog = JSON.parse(
    await readFile(path.join(root, "schemas/agp-v1.schema-catalog.json"), "utf8"),
  );
  assert.equal(catalog.schemaVersion, "agp.schema-catalog/v1");
  assert.deepEqual(catalog.schemas, calculated);
});
