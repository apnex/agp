import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGP_CORE_V1_SCHEMA_DEPENDENCIES,
  AGP_CORE_V1_SCHEMA_IDS,
} from "@agp/core";
import {
  AGP_MANAGEMENT_V1_SCHEMA_BY_ID,
  AGP_MANAGEMENT_V1_SCHEMAS,
  MANAGEMENT_SCHEMA_IDS,
  managementSchemaCatalogV1,
} from "../../dist/index.js";

test("Given the management v1 catalog, when every entry is audited, then twelve sovereign response contracts have exact identities, owners, digests, generated types, and resolvable external references", async () => {
  assert.equal(managementSchemaCatalogV1.owner, "@agp/management-http");
  assert.equal(managementSchemaCatalogV1.schemas.length, 12);
  assert.equal(AGP_MANAGEMENT_V1_SCHEMAS.length, 12);
  assert.equal(AGP_MANAGEMENT_V1_SCHEMA_BY_ID.size, 12);

  const knownIds = new Set([
    ...AGP_CORE_V1_SCHEMA_DEPENDENCIES.map((schema) => schema.$id),
    ...AGP_CORE_V1_SCHEMA_IDS,
    ...Object.values(MANAGEMENT_SCHEMA_IDS),
  ]);
  for (const entry of managementSchemaCatalogV1.schemas) {
    const sourceUrl = new URL(
      `../../src/schemas/v1/${entry.path}`,
      import.meta.url,
    );
    const bytes = await readFile(sourceUrl);
    const source = JSON.parse(bytes);
    assert.equal(source.$id, entry.id);
    assert.equal(source["x-agp"].owner, "@agp/management-http");
    assert.equal(source["x-agp"].typescript, entry.typescript);
    assert.equal(source.$defs, undefined);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
    );

    walk(source, (value, key) => {
      if (key === "$ref") {
        assert.equal(
          knownIds.has(value),
          true,
          `${entry.id} has unresolved reference ${value}`,
        );
      }
    });
  }
});

test("Given the response metadata and response schemas, when topology-neutrality is inspected, then schemaVersion, role, generic entity escape hatches, and inline named definitions are absent", () => {
  const meta = AGP_MANAGEMENT_V1_SCHEMA_BY_ID.get(
    MANAGEMENT_SCHEMA_IDS.responseMeta,
  );
  assert.deepEqual(meta.required, [
    "nodeId",
    "instanceId",
    "capturedAt",
    "revision",
  ]);
  assert.equal(meta.properties.role, undefined);
  assert.equal(meta.properties.schemaVersion, undefined);

  const source = JSON.stringify(AGP_MANAGEMENT_V1_SCHEMAS);
  assert.doesNotMatch(source, /"role"/);
  assert.doesNotMatch(source, /"\$defs"/);
  assert.doesNotMatch(source, /"entity"/);
});

function walk(value, visitor) {
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(child, key);
    walk(child, visitor);
  }
}
