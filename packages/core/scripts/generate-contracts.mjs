import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaRoot = join(root, "src", "schemas", "v1");
const check = process.argv.includes("--check");
const draft = "https://json-schema.org/draft/2020-12/schema";
const core = (group, name) => `urn:agp:schema:v1:core:${group}:${name}`;
const protocol = (group, name) => `urn:agp:schema:v1:protocol:${group}:${name}`;
const transport = (group, name) =>
  `urn:agp:schema:v1:transport:${group}:${name}`;
const ref = ($ref) => ({ $ref });
const string = (extra = {}) => ({ type: "string", ...extra });
const integer = (extra = {}) => ({ type: "integer", ...extra });
const bool = { type: "boolean" };
const semantic = (...semanticRules) => ({ "x-agp": { semanticRules } });
const documents = [];

function add(group, name, schema, folder = group) {
  const suppliedMetadata = schema["x-agp"] ?? {};
  const schemaBody = { ...schema };
  delete schemaBody["x-agp"];
  const typescript = pascal(name);
  const document = {
    $schema: draft,
    $id: core(group, name),
    title: `AGP core ${name}`,
    "x-agp": {
      owner: "@agp/core",
      typescript,
      kind: schemaKind(group, name, folder),
      mechanics: `Sovereign ${name} data contract owned by @agp/core.`,
      rationale: "One schema gives runtime validators and consumers one stable reasoning boundary.",
      consequence: "Accepting another shape would make canonical state or SDK interpretation ambiguous.",
      semanticRules: suppliedMetadata.semanticRules ?? [],
    },
    ...schemaBody,
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

function closed(properties, required = Object.keys(properties), extra = {}) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    ...extra,
  };
}

function list(itemRef, property = "items") {
  return closed({
    ...metaProperties(),
    [property]: { type: "array", items: ref(itemRef) },
  });
}

function metaProperties() {
  return {
    schemaVersion: { const: "agp.operations/v1" },
    nodeId: ref(protocol("common", "node-id")),
    instanceId: ref(core("common", "instance-id")),
    capturedAt: ref(core("common", "timestamp")),
    revision: ref(core("common", "operations-revision")),
  };
}

// Common scalar ownership.
add("common", "instance-id", string({ minLength: 1, maxLength: 160 }));
add("common", "route-id", string({ minLength: 1, maxLength: 160 }));
add("common", "binding-id", string({ minLength: 1, maxLength: 160 }));
add("common", "adjacency-id", string({
  pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$",
}));
add("common", "direction", {
  type: "string",
  enum: ["inbound", "outbound"],
});
add("common", "timestamp", string({
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$",
}));
add("common", "duration-ms", integer({ minimum: 0, maximum: 9007199254740991 }));
// Microseconds, because the durations D20 measures are routinely below one
// millisecond and an integer millisecond would report them as zero. Keeping
// the unit integral avoids a float-precision argument inside a contract.
add("common", "duration-us", integer({ minimum: 0, maximum: 9007199254740991 }));
const unsigned64Decimal = {
  pattern: "^(0|[1-9][0-9]{0,19})$",
  ...semantic("CORE-MONOTONIC-EXHAUSTION-1"),
};
add("common", "operations-revision", string(unsigned64Decimal));
add("common", "event-sequence", string(unsigned64Decimal));
add("common", "counter-value", string(unsigned64Decimal));

const codeSets = {
  "host-state": ["Created", "Starting", "Running", "Stopping", "Stopped", "Failed"],
  "host-failure-code": [
    "START_FAILED", "LISTENER_TERMINAL",
    "MONOTONIC_DOMAIN_EXHAUSTED", "INTERNAL_INVARIANT",
  ],
  "monotonic-domain": ["operations-revision", "event-sequence", "counter"],
  "counter-key": [
    "capacity.session_rejected",
    "handler.completed",
    "handler.failed",
    "lifecycle.failed",
    "lifecycle.started",
    "lifecycle.stopped",
    "message.accepted",
    "message.forwarded",
    "message.received",
    "message.rejected_before_admission",
    "transport.error",
    "transport.listener_terminal",
  ],
  "diagnostic-domain": [
    "lifecycle", "protocol", "transport", "session", "routing",
    "admission", "handler", "operations", "sdk",
  ],
  "diagnostic-severity": ["warning", "error", "critical"],
  "connection-state": ["Idle", "Connect", "Active", "OpenSent", "OpenConfirm", "Established"],
  "sdk-error-code": [
    "CONFIG_INVALID", "OPTIONS_INVALID", "LIFECYCLE_INVALID", "NOT_RUNNING",
    "ABORTED", "ENDPOINT_INVALID", "HANDLER_INVALID",
    "ENDPOINT_ALREADY_EXPOSED", "ENDPOINT_CAPACITY", "CORRELATION_INVALID",
    "SOURCE_NOT_OWNED", "PAYLOAD_NOT_JSON", "MESSAGE_TOO_LARGE", "NO_ROUTE",
    "SOURCE_NOT_ADVERTISED", "NEXT_HOP_UNAVAILABLE", "INSTANCE_UNREACHABLE", "QUEUE_FULL",
    "TRANSPORT_FAILURE", "INTERNAL",
  ],
  "identity-denial-code": ["POLICY", "EXPECTED_NODE_MISMATCH", "SECURITY_EVIDENCE", "CAPACITY"],
  "selected-reason": [
    "ONLY_ELIGIBLE", "PREFER_LOCAL", "SHORTEST_PATH",
    "LOWEST_ORIGIN_NODE_ID", "LOWEST_NODE_PATH", "LOWEST_BINDING_ID",
  ],
  "ineligible-reason": [
    "LOCAL_BINDING_INACTIVE", "LOCAL_ENDPOINT_INDEX_MISMATCH",
    "ADVERTISEMENT_INACTIVE", "ADVERTISEMENT_MISMATCH",
    "SESSION_CONTROLLER_STALE", "SESSION_NOT_ESTABLISHED",
    "SESSION_IDENTITY_MISMATCH", "PATH_INVALID", "NEXT_HOP_UNRESOLVED",
  ],
  "route-reason-code": ["TRANSIT_DISABLED", "PEER_IN_PATH", "PATH_TOO_LONG", "CAPACITY"],
  "session-event-code": [
    "StartDial", "StartAccept", "Stop", "TransportOpened",
    "TransportAccepted", "TransportFailed", "TransportClosed",
    "TransportInputRejected", "OpenReceived", "KeepaliveReceived",
    "RouteUpdateReceived", "RouteAckReceived", "DataReceived", "DispositionReceived",
    "NotificationReceived", "InvalidMessage", "UnexpectedMessage",
    "IdentityAdmissionResolved", "RouteAdmissionResolved", "AdmissionExpired",
    "AdmissionFaulted", "LocalRoutesChanged", "RouteUpdateWritten",
    "RetryExpired", "OpenExpired", "KeepaliveExpired", "HoldExpired",
    "RouteWriteExpired", "RouteAckExpired", "RouteRevisionRollover",
    "ControlQueueOverflow",
  ],
  "resource-code": [
    "pendingHandshakes", "sessionCapacitySlots", "controlQueue",
    "dataQueue", "continuationQueue", "candidateRoutes", "localBindings",
    "activeHandlers", "labelBindings", "eventSubscribers",
  ],
};
for (const [name, values] of Object.entries(codeSets)) {
  add("codes", name, {
    type: "string",
    enum: values,
    ...(name === "host-state"
      ? semantic("NODE-ONE-SHOT-LIFECYCLE-1")
      : {}),
  });
}
add("codes", "candidate-selection-reason", {
  oneOf: [
    ref(core("codes", "selected-reason")),
    ref(core("codes", "ineligible-reason")),
  ],
});
add("codes", "session-reason-code", {
  oneOf: [
    ref(core("codes", "session-event-code")),
    ref(protocol("codes", "fatal-notification-code")),
  ],
});
add("codes", "diagnostic-code", string({
  pattern: "^[A-Z][A-Z0-9_]{0,63}$",
}));

// Configuration.
add("configuration", "listener-config", closed({
  transportRef: ref(transport("common", "transport-ref")),
}));
add("configuration", "reconnect-policy", closed({
  enabled: bool,
  initialDelayMs: integer({ minimum: 1, maximum: 9007199254740991 }),
  maximumDelayMs: integer({ minimum: 1, maximum: 9007199254740991 }),
  multiplier: { type: "number", minimum: 1, maximum: 16 },
  jitterRatio: { type: "number", minimum: 0, maximum: 1 },
}, ["initialDelayMs", "maximumDelayMs"]));
add("configuration", "peer-config", closed({
  adjacencyId: ref(core("common", "adjacency-id")),
  expectedNodeId: ref(protocol("common", "node-id")),
  transportRef: ref(transport("common", "transport-ref")),
  reconnect: ref(core("configuration", "reconnect-policy")),
}, ["adjacencyId", "expectedNodeId", "transportRef"]));
add("configuration", "route-rejection-retry", closed({
  initialMs: integer({ minimum: 1, maximum: 9007199254740991 }),
  maxMs: integer({ minimum: 1, maximum: 9007199254740991 }),
}, [], semantic("ROUTE-REJECTION-RETRY-1")));
add("configuration", "transit-config", closed({
  enabled: bool,
  defaultHopLimit: integer({ minimum: 1, maximum: 65535 }),
}, ["enabled"]));
for (const name of ["identity-admission-policy", "route-admission-policy"]) {
  add("configuration", name, closed({
    mode: { type: "string", enum: ["allow", "port"] },
  }, []));
}
add("configuration", "timers", closed(Object.fromEntries([
  "holdTimeMs", "openTimeoutMs", "identityAdmissionTimeoutMs",
  "routeAdmissionTimeoutMs", "routeWriteTimeoutMs", "routeAckTimeoutMs",
  "transportWriteTimeoutMs", "transportCloseTimeoutMs",
].map((name) => [name, integer({ minimum: 0, maximum: 9007199254740991 })])), []));
add("configuration", "limits", closed(Object.fromEntries([
  "receiveLimitBytes", "maxRoutesPerSnapshot", "maxPathLength", "maxHopCount",
  "maxLocalEndpoints", "maxCandidateRoutes",
].map((name) => [name, integer({ minimum: 1, maximum: 9007199254740991 })])), []));
add("configuration", "capacity", closed(Object.fromEntries([
  "maxSessions", "maxPendingHandshakes", "controlQueueMessages",
  "controlQueueBytes", "dataQueueMessages", "dataQueueBytes",
  "continuationQueueMessages", "continuationQueueBytes", "maxActiveHandlers",
  "maxActiveHandlerBytes", "maxLabelBindings", "maxEventSubscribers",
  "eventSubscriberBuffer", "transportReceivePackets", "transportReceiveBytes",
].map((name) => [name, integer({ minimum: 1, maximum: 9007199254740991 })])), []));
add("configuration", "disposition", closed({
  debounceMs: integer({ minimum: 0, maximum: 60000 }),
  maximumOutcomes: integer({ minimum: 1, maximum: 9007199254740991 }),
  maximumInboundOutcomes: integer({ minimum: 1, maximum: 9007199254740991 }),
  onCapacity: { type: "string", enum: ["evict-oldest", "refuse"] },
}, []));
add("configuration", "node-config", closed({
  nodeId: ref(protocol("common", "node-id")),
  listen: ref(core("configuration", "listener-config")),
  peers: {
    type: "array",
    maxItems: 4096,
    items: ref(core("configuration", "peer-config")),
  },
  transit: ref(core("configuration", "transit-config")),
  routeRejectionRetry: ref(core("configuration", "route-rejection-retry")),
  timers: ref(core("configuration", "timers")),
  limits: ref(core("configuration", "limits")),
  capacity: ref(core("configuration", "capacity")),
  disposition: ref(core("configuration", "disposition")),
  identityAdmission: ref(core("configuration", "identity-admission-policy")),
  routeAdmission: ref(core("configuration", "route-admission-policy")),
}, ["nodeId"], semantic(
  "PEER-ADJACENCY-UNIQUENESS-1",
  "TRANSPORT-REFERENCE-RESOLUTION-1",
)));

// SDK data records.
add("sdk", "started-node", closed({
  nodeId: ref(protocol("common", "node-id")),
  instanceId: ref(core("common", "instance-id")),
  startedAt: ref(core("common", "timestamp")),
  listener: closed({
    transportRef: ref(transport("common", "transport-ref")),
    publication: ref(transport("contracts", "transport-listener-publication")),
  }, ["transportRef"]),
  operationsRevision: ref(core("common", "operations-revision")),
}, ["nodeId", "instanceId", "startedAt", "operationsRevision"]));
add("sdk", "stop-report", closed({
  operationsRevision: ref(core("common", "operations-revision")),
  stoppedAt: ref(core("common", "timestamp")),
  drainedMessages: ref(core("common", "counter-value")),
  discardedMessages: ref(core("common", "counter-value")),
}));
add("sdk", "endpoint-binding-info", closed({
  endpoint: ref(protocol("common", "endpoint-name")),
  bindingId: ref(core("common", "binding-id")),
  registeredAt: ref(core("common", "timestamp")),
  operationsRevision: ref(core("common", "operations-revision")),
}));
add("sdk", "endpoint-delivery-context", closed({
  messageId: ref(protocol("common", "message-id")),
  correlationId: ref(protocol("common", "correlation-id")),
  source: ref(protocol("routing", "endpoint-source")),
  destination: ref(protocol("common", "endpoint-name")),
  receivedAt: ref(core("common", "timestamp")),
  ingressNodeId: ref(protocol("common", "node-id")),
  ingressSessionId: ref(protocol("common", "session-id")),
  operationsRevision: ref(core("common", "operations-revision")),
}, ["messageId", "source", "destination", "receivedAt", "operationsRevision"]));
add("sdk", "send-receipt", closed({
  messageId: ref(protocol("common", "message-id")),
  correlationId: ref(protocol("common", "correlation-id")),
  acceptedAt: ref(core("common", "timestamp")),
  operationsRevision: ref(core("common", "operations-revision")),
  selectedRouteId: ref(core("common", "route-id")),
  nextHop: ref(core("operations", "next-hop")),
}, ["messageId", "acceptedAt", "operationsRevision", "selectedRouteId", "nextHop"]));
add("sdk", "identity-admission-request", closed({
  localNodeId: ref(protocol("common", "node-id")),
  remoteNodeId: ref(protocol("common", "node-id")),
  localSessionId: ref(protocol("common", "session-id")),
  remoteSessionId: ref(protocol("common", "session-id")),
  direction: ref(core("common", "direction")),
  adjacencyId: ref(core("common", "adjacency-id")),
  expectedRemoteNodeId: ref(protocol("common", "node-id")),
  peerEvidence: ref(transport("contracts", "transport-peer-evidence")),
}, [
  "localNodeId",
  "remoteNodeId",
  "localSessionId",
  "remoteSessionId",
  "direction",
  "peerEvidence",
], semantic("TRANSPORT-PEER-EVIDENCE-1")));
add("sdk", "identity-admission-result", {
  oneOf: [
    closed({ decision: { const: "allow" } }),
    closed({
      decision: { const: "deny" },
      reasonCode: ref(core("codes", "identity-denial-code")),
    }),
  ],
});
add("sdk", "route-admission-decision", {
  oneOf: [
    closed({
      endpoint: ref(protocol("common", "endpoint-name")),
      originNodeId: ref(protocol("common", "node-id")),
      path: ref(protocol("common", "node-path")),
      decision: { const: "allow" },
    }),
    closed({
      endpoint: ref(protocol("common", "endpoint-name")),
      originNodeId: ref(protocol("common", "node-id")),
      path: ref(protocol("common", "node-path")),
      decision: { const: "deny" },
      reason: string({ minLength: 1, maxLength: 512 }),
    }),
  ],
});
add("sdk", "route-admission-request", closed({
  localNodeId: ref(protocol("common", "node-id")),
  remoteNodeId: ref(protocol("common", "node-id")),
  localSessionId: ref(protocol("common", "session-id")),
  revision: ref(protocol("common", "wire-revision")),
  updateId: ref(protocol("common", "message-id")),
  routes: { type: "array", items: ref(protocol("routing", "route-advertisement")) },
}));
add("sdk", "route-admission-result", closed({
  decisions: { type: "array", items: ref(core("sdk", "route-admission-decision")) },
}));
add("sdk", "stop-policy", closed({
  drainTimeoutMs: integer({ minimum: 0, maximum: 9007199254740991 }),
}, []));
add("sdk", "send-policy", closed({
  correlationId: ref(protocol("common", "correlation-id")),
  timeoutMs: integer({ minimum: 0, maximum: 9007199254740991 }),
  destinationSelector: ref(protocol("routing", "destination-selector")),
}, [], semantic("DATA-LOCAL-NO-ROUTE-1")));
add("sdk", "event-subscription-policy", closed({
  bufferSize: integer({ minimum: 1, maximum: 65536 }),
}, []));
add("sdk", "error-record", closed({
  code: ref(core("codes", "sdk-error-code")),
  operation: string({ minLength: 1, maxLength: 128 }),
  message: string({ minLength: 1, maxLength: 1024 }),
  retryable: bool,
  details: ref(protocol("common", "json-object")),
}, ["code", "operation", "message", "retryable"]));
add("sdk", "diagnostic-record", closed({
  schemaVersion: { const: "agp.diagnostic/v1" },
  nodeId: ref(protocol("common", "node-id")),
  instanceId: ref(core("common", "instance-id")),
  occurredAt: ref(core("common", "timestamp")),
  operationsRevision: ref(core("common", "operations-revision")),
  domain: ref(core("codes", "diagnostic-domain")),
  severity: ref(core("codes", "diagnostic-severity")),
  code: ref(core("codes", "diagnostic-code")),
  message: string({
    minLength: 1,
    maxLength: 256,
    pattern: "^[^\\u0000-\\u001F\\u007F]+$",
  }),
}, [
  "schemaVersion", "nodeId", "instanceId", "occurredAt",
  "operationsRevision", "domain", "severity", "code",
]));

// Operational leaves.
add("operations", "snapshot-meta", closed(metaProperties()));
add("operations", "configuration-snapshot", closed({
  raw: ref(protocol("common", "json-object")),
  effective: ref(protocol("common", "json-object")),
  redactedKeys: { type: "array", uniqueItems: true, items: string() },
}));
add("operations", "host-failure-snapshot", {
  oneOf: [
    closed({ code: { const: "START_FAILED" } }),
    closed({
      code: { const: "LISTENER_TERMINAL" },
      terminal: ref(transport("contracts", "transport-listener-terminal")),
    }),
    closed({
      code: { const: "MONOTONIC_DOMAIN_EXHAUSTED" },
      domain: {
        type: "string",
        enum: ["operations-revision", "event-sequence"],
      },
    }),
    closed({
      code: { const: "MONOTONIC_DOMAIN_EXHAUSTED" },
      domain: { const: "counter" },
      counterKey: ref(core("codes", "counter-key")),
    }),
    closed({ code: { const: "INTERNAL_INVARIANT" } }),
  ],
});
const lifecycleCommon = {
  stateSince: ref(core("common", "timestamp")),
  startedAt: ref(core("common", "timestamp")),
  stoppedAt: ref(core("common", "timestamp")),
};
add("operations", "lifecycle-snapshot", {
  oneOf: [
    closed({
      state: {
        type: "string",
        enum: ["Created", "Starting", "Running", "Stopping", "Stopped"],
      },
      ...lifecycleCommon,
    }, ["state", "stateSince"]),
    closed({
      state: { const: "Failed" },
      ...lifecycleCommon,
      failure: ref(core("operations", "host-failure-snapshot")),
    }, ["state", "stateSince", "failure"]),
  ],
});
add("operations", "listener-snapshot", closed({
  configured: bool,
  transportRef: ref(transport("common", "transport-ref")),
  state: { type: "string", enum: ["disabled", "stopped", "starting", "listening", "terminal"] },
  publication: ref(transport("contracts", "transport-listener-publication")),
  terminal: ref(transport("contracts", "transport-listener-terminal")),
  lastErrorCode: ref(core("codes", "sdk-error-code")),
}, ["configured", "state"]));
add("operations", "adjacency-snapshot", closed({
  adjacencyId: ref(core("common", "adjacency-id")),
  expectedNodeId: ref(protocol("common", "node-id")),
  transportRef: ref(transport("common", "transport-ref")),
  desired: bool,
  state: { type: "string", enum: ["idle", "dialing", "satisfied", "retry-wait", "terminal"] },
  activeControllerId: string({ minLength: 1 }),
  retryAttempt: integer({ minimum: 0 }),
  retryAt: ref(core("common", "timestamp")),
  lastReason: string({ minLength: 1 }),
}, ["adjacencyId", "transportRef", "desired", "state", "retryAttempt"],
semantic("SESSION-CROSS-DIAL-1")));
add("operations", "session-transition-snapshot", closed({
  event: ref(core("codes", "session-event-code")),
  from: ref(core("codes", "connection-state")),
  to: ref(core("codes", "connection-state")),
  at: ref(core("common", "timestamp")),
  reasonCode: ref(core("codes", "session-reason-code")),
}, ["event", "from", "to", "at"]));
add("operations", "negotiated-capabilities-snapshot", closed({
  holdTimeMs: ref(core("common", "duration-ms")),
  keepaliveTimeMs: ref(core("common", "duration-ms")),
  peerReceiveLimitBytes: integer({ minimum: 1 }),
  maxRoutesPerSnapshot: integer({ minimum: 1 }),
  maxPathLength: integer({ minimum: 1 }),
  maxHopCount: integer({ minimum: 1 }),
  transit: bool,
}));
add("operations", "timer-snapshot", closed({
  name: string({ minLength: 1 }),
  state: { type: "string", enum: ["armed", "disabled"] },
  startedAt: ref(core("common", "timestamp")),
  durationMs: ref(core("common", "duration-ms")),
  expiresAt: ref(core("common", "timestamp")),
  remainingMs: ref(core("common", "duration-ms")),
}, ["name", "state"]));
add("operations", "return-token-allocator-snapshot", closed({
  allocated: ref(core("common", "counter-value")),
  exhausted: bool,
  maximum: { const: "18446744073709551615" },
}));
add("operations", "bounded-queue-snapshot", closed(Object.fromEntries([
  "currentMessages", "maximumMessages", "highWaterMessages",
  "currentBytes", "maximumBytes", "highWaterBytes",
].map((name) => [name, ref(core("common", "counter-value"))]))));
add("operations", "session-queues-snapshot", closed({
  control: ref(core("operations", "bounded-queue-snapshot")),
  data: ref(core("operations", "bounded-queue-snapshot")),
  continuation: ref(core("operations", "bounded-queue-snapshot")),
}));

// One shape for every duration the node measures, so a timing added later
// reuses a primitive rather than inventing a field pair. Count is carried
// because a high-water mark drawn from three samples and one drawn from three
// thousand are not the same claim. See DECISIONS.md D20.
add("operations", "latency-sample", closed({
  count: ref(core("common", "counter-value")),
  lastUs: ref(core("common", "duration-us")),
  highWaterUs: ref(core("common", "duration-us")),
}));
add("operations", "credit-dimensions", closed({
  bytes: ref(core("common", "counter-value")),
  packets: ref(core("common", "counter-value")),
}));
// A cumulative ceiling and a cumulative spend, reported as they are held
// rather than reduced to a percentage. Remaining is the derived one and is
// carried anyway, because the subtraction is the question every reader asks.
add("operations", "outbound-credit-snapshot", closed({
  unlimited: bool,
  ceiling: ref(core("operations", "credit-dimensions")),
  sent: ref(core("operations", "credit-dimensions")),
  remaining: ref(core("operations", "credit-dimensions")),
  stalls: ref(core("common", "counter-value")),
  stalledUs: ref(core("common", "duration-us")),
  stalledSince: ref(core("common", "timestamp")),
}, ["unlimited", "sent", "stalls", "stalledUs"]));
add("operations", "inbound-credit-snapshot", closed({
  capacity: ref(core("operations", "credit-dimensions")),
  read: ref(core("operations", "credit-dimensions")),
  advertised: ref(core("operations", "credit-dimensions")),
  announcements: ref(core("common", "counter-value")),
}));
add("operations", "session-credit-snapshot", closed({
  outbound: ref(core("operations", "outbound-credit-snapshot")),
  inbound: ref(core("operations", "inbound-credit-snapshot")),
}, ["outbound"]));
// Neither is required: a session that never measured one reports nothing
// rather than a zero that reads as an observation.
add("operations", "session-latency-snapshot", closed({
  routeAck: ref(core("operations", "latency-sample")),
  creditReplenishment: ref(core("operations", "latency-sample")),
}, []));
add("operations", "route-import-state", closed({
  consumedRevision: integer({ minimum: 0, maximum: 9007199254740991 }),
  routeCount: integer({ minimum: 0 }),
}, undefined, semantic("ROUTE-SNAPSHOT-REVISION-1")));
add("operations", "export-snapshot", closed({
  id: ref(protocol("common", "message-id")),
  revision: ref(protocol("common", "wire-revision")),
  routes: { type: "array", items: ref(protocol("routing", "route-advertisement")) },
}, undefined, semantic("ROUTE-WRITE-ORDER-1")));
add("operations", "adj-rib-out-route-snapshot", closed({
  remoteNodeId: ref(protocol("common", "node-id")),
  owningSessionId: ref(protocol("common", "session-id")),
  endpoint: ref(protocol("common", "endpoint-name")),
  originNodeId: ref(protocol("common", "node-id")),
  path: ref(protocol("common", "node-path")),
  state: { type: "string", enum: ["desired", "outstanding", "acked", "rejected", "suppressed"] },
  reasonCode: ref(core("codes", "route-reason-code")),
  remoteRejectionCode: ref(protocol("codes", "route-rejection-code")),
  remoteRetryAttempt: integer({ minimum: 0 }),
  remoteRetryAt: ref(core("common", "timestamp")),
  revision: ref(protocol("common", "wire-revision")),
}, ["remoteNodeId", "owningSessionId", "endpoint", "originNodeId", "path", "state"],
semantic("ROUTE-REJECTION-MEMORY-1")));
add("operations", "route-export-state", closed({
  routeDecisions: { type: "array", items: ref(core("operations", "adj-rib-out-route-snapshot")) },
  nextRevision: ref(protocol("common", "wire-revision")),
  acked: ref(core("operations", "export-snapshot")),
  outstanding: ref(core("operations", "export-snapshot")),
  coalescedDesired: { type: "array", items: ref(protocol("routing", "route-advertisement")) },
}, ["routeDecisions", "nextRevision"], semantic("ROUTE-ACK-CORRELATION-1")));
const connectionCommon = {
  direction: ref(core("common", "direction")),
  state: ref(core("codes", "connection-state")),
  stateSince: ref(core("common", "timestamp")),
  lastTransition: ref(core("operations", "session-transition-snapshot")),
  timers: { type: "array", items: ref(core("operations", "timer-snapshot")) },
  queues: ref(core("operations", "session-queues-snapshot")),
  latency: ref(core("operations", "session-latency-snapshot")),
  credit: ref(core("operations", "session-credit-snapshot")),
  lastTransportTerminal: ref(transport("contracts", "transport-terminal")),
};
add("operations", "pre-identity-controller-snapshot", {
  oneOf: [
    closed({
      identityState: { const: "pending" },
      localSessionId: ref(protocol("common", "session-id")),
      ...connectionCommon,
      direction: { const: "inbound" },
    }, [
      "identityState", "localSessionId", "direction", "state", "stateSince",
      "lastTransition", "timers", "queues",
    ]),
    closed({
      identityState: { const: "pending" },
      localSessionId: ref(protocol("common", "session-id")),
      ...connectionCommon,
      direction: { const: "outbound" },
      adjacencyId: ref(core("common", "adjacency-id")),
    }, [
      "identityState", "localSessionId", "direction", "adjacencyId", "state",
      "stateSince", "lastTransition", "timers", "queues",
    ]),
  ],
});
add("operations", "session-snapshot", closed({
  identityState: { const: "admitted" },
  sessionId: ref(protocol("common", "session-id")),
  remoteNodeId: ref(protocol("common", "node-id")),
  remoteSessionId: ref(protocol("common", "session-id")),
  ...connectionCommon,
  establishedAt: ref(core("common", "timestamp")),
  establishedDurationMs: ref(core("common", "duration-ms")),
  negotiated: ref(core("operations", "negotiated-capabilities-snapshot")),
  routeImport: ref(core("operations", "route-import-state")),
  routeExport: ref(core("operations", "route-export-state")),
  returnTokenAllocator: ref(core("operations", "return-token-allocator-snapshot")),
}, ["identityState", "sessionId", "remoteNodeId", "direction", "state", "stateSince", "lastTransition", "timers", "queues", "routeImport", "routeExport", "returnTokenAllocator"],
semantic("FSM-ESTABLISHED-MATRIX-1", "SESSION-PAIR-SCOPE-1")));
add("operations", "connection-snapshot", {
  oneOf: [
    ref(core("operations", "pre-identity-controller-snapshot")),
    ref(core("operations", "session-snapshot")),
  ],
});
add("operations", "local-endpoint-snapshot", closed({
  endpoint: ref(protocol("common", "endpoint-name")),
  bindingId: ref(core("common", "binding-id")),
  registeredAt: ref(core("common", "timestamp")),
  active: bool,
}));
add("operations", "advertisement-snapshot", closed({
  advertisementId: string({ minLength: 1 }),
  endpoint: ref(protocol("common", "endpoint-name")),
  originNodeId: ref(protocol("common", "node-id")),
  owningSessionId: ref(protocol("common", "session-id")),
  advertisingNodeId: ref(protocol("common", "node-id")),
  remoteSessionId: ref(protocol("common", "session-id")),
  receivedPath: ref(protocol("common", "node-path")),
  receivedRevision: ref(protocol("common", "wire-revision")),
  receivedAt: ref(core("common", "timestamp")),
}, undefined, semantic("ROUTE-RECEIVER-LOOP-1", "ROUTE-SNAPSHOT-REPLACE-1")));
add("operations", "next-hop", {
  oneOf: [
    closed({
      kind: { const: "local" },
      bindingId: ref(core("common", "binding-id")),
    }),
    closed({
      kind: { const: "session" },
      nodeId: ref(protocol("common", "node-id")),
      owningSessionId: ref(protocol("common", "session-id")),
    }),
  ],
});
add("operations", "candidate-route-snapshot", closed({
  routeId: ref(core("common", "route-id")),
  endpoint: ref(protocol("common", "endpoint-name")),
  originNodeId: ref(protocol("common", "node-id")),
  routeClass: { type: "string", enum: ["local", "learned"] },
  learnedKind: { type: "string", enum: ["direct", "transit"] },
  source: { type: "object" },
  path: ref(protocol("common", "node-path")),
  nextHop: ref(core("operations", "next-hop")),
  eligible: bool,
  selectionStatus: { type: "string", enum: ["selected", "not-selected", "ineligible"] },
  selectionReason: ref(core("codes", "candidate-selection-reason")),
  installedAt: ref(core("common", "timestamp")),
}, ["routeId", "endpoint", "originNodeId", "routeClass", "source", "path", "nextHop", "eligible", "selectionStatus", "selectionReason", "installedAt"],
semantic("RIB-BEST-PATH-1")));
add("operations", "selected-route-snapshot", closed({
  endpoint: ref(protocol("common", "endpoint-name")),
  routeId: ref(core("common", "route-id")),
  originNodeId: ref(protocol("common", "node-id")),
  routeClass: { type: "string", enum: ["local", "learned"] },
  learnedKind: { type: "string", enum: ["direct", "transit"] },
  sourceKind: { type: "string", enum: ["local", "session"] },
  path: ref(protocol("common", "node-path")),
  nextHop: ref(core("operations", "next-hop")),
  selectionReason: ref(core("codes", "selected-reason")),
  selectedAt: ref(core("common", "timestamp")),
}, ["endpoint", "routeId", "originNodeId", "routeClass", "sourceKind", "path", "nextHop", "selectionReason", "selectedAt"],
semantic("RIB-SELECTED-EXPORT-1", "ROUTE-PEER-LOOP-1")));
add("operations", "forwarding-entry-snapshot", closed({
  endpoint: ref(protocol("common", "endpoint-name")),
  selectedRouteId: ref(core("common", "route-id")),
  originNodeId: ref(protocol("common", "node-id")),
  nextHop: ref(core("operations", "next-hop")),
  resolvedAtRevision: ref(core("common", "operations-revision")),
}));
add("operations", "label-binding-snapshot", closed({
  messageId: ref(protocol("common", "message-id")),
  outboundReturnToken: ref(protocol("common", "return-token")),
  source: ref(protocol("routing", "endpoint-source")),
  destination: ref(protocol("common", "endpoint-name")),
  ingress: { type: "object" },
  egressNodeId: ref(protocol("common", "node-id")),
  egressSessionId: ref(protocol("common", "session-id")),
  admittedAtRevision: ref(core("common", "operations-revision")),
  expiresAt: ref(core("common", "timestamp")),
}));
add("operations", "resource-gauge", closed({
  current: ref(core("common", "counter-value")),
  maximum: ref(core("common", "counter-value")),
  highWater: ref(core("common", "counter-value")),
}));
add("operations", "resources-snapshot", closed({
  gauges: {
    type: "object",
    additionalProperties: ref(core("operations", "resource-gauge")),
  },
}));
add("operations", "counters-snapshot", closed({
  values: {
    type: "object",
    additionalProperties: ref(core("common", "counter-value")),
  },
}));

const listSchemas = [
  ["adjacency-list-snapshot", "adjacency-snapshot"],
  ["local-endpoint-list-snapshot", "local-endpoint-snapshot"],
  ["connection-list-snapshot", "connection-snapshot"],
  ["advertisement-list-snapshot", "advertisement-snapshot"],
  ["forwarding-list-snapshot", "forwarding-entry-snapshot"],
  ["adj-rib-out-list-snapshot", "adj-rib-out-route-snapshot"],
  ["label-binding-list-snapshot", "label-binding-snapshot"],
];
for (const [name, item] of listSchemas) {
  add("operations", name, list(core("operations", item)));
}
add("operations", "route-table-snapshot", closed({
  ...metaProperties(),
  candidates: { type: "array", items: ref(core("operations", "candidate-route-snapshot")) },
  selected: { type: "array", items: ref(core("operations", "selected-route-snapshot")) },
}));
add("operations", "operations-snapshot", closed({
  ...metaProperties(),
  configuration: ref(core("operations", "configuration-snapshot")),
  lifecycle: ref(core("operations", "lifecycle-snapshot")),
  listener: ref(core("operations", "listener-snapshot")),
  adjacencies: { type: "array", items: ref(core("operations", "adjacency-snapshot")) },
  localEndpoints: { type: "array", items: ref(core("operations", "local-endpoint-snapshot")) },
  connections: { type: "array", items: ref(core("operations", "connection-snapshot")) },
  advertisements: { type: "array", items: ref(core("operations", "advertisement-snapshot")) },
  candidateRoutes: { type: "array", items: ref(core("operations", "candidate-route-snapshot")) },
  selectedRoutes: { type: "array", items: ref(core("operations", "selected-route-snapshot")) },
  forwarding: { type: "array", items: ref(core("operations", "forwarding-entry-snapshot")) },
  routeExports: { type: "array", items: ref(core("operations", "adj-rib-out-route-snapshot")) },
  labelBindings: { type: "array", items: ref(core("operations", "label-binding-snapshot")) },
  resources: ref(core("operations", "resources-snapshot")),
  counters: ref(core("operations", "counters-snapshot")),
}, undefined, semantic(
  "OPERATIONS-ATOMIC-REVISION-1",
  "RESTART-EMPTY-DERIVED-STATE-1",
)));

// Concrete operational event/data sovereignty. This vocabulary is the exact
// closed set published by OperationsReader.events(), not an aspirational
// category list.
const eventDefinitions = [
  { name: "lifecycle-starting", kind: "lifecycle.starting", data: "empty" },
  { name: "lifecycle-running", kind: "lifecycle.running", data: "empty" },
  { name: "lifecycle-stopped", kind: "lifecycle.stopped", data: "empty" },
  { name: "endpoint-exposed", kind: "endpoint.exposed", data: "empty" },
  { name: "endpoint-closed", kind: "endpoint.closed", data: "empty" },
  { name: "session-established", kind: "session.established", data: "empty" },
  { name: "session-transition", kind: "session.transition", data: "empty" },
  {
    name: "session-routes-purged",
    kind: "session.routes-purged",
    data: "empty",
  },
  { name: "session-closed", kind: "session.closed", data: "session-closed" },
  {
    name: "connection-preidentity-closed",
    kind: "connection.preidentity-closed",
    data: "connection-preidentity-closed",
  },
  { name: "route-imported", kind: "route.imported", data: "empty" },
  {
    name: "route-export-acked",
    kind: "route.export-acked",
    data: "empty",
  },
  { name: "message-accepted", kind: "message.accepted", data: "empty" },
  { name: "message-forwarded", kind: "message.forwarded", data: "empty" },
  { name: "message-received", kind: "message.received", data: "empty" },
  { name: "message-failed", kind: "message.failed", data: "message-failed" },
  { name: "handler-completed", kind: "handler.completed", data: "empty" },
  { name: "handler-failed", kind: "handler.failed", data: "empty" },
  { name: "observer-gap", kind: "observer.gap", data: "observer-gap" },
];
for (const definition of eventDefinitions) {
  add(
    "event",
    `${definition.name}-data`,
    eventDataSchema(definition.data),
    "events/data",
  );
  add("event", definition.name, closed({
    schemaVersion: { const: "agp.event/v1" },
    sequence: ref(core("common", "event-sequence")),
    revision: ref(core("common", "operations-revision")),
    nodeId: ref(protocol("common", "node-id")),
    instanceId: ref(core("common", "instance-id")),
    occurredAt: ref(core("common", "timestamp")),
    kind: { const: definition.kind },
    subjectId: string({ minLength: 1, maxLength: 256 }),
    data: ref(core("event", `${definition.name}-data`)),
  }), "events");
}
add("event", "operational-event", {
  oneOf: eventDefinitions.map(
    (definition) => ref(core("event", definition.name)),
  ),
}, "events");

documents.sort((a, b) => a.path.localeCompare(b.path));
const renderedDocuments = new Map(documents.map((entry) => [
  entry.path,
  `${JSON.stringify(entry.document, null, 2)}\n`,
]));
const catalog = {
  schemaVersion: "agp.schema-catalog/v1",
  owner: "@agp/core",
  schemas: documents.map(({ group, name, path, typescript, document }) => ({
    id: document.$id,
    owner: "@agp/core",
    path,
    kind: schemaKind(group, name, path),
    typescript,
    sha256: createHash("sha256").update(renderedDocuments.get(path)).digest("hex"),
  })),
};

const generated = `// Generated by scripts/generate-contracts.mjs.\n`
  + `export const coreSchemaDocumentsV1 = Object.freeze(`
  + `${JSON.stringify(documents.map((entry) => entry.document), null, 2)}`
  + `) as readonly Readonly<Record<string, unknown>>[];\n`;

await emit(join(schemaRoot, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
for (const entry of documents) {
  await emit(
    join(schemaRoot, entry.path),
    renderedDocuments.get(entry.path),
  );
}
await emit(join(root, "src", "schema-documents.generated.ts"), generated);
await emit(
  join(root, "src", "event-types.generated.ts"),
  generatedEventTypes(eventDefinitions),
);
const rootSemanticRegistry = JSON.parse(await readFile(
  join(root, "..", "..", "schemas", "agp-v1.semantic-rules.json"),
  "utf8",
));
await emit(
  join(
    root,
    "src",
    "semantic-rules",
    "v1",
    "semantic-rules.catalog.json",
  ),
  `${JSON.stringify({
    schemaVersion: "agp.semantic-rules/v1",
    owner: "@agp/core",
    rules: rootSemanticRegistry.rules.filter(
      (rule) => rule.owner === "@agp/core",
    ),
  }, null, 2)}\n`,
);

async function emit(path, content) {
  if (check) {
    let actual;
    try {
      actual = await readFile(path, "utf8");
    } catch {
      throw new Error(`Generated file is missing: ${path}`);
    }
    if (actual !== content) throw new Error(`Generated file is stale: ${path}`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function pascal(name) {
  const overrides = {
    "adj-rib-out-list-snapshot": "AdjRibOutListSnapshot",
    "adj-rib-out-route-snapshot": "AdjRibOutRouteSnapshot",
    "sdk-error-code": "AgpErrorCode",
    "route-rejection-retry": "RouteRejectionRetryPolicy",
    "operational-event": "OperationalEvent",
  };
  return overrides[name] ?? name
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join("");
}

function schemaKind(group, name, path) {
  if (group === "common") return "scalar";
  if (group === "codes") return "code";
  if (path.includes("events/data")) return "event-data";
  if (group === "event") return name === "operational-event" ? "union" : "event";
  if (name.endsWith("-list-snapshot")) return "list";
  if (name === "operations-snapshot") return "aggregate";
  return group;
}

function eventDataSchema(kind) {
  if (kind === "message-failed") {
    return closed({
      code: ref(protocol("codes", "delivery-error-code")),
    }, []);
  }
  if (kind === "observer-gap") {
    return closed({
      droppedFrom: ref(core("common", "event-sequence")),
      droppedTo: ref(core("common", "event-sequence")),
    });
  }
  if (kind === "connection-preidentity-closed") {
    return closed({
      localSessionId: ref(protocol("common", "session-id")),
      direction: ref(core("common", "direction")),
      reason: ref(core("codes", "session-reason-code")),
      terminal: ref(transport("contracts", "transport-terminal")),
    }, ["localSessionId", "direction", "reason"]);
  }
  if (kind === "session-closed") {
    return closed({
      remoteNodeId: ref(protocol("common", "node-id")),
      localSessionId: ref(protocol("common", "session-id")),
      reason: ref(core("codes", "session-reason-code")),
      terminal: ref(transport("contracts", "transport-terminal")),
    }, ["remoteNodeId", "localSessionId", "reason"]);
  }
  return closed({}, []);
}

function generatedEventTypes(definitions) {
  const empty = definitions.filter(({ data }) => data === "empty");
  const dataTypes = definitions.map((definition) => {
    const name = `${pascal(definition.name)}Data`;
    if (definition.data === "message-failed") {
      return `export interface ${name} {\n`
        + `  readonly code?: DeliveryErrorCode;\n`
        + `}`;
    }
    if (definition.data === "observer-gap") {
      return `export interface ${name} {\n`
        + `  readonly droppedFrom: string;\n`
        + `  readonly droppedTo: string;\n`
        + `}`;
    }
    if (definition.data === "connection-preidentity-closed") {
      return `export interface ${name} {\n`
        + `  readonly localSessionId: SessionId;\n`
        + `  readonly direction: "inbound" | "outbound";\n`
        + `  readonly reason: string;\n`
        + `  readonly terminal?: TransportTerminal;\n`
        + `}`;
    }
    if (definition.data === "session-closed") {
      return `export interface ${name} {\n`
        + `  readonly remoteNodeId: NodeId;\n`
        + `  readonly localSessionId: SessionId;\n`
        + `  readonly reason: string;\n`
        + `  readonly terminal?: TransportTerminal;\n`
        + `}`;
    }
    return `export type ${name} = EmptyOperationalEventData;`;
  }).join("\n\n");
  const dataMap = definitions.map((definition) =>
    `  readonly ${JSON.stringify(definition.kind)}: `
      + `${pascal(definition.name)}Data;`
  ).join("\n");
  const concreteEvents = definitions.map((definition) =>
    `export type ${pascal(definition.name)} = `
      + `OperationalEventOf<${JSON.stringify(definition.kind)}>;`
  ).join("\n");
  const eventUnion = definitions
    .map((definition) => pascal(definition.name))
    .join("\n  | ");
  const kindValues = definitions
    .map((definition) => `  ${JSON.stringify(definition.kind)},`)
    .join("\n");
  const emptyKindUnion = empty
    .map((definition) => JSON.stringify(definition.kind))
    .join("\n  | ");

  return `// Generated from sovereign core event schemas by scripts/generate-contracts.mjs.\n`
    + `// DO NOT EDIT.\n\n`
    + `import type { DeliveryErrorCode, NodeId, SessionId } from "@agp/protocol";\n`
    + `import type { TransportTerminal } from "@agp/transport";\n\n`
    + `export const OPERATIONAL_EVENT_KINDS = Object.freeze([\n`
    + `${kindValues}\n`
    + `] as const);\n\n`
    + `export type OperationalEventKind =\n`
    + `  typeof OPERATIONAL_EVENT_KINDS[number];\n\n`
    + `export type EmptyOperationalEventKind =\n  | ${emptyKindUnion};\n\n`
    + `export type EmptyOperationalEventData =\n`
    + `  Readonly<Record<string, never>>;\n\n`
    + `${dataTypes}\n\n`
    + `export interface OperationalEventDataByKind {\n`
    + `${dataMap}\n`
    + `}\n\n`
    + `export type OperationalEventInput =\n`
    + `  | {\n`
    + `      readonly kind: EmptyOperationalEventKind;\n`
    + `      readonly subjectId: string;\n`
    + `      readonly data?: never;\n`
    + `    }\n`
    + `  | {\n`
    + `      readonly kind: "message.failed";\n`
    + `      readonly subjectId: string;\n`
    + `      readonly data?: MessageFailedData;\n`
    + `    }\n`
    + `  | {\n`
    + `      readonly kind: "observer.gap";\n`
    + `      readonly subjectId: string;\n`
    + `      readonly data: ObserverGapData;\n`
    + `    }\n`
    + `  | {\n`
    + `      readonly kind: "session.closed";\n`
    + `      readonly subjectId: string;\n`
    + `      readonly data: SessionClosedData;\n`
    + `    }\n`
    + `  | {\n`
    + `      readonly kind: "connection.preidentity-closed";\n`
    + `      readonly subjectId: string;\n`
    + `      readonly data: ConnectionPreidentityClosedData;\n`
    + `    };\n\n`
    + `interface OperationalEventBase {\n`
    + `  readonly schemaVersion: "agp.event/v1";\n`
    + `  readonly sequence: string;\n`
    + `  readonly revision: string;\n`
    + `  readonly nodeId: NodeId;\n`
    + `  readonly instanceId: string;\n`
    + `  readonly occurredAt: string;\n`
    + `  readonly subjectId: string;\n`
    + `}\n\n`
    + `type OperationalEventOf<K extends OperationalEventKind> =\n`
    + `  OperationalEventBase & {\n`
    + `    readonly kind: K;\n`
    + `    readonly data: Readonly<OperationalEventDataByKind[K]>;\n`
    + `  };\n\n`
    + `${concreteEvents}\n\n`
    + `export type OperationalEvent =\n  | ${eventUnion};\n`;
}
