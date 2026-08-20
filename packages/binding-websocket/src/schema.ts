import {
  AGP_TRANSPORT_V1_SCHEMAS,
} from "@agp/transport";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";

import catalog from "./schemas/v1/catalog.json" with { type: "json" };
import { webSocketBindingSchemaDocumentsV1 } from "./schema-documents.generated.js";

export interface WebSocketBindingSchemaIssue {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
}

export type WebSocketBindingSchemaResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly issues: readonly WebSocketBindingSchemaIssue[];
    };

const ajv = new Ajv2020({
  allErrors: true,
  strictSchema: true,
  strictTypes: false,
  strictTuples: true,
  validateFormats: false,
});
ajv.addKeyword({ keyword: "x-agp", schemaType: "object", valid: true });
for (const document of AGP_TRANSPORT_V1_SCHEMAS) ajv.addSchema(document);
for (const document of webSocketBindingSchemaDocumentsV1) {
  ajv.addSchema(document);
}

const validators = new Map<string, ValidateFunction>();
for (const document of webSocketBindingSchemaDocumentsV1) {
  const id = document["$id"];
  if (typeof id !== "string") {
    throw new Error("WebSocket binding schema has no $id");
  }
  const validator = ajv.getSchema(id);
  if (validator === undefined) {
    throw new Error(`WebSocket binding schema did not compile: ${id}`);
  }
  validators.set(id, validator);
  deepFreeze(document);
}
deepFreeze(catalog);

export const AGP_WEBSOCKET_BINDING_V1_SCHEMAS =
  webSocketBindingSchemaDocumentsV1 as
    readonly Readonly<Record<string, unknown>>[];
export const AGP_WEBSOCKET_BINDING_V1_SCHEMA_IDS = Object.freeze(
  catalog.schemas.map((entry) => entry.id),
);
export const webSocketBindingSchemaCatalogV1 =
  catalog as Readonly<Record<string, unknown>>;

export function getWebSocketBindingSchema(
  id: string,
): Readonly<Record<string, unknown>> | undefined {
  return AGP_WEBSOCKET_BINDING_V1_SCHEMAS.find(
    (document) => document["$id"] === id,
  );
}

export function validateWebSocketBindingSchema<T>(
  id: string,
  value: unknown,
): WebSocketBindingSchemaResult<T> {
  const validator = validators.get(id);
  if (validator === undefined) {
    throw new RangeError(`Unknown AGP WebSocket binding schema ID: ${id}`);
  }
  if (validator(value)) return { ok: true, value: value as T };
  return {
    ok: false,
    issues: Object.freeze((validator.errors ?? []).map(toIssue)),
  };
}

function toIssue(error: ErrorObject): WebSocketBindingSchemaIssue {
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
