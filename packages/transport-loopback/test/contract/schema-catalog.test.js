import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogUrl = new URL(
  "../../dist/schemas/v1/catalog.json",
  import.meta.url,
);
const semanticUrl = new URL(
  "../../dist/semantic-rules/v1/semantic-rules.catalog.json",
  import.meta.url,
);
const failureUrl = new URL(
  "../../dist/schemas/v1/operations/fabric-failure-snapshot.schema.json",
  import.meta.url,
);

test("given the built package when its schema catalog is read then all sovereign records are closed and cataloged", async () => {
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  assert.equal(catalog.schemaVersion, "agp.schema-catalog/v1");
  assert.equal(catalog.schemas.length, 19);
  assert.equal(
    new Set(catalog.schemas.map((entry) => entry.id)).size,
    19,
  );

  for (const entry of catalog.schemas) {
    const document = JSON.parse(
      await readFile(
        new URL(
          `../../dist/schemas/v1/${entry.path}`,
          import.meta.url,
        ),
      ),
    );
    assert.equal(document.$id, entry.id);
    assertClosedObjectSchemas(document);
  }
});

test("given semantic rules when their implementations are resolved then the anchors name production source functions", async () => {
  const catalog = JSON.parse(await readFile(semanticUrl, "utf8"));
  const implementations = catalog.rules.map(
    (rule) => rule.implementation,
  );
  assert.ok(
    implementations.includes(
      "packages/transport-loopback/src/fabric.ts#createLoopbackFabric",
    ),
  );
  assert.ok(
    implementations.includes(
      "packages/transport-loopback/src/operations.ts#snapshot",
    ),
  );
  assert.ok(
    implementations.includes(
      "packages/transport-loopback/src/operations.ts#preflightMonotonicDomain",
    ),
  );
  assert.ok(
    implementations.includes(
      "packages/transport-loopback/src/fabric.ts#failAdapterInvariant",
    ),
  );
});

test("given the closed fabric failure union when its discriminants are inspected then adapter faults cannot masquerade as monotonic exhaustion", async () => {
  const schema = JSON.parse(await readFile(failureUrl, "utf8"));
  assert.deepEqual(
    schema.oneOf.map((variant) => variant.properties.code.const),
    [
      "ADAPTER_FAULT",
      "MONOTONIC_DOMAIN_EXHAUSTED",
      "MONOTONIC_DOMAIN_EXHAUSTED",
    ],
  );
  assert.equal("domain" in schema.oneOf[0].properties, false);
  assert.deepEqual(
    schema.oneOf[1].properties.domain.enum,
    ["revision", "arbitration-sequence"],
  );
  assert.equal(schema.oneOf[2].properties.domain.const, "counter");
});

function assertClosedObjectSchemas(value) {
  if (value === null || typeof value !== "object") return;
  if (value.type === "object") {
    assert.equal(value.additionalProperties, false);
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const entry of child) assertClosedObjectSchemas(entry);
    } else {
      assertClosedObjectSchemas(child);
    }
  }
}
