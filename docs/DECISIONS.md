# AGP uniform node - decision register

## 1. Status

This register distinguishes stakeholder intent from the design choices that realize it.\
The stakeholder authorized autonomous implementation after design completion and validation on 2026-07-30; the completed design choices below are therefore ratified implementation authority.

A record here is frozen at the time it was ratified and is not rewritten when a later decision changes a name.\
Two renames since affect how these records read, and neither changes what any of them decided:

- The reverse-path record a hop keeps was called a `breadcrumb`, and its
  operational projection was called a reverse correlation. Both are now a
  `LabelBinding` held in a `LabelTable`. The name changed under `D23` because
  the old one suggested something passively left behind rather than an active
  forwarding entry, and the second name was carried along so that one thing has
  one name. This renamed the `capacity.maxLabelBindings` configuration key, the
  `operations.labelBindings()` reader, and their schemas. See
  [`design/message-labels.md` section 2](design/message-labels.md#2-what-the-record-is).
- The `error` message was retired into the `disposition` under `D23`, which
  reports the fate of a message whether that fate was delivery or failure.
  `DeliveryErrorBody` became `DeliveryFailure` with it, because once no error
  message existed the type was no longer any message's body. Records below that
  name an `error` message describe the mechanism as it stood when they were
  ratified.

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
| D20 | Project every bounded resource and every timing the node governs into the sovereign operations plane | `A1` + `A14` + explicit stakeholder direction | Ratified |
| D21 | Make the cost of a write proportional to what changed, never to what is held | Measurement + `A1` + `A11` | Ratified |
| D22 | Announce a self-transition only when nothing else already reports it | Measurement + explicit stakeholder direction | Ratified |
| D23 | Report the fate of every message as an outcome, and release reverse-path state when it arrives | Measurement + explicit stakeholder direction | Ratified |
| D24 | Make the operations stream a channel for what an operator must act on, and carry per-message detail elsewhere | Measurement + explicit stakeholder direction | Ratified |
| D25 | Advance the canonical revision only when canonical state changed, not when a timer was reset | Measurement + `D10` + explicit stakeholder direction | Ratified |

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

### 2.5 Confirmed performance intent

There is no performance target, and the absence is deliberate rather than an omission awaiting a number.\
The standard is that AGP should be excellent, and that opportunities to improve it are taken as they are found.

Two consequences follow, and they point in opposite directions.\
A cost that is merely higher than some other system's is not a defect, so no measurement obliges a change on its own.\
And an opportunity found is not deferred for want of a threshold to justify it, because there is no threshold and waiting for one is how an unwritten standard becomes an unmet one.

This does not license slowness that breaks something else.\
A cost that moves a deadline, exhausts a bound, or blocks the loop another obligation runs on is a correctness fault wearing a performance costume, and it is scored as the fault it is rather than as the number it presents.

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

Credit governs what reaches the wire, not what a caller offers.\
The send queue is the buffer that absorbs the difference between the local offer rate and the remote drain rate, and the grant paces what leaves it, so a caller whose messages the queue can hold is never refused for a bound that belongs to the peer.\
A caller past the local queue still fails `QUEUE_FULL`, unchanged, because that bound is this node's own.

Only data is paced.\
A receiver holds a reserve back from the ceiling it advertises, and control draws on that reserve, so a grant is never the reason a control message cannot be sent.\
Control may also overtake data the peer has no room for, and it is the only thing that may overtake anything.\
Both are required together: the reserve gives an overtaking control message somewhere to land, and the overtake lets it reach the wire at all.

A route snapshot never overtakes data.\
Epoch closure is synchronous with admission, so data admitted under an epoch is already queued ahead of the snapshot withdrawing it, and letting the withdrawal pass would put data behind a route the peer had been told to forget.\
Control passing a route is safe where a route passing data is not, because an acknowledgement names the peer's revision by reference while a snapshot carries this node's own, and neither reads the other.

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

Pacing control alongside data would deadlock the link rather than throttle it.\
A grant arrives on a control message, so two peers saturating each other would each hold the replenishment the other is waiting for, and neither would proceed.\
The same stall silences `route.ack`, and a peer timing an acknowledgement it will never receive tears down a session that was merely busy.\
Both were observed before the reserve and the overtake existed.

Advertising the whole ring rather than the ring minus a reserve would remove the room an overtaking control message needs, which reintroduces the same deadlock through the other side.

### D20 - Observability of bounded resources and timing

**Mechanics.**\
Every bounded resource the node governs is projected into the sovereign operations plane, in the shape the plane already uses: a current value, the maximum it is bounded by, and the high-water mark it has reached.

Credit is such a resource, held per session and per direction, and it is projected like the rest.\
The outbound direction reports the ceiling the peer granted, what this node has sent against it, what remains, how many times it stalled, and how long it has spent stalled.\
The inbound direction reports the capacity offered, what has been read, and the ceiling last put on the wire.

Timing the node governs is state, and is projected as state rather than emitted as a log.\
One reusable sample carries a count, the last observed duration, and the highest observed duration, and any timing the node can measure uses it rather than inventing its own shape.\
The two the node measures today are how long a sender waited for replenishment and how long a route acknowledgement took to return.

The plane carries aggregates and last-observed samples, and does not carry per-event history.\
A node that retained a timeline would make its own memory a function of its traffic, which is the bound problem again in a new place.\
Per-event timelines belong to the harness, which is bounded by a test rather than by an uptime.

An investigation reads the plane before it reaches for a trace.\
Reaching for a trace instead is evidence that the plane is missing something, and that evidence is filed as a finding rather than absorbed as a workaround.

**Rationale.**\
`A1` requires that no functional unit hold private truth, and every bounded resource in AGP satisfied it except the one added most recently.\
Queues report current, maximum and high water for messages and bytes; handlers and breadcrumbs report the same through a gauge; timers report their remaining time.\
Credit shipped with none of it, and the cost arrived immediately rather than eventually.

The first investigation into credit timing was conducted by patching console output into built artifacts.\
The instrumentation was lost on every rebuild, applied twice on one occasion and corrupted its own counts, and line numbers were read as though they were a clock.\
That is `A5`: an agent acting on state it derived rather than state it was given, at a cost that would have bought the projection several times over.

Aggregates and high-water marks are constant-time and allocation-free, so an always-on projection does not change the timing it reports.\
A per-event trace does change it, which is the substantive reason it stays outside the node rather than a matter of taste.

A timing defect is a class, not an incident.\
Building the projection once converts every future member of that class from an archaeology exercise into a query, which is the compounding that `A14` requires an investment to demonstrate.

**Consequence.**\
Shipping a bounded resource without its projection reintroduces exactly the fault this record exists to remove, and it stays invisible until someone has to diagnose it under pressure.

Retaining per-event history inside the node makes memory a function of traffic, so the observability intended to guard a bound becomes an unbounded resource itself.

Projecting a derived duration rather than an observed one would let the plane state a number that nothing measured, which is worse than stating nothing.

Making the projection expensive enough to perturb the timing it reports turns the instrument into the defect, and every measurement taken through it becomes unfalsifiable.

Emitting timing only as a log leaves it unqueryable and unretained, so two actors diagnosing the same node reason from different reconstructions of it.

### D21 - Write cost proportional to change

**Mechanics.**\
A write returns the identity of what it committed, not the state that follows it.\
A caller wanting state asks for it, and pays for it then.

Canonical values are cloned and frozen once, as they enter the store, and shared from then on.\
A read assembles references to frozen values rather than copying them, because two readers holding one frozen reference can no more disturb each other than two holding separate copies.

A projection of something that cannot change after admission is built once and shared.\
An ordering key is computed once rather than inside a comparator, where the set size multiplies it.

The invariant beneath all four: the cost of a write is proportional to what changed, and never to what is held.

**Rationale.**\
This was measured, not suspected.\
Deep cloning was thirty-one percent of all processor time under a stream, and the largest single consumer in the system.

Every commit returned a freshly materialised deep clone of the whole of canonical state, and a delivered message commits three times.\
Each of those clones was proportional to everything the node held, including a reverse-correlation set that grows with the traffic in flight, so a stream of `M` messages cost on the order of `M` squared.\
The reverse-correlation projection was rebuilt for every live breadcrumb on every commit, though a breadcrumb cannot change after admission, and the set was re-sorted by a comparator that parsed a date on each comparison.

The consequence was not slowness but blindness.\
The event loop stalled for up to five hundred and ninety milliseconds at a time, and everything timed against a deadline during that stall was measured against a clock that a stall had already moved.\
Credit replenishment, route acknowledgement and delivery all degraded together, which is why the first attempts to explain any one of them in isolation failed.

Nothing about the immutability guarantee is weakened.\
It was never the copying that protected canonical state from its readers; it was the freezing, and the freezing is retained exactly.

**Consequence.**\
Returning state from a write makes every write pay for a read that nobody asked for, and the price is set by everything held rather than by anything done.

Re-cloning canonical state that is already frozen converts an immutability guarantee into a throughput bound, and the bound tightens as the node holds more.

Rebuilding an immutable projection on every commit ties the cost of one message to the number of messages already in flight, which is the quadratic that hid here.

Computing an ordering key inside a comparator multiplies that key by the logarithm of the set size, on the write path, where the set is largest.

A write path that scales with held state makes every latency measurement in the system suspect, because the observer and the observed share one event loop.

### D22 - Self-transitions are recorded, and announced only when unreported

**Mechanics.**\
A session that stays `Established` transitions to itself on everything it processes.\
The snapshot records every one of them, because `LAST_EVENT` is how an operator sees that a session is working.

The event stream announces a self-transition only when no other event already reports the same activity.\
A delivered message announces itself as accepted, received and handled, so the transition that accompanied it is recorded and not announced.\
A keepalive announces nothing else, so its self-transition is announced.

Every change of state is announced, without exception.\
The distinction is between a state change and a self-transition, and then between a self-transition that is already reported and one that is not.

**Rationale.**\
An event named `transition`, emitted when nothing transitioned, is at best imprecise.\
What makes it worth correcting rather than tolerating is that its rate was set by traffic.

A subscriber that yields to the macrotask queue, which is what any subscriber doing real work does, received fifteen of twelve hundred events during a stream.\
It is scheduled about as often as the event loop drains, and under load that is rarely, so the buffer must absorb the whole burst rather than bridge the subscriber's own latency.\
An event stream whose volume scales with traffic therefore displaces exactly the events an operator is watching for, and it does so hardest at the moment they most want to be watching.

The keepalive case is kept for the opposite reason.\
An idle session emits no delivery events at all, so a withheld self-transition would leave a healthy session silent, and the keepalive timer already bounds that announcement to a few a minute.\
The rule is therefore about whether the activity is otherwise reported, not about whether the state changed.

This does not touch liveness in either sense that matters to the protocol.\
A received message still resets the hold timer, and the snapshot still shows the session working.\
Only the duplicate announcement is withheld.

**Consequence.**\
Announcing every self-transition makes the event rate a function of traffic, so a subscriber loses the events it exists to see precisely when the node is busiest.

Withholding the keepalive self-transition as well would leave an idle but healthy session with no sign of life in the stream at all.

Withholding the snapshot's record along with the announcement would remove the column an operator reads to see that a session is processing anything, which section 6.1 of the operations design requires to count self-transitions.

Suppressing an announcement for a real change of state would hide a session leaving `Established`, which is the one transition every consumer is watching for.

### D23 - Delivery disposition

**Mechanics.**\
Every message a node forwards acquires a reverse-path binding, and that binding is released when a disposition for it returns, whether the disposition reports delivery or failure.\
Expiry remains as a backstop, and reaching capacity evicts the oldest binding rather than refusing new work, configurably, so a reverse-path concern can never stop the data plane.

A hop reports upstream once its own downstream has reported to it.\
A disposition arriving at the originating node therefore means the network delivered the message to the destination endpoint.\
It does not mean the endpoint processed it, and it will not: what a handler does with a payload is above this layer.

Dispositions are batched per session.\
A delivery is expressed as a range of labels, because labels are allocated monotonically and a batch is usually contiguous.\
A failure is expressed as one entry carrying its label, the end-to-end identity of the message, the node that failed it, and its reason.

Cumulative acknowledgement is unsafe here, because dispositions complete out of order and the existing failure path consumes labels beside them.

The two shapes are one kind of thing recorded at two levels of detail, and not two kinds.\
A delivery has less to say than a failure, and the reason it may say less is exact: the label is unique to one controller and consumed once, so the label alone names the message.\
A failure additionally echoes the end-to-end identity, because that check exists today, is fatal today, and catches a peer that is inconsistent about which message it is answering.\
Requiring the same echo on a delivery would add roughly a quarter to the wire volume of a stream to carry a cross-check that prevents nothing there, since a peer able to invent a label can equally supply the identity that matches it.

Every code names an outcome.\
The vocabulary holds one kind of thing, so a disposition arriving always means something settled, and the count of what remains outstanding decrements unconditionally.

A binding carries what remains outstanding against it and is released at zero.\
For one next hop that count is one, so this is the same rule stated so that a message with several next hops needs no exception.\
The count is destinations owed rather than copies sent, the origin retains which are outstanding, and an intermediate retains only how many.

Where a message was replicated, the hop that enumerated the destinations stamps their number on every disposition it relays, absent when that number is one.\
It is a field on an outcome rather than a kind of its own, so the invariant above survives, and it is carried on every disposition rather than the first so that losing one costs an outcome and not the denominator.

The disposition is surfaced per message on the SDK.\
It is not one operational event per message, because that rate is what reduced a subscriber doing real work to fifteen events of twelve hundred.

**Rationale.**\
AGP had no positive acknowledgement, so a binding was released by a failure or by expiry and never by success.\
A flow that never failed still filled the table, and a node was throughput-capped by records it kept exclusively for failures that did not happen: about 136 messages a second sustained, against a burst ceiling near 2850.

The fault was the retention duration rather than the placement of the state.\
Relocating the state was considered and rejected: routing a report back rather than relaying it would remove the binding from transit hops entirely, and would forfeit the authorisation and exactness that `D8` requires, because any node could then inject a report at an endpoint it was never authorised to reach.\
Shortening the retention achieves the same ceiling without that cost, since the bound becomes capacity over a round trip rather than over thirty seconds.

Batching per session is the coarsest grain available, because one session carries every flow between two adjacent nodes.

Holding the vocabulary to outcomes preserves the one property every consumer of this mechanism will rely on.\
Progress is already available without a second kind of message: with several destinations, terminal outcomes arriving over time are themselves a progress stream, and the only information that is genuinely not an outcome is the denominator.\
A denominator is a field, so it does not cost the invariant.

**Consequence.**\
Releasing a binding only on failure returns the ceiling, because success is the common case and nothing else clears the table.

Refusing new messages when the table is full lets a reverse-path quality concern stop the data plane, which inverts the relationship between them.

Sizing label capacity as though it were credit capacity reintroduces the ceiling, because a label is held for an end-to-end round trip while credit is released by one peer reading.

Admitting a code that names progress rather than an outcome makes a disposition mean settled only sometimes, after which every consumer must branch before it knows whether anything has settled.

Counting copies sent rather than destinations owed makes an intermediate count go negative the first time a downstream hop divides further.

Stamping the denominator on only the first disposition makes the loss of one report cost the origin its ability to know when it is complete, rather than costing it one outcome.

Reporting a disposition as one operational event per message reproduces subscriber starvation that has already been measured.

Describing a delivered disposition as processing promises handler semantics this layer does not observe and cannot honour.

### D24 - The operations stream is a channel, not a ledger

**Mechanics.**\
The operations event stream carries what an operator must act on: lifecycle, counters and anomalies.\
Its rate is set by what happens to a node rather than by how much traffic crosses it, so a subscriber doing real work can keep up with it on any bounded buffer.

Per-message detail leaves that stream.\
`message.accepted`, `message.forwarded`, `message.received` and `handler.completed` move to a dedicated stream a consumer opts into, and a consumer that does not ask for them pays nothing.\
This is the arrangement `D23` already chose for dispositions, generalised rather than invented: the disposition is surfaced per message on its own surface for the same reason, and having two rules for one problem was the accident.

Counters remain on the operations plane, so the operator still sees how much was delivered, forwarded and refused without seeing each one.

**Rationale.**\
A subscriber that yields to the macrotask queue is scheduled about as often as the loop drains, and under a stream that is close to never.\
Measured on the highest-rate node, such a subscriber receives almost exactly its buffer size and then nothing: 257 events of 800 at a buffer of 256, and 1025 of 1200 at the default of 1024.

That is the finding, and it is not a slow subscriber.\
The buffer is not bridging consumer latency, it is absorbing the entire burst, because saturation removes the consumer's opportunities to drain at all.\
So no buffer size is a property the operator can choose from anything they know: it would have to be sized to the largest burst the node will ever take.

Raising the default is therefore refused for a second reason beyond the `MX1` shape of moving a cliff.\
Even at the right size it makes the operator responsible for a property of the node.

Separating the streams fixes it at the source: the operations stream stops being traffic-rated, so its buffer becomes a consumer property again.

**Consequence.**\
Leaving per-message events on the operations stream starves any subscriber that does real work, and the operator cannot size their way out of it because the required size is set by the node.

Raising the default buffer instead moves the cliff without removing it, which is the `MX1` shape.

Telling a consumer to stay on the microtask queue is a contract that forbids doing work in a work loop.

Removing per-message events entirely rather than relocating them would take away detail that a consumer of the new stream legitimately wants, and the rate was never the problem for a consumer that asked for it.

### D25 - A revision denotes a change to canonical state

**Mechanics.**\
The canonical operations revision advances when canonical state changed.\
A value inside a session record that moves because traffic crossed the node does not advance it.

Four such values exist and all four are excluded: the hold timer, the token allocator's count of tokens issued, the timestamp on the self-transition `D22` records without announcing, and the credit counters `D20` projects.

Each is excluded at the leaf rather than by dropping the field it sits in, because every one of those fields also carries something structural.\
An allocator can become exhausted, a transition can be a real one, and a peer can re-grant a ceiling or make a new announcement.\
Those still advance the revision.

Every excluded value stays readable in the snapshot and on the counters surface.\
What stops is their claim that canonical state changed.

The decision is taken by the operations store rather than declared by a caller, so it cannot be got wrong by a caller that believes its write is uninteresting.\
Anything the comparison cannot prove to be traffic-rated still signals, including a changed set of controllers and any field added later.

**Rationale.**\
`D10` commits each routing change as one canonical revision, which makes the revision a change signal a consumer can poll.\
A signal that advances on every message is not a change signal.

Measured across a three-node path, in one session and against the same binary, a delivered message cost 9.17 revisions before this and 5.29 after: a 42 per cent reduction, and what remains is close to the delivery events themselves.

The narrower rule this decision first carried, excluding only the hold timer, was measured at 8.17 and rejected on that evidence.\
It removed 11 per cent, because the timer was one of four traffic-rated values and the smallest.\
Suppressing it alone left the revision still advancing on every message through the other three, so it bought almost nothing while appearing to address the cause.

`D21` already made this argument for the label-binding commit, and the sink demonstrates it working: that commit runs per message, writes nothing, and correctly issues no revision.\
These four differ only in that a value genuinely moved, which is why the same rule did not already catch them; the effect on a polling consumer is identical.

**Consequence.**\
Advancing the revision at traffic rate forces every consumer polling on it to re-read on every message, which is the cost `D21` exists to remove, arriving by a second route.

Excluding a whole field rather than its traffic-rated leaves would suppress a genuine event: token exhaustion, a real state transition, or a re-granted credit ceiling.

Suppressing the revision for a commit where canonical state did change breaks the change signal in the direction that cannot be recovered, because a consumer that re-reads can survive a spurious signal and cannot survive a missing one.

Withholding these values from the snapshot as well would remove what section 6.1 of the operations design requires an operator to read.

Letting a caller declare its own write uninteresting would put the rule where it can be got wrong, and the failure would be silent.

---

## 4. Mechanics, rationale, and consequence

### Mechanics

Each D1-D17 record fixes one implementation-authorizing choice and carries its own labeled mechanics, rationale, and consequence.\
The status table separates required stakeholder constraints from ratified design consequences.

### Rationale

Keeping the three parts together lets a cold reviewer distinguish what must be built, why that choice was made, and which apparently convenient alternative would violate the authority.

### Consequence of violation

Implementing only the mechanics, without preserving rationale and consequence, would allow later compatibility, topology, transport, or state shortcuts to silently reverse a ratified decision.
