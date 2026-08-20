import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = resolve(root, "src/schemas/v1");
const check = process.argv.includes("--check");
const draft = "https://json-schema.org/draft/2020-12/schema";
const owner = "@agp/binding-websocket";
const maxSafe = 9_007_199_254_740_991;
const documents = [];
const id = (group, name) =>
  `urn:agp:schema:v1:binding-websocket:${group}:${name}`;
const transportRef =
  "urn:agp:schema:v1:transport:common:transport-ref";
const ref = ($ref) => ({ $ref });
const text = (description, extra = {}) => ({
  type: "string",
  description,
  ...extra,
});
const integer = (description) => ({
  type: "integer",
  description,
  minimum: 1,
  maximum: maxSafe,
});
const closed = (properties, required = Object.keys(properties), extra = {}) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
  ...extra,
});

function add(group, name, typescript, kind, body) {
  const document = {
    $schema: draft,
    $id: id(group, name),
    title: typescript,
    "x-agp": {
      owner,
      typescript,
      kind,
      mechanics: `Defines the ${name} value owned by the WebSocket binding.`,
      rationale: "Carrier-specific configuration and mapping remain outside the neutral kernel.",
      consequence: "Divergence makes WebSocket behavior ambiguous or leaks carrier authority.",
      semanticRules: body.semanticRules ?? [],
    },
    ...body,
  };
  delete document.semanticRules;
  documents.push({
    group,
    name,
    typescript,
    kind,
    path: `${group}/${name}.schema.json`,
    document,
  });
}

add("common", "subprotocol-token", "WebSocketSubprotocolToken", "scalar", {
  description: "Exact RFC 6455 subprotocol token selecting the AGP v1 binary binding.",
  const: "agp.v1",
});
add("codes", "binding-rejection-code", "WebSocketBindingRejectionCode", "code", {
  description: "Closed private WebSocket rejection classification.",
  type: "string",
  enum: [
    "TEXT_MESSAGE",
    "INVALID_TEXT_UTF8",
    "PACKET_TOO_LARGE",
    "MALFORMED_FRAMING",
    "RECEIVE_OVERFLOW",
  ],
});
add("configuration", "security", "WebSocketSecurityConfigData", "configuration", {
  description: "Certified trusted-development security declaration.",
  ...closed({
    mode: {
      const: "trusted-development",
      description: "Explicit unauthenticated cleartext development profile.",
    },
  }),
});
add("configuration", "compression", "WebSocketCompressionConfig", "configuration", {
  description: "Closed RFC 7692 compression configuration.",
  oneOf: [
    closed({
      mode: {
        const: "disabled",
        description: "No WebSocket data-message compression.",
      },
    }),
    closed({
      mode: {
        const: "permessage-deflate",
        description: "Explicit bounded RFC 7692 compression.",
      },
      maxCompressedBytes: integer("Maximum compressed carrier-message bytes."),
      noContextTakeover: {
        const: true,
        description: "Both directions disable context takeover.",
      },
    }),
  ],
});
add("configuration", "liveness", "WebSocketLivenessConfigData", "configuration", {
  description: "Finite carrier-private Ping/Pong liveness settings.",
  ...closed({
    pingIntervalMs: integer("Interval between adapter Ping probes."),
    pongTimeoutMs: integer("Deadline for the matching Pong."),
  }),
});

const commonBindingProperties = {
  transportRef: {
    ...ref(transportRef),
    description: "Application-local logical acquisition reference.",
  },
  url: text("Bound trusted-development ws: locator.", {
    minLength: 1,
    maxLength: 2048,
    pattern: "^[^\\u0000-\\u001F\\u007F]+$",
  }),
  compression: {
    ...ref(id("configuration", "compression")),
    description: "Carrier compression policy.",
  },
  liveness: {
    ...ref(id("configuration", "liveness")),
    description: "Optional carrier-private liveness policy.",
  },
  security: {
    ...ref(id("configuration", "security")),
    description: "Exact certified security profile.",
  },
};
add("configuration", "listener", "WebSocketListenerConfigData", "configuration", {
  description: "One WebSocket listener capability binding.",
  ...closed({
    ...commonBindingProperties,
    displayAddress: text("Optional sanitized operator display evidence.", {
      minLength: 1,
      maxLength: 256,
      pattern: "^[^\\u0000-\\u001F\\u007F]+$",
    }),
  }, ["transportRef", "url", "compression", "security"]),
});
add("configuration", "target", "WebSocketTargetConfigData", "configuration", {
  description: "One WebSocket outbound target capability binding.",
  ...closed(
    commonBindingProperties,
    ["transportRef", "url", "compression", "security"],
  ),
});
add("configuration", "transport", "WebSocketTransportConfigData", "configuration", {
  description: "Complete resolver input for one certified WebSocket adapter.",
  ...closed({
    listeners: {
      type: "array",
      description: "Listener capability bindings.",
      items: ref(id("configuration", "listener")),
      maxItems: 4096,
    },
    targets: {
      type: "array",
      description: "Outbound target capability bindings.",
      items: ref(id("configuration", "target")),
      maxItems: 4096,
    },
  }),
  semanticRules: ["WEBSOCKET-REFERENCE-UNIQUENESS-1"],
});
add("contracts", "close-mapping", "WebSocketCloseMapping", "contract", {
  description: "Sovereign projection from binding condition to empty-reason RFC 6455 close action.",
  ...closed({
    condition: {
      type: "string",
      enum: [
        "local-close",
        "malformed-framing",
        "text-message",
        "invalid-text-utf8",
        "packet-too-large",
        "receive-overflow",
        "adapter-fault",
      ],
      description: "Closed binding-owned condition.",
    },
    closeCode: {
      type: "integer",
      enum: [1000, 1002, 1003, 1007, 1009, 1011],
      description: "RFC 6455 close status selected by the binding.",
    },
    reason: {
      const: "",
      description: "Binding-initiated close reasons are always empty.",
    },
  }),
  semanticRules: ["WEBSOCKET-PACKET-BINDING-1"],
});

documents.sort((left, right) => left.path.localeCompare(right.path));
const rendered = new Map(documents.map((entry) => [
  entry.path,
  `${JSON.stringify(entry.document, null, 2)}\n`,
]));
for (const entry of documents) {
  await emit(resolve(schemaRoot, entry.path), rendered.get(entry.path));
}
const catalog = {
  schemaVersion: "agp.schema-catalog/v1",
  owner,
  schemas: documents.map((entry) => ({
    id: entry.document.$id,
    owner,
    path: entry.path,
    kind: entry.kind,
    typescript: entry.typescript,
    sha256: createHash("sha256")
      .update(rendered.get(entry.path))
      .digest("hex"),
  })),
};
await emit(
  resolve(schemaRoot, "catalog.json"),
  `${JSON.stringify(catalog, null, 2)}\n`,
);
await emit(
  resolve(root, "src/schema-documents.generated.ts"),
  `// Generated by scripts/generate-contracts.mjs. DO NOT EDIT.\n`
  + `export const webSocketBindingSchemaDocumentsV1 = Object.freeze(`
  + `${JSON.stringify(documents.map((entry) => entry.document), null, 2)}`
  + `) as readonly Readonly<Record<string, unknown>>[];\n`,
);
await emit(resolve(root, "src/types.generated.ts"), generatedTypes());

async function emit(destination, content) {
  if (check) {
    const existing = await readFile(destination, "utf8").catch(() => undefined);
    if (existing !== content) {
      throw new Error(`Generated file is stale: ${destination}`);
    }
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

function generatedTypes() {
  return `// Generated by scripts/generate-contracts.mjs. DO NOT EDIT.
import type { TransportRef } from "@agp/transport";

export type WebSocketSubprotocolToken = "agp.v1";
export type WebSocketBindingRejectionCode =
  | "TEXT_MESSAGE"
  | "INVALID_TEXT_UTF8"
  | "PACKET_TOO_LARGE"
  | "MALFORMED_FRAMING"
  | "RECEIVE_OVERFLOW";
export interface WebSocketSecurityConfigData {
  readonly mode: "trusted-development";
}
export type WebSocketCompressionConfig =
  | Readonly<{ mode: "disabled" }>
  | Readonly<{
      mode: "permessage-deflate";
      maxCompressedBytes: number;
      noContextTakeover: true;
    }>;
export interface WebSocketLivenessConfigData {
  readonly pingIntervalMs: number;
  readonly pongTimeoutMs: number;
}
export interface WebSocketListenerConfigData {
  readonly transportRef: TransportRef;
  readonly url: string;
  readonly displayAddress?: string;
  readonly compression: WebSocketCompressionConfig;
  readonly liveness?: WebSocketLivenessConfigData;
  readonly security: WebSocketSecurityConfigData;
}
export interface WebSocketTargetConfigData {
  readonly transportRef: TransportRef;
  readonly url: string;
  readonly compression: WebSocketCompressionConfig;
  readonly liveness?: WebSocketLivenessConfigData;
  readonly security: WebSocketSecurityConfigData;
}
export interface WebSocketTransportConfigData {
  readonly listeners: readonly WebSocketListenerConfigData[];
  readonly targets: readonly WebSocketTargetConfigData[];
}
export interface WebSocketCloseMapping {
  readonly condition:
    | "local-close"
    | "malformed-framing"
    | "text-message"
    | "invalid-text-utf8"
    | "packet-too-large"
    | "receive-overflow"
    | "adapter-fault";
  readonly closeCode: 1000 | 1002 | 1003 | 1007 | 1009 | 1011;
  readonly reason: "";
}
`;
}
