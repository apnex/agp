# AGP uniform node - routing and forwarding design

> **Status:** Ratified. Current RIB, selection, and forwarding contract.\
> Gate definitions are in [`VERIFICATION.md`](../VERIFICATION.md).

## 1. Status, authority, and boundary

| Field | Value |
|---|---|
| Status | Ratified. Current routing contract |
| Intent authority | [`DECISIONS.md` section 2](../DECISIONS.md#2-confirmed-intent) |
| Architecture | [`README.md`](README.md) |
| Wire/session contract | [`protocol.md`](protocol.md) |
| Schema ownership | [`contracts.md`](contracts.md) |
| Applicable axioms | [`axioms.md`](axioms.md) |
| Protocol target | AGP v1 replaced in place; old v1 interoperability is not retained |

This document specifies the canonical route state and data-decision mechanics inside every `AgpNode`.\
It replaces the MVP model in which only the hub owned a RIB and a spoke treated its single hub session as an implicit default route.

The routing mandate is:
```text
local endpoint intent + per-peer authoritative imports
                         |
                         v
                 deterministic Loc-RIB
                    |            |
                    v            v
             forwarding      per-peer export
```

No local or transit data path bypasses this state.\
No selected usable route means no onward data packet.

This design includes selected-route path-vector propagation, deterministic single-path selection, source authorization, bounded hop control, and reverse delivery errors.\
Multipath, configurable metrics, communities, and policy-based best-path selection remain deferred.

---

## 2. Route vocabulary and identity

### 2.1 Identity layers

Route reasoning uses distinct identities for distinct lifetimes:

| Entity | Identity | Scope and authority |
|---|---|---|
| Node | `nodeId` | Stable configured protocol identity; admitted at OPEN |
| Local session | `(remoteNodeId, owningSessionId)` | `owningSessionId` is exactly six lowercase hexadecimal characters and unique among the issuing node's concurrently live controllers to that remote node |
| Remote session | `(remoteNodeId, remoteSessionId)` | Remote controller identity learned from identity-admitted OPEN |
| Logical origin | `(endpoint, originNodeId)` | Identifies one endpoint claim at its final originating node |
| Imported slot | `(advertisingNodeId, owningSessionId, endpoint)` | The one selected route for an endpoint received from one peer session |
| Local candidate | `bindingId` | One active application binding for an endpoint |
| Advertisement | `advertisementId` | Node-local opaque identity for one imported route incarnation |
| Candidate | `routeId` | Node-local opaque identity for one candidate incarnation |
| Wire snapshot | `(advertisingNodeId, owningSessionId, inboundRevision)` | One authoritative route set consumed from one peer |
| Operations commit | `operationsRevision` | One node-local atomic state revision; unrelated to wire revisions |

`SessionId` has the exact lexical contract `^[0-9a-f]{6}$` and is deliberately neither node-global nor deployment-global.\
Public/local lookup always combines the peer node and locally issued ID as `(remoteNodeId, owningSessionId)`; remote provenance combines `(remoteNodeId, remoteSessionId)`.\
A stale callback may mutate route state only when the live session directory still maps the pair-scoped local identity to that exact session controller object.

The public `RouteKey` is:
```ts
interface RouteKey {
  endpoint: EndpointName;
  originNodeId: NodeId;
}
```

Destination lookup remains an exact lookup by `endpoint`.\
If several origins claim the same endpoint, they are distinct candidates for that destination and the deterministic decision process selects one.\
A data source carries both `endpoint` and `originNodeId`, so source authorization never aliases two origins that use the same endpoint name.

Path and local route IDs are not logical origin identity.\
A route can converge through a different path without becoming a different origin, and every node assigns its own `advertisementId` and `routeId`.

### 2.2 Three path representations

The same selected reachability has three deliberately different local representations:

| View | Path ending | Meaning |
|---|---|---|
| Wire `RouteAdvertisement.path` | Identity-admitted advertising peer | Ordered origin-to-sender path received on this adjacency; receiver absent |
| Adj-RIB-In advertisement | Identity-admitted advertising peer | Exact accepted wire claim owned by the importing session |
| Candidate / selected route | Local node | Imported wire path with `localNodeId` appended once, or `[localNodeId]` for a local route |

For nodes `A-B-C`, a route originated at `A` appears as:
```text
A local selected path:        [A]
A -> B wire path:              [A]
B imported advertisement:    [A]
B selected path:              [A, B]
B -> C wire path:              [A, B]
C selected path:              [A, B, C]
```

This convention gives each selected route a complete path through the node that owns the Loc-RIB, while every wire route ends at the peer that actually sent it.\
Exporting a selected route therefore copies its selected path as the wire path; it does not append the local node a second time.

---

## 3. Canonical state views

All views are owned by `@agp/core`, have sovereign schemas listed in [`contracts.md`](contracts.md), and are committed through one node state executor.\
Runtime maps may use different private structures, but public DTO semantics are exact.

### 3.1 Local endpoint input

```ts
interface LocalRouteInput {
  endpoint: EndpointName;
  bindingId: string;
  registeredAt: Timestamp;
  active: boolean;
}
```

An active binding contributes exactly one local candidate:
```text
originNodeId = localNodeId
path         = [localNodeId]
nextHop      = local(bindingId)
```

Transient handler saturation is a message-admission failure, not route withdrawal.\
Closing the binding removes the candidate before later data can be admitted against it.

### 3.2 Adj-RIB-In advertisement

```ts
interface AdvertisementSnapshot {
  advertisementId: string;
  endpoint: EndpointName;
  originNodeId: NodeId;
  owningSessionId: SessionId;
  advertisingNodeId: NodeId;
  remoteSessionId: SessionId;
  receivedPath: readonly NodeId[];
  receivedRevision: WireRevision;
  receivedAt: Timestamp;
}
```

An advertisement is the exact accepted route claim received from one peer.\
`receivedPath` ends at `advertisingNodeId` and excludes the local node.\
Advertisements are ephemeral, session-owned truth.\
They are never restored after restart and are all withdrawn when their owning session ceases to be `Established`.

The imported slot permits at most one advertisement per `(advertisingNodeId, owningSessionId, endpoint)` because a peer exports only its selected route for each endpoint.\
If a later snapshot changes the origin for that slot, the prior advertisement and candidate incarnations end and receive new local IDs.\
If the origin is unchanged but the path changes, the incarnation may retain its IDs while updating its path and received revision atomically.

### 3.3 Candidate RIB

```ts
interface CandidateRouteSnapshot {
  routeId: RouteId;
  endpoint: EndpointName;
  originNodeId: NodeId;
  routeClass: "local" | "learned";
  learnedKind?: "direct" | "transit";
  source:
    | { kind: "local"; bindingId: string }
    | {
        kind: "session";
        owningSessionId: SessionId;
        advertisingNodeId: NodeId;
        advertisementId: string;
      };
  path: readonly NodeId[];
  nextHop: NextHopRef;
  eligible: boolean;
  selectionStatus: "selected" | "not-selected" | "ineligible";
  selectionReason: CandidateSelectionReason;
  installedAt: Timestamp;
}
```

Candidate `path` always ends at `localNodeId`.\
A learned candidate resolves to the immediate advertising peer session, never directly to its final origin.\
`learnedKind` is `direct` when the received path contains only the advertising origin and `transit` when it contains earlier nodes; this is canonical route state, not a CLI inference.

### 3.4 Selected Loc-RIB

```ts
interface SelectedRouteSnapshot {
  endpoint: EndpointName;
  routeId: RouteId;
  originNodeId: NodeId;
  routeClass: "local" | "learned";
  learnedKind?: "direct" | "transit";
  sourceKind: "local" | "session";
  path: readonly NodeId[];
  nextHop: NextHopRef;
  selectionReason: SelectedReason;
  selectedAt: Timestamp;
}
```

There is at most one selected route per endpoint.\
The selected object is derived from an eligible candidate and does not own independent mutable reachability.

### 3.5 Forwarding projection

```ts
interface ForwardingEntrySnapshot {
  endpoint: EndpointName;
  selectedRouteId: RouteId;
  originNodeId: NodeId;
  nextHop:
    | { kind: "local"; bindingId: string }
    | {
        kind: "session";
        nodeId: NodeId;
        owningSessionId: SessionId;
      };
  resolvedAtRevision: OperationsRevision;
}
```

A forwarding entry exists if and only if its selected route resolves to the same active local binding or exact `Established` session during the same state transaction.\
A private packet-channel handle or adapter transport ID never appears in this DTO.

### 3.6 Per-peer Adj-RIB-Out

Each established peer session owns independent export state:
```ts
interface RouteExportState {
  routeDecisions: readonly AdjRibOutRouteSnapshot[];
  nextRevision: WireRevision;
  acked?: ExportSnapshot;
  outstanding?: ExportSnapshot;
  coalescedDesired?: readonly RouteAdvertisement[];
}

interface AdjRibOutRouteSnapshot {
  endpoint: EndpointName;
  originNodeId: NodeId;
  path: readonly NodeId[];
  state: "desired" | "outstanding" | "acked" | "rejected" | "suppressed";
  reasonCode?:
    | "TRANSIT_DISABLED"
    | "PEER_IN_PATH"
    | "PATH_TOO_LONG"
    | "CAPACITY";
  remoteRejectionCode?: "LOOP" | "PATH_TOO_LONG" | "POLICY" | "CAPACITY";
  remoteRetryAttempt?: number;
  remoteRetryAt?: Timestamp;
  revision?: WireRevision;
}
```

Export state is per session and per peer.\
There is no node-wide `advertised` boolean.\
An endpoint may be ACKed by one peer, outstanding to another, and suppressed to a third.

The state/field combinations are closed:

- `suppressed` is the current local export decision, is absent from every wire
  snapshot, requires `reasonCode`, and has no revision or
  remote rejection/retry field;
- `rejected` is an exact peer ACK result, requires its snapshot `revision` and
  exact `remoteRejectionCode`, and has no local `reasonCode`; `POLICY` and
  `CAPACITY` additionally require a zero-based `remoteRetryAttempt` and exact
  monotonic-derived `remoteRetryAt`, while `LOOP` and `PATH_TOO_LONG` have
  neither retry field;
- `outstanding` and `acked` require their exact wire revision and have neither
  reason nor retry field; and
- `desired` is the latest exportable derivation not yet represented by the
  outstanding or ACKed snapshot and has no revision, reason, or retry field.

Remote rejection memory is keyed by the exact session and exported `(endpoint, originNodeId, path)` tuple.\
If the current export derivation is the same tuple, it stays `rejected`, is omitted from unrelated desired wire snapshots, and never becomes locally `suppressed`.

Retry/recovery is closed by peer rejection code:

| Remote code | Recovery trigger |
|---|---|
| `LOOP` | No timer; a changed path tuple or exact session replacement |
| `PATH_TOO_LONG` | No timer; a shorter path tuple or replacement session with a newly negotiated bound |
| `POLICY` | Changed tuple/session, or the configured exponential retry timer |
| `CAPACITY` | Changed tuple/session, or the configured exponential retry timer |

For `POLICY` and `CAPACITY`, effective configuration `routeRejectionRetry.initialMs` and `.maxMs` defaults to `1000` and `30000` when the raw object/fields are omitted; both are positive safe integers with `maxMs >= initialMs`.\
Rejection number `r` for an unchanged tuple, starting at zero, arms an injected monotonic-clock deadline at `now + min(maxMs, initialMs * 2^r)` using saturating arithmetic.\
Expiry makes a still-current exportable tuple `desired`; if an update is outstanding it enters the one coalesced successor.\
Rejection increments `r` until the sovereign safe-integer attempt maximum and then retains that maximum; it is a bounded diagnostic projection, not ordering authority.\
ACK acceptance or tuple removal/change clears it.\
Session teardown clears all rejection and retry state.\
No ACK handler immediately reoffers a rejected tuple.

Rows are projections of independent stages.\
During convergence the same route key may therefore have an ACKed row for the prior epoch and a desired or outstanding row for its successor.\
`routeDecisions` exposes those stages without collapsing them into a false node-wide readiness value.

### 3.7 Reverse-correlation state

```ts
interface ReverseCorrelationSnapshot {
  messageId: MessageId;
  outboundReturnToken: ReturnToken;
  source: EndpointSource;
  destination: EndpointName;
  ingress:
    | { kind: "local" }
    | {
        kind: "session";
        nodeId: NodeId;
        owningSessionId: SessionId;
        upstreamReturnToken: ReturnToken;
      };
  egressNodeId: NodeId;
  egressSessionId: SessionId;
  admittedAtRevision: OperationsRevision;
  expiresAt: Timestamp;
}
```

This bounded breadcrumb is forwarding state, not durable message state.\
It exists only to validate and return a downstream nonfatal error without another route lookup.\
Its private lookup identity is the exact egress controller object plus `outboundReturnToken`; public egress identity is the pair `(egressNodeId, egressSessionId)`, which is still not sufficient private identity.

`ReturnToken` is the sovereign scalar `^[0-9a-f]{16}$`, distinct from `MessageId`.\
Each exact controller's production allocator starts at unsigned 64-bit zero, renders the current value as fixed-width lowercase hex, increments without reuse, and marks itself exhausted after emitting `ffffffffffffffff`.\
A later allocation attempt returns `exhausted`, makes that controller unusable, and triggers session termination before data admission.\
An injected test allocator implements the same `token | exhausted` result contract with a smaller domain.

---

## 4. Routing invariants

The implementation and conformance suite must enforce:

| ID | Invariant |
|---|---|
| R1 | Every active local binding contributes exactly one local candidate, and no closed binding contributes one. |
| R2 | Every imported advertisement and learned candidate is owned by exactly one exact live session controller. |
| R3 | The first node in every advertisement and candidate path equals `originNodeId`. |
| R4 | An Adj-RIB-In path ends at its identity-admitted advertising peer and excludes the local node. |
| R5 | A candidate or selected path ends at the local node, contains every node at most once, and for a learned route has length at most the owning session's negotiated complete-path bound. |
| R6 | There is at most one imported candidate per `(advertisingNodeId, owningSessionId, endpoint)` and at most one selected route per endpoint. |
| R7 | Every selected route is an eligible candidate and has exactly one forwarding entry; without a resolvable candidate, both selected and forwarding rows are absent. |
| R8 | A learned next hop names the immediate peer session, not the final origin. |
| R9 | Adj-RIB-Out contains only selected routes and never exports a route to a peer already present in its path. |
| R10 | A data egress is admitted only against a selected forwarding entry from the same operations revision. |
| R11 | A peer data egress is admitted only when that peer has ACKed a source route matching the message's `(source.endpoint, source.originNodeId)`. |
| R12 | A local or transit route miss emits zero onward data packets. |
| R13 | A reverse error follows a validated breadcrumb or the immediate failing ingress; it never performs a route lookup. |
| R14 | Session loss removes all and only state owned by that exact session before later affected data is admitted. |
| R15 | Wire revisions, session IDs, route IDs, and operations revisions are never substituted for one another. |
| R16 | All capacity decisions are made before canonical state or wire admission is partially mutated. |
| R17 | Every peer data egress receives a return token that is never reused by its exact session controller; reverse errors correlate by exact controller plus token, and relays translate only that token. |
| R18 | At most one controller per remote node is retained; cross-dial prefers the connection initiated by the lexically higher node, then the lexically lower canonically oriented endpoint-session tuple. |

---

## 5. Route import

### 5.1 Preconditions

A `route.update` enters routing only after the peer session has:

1. reached `Established`;
2. bound the transport to an identity-admitted `remoteNodeId`;
3. resolved adjacency collision in favor of this exact controller;
4. validated the envelope through the sovereign protocol schemas; and
5. validated the update count and encoded size against negotiated bounds.

The expected inbound revision is `1` for the first update and exactly `consumedRevision + 1` thereafter.\
A gap, repeat, or rollover violation is fatal because it makes authoritative replacement ambiguous.

### 5.2 Route validation classes

Each route is classified without mutating current state:

| Condition | Result |
|---|---|
| `path[0] !== originNodeId` | Fatal forged-origin protocol violation |
| `path.at(-1) !== identity-admitted remoteNodeId` | Fatal forged-sender protocol violation |
| Duplicate node in path other than the receiver case | Fatal invalid path |
| Local node appears in an otherwise valid path | Nonfatal `LOOP` rejection |
| `path.length + 1 > negotiatedMaxPathLength` | Nonfatal `PATH_TOO_LONG` rejection |
| Import admission denies the route | Nonfatal `POLICY` rejection |
| Candidate capacity cannot admit the route | Nonfatal `CAPACITY` rejection |
| All checks pass | Accepted into the proposed Adj-RIB-In set |

Static schema limits and whole-envelope negotiated limits remain fatal as specified by the protocol.\
Per-route rejections consume the update revision and appear in `route.ack`.

The negotiated maximum is the complete path after import.\
The received wire path excludes the receiver, so validation reserves exactly one element for the receiver append.\
`path.length + 1 === negotiatedMaxPathLength` is accepted and produces a candidate exactly at the bound; the executor never constructs a candidate at `negotiatedMaxPathLength + 1`.

The update must be canonically sorted and contain at most one route per endpoint.\
Canonical order is endpoint, then origin node, then node path, all compared as unsigned UTF-8 bytes.\
Noncanonical or duplicate endpoint entries are protocol violations rather than arrival-order selection inputs.

### 5.3 Deterministic capacity admission

Whole-set replacement does not temporarily count both the old and proposed sets.\
Before capacity evaluation, the executor subtracts this session's current candidate count from the total and reserves space for unchanged local and other session candidates.

After path and import admission, candidate routes are considered in canonical wire order.\
The first routes fitting both per-peer and node-total candidate capacity are accepted; the remaining routes are rejected with `CAPACITY`.\
Arrival timing and private map iteration never influence which subset survives.

### 5.4 Atomic replacement algorithm

```text
import(session, update):
  require session is exact live Established owner
  require update.revision == session.inboundRevision + 1

  proposedAccepted := []
  rejections := []

  for route in canonical(update.routes):
    result := validatePathAndAdmission(session, route)
    if result accepted:
      proposedAccepted += route
    else:
      rejections += result

  capacityFilter(proposedAccepted, rejections)

  old := AdjRibIn[session]
  affected := endpoints(old) union endpoints(proposedAccepted)
  diff := compareByImportedSlot(old, proposedAccepted)

  atomically:
    end removed/replaced advertisement and candidate incarnations
    retain IDs for unchanged origin slots and update their path/revision
    install added/replaced advertisement and candidate incarnations
    set session.inboundRevision := update.revision
    recompute LocRib, forwarding, and every affected AdjRibOut
    commit one operations revision

  after commit:
    enqueue route.ack(update.id, revision, rejections)
```

Omission and rejection both remove any prior route in that peer's corresponding endpoint slot.\
A rejected new route does not leave an older route from the same peer installed.

An ACK describes the committed import result.\
It is never sent before the replacement, reselection, forwarding, and export consequences become visible at one operations revision.

---

## 6. Eligibility and deterministic selection

### 6.1 Eligibility

A local candidate is eligible while:

1. its exact binding remains active;
2. its endpoint still indexes that binding; and
3. its local next hop resolves to that binding.

Handler saturation does not alter eligibility.

A learned candidate is eligible while:

1. its advertisement exists in the owning session's Adj-RIB-In;
2. advertisement and candidate agree on endpoint, origin, path, advertising
   node, and owning session;
3. the exact owner controller remains the live directory entry for
   `(advertisingNodeId, owningSessionId)`;
4. the owner is `Established`;
5. it remains bound to the advertised remote node/session identity;
6. the complete candidate path remains valid and ends at the local node; and
7. its session next hop resolves to that exact owner.

An ineligible candidate remains queryable only when retaining it is useful for the current atomic transition.\
A withdrawn session advertisement is removed, not retained indefinitely as an ineligible route.

### 6.2 Total best-path order

AGP v1 selects one winner by this public total order:

1. eligible before ineligible; only eligible routes may win;
2. local before learned;
3. shorter complete node path;
4. lower `originNodeId`;
5. lexically lower complete node path, element by element;
6. for two local candidates, lower `bindingId`.

All string comparisons use unsigned UTF-8 byte order.\
Complete path comparison already includes the immediate advertising node.\
Two learned candidates that remain equal after step 5 would have the same complete path and origin; the one-adjacency and imported-slot invariants prohibit that duplicate.\
The final binding-ID step closes the only remaining legitimate tie without making a runtime-generated ID a higher-order route policy.

Path length is the inherent path-vector distance required by this design.\
It is not a configurable metric.\
No weight, local preference, community, or application policy participates in v1 selection.

The reason domains are closed:
```ts
type SelectedReason =
  | "ONLY_ELIGIBLE"
  | "PREFER_LOCAL"
  | "SHORTEST_PATH"
  | "LOWEST_ORIGIN_NODE_ID"
  | "LOWEST_NODE_PATH"
  | "LOWEST_BINDING_ID";

type IneligibleReason =
  | "LOCAL_BINDING_INACTIVE"
  | "LOCAL_ENDPOINT_INDEX_MISMATCH"
  | "ADVERTISEMENT_INACTIVE"
  | "ADVERTISEMENT_MISMATCH"
  | "SESSION_CONTROLLER_STALE"
  | "SESSION_NOT_ESTABLISHED"
  | "SESSION_IDENTITY_MISMATCH"
  | "PATH_INVALID"
  | "NEXT_HOP_UNRESOLVED";

type CandidateSelectionReason = SelectedReason | IneligibleReason;
```

Reason assignment is exact:

- local feasibility is evaluated in the three numbered conditions in
  section 6.1, mapping in order to `LOCAL_BINDING_INACTIVE`,
  `LOCAL_ENDPOINT_INDEX_MISMATCH`, and `NEXT_HOP_UNRESOLVED`;
- learned feasibility is evaluated in its seven numbered conditions, mapping
  in order to `ADVERTISEMENT_INACTIVE`, `ADVERTISEMENT_MISMATCH`,
  `SESSION_CONTROLLER_STALE`, `SESSION_NOT_ESTABLISHED`,
  `SESSION_IDENTITY_MISMATCH`, `PATH_INVALID`, and
  `NEXT_HOP_UNRESOLVED`; the first failure wins;
- if exactly one candidate is eligible, its selected reason is
  `ONLY_ELIGIBLE`;
- with multiple eligible candidates, the selected candidate reports the first
  comparator that distinguishes it from the runner-up, and each unselected
  eligible candidate reports the first comparator it loses to the winner; and
- `selectionStatus = "selected"` requires `SelectedReason`,
  `"not-selected"` requires a `SelectedReason` other than `ONLY_ELIGIBLE`, and
  `"ineligible"` requires `IneligibleReason`.

### 6.3 Selection and forwarding algorithm

```text
select(endpoint):
  candidates := CandidateRib[endpoint]

  for candidate in candidates:
    candidate.eligibility := resolveExactOwnerAndNextHop(candidate)

  eligible := canonicalSort(candidates where eligible)
  winner := eligible[0]

  if winner absent:
    delete LocRib[endpoint]
    delete Forwarding[endpoint]
  else:
    LocRib[endpoint] := projection(winner)
    Forwarding[endpoint] := resolve(winner.nextHop)

  require selected and forwarding both exist or both do not exist
```

Selection and forwarding are one derivation.\
The node never commits a selected route whose next hop failed to resolve, even briefly.

---

## 7. Selected-route export

### 7.1 Desired Adj-RIB-Out

For an established peer `P`, derive one export decision for every selected route:
```text
deriveExport(peer P, selected route R):
  if R is learned and local transit is disabled:
    suppress TRANSIT_DISABLED
  else if P.nodeId appears in R.path:
    suppress PEER_IN_PATH
  else if R.path.length + 1 > P.negotiatedMaxPathLength:
    suppress PATH_TOO_LONG
  else if exact (R.endpoint, R.originNodeId, R.path) has retained remote
          rejection whose recovery trigger is not due:
    retain REJECTED with its exact remote code and revision; emit no wire route
  else:
    advertise {
      endpoint: R.endpoint,
      originNodeId: R.originNodeId,
      path: R.path
    }
```

Local selected routes are exportable even when transit is disabled.\
Learned selected routes are exportable only when transit is enabled.\
Unselected candidates never enter Adj-RIB-Out.

The wire path is the selected complete path and already ends at the exporting local node.\
The receiver will append itself if it accepts the route, so the sender reserves that one element in its exact export check.\
Equality after the append is permitted.

If exportable selected routes exceed the peer's negotiated `maxRoutesPerSnapshot`, canonical route order determines the transmitted prefix; remaining routes are visibly suppressed with `CAPACITY`.\
A sender never emits an update exceeding the negotiated count.

### 7.2 Snapshot state machine

Each session has one independent outbound stream:
```text
acked snapshot       last peer-confirmed authoritative set
outstanding snapshot exactly one written update awaiting route.ack
coalesced desired     latest derivation while an update is outstanding
next revision         next wire revision reserved only for a promoted snapshot
```

Rules:

1. Establishment promotes an authoritative snapshot, including an empty one, at
   revision `1`.
2. If no update is outstanding and desired differs from ACKed, promote desired
   with the next revision.
3. If an update is outstanding, replace only `coalescedDesired`; do not mutate
   the written snapshot.
4. Exact ACK correlation requires message ID and revision.
5. Every unique rejection must identify a route in the outstanding snapshot;
   accepted routes are exactly the outstanding set minus those rejections.
6. ACK installs rejection memory before recomputing the wire-desired set, so an
   unchanged rejected tuple is filtered and cannot create an immediate
   successor update.
7. ACK moves accepted results to `acked`, retains rejected results with exact
   code/revision/retry state, then promotes the latest filtered coalesced
   desired set only if it differs from the accepted ACKed set.
8. ACK timeout terminates the session; no ambiguous retransmission occurs.
9. Session replacement starts a fresh revision stream and sends a complete
   snapshot.

`desired`, `outstanding`, `acked`, `rejected`, and `suppressed` are separately queryable.\
ACKed state means only that the peer committed the route to its accepted Adj-RIB-In; it is not end-to-end reachability or delivery proof.

### 7.3 Source-export barrier

Before any data packet is written to peer `P`, `P`'s ACKed Adj-RIB-Out must contain a route whose key exactly matches the message source:
```text
(source.endpoint, source.originNodeId)
```

The node must also still have an eligible source candidate for that origin.\
The source route need not use the data message's ingress as the node's selected source next hop, but the route exported to the egress peer is the node's selected route for that source endpoint and must have the same origin.

This barrier applies to locally originated and transit data.\
It ensures the next node can perform feasible-path source authorization before accepting the packet.\
While the necessary route is unacknowledged, the node fails before data admission with `SOURCE_NOT_ADVERTISED`; AGP v1 has no hidden control-convergence wait queue.

### 7.4 Withdrawal ordering barrier

Each ACKed source export has a local export epoch.\
A data admission records the current epoch.\
If a later desired snapshot would omit that source identity or replace it with a different origin, the routing transaction closes the epoch to new data.\
The bounded session writer emits all data already admitted under it before emitting the withdrawing full snapshot.

This is not an unbounded drain promise: queue limits were reserved at data admission, and the route-write deadline remains finite.\
Failure to drain and write in time terminates the session, which discards its queued work and route state.\
A withdrawal must never overtake conforming in-flight data merely because control messages otherwise have higher scheduling priority.

---

## 8. Source authorization

### 8.1 Locally originated source

A local `send()` source is authorized only when:

1. the exact endpoint binding is active;
2. the selected route for the source endpoint is that local binding;
3. `originNodeId === localNodeId`; and
4. for peer egress, the source-export barrier succeeds.

A learned route with the same endpoint cannot authorize a local producer.\
Local preference ensures an active local binding is normally selected, but the explicit check protects against stale binding tokens and state defects.

### 8.2 Peer-ingress source

A received data source is authorized when the exact ingress session owns an eligible Adj-RIB-In candidate matching:
```text
endpoint     == message.source.endpoint
originNodeId == message.source.originNodeId
```

The ingress candidate does not have to be the receiver's selected source route.\
This is feasible-path RPF, not selected reverse-path validation, and therefore permits legitimate asymmetric best paths.\
It is stronger than loose RPF because the feasible candidate must be owned by the actual ingress session.

Authorization never relies on the source string alone, a remote address, the destination route, or a route learned from another session.\
A withdrawn, rejected, looped, ineligible, or stale-controller route cannot authorize data.\
Failure emits no onward data and returns correlated `SOURCE_NOT_AUTHORIZED` directly to ingress; it does not terminate an otherwise valid session.

### 8.3 Duplicate endpoint origins

If different origin nodes advertise the same endpoint:

- destination routing selects exactly one origin through the normal Loc-RIB
  comparator;
- the data message carries the selected origin in `source.originNodeId`;
- ingress source authorization checks that exact pair; and
- egress requires an ACKed export for that exact pair.

Thus duplicate endpoint names remain deterministic without pretending the name itself proves source ownership.

---

## 9. Uniform data forwarding

### 9.1 Local send

The node executes:
```text
localSend(source, destination, payload):
  validate source binding and immutable JSON payload
  authorize selected local source
  lookup selected destination and forwarding entry

  if no usable destination:
    reject typed NO_ROUTE before any queue/breadcrumb reservation

  if destination next hop is local:
    reserve handler count and bytes
    admit exact binding-token delivery
    do not consume a hop
  else:
    choose configured default hopLimit within egress negotiated maximum
    require exact egress return-token allocator is usable
    require encoded packet fits egress receive limit
    require ACKed source export to egress
    reserve breadcrumb and egress message/byte capacity atomically
    allocate next ReturnToken as the final infallible reservation step
    enqueue one data packet carrying returnToken after commit

  return receipt naming routeId, next hop, and admission operations revision
```

The receipt proves local admission only.\
It does not claim remote handler success or end-to-end delivery.

### 9.2 Inbound local delivery

For a valid peer message:

1. authorize the exact ingress source;
2. resolve destination from the selected RIB;
3. require the selected next hop to be the exact active local binding;
4. reserve handler concurrency and bytes;
5. deliver using immutable payload/context and a binding token.

Local delivery does not decrement `hopLimit` and is permitted when `transit.enabled` is false.\
Missing or stale local destination state follows the same route-miss rule and returns an error directly to ingress.

### 9.3 Transit forwarding

For nonlocal forwarding:
```text
transit(message, ingress):
  require ingress source authorization
  resolve selected destination and exact forwarding session
  if destination is local:
    use local-delivery path
  require transit.enabled
  require message.hopLimit > 1
  require egress != ingress
  require exact egress return-token allocator is usable
  require encoded packet fits egress receive limit
  require source-export barrier for egress
  compute forwardedHopLimit
  atomically reserve breadcrumb plus egress count/bytes
  allocate next ReturnToken as the final infallible reservation step
  enqueue exactly one onward data packet with the new returnToken
```

`forwardedHopLimit` is at most `message.hopLimit - 1`.\
If the egress peer's negotiated maximum is lower, the node lowers it further to that maximum.\
It never increases and every nonlocal forwarding operation consumes at least one.

An egress equal to ingress is rejected as `NEXT_HOP_UNAVAILABLE`; the node does not bounce a packet immediately back to the sender even if state is temporarily inconsistent.

### 9.4 Failure precedence

After wire/FSM validation, inbound routing commits the first failing condition in this order:

1. feasible-path source authorization -> `SOURCE_NOT_AUTHORIZED`;
2. selected destination/FIB lookup -> `NO_ROUTE`;
3. local binding capacity -> `QUEUE_FULL`, when the selected next hop is local;
4. transit capability -> `TRANSIT_DISABLED`;
5. remaining hop budget -> `HOP_LIMIT_EXCEEDED`;
6. exact egress usability and ingress inequality -> `NEXT_HOP_UNAVAILABLE`;
7. egress receive size -> `MESSAGE_TOO_LARGE`;
8. source-export barrier -> `SOURCE_NOT_ADVERTISED`;
9. breadcrumb/egress capacity -> `QUEUE_FULL`.

Exactly one failure transaction and at most one correlated ingress error are produced.\
This order is part of the executable protocol contract; it is not an implementation accident.

Return-token allocator usability is part of step 6.\
If no fresh token can be produced, the exact controller is terminated before admission and the outcome is `NEXT_HOP_UNAVAILABLE`, never `QUEUE_FULL`.\
The token's fixed encoded width means steps 7 and 9 know exact packet bytes before allocation.

### 9.5 Hop-limit outcomes

| Condition | Outcome |
|---|---|
| Destination resolves locally, `hopLimit >= 1` | Deliver locally without decrement |
| Nonlocal destination, `hopLimit > 1` | Forward with a strictly lower value |
| Nonlocal destination, `hopLimit <= 1` | Emit no onward packet; return `HOP_LIMIT_EXCEEDED` |
| Incoming value exceeds negotiated/schema bound | Protocol rejection before routing |

Ordered paths prevent stable control-plane loops.\
Hop limits independently bound data caught in transient loops while different nodes converge.

### 9.6 Route-miss outcomes

| Context | Required behavior |
|---|---|
| Local SDK send | Reject typed `NO_ROUTE`; reserve no wire slot; emit no packet |
| Received packet with no selected usable destination | Emit no onward packet; send correlated `NO_ROUTE` directly to ingress |
| Selected route loses next-hop resolution during admission | Treat as route miss/unavailable in the same transaction; emit no packet |

There is no implicit upstream, default route, flood, or broadcast.

---

## 10. Reverse delivery errors

### 10.1 Immediate failure

When a received data packet fails at the current node before an onward write, the node sends a nonfatal `error` directly on its ingress session.\
This response does not require a breadcrumb because the failing packet still identifies its current ingress.

The direct error uses a fresh error-envelope ID and sets:
```text
code           = first failure from the routing precedence
refId          = received data envelope.id
returnToken    = received data body.returnToken
failedAtNodeId = localNodeId
reason         = exact code-to-reason text defined by protocol section 7
extensions     = absent
```

The response uses reserved bounded control capacity.\
Failure to write it may terminate that session, but it never authorizes an onward data packet and never causes the error itself to be routed.

### 10.2 Breadcrumb admission

Every admitted peer egress creates a breadcrumb before the data write:

- local origin uses `ingress.kind = "local"`;
- transit records the exact ingress controller, public
  `(nodeId, owningSessionId)`, and the received `returnToken` as
  `upstreamReturnToken`;
- `(egressNodeId, egressSessionId)` is the public expected error-return
  session;
- `outboundReturnToken` is allocated by a per-controller non-reusing
  allocator and is written into the forwarded data body;
- expiry and capacity are fixed before admission.

If breadcrumb capacity is unavailable, the data packet is rejected before wire admission.\
A required reverse path cannot be added after the message has escaped.

The allocator never reuses a token during the lifetime of the exact controller.\
After emitting its terminal value it rejects the next allocation and replaces the session before wrap or reuse, so a delayed old error cannot resolve to a later breadcrumb after the old entry expires.\
This removes the ABA hazard without retaining unbounded message-ID tombstones.

### 10.3 Downstream error handling

```text
receiveError(error, session):
  require session is the exact live controller for this callback
  breadcrumb := ReverseCorrelations[(session.controllerIdentity, error.returnToken)]

  if breadcrumb absent or expired:
    discard as unreturnable
  else if error.refId != breadcrumb.messageId:
    send fatal INVALID_MESSAGE and terminate session without consuming breadcrumb
  else:
    consume breadcrumb exactly once
    if breadcrumb.ingress is local:
      publish local correlated failure
    else if exact recorded ingress controller is still live:
      relay a fresh error envelope directly to ingress
      preserve code, refId, failedAtNodeId, reason, and validated extensions
      replace only returnToken with breadcrumb.ingress.upstreamReturnToken
    else:
      discard as unreturnable
```

The token lookup and exact `refId` match both precede consumption.\
The relay envelope gets a fresh hop-local `id`.\
Its body preserves `code`, the now validated `refId`, the original `failedAtNodeId`, and `reason`; only `returnToken` is translated to the upstream hop.\
An intermediate node never replaces the reported failure with its own identity.

Breadcrumbs have no success acknowledgement, so unused entries expire.\
They are bounded by entry count and retained bytes and are discarded on node restart.\
Session teardown:

- removes breadcrumbs whose ingress has become unreturnable;
- converts breadcrumbs whose egress failed into
  `NEXT_HOP_UNAVAILABLE` where bounded control admission permits: a still-live
  session ingress receives a fresh error envelope using the stored upstream
  token, original message ID as `refId`, local node as `failedAtNodeId`,
  canonical reason, and absent extensions; a local origin receives the
  equivalent local outcome using the outbound token and no wire envelope; and
- removes every affected breadcrumb exactly once.

No error lookup uses the destination RIB.\
This prevents a missing-route error from failing recursively on the same missing route.

---

## 11. Atomic state and revision mechanics

### 11.1 Serialized executor

One node-state executor serializes:

- local binding add/remove;
- session establishment/termination;
- imported route replacement;
- route admission result;
- selected-route and next-hop changes;
- export ACK/rejection;
- data admission and capacity reservation;
- breadcrumb expiry/error consumption; and
- lifecycle stopping gates.

No asynchronous transport, policy, handler, or identity callback runs inside a transaction.\
Such work returns a tokenized command.\
The executor applies it only when the referenced binding/session/update token remains current.

### 11.2 Route transaction

For an affected endpoint set, one transaction computes:
```text
input mutation
-> Adj-RIB-In/local candidate delta
-> eligibility
-> selected Loc-RIB
-> forwarding projection
-> every affected desired Adj-RIB-Out
-> route/session/resource/event projections
-> one operations revision
```

Wire writes and application handler calls begin only after commit.\
Observers see the full before-state or full after-state, never an advertisement without its candidate, a selected route without forwarding, or a new forwarding entry with stale export state.

### 11.3 Data admission transaction

A data admission transaction:

1. captures the current operations revision;
2. validates source and selected destination against that revision;
3. resolves exact binding/session controller and pair-scoped public identity;
4. checks the return-token allocator and exact encoded packet size when peer
   egress is used;
5. reserves all required count and byte capacity;
6. allocates the next non-reusing return token as the final infallible
   reservation step and creates the breadcrumb when peer egress is used;
7. records the accepted/failed operational outcome; and
8. commits before scheduling handler or wire work.

If any fallible reservation fails, all reservations roll back before token allocation and no data is admitted.\
A token is never rolled back or reused.\
Later transport failure may produce a lost-after-admission outcome, but it cannot retroactively change the receipt's meaning.

### 11.4 Revision domains

| Revision | Owner | Reset/lifetime |
|---|---|---|
| Inbound route revision | One peer session, remote-generated | Starts at `1` for each new session |
| Outbound route revision | One peer session, local-generated | Starts at `1` for each new session |
| Operations revision | One node runtime | Monotonic for that process lifetime |
| Event sequence | One node operations store | Monotonic for that process lifetime |

Comparing values across domains has no meaning.\
A route ACK changes canonical export state at an operations revision but refers to its separate wire revision.\
Operations revisions, event sequences, and operation counters use the exact unsigned 64-bit decimal domains and the preflighted terminal barrier defined by `CORE-MONOTONIC-EXHAUSTION-1` in `sdk.md` section 5.2.\
Therefore no route or data transaction can commit a wrapped, imprecise, or silently saturated canonical revision.

---

## 12. Capacity and resource bounds

Every allocation has a configured or negotiated bound:

| Resource | Bound and failure behavior |
|---|---|
| Local bindings | Node capacity; reject `expose()` before mutation |
| Live sessions | Node capacity; reject/abort transport before session insertion |
| Routes per wire snapshot | Negotiated per session; sender never exceeds it |
| Encoded route update | Peer receive limit and control queue bound |
| Node path | Complete-path schema hard maximum plus negotiated/session maximum; every wire import/export reserves the receiver append |
| Adj-RIB-In routes | Per session and node-total candidate capacity |
| Candidate routes | Node-total capacity, evaluated using replacement rather than temporary double-counting |
| Selected/FIB entries | At most one each per reachable endpoint |
| Adj-RIB-Out routes | Peer negotiated snapshot count; canonical excess suppression |
| Outstanding export | One snapshot plus one latest coalesced desired set per session |
| Remote rejection retry | At most one timer record per current rejected tuple; injected clock and saturated configured backoff |
| Data queues | Count and encoded bytes per session plus node-total bounds |
| Export epochs | One current epoch plus bounded references held only by already admitted data |
| Handler work | Active count and bytes; no hidden backlog |
| Return-token allocator | One 64-bit monotonic domain per exact session controller, rendered as 16 lowercase hex characters; post-`ffffffffffffffff` allocation terminates that controller before reuse |
| Reverse breadcrumbs | Entry count, retained bytes, and expiry duration |
| Operations events/subscribers | Existing bounded buffers and gap semantics |

Capacity rejection must not depend on private iteration order.\
Canonical route ordering decides partial import/export subsets.\
Resource snapshots expose current, maximum, and high-water values from the same committed state.

---

## 13. Session and topology failure

Session termination is one canonical routing transaction:
```text
mark exact session non-Established
-> remove its complete Adj-RIB-In
-> remove/close its outbound snapshot state
-> invalidate its next-hop resolutions
-> recompute affected candidate eligibility and selection
-> promote alternate paths where available
-> remove or replace forwarding
-> recompute exports to every remaining peer
-> resolve/remove affected breadcrumbs
-> commit one operations revision
```

Later callbacks from the terminated controller are ignored by exact object identity even if a new controller eventually receives the same pair-scoped `(remoteNodeId, owningSessionId)`.

The configured adjacency supervisor may later dial a new transport.\
The new session has fresh inbound and outbound revision streams and receives/sends complete authoritative snapshots.\
No learned route or ACK state survives as live truth across that replacement.

Expected topology behavior follows directly:

- in a line, an origin path grows by one node per transit exporter;
- in a triangle, receiver-in-path rejection prevents a stable route loop;
- in a diamond, loss of the selected candidate atomically promotes the
  deterministic alternate and propagates a replacement snapshot; and
- during convergence, hop limits bound any transient data loop.

---

## 14. Sovereign contract ownership

This design does not create an alternate inline schema authority.\
The named objects used here map one-to-one to the package-owned schemas required by [`contracts.md`](contracts.md):

| Design object | Sovereign schema owner |
|---|---|
| `RouteKey`, `RouteAdvertisement` | `@agp/protocol` routing schemas |
| Node path and endpoint source | `@agp/protocol` common/wire schemas |
| Route update, ACK, rejection, data, and error | `@agp/protocol` wire schemas |
| Advertisement, candidate, selected, next hop, forwarding | `@agp/core` operations schemas |
| Route import/export and reverse correlation state | `@agp/core` operations schemas |
| Capacity, limits, transit, and route admission | `@agp/core` configuration schemas |
| Management route/advertisement/forwarding responses | `@agp/management-http`, referencing exact core URNs |

The TypeScript shapes in this document explain relationships; generated public DTOs and runtime validators derive from those sovereign documents.\
Temporal rules-revision order, exact session ownership, atomic replacement, path endpoint identity, and breadcrumb correlation-require named semantic-rule tests because JSON Schema cannot prove them.

---

## 15. Mechanics, rationale, and consequence

### Mechanics

1. Every node turns local bindings and accepted per-peer snapshots into one
   candidate RIB.
2. A public total comparator selects one eligible route per endpoint.
3. Selection and next-hop resolution atomically create the Loc-RIB and
   forwarding projection.
4. Each peer receives a bounded authoritative snapshot of exportable selected
   routes.
5. Ordered paths reject stable control-plane loops; hop limits bound transient
   data loops.
6. Feasible-ingress routes authorize sources without requiring the selected
   reverse path.
7. Local and transit data use the same selected RIB and fail closed.
8. Reverse breadcrumbs return downstream failures without routing the error.
9. All state and resource consequences commit at one node operations revision.

### Rationale

A uniform runtime is meaningful only if every instance can independently answer why a message may be delivered or forwarded.\
Per-peer authoritative imports give the node bounded adjacent truth; deterministic selection converts that truth into one local decision; selected-route export permits transit without exchanging every candidate; path provenance and source-export ACKs let the next node validate both reachability and source authority.

Whole-set snapshots retain the MVP's strongest simplification: loss, omission, and rejection have unambiguous withdrawal semantics without delta replay state.\
Separating wire paths, local-complete selected paths, and immediate next hops preserves final origin while keeping forwarding tied to a concrete live adjacency.

Atomic derivation makes the SDK, HTTP, CLI, and data path observe the same truth.\
Bounded direct error return makes route failure useful to the source without assuming that the failed destination route can carry its own error.

### Consequence of violation

- Treating a peer as an implicit default recreates hub/spoke behavior and lets
  data bypass local routing truth.
- Equating the immediate peer with final origin loses multi-hop provenance and
  makes source authorization ambiguous.
- Installing a received path without appending the local node makes later loop
  checks incomplete; appending twice corrupts path distance and export.
- Selecting by arrival time, random route ID, or map order makes convergence
  nondeterministic across equivalent nodes.
- Exporting unselected or peer-containing paths permits routing oscillation or
  stable loops.
- Sending data before the source route is ACKed at egress causes the next node
  either to reject legitimate traffic or weaken spoof protection.
- Selected-reverse-path-only authorization rejects valid asymmetric ingress;
  endpoint-string-only authorization accepts spoofed origins.
- Routing an error can recurse on the same route miss; accepting an error from
  an unrecorded egress permits false failure injection.
- Committing import, selection, forwarding, and export separately exposes
  impossible intermediate state and admits data against stale routes.
- Restoring learned routes, sessions, ACKs, or breadcrumbs after restart
  creates phantom reachability contrary to the state-lifetime boundary.
- Hiding capacity decisions outside canonical ordering makes overload behavior
  timing-dependent and operationally irreproducible.
