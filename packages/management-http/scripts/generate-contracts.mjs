import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemasRoot = resolve(packageRoot, "src/schemas/v1");
const checkOnly = process.argv.includes("--check");
const draft = "https://json-schema.org/draft/2020-12/schema";
const owner = "@agp/management-http";
const schemas = [];

const ids = Object.freeze({
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
});

const common = Object.freeze({
  nodeId: "urn:agp:schema:v1:protocol:common:node-id",
});

const core = Object.freeze({
  instanceId: "urn:agp:schema:v1:core:common:instance-id",
  timestamp: "urn:agp:schema:v1:core:common:timestamp",
  operationsRevision:
    "urn:agp:schema:v1:core:common:operations-revision",
  configuration:
    "urn:agp:schema:v1:core:operations:configuration-snapshot",
  lifecycle: "urn:agp:schema:v1:core:operations:lifecycle-snapshot",
  listener: "urn:agp:schema:v1:core:operations:listener-snapshot",
  adjacency: "urn:agp:schema:v1:core:operations:adjacency-snapshot",
  localEndpoint:
    "urn:agp:schema:v1:core:operations:local-endpoint-snapshot",
  connection: "urn:agp:schema:v1:core:operations:connection-snapshot",
  advertisement:
    "urn:agp:schema:v1:core:operations:advertisement-snapshot",
  candidateRoute:
    "urn:agp:schema:v1:core:operations:candidate-route-snapshot",
  selectedRoute:
    "urn:agp:schema:v1:core:operations:selected-route-snapshot",
  forwardingEntry:
    "urn:agp:schema:v1:core:operations:forwarding-entry-snapshot",
  adjRibOutRoute:
    "urn:agp:schema:v1:core:operations:adj-rib-out-route-snapshot",
  labelBinding:
    "urn:agp:schema:v1:core:operations:label-binding-snapshot",
  resources: "urn:agp:schema:v1:core:operations:resources-snapshot",
  counters: "urn:agp:schema:v1:core:operations:counters-snapshot",
});

function metadata(typescript, kind, mechanics) {
  return {
    owner,
    typescript,
    kind,
    mechanics,
    rationale:
      "A sovereign response preserves the canonical SDK projection without adapter-owned inference.",
    consequence:
      "A generic or duplicated shape could diverge from the node operations truth.",
    semanticRules: [],
  };
}

function add(directory, name, typescript, kind, body) {
  const id = ids[toCamel(name)];
  if (id === undefined) throw new Error(`Missing management ID for ${name}`);
  const document = {
    $schema: draft,
    $id: id,
    title: typescript,
    description: body.description,
    "x-agp": metadata(
      typescript,
      kind,
      body.mechanics ?? body.description,
    ),
    ...body,
  };
  delete document.mechanics;
  schemas.push({
    id,
    directory,
    name,
    typescript,
    kind,
    path: `${directory}/${name}.schema.json`,
    document,
  });
}

function toCamel(name) {
  return name.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

function ref(id, description) {
  return { $ref: id, description };
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

function responseProperties(kind) {
  return {
    apiVersion: {
      const: "agp.management/v1",
      description: "Stable management response envelope version.",
    },
    kind: {
      const: kind,
      description: "Exact response discriminator.",
    },
    meta: ref(
      ids.responseMeta,
      "Metadata captured by the one canonical OperationsReader query.",
    ),
  };
}

function addDataResponse(name, typescript, kind, dataSchema) {
  add(
    "responses",
    name,
    typescript,
    "management-response",
    closedObject(
      `${kind} management response from one canonical SDK query.`,
      ["apiVersion", "kind", "meta", "data"],
      {
        ...responseProperties(kind),
        data: dataSchema,
      },
    ),
  );
}

function addListResponse(name, typescript, kind, itemId) {
  add(
    "responses",
    name,
    typescript,
    "management-response",
    closedObject(
      `${kind} management response preserving canonical SDK list order.`,
      ["apiVersion", "kind", "meta", "items"],
      {
        ...responseProperties(kind),
        items: {
          type: "array",
          items: { $ref: itemId },
          description: "Canonical immutable SDK items without reordering.",
        },
      },
    ),
  );
}

add(
  "common",
  "response-meta",
  "ManagementMeta",
  "management-common",
  closedObject(
    "Point-in-time identity and revision of one management projection.",
    ["nodeId", "instanceId", "capturedAt", "revision"],
    {
      nodeId: ref(common.nodeId, "Node whose state was queried."),
      instanceId: ref(
        core.instanceId,
        "Ephemeral runtime instance whose revision is represented.",
      ),
      capturedAt: ref(core.timestamp, "Wall-clock capture evidence."),
      revision: ref(
        core.operationsRevision,
        "Canonical instance-local operations revision.",
      ),
    },
  ),
);

add(
  "common",
  "error-response",
  "ManagementError",
  "management-error",
  closedObject(
    "Bounded stable management error that contains no SDK exception content.",
    ["apiVersion", "kind", "code", "message"],
    {
      apiVersion: {
        const: "agp.management/v1",
        description: "Stable management response envelope version.",
      },
      kind: { const: "Error", description: "Error response discriminator." },
      code: {
        enum: [
          "BAD_REQUEST",
          "METHOD_NOT_ALLOWED",
          "NOT_FOUND",
          "RESPONSE_TOO_LARGE",
          "INTERNAL",
        ],
        description: "Closed management HTTP error domain.",
      },
      message: {
        type: "string",
        minLength: 1,
        maxLength: 256,
        description: "Bounded redacted diagnostic.",
      },
    },
  ),
);

const healthData = closedObject(
  "Lifecycle evidence plus adapter-derived health and readiness flags.",
  ["lifecycle", "healthy", "ready"],
  {
    lifecycle: ref(core.lifecycle, "Exact canonical lifecycle snapshot."),
    healthy: {
      type: "boolean",
      description: "False only when the node lifecycle is Failed.",
    },
    ready: {
      type: "boolean",
      description:
        "True only while the adapter is serving and the node lifecycle is Running.",
    },
  },
);
addDataResponse(
  "health-response",
  "ManagementHealth",
  "Health",
  healthData,
);

const operationsData = closedObject(
  "Complete same-revision operations state with only exact core entity schemas.",
  [
    "configuration",
    "lifecycle",
    "listener",
    "adjacencies",
    "localEndpoints",
    "connections",
    "advertisements",
    "candidateRoutes",
    "selectedRoutes",
    "forwarding",
    "routeExports",
    "labelBindings",
    "resources",
    "counters",
  ],
  {
    configuration: ref(core.configuration, "Effective redacted configuration."),
    lifecycle: ref(core.lifecycle, "Runtime lifecycle."),
    listener: ref(core.listener, "Listener state."),
    adjacencies: {
      type: "array",
      items: { $ref: core.adjacency },
      description: "Canonical desired adjacency rows.",
    },
    localEndpoints: {
      type: "array",
      items: { $ref: core.localEndpoint },
      description: "Canonical local endpoint bindings.",
    },
    connections: {
      type: "array",
      items: { $ref: core.connection },
      description:
        "Canonical pending pre-identity controllers and admitted session rows.",
    },
    advertisements: {
      type: "array",
      items: { $ref: core.advertisement },
      description: "Canonical Adj-RIB-In advertisements.",
    },
    candidateRoutes: {
      type: "array",
      items: { $ref: core.candidateRoute },
      description: "Canonical candidate route rows.",
    },
    selectedRoutes: {
      type: "array",
      items: { $ref: core.selectedRoute },
      description: "Canonical selected route rows.",
    },
    forwarding: {
      type: "array",
      items: { $ref: core.forwardingEntry },
      description: "Canonical forwarding rows.",
    },
    routeExports: {
      type: "array",
      items: { $ref: core.adjRibOutRoute },
      description: "Canonical per-peer Adj-RIB-Out decisions.",
    },
    labelBindings: {
      type: "array",
      items: { $ref: core.labelBinding },
      description: "Canonical bounded label binding rows.",
    },
    resources: ref(core.resources, "Canonical bounded resource gauges."),
    counters: ref(core.counters, "Canonical instance-local counters."),
  },
);
addDataResponse(
  "operations-response",
  "ManagementOperationsSnapshot",
  "OperationsSnapshot",
  operationsData,
);
addDataResponse(
  "configuration-response",
  "ManagementConfiguration",
  "Configuration",
  ref(core.configuration, "Exact redacted core configuration snapshot."),
);
addListResponse(
  "local-endpoints-response",
  "ManagementLocalEndpointList",
  "LocalEndpointList",
  core.localEndpoint,
);
addListResponse(
  "connections-response",
  "ManagementConnectionList",
  "ConnectionList",
  core.connection,
);
addListResponse(
  "advertisements-response",
  "ManagementAdvertisementList",
  "AdvertisementList",
  core.advertisement,
);

add(
  "responses",
  "routes-response",
  "ManagementRouteTable",
  "management-response",
  closedObject(
    "Route table management response preserving candidate and selected SDK order.",
    ["apiVersion", "kind", "meta", "candidates", "selected"],
    {
      ...responseProperties("RouteTable"),
      candidates: {
        type: "array",
        items: { $ref: core.candidateRoute },
        description: "Canonical candidate route rows.",
      },
      selected: {
        type: "array",
        items: { $ref: core.selectedRoute },
        description: "Canonical selected route rows.",
      },
    },
  ),
);
addListResponse(
  "forwarding-response",
  "ManagementForwardingList",
  "ForwardingList",
  core.forwardingEntry,
);
addDataResponse(
  "resources-response",
  "ManagementResources",
  "Resources",
  ref(core.resources, "Exact core resource gauge snapshot."),
);
addDataResponse(
  "counters-response",
  "ManagementCounters",
  "Counters",
  ref(core.counters, "Exact core counter snapshot."),
);

for (const schema of schemas) {
  await emitFile(
    resolve(schemasRoot, schema.path),
    `${JSON.stringify(schema.document, null, 2)}\n`,
  );
}

const catalogEntries = [];
for (const schema of schemas) {
  const bytes = await readFile(resolve(schemasRoot, schema.path));
  catalogEntries.push({
    id: schema.id,
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
  `// Generated from sovereign management JSON Schemas by scripts/generate-contracts.mjs.\n` +
    `// DO NOT EDIT.\n\n` +
    `${importLines.join("\n")}\n\n` +
    `export const AGP_MANAGEMENT_V1_SCHEMAS = Object.freeze([\n` +
    `${documentLines.join("\n")}\n` +
    `] as const);\n`,
);
await emitFile(resolve(packageRoot, "src/types.generated.ts"), generatedTypes());

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
  return `// Generated from sovereign management JSON Schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

import type {
  AdvertisementSnapshot,
  CandidateRouteSnapshot,
  ConfigurationSnapshot,
  CountersSnapshot,
  ForwardingEntrySnapshot,
  InstanceId,
  LifecycleSnapshot,
  LocalEndpointSnapshot,
  OperationsRevision,
  OperationsSnapshot,
  ResourcesSnapshot,
  SelectedRouteSnapshot,
  ConnectionSnapshot,
  NodeId,
  Timestamp,
} from "@agp/core";

export interface ManagementMeta {
  readonly nodeId: NodeId;
  readonly instanceId: InstanceId;
  readonly capturedAt: Timestamp;
  readonly revision: OperationsRevision;
}

export interface ManagementError {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Error";
  readonly code:
    | "BAD_REQUEST"
    | "METHOD_NOT_ALLOWED"
    | "NOT_FOUND"
    | "RESPONSE_TOO_LARGE"
    | "INTERNAL";
  readonly message: string;
}

export interface ManagementHealth {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Health";
  readonly meta: ManagementMeta;
  readonly data: {
    readonly lifecycle: LifecycleSnapshot;
    readonly healthy: boolean;
    readonly ready: boolean;
  };
}

export interface ManagementOperationsSnapshot {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "OperationsSnapshot";
  readonly meta: ManagementMeta;
  readonly data: Omit<OperationsSnapshot, "schemaVersion" | "nodeId" | "instanceId" | "capturedAt" | "revision">;
}

export interface ManagementConfiguration {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Configuration";
  readonly meta: ManagementMeta;
  readonly data: ConfigurationSnapshot;
}

export interface ManagementLocalEndpointList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "LocalEndpointList";
  readonly meta: ManagementMeta;
  readonly items: readonly LocalEndpointSnapshot[];
}

export interface ManagementConnectionList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "ConnectionList";
  readonly meta: ManagementMeta;
  readonly items: readonly ConnectionSnapshot[];
}

export interface ManagementAdvertisementList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "AdvertisementList";
  readonly meta: ManagementMeta;
  readonly items: readonly AdvertisementSnapshot[];
}

export interface ManagementRouteTable {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "RouteTable";
  readonly meta: ManagementMeta;
  readonly candidates: readonly CandidateRouteSnapshot[];
  readonly selected: readonly SelectedRouteSnapshot[];
}

export interface ManagementForwardingList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "ForwardingList";
  readonly meta: ManagementMeta;
  readonly items: readonly ForwardingEntrySnapshot[];
}

export interface ManagementResources {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Resources";
  readonly meta: ManagementMeta;
  readonly data: ResourcesSnapshot;
}

export interface ManagementCounters {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Counters";
  readonly meta: ManagementMeta;
  readonly data: CountersSnapshot;
}

export type ManagementValue =
  | ManagementHealth
  | ManagementOperationsSnapshot
  | ManagementConfiguration
  | ManagementLocalEndpointList
  | ManagementConnectionList
  | ManagementAdvertisementList
  | ManagementRouteTable
  | ManagementForwardingList
  | ManagementResources
  | ManagementCounters;
`;
}
