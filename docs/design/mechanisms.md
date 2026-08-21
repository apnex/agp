# AGP uniform node - mechanism and feature index

> **Status:** Ratified. Current mechanism index.\
> Classifications describe the authoritative AGP v1 target; gate definitions are in [`verification.md`](verification.md).

## 1. Purpose

This is the entry point for reasoning about AGP behavior.\
It prevents a familiar mechanism from being copied approximately, renamed accidentally, or silently diverging from its source.

Each mechanism is classified as:

- **Aligned** - AGP preserves the externally meaningful semantics that apply
  in its domain. This does not imply BGP wire compatibility or RFC conformance.
- **Adapted** - AGP adopts the proven structure but changes named mechanics;
  the change and its consequence are explicit.
- **Departure** - AGP deliberately chooses a different mechanism.
- **AGP-native** - no borrowed mechanism is claimed as its authority.
- **Deferred** - a known mechanism is excluded from AGP v1 without closing the
  architectural path to add it later.

RFCs are design references.\
AGP's schemas and owning design sections remain normative: an RFC rule applies only where this index and the owning AGP contract explicitly adopt it.

---

## 2. Current AGP v1 mechanisms

| ID | Mechanism or feature | AGP v1 rule | Relation | Canonical analogue | Normative AGP owner | Gate |
|---|---|---|---|---|---|---|
| M01 | Uniform node | One `createNode()` implementation composes listen, dial, endpoint, routing, and transit capabilities; topology position is configuration, not a role. | AGP-native | - | [`README.md` section 2](README.md#2-mandate), [`sdk.md` section 3](sdk.md#4-public-node-api) | AX5 |
| M02 | AGP JSON packet language | One complete bounded UTF-8 JSON document is one AGP packet. Packet shape and semantics are independent of carrier framing. | Departure from BGP wire protocol; aligned with JSON | [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) | [`protocol.md` section 2](protocol.md#2-packet-and-envelope-language), [`contracts.md` section 4](contracts.md#4-protocol-schema-catalog) | AX1, AX2 |
| M03 | Symmetric peer session | Once established, either acquisition kind may send every legal route/control/data message. Internal `dial|accept` controls reconnect ownership only; public `outbound|inbound` is its fixed read-only projection. | Adapted | BGP peer sessions in [RFC 4271](https://www.rfc-editor.org/rfc/rfc4271) | [`protocol.md` sectionsection 1,8](protocol.md#1-mandate), [`fsm.md` section 1](fsm.md#1-model) | AX3 |
| M04 | Connection FSM | Retain `Idle`, `Connect`, `Active`, `OpenSent`, `OpenConfirm`, and `Established`; require OPEN and received KEEPALIVE before establishment. Reconnect supervision is outside the per-connection FSM. | Adapted | RFC 4271 sectionsection 8-10 | [`fsm.md`](fsm.md) | AX3 |
| M05 | OPEN identity and bounds | OPEN binds node/session identity, then negotiates receive, route, path, hop, and timer bounds before data or routing is legal. | Adapted | RFC 4271 section 4.2; bilateral-use principle from [RFC 5492](https://www.rfc-editor.org/rfc/rfc5492) | [`protocol.md` section 3](protocol.md#3-open), [`fsm.md` section 6](fsm.md#6-transition-tables) | AX2, AX3 |
| M06 | Fixed v1 capability set | Symmetric path-vector exchange, reverse errors, and data hop limits are mandatory AGP v1 behavior rather than optional capability TLVs. Unknown body fields remain invalid. | Departure | RFC 5492 capability extensibility | [`protocol.md` section 3](protocol.md#3-open), [`contracts.md` section 4](contracts.md#4-protocol-schema-catalog) | AX1, AX2 |
| M07 | Hold and keepalive timers | Zero disables both; otherwise keepalive is one third of negotiated hold. Any valid inbound AGP envelope proves peer liveness; any successful outbound envelope suppresses unnecessary keepalive. | Adapted | RFC 4271 sectionsection 4.4, 6.5, 8, 10 | [`fsm.md` section 5](fsm.md#5-timers) | AX3 |
| M08 | Stalled-writer protection | Every write and close is finitely timed; queues are bounded; inability to send mandatory control traffic tears down the session rather than retaining stale routing state. | Aligned in safety outcome; different timer granularity | [RFC 9687](https://www.rfc-editor.org/rfc/rfc9687) Send Hold Timer | [`fsm.md` sectionsection 5,6](fsm.md#5-timers), [`routing.md` section 7.4](routing.md#74-withdrawal-ordering-barrier) | AX3, AX5 |
| M09 | Connection collision | After identity is known, retain one deterministic connection. The lexically higher node ID is the canonical dialer; an established equal-preference winner is stable. | Adapted | RFC 4271 section 6.8 retains the connection initiated by the higher BGP Identifier | [`DECISIONS.md` D11](../DECISIONS.md#d11---cross-dial-collision), [`protocol.md` section 8.3](protocol.md#83-cross-dial-collision) | AX3, AX8 |
| M10 | RIB partition | Keep a conceptual per-peer Adj-RIB-In, selected Loc-RIB, per-peer Adj-RIB-Out, and resolved forwarding projection. Implementations may share storage but not semantics. | Aligned | RFC 4271 section 3.2 | [`routing.md` section 3](routing.md#3-canonical-state-views), [`sdk.md` section 5](operations.md#3-canonical-operational-state) | AX4, AX6 |
| M11 | Deterministic decision process | Select one eligible route per endpoint; local wins, then shortest complete path and stable lexical ties. A selected route exists only with a resolvable exact next hop. | Adapted | RFC 4271 section 9.1 selection and next-hop resolvability | [`routing.md` section 6.2](routing.md#62-total-best-path-order), [`DECISIONS.md` D6](../DECISIONS.md#d6---deterministic-single-path-selection) | AX4 |
| M12 | Ordered path vector | Each route carries an ordered unique node path from origin through advertiser. Reject a received path containing the local node and suppress export to a peer already in the path. | Aligned conceptually | RFC 4271 `AS_PATH` / AS-loop exclusion | [`protocol.md` sectionsection 4-5](protocol.md#4-authoritative-route-snapshots), [`routing.md` sectionsection 5,7](routing.md#5-route-import) | AX2, AX4 |
| M13 | Selected-route export | Only a selected, resolvable route is considered for a peer's Adj-RIB-Out; learned routes additionally require local transit permission. | Aligned conceptually, with AGP policy | RFC 4271 sectionsection 3.2, 9.1.3 | [`routing.md` section 7](routing.md#7-selected-route-export) | AX4 |
| M14 | Authoritative full snapshots | One revisioned update is the complete selected-route set for that adjacency; omission withdraws. One update may be outstanding while later desired state coalesces. | Departure | BGP incremental UPDATE and explicit withdrawn NLRI | [`protocol.md` section 4](protocol.md#4-authoritative-route-snapshots), [`DECISIONS.md` D4](../DECISIONS.md#d4---full-route-snapshots) | AX2, AX4 |
| M15 | Route acknowledgement | Every snapshot receives an exact correlated ACK. Acceptance is the outstanding set minus canonical per-route rejections; ambiguous ACK state terminates the session. | Departure; BGP UPDATE has no matching per-update ACK | - | [`protocol.md` section 4.3](protocol.md#43-acknowledgement), [`routing.md` section 7.2](routing.md#72-snapshot-state-machine) | AX2, AX4 |
| M16 | Withdrawal and replacement | A newer authoritative snapshot replaces only that session's imported set. Session loss withdraws all state owned by that exact session before later affected data admission. | Adapted | RFC 4271 route replacement, withdrawal, and session teardown | [`routing.md` sectionsection 5,11](routing.md#5-route-import), [`fsm.md` section 7](fsm.md#7-teardown-order) | AX3, AX4 |
| M17 | Isolatable route failure | Structurally valid route-specific loop, policy, path-length, or capacity failures reject only named routes and consume the snapshot; ambiguity in framing, identity, path ownership, or revision is fatal. | Adapted safety principle, not `treat-as-withdraw` wire behavior | [RFC 7606](https://www.rfc-editor.org/rfc/rfc7606) | [`protocol.md` sectionsection 4,9](protocol.md#4-authoritative-route-snapshots), [`routing.md` section 5.2](routing.md#52-route-validation-classes) | AX2, AX4 |
| M18 | Feasible-path source validation | A received `(source endpoint, origin node)` must be an eligible route owned by the actual ingress session; it need not be the selected reverse route. | Aligned semantically | [RFC 3704 section 2.3](https://www.rfc-editor.org/rfc/rfc3704#section-2.3) feasible-path RPF | [`DECISIONS.md` D7](../DECISIONS.md#d7---feasible-path-source-authorization), [`routing.md` section 8.2](routing.md#82-peer-ingress-source) | AX5 |
| M19 | Acknowledged source-export barrier | Before peer data egress, that peer must have ACKed the same selected source identity in its Adj-RIB-Out. Withdrawal closes the export epoch before later data admission. | AGP-native | Related to control/data-plane consistency, but no BGP packet-plane equivalent is claimed | [`routing.md` sectionsection 7.3,8](routing.md#73-source-export-barrier), [`protocol.md` section 5.1](protocol.md#51-routedata-write-ordering) | AX4, AX5 |
| M20 | RIB-gated JSON data plane | Local send and transit resolve the destination through the same selected RIB/FIB. Missing or unusable route emits zero onward data packets. | AGP-native | - | [`routing.md` section 9](routing.md#9-uniform-data-forwarding), [`README.md` section 7](README.md#7-canonical-processing-paths) | AX5 |
| M21 | Hop limit | Local delivery does not decrement. Every nonlocal forward decrements at least once and never raises the value; exhaustion emits no onward packet. | Adapted packet-plane safeguard, not a BGP mechanism | IP TTL / Hop Limit principle | [`protocol.md` section 6](protocol.md#6-data-message), [`routing.md` section 9.5](routing.md#95-hop-limit-outcomes) | AX2, AX5 |
| M22 | Correlated reverse delivery errors | Immediate failure returns on current ingress; prior forwarders use bounded hop-local breadcrumbs and never consult the RIB. Nonfatal delivery errors do not reset a valid session. | AGP-native | BGP NOTIFICATION is intentionally not reused because it is fatal and control-plane scoped | [`protocol.md` section 7](protocol.md#7-correlated-reverse-errors), [`routing.md` section 10](routing.md#10-reverse-delivery-errors) | AX2, AX5 |
| M23 | Fatal notification | Schema/identity/revision ambiguity sends a typed notification when safe, purges session-owned routes, and closes the session channel. | Aligned in lifecycle semantics; AGP codes differ | RFC 4271 sectionsection 4.5, 6 | [`protocol.md` section 9](protocol.md#9-fatal-versus-recoverable-failures), [`fsm.md` sectionsection 6-7](fsm.md#6-transition-tables) | AX2, AX3 |
| M24 | Atomic bounded node revision | One serialized transaction preflights and commits session, imports, candidates, selection, FIB, exports, counters, and events before wire side effects. Exact finite ordering domains never wrap: a reserved revision commits one terminal node failure instead. | AGP-native | - | [`routing.md` section 11](routing.md#11-atomic-state-and-revision-mechanics), [`sdk.md` section 5.2](operations.md#32-snapshot-metadata-and-revisions) | AX4, AX6 |
| M25 | Symmetric learned-route propagation | Any peer may receive a selected learned route when transit and loop rules permit. AGP has no iBGP/eBGP split-horizon or route-reflector role. | Departure | RFC 4271 section 9.2.1 internal-peer redistribution rule | [`protocol.md` sectionsection 1,5](protocol.md#1-mandate), [`routing.md` section 7](routing.md#7-selected-route-export) | AX4, AX7 |
| M26 | Ephemeral routing state | Restart starts with empty sessions/RIB/FIB/export/breadcrumb state and reconverges from endpoint intent and fresh snapshots. | Departure for v1 | [RFC 4724](https://www.rfc-editor.org/rfc/rfc4724) graceful retention is not adopted | [`DECISIONS.md` D9](../DECISIONS.md#d9---volatile-derived-runtime-state), [`sdk.md` section 9](sdk.md#6-restart-and-state-lifetime) | AX7 |
| M27 | Operational visibility | Every node exposes connection FSM, timers, Adj-RIB-In, candidates, selected RIB, FIB, Adj-RIB-Out, resources, and counters through canonical SDK state, read-only HTTP, and `agpctl`. | Adapted operator model | BGP table/session operational practice; no CLI syntax compatibility is claimed | [`sdk.md` sectionsection 5-8](operations.md#3-canonical-operational-state) | AX6 |
| M28 | Sovereign contracts | Every public named wire, configuration, SDK, state, event, and management DTO owns a separately inspectable Draft 2020-12 schema and generated binding. | AGP-native | [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) | [`contracts.md`](contracts.md), [`axioms.md`](axioms.md) | AX1 |
| M29 | Remote route-rejection recovery | Preserve an exact rejection per tuple/session. Loop/path-length rejection waits for topology change; policy/capacity rejection uses one deterministic saturated exponential retry, never an immediate ACK loop. | AGP-native | Related to bounded route re-advertisement, but no BGP MRAI equivalence is claimed | [`routing.md` section 3.6](routing.md#36-per-peer-adj-rib-out), [`protocol.md` section 5](protocol.md#5-selected-route-export) | AX4 |
| M30 | Reliable ordered packet-channel profile | Every session consumes one full-duplex, reliable, FIFO, duplicate-free, boundary-preserving, bounded byte channel with exactly one terminal outcome. This is a mandatory conformance contract; adapter composition is local, and no runtime profile value is negotiated in OPEN. | Adapted | RFC 4271 relies on a reliable transport; AGP makes the required bearer semantics explicit and message-oriented | [`transport-contract.md`](transport-contract.md), [`DECISIONS.md` D14](../DECISIONS.md#d14---reliable-ordered-packet-channel) | AX1-T, AX3 |
| M31 | Sovereign WebSocket binding | `agp.v1` maps one AGP packet to one complete RFC 6455 binary message. Text messages are binding violations; UTF-8/JSON remain protocol-owned. Fragmentation, compression, Ping/Pong, and close codes remain binding-private. | Aligned with the chosen binding standards; deliberate binary-message profile preserves the neutral byte contract | [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455) | [`binding-websocket.md`](binding-websocket.md), [`DECISIONS.md` D16](../DECISIONS.md#d16---sovereign-websocket-binding) | AX1-B, AX7 |
| M32 | Canonical production Loopback | One explicit process-local fabric connects ordinary AGP nodes through asynchronous, copied, bounded packet channels and never bypasses codec, OPEN, FSM, RIB, or data admission. Its exact revision, counters, and arbitration domain preflight and fail the fabric before wrap; its public failure union distinguishes that exhaustion from an internal adapter invariant fault. | AGP-native | - | [`transport-loopback.md`](transport-loopback.md), [`DECISIONS.md` D17](../DECISIONS.md#d17---canonical-production-loopback) | AX1-L, AX7 |
| M33 | Logical transport references and observed evidence | Core topology names bounded listener/target references. The injected transport resolves them once to adapter-bound acquisition capabilities, and every acquired channel projects immutable observed peer evidence into identity admission. | AGP-native | Related to dependency inversion and channel binding, but no external wire mechanism is claimed | [`transport-contract.md`](transport-contract.md), [`DECISIONS.md` D15](../DECISIONS.md#d15---transport-references-and-observed-peer-evidence) | AX1-T, AX5 |
| M34 | Sovereign diagnostic observation | Node/kernel diagnostics cross only as the closed core `DiagnosticRecord`; adapter diagnostics cross only as neutral `TransportDiagnostic`. Raw causes are separate process-local arguments, and absent or throwing sinks cannot alter protocol, state, terminal, or resource behavior. | AGP-native | Structured logging/observability port pattern; no BGP mechanism or wire behavior is claimed | [`contracts.md` section 6.2](contracts.md#62-sdk-data-records), [`sdk.md` section 3.1](sdk.md#41-factory-and-composition), [`transport-contract.md` section 5.2](transport-contract.md#52-packets-and-reads) | AX1, AX1-T, AX5 |
| M35 | Pre-identity controller boundary | A transferred channel is observable before OPEN admission only as a node-wide-local pre-identity controller with no remote identity or routing authority. Admission atomically replaces it with a pair-scoped session; teardown emits exactly one mutually exclusive pre-identity or admitted-session event. | AGP-native | Related to BGP's pre-OpenConfirm identity boundary, but the sovereign operational projection is AGP-specific | [`protocol.md` section 3](protocol.md#3-open), [`fsm.md` sectionsection 3,7](fsm.md#3-controller-state-and-invariants), [`contracts.md` section 6.4](contracts.md#64-required-state-semantics), [`sdk.md` section 5.1](operations.md#31-uniform-entity-semantics) | AX3, AX6 |

---

## 3. Deferred familiar mechanisms

| ID | Mechanism | AGP v1 position | Canonical reference | Re-entry condition |
|---|---|---|---|---|
| F01 | Multiple advertised paths | Keep alternatives in the local candidate RIB but advertise and forward one selected path. | [RFC 7911](https://www.rfc-editor.org/rfc/rfc7911) ADD-PATH | Requires a surveyed multipath objective, capability negotiation, path identifiers, revised schemas, selection/export rules, and new loop/failover proofs. |
| F02 | Graceful restart / stale-route retention | Do not retain routes after session or process loss. Reconverge from empty derived state. | RFC 4724 | Requires an explicit stale-authority model, restart capability, End-of-RIB semantics, expiry, and forwarding-safety certification. |
| F03 | Rich route policy and attributes | No local preference, MED, communities, aggregation, route reflection, or configurable metrics. | RFC 4271 path attributes and decision process | Requires a separate intent survey; policy must not be smuggled into the lexical comparator. |
| F04 | Incremental UPDATE / route refresh | Full snapshots and reconnect recovery remain the v1 mechanism. | RFC 4271 UPDATE; BGP route-refresh extensions | Requires scale evidence that bounded full snapshots are inadequate and a new replay/withdrawal consistency design. |
| F05 | Extensible optional capabilities | All current v1 capabilities are mandatory. | RFC 5492 | The first optional wire feature must introduce a bounded sovereign capability contract and bilateral-enable rule before use. |
| F06 | Additional carrier bindings or transport selection | WebSocket and Loopback are the only canonical production transports in this refinement. One node uses one concrete adapter composition; it neither mixes adapters behind a composite resolver nor negotiates/dynamically selects a carrier in AGP OPEN. | Transport extensibility patterns | Requires a demonstrated production carrier, its sovereign binding/configuration/evidence contracts, the shared conformance kit, and a surveyed selection objective for mixed, fallback, migration, or dynamic composition. |
| F07 | Secure WebSocket deployment | Authority exists in [`DECISIONS.md` D18](../DECISIONS.md#d18---pre-shared-key-transport-security): TLS 1.3 pre-shared keys, `network` or `node` keying, star and line topologies. The certified adapter still ships `trusted-development` `ws:` only until that profile is implemented and its conformance evidence exists. Certificate infrastructure, `wss:` with X.509, and HTTP Upgrade authentication remain excluded. | TLS pre-shared keys ([RFC 4279](https://www.rfc-editor.org/rfc/rfc4279)), TLS 1.3 ([RFC 8446](https://www.rfc-editor.org/rfc/rfc8446)) | Implementation plus binding conformance over a real socket. Full-mesh security requires a per-pair key model and separate authority; certificate-based and HTTP-authenticated profiles require fresh intent. |

---

## 4. Alignment rules for future work

Before a new mechanism enters implementation:

1. add it to this index;
2. identify the closest canonical mechanism, if one exists;
3. classify it as aligned, adapted, departure, AGP-native, or deferred;
4. state the exact inherited semantics and every deliberate difference;
5. link one normative AGP owner, sovereign schemas, and an owning gate;
6. add orthogonal tests for the alignment and each departure; and
7. update the decision register when the choice changes protocol behavior.

If the implementation differs from this index, the design must be revised and ratified; implementation precedent does not silently redefine the mechanism.

---

## 5. Mechanics, rationale, and consequence

### Mechanics

Each indexed row names one feature mechanism, its exact AGP behavior, its alignment or departure from the nearest established mechanism, its normative owner, and its verification gate.\
Deferred rows state the evidence and authority required to re-enter design.

### Rationale

The index gives a cold reviewer one place to distinguish deliberate protocol choices from accidental resemblance, and current mechanisms from familiar features AGP has intentionally not adopted.

### Consequence of violation

An unindexed feature or undocumented standards departure can acquire authority through implementation precedent, bypass stakeholder intent, and leave no owning proof or safe migration boundary.
