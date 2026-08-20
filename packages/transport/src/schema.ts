import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import catalog from "./schemas/v1/catalog.json" with { type: "json" };
import { transportSchemaDocumentsV1 } from "./schema-documents.generated.js";
import type { TransportRef } from "./types.generated.js";

export interface TransportSchemaIssue {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
}

export type TransportSchemaResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly TransportSchemaIssue[] };

const ajv = new Ajv2020({
  allErrors: true,
  strictSchema: true,
  strictTypes: false,
  strictTuples: true,
  validateFormats: false,
});
ajv.addKeyword({ keyword: "x-agp", schemaType: "object", valid: true });
for (const document of transportSchemaDocumentsV1) ajv.addSchema(document);

const validators = new Map<string, ValidateFunction>();
for (const document of transportSchemaDocumentsV1) {
  const id = document["$id"];
  if (typeof id !== "string") throw new Error("Transport schema has no $id");
  const validator = ajv.getSchema(id);
  if (validator === undefined) {
    throw new Error(`Transport schema did not compile: ${id}`);
  }
  validators.set(id, validator);
  deepFreeze(document);
}
deepFreeze(catalog);

export const AGP_TRANSPORT_V1_SCHEMAS =
  transportSchemaDocumentsV1 as readonly Readonly<Record<string, unknown>>[];
export const AGP_TRANSPORT_V1_SCHEMA_IDS = Object.freeze(
  catalog.schemas.map((entry) => entry.id),
);
export const transportSchemaCatalogV1 =
  catalog as Readonly<Record<string, unknown>>;

export function getTransportSchema(
  id: string,
): Readonly<Record<string, unknown>> | undefined {
  return AGP_TRANSPORT_V1_SCHEMAS.find((document) => document["$id"] === id);
}

export function validateTransportSchema<T>(
  id: string,
  value: unknown,
): TransportSchemaResult<T> {
  const validator = validators.get(id);
  if (validator === undefined) {
    throw new RangeError(`Unknown AGP transport schema ID: ${id}`);
  }
  if (validator(value)) return { ok: true, value: value as T };
  return {
    ok: false,
    issues: Object.freeze((validator.errors ?? []).map(toIssue)),
  };
}

export function assertTransportSchema<T>(
  id: string,
  value: unknown,
): asserts value is T {
  const result = validateTransportSchema<T>(id, value);
  if (!result.ok) {
    throw new TypeError(
      `AGP transport schema validation failed for ${id}: `
      + result.issues.map((issue) =>
        `${issue.instancePath || "/"} ${issue.keyword}`).join(", "),
    );
  }
}

export function isTransportRef(value: unknown): value is TransportRef {
  return validateTransportSchema<TransportRef>(
    "urn:agp:schema:v1:transport:common:transport-ref",
    value,
  ).ok;
}

function toIssue(error: ErrorObject): TransportSchemaIssue {
  return Object.freeze({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
  });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
