# AGP uniform node - decision register

## 1. Status

This register distinguishes stakeholder intent from the design choices that realize it.\
The stakeholder authorized autonomous implementation after design completion and validation on 2026-07-30; the completed design choices below are therefore ratified implementation authority.

| ID | Decision | Authority | Status |
|---|---|---|---|
| D1 | One `AgpNode` implementation and sole `createNode()` factory | Confirmed survey | Required |
| D2 | Replace AGP v1 in place; no old-peer or old-factory compatibility | Confirmed survey follow-up | Required |
| D3 | Every named public data-only DTO has a sovereign schema | Stakeholder direction | Required |
| D4 | Exchange authoritative full per-peer selected-route snapshots | Design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D5 | Carry final origin and ordered node path; keep session IDs node-local | Confirmed identity constraint + design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D6 | Select one route deterministically: local, shortest path, lexical ties | Design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D7 | Authorize data by feasible ingress and acknowledged source export | Design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D8 | Return errors through bounded reverse breadcrumbs, never the RIB | Survey Q5(c) + design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D9 | Treat live sessions and RIB state as ephemeral/derived | Applicable-axiom boundary + protocol safety + stakeholder implementation authorization 2026-07-30 | Ratified |
| D10 | Commit each routing change as one canonical operations revision | Survey Q2(b) + design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D11 | Resolve simultaneous cross-dial using a deterministic canonical dialer | Design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D12 | Preserve read-only management paths and CLI verbs where truthful | Survey Q6(c) | Required |
| D13 | Treat each `AgpNode` runtime instance as one-shot | Design + stakeholder implementation authorization 2026-07-30 | Ratified |
| D14 | Place one reliable, ordered, duplicate-free, bounded packet-channel contract beneath every AGP session | Fixed transport intent + explicit design approval 2026-07-30 | Ratified |
| D15 | Keep concrete transport configuration outside core and pass adapter-observed peer evidence into identity admission | Fixed transport intent + design | Ratified |
| D16 | Make AGP v1 over WebSocket a sovereign binding outside the protocol kernel | Fixed transport intent + design | Ratified |
| D17 | Make Loopback a canonical production transport for process-local AGP topologies | Explicit stakeholder approval 2026-07-30 | Ratified |
| D18 | Provide confidentiality and peer authentication through a pre-shared-key transport profile, without certificate infrastructure | Explicit stakeholder direction | Ratified |
| D19 | Govern per-hop admission with two-dimension credit the receiver grants and the sender may not exceed | Explicit stakeholder direction | Ratified |

---

## 2. Confirmed intent

Every decision below realizes intent that was confirmed by the project owner before design began.\
That intent is recorded here rather than in a separate survey artifact, so a reader reaches the authority from the decision it authorizes.

### 2.1 Composite intent envelope

Replace AGP's behaviorally separate hub router and spoke client with one `AgpNode` runtime created through `createNode()`.\
Configuration may make a node listen, dial configured adjacencies, expose endpoints, and permit or deny transit, but these are capabilities of the same implementation rather than protocol roles backed by different code.\
Topologies are assembled by composing identical node instances; terms such as hub, spoke, edge, or transit describe a node's configured placement and adjacencies only.

The control plane is symmetric.\
Nodes exchange endpoint routes in both directions and export their selected routes, including selected learned routes needed for transit.\
Each route retains final origin separately from its immediate next-hop session and carries an ordered node path sufficient to reject control-plane loops.

Every locally originated or received data message consults the same local selected RIB.\
A local route miss rejects before wire admission; a transit route miss produces no onward data packet and returns a correlated nonfatal error toward the source.

This is a coordinated replacement, not a compatibility-facade migration.\
AGP v1 is rewritten in place to the symmetric target state, and interoperability with the old v1 language is explicitly not required.

### 2.2 Confirmed intent by question

The confirmed answers below are the authority cited by `authorities[].kind` of `survey` in [`design/traceability.json`](design/traceability.json).

| Ref | Confirmed intent |
|---|---|
| `Q1(b)` | Every data path is gated by the local selected RIB |
| `Q1/Q3/Q6` | One uniform node runtime, created through a single `createNode()` factory, with a stable operational surface |
| `Q4(a)` | Either side of an adjacency may exchange endpoint routes |
| `Q4(b)` | A selected learned route may be exported to other peers for multi-hop transit |
| `Q4(c)` | Ordered path provenance rejects control-plane loops |
| `Q5(a)` | A local route miss rejects before wire admission |
| `Q5(b)` | A transit route miss emits no onward data packet |
| `Q5(c)` | A correlated nonfatal failure travels back toward the source |
| `Q6(c)` | Management HTTP and `agpctl` remain stable where their semantics remain true |
| Aggregate | Listener, dialer, local delivery, and transit behavior compose inside the same implementation |

### 2.3 Confirmed transport security intent

AGP is expected to run over the public internet.\
No other encryption layer may be assumed present, so the transport provides its own confidentiality rather than relying on a mesh, tunnel, or trusted network.

Dedicated certificate infrastructure is explicitly excluded.\
A deployment must be able to secure a topology with distributed key material alone, with no certificate authority, issuance, expiry, or revocation machinery.

Encryption is a transport concern.\
The AGP control plane has no knowledge of, and no responsibility for, how a channel is protected; it consumes only the observed evidence that a channel reports.

The target scale is small and known: fewer than twenty nodes, in star and line topologies.

### 2.4 Governing principles

Three principles anchor the design and outrank convenience:

- **One node abstraction.** Topology differences arise from configuration, never
  from a second implementation.
- **No selected route means no forwarding.** Every forwarding outcome is
  justified by local canonical route state.
- **Loop-safe selected-route propagation.** Operational views expose that same
  state rather than reconstructing it independently.

### 2.5 Confirmed anti-goals

These were excluded at intent capture, not discovered later.\
Their re-entry conditions are held in [`design/mechanisms.md`](design/mechanisms.md) as `F01` through `F07`.

| Excluded | Reason |
|---|---|
| Multiple eligible-path export, metrics, and policy-based selection | Deferred to a future routing-policy phase |
| A uniform runtime that still uses an implicit default route to one central node | Superseded by symmetric route exchange; it would be a cosmetic unification |
| Long-lived `createRouter()` or `createSpoke()` compatibility facades | Authority explicitly removed compatibility as a constraint |
| Redesigning management HTTP or `agpctl` merely because the runtime changed | Operators are protected consumers; change only on proven semantic mismatch |
| Compatibility negotiation with the old AGP v1 wire behavior | v1 is replaced in place by authority |

---

## 3. Decision records

### D1 - Uniform node

**Mechanics.**\
`listen`, configured peers, local endpoint exposure, and transit are independent capabilities of the same runtime.\
Inbound and outbound sessions use one `PeerSession`.

**Rationale.**\
A topology position is deployment configuration, not a protocol identity or a reason to fork routing behavior.

**Consequence.**\
Reintroducing role-gated message legality or separate hub/spoke data paths violates the design even if both are exported through a factory named `createNode()`.

### D2 - In-place v1 replacement

**Mechanics.**\
The AGP packet discriminator remains `agp: 1`; the WebSocket binding token remains `agp.v1` but is no longer a kernel identifier.\
The role-bearing language, old factories, and WebSocket-shaped transport SPI are replaced together.\
Mixed old and new peers are unsupported.

**Rationale.**\
The stakeholder explicitly removed compatibility as a constraint and preferred one coherent cutover.

**Consequence.**\
No compatibility shim, dual FSM, legacy capability negotiation, or v2 migration layer belongs in the implementation.

### D3 - Sovereign contracts

**Mechanics.**\
Package-owned Draft 2020-12 schemas use stable URN identities.\
Aggregate schemas contain external references; generated DTOs and validators come from the same catalog.

**Rationale.**\
A named object must be independently discoverable, reviewable, testable, and owned rather than hidden inside a large inline definition.

**Consequence.**\
Runtime code must not begin until the changed schema catalog, examples, invalid fixtures, generated bindings, and semantic-rule map pass their gate.

### D4 - Full route snapshots

**Mechanics.**\
Each established direction sends monotonically revisioned, bounded, authoritative snapshots of the selected routes intended for that peer.\
Omission withdraws; one update may be outstanding while later desired state coalesces.

**Rationale.**\
This extends the MVP's already bounded whole-set convergence model and avoids delta replay, tombstones, and refresh recovery in the first multi-hop version.

**Consequence.**\
Route scale is bounded by negotiation.\
If future scale makes full snapshots unsuitable, a later protocol change must introduce deltas explicitly rather than silently changing omission semantics.

### D5 - Route provenance and identity lifetime

**Mechanics.**\
A route carries `endpoint`, `originNodeId`, and an ordered unique node path.\
Local state separately records the immediate owning session.\
Session IDs are six lowercase hex characters and need be unique only among retained live controllers between the same node pair.\
Public local ownership therefore uses `(remoteNodeId, localSessionId)`; remote OPEN identity uses `(remoteNodeId, remoteSessionId)`.\
Private mutation authority always uses the exact controller object.

**Rationale.**\
Multi-hop origin and loop evidence must survive beyond the first adjacency, while a reconnect-scoped session ID has no global meaning.

**Consequence.**\
`originSessionId` is not propagated as route provenance and is removed from multi-hop CLI output.\
Cleanup always keys on the local owning session.

### D6 - Deterministic single-path selection

**Mechanics.**\
For one endpoint, prefer an active local candidate, then shorter node path, lower `originNodeId`, lexically lower complete path, lower immediate peer node ID, and finally lower local owning session ID.

**Rationale.**\
Every node needs a stable answer without introducing policy, metrics, or multipath into the first slice.

**Consequence.**\
Path length is an inherent path-vector distance, not a configurable metric.\
Losing candidates remain queryable and can be promoted without waiting for a new advertisement.

### D7 - Feasible-path source authorization

**Mechanics.**\
A received source is feasible only if the ingress session owns an eligible imported route for `(endpoint, originNodeId)`.\
Before any peer data write, an exported selected route for that same source identity must be acknowledged in the egress peer's Adj-RIB-Out.\
The selected export need not be the same candidate or reverse path as the feasible ingress route.

**Rationale.**\
Requiring only the selected reverse path incorrectly rejects valid asymmetric ingress; requiring acknowledged export ensures the next peer has installed evidence with which to authorize the source.

This is feasible-path RPF: stronger than conventional loose RPF (a source route exists anywhere), but weaker than strict RPF (the selected reverse route must point at the ingress).

**Consequence.**\
A remote send may fail `SOURCE_NOT_ADVERTISED` during route convergence.\
Data is never placed in an unbounded readiness queue.\
An export withdrawal closes its source epoch to new data but cannot overtake bounded packets already admitted under the prior ACK.

### D8 - Reverse failures

**Mechanics.**\
Each admitted peer write allocates a hop-scoped `ReturnToken` that never repeats during the lifetime of the exact egress controller and records a bounded, expiring breadcrumb to its ingress.\
A downstream error is accepted only when its token resolves on that exact controller.\
Each relay consumes one breadcrumb, preserves the end-to-end message reference and failure body, and replaces the token with the upstream hop's token.

**Rationale.**\
The failure may be caused by missing reachability, so routing the error through the same RIB can recurse or disappear.

**Consequence.**\
Expired or unverifiable errors are diagnostic-only and cannot trigger another error.\
Session-ID reuse or a delayed old error cannot alias a later breadcrumb.\
The SDK reports a later correlated failure as an event; it does not retroactively reject an already resolved admission receipt.

### D9 - Volatile derived runtime state

**Mechanics.**\
On restart, sessions, timers, queues, breadcrumbs, Adj-RIB-In, Loc-RIB, FIB, Adj-RIB-Out, counters, and events start empty.\
The application re-supplies configuration and endpoint bindings; peers reconnect and re-advertise.

**Rationale.**\
A persisted session or learned next hop would refer to a transport that no longer exists.

**Consequence.**\
Equivalent reachability after reconvergence is required; identical session IDs, route IDs, timestamps, revisions, or counters are not.

### D10 - Atomic canonical state

**Mechanics.**\
One serialized node executor commits an input mutation, candidate recomputation, selection, forwarding, desired exports, operations revision, counters, and events as one transaction.\
Wire side effects begin after commit.\
Operations revisions, event sequences, and counters use distinct finite exact-integer domains.\
Every transaction preflights all required increments.\
The last operations-revision value is reserved for one terminal failure transaction that replaces, rather than partially applies, any mutation that would wrap a domain.

**Rationale.**\
SDK, HTTP, CLI, and concurrent data admission must never observe a half-withdrawn or half-selected route.\
A nominally bounded schema is not truthful if a long-lived process can eventually wrap, lose numeric precision, or freeze a revision while state continues changing.

**Consequence.**\
External admission callbacks and network writes cannot execute inside the transaction.\
Their tokened results return as later commands and stale tokens are discarded.\
Exhaustion gates the node, purges mutable logical authority, commits `Failed` once, and requires replacement of the runtime instance; it never wraps or silently saturates canonical ordering state.

### D11 - Cross-dial collision

**Mechanics.**\
When duplicates exist, the lexically higher node is the canonical dialer.\
Both ends therefore retain that node's outbound connection.\
Further ties use both nodes' session tuples; an established equal-preference winner is stable.

**Rationale.**\
Peers can both be configured to dial, so collision resolution must reach the same result independently of arrival timing.\
Selecting the higher identity follows the convention in RFC 4271 section 6.8 while adapting its numeric BGP Identifier to AGP's canonical NodeId byte order.

**Consequence.**\
A configured supervisor suppresses retries while any winning adjacency to that remote node exists.\
The losing transport closes with `ADJACENCY_COLLISION`.

### D12 - Operational continuity

**Mechanics.**\
Existing read-only management paths and the `connections.list`/`routes.list` verbs remain.\
Their schemas change where old role or direct-only route fields are false.

**Rationale.**\
Operators are protected consumers even though legacy SDK and wire consumers are not.

**Consequence.**\
`role: hub|spoke` disappears.\
Route output presents final origin, complete path, and immediate `REMOTE_NODE@SESSION_ID` next hop without the redundant `session:` prefix.

### D13 - One-shot runtime instance

**Mechanics.**\
A node moves `Created -> Starting -> Running -> Stopping -> Stopped`, with `Failed` terminal.\
`Stopped` and `Failed` remain inspectable but cannot be started again.\
A restart creates a new node instance, re-exposes application endpoint intent, and reconverges from empty derived state.

**Rationale.**\
This makes instance identity, operations revisions, counters, bindings, callbacks, and live transport authority share one unambiguous lifetime.

**Consequence.**\
Applications that want process-local restart retain their configuration and endpoint definitions outside AGP and construct a replacement node.\
No callback, session ID, or snapshot from the old instance can become authoritative again.

### D14 - Reliable ordered packet channel

**Mechanics.**\
Every peer session adopts one already-acquired `TransportChannelPort`.\
The channel is full duplex and preserves complete opaque byte packets reliably, without adapter duplication, and in FIFO order within its live lifetime.\
It has bounded ingress and egress, one in-flight kernel write, a pull-based single-consumer read boundary, finite close, synchronous idempotent abort, and exactly one stable terminal result.\
A fulfilled send means the complete packet crossed the adapter's bounded ordered acceptance point; it does not prove peer receipt.\
After terminal failure, whether an accepted packet reached the remote channel can be unknowable, so the transport does not promise delivery, retry, persistence, replay, acknowledgement, or exactly-once application handling.

The profile is mandatory rather than dynamically negotiated.\
A transport that cannot preserve a profile invariant terminates its channel and never silently drops, duplicates, or reorders a packet.\
JSON, UTF-8, AGP schemas, OPEN, keepalive, and session meaning remain above this boundary.

**Rationale.**\
AGP route revisions, route acknowledgements, continuation barriers, and withdrawal/data ordering depend on ordered reliable delivery.\
Naming those requirements directly permits transport substitution without pretending that weaker semantics are equivalent.

**Consequence.**\
`sendText`, selected WebSocket subprotocol, native close codes, compression modes, carrier URLs, and unbounded push buffers are not members of the neutral port.\
An indeterminate write is channel-terminal.\
Changing the profile requires a new surveyed protocol objective rather than an adapter-specific exception.

### D15 - Transport references and observed peer evidence

**Mechanics.**\
`NodeConfig` contains only bounded logical `transportRef` identifiers for listeners and configured peers.\
The embedding application constructs an injected transport whose synchronous resolver returns adapter-bound listen/connect capabilities for those references.\
Core validates reference syntax and `createNode()` captures each resolved capability exactly once, but neither interprets the adapter-owned authority.

An acquired channel supplies immutable `TransportPeerEvidence`.\
Identity admission receives that adapter-observed evidence together with the admitted OPEN identity.\
Static configuration may state policy or desired security, but it cannot be presented as observation of a peer.

**Rationale.**\
Replacing `url` with an unchecked generic object would preserve carrier leakage and weaken schema ownership.\
Passing a port separately from opaque reference objects would also permit mismatched adapter authority.\
Logical references plus already-bound capabilities keep topology intent queryable while credentials, addresses, security configuration, and binding details stay with their actual owner.

**Consequence.**\
`websocket`, `transportSecurity`, host/port/path, `ws:` URL validation, and raw handshake contexts leave core configuration.\
Canonical operations may expose a transport reference and sanitized adapter projection, but never credentials or an object on which kernel logic branches.

### D16 - Sovereign WebSocket binding

**Mechanics.**\
`@agp/binding-websocket` owns the language-neutral mapping between one AGP byte packet and one complete RFC 6455 binary message.\
It owns the `agp.v1` subprotocol token, opening-handshake rule, text/binary distinction, fragment reassembly boundary, size rejection mapping, Ping/Pong and compression rules, and native close-code table.\
`@agp/transport-node-ws` implements that binding using `ws` and yields only neutral packet channels.

Binary messages are deliberate: the neutral channel preserves arbitrary byte packets without asking the binding to interpret UTF-8.\
AGP protocol decoding above the channel remains the sole owner of UTF-8 and JSON rejection.\
An incoming WebSocket text message is therefore a binding violation, while an incoming binary packet containing invalid UTF-8 is a protocol input failure.

The coordinated v1 replacement deliberately reuses the `agp.v1` selector.\
Handshake selection proves only that both sides selected the named binding; it cannot prove that a peer still running the retired text-message v1 has upgraded to the replacement binary mapping.\
Mixed deployments are unsupported under D2: the first legacy text input is rejected deterministically as a binding violation.\
No compatibility probe, dual-mode decoder, or second negotiation round is added.

**Rationale.**\
A WebSocket binding is a protocol mapping, while a Node.js adapter is one runtime implementation.\
Separating them prevents RFC 6455 rules from leaking upward and permits another runtime to implement the same binding without copying semantics.

**Consequence.**\
`@agp/protocol`, `@agp/core`, `@agp/node`, and `@agp/transport` cannot import the binding, name its subprotocol, inspect a WebSocket, or branch on a WebSocket close code.\
The binding may reject a carrier record before channel adoption; after adoption it maps all native outcomes to neutral terminal records.

### D17 - Canonical production Loopback

**Mechanics.**\
`@agp/transport-loopback` provides explicit isolated `LoopbackFabric` instances.\
Each fabric owns bounded process-local addresses, listener registration, paired packet channels, capacity, and shutdown.\
Delivery is asynchronous and copies immutable byte packets across the same neutral acceptance/read boundary used by every transport.\
Loopback nodes still encode, parse, exchange OPEN/KEEPALIVE/routes/data, run the complete FSM, and consult the complete RIB/FIB.

Loopback is a supported production transport for component-to-component AGP systems inside one process.\
It owns public configuration, state, documentation, tests, and lifecycle guarantees.\
Deterministic fault injection may compose with the fabric later but is not part of correct base delivery.

Its public revision and counters, plus its private arbitration sequence, use finite exact-integer domains.\
Acquisition and visible mutations preflight their required increments.\
Domain exhaustion atomically fails and freezes the fabric with bounded sovereign evidence before any value can wrap; native cleanup continues privately without rewriting the terminal snapshot.

**Rationale.**\
Process-local application components need the same named endpoint routing substrate without opening sockets.\
Treating Loopback as a mock would permit shortcuts, test-only semantics, global registries, and unversioned behavior precisely where a canonical production use case exists.

**Consequence.**\
There is no direct object-message or handler-call fast path, no global implicit fabric, no synchronous receiver re-entry, and no Loopback-specific kernel branch.\
Loopback and WebSocket pass the same transport conformance kit and equivalent topology behavior gates.\
A failed fabric remains inspectable, cannot be restarted, and must be replaced.

---

### D18 - Pre-shared-key transport security

**Mechanics.**\
`@agp/binding-websocket` gains a second security profile alongside `trusted-development`.\
The secure profile is TLS 1.3 with pre-shared keys and no certificates: no certificate authority, no issuance, no expiry, no revocation.\
Early data is disabled, and a handshake that negotiated it is a binding violation.

Configuration declares the profile and the keying model, never a secret:
```ts
type WebSocketSecurityConfigData =
  | { readonly mode: "trusted-development" }
  | { readonly mode: "preshared-key"; readonly keying: "network" | "node" };
```

Ownership is split by concern.\
`@agp/transport` owns the mechanism-free contract: the secret identity, the keying model, the declared profile, and the port that supplies key material.\
`@agp/binding-websocket` owns only the TLS realisation: cipher suites, minimum version, handshake wiring, the prohibition on early data, and native alert mapping.

`keying` is required.\
`network` means one key for the whole topology; `node` means one key per node, keyed by the identity a peer presents.\
Key material arrives through an injected synchronous capability, not configuration, so rotation does not require reconstructing a node.\
The capability is synchronous because the underlying key callback must answer during the handshake.

Observed evidence is truthful about which of the two was configured:

| `keying` | `protection` | `authentication` | Proves |
|---|---|---|---|
| `network` | `confidentiality-and-integrity` | `{ kind: "none" }` | Membership of the keyed group |
| `node`, accepted | `confidentiality-and-integrity` | `{ kind: "verified", principal, method }` | Possession of the key registered for the presented identity |
| `node`, dialed | `confidentiality-and-integrity` | `{ kind: "none" }` | Possession of the dialer's own key, with no observable peer label |

The binding never binds a transport principal to an AGP `nodeId`.\
It reports evidence, and `IdentityAdmissionPort` applies deployment policy.

Identity flows one way.\
TLS 1.3 removed the pre-shared-key identity hint, so only a listener observes a peer label and only a listener can report a verified principal.\
A dialer reports protection without a principal rather than restating configured intent as observation.

The handshake negotiates an ephemeral key share alongside the secret, so a secret disclosed later does not decrypt traffic captured earlier.

A key failure is retryable under the existing bounded dial backoff, because a mismatch during rotation resolves itself when the capability returns the new value.

The profile is specified for star and line topologies.\
In a full mesh every node would hold every other node's key, so one compromise forges every identity; a per-pair model and separate authority are required for that case.

**Rationale.**\
AGP is expected to cross the public internet with no assumed outer encryption, so the transport must protect its own traffic.\
Certificate infrastructure is the usual answer and was explicitly excluded, which leaves pre-shared keys as the mechanism that provides confidentiality, integrity, and mutual authentication with nothing to issue, renew, or revoke.

Two keying models exist because they answer different questions.\
One network key is the smallest thing that stops an outsider reading traffic.\
One key per node additionally distinguishes insiders from each other, which is what makes a claimed `nodeId` worth anything.\
Making the choice explicit prevents a deployment from believing it has the second while running the first.

The pre-shared-key concept is not specific to TLS; SSH and IPsec select a secret by identity in the same way.\
`@agp/transport` therefore owns `SecretIdentity`, `ChannelSecurityKeying`, `ChannelSecurityProfile`, and `PresharedKeyPort`, and each binding maps them to its own handshake.\
`@agp/binding-websocket` references the neutral keying code rather than restating it.

A3 Earned Exposure argues against promoting a surface on anticipated reuse, and only one protected binding exists today.\
The standing intent is that further transports will follow, and that the shape should be settled before a second implementation forces it.\
Placing the contract now is a deliberate departure from Earned Exposure, taken on declared roadmap rather than on a second consumer.\
If no second binding materialises the cost is one package boundary in the wrong place; if one does, the alternative cost is two divergent definitions of the same concept.

**Consequence.**\
Declaring `node` keying while supplying one key for every identity produces `verified` evidence that is false.\
The binding cannot detect this, so the declaration is a deployment responsibility and must be documented as one.

Reading `socket.authorized` to decide whether a peer is authenticated reports `false` for every correctly authenticated peer, because it describes certificate verification that a pre-shared-key handshake never performs.

Copying a configured `expectedNodeId` into evidence when no peer label was observed would restate desired identity as observation, which is the fault D15 forbids.

Enabling early data would let an attacker replay captured application data across connections that share a key.

Placing key material in `NodeConfig`, canonical operations state, or a diagnostic would move a secret into a surface designed to be inspected and projected.

---

### D19 - Per-hop credit flow control

**Mechanics.**\
A receiver advertises a cumulative ceiling, and a peer may not send beyond it.

The ceiling is cumulative rather than a remaining allowance, and the distinction is load-bearing.\
A receiver cannot observe its own channel ring: its read loop consumes each packet before reading the next, so arrival and consumption are indistinguishable from inside the node and a remaining-allowance model measures nothing.\
What a receiver can count is what it has read, so it advertises read plus capacity and the sender sends while sent is below that.\
In-flight is then sent minus read, which is exactly the ring occupancy, bounded by capacity without either side observing the ring.\
Credit is granted per adjacency and per direction, so each hop governs its own ingress and no end-to-end state is implied.

Credit has two dimensions, because a channel has two exhaustible resources:

| Dimension | Governs | Mirrors |
|---|---|---|
| Bytes | Buffered memory | `maxBufferedBytes` |
| Packets | Ring slots, and the per-message state each admitted message reserves | `maxBufferedPackets` |

A sender may admit only while both dimensions permit.\
Bytes alone is insufficient: a sender holding a large byte budget can exhaust a packet ring with small messages, and every admitted message additionally reserves a queue entry, a breadcrumb, and a return token.

Credit is carried two ways, chosen so each mechanism serves the regime it already suits:

| Condition | Carrier | Why |
|---|---|---|
| Traffic flowing | A field on every envelope | Free, and correlated exactly with the need |
| Idle | `KEEPALIVE` | The only regime where no envelope flows, and where keepalive already fires |

An absent grant means unlimited, which is exactly how a peer that never negotiated credit behaves, so the field is optional and the wire shape is preserved.\
A deployment configures whether it grants at all, and `OPEN` negotiates the initial grant between peers that do.\
A receiver never advertises credit exceeding the channel limits it supplied to its adapter, so the ring cannot be oversubscribed by construction.

Exceeding granted credit is a protocol violation and is fatal, in the same class as a revision or identity error.\
It is never a silent drop, because AGP does not retransmit and a dropped message would be lost permanently.

**Rationale.**\
Measurement established that AGP has no working ingress flow control over a real socket.\
Delivered messages equalled the receive ring exactly at every bound from 16 to 128, and a burst larger than the ring terminated the session, purged its routes, and forced reconvergence, after every `send()` had already resolved successfully.

The cause is a scale mismatch rather than a coding error.\
A local kernel send buffer, a TCP window, and a peer kernel receive buffer together hold megabytes, while the AGP ring holds tens of packets.\
AGP placed a small bottleneck inside a pipeline that was already flow controlled, so the carrier's own backpressure can never engage before the AGP bound is exceeded.\
Enlarging the ring only moves the cliff: a burst larger than the ring always fails, and a ring larger than the burst always passes.

Credit is the mechanism the transport corpus converged on for exactly this shape.\
TCP advertises a receive window in every segment rather than on a dedicated message, which is why credit belongs on the envelope.\
PCIe maintains separate header and data credit pools because a descriptor ring and a byte budget are different resources, which is why credit has two dimensions.\
Message-oriented protocols agree: AMQP 1.0 and MQTT 5 both credit in messages alongside a size bound.

Folding credit into `KEEPALIVE` alone was rejected on function rather than taste.\
`M07` suppresses keepalive whenever an envelope has recently been sent, so under load, precisely when credit matters, the carrier of that credit falls silent.\
Removing the suppression would add control traffic to a saturated link and destroy the property that makes keepalive cheap.

AGP gains one simplification TCP cannot.\
The channel is reliable and ordered while live under `D14`, so a credit update cannot be lost.\
There is no zero-window deadlock, no persist timer, and no window probe.

Credit is the peer-facing half of a concern AGP already owns.\
`capacity-ledger` governs what this node may consume of itself; credit governs what a peer may consume of this node.\
It is one concern with two faces, not a new subsystem.

**Consequence.**\
Granting credit above the supplied channel limits reintroduces the overrun with extra steps, because the ring would again be smaller than what the peer is permitted to send.

Carrying credit only on a dedicated control message would either add traffic to a saturated link or, if suppressed like keepalive, fall silent exactly when it is needed.

Crediting in bytes alone leaves the packet ring unguarded, so a sender using small messages exhausts the receiver while remaining inside its byte budget.

Treating an exceeded grant as a drop rather than a violation would lose a message permanently, because nothing in AGP retransmits.

Deriving credit from anything other than observed drain progress would advertise capacity the receiver does not have, which is the same fault as static configuration masquerading as observation.

Leaving `RECEIVE_OVERFLOW` reachable between conforming peers would keep a routine burst able to reset a healthy session and withdraw its routes.

---

## 4. Mechanics, rationale, and consequence

### Mechanics

Each D1-D17 record fixes one implementation-authorizing choice and carries its own labeled mechanics, rationale, and consequence.\
The status table separates required stakeholder constraints from ratified design consequences.

### Rationale

Keeping the three parts together lets a cold reviewer distinguish what must be built, why that choice was made, and which apparently convenient alternative would violate the authority.

### Consequence of violation

Implementing only the mechanics, without preserving rationale and consequence, would allow later compatibility, topology, transport, or state shortcuts to silently reverse a ratified decision.
