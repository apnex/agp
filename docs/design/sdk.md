# AGP uniform node - SDK design

> **Status:** Ratified. Current public API contract.\
> Canonical operational state is in [`operations.md`](operations.md); gate definitions are in [`verification.md`](verification.md).

## 1. Mandate

`createNode()` is the sole runtime factory and `AgpNode` is the sole application-facing runtime abstraction.\
The same API creates a node that only dials, only listens, does both, exposes local endpoints, forwards in transit, or remains application-local.\
Those differences come from `NodeConfig`; they are not roles and do not select different kernel implementations.\
`NodeConfig` contains logical `transportRef` values; the embedding application separately injects the adapter-owned capabilities that resolve them.\
Concrete carrier configuration never enters the kernel.

This document owns the application-facing surface: composition, lifecycle, endpoint binding, messaging, and the state lifetime one instance guarantees.\
What that runtime exposes for inspection is owned by [`operations.md`](operations.md).

---

## 2. Invariants

1. `createNode()` is the only public runtime factory.
2. Configuration can alter topology and transit capability but cannot select a different node or session implementation.
3. Every successful send names the selected route and operations revision used for admission.
4. No missing route produces an onward data packet.
5. Session direction remains evidence, never protocol authority.
6. Restart restores configuration and endpoint intent, not live derived state.
7. Core configuration stores logical transport references, never carrier-native addresses or options.
8. Every configured reference resolves to an injected opaque capability before the node instance is created.
9. WebSocket and Loopback execute the same codec, FSM, session, RIB, forwarding, admission, timer, and operations paths.

---

## 3. Contract ownership

### 3.1 Schema-backed DTOs

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

### 3.2 Capability-bearing interfaces

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

## 4. Public node API

### 4.1 Factory and composition

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

### 4.2 Lifecycle

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

## 5. Endpoint and messaging API

### 5.1 Endpoint exposure

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

### 5.2 Handler delivery

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

### 5.3 Routed send

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

### 5.4 Closed SDK failure domain

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

## 6. Restart and state lifetime

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

## 7. Mechanics, rationale, and consequence

### Mechanics

One factory composes a node from configuration and injected transport capabilities, returns typed handles for endpoint binding and messaging, and gives every instance one unambiguous lifetime.\
Admission results name the exact selected route and operations revision that authorised them.

### Rationale

An application needs one way to build a node and one way to know whether an operation was accepted.\
Naming the route and revision in a receipt makes acceptance auditable against canonical state rather than inferred from the absence of an error.

### Consequence of violation

- A second factory or a role-selecting option reintroduces divergent runtime behavior behind one name, and topology stops being configuration.
- Treating an admission receipt as a delivery guarantee invents reliability AGP does not provide, and pushes retry logic into applications that cannot see the route that failed.
- Allowing a send or handler path to bypass the selected RIB recreates implicit default routing, so a message can leave a node holding no route for it.
- Reusing a stopped instance lets callbacks, session identifiers, and snapshots from a retired lifetime become authoritative again.
