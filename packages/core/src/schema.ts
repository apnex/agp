import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import {
  AGP_V1_SCHEMA_IDS,
  getProtocolSchema,
  type JsonObject,
} from "@agp/protocol";
import {
  AGP_TRANSPORT_V1_SCHEMA_IDS,
  getTransportSchema,
} from "@agp/transport";
import catalog from "./schemas/v1/catalog.json" with { type: "json" };
import semanticCatalog from "./semantic-rules/v1/semantic-rules.catalog.json" with {
  type: "json",
};
import { coreSchemaDocumentsV1 } from "./schema-documents.generated.js";

export interface CoreSchemaIssue {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
}

export type CoreSchemaResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly CoreSchemaIssue[] };

const ajv = new Ajv2020({
  allErrors: true,
  strictSchema: true,
  strictTypes: false,
  strictTuples: true,
  validateFormats: false,
});
ajv.addKeyword({ keyword: "x-agp", schemaType: "object", valid: true });
for (const id of AGP_V1_SCHEMA_IDS) {
  const schema = getProtocolSchema(id);
  if (schema !== undefined) ajv.addSchema(schema);
}
for (const id of AGP_TRANSPORT_V1_SCHEMA_IDS) {
  const schema = getTransportSchema(id);
  if (schema !== undefined) ajv.addSchema(schema);
}
for (const document of coreSchemaDocumentsV1) ajv.addSchema(document);

const validators = new Map<string, ValidateFunction>();
for (const document of coreSchemaDocumentsV1) {
  const id = document["$id"];
  if (typeof id !== "string") throw new Error("Core schema has no $id");
  const validator = ajv.getSchema(id);
  if (validator === undefined) throw new Error(`Core schema did not compile: ${id}`);
  validators.set(id, validator);
  deepFreeze(document);
}

export const AGP_CORE_V1_SCHEMAS =
  coreSchemaDocumentsV1 as readonly Readonly<JsonObject>[];
/**
 * Exact externally owned schema documents required to compile the core
 * catalog. Downstream schema registries consume this set through @agp/core
 * without importing or copying an owner package's definitions.
 */
export const AGP_CORE_V1_SCHEMA_DEPENDENCIES = Object.freeze([
  ...AGP_V1_SCHEMA_IDS.flatMap((id) => {
    const schema = getProtocolSchema(id);
    return schema === undefined ? [] : [schema];
  }),
  ...AGP_TRANSPORT_V1_SCHEMA_IDS.flatMap((id) => {
    const schema = getTransportSchema(id);
    return schema === undefined ? [] : [schema];
  }),
]) as readonly Readonly<Record<string, unknown>>[];
export const AGP_CORE_V1_SCHEMA_IDS = Object.freeze(
  catalog.schemas.map((entry) => entry.id),
);
export const AGP_CORE_V1_SCHEMA_BY_ID = Object.freeze(
  Object.fromEntries(AGP_CORE_V1_SCHEMAS.map((schema) => [schema["$id"], schema])),
) as Readonly<Record<string, Readonly<JsonObject>>>;
export const coreSchemaCatalogV1 = deepFreeze(catalog) as Readonly<JsonObject>;
export const coreSemanticRulesCatalogV1 =
  deepFreeze(semanticCatalog) as Readonly<JsonObject>;

export function getCoreSchema(id: string): Readonly<JsonObject> | undefined {
  return AGP_CORE_V1_SCHEMA_BY_ID[id];
}

export function validateCoreSchema<T>(
  id: string,
  value: unknown,
): CoreSchemaResult<T> {
  const validator = validators.get(id);
  if (validator === undefined) throw new RangeError(`Unknown AGP core schema ID: ${id}`);
  if (validator(value)) return { ok: true, value: value as T };
  return {
    ok: false,
    issues: Object.freeze((validator.errors ?? []).map(toIssue)),
  };
}

export function assertCoreSchema<T>(id: string, value: unknown): asserts value is T {
  const result = validateCoreSchema<T>(id, value);
  if (!result.ok) {
    throw new TypeError(
      `AGP core schema validation failed for ${id}: `
        + result.issues.map((issue) =>
          `${issue.instancePath || "/"} ${issue.keyword}`).join(", "),
    );
  }
}

function toIssue(error: ErrorObject): CoreSchemaIssue {
  return Object.freeze({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
  });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
