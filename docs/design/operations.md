# AGP uniform node - canonical operations design

> **Status:** Ratified. Current operational-state contract.\
> The runtime surface that produces this state is in [`sdk.md`](sdk.md); gate definitions are in [`VERIFICATION.md`](../VERIFICATION.md).

## 1. Mandate

The node owns one canonical operational state store.\
SDK queries read immutable snapshots from that store.\
Management HTTP projects those snapshots, and `agpctl` renders the HTTP documents.\
Neither adapter inspects private runtime objects or independently reconstructs a route, connection, timer, counter, or lifecycle state.

One logical mutation commits every dependent table, counter, and event at one revision, so no consumer observes a half-applied change.

---

## 2. Invariants

1. Every operational query returns a sovereign, immutable current-state DTO.
2. One logical mutation commits all dependent state, counters, and events at one revision.
3. Revisions are ordered only within one ephemeral runtime instance.
4. SDK, HTTP, and CLI never disagree, because adapters do not reconstruct canonical state.
5. No public state, metadata, event, counter, HTTP field, or CLI concept assigns a hub or spoke role.
6. CLI projections are read-only and preserve raw JSON access.
7. Adapter liveness, framing, security objects, and carrier-native terminal codes never become protocol authority or canonical operational state.

---

## 3. Canonical operational state

### 3.1 Uniform entity semantics

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

### 3.2 Snapshot metadata and revisions

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

### 3.3 Operations reader

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

## 4. Events and counters

### 4.1 Event policy

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

### 4.2 Counter policy

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

## 5. Management HTTP

### 5.1 Projection boundary

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

### 5.2 Point-in-time behavior

One request performs one SDK query and carries that query's metadata.\
HTTP serialization does not advance the operations revision.\
`Cache-Control: no-store` remains required.\
A client joining data from several resources must compare `instanceId` and revision or use `/v1/snapshot` for a single-revision view.

Every emitted success and error body is validated against its compiled management schema in contract and system tests.

---

## 6. Read-only `agpctl`

The MVP CLI remains a decoupled shell command, HTTP driver, and JQ template.\
It has no direct SDK access and no mutating verb.

The initial commands remain:
```text
agpctl connections.list [--json] [--url URL]
agpctl routes.list      [--json] [--url URL]
```

`--json` emits the validated HTTP response document without table-derived fields.\
Table mode is a deterministic presentation only.

### 6.1 Connections table

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
  remain visible even when the state name does not change. This is a property
  of the snapshot. The event stream announces a self-transition only when no
  other event already reports the same activity, so a delivery is recorded here
  and not announced there, while a keepalive is both. See `D22`.
- The reason code remains available in JSON; it is not mislabeled as an event.
- One HTTP snapshot supplies every row, so time values do not drift while
  formatting.

### 6.2 Routes table

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

## 7. Mechanics, rationale, and consequence

### Mechanics

The node commits one revisioned immutable snapshot per logical mutation.\
Read-only HTTP wraps that snapshot in its exact response contract, and `agpctl` renders the response without routing logic, so all three surfaces read one committed truth.

### Rationale

Operators reason about a running system from what it reports.\
If a projection can compute state independently, two surfaces can disagree while both look correct, and the disagreement surfaces during an incident rather than in review.

### Consequence of violation

- Returning live mutable objects lets a consumer corrupt canonical state, or observe a torn read midway through a routing transaction.
- Incrementing revisions per derived table exposes impossible intermediate states in which a route is selected but not yet forwardable.
- Reconstructing state in HTTP or in a CLI template lets an adapter disagree with the SDK, and an operator cannot tell which one is lying.
- Keeping a role field under a different name lets a topology label regain protocol meaning it no longer has.
- Persisting sessions, routes, queues, or breadcrumbs across instances creates phantom adjacencies and stale next hops that outlive the transport that justified them.
