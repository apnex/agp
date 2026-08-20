import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaRoot = path.join(
  root,
  "packages/core/src/schemas/v1",
);

test("Given the core event catalog, when AX1 resolves every concrete event and data contract, then each has one sovereign identity and the closed union references every event exactly once", async () => {
  const catalog = JSON.parse(
    await readFile(path.join(schemaRoot, "catalog.json"), "utf8"),
  );
  const entries = catalog.schemas.filter(({ kind }) =>
    kind === "event" || kind === "event-data"
  );
  const events = entries.filter(({ kind }) => kind === "event");
  const data = entries.filter(({ kind }) => kind === "event-data");
  const unionEntry = catalog.schemas.find(
    ({ id }) => id === "urn:agp:schema:v1:core:event:operational-event",
  );

  assert.ok(unionEntry);
  assert.equal(events.length, data.length);
  assert.equal(new Set(entries.map(({ id }) => id)).size, entries.length);
  assert.equal(
    new Set(entries.map(({ typescript }) => typescript)).size,
    entries.length,
  );

  const documents = new Map();
  for (const entry of entries) {
    const document = JSON.parse(
      await readFile(path.join(schemaRoot, entry.path), "utf8"),
    );
    assert.equal(document.$id, entry.id);
    assert.equal(document["x-agp"].owner, "@agp/core");
    assert.equal(document["x-agp"].typescript, entry.typescript);
    assert.equal(document["x-agp"].kind, entry.kind);
    documents.set(entry.id, document);
  }

  const union = JSON.parse(
    await readFile(path.join(schemaRoot, unionEntry.path), "utf8"),
  );
  const unionReferences = union.oneOf.map((branch) => branch.$ref);
  assert.equal(new Set(unionReferences).size, unionReferences.length);
  assert.deepEqual(
    [...unionReferences].sort(),
    events.map(({ id }) => id).sort(),
  );

  for (const event of events) {
    const document = documents.get(event.id);
    const kind = document.properties.kind.const;
    const dataReference = document.properties.data.$ref;
    assert.equal(typeof kind, "string");
    assert.equal(
      dataReference,
      `urn:agp:schema:v1:core:event:${kind.replaceAll(".", "-")}-data`,
    );
    assert.ok(documents.has(dataReference));
  }
});
