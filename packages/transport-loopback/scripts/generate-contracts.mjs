import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = join(packageRoot, "src", "schemas", "v1");
const semanticRoot = join(packageRoot, "src", "semantic-rules", "v1");
const check = process.argv.includes("--check");
const draft = "https://json-schema.org/draft/2020-12/schema";
const owner = "@agp/transport-loopback";
const urn = (group, name) =>
  `urn:agp:schema:v1:transport-loopback:${group}:${name}`;
const transportUrn = (name) =>
  `urn:agp:schema:v1:transport:contracts:${name}`;
const ref = ($ref) => ({ $ref });
const string = (description, extra = {}) => ({
  description,
  type: "string",
  ...extra,
});
const integer = (description, extra = {}) => ({
  description,
  type: "integer",
  ...extra,
});
const boolean = (description) => ({ description, type: "boolean" });
const safePositive = (description) =>
  integer(description, { minimum: 1, maximum: 9007199254740991 });
const safeCount = (description) =>
  integer(description, { minimum: 0, maximum: 9007199254740991 });
const documents = [];

function closed(properties, required = Object.keys(properties), extra = {}) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    ...extra,
  };
}

function add(group, name, schema, folder = group, rules = []) {
  const typescript = pascal(name);
  const document = {
    $schema: draft,
    $id: urn(group, name),
    title: `AGP Loopback ${name}`,
    "x-agp": {
      owner,
      typescript,
      kind: group === "common"
        ? "common"
        : group === "codes"
          ? "code"
          : group === "configuration"
            ? "configuration"
            : "operations",
      mechanics: `Sovereign ${name} data contract owned by ${owner}.`,
      rationale:
        "One closed record keeps production Loopback configuration and state independently inspectable.",
      consequence:
        "Accepting another shape would make fabric capacity, lifecycle, or terminal evidence ambiguous.",
      semanticRules: rules,
    },
    ...schema,
  };
  documents.push({
    group,
    name,
    path: `${folder}/${name}.schema.json`,
    typescript,
    document,
  });
  return document.$id;
}

const idSegmentPattern = "^[a-z0-9][a-z0-9._-]{0,62}$";
const addressPattern =
  "^[a-z0-9][a-z0-9._-]{0,62}(?:/[a-z0-9][a-z0-9._-]{0,62})*$";
const decimal64Pattern = "^(0|[1-9][0-9]{0,19})$";

add("common", "fabric-id", string(
  "Bounded display identity of one explicit fabric object.",
  { pattern: idSegmentPattern },
));
add("common", "loopback-address", string(
  "Exact slash-separated listener address inside one fabric.",
  { pattern: addressPattern, maxLength: 253 },
));
add("common", "transport-name", string(
  "Fabric-issued name of one scoped transport capability.",
  { pattern: idSegmentPattern },
));
add("common", "fabric-revision", string(
  "Canonical unsigned-64 decimal fabric revision.",
  { pattern: decimal64Pattern, maxLength: 20 },
), "common", ["LOOPBACK-MONOTONIC-EXHAUSTION-1"]);
add("common", "counter-value", string(
  "Canonical unsigned-64 decimal counter value.",
  { pattern: decimal64Pattern, maxLength: 20 },
), "common", ["LOOPBACK-MONOTONIC-EXHAUSTION-1"]);

add("codes", "fabric-failure-code", string(
  "Closed terminal failure class for one fabric.",
  { enum: ["MONOTONIC_DOMAIN_EXHAUSTED", "ADAPTER_FAULT"] },
));
add("codes", "monotonic-domain", string(
  "Finite ordering domain that caused fabric failure.",
  { enum: ["revision", "counter", "arbitration-sequence"] },
));
const counterKeys = [
  "connectionsAccepted",
  "connectionsRejected",
  "packetsAcceptedLeftToRight",
  "bytesAcceptedLeftToRight",
  "packetsAcceptedRightToLeft",
  "bytesAcceptedRightToLeft",
  "backpressureActivations",
  "gracefulChannelCloses",
  "forcedChannelAborts",
  "adapterInvariantFaults",
];
add("codes", "counter-key", string(
  "Closed Loopback counter catalog key.",
  { enum: counterKeys },
));

const limitProperties = Object.fromEntries([
  "maxTransports",
  "maxListeners",
  "maxPendingAcquisitions",
  "maxActiveChannels",
  "maxPacketBytes",
  "maxBufferedPacketsPerChannel",
  "maxBufferedBytesPerChannel",
  "maxQueuedPacketsTotal",
  "maxQueuedBytesTotal",
  "maxPendingSendBytesTotal",
].map((name) => [
  name,
  safePositive(`Hard fabric ceiling for ${name}.`),
]));
add(
  "configuration",
  "limits",
  closed(limitProperties),
  "configuration",
  ["LOOPBACK-EXPLICIT-FABRIC-1"],
);
add("configuration", "fabric", closed({
  fabricId: {
    description: "Display identity checked against bound listener and target data.",
    ...ref(urn("common", "fabric-id")),
  },
  limits: {
    description: "Finite production resource ceilings.",
    ...ref(urn("configuration", "limits")),
  },
}), "configuration", ["LOOPBACK-EXPLICIT-FABRIC-1"]);
add("configuration", "transport", closed({
  transportName: {
    description: "Unique name reserved for this fabric lifetime.",
    ...ref(urn("common", "transport-name")),
  },
  capabilities: {
    description: "Fixed acquisition kinds this scoped transport may bind.",
    ...closed({
      listen: boolean("Whether listener capabilities may be bound."),
      connect: boolean("Whether target capabilities may be bound."),
    }),
  },
}), "configuration", ["LOOPBACK-EXPLICIT-FABRIC-1"]);
for (const name of ["listener", "target"]) {
  add("configuration", name, closed({
    fabricId: {
      description: "Display identity that must equal the exact owning fabric.",
      ...ref(urn("common", "fabric-id")),
    },
    address: {
      description: "Exact listener address inside the owning fabric.",
      ...ref(urn("common", "loopback-address")),
    },
  }), "configuration", ["LOOPBACK-EXPLICIT-FABRIC-1"]);
}

add("operations", "fabric-failure-snapshot", {
  oneOf: [
    closed({
      code: {
        description: "Terminal adapter-invariant failure code.",
        const: "ADAPTER_FAULT",
      },
    }),
    closed({
      code: {
        description: "Terminal monotonic-domain failure code.",
        const: "MONOTONIC_DOMAIN_EXHAUSTED",
      },
      domain: {
        description: "Exhausted revision or arbitration domain.",
        type: "string",
        enum: ["revision", "arbitration-sequence"],
      },
    }),
    closed({
      code: {
        description: "Terminal monotonic-domain failure code.",
        const: "MONOTONIC_DOMAIN_EXHAUSTED",
      },
      domain: {
        description: "Counter-domain discriminator.",
        const: "counter",
      },
      counterKey: {
        description: "Exact counter whose delta could not commit.",
        ...ref(urn("codes", "counter-key")),
      },
    }),
  ],
}, "operations", [
  "LOOPBACK-ADAPTER-INVARIANT-FAILURE-1",
  "LOOPBACK-MONOTONIC-EXHAUSTION-1",
]);

const listenerBase = {
  listenerId: string("Opaque bounded fabric-local listener identity.", {
    pattern: "^listener-[0-9a-f]{16}$",
  }),
  address: {
    description: "Exact registered address.",
    ...ref(urn("common", "loopback-address")),
  },
  activeChannels: safeCount("Physically retained accepted channels."),
};
add("operations", "listener-snapshot", {
  oneOf: [
    closed({
      ...listenerBase,
      state: { description: "Live listener state.", const: "Listening" },
    }),
    closed({
      ...listenerBase,
      state: { description: "Listener close has begun.", const: "Closing" },
    }),
    closed({
      ...listenerBase,
      state: { description: "Listener terminal is committed.", const: "Terminal" },
      terminal: {
        description: "Exact neutral listener terminal.",
        ...ref(transportUrn("transport-listener-terminal")),
      },
    }),
  ],
}, "operations", ["LOOPBACK-SNAPSHOT-RETENTION-1"]);

const channelBase = {
  channelId: string("Opaque bounded fabric-local channel identity.", {
    pattern: "^channel-[0-9a-f]{16}$",
  }),
  leftTransport: {
    description: "Connecting transport, fixed at commit.",
    ...ref(urn("common", "transport-name")),
  },
  rightTransport: {
    description: "Accepting transport, fixed at commit.",
    ...ref(urn("common", "transport-name")),
  },
  queuedPacketsLeft: safeCount("Packets queued for the connecting endpoint."),
  queuedBytesLeft: safeCount("Bytes queued for the connecting endpoint."),
  queuedPacketsRight: safeCount("Packets queued for the accepting endpoint."),
  queuedBytesRight: safeCount("Bytes queued for the accepting endpoint."),
};
const optionalTerminal = (description) => ({
  description,
  ...ref(transportUrn("transport-terminal")),
});
add("operations", "channel-snapshot", {
  oneOf: [
    closed({
      ...channelBase,
      state: { description: "Both endpoints are open.", const: "Open" },
    }),
    closed({
      ...channelBase,
      state: { description: "Close is initiated or one endpoint is terminal.", const: "Closing" },
      leftTerminal: optionalTerminal("Connecting endpoint terminal, when committed."),
      rightTerminal: optionalTerminal("Accepting endpoint terminal, when committed."),
    }, [
      "channelId",
      "leftTransport",
      "rightTransport",
      "state",
      "queuedPacketsLeft",
      "queuedBytesLeft",
      "queuedPacketsRight",
      "queuedBytesRight",
    ]),
    closed({
      ...channelBase,
      state: { description: "Both endpoint terminals are committed.", const: "Terminal" },
      leftTerminal: optionalTerminal("Connecting endpoint terminal."),
      rightTerminal: optionalTerminal("Accepting endpoint terminal."),
    }),
  ],
}, "operations", ["LOOPBACK-SNAPSHOT-RETENTION-1"]);

add("operations", "resources-snapshot", closed({
  pendingAcquisitions: safeCount("Current uncommitted acquisitions."),
  activeChannels: safeCount("Current physically retained logical channels."),
  pendingSendBytes: safeCount("Copied bytes waiting for queue admission."),
  queuedPackets: safeCount("Packets accepted into all ingress queues."),
  queuedBytes: safeCount("Bytes accepted into all ingress queues."),
}));
add("operations", "counters-snapshot", closed(
  Object.fromEntries(counterKeys.map((key) => [
    key,
    {
      description: `Monotonic ${key} counter.`,
      ...ref(urn("common", "counter-value")),
    },
  ])),
));

const snapshotBase = {
  fabricId: {
    description: "Display identity of this explicit fabric.",
    ...ref(urn("common", "fabric-id")),
  },
  revision: {
    description: "Canonical visible-state revision.",
    ...ref(urn("common", "fabric-revision")),
  },
  listeners: {
    description: "Deterministically ordered bounded listener rows.",
    type: "array",
    maxItems: 4096,
    items: ref(urn("operations", "listener-snapshot")),
  },
  channels: {
    description: "Deterministically ordered bounded channel rows.",
    type: "array",
    maxItems: 4096,
    items: ref(urn("operations", "channel-snapshot")),
  },
  resources: {
    description: "Current finite resource gauges.",
    ...ref(urn("operations", "resources-snapshot")),
  },
  counters: {
    description: "Closed monotonic counter catalog.",
    ...ref(urn("operations", "counters-snapshot")),
  },
};
add("operations", "fabric-snapshot", {
  oneOf: [
    ...["Running", "Closing", "Closed"].map((state) =>
      closed({
        ...snapshotBase,
        state: { description: `Fabric lifecycle state ${state}.`, const: state },
      })),
    closed({
      ...snapshotBase,
      state: { description: "Terminal failed fabric state.", const: "Failed" },
      failure: {
        description: "Exact terminal fabric failure.",
        ...ref(urn("operations", "fabric-failure-snapshot")),
      },
    }),
  ],
});

documents.sort((left, right) => left.document.$id.localeCompare(
  right.document.$id,
));

for (const entry of documents) {
  await emit(join(schemaRoot, entry.path), `${json(entry.document)}\n`);
}

const catalogEntries = [];
for (const entry of documents) {
  const bytes = Buffer.from(`${json(entry.document)}\n`);
  catalogEntries.push({
    id: entry.document.$id,
    path: entry.path,
    typescript: entry.typescript,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const catalog = {
  schemaVersion: "agp.schema-catalog/v1",
  owner,
  schemas: catalogEntries,
};
await emit(join(schemaRoot, "catalog.json"), `${json(catalog)}\n`);

const semanticRules = {
  schemaVersion: "agp.semantic-rules/v1",
  owner,
  rules: [
    {
      id: "LOOPBACK-EXPLICIT-FABRIC-1",
      phase: "construction",
      inputSchemaIds: [
        urn("configuration", "fabric"),
        urn("configuration", "transport"),
        urn("configuration", "listener"),
        urn("configuration", "target"),
      ],
      resultCodes: ["BOUND", "REJECTED"],
      designReferences: [
        "docs/design/agp-uniform-node/transports/loopback.md#2-explicit-fabric",
        "docs/design/agp-uniform-node/transports/loopback.md#4-production-api-sketch",
      ],
      implementation:
        "packages/transport-loopback/src/fabric.ts#createLoopbackFabric",
      owningTest:
        "packages/transport-loopback/test/contract/production-surface.test.js",
    },
    {
      id: "LOOPBACK-ADAPTER-INVARIANT-FAILURE-1",
      phase: "fabric",
      inputSchemaIds: [
        urn("operations", "fabric-failure-snapshot"),
        urn("operations", "fabric-snapshot"),
      ],
      resultCodes: ["ADAPTER_FAULT"],
      designReferences: [
        "docs/design/agp-uniform-node/transports/loopback.md#11-invariants",
      ],
      implementation:
        "packages/transport-loopback/src/fabric.ts#failAdapterInvariant",
      owningTest:
        "packages/transport-loopback/test/contract/operations-adapter-invariant-failure.test.js",
    },
    {
      id: "LOOPBACK-MONOTONIC-EXHAUSTION-1",
      phase: "fabric",
      inputSchemaIds: [
        urn("configuration", "fabric"),
        urn("operations", "fabric-snapshot"),
      ],
      resultCodes: ["COMMITTED", "MONOTONIC_DOMAIN_EXHAUSTED"],
      designReferences: [
        "docs/design/agp-uniform-node/transports/loopback.md#81-finite-monotonic-domains",
      ],
      implementation:
        "packages/transport-loopback/src/operations.ts#preflightMonotonicDomain",
      owningTest:
        "packages/transport-loopback/test/contract/operations-monotonic-exhaustion.test.js",
    },
    {
      id: "LOOPBACK-SNAPSHOT-RETENTION-1",
      phase: "operations",
      inputSchemaIds: [
        urn("operations", "listener-snapshot"),
        urn("operations", "channel-snapshot"),
      ],
      resultCodes: ["LIVE_ROW", "RELEASED", "FAILED_FROZEN"],
      designReferences: [
        "docs/design/agp-uniform-node/transports/loopback.md#102-snapshot-records",
      ],
      implementation:
        "packages/transport-loopback/src/operations.ts#snapshot",
      owningTest:
        "packages/transport-loopback/test/contract/operations-snapshot-retention.test.js",
    },
  ],
};
await emit(
  join(semanticRoot, "semantic-rules.catalog.json"),
  `${json(semanticRules)}\n`,
);

await emit(
  join(packageRoot, "src", "schema-documents.generated.ts"),
  `// Generated by scripts/generate-contracts.mjs. DO NOT EDIT.\n`
    + `export const loopbackSchemaDocumentsV1 = Object.freeze(`
    + `${json(documents.map((entry) => entry.document))} as const);\n\n`
    + `export const loopbackSchemaCatalogV1 = Object.freeze(`
    + `${json(catalog)} as const);\n\n`
    + `export const LOOPBACK_V1_SCHEMA_IDS = Object.freeze(`
    + `loopbackSchemaCatalogV1.schemas.map((entry) => entry.id));\n`,
);
await emit(
  join(packageRoot, "src", "types.generated.ts"),
  generatedTypes(),
);

if (check) {
  process.stdout.write(
    `Loopback contracts are current (${documents.length} schemas).\n`,
  );
} else {
  process.stdout.write(
    `Generated ${documents.length} Loopback schemas and TypeScript records.\n`,
  );
}

async function emit(path, content) {
  if (check) {
    let current;
    try {
      current = await readFile(path, "utf8");
    } catch {
      throw new Error(`Generated contract is missing: ${path}`);
    }
    if (current !== content) {
      throw new Error(`Generated contract is stale: ${path}`);
    }
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function pascal(value) {
  return value.split("-").map((part) =>
    `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`
  ).join("");
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function generatedTypes() {
  return `// Generated by scripts/generate-contracts.mjs. DO NOT EDIT.
import type {
  TransportListenerTerminal,
  TransportTerminal,
} from "@agp/transport";

export type LoopbackFabricId = string;
export type LoopbackAddress = string;
export type LoopbackTransportName = string;
export type LoopbackFabricRevision = string;
export type LoopbackCounterValue = string;
export type LoopbackCounterKey =
  | "connectionsAccepted"
  | "connectionsRejected"
  | "packetsAcceptedLeftToRight"
  | "bytesAcceptedLeftToRight"
  | "packetsAcceptedRightToLeft"
  | "bytesAcceptedRightToLeft"
  | "backpressureActivations"
  | "gracefulChannelCloses"
  | "forcedChannelAborts"
  | "adapterInvariantFaults";

export interface LoopbackFabricLimits {
  readonly maxTransports: number;
  readonly maxListeners: number;
  readonly maxPendingAcquisitions: number;
  readonly maxActiveChannels: number;
  readonly maxPacketBytes: number;
  readonly maxBufferedPacketsPerChannel: number;
  readonly maxBufferedBytesPerChannel: number;
  readonly maxQueuedPacketsTotal: number;
  readonly maxQueuedBytesTotal: number;
  readonly maxPendingSendBytesTotal: number;
}

export interface LoopbackFabricConfig {
  readonly fabricId: LoopbackFabricId;
  readonly limits: LoopbackFabricLimits;
}

export interface LoopbackTransportConfig {
  readonly transportName: LoopbackTransportName;
  readonly capabilities: {
    readonly listen: boolean;
    readonly connect: boolean;
  };
}

export interface LoopbackListenerConfig {
  readonly fabricId: LoopbackFabricId;
  readonly address: LoopbackAddress;
}

export interface LoopbackTargetConfig {
  readonly fabricId: LoopbackFabricId;
  readonly address: LoopbackAddress;
}

export type LoopbackFabricFailureSnapshot =
  | {
      readonly code: "ADAPTER_FAULT";
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "revision" | "arbitration-sequence";
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "counter";
      readonly counterKey: LoopbackCounterKey;
    };

export interface LoopbackListenerSnapshot {
  readonly listenerId: string;
  readonly address: LoopbackAddress;
  readonly state: "Listening" | "Closing" | "Terminal";
  readonly terminal?: TransportListenerTerminal;
  readonly activeChannels: number;
}

export interface LoopbackChannelSnapshot {
  readonly channelId: string;
  readonly leftTransport: LoopbackTransportName;
  readonly rightTransport: LoopbackTransportName;
  readonly state: "Open" | "Closing" | "Terminal";
  readonly leftTerminal?: TransportTerminal;
  readonly rightTerminal?: TransportTerminal;
  readonly queuedPacketsLeft: number;
  readonly queuedBytesLeft: number;
  readonly queuedPacketsRight: number;
  readonly queuedBytesRight: number;
}

export interface LoopbackResourcesSnapshot {
  readonly pendingAcquisitions: number;
  readonly activeChannels: number;
  readonly pendingSendBytes: number;
  readonly queuedPackets: number;
  readonly queuedBytes: number;
}

export interface LoopbackCountersSnapshot {
${counterKeys.map((key) =>
    `  readonly ${key}: LoopbackCounterValue;`
  ).join("\n")}
}

export type LoopbackFabricSnapshot =
  | {
      readonly fabricId: LoopbackFabricId;
      readonly state: "Running" | "Closing" | "Closed";
      readonly revision: LoopbackFabricRevision;
      readonly listeners: readonly LoopbackListenerSnapshot[];
      readonly channels: readonly LoopbackChannelSnapshot[];
      readonly resources: LoopbackResourcesSnapshot;
      readonly counters: LoopbackCountersSnapshot;
    }
  | {
      readonly fabricId: LoopbackFabricId;
      readonly state: "Failed";
      readonly revision: LoopbackFabricRevision;
      readonly failure: LoopbackFabricFailureSnapshot;
      readonly listeners: readonly LoopbackListenerSnapshot[];
      readonly channels: readonly LoopbackChannelSnapshot[];
      readonly resources: LoopbackResourcesSnapshot;
      readonly counters: LoopbackCountersSnapshot;
    };
`;
}
