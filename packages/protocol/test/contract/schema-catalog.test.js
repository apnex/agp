import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGP_V1_SCHEMA_IDS,
  agpMessageSchemaV1,
  getProtocolSchema,
  protocolSchemaCatalogV1,
} from "../../dist/index.js";

test("Given the package schema catalog, when every entry is audited, then each sovereign identity, path, digest, reference, and generated type is exact", async () => {
  assert.equal(protocolSchemaCatalogV1.schemaVersion, "agp.schema-catalog/v1");
  assert.equal(protocolSchemaCatalogV1.owner, "@agp/protocol");
  assert.equal(protocolSchemaCatalogV1.schemas.length, 36);
  assert.equal(
    new Set(protocolSchemaCatalogV1.schemas.map((entry) => entry.id)).size,
    36,
  );
  assert.deepEqual(
    [...AGP_V1_SCHEMA_IDS],
    protocolSchemaCatalogV1.schemas.map((entry) => entry.id),
  );

  const knownIds = new Set(AGP_V1_SCHEMA_IDS);
  for (const entry of protocolSchemaCatalogV1.schemas) {
    const sourceUrl = new URL(
      `../../src/schemas/v1/${entry.path}`,
      import.meta.url,
    );
    const bytes = await readFile(sourceUrl);
    const source = JSON.parse(bytes);

    assert.equal(source.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(source.$id, entry.id);
    assert.equal(source["x-agp"].owner, "@agp/protocol");
    assert.equal(source["x-agp"].typescript, entry.typescript);
    assert.ok(source.description.length > 0);
    assert.ok(source["x-agp"].mechanics.length > 0);
    assert.ok(source["x-agp"].rationale.length > 0);
    assert.ok(source["x-agp"].consequence.length > 0);
    assert.equal(source.$defs, undefined);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
    );
    assert.deepEqual(getProtocolSchema(entry.id), source);

    walk(source, (value, key) => {
      if (key === "$ref") {
        assert.equal(
          knownIds.has(value),
          true,
          `${entry.id} has unresolved reference ${value}`,
        );
      }
      if (key === "properties") {
        for (const [propertyName, propertySchema] of Object.entries(value)) {
          assert.equal(
            typeof propertySchema.description,
            "string",
            `${entry.id} property ${propertyName} has no description`,
          );
        }
      }
    });
  }
});

test("Given the root message schema, when its composition is inspected, then it contains only the seven external wire-message references and immutable metadata", () => {
  assert.equal(Object.isFrozen(agpMessageSchemaV1), true);
  assert.equal(agpMessageSchemaV1.oneOf.length, 7);
  assert.deepEqual(
    agpMessageSchemaV1.oneOf.map((entry) => Object.keys(entry)),
    Array.from({ length: 7 }, () => ["$ref"]),
  );
  assert.deepEqual(
    agpMessageSchemaV1.oneOf.map((entry) => entry.$ref),
    [
      "urn:agp:schema:v1:protocol:wire:open-message",
      "urn:agp:schema:v1:protocol:wire:keepalive-message",
      "urn:agp:schema:v1:protocol:wire:route-update-message",
      "urn:agp:schema:v1:protocol:wire:route-ack-message",
      "urn:agp:schema:v1:protocol:wire:notification-message",
      "urn:agp:schema:v1:protocol:wire:disposition-message",
      "urn:agp:schema:v1:protocol:wire:data-message",
    ],
  );
});

function walk(value, visitor) {
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visitor(child, key);
    walk(child, visitor);
  }
}
