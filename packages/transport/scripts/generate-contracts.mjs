import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = resolve(root, "src/schemas/v1");
const check = process.argv.includes("--check");
const draft = "https://json-schema.org/draft/2020-12/schema";
const owner = "@agp/transport";
const maxSafe = 9_007_199_254_740_991;
const documents = [];
const id = (group, name) => `urn:agp:schema:v1:transport:${group}:${name}`;
const ref = ($ref) => ({ $ref });
const description = (value, text) => ({ ...value, description: text });
const string = (text, extra = {}) => description({ type: "string", ...extra }, text);
const integer = (text, extra = {}) => description({ type: "integer", ...extra }, text);
const closed = (properties, required = Object.keys(properties), extra = {}) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
  ...extra,
});

function add(group, name, typescript, kind, body, folder = group) {
  const document = {
    $schema: draft,
    $id: id(group, name),
    title: typescript,
    description: body.description ?? `Sovereign ${name} transport contract.`,
    "x-agp": {
      owner,
      typescript,
      kind,
      mechanics: `Defines the bounded ${name} value crossing the neutral transport boundary.`,
      rationale: "One schema and generated type prevent adapter-specific reinterpretation.",
      consequence: "A divergent shape makes transport implementations observably incompatible.",
      semanticRules: body.semanticRules ?? [],
    },
    ...body,
  };
  delete document.semanticRules;
  documents.push({ group, name, typescript, kind, path: `${folder}/${name}.schema.json`, document });
}

add("common", "transport-ref", "TransportRef", "scalar", string(
  "Application-local logical name resolving to one bound acquisition capability.",
  { minLength: 1, maxLength: 64, pattern: "^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$" },
));

const codeSets = {
  "transport-terminal-origin": ["local", "remote", "carrier"],
  "transport-terminal-kind": [
    "graceful", "aborted", "io-failure", "resource-exhausted",
    "binding-violation", "adapter-fault",
  ],
  "transport-listener-terminal-kind": [
    "graceful", "aborted", "io-failure", "resource-exhausted", "adapter-fault",
  ],
  "transport-input-rejection-code": ["PACKET_TOO_LARGE", "MALFORMED_CARRIER_INPUT"],
  "transport-operation-error-code": [
    "REFERENCE_INVALID", "BINDING_UNAVAILABLE", "LISTEN_FAILED",
    "CONNECT_FAILED", "CAPACITY_EXCEEDED", "PACKET_TOO_LARGE",
    "CONCURRENT_OPERATION", "CHANNEL_TERMINAL", "OPERATION_ABORTED",
    "SEND_FAILED", "ADAPTER_FAULT",
  ],
  "transport-operation-phase": [
    "resolve-listener", "resolve-target", "listen", "connect", "send",
    "read", "close", "wait-terminal",
  ],
};
for (const [name, values] of Object.entries(codeSets)) {
  add("codes", name, pascal(name), "code", {
    description: `Closed ${name} code domain.`,
    type: "string",
    enum: values,
  });
}

add("contracts", "transport-channel-limits", "TransportChannelLimits", "contract", {
  description: "Exact common packet and inbound-buffer bounds for one channel.",
  ...closed({
    maxPacketBytes: integer("Maximum bytes in one decoded packet.", { minimum: 1, maximum: maxSafe }),
    maxBufferedPackets: integer("Maximum complete inbound packets retained.", { minimum: 1, maximum: maxSafe }),
    maxBufferedBytes: integer("Maximum aggregate inbound packet bytes retained.", { minimum: 1, maximum: maxSafe }),
  }),
  semanticRules: ["TRANSPORT-CHANNEL-ORDER-1"],
});
add("contracts", "transport-listener-limits", "TransportListenerLimits", "contract", {
  description: "Exact acquisition and channel bounds for one listener.",
  ...closed({
    maxPendingAcquisitions: integer("Maximum carrier acquisitions awaiting disposition.", { minimum: 1, maximum: maxSafe }),
    maxActiveChannels: integer("Maximum physically retained accepted channels.", { minimum: 1, maximum: maxSafe }),
    channel: description(ref(id("contracts", "transport-channel-limits")), "Limits applied to each accepted channel."),
  }),
});
add("contracts", "transport-listen-options", "TransportListenOptions", "contract", {
  description: "Neutral options supplied to one bound listen capability.",
  ...closed({
    limits: description(ref(id("contracts", "transport-listener-limits")), "Authoritative listener limits."),
  }),
});
add("contracts", "transport-acquisition-options", "TransportAcquisitionOptions", "contract", {
  description: "Neutral options supplied to one bound connect capability.",
  ...closed({
    channel: description(ref(id("contracts", "transport-channel-limits")), "Authoritative channel limits."),
  }),
});
add("contracts", "transport-input-rejected", "TransportInputRejected", "contract", {
  description: "Ordered evidence that one carrier record could not form a common packet.",
  ...closed({
    kind: description({ const: "input-rejected" }, "Read-result discriminator."),
    code: description(ref(id("codes", "transport-input-rejection-code")), "Stable rejection classification."),
  }),
});
add("contracts", "transport-diagnostic", "TransportDiagnostic", "contract", {
  description: "Bounded sanitized adapter diagnostic safe at the neutral boundary.",
  ...closed({
    code: string("Stable diagnostic code.", { pattern: "^[A-Z][A-Z0-9_]{0,63}$" }),
    message: string("Optional sanitized diagnostic text.", {
      minLength: 1,
      maxLength: 256,
      pattern: "^[^\\u0000-\\u001F\\u007F]+$",
    }),
  }, ["code"]),
});
add("contracts", "transport-peer-evidence", "TransportPeerEvidence", "contract", {
  description: "Closed immutable facts established during channel acquisition.",
  ...closed({
    locality: description({ type: "string", enum: ["process-local", "network"] }, "Observed carrier locality."),
    protection: description({
      type: "string",
      enum: ["none", "integrity", "confidentiality-and-integrity"],
    }, "Observed carrier protection."),
    authentication: description({
      oneOf: [
        closed({ kind: description({ const: "none" }, "No authenticated principal.") }),
        closed({
          kind: description({ const: "verified" }, "Verified-principal discriminator."),
          principal: string("Bounded verified deployment principal.", {
            minLength: 1,
            maxLength: 256,
            pattern: "^[^\\u0000-\\u001F\\u007F]+$",
          }),
          method: string("Stable verification method.", {
            pattern: "^[a-z][a-z0-9._-]{0,63}$",
          }),
        }),
      ],
    }, "Observed authentication evidence."),
  }),
});

const diagnostic = description(ref(id("contracts", "transport-diagnostic")), "Optional bounded diagnostic.");
function terminalVariant(origin, kinds) {
  return closed({
    origin: description({ const: origin }, "Terminal authority origin."),
    kind: description({ type: "string", enum: kinds }, "Terminal classification."),
    diagnostic,
  }, ["origin", "kind"]);
}
add("contracts", "transport-terminal", "TransportTerminal", "contract", {
  description: "One immutable channel terminal with legal origin/kind products only.",
  oneOf: [
    terminalVariant("local", ["graceful", "aborted", "resource-exhausted"]),
    terminalVariant("remote", ["graceful", "io-failure", "binding-violation"]),
    terminalVariant("carrier", [
      "io-failure", "resource-exhausted", "binding-violation", "adapter-fault",
    ]),
  ],
  semanticRules: ["TRANSPORT-TERMINAL-ONCE-1"],
});
add("contracts", "transport-listener-terminal", "TransportListenerTerminal", "contract", {
  description: "One immutable listener terminal with legal origin/kind products only.",
  oneOf: [
    terminalVariant("local", ["graceful", "aborted"]),
    terminalVariant("carrier", ["io-failure", "resource-exhausted", "adapter-fault"]),
  ],
});
add("contracts", "transport-close-intent", "TransportCloseIntent", "contract", {
  description: "Bounded neutral graceful-close intent.",
  ...closed({
    kind: description({
      type: "string",
      enum: ["normal", "node-stop", "session-replaced", "protocol-fatal"],
    }, "Neutral close classification."),
    code: string("Stable bounded local diagnostic code.", { pattern: "^[A-Z][A-Z0-9_]{0,63}$" }),
  }),
});
add("contracts", "transport-abort-intent", "TransportAbortIntent", "contract", {
  description: "Bounded neutral immediate-abort intent.",
  ...closed({
    kind: description({
      type: "string",
      enum: ["deadline", "capacity", "invariant", "forced-stop"],
    }, "Neutral abort classification."),
    code: string("Stable bounded local diagnostic code.", { pattern: "^[A-Z][A-Z0-9_]{0,63}$" }),
  }),
});
add("contracts", "transport-listener-publication", "TransportListenerPublication", "contract", {
  description: "Sanitized operator evidence returned by one listener.",
  ...closed({
    displayAddress: string("Optional non-authoritative display address.", {
      minLength: 1,
      maxLength: 256,
      pattern: "^[^\\u0000-\\u001F\\u007F]+$",
    }),
  }, []),
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
    sha256: createHash("sha256").update(rendered.get(entry.path)).digest("hex"),
  })),
};
await emit(resolve(schemaRoot, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
await emit(
  resolve(root, "src/schema-documents.generated.ts"),
  `// Generated by scripts/generate-contracts.mjs. DO NOT EDIT.\n`
  + `export const transportSchemaDocumentsV1 = Object.freeze(`
  + `${JSON.stringify(documents.map((entry) => entry.document), null, 2)}`
  + `) as readonly Readonly<Record<string, unknown>>[];\n`,
);
await emit(resolve(root, "src/types.generated.ts"), generatedTypes());

async function emit(destination, content) {
  if (check) {
    const existing = await readFile(destination, "utf8").catch(() => undefined);
    if (existing !== content) throw new Error(`Generated file is stale: ${destination}`);
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

function pascal(value) {
  return value.split("-").map((part) =>
    part.slice(0, 1).toUpperCase() + part.slice(1)).join("");
}

function generatedTypes() {
  return `// Generated by scripts/generate-contracts.mjs. DO NOT EDIT.
export type TransportRef = string;
export type TransportTerminalOrigin = "local" | "remote" | "carrier";
export type TransportTerminalKind = "graceful" | "aborted" | "io-failure" | "resource-exhausted" | "binding-violation" | "adapter-fault";
export type TransportListenerTerminalKind = "graceful" | "aborted" | "io-failure" | "resource-exhausted" | "adapter-fault";
export type TransportInputRejectionCode = "PACKET_TOO_LARGE" | "MALFORMED_CARRIER_INPUT";
export type TransportOperationErrorCode = "REFERENCE_INVALID" | "BINDING_UNAVAILABLE" | "LISTEN_FAILED" | "CONNECT_FAILED" | "CAPACITY_EXCEEDED" | "PACKET_TOO_LARGE" | "CONCURRENT_OPERATION" | "CHANNEL_TERMINAL" | "OPERATION_ABORTED" | "SEND_FAILED" | "ADAPTER_FAULT";
export type TransportOperationPhase = "resolve-listener" | "resolve-target" | "listen" | "connect" | "send" | "read" | "close" | "wait-terminal";
export interface TransportChannelLimits {
  readonly maxPacketBytes: number;
  readonly maxBufferedPackets: number;
  readonly maxBufferedBytes: number;
}
export interface TransportListenerLimits {
  readonly maxPendingAcquisitions: number;
  readonly maxActiveChannels: number;
  readonly channel: TransportChannelLimits;
}
export interface TransportListenOptions {
  readonly limits: TransportListenerLimits;
}
export interface TransportAcquisitionOptions {
  readonly channel: TransportChannelLimits;
}
export interface TransportInputRejected {
  readonly kind: "input-rejected";
  readonly code: TransportInputRejectionCode;
}
export interface TransportDiagnostic {
  readonly code: string;
  readonly message?: string;
}
export type TransportPeerEvidence = Readonly<{
  locality: "process-local" | "network";
  protection: "none" | "integrity" | "confidentiality-and-integrity";
  authentication:
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "verified"; principal: string; method: string }>;
}>;
export type TransportTerminal =
  | Readonly<{ origin: "local"; kind: "graceful" | "aborted" | "resource-exhausted"; diagnostic?: TransportDiagnostic }>
  | Readonly<{ origin: "remote"; kind: "graceful" | "io-failure" | "binding-violation"; diagnostic?: TransportDiagnostic }>
  | Readonly<{ origin: "carrier"; kind: "io-failure" | "resource-exhausted" | "binding-violation" | "adapter-fault"; diagnostic?: TransportDiagnostic }>;
export type TransportListenerTerminal =
  | Readonly<{ origin: "local"; kind: "graceful" | "aborted"; diagnostic?: TransportDiagnostic }>
  | Readonly<{ origin: "carrier"; kind: "io-failure" | "resource-exhausted" | "adapter-fault"; diagnostic?: TransportDiagnostic }>;
export interface TransportCloseIntent {
  readonly kind: "normal" | "node-stop" | "session-replaced" | "protocol-fatal";
  readonly code: string;
}
export interface TransportAbortIntent {
  readonly kind: "deadline" | "capacity" | "invariant" | "forced-stop";
  readonly code: string;
}
export interface TransportListenerPublication {
  readonly displayAddress?: string;
}
`;
}
