import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import {
  AGP_CORE_V1_SCHEMA_DEPENDENCIES,
  AGP_CORE_V1_SCHEMAS,
  type JsonObject,
} from "@agp/core";

import catalogDocument from "./schemas/v1/catalog.json" with { type: "json" };
import { AGP_MANAGEMENT_V1_SCHEMAS } from "./schema-documents.generated.js";
import type {
  ManagementSchemaValidationIssue,
  ManagementSchemaValidationResult,
} from "./types.js";

export const MANAGEMENT_SCHEMA_IDS = Object.freeze({
  responseMeta: "urn:agp:schema:v1:management:response-meta",
  errorResponse: "urn:agp:schema:v1:management:error-response",
  healthResponse: "urn:agp:schema:v1:management:health-response",
  operationsResponse: "urn:agp:schema:v1:management:operations-response",
  configurationResponse:
    "urn:agp:schema:v1:management:configuration-response",
  localEndpointsResponse:
    "urn:agp:schema:v1:management:local-endpoints-response",
  connectionsResponse:
    "urn:agp:schema:v1:management:connections-response",
  advertisementsResponse:
    "urn:agp:schema:v1:management:advertisements-response",
  routesResponse: "urn:agp:schema:v1:management:routes-response",
  forwardingResponse:
    "urn:agp:schema:v1:management:forwarding-response",
  resourcesResponse: "urn:agp:schema:v1:management:resources-response",
  countersResponse: "urn:agp:schema:v1:management:counters-response",
} as const);

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: false,
  messages: false,
  strictSchema: true,
  strictTypes: false,
  strictTuples: true,
  unicodeRegExp: true,
  validateFormats: false,
});
ajv.addKeyword({
  keyword: "x-agp",
  schemaType: "object",
  valid: true,
});

for (const document of AGP_CORE_V1_SCHEMA_DEPENDENCIES) {
  ajv.addSchema(document);
}
for (const document of AGP_CORE_V1_SCHEMAS) {
  ajv.addSchema(document);
}
for (const document of AGP_MANAGEMENT_V1_SCHEMAS) {
  ajv.addSchema(document);
  deepFreeze(document);
}
deepFreeze(catalogDocument);

const validators = new Map<string, ValidateFunction>();
for (const document of AGP_MANAGEMENT_V1_SCHEMAS) {
  const validator = ajv.getSchema(document.$id);
  if (validator === undefined) {
    throw new Error(`Management schema did not compile: ${document.$id}`);
  }
  validators.set(document.$id, validator);
}

export { AGP_MANAGEMENT_V1_SCHEMAS };
export const managementSchemaCatalogV1 =
  catalogDocument as unknown as Readonly<JsonObject>;
export const AGP_MANAGEMENT_V1_SCHEMA_BY_ID = new Map(
  AGP_MANAGEMENT_V1_SCHEMAS.map(
    (document) =>
      [document.$id, document] as const,
  ),
);

export function validateManagementSchema<T>(
  schemaId: string,
  value: unknown,
): ManagementSchemaValidationResult<T> {
  const validator = validators.get(schemaId);
  if (validator === undefined) {
    throw new RangeError(`Unknown AGP management schema ID: ${schemaId}`);
  }
  try {
    if (validator(value)) {
      return { ok: true, value: value as T };
    }
    return {
      ok: false,
      issues: validationIssues(validator.errors),
    };
  } catch {
    return {
      ok: false,
      issues: [
        {
          instancePath: "",
          schemaPath: "",
          keyword: "SCHEMA",
        },
      ],
    };
  }
}

function validationIssues(
  errors: ErrorObject[] | null | undefined,
): readonly ManagementSchemaValidationIssue[] {
  return Object.freeze(
    (errors ?? []).map((error) =>
      Object.freeze({
        instancePath: error.instancePath,
        schemaPath: error.schemaPath,
        keyword: error.keyword,
      }),
    ),
  );
}

function deepFreeze(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  Object.freeze(value);
}
