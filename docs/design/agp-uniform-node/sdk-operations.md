# AGP uniform node - SDK and canonical operations design

> **Status:** Ratified. Current public API and operational-state contract.\
> Gate definitions are in [`verification.md`](verification.md).

## 1. Mandate

`createNode()` is the sole runtime factory and `AgpNode` is the sole application-facing runtime abstraction.\
The same API creates a node that only dials, only listens, does both, exposes local endpoints, forwards in transit, or remains application-local.\
Those differences come from `NodeConfig`; they are not roles and do not select different kernel implementations.\
`NodeConfig` contains logical `transportRef` values; the embedding application separately injects the adapter-owned capabilities that resolve them.\
Concrete carrier configuration never enters the kernel.

The node owns one canonical operational state store.\
SDK queries read immutable snapshots from that store.\
Management HTTP projects those snapshots, and `agpctl` renders the HTTP documents.\
Neither adapter inspects private runtime objects or independently reconstructs a route, connection, timer, counter, or lifecycle state.

This document defines:

1. the `createNode()` API and lifecycle;
2. endpoint exposure and routed `send()` semantics;
3. the uniform operational entity model and revision contract;
4. SDK queries and event subscriptions;
5. management HTTP and read-only `agpctl` projections;
6. restart and state-lifetime boundaries;
7. transport composition and visibility boundaries; and
8. the coordinated AGP v1 SDK and operations migration.

---

## 2. Contract ownership

### 2.1 Schema-backed DTOs

Every data-only public object has exactly one sovereign JSON Schema and one generated TypeScript export.\
The SDK does not create a second handwritten representation.

| DTO family | Sovereign owner | Schema identity |
|---|---|---|
| Node, endpoint, session, message, correlation, and hop-return identifiers | `@agp/protocol` | `urn:agp:schema:v1:protocol:common:*` |
| JSON application payload | `@agp/protocol` | `urn:agp:schema:v1:protocol:common:json-object` |
| Logical transport reference, limits, peer evidence, terminal, close/abort intents, and listener publication | `@agp/transport` | `urn:agp:schema:v1:transport:*` |
| WebSocket subprotocol, transport/listener/target, receive, security, compression, liveness, rejection, and close-mapping records | `@agp/binding-websocket` | `urn:agp:schema:v1:binding-websocket:*` |
| Loopback limits, fabric/transport/listener/target configuration, and operational state | `@agp/transport-loopback` | `urn:agp:schema:v1:transport-loopback:*` |
| `NodeConfig` and its nested configuration records | `@agp/core` | `urn:agp:schema:v1:core:configuration:*` |
| SDK error, diagnostic, lifecycle, binding, delivery-context, and send-result records | `@agp/core` | `urn:agp:schema:v1:core:sdk:*` |
| Operational entities and exact query result wrappers | `@agp/core` | `urn:agp:schema:v1:core:operations:*` |
| Operational events and their data records | `@agp/core` | `urn:agp:schema:v1:core:events:*` |
| HTTP response envelopes and errors | `@agp/management-http` | `urn:agp:schema:v1:management:*` |

The core catalog therefore includes these SDK result schemas:
```text
packages/core/src/schemas/v1/sdk/
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

Exact query wrappers such as `ConnectionListSnapshot`, `LocalEndpointListSnapshot`, and `RouteTableSnapshot` also have individual schemas under `core/operations/`; a generic unchecked `object[]` response is not permitted.

### 2.2 Capability-bearing interfaces

`AgpNode`, endpoint handlers, endpoint bindings, event subscriptions, `AbortSignal`, clocks, transports, admission ports, and diagnostic sinks are process-local capabilities rather than JSON DTOs.\
They are handwritten TypeScript interfaces, but every data record entering or leaving them is schema-backed.\
This includes every neutral transport limit, peer-evidence, terminal, intent, and listener-publication record.\
A capability interface may compose a schema-generated record with methods; it may not repeat or alter the record's fields.

Invocation options follow the same split.\
`SendPolicy`, `StopPolicy`, and `EventSubscriptionPolicy` are schema-backed data.\
`SendOptions`, `StopOptions`, and `EventSubscriptionOptions` compose the corresponding generated policy with an optional process-local `AbortSignal`.\
`StartOptions` carries only cancellation authority and is not a data DTO.

This distinction prevents a JSON Schema from pretending to describe functions, cancellation handles, sockets, or injected authority while retaining sovereign ownership for all observable data.

---

## 3. Public node API

### 3.1 Factory and composition

The public surface of `@agp/node` is:
```ts
export function createNode(
  config: NodeConfig,
  dependencies?: NodeDependencies,
): AgpNode;

export interface AgpNode {
  readonly nodeId: NodeId;
  readonly operations: OperationsReader;

  start(options?: StartOptions): Promise<StartedNode>;
  stop(options?: StopOptions): Promise<StopReport>;

  expose(
    endpoint: EndpointName,
    handler: EndpointHandler,
  ): Promise<EndpointBinding>;

  send(
    source: EndpointName,
    destination: EndpointName,
    payload: JsonObject,
    options?: SendOptions,
  ): Promise<SendReceipt>;
}
```

`NodeDependencies` contains only injected capabilities: clock, randomness, identifier source, diagnostic sink, neutral peer transport bindings, identity admission, and route admission.\
There are no hub or spoke transports, dependencies, factories, or role literals.\
The relevant excerpt is:
```ts
interface NodeDependencies {
  readonly transport?: PeerTransportPort;
  readonly diagnostics?: DiagnosticSinkPort;
  // clock, randomness, identifiers, and admission ports omitted
}

interface DiagnosticSinkPort {
  emit(record: DiagnosticRecord, cause?: unknown): void;
}

interface PeerTransportPort {
  resolveListener(
    reference: TransportRef,
  ): TransportListenCapability | undefined;
  resolveTarget(
    reference: TransportRef,
  ): TransportConnectCapability | undefined;
}
```

Each resolver returns an opaque process-local capability already bound to its adapter and concrete acquisition authority.\
The generalized `PeerTransportPort` can resolve listeners, targets, or both.\
The node imports these types only from `@agp/transport`; it never imports a concrete adapter or observes a carrier kind.

`DiagnosticRecord` is the closed schema-generated core SDK record defined in [`contracts.md`](contracts.md#62-sdk-data-records).\
The node constructs it; a sink cannot supply or extend its fields.\
For each diagnostic fact the node captures the immutable record inside the owning canonical executor turn, then invokes `emit` after releasing that executor gate and in commit order.\
`operationsRevision` is the revision current at that capture point.\
The optional `cause` is separate process-local material and is never inspected for protocol behavior, copied into `message`, retained by the node after `emit` returns, or serialized.

Diagnostic emission begins only after `createNode()` has committed a valid node instance and initial operations revision.\
A factory rejection has no authoritative `instanceId` or operations revision, so it is represented only by its typed `AgpError`; the node MUST NOT invent a partial `DiagnosticRecord` for that failure.

The dependency is optional and absence is an exact no-op.\
A sink is best-effort supplementary observation: every lifecycle, FSM, routing, or SDK outcome remains authoritative in its typed error, event, and canonical state.\
If `emit` throws, the node catches and suppresses that value after the canonical outcome is committed.\
A sink failure cannot change a promise result, FSM input, route, counter, lifecycle state, or operations revision, and the node MUST NOT recursively emit a diagnostic about the failing sink.

This node-level capability is distinct from `@agp/transport`'s `TransportDiagnosticSinkPort`.\
An adapter may emit its closed `TransportDiagnostic` at its own construction boundary, while the node normalizes only the neutral terminal or operation facts that cross `PeerTransportPort` into a core `DiagnosticRecord` with `domain: "transport"`.\
The node never imports a binding/native error type.\
If a neutral `TransportOperationError` carries an optional process-local `cause`, the node may pass that value through unchanged only as its own sink's second argument; it never inspects or copies it, and no adapter-private cause otherwise crosses the port.\
The two sinks have different owners and observation scope; there is no cross-sink exactly-once claim.\
Canonical state and typed outcomes, not either sink, provide lifecycle evidence.

Composition has two deliberately separate inputs:
```text
core NodeConfig
  listen.transportRef / peers[].transportRef

adapter factory input
  carrier-specific listener/target/security/capacity configuration
  -> validated bound capabilities behind a neutral PeerTransportPort

createNode(coreConfig, { transport: adapterPort })
```

The application may reuse one Loopback fabric across several nodes or construct independent WebSocket adapters for separately deployed nodes.\
That application composition changes acquisition only; it cannot select another FSM, codec, RIB, forwarding path, or operational model.\
Runtime carrier negotiation is not an AGP capability.

The admission capabilities have exact data contracts:
```ts
interface IdentityAdmissionPort {
  evaluate(request: IdentityAdmissionRequest): Promise<IdentityAdmissionResult>;
}

interface RouteAdmissionPort {
  evaluate(request: RouteAdmissionRequest): Promise<RouteAdmissionResult>;
}
```

`IdentityAdmissionRequest` names local node, claimed remote OPEN identity, derived public `direction`, optional configured adjacency, expected remote identity, and the exact bounded `TransportPeerEvidence` captured by the channel before acquisition commit.\
Its direction is derived exactly as `dial -> outbound`, `accept -> inbound`; the internal acquisition record, not this DTO, owns retry behavior.\
`IdentityAdmissionResult` is exactly `{ decision: "allow" }` or `{ decision: "deny"; reasonCode: IdentityDenialCode }`.

`RouteAdmissionRequest` names the local/remote node and exact local session, wire revision, update envelope ID, and canonical prevalidated route list.\
`RouteAdmissionResult` contains exactly one `RouteAdmissionDecision` for every requested route, keyed by complete `(endpoint, originNodeId, path)`, with `decision: "allow" | "deny"`.\
A denial has a bounded diagnostic reason but maps on wire to `POLICY`.\
Missing, duplicate, unknown, or malformed decisions are port faults.\
The default ports deterministically allow valid identities and routes; callback functions themselves remain process-local capabilities.

`NodeConfig.routeRejectionRetry` controls only unchanged peer `POLICY` and `CAPACITY` export rejections.\
Omitted fields resolve to `{ initialMs: 1000, maxMs: 30000 }`; both effective values are positive safe integers and `maxMs >= initialMs`.\
Backoff is deterministic, monotonic-clock driven, and saturating-there is no jitter or hidden retry class.

Every `NodeConfig.peers[].adjacencyId` is unique within the node by exact string equality.\
A duplicate violates `PEER-ADJACENCY-UNIQUENESS-1` and fails `createNode()` synchronously with `CONFIG_INVALID` before any reference is resolved or transport capability is invoked.

The node also derives the exact neutral receive limits supplied to every resolved channel capability:
```text
maxPacketBytes      = limits.receiveLimitBytes
maxBufferedPackets  = capacity.transportReceivePackets ?? 64
maxBufferedBytes    = capacity.transportReceiveBytes
                      ?? max(limits.receiveLimitBytes, 4_194_304)
```

Both capacity fields, when present, are positive safe integers.\
An explicit `transportReceiveBytes` below `receiveLimitBytes` is `CONFIG_INVALID`.\
Listener acquisition additionally uses the existing effective `maxPendingHandshakes` and `maxSessions`.\
No adapter/native default participates in this derivation.\
`ConfigurationSnapshot` exposes the validated source fields and this effective channel-limit triple, so adapters and operators can prove the same bounds without reconstructing defaults.

`createNode()`:

1. validates `NodeConfig` against
   `urn:agp:schema:v1:core:configuration:node-config`;
2. applies contextual configuration rules and derives the immutable effective
   channel limits above;
3. resolves defaults and verifies that every configured listener
   `transportRef` and peer `transportRef` resolves by kind through the injected
   transport port;
4. captures an immutable, redacted effective-configuration snapshot;
5. creates an empty runtime instance and operations revision `0`;
6. performs no network I/O and starts no timer.

Invalid configuration, a missing transport capability, or a missing reference resolution fails synchronously with a typed `CONFIG_INVALID` error.\
Resolved capabilities are captured exactly once; they are not inspected, logged, compared for identity, serialized, or re-resolved during reconnect.\
The adapter factory is responsible for validating concrete adapter configuration before `createNode()`.\
The node never exists in a partially configured state.

### 3.2 Lifecycle

The node instance is one-shot:
```text
Created -> Starting -> Running -> Stopping -> Stopped
               └───────────────-> Failed
```

`Stopped` and `Failed` are terminal for that instance.\
Starting after either state is rejected; restart means creating a new node with the application-owned configuration and endpoint intent.

Lifecycle behavior is:

| Operation | Contract |
|---|---|
| First `start()` | Acquires the configured neutral listener channel source, activates configured adjacency supervisors through neutral connect references, and commits `Running` when the enabled runtime facilities are ready. It does not wait for route convergence. |
| Concurrent `start()` | Joins the one in-progress start attempt. |
| `start()` while `Running` | Returns the immutable original `StartedNode` result. |
| First `stop()` | Makes stop dominant, rejects new sends/exposures, closes local bindings, moves sessions out of `Established`, removes their route state, drains bounded work up to the deadline, then commits `Stopped`. |
| Concurrent or later `stop()` | Joins or returns the immutable original `StopReport`. |
| Start failure | Tears down acquired resources, commits `Failed`, and requires replacement of the node instance. |
| Unexpected listener terminal while `Running` | Atomically commits `Failed`, gates new work, records the neutral listener terminal, and performs bounded teardown; the application must construct a replacement node and adapter capabilities. |
| Monotonic-domain exhaustion | Replaces the mutation that would overflow with the one terminal exhaustion transaction in section 5.2, commits `Failed`, and requires replacement of the node instance. |

After listener acquisition resolves, the node begins `waitTerminal()` observation before it can commit `Running`.\
A listener terminal that wins that interval makes start fail; no state may briefly claim a usable listener.\
The lifecycle wait is canceled only after node-owned stop has claimed listener teardown, so a real listener failure cannot be lost in a cancellation race.

`StartedNode`, owned by `urn:agp:schema:v1:core:sdk:started-node`, reports `nodeId`, `instanceId`, `startedAt`, the operations revision that committed `Running`, and, when present, `{ transportRef, publication? }` for the bound listener.\
`publication` is the adapter-provided neutral `TransportListenerPublication`; its optional `displayAddress` is sanitized operator evidence, not reusable connect authority.\
`StartedNode` does not claim that any peer is established or any remote route is available.

`StopReport`, owned by `urn:agp:schema:v1:core:sdk:stop-report`, reports the final revision, stop time, drained message count, and discarded message count.\
Resolution means the final operational snapshot is available; it is not a durable audit record.

Cancellation can prevent an operation before its commit point.\
Once a start, stop, exposure, or send result has committed, later cancellation cannot roll it back.

Topology examples and tests may compose a wait helper from `operations.events()` plus fresh snapshots.\
That helper remains outside the stable `AgpNode` surface until a demonstrated application consumer requires it; observation convenience does not earn a speculative public contract.

---

## 4. Endpoint and messaging API

### 4.1 Endpoint exposure

`expose()` is permitted in `Created` and `Running`.\
A binding created before start installs its local candidate immediately but cannot be exported until a session is established.\
Exposure during `Starting`, `Stopping`, `Stopped`, or `Failed` is rejected to avoid an ambiguous lifecycle race.

For one endpoint name:

1. at most one active local binding exists;
2. the handler, local candidate, selected route, forwarding entry, and affected
   Adj-RIB-Out state commit in one operations transaction;
3. the returned `EndpointBinding` contains immutable
   `EndpointBindingInfo`, owned by
   `urn:agp:schema:v1:core:sdk:endpoint-binding-info`, plus an idempotent
   `close()` capability;
4. `close()` withdraws the local candidate and recomputes all affected state
   before it resolves;
5. stop closes every remaining binding and aborts in-flight handlers.

An endpoint becoming selected locally does not mean every peer has acknowledged its export.\
Local route state and per-peer export readiness remain separately observable.

### 4.2 Handler delivery

The handler receives the application `JsonObject` plus a process-local context:
```ts
interface EndpointHandlerContext {
  readonly delivery: EndpointDeliveryContext;
  readonly signal: AbortSignal;
}
```

`EndpointDeliveryContext`, owned by `urn:agp:schema:v1:core:sdk:endpoint-delivery-context`, contains:

- message and optional correlation IDs;
- source endpoint and source origin node;
- destination endpoint;
- receive timestamp;
- ingress node and owning session when received from a peer;
- the operations revision used to admit local delivery.

The signal aborts during node shutdown or an applicable bounded handler deadline.\
A handler return is completion evidence only inside the receiving node.\
Handler failure records `message.failed`/`handler.failed` operational evidence but does not create a post-admission wire delivery result; AGP has no end-to-end handler acknowledgement contract.

### 4.3 Routed send

`send()` is accepted only while `Running`.\
Its validation and admission order is:

1. validate endpoint names, payload, correlation ID, timeout, and cancellation;
2. prove that `source` has an active binding and is the selected local route;
3. resolve `destination` through the current selected RIB and forwarding
   projection;
4. fail with `NO_ROUTE` if no usable entry exists;
5. for peer egress, choose the bounded default hop limit and validate the
   encoded packet against that peer's receive bound;
6. require an acknowledged Adj-RIB-Out route for the same
   source identity, or fail `SOURCE_NOT_ADVERTISED`;
7. reserve exact local-handler capacity, or atomically reserve the peer
   breadcrumb and session-queue capacity;
8. for peer egress, allocate the next non-reusing `ReturnToken` from the exact
   controller as the final infallible reservation step;
9. commit message admission, counter, and event state, including the
   reverse-correlation state only for peer egress;
10. enqueue exactly one local delivery or peer write;
11. resolve an immutable `SendReceipt`.

No route miss, source failure, cancellation, timeout, or capacity rejection before step 9 emits a data packet.

`SendOptions.timeoutMs` bounds local admission and write reservation; it is not an end-to-end delivery deadline.\
`AbortSignal` has the same boundary.\
Neither can revoke a message after `SendReceipt` is returned.

AGP v1 does not wait for source-route convergence inside `send()`.\
A caller that receives `SOURCE_NOT_ADVERTISED` can observe per-peer export state and retry; no hidden pending-send queue is created.

`SendReceipt`, owned by `urn:agp:schema:v1:core:sdk:send-receipt`, contains:
```ts
interface SendReceipt {
  readonly messageId: MessageId;
  readonly correlationId?: CorrelationId;
  readonly acceptedAt: Timestamp;
  readonly operationsRevision: OperationsRevision;
  readonly selectedRouteId: RouteId;
  readonly nextHop: NextHop;
}
```

The receipt proves local admission against the named selected route and revision.\
It does not prove downstream receipt or handler completion.\
A correlated failure received after admission appears through the operational event subscription and counters; it cannot retroactively reject an already resolved promise.

### 4.4 Closed SDK failure domain

Every failure crossing a public SDK boundary is an `AgpError` whose generated `SdkErrorCode` is exactly one of the following values.\
The enum is closed: inventing another code, passing through an adapter exception, or using a wire notification/delivery code as an SDK code is a contract violation.

| Code | Exact public meaning |
|---|---|
| `CONFIG_INVALID` | `createNode()` received a schema-invalid configuration or a configuration/dependency combination that cannot provide an enabled capability |
| `OPTIONS_INVALID` | An invocation policy or other data-only options record failed its sovereign schema |
| `LIFECYCLE_INVALID` | The operation is not permitted in the node's current lifecycle state, excluding the send-only `NOT_RUNNING` case |
| `NOT_RUNNING` | `send()` was called while the node was not `Running` |
| `ABORTED` | Caller cancellation won before the operation's documented commit point |
| `ENDPOINT_INVALID` | A source, destination, or exposed endpoint failed the endpoint-name schema |
| `HANDLER_INVALID` | `expose()` received a value that is not an endpoint-handler capability |
| `ENDPOINT_ALREADY_EXPOSED` | `expose()` named an endpoint with an active local binding |
| `ENDPOINT_CAPACITY` | No configured local-binding slot was available |
| `CORRELATION_INVALID` | A supplied correlation identifier failed its sovereign scalar schema |
| `SOURCE_NOT_OWNED` | `send()` named no active, selected local binding as its source |
| `PAYLOAD_NOT_JSON` | The payload was not a finite, acyclic JSON object |
| `MESSAGE_TOO_LARGE` | The locally encoded data envelope exceeded the applicable receive bound |
| `NO_ROUTE` | No usable selected destination route existed at admission |
| `SOURCE_NOT_ADVERTISED` | Peer egress lacked an ACKed export of the exact source identity |
| `NEXT_HOP_UNAVAILABLE` | The selected next hop/controller was unusable, including return-token exhaustion |
| `QUEUE_FULL` | A required bounded handler, subscriber, breadcrumb, or session-queue reservation was unavailable |
| `TRANSPORT_FAILURE` | `start()` could not acquire an enabled listener or other transport facility required to commit `Running` |
| `INTERNAL` | An injected port violated its contract or an AGP invariant failed; bounded public details do not expose the original exception |

`SOURCE_NOT_READY` is not a v1 code.\
Binding, local candidate, selection, and forwarding state commit atomically, so it has no state distinct from `SOURCE_NOT_OWNED`; peer export readiness is `SOURCE_NOT_ADVERTISED`.\
Likewise, legacy wait, role, route-not-found, session-not-established, protocol-violation, and source-rejected codes are not members of this SDK domain.

Emission authority is also closed:

| Public operation | Permitted codes |
|---|---|
| `createNode` | `CONFIG_INVALID`, `INTERNAL` |
| `node.start` | `LIFECYCLE_INVALID`, `ABORTED`, `TRANSPORT_FAILURE`, `INTERNAL` |
| `node.stop` | `OPTIONS_INVALID`, `LIFECYCLE_INVALID`, `ABORTED`, `INTERNAL` |
| `node.expose` | `LIFECYCLE_INVALID`, `ENDPOINT_INVALID`, `HANDLER_INVALID`, `ENDPOINT_ALREADY_EXPOSED`, `ENDPOINT_CAPACITY`, `INTERNAL` |
| `binding.close` | `INTERNAL` only; ordinary repeated or stop-overlapping close is idempotent |
| `node.send` | `OPTIONS_INVALID`, `NOT_RUNNING`, `ABORTED`, `ENDPOINT_INVALID`, `CORRELATION_INVALID`, `SOURCE_NOT_OWNED`, `PAYLOAD_NOT_JSON`, `MESSAGE_TOO_LARGE`, `NO_ROUTE`, `SOURCE_NOT_ADVERTISED`, `NEXT_HOP_UNAVAILABLE`, `QUEUE_FULL`, `INTERNAL` |
| Any `OperationsReader` state query | `INTERNAL` only |
| `operations.events` | `OPTIONS_INVALID`, `ABORTED`, `QUEUE_FULL`, `INTERNAL` |
| Event-subscription iteration or `close` | `INTERNAL` only; closing is idempotent and iteration after close completes normally |

The generated `SdkOperation` scalar contains the exact names shown above.\
"Any `OperationsReader` state query" expands to one `operations.<method-name>` literal for every method in section 5.3, and event subscription iteration/close are `event-subscription.next` and `event-subscription.close`.\
There is no free-form operation string.

Creating an event subscription after the node is terminal returns an already-completed subscription; it does not replay discarded events and is not a lifecycle failure.\
A failure code outside the row for its operation is a conformance failure.

Exhaustion of a peer's non-reusing return-token domain terminates that exact controller before reuse and reports `NEXT_HOP_UNAVAILABLE`; it is not a message-ID collision.\
Error classes are process-local capabilities.\
Their data record-exact generated code, exact generated operation name, stable message, retryable boolean, and bounded code-specific JSON details-is owned by one sovereign core SDK schema.\
Adapter or injected-port errors are normalized once at the owning boundary; raw cause objects and stacks are diagnostic-sink material supplied only as the second process-local `emit` argument and never enter either public record.

---

## 5. Canonical operational state

### 5.1 Uniform entity semantics

Every node exposes the same entity kinds regardless of configured topology.

| Entity | Canonical meaning |
|---|---|
| `LifecycleSnapshot` | This runtime instance's host state, transition timestamps, and closed terminal-failure evidence |
| `ListenerSnapshot` | Configured `transportRef`, acquisition state, sanitized listener publication, and neutral terminal when present, including the no-listener state |
| `AdjacencySnapshot` | One desired configured peer relationship, its `transportRef`, and reconnect supervisor, distinct from any channel or session |
| `PreIdentityControllerSnapshot` | One retained controller before remote identity authority, identified only by a temporarily node-wide local session ID |
| `SessionSnapshot` | One identity-admitted pair-scoped controller and its current or last neutral packet-channel/FSM lifecycle |
| `ConnectionSnapshot` | Closed pending/admitted union returned by the connections reader |
| `LocalEndpointSnapshot` | One active application binding and its local/export readiness |
| `AdvertisementSnapshot` | One accepted Adj-RIB-In route owned by exactly one local peer session |
| `CandidateRouteSnapshot` | One local or learned candidate plus eligibility and selection outcome |
| `SelectedRouteSnapshot` | The one route selected for an endpoint, including origin and complete path through this node |
| `ForwardingEntrySnapshot` | The resolved local binding or immediate peer session for one selected route |
| `AdjRibOutRouteSnapshot` | One desired, outstanding, acknowledged, rejected, or locally suppressed route decision for one peer, with exact local/remote reason and retry projection |
| `ReverseCorrelationSnapshot` | One bounded data-error breadcrumb with end-to-end message ID, hop tokens, public ingress/egress node-session pairs, and expiry |
| `ResourcesSnapshot` | Current, maximum, and high-water bounded resource gauges |
| `CountersSnapshot` | Monotonic values scoped to this runtime instance |

Every admitted `SessionSnapshot`, inbound or outbound, has both `routeImport` and `routeExport` state plus its timers, bounded queues, and `ReturnTokenAllocatorSnapshot`.\
The allocator snapshot exposes only allocation count, exhaustion state, and domain bound-not a reusable token or private controller handle.

The internal controller owns:
```ts
type Acquisition =
  | { readonly kind: "dial"; readonly adjacencyId: AdjacencyId }
  | { readonly kind: "accept"; readonly listenerId: string };
```

Public snapshots instead use the schema-generated `direction: "outbound" | "inbound"`, derived exactly by `dial -> outbound`, `accept -> inbound`.\
`direction` is immutable evidence; it does not determine reconnect ownership or authorize protocol messages, and no operations consumer can write it back into the FSM.

Neither a channel capability, resolved listen/connect capability, carrier kind, native address, native liveness state, nor carrier error object is present in canonical operations.\
A listener may expose the same bounded sanitized `TransportListenerPublication` returned at acquisition; an adjacency exposes only its logical `transportRef`.\
Session behavior and fields are identical for WebSocket and Loopback.\
`remoteRole`, local `role`, and mutually exclusive hub/spoke endpoint-state unions do not exist.

`ConnectionSnapshot` is discriminated by `identityState`:
```ts
type ConnectionSnapshot =
  | PreIdentityControllerSnapshot
  | SessionSnapshot;

interface PreIdentityControllerSnapshot {
  readonly identityState: "pending";
  readonly localSessionId: SessionId;
  readonly direction: Direction;
  readonly adjacencyId?: AdjacencyId; // required outbound; absent inbound
  // current FSM state, transition, applicable timers/queues, optional terminal
}

interface SessionSnapshot {
  readonly identityState: "admitted";
  readonly remoteNodeId: NodeId;
  readonly sessionId: SessionId;
  readonly direction: Direction;
  // admitted/negotiated FSM, route, timer, queue, and allocator state
}
```

The pending variant forbids `remoteNodeId`, `remoteSessionId`, negotiated capabilities, route import/export, and return-token state.\
It also does not project claimed OPEN identity or configured `expectedNodeId`; those values cannot masquerade as admitted peer identity.\
Its `localSessionId` is reserved node-wide while pending.\
Successful admission atomically replaces it with the admitted pair-scoped variant at one operations revision.

`LifecycleSnapshot.failure` is required exactly when host state is `Failed` and references the sovereign closed `HostFailureSnapshot`.\
Its discriminated variants are `START_FAILED`, `LISTENER_TERMINAL`, `MONOTONIC_DOMAIN_EXHAUSTED`, and `INTERNAL_INVARIANT`.\
The monotonic variant names exactly `operations-revision`, `event-sequence`, or `counter`; only the counter variant also carries one key from the closed counter catalog.\
Raw exceptions, stacks, adapter objects, and unbounded text never enter this record.

```ts
type HostFailureSnapshot =
  | { readonly code: "START_FAILED" }
  | {
      readonly code: "LISTENER_TERMINAL";
      readonly terminal: TransportListenerTerminal;
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "operations-revision" | "event-sequence";
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "counter";
      readonly counterKey: CounterKey;
    }
  | { readonly code: "INTERNAL_INVARIANT" };
```

A configured dial controller retained in `Active` for a scheduled retry may expose exactly one bounded neutral `lastTransportTerminal`.\
It is replaced by later attempt evidence and carries no channel authority or native carrier detail.\
Every ended attempt emits exactly one mutually exclusive event:

- before identity authority, `connection.preidentity-closed`, keyed only by its
  temporarily node-wide `localSessionId`, derived direction, reason, and
  optional neutral terminal; it contains no remote identity;
- after identity authority, `session.closed`, keyed by its exact
  `(remoteNodeId, sessionId)`.

A terminal accepted controller, and a dial controller for which no retry remains armed, is also removed in the same canonical transaction.\
A retained admitted dial record remains queryable in `Active` until retry starts; the new attempt then clears remote authority, allocates a fresh node-wide-reserved local ID, and atomically becomes a pending record.\
Controller/session history therefore remains bounded live evidence, not an unbounded state collection.

An established session exposes both wall-clock `establishedAt` evidence and `establishedDurationMs`, materialized from the node's monotonic clock at the query capture instant.\
Each armed `TimerSnapshot` similarly exposes `remainingMs` at that instant.\
These derived durations can change between queries at the same operations revision because reading time is not a state mutation.

`duration-ms` is a nonnegative safe-integer projection.\
Elapsed duration uses exact monotonic arithmetic and clamps only its presentation at `9007199254740991`; it never wraps or changes the operations revision.\
Remaining timer duration is already bounded by its configured safe-integer interval and clamps at zero on expiry.\
These derived presentation values are not revision domains, counters, or ordering authority.

Session identity remains local:

- a local `sessionId` is a six-character lowercase hexadecimal identifier;
- before admission it is exposed only as `localSessionId` and reserved
  node-wide among retained controllers;
- after admission it is unique only among retained live controllers to the
  same remote node;
- public local session ownership is `(remoteNodeId, sessionId)`;
- a remote session is identified by `(remoteNodeId, remoteSessionId)`;
- operational next hops use the local `(remoteNodeId, owningSessionId)` pair.

An `AdvertisementSnapshot` retains final `originNodeId`, ordered path, and owning session.\
It does not invent a globally meaningful origin session.

### 5.2 Snapshot metadata and revisions

Every root query result carries:
```ts
interface SnapshotMeta {
  readonly schemaVersion: "agp.operations/v1";
  readonly nodeId: NodeId;
  readonly instanceId: InstanceId;
  readonly capturedAt: Timestamp;
  readonly revision: OperationsRevision;
}
```

`SnapshotMeta` is owned by `urn:agp:schema:v1:core:operations:snapshot-meta`; `InstanceId` is an ephemeral core identifier with its own common schema.\
`role` is removed and is not replaced with a topology label.\
Listener, peer, and transit capabilities are queryable from configuration and live entities.

Revision rules are:

1. a new node begins at decimal-string revision `"0"`;
2. each ordinary canonical transaction increments the revision exactly once;
3. all state changes, counters, and events caused by that transaction carry the
   committed revision;
4. query calls do not increment the revision;
5. every nested snapshot carrying metadata in an aggregate has the same
   `instanceId`, `capturedAt`, and revision as its root;
6. `capturedAt` is wall-clock evidence, not an ordering key;
7. revisions are comparable only for the same `instanceId`;
8. restart creates a new `instanceId` and resets revision and event sequence;
   and
9. no revision, event sequence, or counter wraps, changes type, loses precision,
   or silently saturates.

`OperationsRevision`, `EventSequence`, and `CounterValue` are distinct sovereign decimal-string types.\
Each has canonical grammar `^(0|[1-9][0-9]{0,19})$` and semantic range `0..18446744073709551615` (unsigned 64-bit).\
Implementations compare and add them with exact integer arithmetic, never JavaScript `Number`.\
The operations revision reserves `18446744073709551615` as a terminal barrier: ordinary transactions may commit only through `18446744073709551614`.

Before applying an ordinary transaction, the executor preflights, without mutation:

1. its one operations-revision increment;
2. the exact number of event-sequence values it would allocate; and
3. every closed-catalog counter delta, including deltas larger than one.

If any result would exceed its domain, or if the ordinary revision would consume the reserved terminal value, the executor discards the proposed mutation and commits exactly one replacement transaction:
```text
gate all new work
-> detach bindings, subscriptions, controllers, and callback authority
-> purge sessions, queues, breadcrumbs, Adj-RIB-In, candidates, selected RIB,
  FIB, and Adj-RIB-Out
-> release all logical capacity reservations
-> set lifecycle to Failed with MONOTONIC_DOMAIN_EXHAUSTED evidence
-> advance the operations revision exactly once
-> publish no counters or operational events
```

The final revision is the exact successor of the prior revision and is `18446744073709551615` when revision capacity itself triggered the barrier.\
Counters retain their last valid values.\
Event subscriptions complete after the commit; consumers query the final lifecycle/snapshot for the authoritative cause.\
Omitting events and counter changes from this exceptional transaction is deliberate because either domain may be the exhausted one.\
Bounded native transport and handler cleanup runs only after logical authority is detached and cannot create another public mutation.\
The terminal snapshot remains queryable and immutable.\
This is `CORE-MONOTONIC-EXHAUSTION-1`.

One transaction covers all consequences of one logical change.\
For example, session loss removes its advertisements, recomputes route selection and forwarding, updates every affected export, increments counters, and publishes events at one revision.\
An observer can never see the session withdrawn while its old route remains selected.

All returned values are deep immutable copies or deeply frozen persistent values.\
They contain no live map, mutable array, timer, queue, socket, handler, or cancellation object.\
A later commit cannot change an earlier snapshot.

Separate query calls may observe different revisions.\
Consumers requiring a cross-table point-in-time view call `snapshot()` once rather than attempting to join several live queries.

### 5.3 Operations reader

The canonical reader is synchronous because it reads bounded in-memory state and performs no transport or adapter I/O:
```ts
interface OperationsReader {
  snapshot(): OperationsSnapshot;
  configuration(): ConfigurationSnapshot;
  lifecycle(): LifecycleSnapshot;
  listener(): ListenerSnapshot;
  adjacencies(): AdjacencyListSnapshot;
  endpoints(): LocalEndpointListSnapshot;
  connections(): ConnectionListSnapshot;
  advertisements(): AdvertisementListSnapshot;
  routes(): RouteTableSnapshot;
  forwarding(): ForwardingListSnapshot;
  routeExports(): AdjRibOutListSnapshot;
  reverseCorrelations(): ReverseCorrelationListSnapshot;
  resources(): ResourcesSnapshot;
  counters(): CountersSnapshot;
  events(options?: EventSubscriptionOptions): EventSubscription;
}
```

Every named return type above resolves to `urn:agp:schema:v1:core:operations:<kebab-case-name>`.\
The exact list wrappers own their item `$ref`; there is no erased generic entity schema.

`snapshot()` contains configuration, lifecycle, listener, adjacencies, local endpoints, connections (pending controllers and admitted sessions), advertisements, candidate routes, selected routes, forwarding, Adj-RIB-Out routes, reverse correlations, resources, and counters from one revision.

Lists are deterministically ordered:

| Query | Primary order |
|---|---|
| Adjacencies | adjacency ID |
| Endpoints | endpoint, then binding ID |
| Connections | admitted before pending; admitted by remote node then session ID; pending by local session ID |
| Advertisements | endpoint, origin node, path, owning session |
| Route candidates | endpoint, local-before-learned, path length, origin node, route ID |
| Selected routes | endpoint |
| Forwarding | endpoint |
| Route exports | the complete route-export key below |
| Reverse correlations | the complete breadcrumb key below |

Ordering uses UTF-8 byte order for strings and never depends on insertion, object-property, connection-arrival, or locale order.

The route-export comparator is lexicographic over:

1. remote node, owning session, endpoint, and origin node;
2. path elements in order, with a shorter path before an otherwise equal path
   having more elements;
3. state rank `desired < outstanding < acked < rejected < suppressed`;
4. wire revision as an unsigned integer, with absent before present;
5. local reason rank
   `absent < TRANSIT_DISABLED < PEER_IN_PATH < PATH_TOO_LONG < CAPACITY`;
6. remote rejection rank
   `absent < LOOP < PATH_TOO_LONG < POLICY < CAPACITY`;
7. retry attempt as an unsigned integer, with absent before present; and
8. retry time as an instant, with absent before present.

The reverse-correlation comparator is lexicographic over:

1. expiry instant, message ID, egress node, and egress session;
2. outbound return token interpreted as its unsigned 64-bit hexadecimal value;
3. source endpoint, source origin node, and destination endpoint;
4. ingress rank `local < session`;
5. for session ingress, ingress node, owning session, and upstream return token
   interpreted as an unsigned 64-bit hexadecimal value; and
6. admitted operations revision as an unsigned integer.

Timestamp comparisons are by represented instant, never wall-clock string locale.\
Numeric revisions, attempts, and tokens are compared numerically, never as decimal strings.\
For each comparator, equality means every observable row field is equal; exact duplicate rows are forbidden by the owning list schema.\
Thus multiple route stages/revisions for one tuple and multiple breadcrumbs for one end-to-end message still have a total, reproducible order.

The reader remains queryable after `Stopped` or `Failed` so an embedding application can inspect the final live-instance snapshot.\
It does not retain historical revisions.

---

## 6. Events and counters

### 6.1 Event policy

Operational events are a bounded live observation stream, not a state log or delivery guarantee.

1. Each event has `schemaVersion: "agp.event/v1"`, a strictly increasing
   instance-local sequence, the canonical operations revision, node and
   instance IDs, occurrence time, kind, subject ID, and sovereign data DTO.
2. Events are materialized only after their state transaction commits.
3. Multiple events from one transaction share the revision and have distinct
   sequences.
4. Subscribers have independent bounded buffers. A slow subscriber cannot
   block the protocol, routing, handler, or operations executor.
5. Overflow produces an `observer.gap` event naming the dropped sequence range
   and increments the existing observer-gap counter.
6. After a gap, the consumer must query a fresh snapshot; replay is not
   available.
7. Closing or aborting a subscription releases its bounded resources
   idempotently.
8. Events and subscriptions are discarded at node stop and are never restored.

Event sequences use the exact finite domain and preflight rule in section 5.2.\
A transaction that lacks enough remaining sequence values is replaced before any of its state, events, gap records, or counters commit.\
The terminal exhaustion transaction closes subscriptions without attempting to allocate a synthetic final event.

The initial event kinds remain those in the sovereign core event catalog, updated from endpoint-update terminology to route-import/export terminology.\
There is no dedicated `route.miss` event kind.\
Local and transit misses use the existing typed `message.failed` event with a delivery error code when one is known, plus the SDK rejection or correlated protocol error that caused it.

### 6.2 Counter policy

Counters are unsigned decimal strings so JSON and all supported SDK languages retain exact values.\
They use the exact finite domain and transaction preflight in section 5.2 and:

- increase only as part of a canonical transaction;
- never decrease within one `instanceId`;
- reset to zero for a new node instance;
- count AGP decisions, not inferred outcomes;
- never substitute for current state.

Counter saturation is forbidden: a delta that would exceed the maximum fails the node through the one terminal exhaustion transaction.\
Retry-attempt fields are not counters or ordering authority; their sovereign safe-integer projections saturate at their schema maximum while the bounded retry delay continues to use its already-saturated maximum.

The existing lifecycle, session, identity, route, message, queue, handler, capacity, transport, observer, notification, protocol-error, and SDK-error families remain.\
Role-specific names are replaced:
```text
endpoint.update.accepted   -> route.update.accepted
endpoint.update.rejected   -> route.update.rejected
endpoint.update.timeout    -> route.update.timeout
```

No counter key contains `hub` or `spoke`.\
No dedicated route-miss counter is added: a local miss is represented by the existing SDK-error/message-rejection families, and a transit or returned miss by the existing `message.failed`/`protocol.error.NO_ROUTE` families.\
This resolves the survey's operator-visibility requirement without promoting an unselected new metric family.

Uptime and timer TTL are not counters.\
They are materialized at one query capture instant from the node's monotonic clock; table rendering formats those materialized durations and does not subtract wall-clock timestamps.

---

## 7. Management HTTP

### 7.1 Projection boundary

The management adapter remains read-only and retains the v1 resource paths:

| Resource | Canonical SDK source | Sovereign response |
|---|---|---|
| `GET /v1/health` | `lifecycle()` | `urn:agp:schema:v1:management:health-response` |
| `GET /v1/snapshot` | `snapshot()` | `urn:agp:schema:v1:management:operations-response` |
| `GET /v1/configuration` | `configuration()` | `urn:agp:schema:v1:management:configuration-response` |
| `GET /v1/endpoints` | `endpoints()` | `urn:agp:schema:v1:management:local-endpoints-response` |
| `GET /v1/connections` | `connections()` | `urn:agp:schema:v1:management:connections-response` |
| `GET /v1/advertisements` | `advertisements()` | `urn:agp:schema:v1:management:advertisements-response` |
| `GET /v1/routes` | `routes()` | `urn:agp:schema:v1:management:routes-response` |
| `GET /v1/forwarding` | `forwarding()` | `urn:agp:schema:v1:management:forwarding-response` |
| `GET /v1/resources` | `resources()` | `urn:agp:schema:v1:management:resources-response` |
| `GET /v1/counters` | `counters()` | `urn:agp:schema:v1:management:counters-response` |

`HEAD` and `OPTIONS` retain their current safe behavior.\
Request bodies, mutation methods, query parameters, and filtering remain unsupported.\
Bounded SDK state keeps each response bounded; exceeding the fixed response limit fails safely rather than truncating a valid schema document.

The management envelope remains `agp.management/v1`.\
Its metadata contains `nodeId`, `instanceId`, `capturedAt`, and revision.\
The obsolete `role` field is removed, not retained as `"node"` and not inferred from listener/peer configuration.

Every response references its exact core entity schemas.\
The adapter may:

- wrap an SDK snapshot in its management envelope;
- omit redacted configuration values according to the core snapshot;
- compute health readiness directly from lifecycle and adapter state.

It may not recompute selected routes, synthesize connection state, inspect queues, derive counters, or replace a typed core entity with a generic object.

Adjacency supervision, per-peer export state, and reverse-correlation state are available in `/v1/snapshot`.\
No new top-level HTTP path is required for the initial cutover; adding one later requires its own sovereign response schema.

### 7.2 Point-in-time behavior

One request performs one SDK query and carries that query's metadata.\
HTTP serialization does not advance the operations revision.\
`Cache-Control: no-store` remains required.\
A client joining data from several resources must compare `instanceId` and revision or use `/v1/snapshot` for a single-revision view.

Every emitted success and error body is validated against its compiled management schema in contract and system tests.

---

## 8. Read-only `agpctl`

The MVP CLI remains a decoupled shell command, HTTP driver, and JQ template.\
It has no direct SDK access and no mutating verb.

The initial commands remain:
```text
agpctl connections.list [--json] [--url URL]
agpctl routes.list      [--json] [--url URL]
```

`--json` emits the validated HTTP response document without table-derived fields.\
Table mode is a deterministic presentation only.

### 8.1 Connections table

```text
SESSION_ID  REMOTE_NODE  DIRECTION  STATE  UPTIME  TTL  LAST_EVENT
```

- `UPTIME` is the snapshot's monotonic `establishedDurationMs` for an
  established session and `-` otherwise. It is formatted as unbounded
  `hours:minutes:seconds`, matching the useful BGP-style duration concept.
- A pre-identity controller renders `localSessionId` in `SESSION_ID`,
  `REMOTE_NODE` as `-`, and its derived public direction. The CLI never renders
  `expectedNodeId` or a claimed OPEN identity as the remote node.
- `TTL` is `max(0, ceil(hold.remainingMs / 1000))s`, or `-` when no hold timer
  is active.
- `LAST_EVENT` is `lastTransition.event`.
- Self-transitions count, so keepalives and other processed Established events
  remain visible even when the state name does not change.
- The reason code remains available in JSON; it is not mislabeled as an event.
- One HTTP snapshot supplies every row, so time values do not drift while
  formatting.

### 8.2 Routes table

The uniform route table renders candidates and marks the selected route:
```text
SELECTED  ENDPOINT  ROUTE_CLASS  LEARNED_KIND  NEXT_HOP  ORIGIN_NODE  PATH  ELIGIBLE  REASON
```

For a session next hop, `NEXT_HOP` renders:
```text
<remote-node-id>@<owning-session-id>
```

It deliberately omits the redundant `session:` prefix.\
A local next hop renders as `local`; the full binding ID remains available in the structured JSON/SDK snapshot without making the human-oriented table noisy.\
Session IDs are displayed as their six lowercase hexadecimal characters.

`ORIGIN_SESSION` is removed because the uniform path-vector protocol assigns origin authority to `originNodeId`, not an ephemeral globally meaningful session.\
`OWNING_SESSION` is already present in the structured next hop and is not repeated as another table column.\
`PATH` renders the ordered node path.\
`LEARNED_KIND` may distinguish `direct` and `transit`; it is evidence from the route snapshot, not a CLI inference.

Candidates are rendered in SDK order.\
Selection is joined by exact route ID only for the `>` marker; the CLI never performs route choice.\
Templates reject the wrong API version, response kind, or object shape, sanitize terminal control characters, and never silently render malformed documents.

Additional read-only verbs may project existing sovereign HTTP resources later.\
No CLI template may become an alternate operational schema.

---

## 9. Restart and state lifetime

AGP owns no durable runtime state.

| State | Restart owner and behavior |
|---|---|
| `NodeConfig` and deployment topology | Re-supplied by the embedding application |
| Concrete adapter configuration and resolver-bound acquisition capabilities | Reconstructed by the embedding application; never serialized by the kernel |
| Loopback fabric | Application-owned production capability; its lifetime is independent of any one node and its live channels are not restorable |
| Local endpoint intent and handlers | Re-exposed by the embedding application |
| Listener acquisition, adjacency attempts, channels, and sessions | Discarded and reacquired |
| FSM state, timers, queues, and reverse breadcrumbs | Discarded |
| Adj-RIB-In, candidate RIB, selected RIB, forwarding, and Adj-RIB-Out | Discarded and reconstructed through route exchange |
| Snapshot revisions, event sequences, events, counters, and high-water marks | Discarded; new `instanceId`, revision `0`, and zero counters |
| Durable message queue, delivery receipt, or audit history | No AGP owner; out of scope |

The reconstruction sequence is:
```text
construct adapter/fabric and resolver port
-> createNode(configuration, { transport: bindings })
-> expose application-owned endpoints
-> start
-> reacquire neutral packet channels and peer sessions
-> exchange authoritative route snapshots
-> deterministically converge current reachability
```

No API serializes or restores an `Established` session, learned route, selected next hop, pending write, or reverse breadcrumb as live truth.\
Persisting those objects would create phantom transports and stale forwarding authority.

The final snapshot of a stopped node remains queryable only while that object remains in process.\
It has no identity or authority in the replacement node.\
Applications requiring durable audit or message recovery must provide that facility outside AGP.

---

## 10. AGP v1 migration

This is an authorized coordinated replacement of v1, not a compatibility layer.

| Previous v1 surface | Uniform v1 surface |
|---|---|
| `createRouter()` / `createSpoke()` | `createNode()` only |
| `AgpRouter` / `AgpSpoke` and `role` | `AgpNode`; capabilities are configuration and state |
| `RouterConfig` / `SpokeConfig` | One sovereign `NodeConfig` |
| Hub/spoke or WebSocket-shaped transport ports | One carrier-neutral `PeerTransportPort` resolving logical names to already-bound listen/connect capabilities |
| URL/host/port/path fields in core topology configuration | Logical `transportRef`; concrete addresses belong to the adapter configuration |
| Static configured transport-security assertions | Immutable `TransportPeerEvidence` observed during channel acquisition |
| `sendText()` / text callback transport SPI | Bounded `Uint8Array` packet `send()` / pull `read()` channel |
| WebSocket subprotocol and native close details in common code | Sovereign `@agp/binding-websocket` mapping |
| Test-only in-memory fake transport | Production `@agp/transport-loopback` adapter plus shared conformance tests |
| Claimed local or remote protocol role | Node identity plus symmetric protocol bounds |
| `endpoint.update` / `endpoint.ack` | `route.update` / `route.ack` |
| Hub-received versus spoke-export session state | Both `routeImport` and `routeExport` on every session |
| Origin session as route provenance | Origin node plus ordered path; local owning session remains next-hop evidence |
| Management `meta.role` | Removed; no synthetic replacement |
| Role-specific SDK errors, counters, and events | Uniform route/session names |
| Implicit spoke upstream send | Selected RIB lookup on every node |

The wire envelope still says `agp: 1`, and the operations, event, and management schema versions remain their `/v1` identities, but their old accepted shapes are replaced consistently.\
Mixed legacy and uniform v1 peers are unsupported.\
Applications compiled against the old factories or DTOs must migrate in the same cutover; no long-lived facade preserves the old semantics.

Management paths and the two initial CLI command names remain stable where their meanings remain true.\
JSON consumers must nevertheless regenerate or update against the new sovereign schemas because obsolete role, endpoint-state, and origin-session fields are deliberately removed.

Examples and local topology tests instantiate the same executable with different `NodeConfig` documents and injected resolver ports.\
A central listener with two dialing leaves is still a supported geometry, but none of those processes has a protocol or SDK role.\
The same topology must be constructible over WebSocket or a shared process-local Loopback fabric without changing endpoint, FSM, route, forwarding, or management assertions.

---

## 11. Invariants

1. `createNode()` is the only public runtime factory.
2. Configuration can alter topology and transit capability but cannot select a
   different node or session implementation.
3. Every successful send names the selected route and operations revision used
   for admission.
4. No missing route produces an onward data packet.
5. Every operational query returns a sovereign, immutable current-state DTO.
6. One logical mutation commits all dependent state, counters, and events at
   one revision.
7. Revisions are ordered only within one ephemeral runtime instance.
8. SDK, HTTP, and CLI never disagree because adapters do not reconstruct
   canonical state.
9. Session direction remains evidence, never protocol authority.
10. No public state, metadata, event, counter, HTTP field, or CLI concept assigns
    a hub or spoke role.
11. Restart restores configuration and endpoint intent, not live derived state.
12. CLI projections are read-only and preserve raw JSON access.
13. Core configuration stores logical transport references, never
    carrier-native addresses or options.
14. Every configured reference resolves to an injected opaque capability before
    the node instance is created.
15. WebSocket and Loopback execute the same codec, FSM, session, RIB,
    forwarding, admission, timer, and operations paths.
16. Adapter liveness, framing, security objects, and carrier-native terminal
    codes never become protocol authority or canonical operational state.

---

## 12. Mechanics, rationale, and consequence

### Mechanics

One `AgpNode` composes lifecycle, endpoint bindings, neutral peer channels, peer sessions, the uniform RIB/forwarding path, and one revisioned operations store.\
The embedding application resolves logical references through a sovereign adapter before construction.\
Schema-backed SDK results expose the store synchronously.\
Events provide bounded live change evidence; management HTTP wraps exact snapshots; `agpctl` performs only deterministic read-only rendering.

### Rationale

A uniform runtime is only meaningful if applications and operators observe the same concepts on every process.\
A single atomic store gives local send, transit forwarding, SDK queries, HTTP, and CLI one truth, while immutable revisions let consumers reason about concurrent changes without treating ephemeral state as persistent authority.

Retaining stable read-only management paths protects the useful operator surface without preserving false role or origin-session semantics.\
Separating capability interfaces from schema-backed DTOs also keeps contract sovereignty honest: schemas describe data, while TypeScript describes in-process authority.

### Consequence of violation

- Wrapping old router and spoke objects behind `createNode()` preserves two
  behavioral systems and two operational truths.
- Allowing a send or handler path to bypass the selected RIB recreates implicit
  default routing.
- Returning live mutable objects lets consumers corrupt or observe torn state.
- Incrementing revisions per derived table exposes impossible intermediate
  combinations.
- Reconstructing state in HTTP or JQ lets adapters disagree with the SDK.
- Persisting sessions, routes, queues, or breadcrumbs creates phantom
  authority after restart.
- Keeping `role` under a different name lets topology labels regain protocol
  meaning.
- Treating admission receipts as delivery guarantees invents reliability AGP
  does not provide.
- Letting carrier options or native errors cross the neutral boundary makes the
  kernel depend on the first adapter and invalidates transport equivalence.
- Giving Loopback a direct message or FSM hook creates a privileged test path
  that cannot certify the production kernel.
