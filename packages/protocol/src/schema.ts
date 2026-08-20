import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";

import catalogDocument from "./schemas/v1/catalog.json" with { type: "json" };
import { protocolSchemaDocumentsV1 } from "./schema-documents.generated.js";
import {
  validateCanonicalRouteRejections,
  validateCanonicalRouteSnapshot,
} from "./semantic.js";
import { inspectRuntimeJsonValue } from "./preflight.js";
import type {
  AgpMessage,
  JsonObject,
} from "./types.generated.js";
import type {
  SchemaValidationIssue,
  SchemaValidationResult,
  ValidationFailure,
  ValidationResult,
} from "./types.js";

const MESSAGE_SCHEMA_ID = "urn:agp:schema:v1:protocol:wire:message";

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

for (const document of protocolSchemaDocumentsV1) {
  ajv.addSchema(document);
  deepFreeze(document);
}
deepFreeze(catalogDocument);

const validators = new Map<string, ValidateFunction>();
for (const document of protocolSchemaDocumentsV1) {
  const id = document.$id;
  const validator = ajv.getSchema(id);
  if (validator === undefined) {
    throw new Error(`Protocol schema did not compile: ${id}`);
  }
  validators.set(id, validator);
}

const messageValidator = requireValidator(MESSAGE_SCHEMA_ID);
const messageDocument = protocolSchemaDocumentsV1.find(
  (document) => document.$id === MESSAGE_SCHEMA_ID,
);
if (messageDocument === undefined) {
  throw new Error(`Protocol message schema missing: ${MESSAGE_SCHEMA_ID}`);
}

export const agpMessageSchemaV1 =
  messageDocument as unknown as Readonly<JsonObject>;
export const protocolSchemaCatalogV1 =
  catalogDocument as unknown as Readonly<JsonObject>;

export const AGP_V1_SCHEMA_IDS = Object.freeze(
  catalogDocument.schemas.map((entry) => entry.id),
);

export function getProtocolSchema(
  schemaId: string,
): Readonly<JsonObject> | undefined {
  const document = protocolSchemaDocumentsV1.find(
    (candidate) => candidate.$id === schemaId,
  );
  return document as unknown as Readonly<JsonObject> | undefined;
}

export function validateProtocolSchema<T>(
  schemaId: string,
  value: unknown,
): SchemaValidationResult<T> {
  const runtimeFailure = inspectRuntimeJsonValue(value);
  if (runtimeFailure !== undefined) {
    return {
      ok: false,
      reasonCode: "SCHEMA",
      issues: [
        {
          instancePath: "",
          schemaPath: "",
          keyword: runtimeFailure,
        },
      ],
    };
  }

  const validator = validators.get(schemaId);
  if (validator === undefined) {
    throw new RangeError(`Unknown AGP protocol schema ID: ${schemaId}`);
  }
  try {
    if (validator(value)) {
      return { ok: true, value: value as T };
    }
    return {
      ok: false,
      reasonCode: "SCHEMA",
      issues: validationIssues(validator.errors),
    };
  } catch {
    return {
      ok: false,
      reasonCode: "SCHEMA",
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

export function validateAgpMessage(value: unknown): ValidationResult {
  const runtimeFailure = inspectRuntimeJsonValue(value);
  if (runtimeFailure !== undefined) {
    return invalidMessage(runtimeFailure);
  }

  if (!isObjectRecord(value)) {
    return invalidMessage("TOP_LEVEL_NOT_OBJECT");
  }

  const version = value["agp"];
  if (typeof version === "number" && version !== 1) {
    return {
      ok: false,
      reasonCode: "UNSUPPORTED_VERSION",
      notificationCode: "UNSUPPORTED_VERSION",
    };
  }

  try {
    if (!messageValidator(value)) {
      return invalidMessage("SCHEMA");
    }
  } catch {
    return invalidMessage("SCHEMA");
  }

  const message = value as unknown as AgpMessage;
  if (
    message.type === "route.update" &&
    !validateCanonicalRouteSnapshot(message.body.routes).ok
  ) {
    return invalidMessage("SCHEMA");
  }
  if (
    message.type === "route.ack" &&
    !validateCanonicalRouteRejections(message.body.rejected).ok
  ) {
    return invalidMessage("SCHEMA");
  }

  return { ok: true, message };
}

function invalidMessage(
  reasonCode: ValidationFailure["reasonCode"] & Exclude<
    ValidationFailure["reasonCode"],
    "UNSUPPORTED_VERSION"
  >,
): ValidationFailure {
  return {
    ok: false,
    reasonCode,
    notificationCode: "INVALID_MESSAGE",
  };
}

function requireValidator(schemaId: string): ValidateFunction {
  const validator = validators.get(schemaId);
  if (validator === undefined) {
    throw new Error(`Required AGP schema missing: ${schemaId}`);
  }
  return validator;
}

function validationIssues(
  errors: ErrorObject[] | null | undefined,
): readonly SchemaValidationIssue[] {
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  Object.freeze(value);
}
