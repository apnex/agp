import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "schemas/agp-v1.schema-catalog.json");
const semanticOutputPath = path.join(
  root,
  "schemas/agp-v1.semantic-rules.json",
);
const schemaRoots = [
  "packages/protocol/src/schemas/v1",
  "packages/transport/src/schemas/v1",
  "packages/binding-websocket/src/schemas/v1",
  "packages/transport-loopback/src/schemas/v1",
  "packages/core/src/schemas/v1",
  "packages/management-http/src/schemas/v1",
].map((entry) => path.join(root, entry));
const semanticCatalogPaths = [
  "packages/protocol/src/semantic-rules/v1/semantic-rules.catalog.json",
  "packages/transport-loopback/src/semantic-rules/v1/semantic-rules.catalog.json",
  "packages/core/src/semantic-rules/v1/semantic-rules.catalog.json",
].map((entry) => path.join(root, entry));

async function collect(directory, output) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(candidate, output);
    else if (entry.isFile() && entry.name.endsWith(".schema.json")) {
      output.push(candidate);
    }
  }
}

const files = [];
for (const directory of schemaRoots) await collect(directory, files);
files.sort();
const schemas = [];
for (const file of files) {
  const bytes = await readFile(file);
  const document = JSON.parse(bytes.toString("utf8"));
  if (typeof document.$id !== "string") {
    throw new Error(`schema has no $id: ${path.relative(root, file)}`);
  }
  schemas.push({
    id: document.$id,
    path: path.relative(root, file).replaceAll(path.sep, "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const encoded = `${JSON.stringify({
  schemaVersion: "agp.schema-catalog/v1",
  schemas,
}, null, 2)}\n`;
const semanticEncoded = await composeSemanticRegistry();

if (process.argv.includes("--check")) {
  const committed = await readFile(outputPath, "utf8");
  if (committed !== encoded) {
    process.stderr.write("schema catalog is stale; run npm run schemas:generate\n");
    process.exit(1);
  }
  const committedSemantic = await readFile(semanticOutputPath, "utf8");
  if (committedSemantic !== semanticEncoded) {
    process.stderr.write(
      "semantic rule registry is stale; run npm run schemas:generate\n",
    );
    process.exit(1);
  }
} else {
  await writeFile(outputPath, encoded);
  await writeFile(semanticOutputPath, semanticEncoded);
}

async function composeSemanticRegistry() {
  const current = JSON.parse(await readFile(semanticOutputPath, "utf8"));
  if (
    current?.schemaVersion !== "agp.semantic-rules/v1"
    || !Array.isArray(current.rules)
  ) {
    throw new Error("root semantic rule registry has an invalid envelope");
  }

  const replacements = new Map();
  for (const catalogPath of semanticCatalogPaths) {
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    if (
      catalog?.schemaVersion !== "agp.semantic-rules/v1"
      || typeof catalog.owner !== "string"
      || !Array.isArray(catalog.rules)
    ) {
      throw new Error(
        `package semantic catalog has an invalid envelope: ${
          path.relative(root, catalogPath)
        }`,
      );
    }
    if (replacements.has(catalog.owner)) {
      throw new Error(`duplicate semantic catalog owner: ${catalog.owner}`);
    }
    replacements.set(catalog.owner, catalog.rules);
  }

  const emittedOwners = new Set();
  const rules = [];
  for (const rule of current.rules) {
    const replacement = replacements.get(rule.owner);
    if (replacement === undefined) {
      rules.push(rule);
      continue;
    }
    if (emittedOwners.has(rule.owner)) continue;
    emittedOwners.add(rule.owner);
    rules.push(...replacement.map((ownedRule) =>
      ruleWithOwner(ownedRule, rule.owner)
    ));
  }
  for (const [owner, replacement] of replacements) {
    if (emittedOwners.has(owner)) continue;
    rules.push(...replacement.map((rule) => ruleWithOwner(rule, owner)));
  }

  return `${JSON.stringify({
    schemaVersion: "agp.semantic-rules/v1",
    rules,
  }, null, 2)}\n`;
}

function ruleWithOwner(rule, owner) {
  const { id, owner: _catalogOwner, ...fields } = rule;
  if (typeof id !== "string") {
    throw new Error(`semantic rule owned by ${owner} has no id`);
  }
  return { id, owner, ...fields };
}
