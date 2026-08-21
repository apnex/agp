# AGP uniform node - sovereign contract schemas

> **Status:** Ratified. Current schema-ownership contract.\
> Concrete schema files are the first gated build artifact.

## 1. Mandate

Every named public AGP data-only DTO-wire message or body, configuration, SDK input/result, operational state, event, and management representation-has one authoritative JSON Schema document with its own stable identity.\
A root union or aggregate composes those documents with external `$ref` values; it does not hide named contracts inside `$defs`.

JSON Schema Draft 2020-12 is normative for public object shape.\
TypeScript DTOs, runtime validators, enum/code constants, and reference tables are generated from those same documents.\
Handwritten code may add temporal or contextual semantics but may not redefine schema fields.

---

## 2. Sovereignty rules

| ID | Rule |
|---|---|
| S1 | Each public named DTO has exactly one schema file, one `$id`, one owning package, and one generated TypeScript export. |
| S2 | Cross-file references use absolute, location-independent URNs. |
| S3 | `$defs` is reserved for genuinely private helpers; an exported or independently reasoned-about object cannot live inline. |
| S4 | Aggregate schemas contain references, not duplicated definitions. |
| S5 | Objects are closed with `additionalProperties: false`, or `unevaluatedProperties: false` when composition requires it. |
| S6 | Only explicitly generic JSON payload and extension objects admit arbitrary keys. |
| S7 | Every field has a description; every schema carries mechanics, rationale, consequence, and ownership metadata. |
| S8 | Bounds are declared at the narrowest owning schema and are never contradicted downstream. |
| S9 | JSON Schema does not pretend to prove temporal/contextual invariants; each such rule has an executable semantic-rule or FSM test identifier. |
| S10 | A schema change that changes accepted instances must update the protocol contract. Metadata, examples, and descriptions may update the catalog revision without changing `agp: 1`. |

The custom metadata shape is:
```json
{
  "x-agp": {
    "owner": "@agp/protocol",
    "typescript": "OpenMessage",
    "kind": "wire-message",
    "mechanics": "How this object participates in AGP.",
    "rationale": "Why the object and its boundary exist.",
    "consequence": "What becomes ambiguous or unsafe if violated.",
    "semanticRules": ["OPEN-IDENTITY-1"]
  }
}
```

---

## 3. Identity and catalog

Examples:
```text
urn:agp:schema:v1:protocol:common:node-id
urn:agp:schema:v1:protocol:routing:route-advertisement
urn:agp:schema:v1:protocol:wire:open-message
urn:agp:schema:v1:transport:common:transport-ref
urn:agp:schema:v1:binding-websocket:configuration:listener
urn:agp:schema:v1:transport-loopback:configuration:fabric
urn:agp:schema:v1:core:operations:session-snapshot
urn:agp:schema:v1:management:connections-response
```

Each owning package publishes a package-local catalog at `packages/<package>/src/schemas/v1/catalog.json`, declaring its owner and one entry per schema:
```ts
interface SchemaCatalogEntry {
  id: string;
  owner:
    | "@agp/protocol"
    | "@agp/transport"
    | "@agp/binding-websocket"
    | "@agp/transport-loopback"
    | "@agp/core"
    | "@agp/management-http";
  path: string;
  kind: string;
  typescript?: string;
  sha256: string;
}
```

The root `schemas/agp-v1.schema-catalog.json` composes those package catalogs into one assembly manifest.\
It is deliberately thinner, carrying only the resolved identity, repository-relative path, and content digest of every schema:
```ts
interface RootCatalogEntry {
  id: string;
  path: string;
  sha256: string;
}
```

The root catalog pins content digests and never redefines an object.

---

## 4. Protocol schema catalog

Target location:
```text
packages/protocol/src/schemas/v1/
```

### 4.1 Common and code contracts

| Directory | Sovereign schemas |
|---|---|
| `common/` | `node-id`, `session-id`, `message-id`, `return-token`, `correlation-id`, `endpoint-name`, `wire-revision`, `json-value`, `json-object`, `extensions`, `node-path` |
| `codes/` | `fatal-notification-code`, `delivery-error-code`, `route-rejection-code` |
| `routing/` | `route-key`, `endpoint-source`, `route-advertisement`, `route-rejection` |

`node-path` is a bounded array of unique `node-id` values.\
JSON Schema proves shape, uniqueness, and static length.\
Semantic validation proves that the first element is the origin, the final element is the identity-admitted sender, and classifies presence of the receiver as a recoverable loop rejection.

`session-id` is exactly `^[0-9a-f]{6}$`.\
`return-token` is exactly `^[0-9a-f]{16}$`, the fixed-width lowercase hexadecimal representation of one unsigned 64-bit value, and generates a distinct `ReturnToken` type; it cannot be substituted for `MessageId`.\
Non-reuse within an exact session-controller lifetime is enforced by the named return-token allocator semantic rule rather than falsely claimed by JSON Schema.

### 4.2 Wire contracts

```text
wire/
  envelope.schema.json
  open-body.schema.json
  open-message.schema.json
  keepalive-body.schema.json
  keepalive-message.schema.json
  route-update-body.schema.json
  route-update-message.schema.json
  route-ack-body.schema.json
  route-ack-message.schema.json
  notification-body.schema.json
  notification-message.schema.json
  delivery-error-body.schema.json
  error-message.schema.json
  data-body.schema.json
  data-message.schema.json
  message.schema.json
```

The root `message.schema.json` is only:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:agp:schema:v1:protocol:wire:message",
  "oneOf": [
    { "$ref": "urn:agp:schema:v1:protocol:wire:open-message" },
    { "$ref": "urn:agp:schema:v1:protocol:wire:keepalive-message" },
    { "$ref": "urn:agp:schema:v1:protocol:wire:route-update-message" },
    { "$ref": "urn:agp:schema:v1:protocol:wire:route-ack-message" },
    { "$ref": "urn:agp:schema:v1:protocol:wire:notification-message" },
    { "$ref": "urn:agp:schema:v1:protocol:wire:error-message" },
    { "$ref": "urn:agp:schema:v1:protocol:wire:data-message" }
  ]
}
```

No public message body or route object is inline.

### 4.3 Message object summary

| Type | Plane | Body contract | Purpose |
|---|---|---|---|
| `open` | control | Node identity, pair-scoped session ID, hold/receive bounds, route/path/hop limits, symmetric capabilities | Establish one identity-admitted symmetric adjacency |
| `keepalive` | control | Empty closed object | Refresh protocol liveness |
| `route.update` | control | Revision plus authoritative bounded `RouteAdvertisement[]` | Replace the sender-owned Adj-RIB-In view; omission withdraws |
| `route.ack` | control | `refId`, revision, bounded rejection results; acceptance is the exact outstanding set minus rejections | Close one outbound snapshot transaction |
| `notification` | control | Fatal code and bounded reason | Terminate an invalid session deterministically |
| `error` | control | Correlated nonfatal delivery code, end-to-end `refId`, hop-scoped `returnToken`, failing node, bounded reason | Return a data failure over reverse breadcrumbs |
| `message` | data | Source endpoint/origin, destination, correlation, hop-scoped `returnToken`, hop limit, opaque JSON object payload | Carry one routed application object |

`role`, `endpoint.update`, `endpoint.ack`, and role-mismatch codes are removed from the replacement AGP v1 language.

---

## 5. Transport and binding schema catalogs

Transport capability interfaces contain functions, `Uint8Array`, `AbortSignal`, and private channel authority, so they remain handwritten.\
Every named JSON-compatible record crossing those capabilities is schema-generated.

### 5.1 Neutral transport contracts

Target location:
```text
packages/transport/src/schemas/v1/
  common/
    transport-ref.schema.json
    secret-identity.schema.json
  codes/
    channel-security-keying.schema.json
    transport-terminal-origin.schema.json
    transport-terminal-kind.schema.json
    transport-listener-terminal-kind.schema.json
    transport-input-rejection-code.schema.json
    transport-operation-error-code.schema.json
    transport-operation-phase.schema.json
  contracts/
    channel-security-profile.schema.json
    transport-channel-limits.schema.json
    transport-listener-limits.schema.json
    transport-listen-options.schema.json
    transport-acquisition-options.schema.json
    transport-input-rejected.schema.json
    transport-peer-evidence.schema.json
    transport-diagnostic.schema.json
    transport-terminal.schema.json
    transport-listener-terminal.schema.json
    transport-close-intent.schema.json
    transport-abort-intent.schema.json
    transport-listener-publication.schema.json
  catalog.json
```

`transport-ref` is the one-to-64 character logical identifier defined in the neutral contract and used by core configuration.\
It never embeds a carrier scheme or address.\
`transport-peer-evidence` is a closed record containing locality, protection, and an unauthenticated/verified authentication union; the verified variant contains bounded principal and method fields.\
It records what the adapter observed and never accepts credentials, raw certificates, stacks, or native objects.

`transport-terminal` and `transport-listener-terminal` have exact discriminated origin/kind unions and reference one bounded optional `transport-diagnostic`; their schemas reject impossible combinations such as remote abort or graceful carrier failure.\
The handwritten `TransportDiagnosticSinkPort` accepts exactly the generated `TransportDiagnostic` record plus an optional, separate process-local raw cause.\
The cause is not a schema member and cannot cross the common transport boundary as data.\
Adapter factories may accept this observation capability; channels, listeners, and the AGP kernel never gain access to adapter-private diagnostic authority through their data records.\
The kernel maps a channel terminal to existing semantic FSM events and an unexpected listener terminal to node lifecycle failure, but never branches on a carrier-native detail.\
Capability semantics that schemas cannot express-FIFO delivery, send acceptance, one terminal race winner, bounded backpressure, and cancellation-are named rules owned by [`transport-contract.md`](transport-contract.md) and the adapter conformance kit.

### 5.2 WebSocket binding contracts

Target location:
```text
packages/binding-websocket/src/schemas/v1/
  common/
    subprotocol-token.schema.json
  configuration/
    transport.schema.json
    listener.schema.json
    target.schema.json
    security.schema.json
    compression.schema.json
    liveness.schema.json
  codes/
    binding-rejection-code.schema.json
  contracts/
    close-mapping.schema.json
  catalog.json
```

These contracts own host, port, path, `ws:`/`wss:` locators, TLS posture, compression, native WebSocket rejection classes, and RFC 6455 close mappings.\
They may reference neutral transport schemas but core schemas never reference them.\
The `agp.v1` subprotocol constant and binding mapping table are generated or checked from this owner.\
That table maps one neutral packet to one complete binary message; text input is rejected at the binding while arbitrary binary bytes reach the protocol codec, which alone owns UTF-8 and JSON validity.

### 5.3 Loopback production contracts

Target location:
```text
packages/transport-loopback/src/schemas/v1/
  common/
    fabric-id.schema.json
    loopback-address.schema.json
    transport-name.schema.json
    fabric-revision.schema.json
    counter-value.schema.json
  codes/
    fabric-failure-code.schema.json
    monotonic-domain.schema.json
    counter-key.schema.json
  configuration/
    limits.schema.json
    fabric.schema.json
    transport.schema.json
    listener.schema.json
    target.schema.json
  operations/
    fabric-snapshot.schema.json
    fabric-failure-snapshot.schema.json
    listener-snapshot.schema.json
    channel-snapshot.schema.json
    resources-snapshot.schema.json
    counters-snapshot.schema.json
  catalog.json
```

Loopback configuration and state are public production surfaces rather than test fixtures.\
They expose bounded address/capacity/lifecycle data and a closed decimal-string counter catalog, never private queues, packet contents, node objects, or reusable channel authority.\
Aggregate snapshots externally reference the named listener, channel, resource, and counter schemas rather than defining them inline.\
The fabric snapshot also references its closed failure record, and the `LOOPBACK-ADAPTER-INVARIANT-FAILURE-1` semantic rule proves that an internal adapter invariant failure freezes the distinct `{ code: "ADAPTER_FAULT" }` record.\
It cannot masquerade as monotonic exhaustion.\
`LOOPBACK-MONOTONIC-EXHAUSTION-1` separately proves exact range, preflight, and failure-before-wrap for revision, counters, and private arbitration, including the exhausted domain in its `MONOTONIC_DOMAIN_EXHAUSTED` record.\
The embedding application creates an explicit fabric and constructs a resolver whose node `transportRef` values yield capabilities already bound to the fabric's listener/target records.

---

## 6. Configuration and state schema catalog

Target location:
```text
packages/core/src/schemas/v1/
```

### 6.1 Configuration

```text
configuration/
  node-config.schema.json
  listener-config.schema.json
  peer-config.schema.json
  reconnect-policy.schema.json
  route-rejection-retry.schema.json
  transit-config.schema.json
  identity-admission-policy.schema.json
  route-admission-policy.schema.json
  timers.schema.json
  limits.schema.json
  capacity.schema.json
```

There is one `node-config`; `router-config` and `spoke-config` cease to exist.\
`listener-config` contains one neutral `transportRef`; `peer-config` contains `adjacencyId`, `expectedNodeId`, `transportRef`, and reconnect policy.\
Both reference `urn:agp:schema:v1:transport:common:transport-ref`.\
Concrete transport configuration and desired security are supplied to the injected transport and cannot appear as generic JSON escape hatches in core.\
Within one `node-config`, every `peers[].adjacencyId` is unique by exact string equality.\
A duplicate fails `createNode()` synchronously with `CONFIG_INVALID`, before reference resolution, transport invocation, or partial node construction.\
This contextual invariant is `PEER-ADJACENCY-UNIQUENESS-1`; JSON Schema still owns each individual peer shape, while the named rule owns uniqueness across the array.\
`route-rejection-retry` owns optional `initialMs` and `maxMs`; effective defaults are `1000` and `30000`, both are positive safe integers, and the semantic rule enforces `maxMs >= initialMs`.

`capacity` additionally owns the optional positive safe integers `transportReceivePackets` and `transportReceiveBytes`.\
The effective neutral channel limits supplied to every resolved listener and target capability are derived only from validated core configuration:
```text
maxPacketBytes      = limits.receiveLimitBytes
maxBufferedPackets  = capacity.transportReceivePackets ?? 64
maxBufferedBytes    = capacity.transportReceiveBytes
                      ?? max(limits.receiveLimitBytes, 4_194_304)
```

An explicit `transportReceiveBytes < limits.receiveLimitBytes` is `CONFIG_INVALID`.\
A listener adds the existing effective `maxPendingHandshakes` and `maxSessions` acquisition bounds.\
An adapter may enforce tighter private native watermarks internally, but it cannot infer, increase, or replace these public channel limits from carrier defaults.

### 6.2 SDK data records

```text
sdk/
  agp-error-data.schema.json
  diagnostic-record.schema.json
  started-node.schema.json
  stop-report.schema.json
  endpoint-binding-info.schema.json
  endpoint-delivery-context.schema.json
  send-receipt.schema.json
  identity-admission-request.schema.json
  identity-admission-result.schema.json
  route-admission-request.schema.json
  route-admission-decision.schema.json
  route-admission-result.schema.json
  stop-policy.schema.json
  send-policy.schema.json
  event-subscription-policy.schema.json
```

Functions, handlers, subscriptions, transports, and `AbortSignal` remain language capabilities rather than pretending to be JSON data.\
Every named data record crossing those capability boundaries is sovereign.

`agp-error-data` is the closed serializable projection of a process-local `AgpError`.\
It references the generated `sdk-error-code` and `sdk-operation` scalars and uses a closed `oneOf` to permit only the operation/code pairs in the SDK failure matrix.\
Its optional `details` member is absent unless that exact code branch defines one bounded, closed JSON shape; there is no generic details dictionary.\
The process-local `Error`, raw cause, and stack are not members of this schema.

`diagnostic-record` is the only data record accepted by the public `DiagnosticSinkPort`.\
It is owned by `urn:agp:schema:v1:core:sdk:diagnostic-record`, generates `DiagnosticRecord`, and contains exactly:

- `schemaVersion: "agp.diagnostic/v1"`;
- the emitting `nodeId` and ephemeral `instanceId`;
- `occurredAt` and the current `operationsRevision`;
- one generated `diagnostic-domain`;
- one generated `diagnostic-severity`;
- one bounded generated `diagnostic-code`; and
- an optional bounded, sanitized canonical `message`.

The closed diagnostic domains are `lifecycle`, `protocol`, `transport`, `session`, `routing`, `admission`, `handler`, `operations`, and `sdk`.\
Severity is exactly `warning | error | critical`.\
Diagnostic codes match `^[A-Z][A-Z0-9_]{0,63}$`; messages contain at most 256 Unicode code points, contain no C0/DEL control, and are never copied from a raw exception or unbounded peer value.\
The complete canonical JSON encoding is bounded by the owning schema.\
There is no generic context/details object.

An optional raw `cause` supplied alongside this record is a process-local capability argument, not a member of `DiagnosticRecord`.\
It is never serialized into protocol, canonical operations, events, management, CLI, or another schema-backed object.

`identity-admission-request` references the neutral `transport-peer-evidence` schema.\
It receives evidence from the acquired channel, not from `NodeConfig`.

### 6.3 Operational leaves

```text
common/
  instance-id.schema.json
  route-id.schema.json
  binding-id.schema.json
  adjacency-id.schema.json
  direction.schema.json
  timestamp.schema.json
  duration-ms.schema.json
  operations-revision.schema.json
  event-sequence.schema.json
  counter-value.schema.json
codes/
  host-state.schema.json
  host-failure-code.schema.json
  monotonic-domain.schema.json
  counter-key.schema.json
  connection-state.schema.json
  sdk-error-code.schema.json
  sdk-operation.schema.json
  diagnostic-domain.schema.json
  diagnostic-severity.schema.json
  diagnostic-code.schema.json
  identity-denial-code.schema.json
  selected-reason.schema.json
  ineligible-reason.schema.json
  candidate-selection-reason.schema.json
  route-reason-code.schema.json
  session-event-code.schema.json
  session-reason-code.schema.json
  resource-code.schema.json
operations/
  snapshot-meta.schema.json
  configuration-snapshot.schema.json
  lifecycle-snapshot.schema.json
  host-failure-snapshot.schema.json
  listener-snapshot.schema.json
  adjacency-snapshot.schema.json
  session-transition-snapshot.schema.json
  negotiated-capabilities-snapshot.schema.json
  timer-snapshot.schema.json
  return-token-allocator-snapshot.schema.json
  bounded-queue-snapshot.schema.json
  session-queues-snapshot.schema.json
  route-import-state.schema.json
  route-export-state.schema.json
  export-snapshot.schema.json
  pre-identity-controller-snapshot.schema.json
  session-snapshot.schema.json
  connection-snapshot.schema.json
  local-endpoint-snapshot.schema.json
  advertisement-snapshot.schema.json
  candidate-route-snapshot.schema.json
  selected-route-snapshot.schema.json
  next-hop.schema.json
  forwarding-entry-snapshot.schema.json
  adj-rib-out-route-snapshot.schema.json
  reverse-correlation-snapshot.schema.json
  resource-gauge.schema.json
  resources-snapshot.schema.json
  counters-snapshot.schema.json
  adjacency-list-snapshot.schema.json
  local-endpoint-list-snapshot.schema.json
  connection-list-snapshot.schema.json
  advertisement-list-snapshot.schema.json
  route-table-snapshot.schema.json
  forwarding-list-snapshot.schema.json
  adj-rib-out-list-snapshot.schema.json
  reverse-correlation-list-snapshot.schema.json
  operations-snapshot.schema.json
```

### 6.4 Required state semantics

| Object | Reasoning boundary |
|---|---|
| `LifecycleSnapshot` | One host state, transition times, and a closed failure record required exactly for `Failed` |
| `ListenerSnapshot` | Logical transport reference, acquisition/lifecycle state, sanitized publication, and referenced neutral listener terminal when present |
| `AdjacencySnapshot` | Desired/configured relationship, logical transport reference, and reconnect supervision, distinct from a particular session |
| `PreIdentityControllerSnapshot` | One retained controller before remote identity authority, keyed only by its temporarily node-wide local session ID and exposing no remote node or routing authority |
| `SessionSnapshot` | One identity-admitted, pair-scoped controller, its current or last neutral channel/FSM lifecycle, independent import/export, timers, queues, optional bounded last terminal, and return-token allocator state |
| `ConnectionSnapshot` | Closed `identityState: pending | admitted` union of the two records above for the public connections view |
| `AdvertisementSnapshot` | Exact Adj-RIB-In route owned by one local session |
| `CandidateRouteSnapshot` | One local or learned choice, including eligibility and selection result |
| `SelectedRouteSnapshot` | The single chosen path for an endpoint, including origin and complete path through the local node |
| `ForwardingEntrySnapshot` | Resolved immediate local binding or peer session derived from one selected route |
| `AdjRibOutRouteSnapshot` | One selected route desired/advertised to one peer and its acknowledgement state |
| `ReverseCorrelationSnapshot` | Bounded breadcrumb that can return an error without another route lookup |
| `OperationsSnapshot` | One reference-only aggregate of all state at a single node revision |

Hub/spoke-specific endpoint-state unions are replaced by symmetric per-session `routeImport` and `routeExport` objects.

`ListenerSnapshot` may reference the one sanitized `TransportListenerPublication` returned by its acquired listener.\
An `AdjacencySnapshot` exposes only its logical `transportRef`; target resolution returns no publication.\
Kernel behavior cannot parse either value, and configuration snapshots never include adapter credentials.

`direction` is the schema-generated closed domain `inbound | outbound`.\
It is derived by the node from its internal acquisition record using exactly `accept -> inbound` and `dial -> outbound`.\
The internal `Acquisition { kind: accept | dial, ... }` remains the sole retry-authority input; neither operations consumers nor adapters may feed `direction` back into the FSM.

`PreIdentityControllerSnapshot` requires `identityState: "pending"`, `localSessionId`, `direction`, connection state, last transition, applicable timers/queues, and optional neutral `lastTransportTerminal`.\
The outbound variant also requires its configured `adjacencyId`; the inbound variant forbids it.\
It cannot contain `remoteNodeId`, `remoteSessionId`, negotiated capabilities, route import/export state, or a return-token allocator.\
A claimed OPEN node ID and configured `expectedNodeId` are deliberately not copied into this record.\
While this record exists, `localSessionId` is reserved node-wide.

`SessionSnapshot` requires `identityState: "admitted"`, authoritative `remoteNodeId`, local `sessionId`, `direction`, and the ordinary negotiated, timer, queue, import/export, and allocator state.\
The identity-admission commit atomically replaces the pending record with this pair-scoped record; readers cannot observe both.

A configured dial controller may remain in `Active` for retry and retain one immutable neutral `lastTransportTerminal`; that field is evidence about the last channel, not retained channel authority, and is cleared or replaced by the next attempt.\
Every ended attempt emits exactly one of two mutually exclusive events:

- before remote identity authority, `connection.preidentity-closed` is keyed by
  the temporarily node-wide `localSessionId` and contains no remote identity;
- after remote identity authority, `session.closed` is subject to its exact
  `(remoteNodeId, sessionId)`.

A terminal accepted controller, or a dial controller with no armed retry, is removed in that same canonical transaction.\
A retained admitted dial projection remains pair-scoped until retry begins; allocating the next attempt atomically clears remote authority and replaces it with a fresh pre-identity projection.\
Thus terminal retention is bounded by the existing controller and adjacency/session capacity limits; there is no controller/session-history table.

`RouteExportState` exposes its complete `routeDecisions` rather than a node-wide advertised flag.\
`AdjRibOutRouteSnapshot` uses the closed state/field combinations in `routing.md` section 3.6.\
In particular, a peer-rejected `POLICY` or `CAPACITY` row owns `remoteRejectionCode`, zero-based `remoteRetryAttempt`, and `remoteRetryAt`; local suppression and non-retryable remote rejection cannot carry those retry fields.

`ReverseCorrelationSnapshot` exposes the end-to-end `messageId`, `outboundReturnToken`, source/destination, ingress discriminator, and exact public pair identities: session ingress has `nodeId`, `owningSessionId`, and `upstreamReturnToken`; egress has `egressNodeId` and `egressSessionId`.\
Private controller handles never cross the operations boundary.

`operations-revision`, `event-sequence`, and `counter-value` are separate sovereign decimal-string schemas.\
Each statically enforces canonical nonnegative form and at most 20 digits; the named `CORE-MONOTONIC-EXHAUSTION-1` semantic rule enforces the exact unsigned 64-bit maximum, exact-arithmetic preflight, the reserved final revision, and terminal failure before wrap.\
`host-failure-snapshot` is a closed discriminated record.\
Its monotonic-exhaustion variant references `monotonic-domain`, and permits a closed counter key only when that domain is `counter`.

`LifecycleSnapshot.failure` is required if and only if its `hostState` is `Failed`; it is absent in every other host state.\
This conditional shape is enforced by the lifecycle schema, while legal temporal transitions remain the `NODE-ONE-SHOT-LIFECYCLE-1` semantic rule.

---

## 7. Event schemas

Each event data DTO and each concrete discriminated event has its own schema.\
The root `operational-event.schema.json` contains only external references.

The exact initial inventory is:
```text
events/
  operational-event.schema.json
  lifecycle-starting.schema.json
  lifecycle-running.schema.json
  lifecycle-stopped.schema.json
  endpoint-exposed.schema.json
  endpoint-closed.schema.json
  session-established.schema.json
  session-transition.schema.json
  session-routes-purged.schema.json
  session-closed.schema.json
  connection-preidentity-closed.schema.json
  route-imported.schema.json
  route-export-acked.schema.json
  message-accepted.schema.json
  message-forwarded.schema.json
  message-received.schema.json
  message-failed.schema.json
  handler-completed.schema.json
  handler-failed.schema.json
  observer-gap.schema.json
events/data/
  lifecycle-starting-data.schema.json
  lifecycle-running-data.schema.json
  lifecycle-stopped-data.schema.json
  endpoint-exposed-data.schema.json
  endpoint-closed-data.schema.json
  session-established-data.schema.json
  session-transition-data.schema.json
  session-routes-purged-data.schema.json
  session-closed-data.schema.json
  connection-preidentity-closed-data.schema.json
  route-imported-data.schema.json
  route-export-acked-data.schema.json
  message-accepted-data.schema.json
  message-forwarded-data.schema.json
  message-received-data.schema.json
  message-failed-data.schema.json
  handler-completed-data.schema.json
  handler-failed-data.schema.json
  observer-gap-data.schema.json
```

Each concrete event has one fixed `kind` discriminator and references its same-stem data schema.\
`operational-event.schema.json` is an external-reference union of exactly those concrete events; adding an event requires a new pair, catalog entries, discriminator, generated union member, and fixtures.\
Kinds that currently carry no event-specific detail own a closed empty-object data schema rather than an invented placeholder field.\
`message.failed` may carry its typed delivery error `code`.\
`session.closed` carries authoritative `remoteNodeId`, local `sessionId`, the closed session reason, and, when a transport terminal exists, the exact neutral `transport-terminal` record.\
`connection.preidentity-closed` instead carries `localSessionId`, derived `direction`, the closed session reason, and the same optional neutral terminal; its `subjectId` is that local ID and the data schema forbids remote, expected, or claimed node identity.\
Neither event copies native diagnostics.\
`observer.gap` requires its exact `droppedFrom` and `droppedTo` sequence bounds.

No `lifecycle.failed` event is invented.\
A terminal failure is authoritative in `LifecycleSnapshot.failure`; monotonic exhaustion specifically cannot depend on allocating another event sequence.\
Existing subscriptions complete after that terminal commit and consumers query the final snapshot.

The survey did not require a dedicated route-miss counter or event.\
Route misses use the generic typed `message-failed` surface; acceptance is proven primarily by the caller rejection or correlated wire error.

---

## 8. Management schemas

Target location:
```text
packages/management-http/src/schemas/v1/
  common/
    response-meta.schema.json
    error-response.schema.json
  responses/
    health-response.schema.json
    operations-response.schema.json
    configuration-response.schema.json
    local-endpoints-response.schema.json
    connections-response.schema.json
    advertisements-response.schema.json
    routes-response.schema.json
    forwarding-response.schema.json
    resources-response.schema.json
    counters-response.schema.json
```

Management responses reference exact core schemas by URN.\
A generic `entity: object` escape hatch is forbidden.\
Resource paths and `agpctl` commands remain stable; obsolete role fields and route columns are revised only where the old meaning is false.

---

## 9. Derivation pipeline

```text
package-owned JSON Schemas
        │
        ├── generated TypeScript DTOs and code enums
        ├── compiled runtime validator registry
        ├── generated reference tables
        └── package schema catalog
                         │
                         └── root AGP v1 catalog + digests
```

Generated files carry a `DO NOT EDIT` header.\
The build regenerates into a temporary tree and proves byte equality with committed output.\
Handwritten runtime types may compose generated DTOs with behavior-bearing ports, but may not repeat fields or literal unions.

---

## 10. Conformance

Each schema owns:

- a minimal valid fixture;
- a maximal/boundary valid fixture;
- orthogonal invalid fixtures for every applicable accepted-instance boundary
  (for example required fields only on objects, discriminators only on
  discriminated variants, numeric/string/array bounds only where present,
  unknown properties only on objects, and nested-reference failure only where
  a reference exists);
- expected JSON Pointer and failed keyword for every invalid fixture.

A scalar schema is never failed for lacking an inapplicable object discriminator, so applicability is judged per keyword rather than per schema.

Coverage is currently proved by one `schema-catalog.test.js` per owning package, which audits identity, path, digest, reference resolution, and generated-type correspondence across that package's whole catalog.\
A separate machine-readable coverage manifest recording the exact fixture that proves each keyword boundary remains a deferred refinement; it is not required by any gate today.

Required catalog checks:

1. every JSON document is valid Draft 2020-12;
2. every `$id` is unique;
3. every `$ref` resolves through the catalog;
4. dependency direction is acyclic except the private recursive JSON-value
   helper;
5. every catalog path exists and matches its digest;
6. every public TypeScript DTO maps one-to-one to a catalog entry;
7. aggregate schemas contain no copied named definitions;
8. encode/decode round trips validate against the same compiled schemas;
9. live SDK snapshots and every HTTP response validate during system tests.

Contextual rules that JSON Schema cannot express-revision sequencing, path endpoint identity, receiver-loop rejection, configured adjacency-ID uniqueness, live adjacency collision, and RIB atomicity-belong to named executable semantic rules and conformance traces, never prose alone.

Each owning package publishes `src/semantic-rules/v1/semantic-rules.catalog.json`.\
The root `schemas/agp-v1.semantic-rules.json` composes those catalogs.\
Every entry contains:
```ts
interface SemanticRuleCatalogEntry {
  id: string;
  owningGate:
    | "AX1"
    | "AX2"
    | "AX3"
    | "AX4"
    | "AX5"
    | "AX6"
    | "AX7"
    | "AX8";
  owner:
    | "@agp/protocol"
    | "@agp/transport"
    | "@agp/binding-websocket"
    | "@agp/transport-loopback"
    | "@agp/core"
    | "@agp/node";
  phase:
    | "decode"
    | "transport"
    | "binding"
    | "session"
    | "routing"
    | "data-admission"
    | "operations";
  inputSchemaIds: readonly string[];
  resultCodes: readonly string[];
  designReferences: readonly string[];
  implementation: string;
  owningTest: string;
}
```

Rule IDs are stable, unique, and referenced from schema `x-agp.semanticRules`, the requirement trace graph, and exactly one primary orthogonal test.\
The catalog proves that every referenced rule exists, its `owningGate` equals the trace record that owns it, and every implementation/test path is owned by the declared package.\
AX0 validates the complete registry; each executable gate runs only the entries it owns.\
A schema may therefore point to a later temporal/operations rule without falsely making that rule an AX2 contextual decode check.

---

## 11. Mechanics, rationale, and consequence

### Mechanics

Schemas live with their semantic owners, use stable URNs, compose externally, generate language DTOs and validators, and are proven through one catalog and fixture corpus.\
Neutral transport, WebSocket binding, and Loopback production records have independent catalogs; the core catalog references only the neutral transport contracts.

### Rationale

The previous single message and operations schemas made independently named objects discoverable only by reading large inline `$defs` blocks.\
Sovereign files give reviewers, generators, tests, and future language SDKs one exact object boundary without copying or reconstructing it.

### Consequence of violation

- Inline named DTOs hide ownership and make local reasoning expensive.
- Handwritten duplicate types allow schema/code drift.
- Relative or file-location IDs make packaging change semantic identity.
- Generic management objects permit adapters to invent representations.
- Pretending schemas prove temporal rules leaves protocol-critical gaps
  unaudited.
- Keeping carrier configuration or native errors in core schemas makes package
  separation cosmetic.
- Treating Loopback configuration or state as test fixtures leaves a canonical
  production transport without a public contract.
