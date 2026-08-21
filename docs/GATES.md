# AGP uniform node - gate definitions

> **Status:** Ratified. Current gate contract.\
> The certification model these gates obey is in [`VERIFICATION.md`](verification.md).

## 1. Purpose

One section per gate, in ascension order, each naming what it proves and the exact evidence that seals it.\
Section 11 maps every required test file to the gate that owns it.

A gate proves its own layer only.\
The proof-layer separation table in [`VERIFICATION.md`](verification.md#22-proof-layer-separation) states what each layer may not claim, and the ordering rules in [section 2.1](verification.md#21-binary-gated-ascension) state when a gate may be certified at all.

---

## 2. Gate AX0 - intent, applicability, and knowledge

### Purpose

Seal the authority and reasoning record before executable contracts bear weight.

### Required evidence

1. `traceability.schema.json` and `traceability.json` exist at their normative
   targets, validate, bind the current source revision, and contain exactly
   one record for every `U1..U15` and normative `D1..D17` requirement. The
   oracle compares the exact ID set and fails on a duplicate, omission, or
   unexpected ID. Each `U12..U15` record must include the fixed-intent
   stakeholder authority.
2. Every record has exactly one owning gate, at least one planned owning test,
   and one or more authorities.
3. Every normative design statement traces to confirmed survey intent,
   explicit fixed stakeholder authority, a Required/ratified decision, or an
   applicable A3/A4/A8/A9/A14 mechanic.
4. A0 appears only in lineage prose, never as product authority or conformance;
   no requirement cites a non-applicable axiom.
5. No Proposed decision authorizes implementation or a gate PASS.
6. Every normative specification contains an explicit labeled mechanics,
   rationale, and consequence triad. `design-mrc.test.js` scans the exact
   normative artifact allowlist and fails on a missing/duplicate label. Index
   and review artifacts carry one document-level triad; their individual rows
   express the same knowledge as mechanism/finding, alignment or root reason,
   and consequence/disposition columns rather than repeating three prose
   subsections per row.
7. Anti-goals are represented by absence checks where an accidental
   implementation would otherwise be plausible:
   - no role-specific runtime factories;
   - no implicit default route;
   - no multiple selected/forwarded paths;
   - no legacy-v1 negotiation;
   - no derived session/RIB persistence;
   - no mutating CLI;
   - no carrier-specific import, configuration, address, framing, liveness, or
     close code in common kernel packages; and
   - no Loopback direct-message, direct-FSM, or schema-bypass path.
8. A cold reviewer, given only the survey and design set, can reproduce the
   requirement-to-gate mapping without conversation history.
9. Every ambiguity discovered during review immediately has a durable finding
   ID, capture status, owner, and downstream trace obligation; root-cause and
   disposition fields become mandatory at closure.
10. `design-link-integrity.test.js` resolves every local Markdown link/anchor
    and every trace `designReferences` target from its declaring artifact; a
    path existing without its named anchor is a failure.
11. `design-vocabulary.test.js` applies a closed canonical/forbidden vocabulary
    table to normative prose and target API/schema names, including
    `dial|accept`, `TransportChannelPort`, listener-only publication,
    pair-scoped sessions, packet rather than carrier frame, and claimed versus
    admitted identity.
12. `consequence-of-violation.test.js` requires every design contract to state
    the faults it averts, as enumerated entries rather than a restatement of
    the rule. A review finding is a point-in-time belief; the durable form of
    that knowledge is the consequence section of the contract the finding
    produced, which a later reader reaches from the contract itself.

### Exit

`AX0` passes only when the trace graph is complete, acyclic, and contains no unresolved design-blocking finding.

---

## 3. Gate AX1 - sovereign schemas and boundaries

### Purpose

Seal public shape and concern ownership before contextual or temporal behavior is implemented.

### Mandatory AX1 subgates

`AX1` remains one binary release gate.\
Its manifest contains five independently reported subgate results, and `AX1` is `PASS` only when all five pass:

| Subgate | Sole concern |
|---|---|
| `AX1-P` | Protocol/core/management/SDK schema catalogs, generated DTOs, and public package boundaries |
| `AX1-T` | Neutral transport schemas, capability signatures, commit semantics, invariant catalog, and reusable conformance-case coverage |
| `AX1-B` | Sovereign WebSocket binding schemas/constants/mapping tables and absence of WebSocket vocabulary outside its binding/adapter owners |
| `AX1-L` | Production Loopback package schemas, public fabric lifecycle/state, and absence of a privileged kernel/test bypass |
| `AX1-D` | Whole-workspace dependency direction, vocabulary policy, package-root consumer, and catalog composition |

These labels are evidence sections, not additional ascension levels; later gates still depend on the one complete `AX1` digest.

### Schema proofs

1. Every named wire, configuration, state, event, and management DTO has one
   sovereign Draft 2020-12 schema file, stable `$id`, owner, and generated
   TypeScript type.
2. Every schema has a minimal valid fixture and every applicable valid boundary
   fixture. It has one orthogonal invalid fixture for each validation keyword
   or referenced constraint it actually declares or inherits. A machine-readable
   coverage matrix marks inapplicable categories-required fields,
   discriminator, bounds, unknown properties, nested references-as `N/A` with
   the schema reason; scalar schemas are not forced to invent object failures.
3. Invalid fixtures assert the exact instance pointer, schema pointer, and
   failed keyword.
4. Every `$ref` resolves through a package catalog; every catalog digest and
   path matches.
5. The root catalog composes package catalogs without copying named schemas.
6. Public aggregate schemas contain references, not inline public `$defs`.
7. Generated DTOs, validators, code catalogs, and reference tables regenerate
   byte-for-byte from a clean temporary tree.
8. Every non-schema invariant is named by `x-agp.semanticRules` and resolves
   through the semantic-rule registry to one owner, one owning gate, and one
   primary test at that gate.
9. Valid encode/decode round trips validate through the same compiled schema
   registry.
10. Live state and management schemas are loadable without filesystem-relative
    identity.
11. Every concrete event kind and event-data DTO has an explicit catalog
    file/URN/generated-type/discriminator mapping, and the root event union
    contains exactly those external references.
12. `DiagnosticRecord` is one closed core SDK schema-generated record with the
    exact domain/severity/code catalogs, bounded sanitized message, and no raw
    cause, context, details, or extension dictionary.

The semantic-rule registry targets are:
```text
schemas/agp-v1.semantic-rules.schema.json
schemas/agp-v1.semantic-rules.json
```

Each entry is exact and machine-checkable:
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

Every `x-agp.semanticRules` value resolves to exactly one entry; every entry is referenced by at least one schema and names one primary owning test containing its positive and negative cases.\
`owningGate`, phase, schema inputs, result-code set, normative design references, and implementation path make the evaluator context and precedence auditable without deriving either from a test title.\
The registry gate must equal the owning trace record.

### Transport acceptance-callback fault proof

One reusable neutral conformance case is invoked unchanged by the Node.js WebSocket and production Loopback adapters.\
It independently injects both an `Error` and a non-`Error` throw from each of:

- `accept`;
- `capacityRejected("pending-acquisition")`; and
- `capacityRejected("active-channel")`.

For every variant it proves:

1. callback entry is serialized and each triggering callback is invoked once;
2. a capacity-rejected acquisition has no channel, has released every common
   acquisition reservation, and has irreversibly detached any bounded native
   cleanup before callback entry;
3. Loopback does not resolve its paired `connect()` until `accept` returns; a
   throwing `accept` rejects that connect with `ADAPTER_FAULT`, aborts both
   untransferred endpoints, leaves no unowned endpoint, and releases active
   accounting after physical cleanup;
4. Loopback cancellation that wins before callback entry rejects
   `OPERATION_ABORTED`, releases both endpoints, and suppresses the callback;
5. cancellation fired while a normal `accept` holds the disposition gate loses
   to normal return, both transfers commit, and the later signal has no effect;
6. cancellation fired while a throwing `accept` holds the gate loses to the
   exact `ADAPTER_FAULT` callback-fault disposition, with no live channel;
7. no throw escapes a carrier callback or scheduler turn and no unhandled
   rejection is emitted;
8. with a configured `TransportDiagnosticSinkPort`, the adapter invokes
   `emit` once after terminal disposition with the exact closed diagnostic and
   the identical raw thrown value only as its separate cause; without a sink,
   no callback occurs;
9. the sink diagnostic code is exactly `ACCEPT_CALLBACK_FAILED` or
   `CAPACITY_REJECTED_CALLBACK_FAILED`; the listener terminal carries that code
   only when callback fault wins, while an earlier terminal and its diagnostic
   remain unchanged; no raw message or stack enters public terminal or
   operations state;
10. a sink that throws is contained without recursion and cannot alter the
   terminal, callback order, promise result, or final resource accounting;
11. absent an earlier terminal, the listener commits exactly one
   `carrier/adapter-fault` terminal; re-entrant close/abort and simultaneous
   carrier-failure cases prove first-terminal-wins without replacement;
12. no later `accept` or `capacityRejected` begins for that listener, while a
   separate listener and every previously transferred channel remain usable;
13. all pending acquisitions, native handles, scheduler work, and capacity
    reservations return to their exact expected baseline; and
14. node integration observes the unexpected terminal while `Running` and
    enters lifecycle `Failed` once without duplicate teardown.

### Boundary proofs

- The dependency graph matches the architecture and is acyclic.
- Package tests cannot import another package's private source.
- `@agp/node` depends on public protocol/core/transport contracts rather than
  wrapping retired router/spoke implementations.
- `@agp/protocol`, `@agp/core`, and `@agp/node` contain no import from a
  concrete adapter or carrier library.
- Carrier vocabulary is absent from common runtime types, schemas,
  configuration, FSM actions, state reducers, and routing branches. A
  documented reference link to a binding specification is not a runtime
  vocabulary violation.
- `@agp/binding-websocket` depends only on `@agp/transport`;
  `@agp/transport-node-ws` depends on that binding, `@agp/transport`, and its
  native library. The byte-opaque binding does not import the AGP codec.
- `@agp/transport-loopback` depends only on `@agp/transport`; neither
  `@agp/node` nor a topology fixture can reach its private queues or inject an
  AGP message/event directly.
- The node diagnostic boundary accepts only core `DiagnosticRecord`; each
  adapter diagnostic boundary accepts only neutral `TransportDiagnostic`.
  Neither accepts an open object, serializes its separate raw cause, or imports
  the other's owner package.
- `@agp/management-http` depends only on `OperationsReader` and core DTOs.
- `agpctl` consumes only management JSON and contains no routing derivation.
- A package-root consumer compiles using the intended public exports.

### Exit

`AX1` passes when every catalog/type/fixture/boundary check succeeds and there is no schema-owned rule asserted only in prose.

---

## 4. Gate AX2 - contextual protocol semantics

### Purpose

Prove the meaning of one already schema-valid value without clocks, FSM state, network I/O, or RIB mutation.

### Required semantic-rule families

| Family | Required proof |
|---|---|
| Identity | Node IDs are canonical; session IDs are exactly six lowercase hex; remote session identity is `(nodeId, sessionId)`; same-node adjacency is rejected |
| Route path | `path[0]` equals origin, last entry equals the identity-admitted sender, entries are unique, receiver presence is classified as a loop, and negotiated length is respected |
| Route ordering | Snapshots are unique and canonically ordered by endpoint, origin, and path |
| Route rejection | Loop, path length, policy, and capacity outcomes have exact bounded rejection records |
| Data source | Source endpoint and origin are exact canonical identities |
| Hop limit | Origin values are within negotiated bounds and transit decrement cannot underflow |
| Correlated error | Code and bounded reason are exact; `refId` equals the end-to-end failing data-envelope ID; `returnToken` equals the received hop token; failing-node identity is preserved across relay; an error is not a routable data message |
| Return token | `ReturnToken` is exactly 16 lowercase hex characters in a distinct semantic domain; public session ID or message ID cannot substitute for it. Stateful allocator non-reuse and exhaustion belong to AX5 |
| Negotiation | Receive, route, path, hop, and timer values resolve to the lower safe bound |
| Numeric/JSON profile | Safe integers, finite numbers, depth, UTF-8, duplicate-member, and byte rules retain exact precedence |

Every invalid semantic case returns one exact typed result.\
A malformed path must not be ambiguously classified as both a loop and a forged sender.\
Error precedence is part of the contract.

`AX2` loads `schemas/agp-v1.semantic-rules.json` rather than discovering rules from test names, and executes exactly entries whose declared `owningGate` is `AX2`.\
For each such entry it resolves the declared schema inputs, implementation, design references, and owning test, then asserts the closed result-code set and normative precedence through that test's positive and negative cases.\
AX0 validates every registry entry and its trace/gate match; AX1 and AX3-AX8 execute their own entries rather than making AX2 claim transport, FSM, routing, lifecycle, or operations behavior.

### Exit

`AX2` passes when every AX2-owned semantic rule referenced from the schema catalog has one owner and both positive and negative executable evidence, and no rule assigned to another gate is executed or claimed by AX2.

---

## 5. Gate AX3 - symmetric FSM and session control

### Purpose

Seal temporal protocol behavior independently from best-path selection and application forwarding.

### Required proofs

1. The complete state/event table is executable for:
   `Idle`, `Connect`, `Active`, `OpenSent`, `OpenConfirm`, and `Established`.
2. Listener-accepted and dialed transports use the same `PeerSession` reducer
   and Established message matrix.
3. Both acquisition directions originate revision `1` authoritative route
   snapshots on establishment, originate exact successors after local-route
   change, accept the same route-update/ACK matrix, and consume only an exact
   matching ACK.
4. Internal `Acquisition.kind` alone owns reconnect behavior; public
   `direction` is its fixed read-only `dial -> outbound`, `accept -> inbound`
   projection and is never read back as authority.
5. OPEN and KEEPALIVE cannot be skipped, duplicated, or replaced by any
   carrier-native liveness signal; WebSocket Ping/Pong and Loopback activity
   never refresh AGP hold state.
6. OPEN, hold, keepalive, route-write, route-ACK, transport-write, and
   transport-close timers have exact deterministic expiry actions.
7. Inbound and outbound route revisions are independent, start at `1`, and
   consume only the exact successor.
8. Each peer owns one outstanding route snapshot plus one bounded coalesced
   successor; an ACK must match exact `refId` and revision.
9. ACK rejection keys are unique members of that exact outstanding snapshot;
   the accepted set is precisely its complement.
10. ACK timeout terminates the ambiguous session; it does not retransmit an
   indistinguishable revision.
11. Wire revisions never wrap; exhausting the safe range replaces the session
   and restarts complete exchange at revision `1`.
12. Fatal input makes the session non-forwardable before emitting purge/release
   actions.
13. Recoverable route rejections and delivery errors do not advance the
    connection FSM.
14. Cross-dial collision selection is independent of arrival order and both
    nodes retain the same physical winner.
15. An outbound supervisor does not redial while a winning inbound session to
    its configured peer is live; it resumes bounded retry after loss.
16. Every unexpected message/state pair produces the exact notification/close
    behavior and no later input action.
17. Each controller incarnation has one transport-disposition latch: competing
    send failure, read terminal, input rejection, close, abort, and timeout
    outcomes produce one terminal FSM input, one purge, one release, and at
    most one retry decision.
18. Every ended channel attempt emits exactly one mutually exclusive event:
    remote-free `connection.preidentity-closed` when identity was not admitted,
    or `session.closed` keyed by exact `(remoteNodeId, sessionId)` after
    admission. Only a configured dial controller with an armed retry remains,
    retaining one replaceable `lastTransportTerminal`; accepted and
    non-retrying controllers are removed in the same transaction.

FSM tests assert state, emitted actions, timer set, and reason code.\
They do not inspect a concrete transport implementation or assert route selection.

### Exit

`AX3` passes when every legal transition and every illegal state/message family has deterministic evidence for both transport directions.

---

## 6. Gate AX4 - core RIB, forwarding, and export

### Purpose

Seal deterministic routing truth with no node lifecycle or network dependency.

### Required proofs

| Concern | Primary oracle |
|---|---|
| Local candidate | One active binding creates exactly one eligible local candidate |
| Import ownership | Each learned advertisement is owned by exactly one local peer session |
| Full-set replacement | A valid update atomically replaces only its session's Adj-RIB-In; omission withdraws |
| Selection | One deterministic winner exists per endpoint; local and lexical/path tie rules are exact |
| Forwarding | A selected usable route has one matching resolved entry, or both are absent |
| Learned export | Only a selected learned route is exported, and only when transit is enabled |
| Path extension | Import appends the local node once; export copies that complete selected path and never mutates final origin |
| Peer-loop prevention | No route is exported to a peer already present in its path |
| Export-epoch closure | A source withdrawal transaction closes its prior ACKed export epoch to new data and emits an explicit writer dependency after already-admitted data; AX5 owns actual write-order composition |
| Receiver-loop prevention | A received path containing the local node is excluded from candidates |
| Alternative promotion | Loss of a selected candidate atomically promotes the deterministic eligible alternative |
| Session withdrawal | Session loss removes all and only its imported routes and dependent exports in one revision |
| Binding withdrawal | Closing a local binding removes its candidate, forwarding entry, and downstream exports in one revision |
| Revision consistency | Advertisements, candidates, selected routes, forwarding, and Adj-RIB-Out share one committed before/after revision |
| Finite operations domains | A test-only store constructor seeds revision, event sequence, and counters near their unsigned-64 bounds; exact multi-delta preflight replaces the originating mutation with one terminal failure before wrap |
| Capacity | Reservations are bounded and each transaction is atomic; a canonical admissible prefix is accepted and the deterministic remainder is rejected or suppressed with `CAPACITY` |
| Remote rejection recovery | `LOOP`/`PATH_TOO_LONG` wait for tuple/session change; unchanged `POLICY`/`CAPACITY` arm one deterministic saturated exponential retry and never tight-loop from ACK handling |

Pure core tests use deterministic IDs and clocks.\
Mutation-order permutations must converge to the same normalized selected state.\
No core test creates a socket, node listener, management server, or shell process.

The monotonic-domain test seam is internal to the operations store and is not a public runtime option.\
Its three orthogonal cases prove no partial originating mutation, one successor revision, `Failed` with exact domain/counter evidence, zero wrap or saturation, completion of subscribers without a synthetic event, purged logical authority/resources, immutable final queries, and ignored stale callbacks.

### Exit

`AX4` passes when every routing transaction is deterministic, atomic, bounded, and independently reproducible from its input state.

---

## 7. Gate AX5 - uniform node and data behavior

### Purpose

Prove the sole public runtime composes the sealed FSM and RIB into one local and transit data path.

### Uniform runtime proofs

1. `createNode()` is the sole runtime factory.
2. Listener-only, dial-only, listener-plus-dial, local-only, and transit
   configurations instantiate the same implementation.
3. `expose()` installs a local route through the core transaction.
4. Every successful local send and transit forward names the selected route
   and canonical admission revision.
5. Local delivery uses a local forwarding entry and does not decrement hop
   limit.
6. Transit validates a feasible source route owned by ingress, not only the
   locally selected reverse path.
7. Transit requires a selected route for the same source identity to be ACKed
   in egress Adj-RIB-Out; it need not be the selected reverse candidate for the
   ingress.
8. Transit never selects the ingress session as egress.
9. Nonlocal forwarding requires `transit: true` and positive remaining hop
   budget.
10. Schema-valid multi-failure packets produce the one exact result from the
    normative source -> route -> local/transit -> hop -> egress -> size -> export ->
    correlation -> capacity precedence.
11. The injected writer ledger proves every data packet admitted under an ACKed
    source-export epoch is written before the full snapshot that withdraws that
    source; newly submitted data cannot enter the closed epoch.
12. Stop, binding close, and session loss gate new work before releasing
    reservations and handlers.
13. `createNode()` resolves every configured logical transport reference to an
    injected adapter-bound capability before construction and rejects missing
    or wrong-kind resolutions synchronously.
14. The node consumes only `TransportChannelPort`; a transport probe and
    production Loopback channel traverse the same packet codec, serialized FSM,
    session writer, RIB, forwarding, and operations code paths.
15. Core diagnostics are captured as immutable schema-valid
    `DiagnosticRecord` values, emitted after their owning executor turn, and
    cannot alter canonical behavior when the optional sink is absent, throws,
    or re-enters an operations query; raw causes never reach schemas, events,
    management, or protocol records.

### Exact route-miss oracle

The injected public transport probe records every call to its data and control write ports and exposes independent queue reservations.\
Tests take a marker immediately before the stimulus.

For a local route miss:

1. `send()` rejects with typed `NO_ROUTE`;
2. no send receipt is created;
3. no data queue count or byte reservation changes;
4. no connection receives a data-write call after the marker; and
5. the source binding and unrelated routes remain unchanged.

For a transit route miss:

1. one valid data packet is admitted from ingress;
2. every possible egress has zero data-write calls after the marker;
3. data queue count/bytes remain unchanged on every possible egress;
4. exactly one correlated `NO_ROUTE` control error is written directly to
   ingress; and
5. no RIB lookup is performed for the error return.

"No packet observed before a timeout" is insufficient.\
The positive oracle is completion of the rejection/error action on a deterministic executor, followed by inspection of the transport-port call ledger and data-queue reservations.\
A control error is permitted; an onward data packet is not.

The survey does not require a dedicated route-miss event or counter.\
The generic `message-failed` event and existing rejected/lost counter families have their own contracts, but route-miss acceptance never depends on a new metric.

### Reverse-error proofs

- A failure at the current node returns directly to the exact current ingress
  using the received hop token; that first return requires no local breadcrumb.
- A returned error is accepted only from the recorded egress session.
- It is delivered locally or relayed to the recorded ingress without a route
  lookup.
- Expired/missing breadcrumbs and closed ingress sessions discard the error
  once, with no recursive error.
- Breadcrumb count, bytes, and lifetime are bounded.
- Private breadcrumb lookup is `(exact egress controller,
  outboundReturnToken)`; the public six-hex session ID and end-to-end message ID
  are insufficient lookup identities.
- A controller never reuses an outbound return token. Exhaustion replaces the
  session before wrap, preventing an expired-token ABA match.
- A downstream error retains the original message `refId` across every relay.

### Exit

`AX5` passes when every capability is exercised through the same public node and every successful or failed data outcome has exactly one bounded admission path.

---

## 8. Gate AX6 - SDK, HTTP, and CLI parity

### Purpose

Prove one canonical operational truth on every node and preserve truthful operator surfaces.

### SDK proofs

Every node exposes immutable, revision-consistent queries for:

- lifecycle, listeners, configured adjacencies, and live sessions;
- local endpoints;
- Adj-RIB-In advertisements;
- candidates and selected routes;
- forwarding entries;
- per-peer Adj-RIB-Out desired/outstanding/ACKed/rejected/suppressed state,
  including exact local suppression or remote rejection reason;
- bounded reverse correlations;
- queues, capacities, timers, resources, and closed counter catalog.

Snapshots use deterministic ordering and contain no channel, opaque capability, socket, private queue, native address object, or library-private error.\
Listener/adjacency state exposes only logical `transportRef` values and the adapter's bounded sanitized listener publication.\
Consumer mutation cannot affect later state.\
A session/RIB snapshot is ephemeral: restart evidence belongs to `AX7` and expects reconstruction, not identity preservation.\
Session inspection additionally proves there is no terminal-history table: one retrying dial controller retains at most one last terminal.\
Each ended attempt emits exactly one remote-free pre-identity or pair-scoped admitted closure event, and neither event retains controller authority.

AX6 projects the terminal result already sealed by `CORE-MONOTONIC-EXHAUSTION-1`: its exact sovereign failure evidence, last valid counters, final successor revision, zero logical resources, completed subscription, and immutable later queries.\
It cannot reconstruct or soften that result in HTTP or CLI.

### HTTP proofs

1. Each resource performs exactly one matching `OperationsReader` query.
2. Payload data is semantically identical to that SDK snapshot.
3. Metadata carries the same node, revision, and capture time.
4. Every response validates against its sovereign management schema.
5. `/v1/snapshot` is the atomic cross-entity resource.
6. Separate resources do not claim cross-request atomicity during churn.
7. Existing read-only paths remain stable where their entities remain true.
8. Obsolete hub/spoke metadata cannot remain with a false meaning.
9. Method, body, target, concurrency, deadline, and response-size bounds remain
   fail-closed.

### CLI proofs

1. `agpctl` retains only approved read-only commands.
2. `--json` is the exact HTTP response document.
3. Table mode is a pure static `jq` projection of that same document.
4. Routes from every topology placement render local/learned origin, ordered
   path, next hop, eligibility, and selected marker truthfully.
5. Empty state is successful and stable.
6. Hostile fields and terminal controls are sanitized without altering JSON
   mode.
7. No CLI layer creates context/state files, evaluates returned shell text, or
   implements routing logic.
8. Repeated connection queries materialize monotonic uptime and hold TTL at
   one-second display granularity without incrementing the operations revision.

### Cross-surface quiescence

Projection contracts inject one immutable `OperationsReader` fixture and freeze the manual clock at one capture instant.\
SDK data, aggregate/resource HTTP, CLI JSON, and CLI tables must then agree exactly, including `establishedDurationMs`, timer `remainingMs`, and their whole-second rendering.

Live end-to-end tests cannot assume separately sampled time-derived fields are byte-equal merely because the operations revision is unchanged.\
They:

1. wait for a known quiescent `instanceId` and operations revision;
2. compare canonical non-time state only across separately sampled SDK and HTTP
   resources at that same identity/revision;
3. assert each duration/TTL is nonnegative, monotonic in the permitted
   direction, and within the measured capture-window bound;
4. compare CLI JSON and table output to the exact one HTTP document consumed by
   that CLI invocation; and
5. use only the aggregate snapshot for cross-entity comparison during churn.

Revision equality proves state equality, not capture-time equality.\
The frozen projection test owns exact presentation parity; the live test owns bounded sampling behavior.

### Exit

`AX6` passes when every node placement exposes the same truthful operational model and all presentation remains a projection rather than a second source of state.

---

## 9. Gate AX7 - live topology convergence

### Purpose

Prove healthy composition over both canonical production transports and independent node lifecycles before adversity is injected.

Every geometry uses the same executable and `createNode()` package.\
Terms such as center, leaf, edge, or transit describe configuration only.

### Transport execution matrix

| Witness | Required scope | What it uniquely proves |
|---|---|---|
| Production Loopback | Star, line, triangle, diamond, withdrawals, and same-process node-instance replacement | Full kernel composition through real neutral channels with deterministic process-local acquisition; no socket or direct-message bypass |
| Node.js WebSocket | Independent-process star and line, independent process replacement, CLI inspection, and real carrier teardown | Sovereign RFC 6455 binding, operating-system/network isolation, separately startable nodes, and asynchronous operations |
| Behavioral equivalence | Separately owned star and line comparison tests using a shared normalized outcome schema | Same endpoints, session states, selected origins/paths, forwarding outcomes, payloads, withdrawals, and AGP timer behavior after removing permitted ephemeral IDs/timestamps/publications |

Equivalence never compares native addresses, carrier timing, instance IDs, or session IDs.\
It does compare every protocol-visible outcome.\
Loopback is not a mock and WebSocket is not the reference semantics: both must first pass the same neutral conformance obligations, then the node-level witnesses above.\
Failures remain in independently named test files rather than one transport-parameterized aggregate.

Each certified node in this matrix uses one concrete adapter composition.\
A resolver mixing WebSocket and Loopback capabilities inside one node is outside v1 certification under F06, even though the neutral interface does not encode a carrier kind.

### Geometry matrix

| Geometry | Configuration | Convergence proof | Data/control proof |
|---|---|---|---|
| Star | Center listens/transits and exposes one local endpoint; two leaves dial and expose distinct plus deliberately duplicated endpoints | All three nodes have populated selected RIB/FIB; center learns both direct paths and retains its local route; each leaf learns the center and the other leaf through selected export | Bidirectional leaf-to-leaf JSON follows selected routes; each leaf also delivers JSON to the center-local endpoint; duplicate advertisements retain one deterministic winner and one observable alternate at the center |
| Line `A-B-C` | A and C are edges; B listens/dials as required and permits transit | A imports C as `[C,B]` and selects `[C,B,A]`; C imports A as `[A,B]` and selects `[A,B,C]`; B holds direct selected paths | A<->C succeeds in two data hops; hop limit decrements once at B; source feasible-path validation accepts each direction |
| Triangle | A, B, and C form three adjacencies and permit transit | Each endpoint has one deterministic selected path; no installed/exported path repeats a node; split-path exports do not feed back to a path member | Duplicate arrival order does not change normalized selection; no packet traverses a stable control-plane loop |
| Diamond | Source edge connects to left/right transit nodes, both connect to destination edge | Both candidates are visible; exactly one deterministic candidate is selected and forwarded | Healthy traffic uses only the selected branch; the alternate remains observable but receives no duplicate data |

Each Loopback geometry is one test file with one primary healthy-topology oracle.\
Payload preservation and route convergence are separated when they would otherwise create multiple primary axes.\
Selected-branch loss and promotion are owned by the `AX8` fault battery; `AX7` does not inject that adversity.

### Withdrawal proofs

Dedicated tests vary one withdrawal source:

1. local binding close;
2. authoritative route-snapshot omission;
3. explicit route rejection in a later full snapshot;
4. live session loss; and
5. node stop.

For each, affected state disappears hop-by-hop through committed full snapshots; unrelated routes remain; later data never uses a withdrawn next hop.\
Session-loss cascading may produce several node revisions, but each individual node revision is internally atomic.

### Restart proof

A line node is stopped and replaced by a new node instance on the same application-owned Loopback fabric.\
A separately owned WebSocket test stops and replaces one operating-system process using freshly constructed adapter capabilities and the same persisted configuration intent:
```text
empty runtime state
-> endpoint intent re-registered
-> adjacencies re-established
-> authoritative snapshots exchanged
-> equivalent reachability reconstructed
```

The oracle compares endpoint reachability, selected origin/path, and forwarding usability.\
It explicitly does not require the old session IDs, route IDs, wire revisions, timestamps, counters, or transition history to survive.\
Before reconvergence, the replacement node exposes no phantom Established session or usable learned route.

### Independent-process WebSocket proof

The star and line geometries launch each node as a separately startable operating-system process with its own configuration and management endpoint.\
Each process composes its own Node.js WebSocket adapter before `createNode()`.\
Readiness records expose node ID, logical transport references, sanitized listener publication, management URL, and process identity.

The independent-process star exposes one named endpoint on the center and at least two distinct named endpoints on each leaf.\
After convergence:

1. the center and opposite leaf expose all remote endpoint names in their
   canonical route views;
2. every named endpoint is exercised in both request directions without
   collapsing the assertions into one aggregate "some route worked" oracle;
3. each leaf resolves and delivers independently sourced JSON to the
   center-local endpoint;
4. a deliberately duplicate leaf endpoint leaves both eligible candidates
   visible at the center with exactly one deterministic selection;
5. the processes remain running after readiness and routing acceptance; and
6. a separately invoked CLI acceptance test queries `connections.list` and
   `routes.list` asynchronously against each published management URL and
   verifies the established adjacencies, every expected endpoint, selected
   marker, path, and six-hex local session display.

No example process depends on being spawned in one parent shell to discover its peers; each is independently startable from its declared configuration.\
Teardown remains a separate bounded oracle and leaves no child or listening socket.

### Exit

`AX7` passes when every geometry converges without arbitrary sleeps, every withdrawal converges without stale forwarding, and restart reconstructs reachability from empty runtime state.\
Both adapters pass their common conformance suites; Loopback uses no privileged kernel path; and normalized star/line outcomes are equivalent.\
The independently started WebSocket star must also retain at least two named endpoints per leaf, advertise and terminate its center-local endpoint, retain both candidates for its duplicate leaf endpoint, and remain inspectable through separately invoked CLI processes.

---

## 10. Gate AX8 - chaos, learning, and release

### Purpose

Prove the sealed graph under deterministic adversity, capture every discovery, and issue the only release certificate.

### 10.1 Standard entropy battery

Each fault is an independent test file with one primary injected variable.

| Fault family | Injection | Invariant that must survive |
|---|---|---|
| Node death | Terminate an edge or transit process at a named barrier | Sessions and owned routes withdraw; alternatives promote; unrelated nodes remain responsive |
| Route-update loss | Drop one outbound update or ACK through an injected transport | Finite timer tears down ambiguity; reconnect sends a fresh authoritative snapshot |
| Write/close failure | Fail one exact control/data write or stall close | Reservation releases once; teardown remains bounded; no stale forwarding |
| Jitter and reorder | Deliver scripted connection events at deterministic virtual times | Illegal revision/order is rejected exactly; legal concurrent events linearize once |
| Cross-dial race | Release two simultaneous dials/accepts in both arrival orders | Both nodes retain the same canonical physical session and suppress loser retry |
| Receiver-loop input | Inject a schema-valid received path containing the local receiver | Route receives nonfatal `LOOP`, is never installed, and sibling routes still converge |
| Peer-loop export | Select a route whose path already contains the target export peer | Route is visibly suppressed as `PEER_IN_PATH`, no update advertises it to that peer, and other exports still converge |
| Hop exhaustion | Deliver transit data at the last usable hop | Zero onward data packet and one correlated reverse error |
| Queue saturation | Fill one exact count/byte/handler capacity | No unbounded wait; control readiness survives; unrelated sessions continue |
| Malformed/oversized peer | Send invalid UTF-8, schema, depth, numeric, or size input | Only offending session terminates; valid sibling routing remains usable |
| Cascading withdrawal | Remove the selected branch while successor exports are outstanding | Per-node transactions remain atomic; final state converges or fails with bounded typed evidence |
| Handler/drain race | Hold a handler while binding/node stop reaches its deadline | Signal aborts, reservations release once, late settlement cannot mutate state |
| Observer pressure | Overflow one bounded event subscriber | Canonical state remains correct and the subscriber receives explicit gap evidence if retained by contract |

### 10.2 Severity profiles

The standardized battery has fixed profiles:

| Profile | Meaning | Requirement |
|---|---|---|
| `C0` | No injected fault | Supplied by `AX7`; establishes the geometry baseline |
| `C1` | One fault at one named linearization barrier | Every fault-family row executes against its smallest relevant geometry |
| `C2` | Two documented overlapping faults | Mandatory pairs: selected-branch death + outstanding export; reconnect + cross-dial; saturation + withdrawal |

Seeds, barriers, and fault schedules are committed fixtures.\
Randomly generated fuzz cases may supplement the battery but cannot replace the deterministic profiles.\
Failure causes the owning lower gate to reopen.

These profiles certify the declared AGP sandbox envelope only.\
Running each fault against its smallest relevant geometry is A9-derived partial evidence; it does not claim the full A9 obligation to exercise every documented consumer workflow and production graph.

### 10.3 No-onward-packet under chaos

Route miss, hop exhaustion, transit disabled, ingress-equals-egress, source unauthorized, and next-hop loss all use the `AX5` transport-call-ledger oracle:

- take a data-write marker;
- inject one admitted stimulus;
- await the typed terminal admission/error action;
- assert zero onward data-write calls and unchanged egress data reservations;
- assert only the permitted correlated control error; and
- prove the sibling route/session remains usable.

This is exercised at `C1` and in the selected-branch-loss `C2` profile.

### 10.4 Learning record

Every unexpected failure is captured as a finding at discovery, before its root cause is known.\
A finding names the gate that surfaced it, the observed fault, the layer that owns it, and its status.

A finding closes in exactly one of two ways:

- **fixed** requires a root cause, the design invariant that was violated, an
  orthogonal regression test, and a traceability update at the owning layer; or
- **explicitly-deferred** requires a root cause, a deferral reason, a named
  authority, and an explanation of why the current release envelope is not
  violated.

A workaround does not close a finding, and incomplete knowledge does not delay capture.\
An open finding invalidates the gate that references it.\
Recurrence of a fixed finding fails `AX8` independently.

The durable record is the regression test plus the fault named in the consequence section of the contract that owns it.\
This is the AGP finding-lifecycle subset only; it does not claim the full A14 attention-ledger, tangent-discipline, or measured-payback mechanics.

---

### 10.5 Scope of claim

A complete `AX0..AX8` pass certifies the AGP artifact within a sandbox envelope:
```text
scope: AGP artifact sandbox
A9:  sandbox-derived partial evidence
A14: finding-lifecycle subset evidence
A0:  lineage context only; not certified
```

A production deployment claiming chaos certification needs an additional deployment-owned record containing:

- observed production fault distributions;
- the defined simulation-to-production fidelity metric and threshold;
- evidence that the entropy fixtures reflect those observations; and
- a feedback cadence that updates the battery when the threshold is exceeded.

The library cannot manufacture production telemetry and does not claim deployment certification on a consumer's behalf.\
Even that record is necessary but not sufficient for a Mission Kit A9 claim: the deployment owner must also prove its standardized battery covers every documented workflow and production graph, runs as a deterministic trunk/release gate, and maintains the required production-feedback/fidelity loop.

### Exit

`AX8` passes when:

1. all earlier gate manifests are valid for the same source;
2. `C0`, every `C1` row, and every mandatory `C2` pair pass;
3. no resource or process leaks remain;
4. every referenced finding is fixed or explicitly deferred with authority and
   no open/investigating finding remains;
5. every fix has an orthogonal recurrence test;
6. no fixed finding has recurred;
7. committed schemas/generated outputs match their digests; and
8. the artifact certificate states its sandbox/partial-axiom scope without
   implying A0, full A9/A14, or production telemetry conformance.

---

## 11. Required test-file ownership map

Paths selected as `owningTest` by the semantic-rule registry are normative and exact.\
Other file names may be refined before implementation, but every primary contract remains singular and non-overlapping.

| Gate | Proposed file | One primary contract |
|---|---|---|
| AX0 | `test/conformance/traceability-graph.test.js` | Trace schema/data validate; every U/D requirement has ratified authority, one owner, and resolvable references |
| AX0 | `test/conformance/coverage-register.test.js` | The coverage permutation register names only runnable tests, keeps every axis populated, and states a re-entry condition for each exclusion |
| AX0 | `test/conformance/verification-ownership-map.test.js` | Every gate-named test file in section 14 exists, no gate repeats one oracle, and each named file also carries suite ownership |
| AX0 | `test/conformance/design-mrc.test.js` | Every exact normative design artifact carries one mechanics/rationale/consequence triad |
| AX0 | `test/conformance/design-link-integrity.test.js` | Every local Markdown and trace design reference resolves to its exact file and anchor |
| AX0 | `test/conformance/design-vocabulary.test.js` | Canonical cross-document terms are present and forbidden stale API/schema vocabulary is absent |
| AX0 | `test/conformance/consequence-of-violation.test.js` | Every design contract enumerates the concrete faults it averts, so a shortcut cannot be adopted without meeting the fault it recreates |
| AX1 | `test/conformance/schema-catalog-composition.test.js` | Root catalog contains every package entry and no copied named DTO |
| AX1 | `test/conformance/schema-generation-isolation.test.js` | Every package-owned catalog and generated DTO set regenerates and typechecks in an isolated consumer without ambient undeclared dependencies |
| AX1 | `test/conformance/event-schema-catalog.test.js` | Every concrete event/data schema has one exact URN/type/discriminator and root-union reference |
| AX1 | `packages/core/test/unit/operational-event-schema.test.js` | The generated event vocabulary and kind/data union accept every exact runtime variant while rejecting legacy, unknown, and malformed variants |
| AX1 | `packages/core/test/unit/session-transition-schema.test.js` | Optional transition reason data may be absent without a schema/runtime projection mismatch |
| AX1 | `packages/core/test/unit/diagnostic-record-schema.test.js` | The sole core diagnostic record accepts every closed domain/severity boundary while rejecting extensions, unbounded text, and any serialized cause/context/details |
| AX1 | `packages/*/test/contract/schema-catalog.test.js` | Each owning package proves its whole catalog: exact identities, paths, digests, resolved references, and generated-type correspondence |
| AX1 | `test/conformance/public-node-consumer.test.js` | A consumer compiles using `createNode()` and package-root exports only |
| AX1-T | `packages/transport/test/contract/public-capabilities.test.js` | Neutral handwritten capabilities compose only sovereign records and expose the exact acquisition/channel signatures |
| AX1-T | `packages/transport/test/contract/diagnostic-sink.test.js` | The neutral transport sink accepts only generated `TransportDiagnostic`; raw cause stays a separate process-local argument and absent/throwing sinks are semantically inert |
| AX1-T | `packages/transport/test/contract/conformance-case-coverage.test.js` | Every T01-T21 invariant and section 18 obligation maps to one independently named reusable case and adapter-owned invocation |
| AX1-T | `packages/transport/test/contract/channel-order-rule.test.js` | The neutral reusable case preserves packet bytes, boundaries, duplicate-free FIFO order, and terminal cut-off |
| AX1-T | `packages/transport/test/contract/terminal-once-rule.test.js` | The neutral reusable case linearizes competing native outcomes to one immutable terminal and stable later reads |
| AX1-T | `packages/transport/test/contract/acceptance-callback-fault.test.js` | The reusable `accept`/capacity callback-fault case fixes cleanup order, private diagnostics, first-terminal-wins, and transferred-channel survival |
| AX1-T | `packages/transport-node-ws/test/conformance/<transport-axis>.test.js` | One file per common acquisition, packet, pressure, cancellation, evidence, or terminal axis proves the Node.js adapter against the neutral case |
| AX1-T | `packages/transport-node-ws/test/conformance/send-dispatch-cancellation.test.js` | Cancellation before `ws.send()` proves non-acceptance; cancellation after dispatch but before callback is unknown `SEND_FAILED` and one immutable carrier failure |
| AX1-T | `packages/transport-node-ws/test/conformance/acceptance-callback-fault.test.js` | The real WebSocket listener invokes the neutral callback-fault case without an escaped throw, leaked upgrade, or transferred-channel closure |
| AX1-T | `packages/transport-node-ws/test/contract/diagnostic-sink.test.js` | The WebSocket factory owns optional sink injection and never serializes native cause material or changes behavior when the sink throws |
| AX1-B | `packages/binding-websocket/test/contract/packet-mapping.test.js` | `agp.v1`, one binary WebSocket message per packet, fragmentation reassembly, and deterministic legacy-text rejection without fallback are exact |
| AX1-B | `packages/binding-websocket/test/contract/terminal-mapping.test.js` | Neutral close/abort/terminal records map to RFC 6455 without exporting native codes |
| AX1-B | `packages/binding-websocket/test/contract/reference-uniqueness.test.js` | Listener and target references are each unique by key while the same key may occur once in each acquisition kind |
| AX1-B | `packages/transport-node-ws/test/contract/trusted-development-profile.test.js` | The trusted-development profile accepts only `ws:` and emits exact network/none/unauthenticated evidence |
| AX1-B | `packages/transport-node-ws/test/contract/preshared-key-profile.test.js` | The pre-shared-key profile completes a real TLS 1.3 handshake, reports a verified principal only where one was observed, refuses a peer without the secret before any channel exists, and leaks no secret into an emitted record |
| AX1-L | `packages/transport-loopback/test/contract/production-surface.test.js` | Public fabric/configuration/operations/lifecycle schemas expose a production capability without private queue authority |
| AX1-L | `packages/transport-loopback/test/contract/operations-adapter-invariant-failure.test.js` | An adapter invariant freezes one distinct `ADAPTER_FAULT` fabric record, terminalizes retained resources once, and keeps its private cause diagnostic-only |
| AX1-L | `packages/transport-loopback/test/contract/operations-snapshot-retention.test.js` | Normal rows remain bounded live-resource records while a failed fabric freezes only its capacity-bounded terminal set |
| AX1-L | `packages/transport-loopback/test/contract/operations-monotonic-exhaustion.test.js` | Seeded near-boundary revision, multi-delta counter, and arbitration cases fail and freeze the fabric exactly once before wrap |
| AX1-L | `packages/transport-loopback/test/contract/diagnostic-sink.test.js` | Fabric dependencies own optional neutral sink injection; absent and throwing sinks preserve exact scheduler, terminal, and accounting outcomes |
| AX1-L | `packages/transport-loopback/test/conformance/<transport-axis>.test.js` | One file per common transport axis proves Loopback through its public adapter surface |
| AX1-L | `packages/transport-loopback/test/conformance/acceptance-callback-fault.test.js` | The serialized listener scheduler invokes the neutral callback-fault case with exact fabric accounting and isolation from other listeners |
| AX1-D | `test/conformance/transport-sovereignty.test.js` | Dependency and vocabulary scans prove carrier concepts occur only in their sovereign binding/adapter owners |
| AX2 | `test/conformance/semantic-rule-registry.test.js` | Every referenced rule resolves once with exact phase, schema inputs, result set, design/implementation paths, and owning test |
| AX2 | `packages/protocol/test/unit/open-identity.test.js` | Static OPEN identity admission accepts only a distinct remote node, the configured expected node when present, and an identity-port approval; live pair allocation is excluded |
| AX2 | `packages/protocol/test/unit/route-path-semantics.test.js` | Identity-admitted sender/origin/receiver/path rules have exact outcomes |
| AX2 | `packages/protocol/test/unit/return-token-shape.test.js` | Hop token fixed-width lexical validity and distinct semantic type are exact |
| AX2 | `packages/protocol/test/unit/route-path-limit.test.js` | Import equality accepts exactly when wire path plus receiver fits the negotiated bound |
| AX3 | `packages/core/test/unit/peer-fsm-establishment.test.js` | Symmetric handshake reaches Established only through OPEN/KEEPALIVE |
| AX3 | `packages/core/test/unit/peer-fsm-established-matrix.test.js` | Established dispatch admits only the closed wire-message type matrix; unsupported state/type pairs return `UNEXPECTED_MESSAGE` without testing payload effects |
| AX3 | `packages/core/test/unit/peer-fsm-route-exchange.test.js` | Dialed and accepted sessions both originate initial/change snapshots and consume exact ACKs |
| AX3 | `packages/core/test/unit/peer-fsm-timers.test.js` | Each protocol timer produces its exact transition/action |
| AX3 | `packages/core/test/unit/peer-fsm-revisions.test.js` | Independent inbound/outbound revisions accept only the exact successor and never wrap |
| AX3 | `packages/core/test/unit/peer-fsm-route-ack.test.js` | Outstanding/coalesced ACK correlation and rejection complement are exact |
| AX3 | `packages/core/test/unit/peer-fsm-route-admission.test.js` | Allowed, denied, faulted, expired, and stale tokened admission continuations have exact actions |
| AX3 | `packages/core/test/unit/peer-fsm-cross-dial.test.js` | Both arrival orders retain the same canonically keyed physical winner |
| AX3 | `packages/core/test/unit/session-pair-scope.test.js` | The same six-hex local ID may coexist for different remote nodes but not two retained controllers for one node pair |
| AX3 | `packages/core/test/unit/adjacency-retry-suppression.test.js` | Winning inbound adjacency suppresses, then loss resumes, bounded configured retry |
| AX3 | `packages/core/test/unit/peer-fsm-teardown.test.js` | Fatal input makes the session non-forwardable before purge/release and rejects later input |
| AX3 | `packages/core/test/unit/transport-loss-disposition.test.js` | Graceful close, input rejection, and transport failure have one closed teardown/retry disposition matrix |
| AX3 | `packages/core/test/unit/session-terminal-retention.test.js` | Only an armed-retry dial controller retains one replaceable last terminal; accepted and non-retrying controllers are removed atomically |
| AX4 | `packages/core/test/unit/route-import.test.js` | Full snapshots replace only their session-owned Adj-RIB-In |
| AX4 | `packages/core/test/unit/route-selection.test.js` | Deterministic single-route selection is mutation-order independent |
| AX4 | `packages/core/test/unit/route-export-eligibility.test.js` | Local/transit/capacity export decisions produce the exact desired set and reason |
| AX4 | `packages/core/test/unit/route-receiver-loop.test.js` | Receiver-containing import is nonfatally rejected and never installed |
| AX4 | `packages/core/test/unit/route-peer-loop.test.js` | Peer-containing selected path is suppressed only for that export peer |
| AX4 | `packages/core/test/unit/export-epoch-closure.test.js` | Withdrawal closes the prior source epoch and emits the writer dependency without performing I/O |
| AX4 | `packages/core/test/unit/route-alternative-promotion.test.js` | Pure candidate loss atomically promotes the deterministic alternative |
| AX4 | `packages/core/test/unit/route-session-withdrawal.test.js` | Session loss removes all and only session-owned routing state in one revision |
| AX4 | `packages/core/test/unit/route-binding-withdrawal.test.js` | Binding close removes its local candidate/FIB/exports in one revision |
| AX4 | `packages/core/test/unit/bounded-capacity.test.js` | Bounded count, byte, and work reservations release exactly once and refuse admission past their limit |
| AX4 | `packages/core/test/unit/route-capacity.test.js` | Each bounded routing reservation is all-or-nothing with canonical overflow outcomes |
| AX4 | `packages/core/test/unit/rib-remote-rejection-memory.test.js` | An exact rejected export tuple remains filtered with its code/revision until tuple change or session replacement, without exercising retry scheduling |
| AX4 | `packages/core/test/unit/route-remote-rejection-retry.test.js` | Rejection-code recovery, saturated backoff, cancellation, and absence of immediate resend are exact |
| AX4 | `packages/core/test/unit/rib-atomic-revision.test.js` | One route transaction exposes only its complete before/after projections and advances the operations revision exactly once |
| AX4 | `packages/core/test/unit/monotonic-domain-exhaustion.test.js` | Near-boundary revision, event-sequence, and multi-delta counter cases atomically replace the originating mutation with one inspectable terminal failure and never wrap or silently saturate |
| AX5 | `packages/node/test/contract/uniform-capabilities.test.js` | One implementation composes listener/dial/local/transit capabilities |
| AX5 | `packages/node/test/contract/transport-reference-composition.test.js` | Every configured listener/peer reference resolves by kind before construction and opaque authority never enters kernel state |
| AX5 | `packages/node/test/contract/peer-adjacency-uniqueness.test.js` | `peers[].adjacencyId` is unique within one node and duplicates fail synchronous construction with `CONFIG_INVALID` before resolution or I/O |
| AX5 | `packages/node/test/contract/transport-disposition-latch.test.js` | Competing channel outcomes claim one controller-incarnation latch and cannot duplicate terminal FSM input, purge, release, or retry |
| AX5 | `packages/node/test/contract/identity-peer-evidence.test.js` | Identity admission receives the exact immutable channel evidence; static configuration cannot replace or forge it |
| AX5 | `packages/node/test/contract/listener-terminal-lifecycle.test.js` | Terminal observation is armed before `Running`; pre-commit failure fails start, runtime failure fails the node once, and node-owned stop suppresses re-entry |
| AX5 | `packages/node/test/contract/acceptance-callback-fault-lifecycle.test.js` | An acceptance-callback listener terminal fails a Running node once while the disposition latch prevents duplicate teardown and transferred channels remain session-owned |
| AX5 | `packages/node/test/contract/diagnostic-sink.test.js` | Core diagnostics are schema-valid immutable captures emitted after executor release; absent, throwing, and re-entrant sinks cannot alter canonical outcomes and raw causes never serialize |
| AX5 | `packages/node/test/contract/local-data-admission.test.js` | Successful local send/delivery names one selected route/revision and exact capacity |
| AX5 | `packages/node/test/contract/transit-feasible-source.test.js` | Transit accepts only the exact ingress-owned feasible source without requiring selected reverse path |
| AX5 | `packages/node/test/contract/source-export-barrier.test.js` | Peer data waits for exact ACKed source export and never enters a hidden readiness queue |
| AX5 | `packages/node/test/contract/transit-disabled.test.js` | Nonlocal transit-disabled input emits one error and zero onward data writes |
| AX5 | `packages/node/test/contract/hop-exhaustion.test.js` | Last usable hop emits one error and zero onward data writes |
| AX5 | `packages/node/test/contract/ingress-egress-inequality.test.js` | The exact ingress session is never selected as egress |
| AX5 | `packages/node/test/contract/local-route-miss.test.js` | Typed local `NO_ROUTE` creates no reservation or data write |
| AX5 | `packages/node/test/contract/transit-route-miss.test.js` | Transit `NO_ROUTE` writes one direct-ingress error and zero onward data |
| AX5 | `packages/node/test/contract/data-failure-precedence.test.js` | Every transit multi-failure case commits only the first ordered failure, at most one ingress error, and zero onward data writes |
| AX5 | `packages/node/test/contract/direct-delivery-error.test.js` | Current-node failure constructs one exact hop-token error directly to ingress |
| AX5 | `packages/node/test/contract/reverse-error-relay.test.js` | A valid transit breadcrumb relays to its exact recorded ingress while translating only the hop token and preserving the validated failure body |
| AX5 | `packages/node/test/contract/reverse-error-no-rib.test.js` | Local resolution, relay, and unreturnable reverse-error outcomes consult only exact breadcrumb/controller state and perform zero destination-RIB lookups |
| AX5 | `packages/node/test/contract/reverse-error-consume-once.test.js` | The first valid matching error consumes its breadcrumb; replay cannot deliver or relay a second outcome |
| AX5 | `packages/node/test/contract/reverse-error-refid.test.js` | A matching token with the wrong end-to-end `refId` is discarded without consuming the breadcrumb |
| AX5 | `packages/node/test/unit/return-token-allocator.test.js` | Unsigned-64 allocation never repeats and terminal exhaustion replaces the controller before wrap |
| AX5 | `packages/node/test/contract/withdrawal-writer-order.test.js` | Already-admitted epoch data writes precede its withdrawing snapshot |
| AX5 | `packages/node/test/contract/stop-drain.test.js` | Stop gates new work and releases handlers/reservations once within its deadline |
| AX5 | `packages/node/test/contract/lifecycle-one-shot.test.js` | A runtime follows its closed lifecycle once; `Stopped` and `Failed` reject restart and stale-instance callbacks cannot regain authority |
| AX5 | `packages/node/test/contract/operational-event-schema.test.js` | Events emitted across live lifecycle, routing, data, handler, and teardown activity all validate against the generated sovereign kind/data union |
| AX6 | `packages/core/test/unit/operations-reader.test.js` | Every bounded canonical entity is immutable, ordered, and revision-consistent |
| AX6 | `packages/core/test/unit/session-closed-event.test.js` | Every identity-admitted ended attempt emits one exact pair-scoped `session.closed` while operations retain no terminal history |
| AX6 | `packages/core/test/unit/connection-preidentity-closed-event.test.js` | Every pre-admission ended attempt emits one remote-free `connection.preidentity-closed` and never invents remote identity |
| AX6 | `packages/core/test/unit/operations-time-materialization.test.js` | Frozen monotonic clock produces exact duration/remaining-time fields, zero/max-safe presentation clamps, and no revision mutation |
| AX6 | `packages/management-http/test/contract/operations-projection.test.js` | Each resource is exact schema-valid SDK data from one reader call |
| AX6 | `cli/test/contract/read-only-drivers.test.js` | Each command issues one exact safe GET to its stable resource |
| AX6 | `cli/test/unit/connections-template.test.js` | Connection rows purely render six-hex ID, state, event, frozen uptime, and TTL |
| AX6 | `cli/test/unit/route-template.test.js` | Route rows are deterministic pure projections with no route choice |
| AX6 | `test/e2e/operations-frozen-parity.test.js` | Frozen-reader SDK, HTTP, CLI JSON, and tables agree exactly |
| AX6 | `test/e2e/operations-live-time-bounds.test.js` | Same-revision live state agrees while separately sampled durations satisfy capture-window bounds |
| AX7 | `test/topology/star-convergence.test.js` | Production Loopback star populates every RIB and routes one named leaf flow through neutral packet channels |
| AX7 | `test/topology/line-transit.test.js` | Production Loopback selected learned routes support symmetric two-hop data |
| AX7 | `test/topology/triangle-loop-prevention.test.js` | Production Loopback propagation cannot install/export a repeated-node loop |
| AX7 | `test/topology/diamond-selection.test.js` | Production Loopback diamond exposes both candidates and forwards on exactly one selected branch |
| AX7 | `test/topology/withdrawal-binding-close.test.js` | One local binding close propagates without removing unrelated reachability |
| AX7 | `test/topology/withdrawal-snapshot-omission.test.js` | One authoritative omission propagates without stale forwarding |
| AX7 | `test/topology/withdrawal-route-rejection.test.js` | One later rejection withdraws only the identified route |
| AX7 | `test/topology/withdrawal-session-loss.test.js` | One live-session loss cascades only its owned routes |
| AX7 | `test/topology/withdrawal-node-stop.test.js` | One orderly node stop converges without phantom next hops |
| AX7 | `test/topology/restart-reconvergence.test.js` | A replacement node on the same Loopback fabric reconstructs equivalent reachability from empty state |
| AX7 | `test/e2e/transport-equivalence-star.test.js` | Independently obtained Loopback and WebSocket star witnesses normalize to the same protocol/RIB/data outcome |
| AX7 | `test/e2e/transport-equivalence-line.test.js` | Independently obtained Loopback and WebSocket line witnesses normalize to the same two-hop routing and payload outcome |
| AX7 | `test/e2e/independent-star-multi-endpoint.test.js` | Independently started star processes route at least two named endpoints per leaf |
| AX7 | `test/e2e/independent-star-hub-endpoint.test.js` | Both independently started spokes learn the hub-local endpoint and deliver distinct JSON messages to its handler |
| AX7 | `test/e2e/independent-star-duplicate-route.test.js` | Two spoke origins for one endpoint remain eligible while the hub selects one deterministic winner |
| AX7 | `test/e2e/independent-star-cli-inspection.test.js` | Separate asynchronous CLI invocations inspect every live star management URL and expected endpoint |
| AX7 | `test/integration/secure-websocket-star.test.js` | A pre-shared-key star converges and transits JSON, and a peer holding a valid secret but claiming another node is denied on security evidence |
| AX7 | `test/e2e/independent-line.test.js` | Independently started line processes prove symmetric multi-hop routing |
| AX7 | `test/e2e/independent-restart-reconvergence.test.js` | A replaced WebSocket process rebuilds equivalent reachability with fresh adapter/session authority |
| AX7 | `test/e2e/process-cleanup.test.js` | Explicit stop leaves no child process or listening socket |
| AX8 | `test/resilience/selected-branch-loss.test.js` | Injected selected-branch death promotes one alternative without duplicate data |
| AX8 | `test/resilience/<fault-family>.test.js` | One file per remaining AX8 entropy-family row and exactly one injected variable |
| AX8 | `test/resilience/<mandatory-pair>.test.js` | One file per named C2 pair; overlap schedule is its sole primary chaos axis |

Each owning README records what the file explicitly does not test.\
Adding a new file requires assigning it a previously unowned axis or splitting an over-broad existing owner.

---

## 12. Mechanics, rationale, and consequence

### Mechanics

Each gate names one proof layer, the evidence that seals it, and an exit condition.\
Gates ascend in the order declared by [`VERIFICATION.md`](verification.md#21-binary-gated-ascension), and section 11 binds every required test file to the gate that owns it, so a gate's claim is resolvable to executable evidence rather than to prose.

### Rationale

A failure is only useful if it identifies the layer that owns it.\
Separating the gates from the certification model lets the model state how certification works once, while each gate states only what it proves.\
A reader auditing one layer reads one section, and a reader changing the model does not have to re-read nine gate definitions to find it.

### Consequence of violation

- A gate that proves a fact owned by a lower layer makes a failure
  unattributable, because two gates now fail for one defect and neither
  identifies the owner.
- A gate whose evidence is prose rather than a named test file cannot be
  re-run, so its claim decays silently as the code beneath it changes.
- Certifying a gate over an unsealed predecessor lets a green upper layer
  conceal a broken foundation, which is the exact failure the ascension order
  exists to prevent.
- Naming a test file that does not exist makes the ownership map fiction; the
  map is only load-bearing while every row resolves.
