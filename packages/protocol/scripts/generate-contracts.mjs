import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemasRoot = resolve(packageRoot, "src/schemas/v1");
const checkOnly = process.argv.includes("--check");
const draft = "https://json-schema.org/draft/2020-12/schema";
const owner = "@agp/protocol";
const schemas = [];

const ids = Object.freeze({
  nodeId: "urn:agp:schema:v1:protocol:common:node-id",
  sessionId: "urn:agp:schema:v1:protocol:common:session-id",
  messageId: "urn:agp:schema:v1:protocol:common:message-id",
  returnToken: "urn:agp:schema:v1:protocol:common:return-token",
  correlationId: "urn:agp:schema:v1:protocol:common:correlation-id",
  endpointName: "urn:agp:schema:v1:protocol:common:endpoint-name",
  wireRevision: "urn:agp:schema:v1:protocol:common:wire-revision",
  jsonValue: "urn:agp:schema:v1:protocol:common:json-value",
  jsonObject: "urn:agp:schema:v1:protocol:common:json-object",
  extensions: "urn:agp:schema:v1:protocol:common:extensions",
  nodePath: "urn:agp:schema:v1:protocol:common:node-path",
  fatalNotificationCode:
    "urn:agp:schema:v1:protocol:codes:fatal-notification-code",
  deliveryErrorCode: "urn:agp:schema:v1:protocol:codes:delivery-error-code",
  routeRejectionCode:
    "urn:agp:schema:v1:protocol:codes:route-rejection-code",
  routeKey: "urn:agp:schema:v1:protocol:routing:route-key",
  endpointSource: "urn:agp:schema:v1:protocol:routing:endpoint-source",
  routeAdvertisement:
    "urn:agp:schema:v1:protocol:routing:route-advertisement",
  routeRejection: "urn:agp:schema:v1:protocol:routing:route-rejection",
  envelope: "urn:agp:schema:v1:protocol:wire:envelope",
  openBody: "urn:agp:schema:v1:protocol:wire:open-body",
  openMessage: "urn:agp:schema:v1:protocol:wire:open-message",
  keepaliveBody: "urn:agp:schema:v1:protocol:wire:keepalive-body",
  keepaliveMessage: "urn:agp:schema:v1:protocol:wire:keepalive-message",
  routeUpdateBody: "urn:agp:schema:v1:protocol:wire:route-update-body",
  routeUpdateMessage: "urn:agp:schema:v1:protocol:wire:route-update-message",
  routeAckBody: "urn:agp:schema:v1:protocol:wire:route-ack-body",
  routeAckMessage: "urn:agp:schema:v1:protocol:wire:route-ack-message",
  notificationBody: "urn:agp:schema:v1:protocol:wire:notification-body",
  notificationMessage:
    "urn:agp:schema:v1:protocol:wire:notification-message",
  deliveryErrorBody:
    "urn:agp:schema:v1:protocol:wire:delivery-error-body",
  errorMessage: "urn:agp:schema:v1:protocol:wire:error-message",
  dataBody: "urn:agp:schema:v1:protocol:wire:data-body",
  dataMessage: "urn:agp:schema:v1:protocol:wire:data-message",
  message: "urn:agp:schema:v1:protocol:wire:message",
});

function metadata(
  typescript,
  kind,
  mechanics,
  semanticRules = [],
) {
  return {
    owner,
    typescript,
    kind,
    mechanics,
    rationale:
      "A sovereign contract gives validators and consumers one stable reasoning boundary.",
    consequence:
      "Accepting another shape would make peer interpretation or ownership ambiguous.",
    semanticRules,
  };
}

function add(category, name, typescript, kind, body, semanticRules = []) {
  const id = ids[toCamel(name)];
  if (id === undefined) {
    throw new Error(`No schema ID registered for ${category}/${name}`);
  }
  const document = {
    $schema: draft,
    $id: id,
    title: typescript,
    description: body.description,
    "x-agp": metadata(
      typescript,
      kind,
      body.mechanics ?? body.description,
      semanticRules,
    ),
    ...body,
  };
  delete document.mechanics;
  schemas.push({
    category,
    name,
    typescript,
    kind,
    path: `${category}/${name}.schema.json`,
    document,
  });
}

function toCamel(name) {
  return name.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

function ref(id, description) {
  return { $ref: id, description };
}

function stringScalar(description, pattern, maxLength, minLength = 1) {
  return {
    description,
    type: "string",
    minLength,
    maxLength,
    pattern,
  };
}

function closedObject(description, required, properties) {
  return {
    description,
    type: "object",
    required,
    properties,
    additionalProperties: false,
  };
}

add(
  "common",
  "node-id",
  "NodeId",
  "scalar",
  stringScalar(
    "Canonical lowercase identity of one AGP node.",
    "^[a-z0-9][a-z0-9._-]{0,127}$",
    128,
  ),
);
add(
  "common",
  "session-id",
  "SessionId",
  "scalar",
  stringScalar(
    "Pair-scoped identifier issued by one session controller.",
    "^[0-9a-f]{6}$",
    6,
    6,
  ),
);
add(
  "common",
  "message-id",
  "MessageId",
  "scalar",
  stringScalar(
    "Sender-generated envelope identity preserved end to end for data.",
    "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",
    128,
  ),
);
add(
  "common",
  "return-token",
  "ReturnToken",
  "scalar",
  stringScalar(
    "Hop-scoped unsigned 64-bit reverse-correlation token in fixed-width lowercase hexadecimal.",
    "^[0-9a-f]{16}$",
    16,
    16,
  ),
  ["RETURN-TOKEN-NONREUSE-1"],
);
add(
  "common",
  "correlation-id",
  "CorrelationId",
  "scalar",
  stringScalar(
    "Optional application correlation identity carried unchanged end to end.",
    "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",
    128,
  ),
);
add(
  "common",
  "endpoint-name",
  "EndpointName",
  "scalar",
  stringScalar(
    "Canonical slash-separated name of one routable application endpoint.",
    "^[a-z0-9][a-z0-9._-]{0,62}(?:/[a-z0-9][a-z0-9._-]{0,62})*$",
    253,
  ),
);
add("common", "wire-revision", "WireRevision", "scalar", {
  description:
    "Positive safe-integer revision in one exact session import or export stream.",
  type: "integer",
  minimum: 1,
  maximum: 9_007_199_254_740_991,
});
add("common", "json-value", "JsonValue", "json-value", {
  description:
    "A recursively bounded-at-codec JSON value using the AGP finite/safe numeric profile.",
  oneOf: [
    { type: "null" },
    { type: "boolean" },
    { type: "string" },
    {
      oneOf: [
        {
          type: "integer",
          minimum: -9_007_199_254_740_991,
          maximum: 9_007_199_254_740_991,
        },
        {
          type: "number",
          minimum: -1.7976931348623157e308,
          maximum: 1.7976931348623157e308,
          not: { type: "integer" },
        },
      ],
    },
    { type: "array", items: { $ref: ids.jsonValue } },
    {
      type: "object",
      additionalProperties: { $ref: ids.jsonValue },
    },
  ],
});
add("common", "json-object", "JsonObject", "json-object", {
  description: "An opaque application JSON object with arbitrary named values.",
  type: "object",
  additionalProperties: { $ref: ids.jsonValue },
});
add("common", "extensions", "Extensions", "extensions", {
  description:
    "Bounded namespaced extension values preserved by compliant relays.",
  type: "object",
  maxProperties: 32,
  propertyNames: {
    type: "string",
    minLength: 3,
    maxLength: 128,
    pattern: "^[a-z0-9]+(?:[.-][a-z0-9][a-z0-9_-]*)+$",
  },
  additionalProperties: { $ref: ids.jsonValue },
});
add(
  "common",
  "node-path",
  "NodePath",
  "array",
  {
    description:
      "Nonempty ordered unique node path, bounded by the protocol maximum before negotiated limits apply.",
    type: "array",
    minItems: 1,
    maxItems: 64,
    uniqueItems: true,
    items: { $ref: ids.nodeId },
  },
);

add("codes", "fatal-notification-code", "FatalNotificationCode", "code", {
  description: "Closed fatal AGP v1 notification code domain.",
  type: "string",
  enum: [
    "CEASE",
    "UNSUPPORTED_VERSION",
    "INVALID_MESSAGE",
    "UNEXPECTED_MESSAGE",
    "IDENTITY_REJECTED",
    "ADJACENCY_COLLISION",
    "HOLD_TIMEOUT",
    "ROUTE_REVISION_ERROR",
    "INTERNAL_ERROR",
  ],
});
add("codes", "delivery-error-code", "DeliveryErrorCode", "code", {
  description: "Closed recoverable data-delivery failure code domain.",
  type: "string",
  enum: [
    "NO_ROUTE",
    "HOP_LIMIT_EXCEEDED",
    "SOURCE_NOT_AUTHORIZED",
    "SOURCE_NOT_ADVERTISED",
    "TRANSIT_DISABLED",
    "NEXT_HOP_UNAVAILABLE",
    "MESSAGE_TOO_LARGE",
    "QUEUE_FULL",
  ],
});
add("codes", "route-rejection-code", "RouteRejectionCode", "code", {
  description: "Closed per-route snapshot rejection code domain.",
  type: "string",
  enum: ["LOOP", "PATH_TOO_LONG", "POLICY", "CAPACITY"],
});

const routeIdentityProperties = {
  endpoint: ref(ids.endpointName, "Routable endpoint name."),
  originNodeId: ref(ids.nodeId, "Final node that originates the endpoint."),
};
add(
  "routing",
  "route-key",
  "RouteKey",
  "routing-record",
  closedObject(
    "Stable logical route identity.",
    ["endpoint", "originNodeId"],
    routeIdentityProperties,
  ),
);
add(
  "routing",
  "endpoint-source",
  "EndpointSource",
  "routing-record",
  closedObject(
    "Source endpoint and its final originating node.",
    ["endpoint", "originNodeId"],
    routeIdentityProperties,
  ),
  ["DATA-FEASIBLE-SOURCE-1", "DATA-SOURCE-EXPORT-1"],
);
add(
  "routing",
  "route-advertisement",
  "RouteAdvertisement",
  "routing-record",
  closedObject(
    "One selected path-vector route advertised by a peer.",
    ["endpoint", "originNodeId", "path"],
    {
      ...routeIdentityProperties,
      path: ref(
        ids.nodePath,
        "Complete ordered path through the advertising node, excluding the receiver.",
      ),
    },
  ),
  [
    "ROUTE-PATH-OWNERSHIP-1",
    "ROUTE-PATH-LIMIT-1",
    "ROUTE-RECEIVER-LOOP-1",
  ],
);
add(
  "routing",
  "route-rejection",
  "RouteRejection",
  "routing-record",
  closedObject(
    "Exact recoverable rejection of one route from an outstanding snapshot.",
    ["endpoint", "originNodeId", "reasonCode"],
    {
      ...routeIdentityProperties,
      reasonCode: ref(
        ids.routeRejectionCode,
        "Reason the receiving peer did not install this route.",
      ),
    },
  ),
);

add(
  "wire",
  "envelope",
  "AgpEnvelope",
  "wire-envelope",
  closedObject(
    "Closed common envelope shared by every AGP v1 wire message.",
    ["agp", "plane", "type", "id", "body"],
    {
      agp: { const: 1, description: "AGP wire major version." },
      plane: {
        enum: ["control", "data"],
        description: "Protocol plane carrying the message.",
      },
      type: {
        enum: [
          "open",
          "keepalive",
          "route.update",
          "route.ack",
          "notification",
          "error",
          "message",
        ],
        description: "Closed v1 message discriminator.",
      },
      id: ref(ids.messageId, "Envelope message identity."),
      body: { type: "object", description: "Type-specific sovereign body." },
      extensions: ref(
        ids.extensions,
        "Optional bounded extension object preserved where specified.",
      ),
    },
  ),
);
add(
  "wire",
  "open-body",
  "OpenBody",
  "wire-body",
  closedObject(
    "Symmetric identity, liveness, receive, route, path, hop, and transit offer.",
    [
      "nodeId",
      "sessionId",
      "holdTimeMs",
      "receiveLimitBytes",
      "maxRoutesPerSnapshot",
      "maxPathLength",
      "maxDataHopLimit",
      "transit",
    ],
    {
      nodeId: ref(ids.nodeId, "Identity claimed by the sending node."),
      sessionId: ref(
        ids.sessionId,
        "Pair-scoped identifier issued by this controller.",
      ),
      holdTimeMs: {
        oneOf: [
          { const: 0 },
          { type: "integer", minimum: 3_000, maximum: 300_000 },
        ],
        description:
          "Offered hold timer in milliseconds; zero disables protocol hold expiry.",
      },
      receiveLimitBytes: {
        type: "integer",
        minimum: 131_072,
        maximum: 16_777_216,
        description: "Maximum UTF-8 bytes accepted in one AGP packet.",
      },
      maxRoutesPerSnapshot: {
        type: "integer",
        minimum: 1,
        maximum: 256,
        description: "Maximum route records accepted in one full snapshot.",
      },
      maxPathLength: {
        type: "integer",
        minimum: 1,
        maximum: 64,
        description:
          "Maximum complete path length after this receiver appends itself.",
      },
      maxDataHopLimit: {
        type: "integer",
        minimum: 1,
        maximum: 255,
        description: "Maximum data hop-limit value accepted from this peer.",
      },
      transit: {
        type: "boolean",
        description:
          "Whether this node may export learned routes and forward nonlocal data.",
      },
    },
  ),
  ["SESSION-PAIR-SCOPE-1", "SESSION-CROSS-DIAL-1"],
);
add("wire", "keepalive-body", "KeepaliveBody", "wire-body", {
  description: "Empty liveness-refresh body.",
  type: "object",
  properties: {},
  additionalProperties: false,
});
add(
  "wire",
  "route-update-body",
  "RouteUpdateBody",
  "wire-body",
  closedObject(
    "One authoritative complete route snapshot in an independent revision stream.",
    ["revision", "routes"],
    {
      revision: ref(ids.wireRevision, "Consumed inbound snapshot revision."),
      routes: {
        type: "array",
        maxItems: 256,
        items: { $ref: ids.routeAdvertisement },
        description:
          "Canonical complete route set; omission withdraws prior session-owned state.",
      },
    },
  ),
  ["ROUTE-SNAPSHOT-REPLACE-1"],
);
add(
  "wire",
  "route-ack-body",
  "RouteAckBody",
  "wire-body",
  closedObject(
    "Exact acknowledgement and rejection complement for one outstanding snapshot.",
    ["refId", "revision", "rejected"],
    {
      refId: ref(ids.messageId, "Message ID of the acknowledged route update."),
      revision: ref(ids.wireRevision, "Revision of the acknowledged route update."),
      rejected: {
        type: "array",
        maxItems: 256,
        uniqueItems: true,
        items: { $ref: ids.routeRejection },
        description:
          "Canonical unique routes rejected from the exact outstanding snapshot.",
      },
    },
  ),
  ["ROUTE-REJECTION-MEMORY-1", "ROUTE-REJECTION-RETRY-1"],
);
add(
  "wire",
  "notification-body",
  "NotificationBody",
  "wire-body",
  closedObject(
    "Fatal protocol outcome terminating the exact session.",
    ["code", "reason"],
    {
      code: ref(
        ids.fatalNotificationCode,
        "Closed fatal notification classification.",
      ),
      reason: {
        type: "string",
        minLength: 1,
        maxLength: 256,
        description: "Bounded safe diagnostic without raw exception content.",
      },
    },
  ),
);

const deliveryReasons = Object.freeze({
  NO_ROUTE: "no selected route",
  HOP_LIMIT_EXCEEDED: "hop limit exhausted",
  SOURCE_NOT_AUTHORIZED: "source not authorized on ingress",
  SOURCE_NOT_ADVERTISED: "source route not acknowledged by egress",
  TRANSIT_DISABLED: "transit disabled",
  NEXT_HOP_UNAVAILABLE: "selected next hop unavailable",
  MESSAGE_TOO_LARGE: "message exceeds egress receive limit",
  QUEUE_FULL: "required bounded capacity unavailable",
});
const deliveryErrorVariants = Object.entries(deliveryReasons).map(
  ([code, reason]) =>
    closedObject(
      `${code} correlated delivery failure with its canonical reason.`,
      ["code", "refId", "returnToken", "failedAtNodeId", "reason"],
      {
        code: { const: code, description: "Exact delivery failure code." },
        refId: ref(
          ids.messageId,
          "End-to-end message ID of the failing data envelope.",
        ),
        returnToken: ref(
          ids.returnToken,
          "Hop token copied from the failing data packet or translated breadcrumb.",
        ),
        failedAtNodeId: ref(
          ids.nodeId,
          "Node at which the original delivery failure occurred.",
        ),
        reason: {
          const: reason,
          description: "Canonical safe reason text for this failure code.",
        },
      },
    ),
);
add(
  "wire",
  "delivery-error-body",
  "DeliveryErrorBody",
  "wire-body",
  {
    description:
      "Nonfatal correlated delivery failure returned only over reverse breadcrumbs.",
    oneOf: deliveryErrorVariants,
  },
  ["ERROR-RETURN-TOKEN-1"],
);
add(
  "wire",
  "data-body",
  "DataBody",
  "wire-body",
  closedObject(
    "One source-authorized routed application JSON object.",
    ["source", "destination", "returnToken", "hopLimit", "payload"],
    {
      source: ref(ids.endpointSource, "Exact source endpoint identity."),
      destination: ref(ids.endpointName, "Destination endpoint lookup key."),
      correlationId: ref(
        ids.correlationId,
        "Optional application correlation identity.",
      ),
      returnToken: ref(
        ids.returnToken,
        "Exact hop-scoped reverse-correlation token.",
      ),
      hopLimit: {
        type: "integer",
        minimum: 1,
        maximum: 255,
        description:
          "Remaining bounded data hops; local delivery does not decrement it.",
      },
      payload: ref(ids.jsonObject, "Opaque application JSON object payload."),
    },
  ),
  ["DATA-SELECTED-RIB-1"],
);

function messageSchema(name, typescript, plane, type, bodyId, semanticRules = []) {
  add(
    "wire",
    name,
    typescript,
    "wire-message",
    {
      description: `${type} ${plane}-plane AGP v1 envelope.`,
      allOf: [
        { $ref: ids.envelope },
        {
          type: "object",
          properties: {
            agp: { const: 1, description: "AGP wire major version." },
            plane: { const: plane, description: "Exact message plane." },
            type: { const: type, description: "Exact message discriminator." },
            id: ref(ids.messageId, "Envelope message identity."),
            body: ref(bodyId, "Sovereign type-specific message body."),
            extensions: ref(
              ids.extensions,
              "Optional bounded message extensions.",
            ),
          },
        },
      ],
      unevaluatedProperties: false,
    },
    semanticRules,
  );
}

messageSchema(
  "open-message",
  "OpenMessage",
  "control",
  "open",
  ids.openBody,
  ["OPEN-IDENTITY-1"],
);
messageSchema(
  "keepalive-message",
  "KeepaliveMessage",
  "control",
  "keepalive",
  ids.keepaliveBody,
);
messageSchema(
  "route-update-message",
  "RouteUpdateMessage",
  "control",
  "route.update",
  ids.routeUpdateBody,
  ["ROUTE-SNAPSHOT-REVISION-1"],
);
messageSchema(
  "route-ack-message",
  "RouteAckMessage",
  "control",
  "route.ack",
  ids.routeAckBody,
  ["ROUTE-ACK-CORRELATION-1"],
);
messageSchema(
  "notification-message",
  "NotificationMessage",
  "control",
  "notification",
  ids.notificationBody,
);
messageSchema(
  "error-message",
  "ErrorMessage",
  "control",
  "error",
  ids.deliveryErrorBody,
  ["ERROR-NO-RIB-LOOKUP-1", "ERROR-CONSUME-ONCE-1"],
);
messageSchema(
  "data-message",
  "DataMessage",
  "data",
  "message",
  ids.dataBody,
  ["DATA-TRANSIT-NO-ROUTE-1", "DATA-FAILURE-PRECEDENCE-1"],
);
add(
  "wire",
  "message",
  "AgpMessage",
  "wire-union",
  {
    description: "Closed external-reference union of the seven AGP v1 messages.",
    oneOf: [
      { $ref: ids.openMessage },
      { $ref: ids.keepaliveMessage },
      { $ref: ids.routeUpdateMessage },
      { $ref: ids.routeAckMessage },
      { $ref: ids.notificationMessage },
      { $ref: ids.errorMessage },
      { $ref: ids.dataMessage },
    ],
  },
  ["FSM-ESTABLISHED-MATRIX-1"],
);

for (const schema of schemas) {
  const destination = resolve(schemasRoot, schema.path);
  await emitFile(destination, `${JSON.stringify(schema.document, null, 2)}\n`);
}

const catalogEntries = [];
for (const schema of schemas) {
  const bytes = await readFile(resolve(schemasRoot, schema.path));
  catalogEntries.push({
    id: schema.document.$id,
    owner,
    path: schema.path,
    kind: schema.kind,
    typescript: schema.typescript,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
catalogEntries.sort((left, right) => left.id.localeCompare(right.id));
await emitFile(
  resolve(schemasRoot, "catalog.json"),
  `${JSON.stringify(
    {
      schemaVersion: "agp.schema-catalog/v1",
      owner,
      schemas: catalogEntries,
    },
    null,
    2,
  )}\n`,
);

const schemaFiles = await listJsonSchemas(schemasRoot);
const importLines = schemaFiles.map(
  (path, index) =>
    `import schema${index} from "./schemas/v1/${path}" with { type: "json" };`,
);
const documentLines = schemaFiles.map((_, index) => `  schema${index},`);
await emitFile(
  resolve(packageRoot, "src/schema-documents.generated.ts"),
  `// Generated from the sovereign JSON Schemas by scripts/generate-contracts.mjs.\n` +
    `// DO NOT EDIT.\n\n` +
    `${importLines.join("\n")}\n\n` +
    `export const protocolSchemaDocumentsV1 = Object.freeze([\n` +
    `${documentLines.join("\n")}\n` +
    `] as const);\n`,
);

await emitFile(
  resolve(packageRoot, "src/types.generated.ts"),
  generatedTypes(),
);
await emitFile(
  resolve(packageRoot, "src/code-catalogs.generated.ts"),
  generatedCodeCatalogs(),
);

async function emitFile(destination, content) {
  if (checkOnly) {
    let current;
    try {
      current = await readFile(destination, "utf8");
    } catch {
      throw new Error(
        `Generated contract is missing: ${relative(packageRoot, destination)}`,
      );
    }
    if (current !== content) {
      throw new Error(
        `Generated contract is stale: ${relative(packageRoot, destination)}`,
      );
    }
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

async function listJsonSchemas(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      for (const child of await listJsonSchemas(absolute)) {
        result.push(`${entry.name}/${child}`);
      }
    } else if (entry.name.endsWith(".schema.json")) {
      result.push(entry.name);
    }
  }
  return result.sort();
}

function generatedTypes() {
  return `// Generated from the sovereign JSON Schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

declare const nodeIdBrand: unique symbol;
declare const sessionIdBrand: unique symbol;
declare const messageIdBrand: unique symbol;
declare const returnTokenBrand: unique symbol;
declare const correlationIdBrand: unique symbol;
declare const endpointNameBrand: unique symbol;
declare const wireRevisionBrand: unique symbol;

export type NodeId = string & { readonly [nodeIdBrand]: "NodeId" };
export type SessionId = string & { readonly [sessionIdBrand]: "SessionId" };
export type MessageId = string & { readonly [messageIdBrand]: "MessageId" };
export type ReturnToken = string & { readonly [returnTokenBrand]: "ReturnToken" };
export type CorrelationId = string & { readonly [correlationIdBrand]: "CorrelationId" };
export type EndpointName = string & { readonly [endpointNameBrand]: "EndpointName" };
export type WireRevision = number & { readonly [wireRevisionBrand]: "WireRevision" };

export type JsonValue =
  | null
  | boolean
  | string
  | number
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonObject = Readonly<Record<string, JsonValue>>;
export type Extensions = JsonObject;
export type NodePath = readonly NodeId[];

export type FatalNotificationCode =
  | "CEASE"
  | "UNSUPPORTED_VERSION"
  | "INVALID_MESSAGE"
  | "UNEXPECTED_MESSAGE"
  | "IDENTITY_REJECTED"
  | "ADJACENCY_COLLISION"
  | "HOLD_TIMEOUT"
  | "ROUTE_REVISION_ERROR"
  | "INTERNAL_ERROR";

export type DeliveryErrorCode =
  | "NO_ROUTE"
  | "HOP_LIMIT_EXCEEDED"
  | "SOURCE_NOT_AUTHORIZED"
  | "SOURCE_NOT_ADVERTISED"
  | "TRANSIT_DISABLED"
  | "NEXT_HOP_UNAVAILABLE"
  | "MESSAGE_TOO_LARGE"
  | "QUEUE_FULL";

export type RouteRejectionCode =
  | "LOOP"
  | "PATH_TOO_LONG"
  | "POLICY"
  | "CAPACITY";

export interface RouteKey {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
}

export interface EndpointSource {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
}

export interface RouteAdvertisement {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly path: NodePath;
}

export interface RouteRejection {
  readonly endpoint: EndpointName;
  readonly originNodeId: NodeId;
  readonly reasonCode: RouteRejectionCode;
}

export interface AgpEnvelope<
  P extends "control" | "data",
  T extends string,
  B extends object,
> {
  readonly agp: 1;
  readonly plane: P;
  readonly type: T;
  readonly id: MessageId;
  readonly body: B;
  readonly extensions?: Extensions;
}

export interface OpenBody {
  readonly nodeId: NodeId;
  readonly sessionId: SessionId;
  readonly holdTimeMs: number;
  readonly receiveLimitBytes: number;
  readonly maxRoutesPerSnapshot: number;
  readonly maxPathLength: number;
  readonly maxDataHopLimit: number;
  readonly transit: boolean;
}

export type KeepaliveBody = Readonly<Record<string, never>>;

export interface RouteUpdateBody {
  readonly revision: WireRevision;
  readonly routes: readonly RouteAdvertisement[];
}

export interface RouteAckBody {
  readonly refId: MessageId;
  readonly revision: WireRevision;
  readonly rejected: readonly RouteRejection[];
}

export interface NotificationBody {
  readonly code: FatalNotificationCode;
  readonly reason: string;
}

interface DeliveryErrorFields {
  readonly refId: MessageId;
  readonly returnToken: ReturnToken;
  readonly failedAtNodeId: NodeId;
}

export type DeliveryErrorBody = DeliveryErrorFields & (
  | { readonly code: "NO_ROUTE"; readonly reason: "no selected route" }
  | { readonly code: "HOP_LIMIT_EXCEEDED"; readonly reason: "hop limit exhausted" }
  | { readonly code: "SOURCE_NOT_AUTHORIZED"; readonly reason: "source not authorized on ingress" }
  | { readonly code: "SOURCE_NOT_ADVERTISED"; readonly reason: "source route not acknowledged by egress" }
  | { readonly code: "TRANSIT_DISABLED"; readonly reason: "transit disabled" }
  | { readonly code: "NEXT_HOP_UNAVAILABLE"; readonly reason: "selected next hop unavailable" }
  | { readonly code: "MESSAGE_TOO_LARGE"; readonly reason: "message exceeds egress receive limit" }
  | { readonly code: "QUEUE_FULL"; readonly reason: "required bounded capacity unavailable" }
);

export interface DataBody {
  readonly source: EndpointSource;
  readonly destination: EndpointName;
  readonly correlationId?: CorrelationId;
  readonly returnToken: ReturnToken;
  readonly hopLimit: number;
  readonly payload: JsonObject;
}

export type OpenMessage = AgpEnvelope<"control", "open", OpenBody>;
export type KeepaliveMessage = AgpEnvelope<"control", "keepalive", KeepaliveBody>;
export type RouteUpdateMessage =
  AgpEnvelope<"control", "route.update", RouteUpdateBody>;
export type RouteAckMessage =
  AgpEnvelope<"control", "route.ack", RouteAckBody>;
export type NotificationMessage =
  AgpEnvelope<"control", "notification", NotificationBody>;
export type ErrorMessage =
  AgpEnvelope<"control", "error", DeliveryErrorBody>;
export type DataMessage = AgpEnvelope<"data", "message", DataBody>;

export type AgpMessage =
  | OpenMessage
  | KeepaliveMessage
  | RouteUpdateMessage
  | RouteAckMessage
  | NotificationMessage
  | ErrorMessage
  | DataMessage;
`;
}

function generatedCodeCatalogs() {
  const fatalCodes = schemaEnum(ids.fatalNotificationCode);
  const deliveryCodes = schemaEnum(ids.deliveryErrorCode);
  const routeRejectionCodes = schemaEnum(ids.routeRejectionCode);
  return `// Generated from the sovereign JSON Schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

import type {
  DeliveryErrorCode,
  FatalNotificationCode,
  RouteRejectionCode,
} from "./types.generated.js";

export const AGP_V1_FATAL_NOTIFICATION_CODES = Object.freeze(
  ${JSON.stringify(fatalCodes, null, 2)} as const satisfies readonly FatalNotificationCode[],
);

export const AGP_V1_DELIVERY_ERROR_CODES = Object.freeze(
  ${JSON.stringify(deliveryCodes, null, 2)} as const satisfies readonly DeliveryErrorCode[],
);

export const AGP_V1_ROUTE_REJECTION_CODES = Object.freeze(
  ${JSON.stringify(routeRejectionCodes, null, 2)} as const satisfies readonly RouteRejectionCode[],
);

export const AGP_V1_DELIVERY_ERROR_REASONS = Object.freeze(
  ${JSON.stringify(deliveryReasons, null, 2)} as const satisfies Readonly<Record<DeliveryErrorCode, string>>,
);
`;
}

function schemaEnum(schemaId) {
  const schema = schemas.find((candidate) => candidate.document.$id === schemaId);
  if (schema === undefined || !Array.isArray(schema.document.enum)) {
    throw new Error(`Schema has no enum code catalog: ${schemaId}`);
  }
  return schema.document.enum;
}
