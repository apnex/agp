# AGP uniform node - symmetric protocol and session design

> **Status:** Ratified. Current packet and adjacency contract.\
> Gate definitions are in [`verification.md`](verification.md).

## 1. Mandate

AGP v1 is a symmetric peer protocol carried over the neutral packet-channel profile in [`transport-contract.md`](transport-contract.md).\
Either side of an established adjacency may send and receive route snapshots, acknowledgements, data, correlated errors, and keepalives.\
The internal acquisition record (`kind: dial | accept`) controls only which local supervisor owns reconnect; it grants no protocol authority.\
Public operations derive `direction: outbound | inbound` from that record by the fixed mapping `dial -> outbound`, `accept -> inbound`; the projection is evidence, never an input to protocol behavior.

This document never defines carrier framing, negotiation, addresses, compression, security acquisition, or native termination.\
WebSocket maps this protocol through [`binding-websocket.md`](binding-websocket.md); Loopback maps it through [`transport-loopback.md`](transport-loopback.md).\
Neither mapping changes a legal AGP packet or session transition.

The replacement keeps the BGP-inspired connection states:
```text
Idle -> Connect / Active -> OpenSent -> OpenConfirm -> Established
```

Role-specific actions and message legality are removed.

---

## 2. Packet and envelope language

One AGP packet is one complete bounded byte sequence containing exactly one UTF-8 JSON document.\
The protocol codec-not the transport-owns:

1. UTF-8 encoding and fatal decoding;
2. encoded-byte limits before JSON allocation;
3. duplicate-member and numeric-profile preflight;
4. JSON parsing and closed-schema validation;
5. contextual semantic rules; and
6. encoding one validated envelope into one immutable packet.

The transport preserves packet bytes and boundaries without interpreting them.\
It may reject a record that cannot become a bounded packet, but native rejection codes remain binding-private.\
The same packet bytes are valid over WebSocket or Loopback.

Every packet document has this closed envelope:
```ts
interface Envelope<TPlane, TType, TBody> {
  agp: 1;
  plane: TPlane;
  type: TType;
  id: MessageId;
  body: TBody;
  extensions?: Extensions;
}
```

`ReturnToken` is a sovereign semantic scalar distinct from `MessageId`.\
Its wire representation is exactly 16 lowercase hexadecimal characters (`^[0-9a-f]{16}$`), representing one unsigned 64-bit value in fixed-width big-endian lexical form.\
It is a hop-scoped correlation handle, not message identity or an authenticator.

The complete v1 language is:

| Plane | Type | Direction in `Established` |
|---|---|---|
| control | `open` | both send during handshake |
| control | `keepalive` | symmetric |
| control | `route.update` | symmetric |
| control | `route.ack` | symmetric |
| control | `notification` | symmetric, fatal |
| control | `error` | symmetric, nonfatal and correlated |
| data | `message` | symmetric |

`endpoint.update`, `endpoint.ack`, protocol `role`, and role-mismatch errors are removed.

---

## 3. OPEN

```ts
interface OpenBody {
  nodeId: NodeId;
  sessionId: SessionId;
  holdTimeMs: number;
  receiveLimitBytes: number;
  maxRoutesPerSnapshot: number;
  maxPathLength: number;
  maxDataHopLimit: number;
  transit: boolean;
}
```

Rules:

1. `sessionId` is exactly six lowercase hexadecimal characters
   (`^[0-9a-f]{6}$`).
2. Before remote identity is authoritative, the locally issued ID is reserved
   node-wide against every retained controller. It is then only the
   `localSessionId` of a pre-identity controller, not a public peer-session
   identity. Identity admission atomically checks the candidate remote pair,
   releases the node-wide reservation, and admits the ordinary pair-scoped
   identity. After admission, a locally issued ID is unique only among
   concurrently retained controllers for the same local/remote node pair.
   Public local session lookup identity is `(remoteNodeId, localSessionId)`;
   private ownership additionally requires exact controller identity.
3. Remote session identity is `(remoteNodeId, remoteSessionId)`.
4. An outbound configured peer must present the configured
   `expectedNodeId`.
5. Identity admission runs for both accepted and initiated channels and
   receives immutable evidence observed by the acquiring transport.
6. The local and remote receive/route/path/hop limits negotiate to the lower
   safe bound.
7. `maxPathLength` is the maximum complete path the receiver may install,
   including the receiver's one appended node ID.
8. `transit: false` means the node exports local selected routes only and will
   not forward a nonlocal destination.
9. Same-node adjacency is invalid.

All target v1 peers support symmetric selected-path-vector exchange, reverse errors, and data hop limits; these are not optional capability bits.

Before the successful identity-admission commit, an observed or claimed OPEN `nodeId` is never projected as `remoteNodeId`.\
Canonical operations instead publish the sovereign `PreIdentityControllerSnapshot`, keyed only by its temporarily node-wide `localSessionId`.\
The admission commit atomically replaces that record with one admitted, pair-scoped `SessionSnapshot`.\
Teardown before that commit emits exactly one `connection.preidentity-closed` operational event and never `session.closed`; teardown after that commit emits exactly one pair-scoped `session.closed`.\
The pre-identity event may carry the local session ID, public direction, closed reason, and neutral transport terminal, but no claimed, expected, or invented remote identity.

---

## 4. Authoritative route snapshots

### 4.1 Wire route

```ts
interface RouteAdvertisement {
  endpoint: EndpointName;
  originNodeId: NodeId;
  path: readonly NodeId[];
}
```

Path convention:

- a locally originated route is `[originNodeId]`;
- the last path entry is always the node advertising this wire route;
- a receiver appends its own node ID once when constructing the imported
  candidate; exporting later copies that complete selected path;
- the receiver is not yet part of the wire path.

Semantic rules:

1. `path.length >= 1`;
2. `path[0] === originNodeId`;
3. `path[path.length - 1] === admittedRemoteNodeId`;
4. every path entry is unique;
5. routes are canonically sorted by endpoint, origin node, then path;
6. at most one route for an endpoint appears in a snapshot.

A malformed origin/sender relationship, repeated path element, or duplicate endpoint makes the snapshot ambiguous and is a fatal protocol violation.\
A structurally valid route containing `localNodeId` is instead rejected as `LOOP`.\
For negotiated `maxPathLength = M`, a route is rejected as `PATH_TOO_LONG` exactly when `path.length + 1 > M`; the `+ 1` reserves the receiver append.\
Equality is accepted, producing a complete candidate path of length `M`.\
Neither rejected route enters Adj-RIB-In.

### 4.2 Update

```ts
interface RouteUpdateBody {
  revision: WireRevision;
  routes: readonly RouteAdvertisement[];
}
```

Each session owns two independent revision streams: local outbound and remote inbound.\
The first revision is `1`; each later consumed revision is exactly one higher.

`WireRevision` has a schema-defined safe maximum.\
If another changed snapshot would require a value above it, the sender closes the session with `CEASE`; reconnection creates fresh revision streams and exchanges complete snapshots.\
Revision values never wrap.

An update is the sender's complete route set for that adjacency.\
Processing is:

1. validate envelope/schema/negotiated bounds;
2. validate revision sequence;
3. evaluate every route against path and import admission;
4. build the complete accepted set;
5. atomically replace this session's Adj-RIB-In with the accepted set;
6. omission or rejection withdraws the prior corresponding route;
7. recompute selection, forwarding, and exports;
8. commit canonical state;
9. send `route.ack`.

No separate withdrawal message exists.

### 4.3 Acknowledgement

```ts
interface RouteRejection {
  endpoint: EndpointName;
  originNodeId: NodeId;
  reasonCode:
    | "LOOP"
    | "PATH_TOO_LONG"
    | "POLICY"
    | "CAPACITY";
}

interface RouteAckBody {
  refId: MessageId;
  revision: WireRevision;
  rejected: readonly RouteRejection[];
}
```

An ACK is valid only when:

1. `refId` and revision match the one outstanding snapshot;
2. rejection entries are unique, canonical, and each identifies a route in
   that exact snapshot;
3. every non-rejected outstanding route is accepted; no result is omitted.

The accepted set is derived as `outstanding.routes - rejected`; there is no redundant accepted count that can disagree.\
The revision is consumed even when every route is rejected.\
The sender tracks one outstanding snapshot and one coalesced desired successor.\
Invalid ACK correlation or contents are fatal.\
ACK timeout terminates the session rather than creating an ambiguous retransmission stream.

---

## 5. Selected-route export

Adj-RIB-Out for peer `P` contains:

1. every selected active local route;
2. selected learned routes only when local transit is enabled;
3. no route whose selected path already contains `P`;
4. no unselected candidate;
5. no route for which `selected.path.length + 1` exceeds `P`'s negotiated
   `maxPathLength`; and
6. no route whose source binding/session is no longer usable.

An exported learned route uses the selected path through the exporting node.\
The exporter does not prepend policy attributes or advertise multiple candidates in v1.

Export readiness is per peer.\
The operational projection distinguishes `desired`, `outstanding`, `acked`, `rejected`, and `suppressed`; there is no node-wide boolean that pretends all peers converged together.

`suppressed` is a local export decision, not a route in a wire snapshot.\
Its reason is exactly one of `TRANSIT_DISABLED`, `PEER_IN_PATH`, `PATH_TOO_LONG`, or `CAPACITY`.\
`rejected` means the peer rejected a route in an exact outstanding snapshot; it retains that peer's exact `LOOP`, `PATH_TOO_LONG`, `POLICY`, or `CAPACITY` rejection code and revision.\
Only `acked` satisfies data source readiness.

A peer rejection is remembered against the exact exported `(endpoint, originNodeId, path)` tuple on that exact session.\
While the current derivation is the same tuple, it remains operationally `rejected`, is omitted from unrelated desired wire snapshots, and is never reclassified as locally `suppressed`.

Recovery is code-specific:

- `LOOP` and `PATH_TOO_LONG` have no timer retry. A changed path tuple is
  immediately `desired`; session replacement also clears the rejection.
- `POLICY` and `CAPACITY` use the effective local
  `routeRejectionRetry.initialMs` and `routeRejectionRetry.maxMs`
  configuration. The raw object/fields may be omitted and resolve to `1000`
  and `30000`; both effective values are positive safe integers and
  `maxMs >= initialMs`. After rejection number `r` for the unchanged tuple,
  starting at `r = 0`, retry is due after
  `min(maxMs, initialMs * 2^r)` milliseconds, with saturating arithmetic.
  At expiry, the still-current exportable tuple becomes `desired` and enters
  the next full snapshot (or the one coalesced successor); another rejection
  increments `r`. Acceptance, tuple removal/change, or exact session teardown
  cancels and clears the retry state.

This is the only unchanged-tuple retry mechanism in v1.\
It prevents an ACK/recompute tight loop while allowing remote policy or capacity recovery to converge under an injected monotonic clock.

### 5.1 Route/data write ordering

Every peer has one serialized envelope writer with dependency barriers:

1. data requiring a new source route cannot be admitted until the exact source
   identity is ACKed;
2. a full snapshot that omits an ACKed source identity, or replaces it with a
   different origin, cannot overtake data already admitted under that export
   epoch;
3. the routing transaction first closes that epoch to new data, the bounded
   writer drains its already admitted packets, then writes the withdrawing
   snapshot;
4. failure or deadline expiry tears down the session and discards the bounded
   remainder rather than violating the ordering.

The mandatory packet-channel FIFO guarantee then ensures that the receiver sees admitted data before the source withdrawal that would make it fail feasible-path authorization.

---

## 6. Data message

```ts
interface EndpointSource {
  endpoint: EndpointName;
  originNodeId: NodeId;
}

interface DataBody {
  source: EndpointSource;
  destination: EndpointName;
  correlationId?: CorrelationId;
  returnToken: ReturnToken;
  hopLimit: number;
  payload: JsonObject;
}
```

The source node stamps its own node ID.\
This disambiguates identical endpoint names originated by different nodes and permits feasible-path source validation without requiring a globally meaningful origin session ID.

For a locally originated data message, the node creates a high-entropy envelope `MessageId` through its injected ID source.\
Forwarders preserve that end-to-end message identity.

Every exact peer controller owns a `ReturnTokenAllocator`.\
Production initialization sets its unsigned 64-bit `next` value to `0` and `exhausted = false`.\
Allocation returns `next` as 16-character lowercase hex.\
If that value is `ffffffffffffffff`, allocation sets `exhausted = true`; otherwise it increments `next` by one.\
Gaps are allowed but rollback or reuse is forbidden.\
A test may inject a smaller allocator implementing the same `token | exhausted` result contract so the terminal branch is executable.

The token is opaque to the peer and MUST NOT repeat during the lifetime of the exact egress session controller.\
Because the field has fixed encoded width, packet size is known before its value is reserved.\
Allocation is the final infallible step after the serialized executor has checked `exhausted = false` and reserved all other capacity.\
This gives reverse correlation an ABA-safe identity without requiring envelope message IDs to be deployment-global.

An exact egress whose allocator cannot produce a fresh token is no longer usable: the controller is terminated and replacement is delegated to the adjacency supervisor.\
Admission therefore reports `NEXT_HOP_UNAVAILABLE`; token exhaustion is never reported as queue pressure.

This check is feasible-path RPF: the source identity must be reachable through the actual ingress candidate, but that candidate need not be the selected reverse route.

Origin admission:

1. source binding is active;
2. the source route is selected local;
3. destination has a selected usable forwarding entry;
4. local destination capacity is reserved, or for peer egress the encoded packet
   fits the egress receive bound;
5. for peer egress, the source route is ACKed in that peer's Adj-RIB-Out;
6. `hopLimit` is the configured default and within the egress bound;
7. breadcrumb and destination capacity are reserved, then the next egress
   `returnToken` is allocated as the final infallible reservation step before
   success.

If the source export is not acknowledged, `send()` rejects `SOURCE_NOT_ADVERTISED` without a data write.\
AGP v1 does not hide route convergence behind an unbounded pending-send queue.

Transit admission:

1. ingress session is `Established`;
2. ingress owns an eligible Adj-RIB-In route matching
   `(source.endpoint, source.originNodeId)`;
3. the source route is not required to be the receiver's selected source path;
4. destination resolves through the selected RIB;
5. a local destination is delivered without requiring transit or decrement;
6. nonlocal forwarding requires `transit: true`;
7. nonlocal forwarding requires `hopLimit > 1`;
8. egress is an `Established` session other than ingress with a usable
   return-token allocator;
9. the encoded packet fits the egress peer's receive bound;
10. a selected exported route for the same source identity is ACKed in the
   egress peer's Adj-RIB-Out, so the next node can authorize it; it need not be
   the same candidate/path as the feasible ingress route;
11. breadcrumb plus egress queue capacity are reserved and the next
    non-reusing egress `returnToken` is allocated as the final infallible
    reservation step;
12. the forwarded message decrements `hopLimit` once and, if necessary, caps it
   to the egress peer's lower negotiated maximum.

That order is the failure precedence after schema/FSM admission:
```text
SOURCE_NOT_AUTHORIZED
-> NO_ROUTE
-> local QUEUE_FULL, or:
  TRANSIT_DISABLED
  -> HOP_LIMIT_EXCEEDED
  -> NEXT_HOP_UNAVAILABLE
  -> MESSAGE_TOO_LARGE
  -> SOURCE_NOT_ADVERTISED
  -> QUEUE_FULL
```

Exactly one outcome is committed for a packet; later checks do not overwrite an earlier failure.

Local delivery does not consume another hop.\
Forwarding preserves the envelope `id`, `extensions`, source, destination, correlation, and payload.\
It replaces `returnToken` with the newly allocated hop token and changes only `hopLimit` otherwise.

---

## 7. Correlated reverse errors

```ts
interface DeliveryErrorBody {
  code:
    | "NO_ROUTE"
    | "HOP_LIMIT_EXCEEDED"
    | "SOURCE_NOT_AUTHORIZED"
    | "SOURCE_NOT_ADVERTISED"
    | "TRANSIT_DISABLED"
    | "NEXT_HOP_UNAVAILABLE"
    | "MESSAGE_TOO_LARGE"
    | "QUEUE_FULL";
  refId: MessageId;
  returnToken: ReturnToken;
  failedAtNodeId: NodeId;
  reason: string;
}
```

The canonical locally generated `reason` text is closed:

| `code` | `reason` |
|---|---|
| `NO_ROUTE` | `no selected route` |
| `HOP_LIMIT_EXCEEDED` | `hop limit exhausted` |
| `SOURCE_NOT_AUTHORIZED` | `source not authorized on ingress` |
| `SOURCE_NOT_ADVERTISED` | `source route not acknowledged by egress` |
| `TRANSIT_DISABLED` | `transit disabled` |
| `NEXT_HOP_UNAVAILABLE` | `selected next hop unavailable` |
| `MESSAGE_TOO_LARGE` | `message exceeds egress receive limit` |
| `QUEUE_FULL` | `required bounded capacity unavailable` |

Errors never perform a RIB lookup.

Each admitted peer egress creates a bounded breadcrumb:
```ts
interface ReverseCorrelation {
  messageId: MessageId;
  outboundReturnToken: ReturnToken;
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
  expiresAt: Timestamp;
}
```

Private breadcrumb lookup is keyed by the exact egress controller object and `outboundReturnToken`, not by the pair-scoped six-hex session string or end-to-end message ID.\
Public egress identity is `(egressNodeId, egressSessionId)`.\
Because an exact controller never reuses a token, an expired or consumed breadcrumb cannot be confused with a later message (the ABA case).

An immediate error generated for an admitted peer data packet is constructed exactly as follows:

1. the error envelope receives a fresh hop-local envelope `id`;
2. `refId` is the failing data envelope `id`;
3. `returnToken` is copied from the failing data body;
4. `failedAtNodeId` is the local node;
5. `code` is the first failure selected by the admission precedence;
6. `reason` is a bounded canonical protocol reason, never a raw exception; and
7. `extensions` is absent on a locally generated error.

An error is accepted only when its `returnToken` resolves on the exact controller from which it arrived and `refId === breadcrumb.messageId`.\
An unknown or expired token is discarded as unreturnable.\
A token hit with a mismatched `refId` is fatal `INVALID_MESSAGE`; it does not consume the breadcrumb, and normal exact-session teardown resolves that state.\
After both fields validate, the breadcrumb is consumed atomically exactly once.\
A local ingress publishes the complete error body.\
A session ingress relays a new error envelope directly to the exact controller recorded by `(nodeId, owningSessionId)` plus private identity, preserving `code`, `refId`, `failedAtNodeId`, `reason`, and any validated received `extensions`, while replacing only `returnToken` with the breadcrumb's `upstreamReturnToken`.\
The relay envelope receives a fresh hop-local `id`.

If a breadcrumb or ingress session has expired, the error is discarded as unreturnable and cannot recurse.

If the expected egress controller terminates, each affected breadcrumb is consumed exactly once.\
A still-live session ingress receives a locally generated `NEXT_HOP_UNAVAILABLE` with a fresh envelope `id`, original data envelope ID as `refId`, stored `upstreamReturnToken` as `returnToken`, local node as `failedAtNodeId`, the canonical reason above, and no `extensions`.\
A local ingress publishes the equivalent local failure using its `outboundReturnToken`; it does not emit another wire envelope.\
Failure to reserve bounded control capacity makes the result unreturnable rather than recursive.

Route-miss behavior is therefore:

| Origin | Behavior |
|---|---|
| Local SDK send | Reject typed `NO_ROUTE`; emit no data packet |
| Received transit message | Emit no onward data packet; send `NO_ROUTE` directly to ingress |
| Downstream returned error | Relay over reverse breadcrumb; never route |

---

## 8. Uniform session FSM

### 8.1 Separation of concerns

| Concern | Owner |
|---|---|
| Connection FSM, protocol timers, parse/order rules | `PeerSession` |
| Configured outbound retry and desired adjacency | `AdjacencySupervisor` |
| Accepted packet-channel acquisition | Node listener |
| Route import/export transaction | Node routing executor |
| Packet capacity and ordered writes | Per-session queues plus the transport profile |

Reconnect is not an FSM role branch.\
When an initiated channel terminates, its configured adjacency supervisor decides whether and when to connect again.

### 8.2 Established message matrix

Both inbound and outbound sessions:

- send and receive `keepalive`;
- send and receive `route.update`;
- send and receive `route.ack`;
- send, receive, and transit `message`;
- send, receive, and relay `error`;
- receive a fatal `notification` and terminate;
- withdraw all locally owned imported state on termination.

Each session snapshot carries independent `routeImport` and `routeExport` state.\
The old mutually exclusive hub/spoke endpoint-state union is removed.

### 8.3 Cross-dial collision

Exactly one live adjacency is retained per remote node.

For each physical connection, both endpoints construct the same oriented collision tuple:
```text
(
  initiatorNodeId,
  (lowerNodeId, sessionId issued by lowerNodeId on this connection),
  (higherNodeId, sessionId issued by higherNodeId on this connection)
)
```

Node and session strings are compared as unsigned UTF-8 bytes.\
Orientation is by node ID, never by the observer's local/remote perspective.

After admitted OPEN:

1. if only one eligible connection exists, retain it regardless of direction;
2. if duplicates have different initiators, the connection initiated by the
   lexically higher node wins;
3. both endpoints therefore retain the same physical connection: higher-node
   outbound / lower-node inbound;
4. duplicates with the same initiator are ordered by the two oriented
   `(nodeId, sessionId)` members above; the lexically lower pair wins;
5. an already `Established` connection is retained only when it is that
   canonical winner; equal tuples are impossible under pair-scoped live
   session-ID uniqueness;
6. losers receive `ADJACENCY_COLLISION` and close;
7. an outbound supervisor does not redial while a winning session to that node
   exists.

The outcome is independent of connection arrival timing.

---

## 9. Fatal versus recoverable failures

The exact fatal notification codes are:
```text
CEASE
UNSUPPORTED_VERSION
INVALID_MESSAGE
UNEXPECTED_MESSAGE
IDENTITY_REJECTED
ADJACENCY_COLLISION
HOLD_TIMEOUT
ROUTE_REVISION_ERROR
INTERNAL_ERROR
```

Locally detected fatal conditions map exactly:

| Condition | Notification code |
|---|---|
| Administrative stop, outbound wire-revision exhaustion, or finite route writer/ACK deadline expiry | `CEASE` |
| Structurally readable envelope with an unsupported `agp` version | `UNSUPPORTED_VERSION` |
| Invalid UTF-8/JSON/schema, duplicate JSON members, invalid numeric profile, negotiated byte/count violation, forged/duplicate/repeated route semantics, invalid ACK contents/correlation, or delivery-error `refId` mismatch | `INVALID_MESSAGE` |
| Schema-valid known message illegal in the current FSM state | `UNEXPECTED_MESSAGE` |
| Same-node OPEN, expected-node mismatch, duplicate pair-scoped session ID, or identity-admission denial | `IDENTITY_REJECTED` |
| Noncanonical duplicate adjacency selected by section 8.3 | `ADJACENCY_COLLISION` |
| Open-confirm or established hold timer expiry | `HOLD_TIMEOUT` |
| Inbound route-update revision is not exactly next, or inbound revision attempts rollover | `ROUTE_REVISION_ERROR` |
| Local admission continuation fault or otherwise unclassified invariant failure | `INTERNAL_ERROR` |

Detection uses the first applicable row after the minimum safe parse needed to classify it.\
`INTERNAL_ERROR` never substitutes for known peer input failure.\
If a valid notification cannot be safely encoded or admitted to bounded control capacity, the session closes without one.

OpenSent admission/open expiry invalidates the unfinished admission and closes without a notification, matching the FSM; no admitted peer identity yet exists to receive a classified protocol fault.

Recoverable data/control outcomes include:

- route policy/loop rejection within an otherwise valid snapshot;
- feasible-path source authorization failure;
- route miss;
- hop exhaustion;
- unavailable next hop;
- queue saturation;
- local application handler failure is operational evidence, not a wire
  delivery result after admission.

Fatal teardown purges session-owned routes before later affected data is admitted.

---

## 10. Mechanics, rationale, and consequence

### Mechanics

One carrier-independent symmetric FSM and message matrix replace role branches.\
Authoritative selected-route snapshots build per-peer RIB state; ordered paths prevent stable control-plane loops; hop limits bound transient data loops; reverse breadcrumbs return failures without depending on reachability.\
The protocol codec consumes and emits opaque packets through the one mandatory transport profile.

### Rationale

A node cannot consult a meaningful local RIB unless peers tell it what they can reach.\
Symmetric full snapshots are the smallest extension of the current whole-set revision model that enables multi-hop while retaining deterministic withdrawal and bounded state.

### Consequence of violation

- Role-gated messages recreate separate hub/spoke behavior.
- Delta updates introduce ordering/replay complexity not selected for v1.
- Missing origin/path data makes transit provenance and loop rejection
  impossible.
- Routed error responses can fail recursively on the same missing route.
- Source validation against only the selected reverse path rejects legitimate
  alternate/asymmetric ingress.
- Branching on carrier kind or native termination makes the protocol
  non-substitutable.
- Letting Loopback exchange decoded objects bypasses the sovereign packet
  language and creates a second protocol.
