# AGP uniform node - verification and release certification

---

## 1. Status and authority

| Field | Value |
|---|---|
| Status | Ratified. Current verification plan; a gate is certified only while every required test in section 14 passes |
| Intent authority | [`DECISIONS.md` section 2](../DECISIONS.md#2-confirmed-intent) |
| Transport intent authority | [`transport-sovereignty-authority.md`](transport-sovereignty-authority.md) |
| Architecture | [`README.md`](README.md) |
| Axiom applicability | [`axioms.md`](axioms.md) |
| Decision register | [`DECISIONS.md`](../DECISIONS.md) |
| Contract ownership | [`contracts.md`](contracts.md) |
| Protocol | [`protocol.md`](protocol.md) |
| Session FSM | [`fsm.md`](fsm.md) |
| Routing | [`routing.md`](routing.md) |
| Neutral transport contract | [`transport-contract.md`](transport-contract.md) |
| WebSocket binding | [`binding-websocket.md`](binding-websocket.md) |
| Loopback transport | [`transport-loopback.md`](transport-loopback.md) |
| SDK | [`sdk.md`](sdk.md) |
| Operations | [`operations.md`](operations.md) |
| Certification sequence | `AX0 -> AX1 -> AX2 -> AX3 -> AX4 -> AX5 -> AX6 -> AX7 -> AX8` |
| Gate definitions | [`gates.md`](gates.md) |

This document defines the binary evidence required to certify the uniform-node replacement.\
A passing result for the current MVP is not inherited: the AGP v1 wire language, runtime factory, session symmetry, routing behavior, transport SPI, WebSocket binding, and Loopback production transport all change, so every affected gate must be resealed.

The following applicable axioms contribute only the AGP-scoped mechanics declared in [`axioms.md`](axioms.md):

- A3 - Sovereign Composition;
- A4 - Zero-Loss Knowledge;
- A8 - Gated Recursive Integrity;
- A9 - Chaos-Validated Deployment; and
- A14 - Compounding Learning.

A0 is retained only as lineage context.\
Its umbrella claim presupposes the full constituent stack, so neither `AX0` nor this artifact claims selective A0 conformance.\
A gate PASS certifies its exact AGP contract: A9 evidence is sandbox-derived and A14 evidence covers the finding-lifecycle subset unless a deployment owner supplies the remaining source-axiom evidence.

No gate imports persistence, autonomous-agent, LLM, or delivery-workflow requirements from a non-applicable axiom.\
Queryable ephemeral state, typed route failures, deterministic retries, and stable operational projections are instead grounded in the confirmed survey and the AGP contracts that implement it.

---

## 2. Certification model

### 2.1 Binary gated ascension

Each gate has exactly two certification states:
```text
PASS | FAIL
```

There is no partial, waived, flaky, or "expected failure" certification.\
"Partial" in an axiom-evidence scope describes the limited external claim, not the gate result: every AGP gate itself still passes or fails atomically.

1. `AX0` has no predecessor.
2. `AXn` may run diagnostically at any time, but may be certified only when
   `AX0..AX(n-1)` are already certified against the same source revision.
3. A change to a lower-layer public contract invalidates that gate and every
   certificate above it.
4. A failure observed at a higher gate first audits the owning lower gate. A
   surface workaround cannot certify the higher layer.
5. Rerunning a failed test until it passes is not evidence. Nondeterminism is a
   defect owned by the lowest layer that introduced it.
6. A gate runs from a clean process with deterministic fixtures, explicit
   resource bounds, and verified teardown.

Rule 6 is mechanical: each workspace suite runs in its own test process, so one suite cannot cancel or contaminate another.

Rule 2 has two execution modes, and the difference is reporting rather than authority:
```bash
npm run test:system   # run every suite, report each
npm run test:gated    # stop at the first failing suite
```

`test:system` is the default and what continuous integration runs.\
It reports every suite so one invocation shows the whole picture, and its summary still names the lowest failing suite.

`test:gated` reads rule 2 literally: suites below an unsealed predecessor are not run and are reported `SKIP` rather than counted as passing.\
Use it to isolate the owning layer.

Neither mode changes what certification means.\
A suite that did not run is never evidence, in either mode.

### 2.2 Proof-layer separation

| Layer | What it proves | What it must not claim |
|---|---|---|
| Schema | Closed object shape, discriminators, static bounds, references | Peer identity, revision order, path meaning, or FSM legality |
| Neutral transport | Packet boundary/order, send acceptance, bounded pressure, acquisition, evidence, cancellation, and one terminal outcome | AGP JSON meaning, FSM disposition, routing, or carrier-native behavior |
| Carrier binding | Exact mapping between one carrier and the neutral channel, including native rejection and teardown | Kernel semantics or proof for another adapter |
| Semantic | Contextual meaning of one validated value | Temporal sequencing or runtime state mutation |
| FSM | Legal state/event transitions, timers, actions, and teardown order | Best-path correctness |
| Core | Import, candidate, selection, export, forwarding, and atomic state transactions | Carrier behavior or application lifecycle |
| Node | Public API composition and exact local/transit admission behavior | Independent-process or network convergence |
| Operations | Canonical SDK state and exact HTTP/CLI projection | Routing correctness reconstructed from presentation |
| Topology | Correct composition across real nodes over Loopback and WebSocket | Exhaustive injected adversity |
| Chaos | Preservation of all sealed invariants under standardized faults | Undocumented production-fidelity claims |

The same semantic fact has one owning gate.\
A later gate may witness that fact while proving composition, but it does not duplicate the lower-layer oracle.\
For example, `AX5` owns "local `NO_ROUTE` writes no data packet"; `AX7` may use a route miss in a live line topology only to prove that the surrounding nodes remain converged.

### 2.3 Gate evidence

A gate's evidence is its named test files and the commands that run them, both recorded in section 14.\
There is no separate manifest artifact, digest chain, or issued certificate: the test files are the durable evidence, version control is the source-revision authority, and continuous integration is the execution record.

An earlier revision of this plan emitted signed per-gate manifests and a sandbox artifact certificate.\
That machinery was removed because nothing consumed it.\
The gate ordering rules in section 2.1 remain in force and are the load-bearing part of the model: they decide which layer owns a failure, not which document gets stamped.

---

## 3. Traceability

### 3.1 Trace record

`AX0` owns one machine-checkable trace record per requirement:
```ts
type TraceAuthority =
  | {
      kind: "survey";
      reference: string;
      ratification: "confirmed";
    }
  | {
      kind: "decision";
      reference: `D${number}`;
      ratification: "required" | "ratified" | "proposed";
    }
  | {
      kind: "stakeholder";
      reference: string;
      ratification: "explicitly-approved";
    }
  | {
      kind: "axiom";
      reference: "A3" | "A4" | "A8" | "A9" | "A14";
      ratification: "applicable-mechanics";
    };

interface RequirementTrace {
  requirementId: string;
  ratificationStatus: "required" | "ratified" | "proposed";
  authorities: readonly TraceAuthority[];
  designReferences: readonly string[];
  schemaIds: readonly string[];
  semanticRuleIds: readonly string[];
  owningGate: "AX0" | "AX1" | "AX2" | "AX3" | "AX4"
    | "AX5" | "AX6" | "AX7" | "AX8";
  owningTests: readonly string[];
  integrationWitnesses: readonly string[];
}

interface RequirementTraceDocument {
  schemaVersion: "agp.traceability/v1";
  sourceRevision: string;
  records: readonly RequirementTrace[];
}
```

The normative targets are:
```text
docs/design/traceability.schema.json
docs/design/traceability.json
```

Every survey outcome `U1..U11`, every fixed transport-intent requirement `U12..U15`, and every normative requirement introduced by `D1..D17` has exactly one record.\
The executable AX0 oracle compares the record ID multiset to the exact closed set `U1..U15` plus `D1..D17`; it fails on an omission, duplicate, unexpected ID, or cardinality mismatch rather than relying on schema cardinality alone.\
`U12..U15` cite the explicit stakeholder authority in `transport-sovereignty-authority.md`; they do not retroactively claim a survey that was deliberately unnecessary after direction was fixed.\
A non-applicable axiom and A0 cannot appear in `authorities`.\
Multiple authorities are retained when intent, a ratified design decision, and an applicable axiom mechanic jointly constrain the result.\
A Proposed decision may be traced for review but cannot authorize implementation or a gate PASS.\
An integration witness may remain empty until its later gate, but the owning test must exist before its gate can pass.

### 3.2 Survey ownership

| Survey invariant | Owning gate | Primary executable oracle |
|---|---|---|
| U1 - sole `createNode()` runtime factory | AX5 | Public package exports contain the uniform factory and no role-specific runtime factory |
| U2 - one implementation composes listener, dialer, local delivery, and transit | AX5 | Identical node instances activate each capability from configuration |
| U3 - symmetric route exchange | AX3 | Dialed and accepted sessions both originate the initial and changed authoritative route snapshots, accept the same route/ACK matrix, and consume exact acknowledgements |
| U4 - selected learned-route export | AX4 | Adj-RIB-Out contains the selected learned path only when transit and peer-loop rules permit it |
| U5 - ordered-path loop prevention | AX4 | Import/export excludes a repeated/local/peer-containing path without installing it |
| U6 - every data path uses the local selected RIB | AX5 | Every admitted local or transit write records the selected route and admission revision |
| U7 - local route miss rejects before wire admission | AX5 | Typed `NO_ROUTE`, no data-queue reservation, and exactly zero data writes |
| U8 - transit route miss emits no onward packet | AX5 | Correlated error on ingress and exactly zero onward data writes |
| U9 - correlated failure returns toward the source | AX5 | The failing node returns directly to the current ingress; each prior forwarder follows its recorded breadcrumb; no hop performs a RIB lookup |
| U10 - truthful stable management HTTP and `agpctl` | AX6 | Frozen projection inputs agree exactly; live same-instance/revision non-time state agrees and time-derived fields satisfy measured capture-window bounds |
| U11 - sovereign schemas for named DTOs | AX1 | Catalog completeness, one `$id`/owner/file/type mapping, and generated-output equality |
| U12 - no concrete transport semantics in the kernel | AX1 | Dependency/vocabulary gates and a package-root consumer prove the kernel imports only `@agp/transport` |
| U13 - protocol behavior is invariant across conforming transports | AX7 | Independently owned Loopback and WebSocket topology witnesses normalize to the same protocol/RIB/data outcomes |
| U14 - Loopback is a production transport | AX1 | Public package exports, schemas, lifecycle/state contracts, and the full neutral conformance kit exist without a test-only bypass |
| U15 - WebSocket binding and implementation are sovereign | AX1 | Binding schemas/mappings and Node.js adapter tests own every WebSocket-specific concept outside common packages |

`AX7` supplies live composition witnesses for these invariants but cannot replace their owning package tests.

### 3.3 Axiom-mechanics ownership

| Applicable axiom | Evidence gates | Exact claim scope |
|---|---|---|
| A3 | `AX1` proves sovereign ownership and public-contract-only dependency direction; later package tests preserve it | AGP package/module graph |
| A4 | `AX0` proves mechanics/rationale/consequence and cold-pickup traceability; `AX1` proves inspectable contracts; `AX6` proves structured state rather than adapter prose | AGP design, schema, and operations artifacts |
| A8 | `AX0..AX8` are binary and each certificate recursively binds all predecessors | AGP gate graph |
| A9 | `AX8` executes the deterministic entropy battery | Sandbox-derived partial evidence, not deployment conformance |
| A14 | `AX0` captures review findings and `AX8` enforces owning-layer resolution plus recurrence evidence | Finding-lifecycle subset only |

A0 has no row because it is not selectively certified.\
`AX0` proves AGP lineage completeness; the similar identifier does not denote A0 conformance.

---

## 4. Modular test architecture

### 4.1 Ownership layout

```text
packages/protocol/test/
  README.md
  contract/       schema catalog, generated types, wire variants
  unit/           pure contextual semantic rules
  fixtures/       one bounded corpus per owning contract
  support/        mechanical validator setup only

packages/transport/test/
  README.md
  contract/       neutral capability, schema, and conformance-kit contracts
  unit/           deterministic terminal/cancellation/limit primitives
  fixtures/
  support/

packages/binding-websocket/test/
  README.md
  contract/       RFC 6455 packet/subprotocol/close mapping and schemas
  fixtures/
  support/

packages/transport-node-ws/test/
  README.md
  conformance/    one file per neutral transport behavioral axis
  integration/    real Node.js WebSocket acquisition and carrier races
  fixtures/
  support/

packages/transport-loopback/test/
  README.md
  conformance/    the same neutral axes, independently owned
  contract/       public fabric/configuration/operations/lifecycle surfaces
  fixtures/
  support/

packages/core/test/
  README.md
  unit/           FSM reducers, RIB transactions, capacities, operations store
  fixtures/
  support/

packages/node/test/
  README.md
  contract/       public lifecycle, sessions, forwarding, errors, teardown
  fixtures/
  support/        injected public transport/clock/policy ports

packages/management-http/test/
  README.md
  contract/       exact operations-to-HTTP projection and schemas
  unit/           adapter lifecycle and bounds
  fixtures/
  support/

cli/test/
  README.md
  contract/       exact read-only HTTP drivers
  unit/           dispatcher, templates, renderer
  fixtures/
  support/

test/
  conformance/    root schema catalog and package-root public composition
  topology/       healthy production-Loopback geometries and withdrawal
  resilience/     standardized AX8 fault cases
  e2e/            SDK/HTTP/CLI, cross-transport parity, and WebSocket independent-process acceptance
  support/        topology/process mechanics with no assertions
```

Neutral transport behavior remains in `@agp/transport`; WebSocket mapping remains in `@agp/binding-websocket`; each concrete adapter owns its execution of the shared conformance cases.\
Protocol behavior remains in `@agp/protocol`; pure routing remains in `@agp/core`; orchestration remains in `@agp/node`.\
A workspace test is permitted only when its primary contract crosses two or more public package or process boundaries.

The neutral package publishes conformance scenario contracts as public test support, grouped one behavioral axis per module.\
A scenario arranges/stimulates only the neutral port and returns a normalized public transcript; it never constructs a particular adapter or hide assertions.\
Each adapter's own self-descriptive test file states and asserts the exact oracle, then may add carrier-specific integration proofs.\
A coverage manifest proves both adapter suites own every common obligation.\
This gives WebSocket and Loopback identical requirements without hiding failures behind one aggregate "transport conformance" test.

### 4.2 Self-description and orthogonality

Every test:

1. uses a literal title stating `Given`, `When`, and `Then`;
2. owns one primary behavioral axis and one public oracle;
3. changes one stimulus dimension;
4. creates and cleans up its own state;
5. imports package roots or declared ports, never another package's `src/`;
6. uses barriers, deterministic clocks, scripted transports, or operations
   events rather than arbitrary sleeps;
7. stays focused and reviewable; 300 nonblank lines is a split-or-justify
   review trigger recorded in the owning `test/README.md`, not an automatic
   gate failure;
8. contains no focused, skipped, placeholder, or retry-until-green behavior;
9. leaves assertion logic in the test, not hidden in support; and
10. has one row in the owning `test/README.md` naming contract, primary axis,
    oracle, and explicit non-overlap.

An acceptable title is:
```text
Given a transit packet with no selected destination route,
when the uniform node evaluates forwarding,
then it emits one correlated ingress error and no onward data packet
```

Table-driven cases share a file only when their arrangement, stimulus, and oracle are identical and only an enumerated input value changes.\
Schema keyword cases may share a table; route miss, loop rejection, and queue saturation may not.

### 4.3 Fixtures and timing

- A fixture contains immutable input and expected public output only.
- Valid fixtures never double as negative fixtures with fields mutated in
  hidden setup.
- Exact JSON Pointer, failed keyword, semantic rule ID, error code, transition,
  and close outcome are asserted where applicable.
- Manual clocks own protocol time. Wall-clock deadlines are used only at real
  process/carrier boundaries as a test-harness failure bound.
- A timeout is never the positive oracle; an event, callback, packet, state
  revision, or process record is.
- System tests run in isolated clean processes. They do not share ports,
  mutable nodes, route state, or ordering assumptions.

---

## 5. Mechanics, rationale, and consequence

### Mechanics

Verification ascends from authority and sovereign schemas through pure semantics, FSM, RIB, uniform runtime, operational projections, live topologies, and finally deterministic chaos.\
Each requirement has one owning gate and test, while higher layers provide composition witnesses.\
Immutable evidence manifests bind every pass to source, schema digests, commands, seeds, cleanup, and lower-gate certificates.

### Rationale

Uniform routing combines several failure domains that can appear correct in a single demo: a permissive schema can hide an invalid path, a correct reducer can be wired through role-specific branches, a populated RIB can still be bypassed by data, and a table can reconstruct state the node never used.\
Separating proof layers makes each defect local and prevents topology success from certifying an unproven foundation.\
Star, line, triangle, and diamond geometries then prove progressively stronger composition, while the entropy battery proves the sealed graph survives real distributed failure modes.

### Consequence of violation

- Skipping schema or semantic gates permits incompatible peers to fail only
  after deployment.
- Combining FSM, RIB, and node assertions makes root cause ambiguous and tests
  rot together.
- Treating timeout silence as a no-packet proof can miss delayed forwarding.
- Reusing one happy-path topology cannot prove transit, loops, alternative
  promotion, withdrawal, or restart behavior.
- Persisting live sessions or learned routes creates phantom reachability.
- Reconstructing operational state in HTTP or CLI creates divergent truths.
- Adding an unselected route-miss metric turns observability preference into
  unauthorized product scope.
- Releasing without deterministic chaos evidence makes convergence and
  resilience hope-based.
- Fixing a discovered failure without a durable finding and recurrence test
  guarantees the learning will be purchased again.
