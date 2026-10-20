# AGP uniform node - verification and release certification

---

## 1. Status and authority

| Field | Value |
|---|---|
| Status | Ratified. Current verification plan; a gate is certified only while every required test in section 14 passes |
| Intent authority | [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) |
| Transport intent authority | [`transport-sovereignty-authority.md`](design/transport-sovereignty-authority.md) |
| Architecture | [`README.md`](README.md) |
| Axiom applicability | [`axioms.md`](design/axioms.md) |
| Decision register | [`DECISIONS.md`](DECISIONS.md) |
| Contract ownership | [`contracts.md`](design/contracts.md) |
| Protocol | [`protocol.md`](design/protocol.md) |
| Session FSM | [`fsm.md`](design/fsm.md) |
| Routing | [`routing.md`](design/routing.md) |
| Neutral transport contract | [`transport-contract.md`](design/transport-contract.md) |
| WebSocket binding | [`binding-websocket.md`](design/binding-websocket.md) |
| Loopback transport | [`transport-loopback.md`](design/transport-loopback.md) |
| SDK | [`sdk.md`](design/sdk.md) |
| Operations | [`operations.md`](design/operations.md) |
| Certification sequence | `AX0 -> AX1 -> AX2 -> AX3 -> AX4 -> AX5 -> AX6 -> AX7 -> AX8` |
| Gate definitions | [`GATES.md`](GATES.md) |

This document defines the binary evidence required to certify the uniform-node replacement.\
A passing result for the current MVP is not inherited: the AGP v1 wire language, runtime factory, session symmetry, routing behavior, transport SPI, WebSocket binding, and Loopback production transport all change, so every affected gate must be resealed.

The following applicable axioms contribute only the AGP-scoped mechanics declared in [`axioms.md`](design/axioms.md):

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

Every survey outcome `U1..U11`, every fixed transport-intent requirement `U12..U15`, and every decision the record declares has exactly one record.\
The executable AX0 oracle derives that decision set by reading `DECISIONS.md`, and fails on an omission, duplicate, unexpected ID, or cardinality mismatch rather than relying on schema cardinality alone.\
It is derived rather than restated because the closed set was once written as a constant, and two ratified and built decisions accumulated outside it without the gate objecting.\
Each record also states whether it is built or planned: a built one names the tests that own it, and a planned one names the design that defines it.\
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
| U9 - correlated failure returns toward the source | AX5 | The failing node returns directly to the current ingress; each prior forwarder follows its recorded label binding; no hop performs a RIB lookup |
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

## 4. Coverage register

Live behavior varies along independent dimensions.\
This section states three separate things, and conflating them is how a gap becomes invisible:

1. the **dimensions** a test harness can express;
2. the **default suite**, a deliberately sparse orthogonal subset of them; and
3. the **deepening** runs available on demand along one dimension at a time.

A dimension may be declared before a harness can express it.\
Where that is true it is marked, so a declared value is never mistaken for a covered one.

### 4.1 Dimensions

| Dim | Values | Harness support |
|---|---|---|
| `D-GEO` geometry | `star`, `line`, `triangle`, `diamond`, `chain(n)` | Supported; `chain(n)` via `AGP_DEEPEN_CHAIN` |
| `D-TRAFFIC` message volume | `single`, `stream(n)`, `burst(n)` | Supported via `AGP_DEEPEN_STREAM` and `AGP_DEEPEN_BURST` |
| `D-ROUTE` endpoint and route volume | `minimal`, `moderate(n)`, `near-bound(n)` | Supported via `AGP_DEEPEN_ROUTES`, bounded at 256 total routes |
| `D-TRANSPORT` carrier | `loopback`, `websocket`, `websocket-psk` | All supported |

`D-TRAFFIC` and `D-ROUTE` are both volumetric but stress different machinery.\
Message volume exercises ordering, label binding churn, return-token cycling, and egress backpressure along one path.\
Route volume exercises Adj-RIB-In and candidate size, selection cost, export recomputation across every peer, and the encoded size of an authoritative snapshot.

Concurrency reaches a bound that sequential traffic never contends for.\
The bound a burst actually meets is the label binding reservation rather than an egress queue, because a binding is held until its disposition returns while a queue drains between admissions.\
Before `D23` that bound was far tighter, because a binding was released by expiry rather than by delivery and a successful send left one behind for the whole retention window.

Route volume is the dimension that probes `D4`.\
Because a route update carries the complete selected set rather than a delta, the cost of every convergence event scales with route count, and a large enough set makes an update approach the negotiated receive bound.\
`route-capacity.test.js` proves the candidate count bound; the byte interaction between a full snapshot and `receiveLimitBytes` is unproved.

### 4.2 Default geometry cells

What runs on every invocation.\
Every cell is `single` traffic and `minimal` routes; the busiest live topology carries nine routes and four endpoints per node.

| Geometry | `loopback` | `websocket` | `websocket-psk` |
|---|---|---|---|
| `star` | `test/topology/star-convergence.test.js` | `test/e2e/independent-star-multi-endpoint.test.js` | `test/integration/secure-websocket-star.test.js` |
| `line` | `test/topology/line-transit.test.js` | `test/e2e/independent-line.test.js` | - |
| `triangle` | `test/topology/triangle-loop-prevention.test.js` | - | - |
| `diamond` | `test/topology/diamond-selection.test.js` | - | - |
| `chain(4)` | `test/topology/chain-transit-depth.test.js` | - | - |

### 4.3 Default volumetric cells

Volumetric cells hold geometry at its smallest useful shape and vary one dimension.

| Dimension | Default value | Covered by |
|---|---|---|
| `D-TRAFFIC` `stream(n)` | 60 messages over `line` | `test/topology/stream-ordering.test.js` |
| `D-ROUTE` `moderate(n)` | 8 endpoints per node over `line` | `test/topology/route-volume.test.js` |
| `D-TRAFFIC` `burst(n)` | 40 concurrent sends over `line` | `test/topology/burst-admission.test.js` |

### 4.4 Selection rule

The dimensions describe a combinatorial space.\
The default suite is sparse on purpose, and a cell earns a place in it under one rule:

> A combination earns a default test only when it proves something no dimension
> proves alone.

Ordering under sustained traffic is a property of a transit hop, so it earns one cell on `line` and nothing on `triangle` or `diamond`.\
Channel protection is carrier-level and geometry-independent, so it earns one cell and no more.\
Loopback and WebSocket equivalence is already proved by the normalized equivalence witnesses rather than by repeating every geometry on both.

This is also why the suite is not a parameterised aggregate.\
A failing `star x stream x psk` cell reports that a combination broke, not which layer owns it, and section 2.1 requires a failure to identify its owning layer.\
Composition therefore happens along one axis at a time, in independently named files, as the transport conformance kit and the equivalence harness already do.

### 4.5 Deepening

A dimension can be pushed further than the default suite on demand, one dimension at a time, holding the others at their default.\
A deepening run is a diagnostic instrument rather than a gate: it does not certify, and a defect it finds is owned by the layer that produced it.

`test/support/topology-builders.js` provides the entry points, and each reads one environment variable so a run varies exactly one dimension:
```bash
AGP_DEEPEN_CHAIN=7 npm run test:topology
AGP_DEEPEN_STREAM=500 npm run test:topology
AGP_DEEPEN_ROUTES=80 npm run test:topology
AGP_DEEPEN_BURST=800 npm run test:topology
```

Every declared dimension value now has an entry point.

### 4.6 Open findings from sweeps

A sweep records what it found.\
A finding stays here until it is closed by a design decision or a regression test, so a known limit is not rediscovered.

| ID | Finding | Status |
|---|---|---|
| `MX1` | A sender that offers messages back to back over WebSocket overruns the receiver, which commits `RECEIVE_OVERFLOW`, closes the session, purges its routes, and reconnects. Delivered messages equal `maxBufferedPackets` exactly, at every bound tested from 16 to 128. Every `send()` resolved successfully first. | Closed by `D19`, gated by `test/topology/credit-flow-control.test.js` |
| `MX2` | A four-node diamond carrying twenty-four endpoints per node fails a two-second `routeAckTimeoutMs` while a stream is in flight, on sessions that carry no data of their own. Raising only that deadline to twenty seconds passes the same cell with every message delivered. | Closed by `D21`, gated by `packages/core/test/unit/write-path-cost.test.js` |
| `MX3` | A stream saturates the event loop. A one-millisecond interval timer fires about twelve times across a whole run, so the loop drains roughly that often and the synchronous blocks between drains average around twenty milliseconds. A block of that size moves any deadline sharing the loop, which is the mechanism that tore down healthy sessions before `D21`. | Closed. Root-caused rather than reduced: most of it was a caller awaiting `send()` in a loop and never reaching the macrotask queue, closed by `D28`; the largest concentrated cost was validating this node's own outbound messages, closed by `D27`; and its two earlier consequences were closed by `D24` and `D25`. Gated by `caller-loop-starvation.test.js` and `outbound-wire-validity.test.js` |
| `MX5` | A node stopped sending permanently after `maxLabelBindings` originated messages, because the expiry sweep that releases a label binding was called from nowhere. | Closed, gated by `packages/node/test/contract/label-binding-expiry.test.js` |
| `MX6` | An unhandled rejection on the inbound data path, from `dispatchData` discarding the result of `admitData` with `void`, ended the process. Reproduced once `MX5` was fixed and the sender could reach the receiver's refusal path. | Closed, gated by `packages/node/test/contract/inbound-dispatch-failure.test.js` |
| `MX7` | Sustained send rate was bounded by `maxLabelBindings` divided by the correlation lifetime, about 136 messages a second at defaults against a burst ceiling near 2850. A label binding was released by a failure or by expiry and never by success, so a flow that never failed still filled the store. | Closed by `D23`, gated by `packages/node/test/contract/disposition-release.test.js`, measured by `scripts/sustained-rate.mjs` |
| `MX4` | A node hop costs far more than the carrier beneath it: a raw WebSocket round trip is about 75 microseconds against roughly half a millisecond per message through a node pair. Unexplained, and not a breach of anything. | Held under `B19`; historical observation, not a current baseline. Re-triage on a measured opportunity or consumer cost |
| `MX8` | The owner selected full native Rust CLI integration as the first consumer of the configurable CLI kernel; the shell surface at selection exposed only connections and routes. | Closed by `B42`; [integration record and live evidence](rustcli/INTEGRATION.md) |
| `MX9` | The owner's first-use transcript exposed repetitive operator help, root navigation failures, and management configuration available only at launch. | Closed by `B43`; [operator results and live evidence](rustcli/OPERATOR.md) |
| `MX10` | Zorg proposed that every failed disposition proves no handler received the attempt. At baseline `63938e7`, production Loopback probes on direct and three-node paths observed one handler invocation followed by `failed / NEXT_HOP_UNAVAILABLE` after channel loss. This is delivery uncertainty, not definite refusal. | Closed by `D31` and `B44`; gated by `test/resilience/delivery-certainty.test.js`, package disposition relay, surface, and schema tests |
| `MX11` | Zorg identified that `timeoutMs` was validated but never enforced. The node can wait at its event-loop yield and serialized executor even though capacity reservation itself does not wait; cancellation also needed a check at admission rather than only on entry. | Closed by `D32` and `B45`; gated by `packages/node/test/contract/send-admission-deadline.test.js` |
| `MX12` | Zorg's proposed request/reply layer needs the application correlation label on replies and dispositions. The SDK did not explain this composition. Zorg's opcall registry says not yet built, so its proposal is design evidence rather than a measured consumer integration. | Closed by `B46`; gated by the correlated request/reply in `packages/node/test/contract/disposition-surface.test.js` |
| `MX13` | Zorg's derived capability reading called committed AGP fixes pending and uncommitted, while opcall's contract treated an outright refusal as retry safety without qualifying earlier unknown attempts of the invocation. | Closed by `B47`; committed consumer records now read AGP `4ae96f1` and retain attempt-level uncertainty. Section 4.12 records the downstream evidence; this is record reconciliation, not consumer acceptance |
| `MX14` | Operation-call's first consumer verification was not certified; AGP regressions alone could not certify the consumer's attempt pairing or outcome mapping. | Closed by `B48`; [section 4.29](#429-operation-call-consumer-acceptance-closeout) records the corrected consumer's five handoff outcomes, inspected assertions and original execution logs at both source revisions; no browser or full Zorg integration claim |
| `MX15` | Named event and barrier waits had neither a local deadline nor a test timeout; the system runner supplied no per-test bound. CI's 30-minute job timeout did not identify a missing event or guarantee cleanup. Original source witnesses remain in section 4.10. | Closed by `B35`; named waits, owned cleanup, runner defaults, and explicit missing-event/process regressions. Section 4.11 records the scope; no new AGP runtime defect is claimed |
| `MX16` | The documented disposition methods existed on `NodeImpl` but not the public `AgpNode` factory return type; a TypeScript consumer received three `TS2339` errors. | Closed by `B49`; public-package compile regression in `packages/node/test/contract/disposition-types.test.js`; [local correction evidence](#414-public-disposition-typing-restored) |
| `MX17` | Browser/direct-hub requirements reopen security-profile feasibility; provider rotation, immutable peer evidence and one-shot identity admission do not define overlap or live authorization renewal. | Open investigation, `B6`; [section 4.24](#424-zorg-review-reply-assessment) records Zorg's four owner answers and the remaining server-owned redemption-to-OPEN bound and lifecycle handoff; live renewal is not required by Zorg |
| `MX18` | Browser support needs more than portable imports: native WebSocket controls differ from the current write, close/abort and native-input obligations; public shared-package imports fail the measured strict CSP. | Open investigation, `B50`; section 4.15 records the obligation map and bounded Chrome observations, not browser conformance or an approved contract revision |
| `MX19` | Existing route admission, export derivation and source checks do not supply a per-principal advertise/discover/send policy or handler-facing current authorization context. | Open investigation, `B51`; [section 4.24](#424-zorg-review-reply-assessment) identifies a scoped reply-isolation gap: D26 prevents wrong-handler service, not wrong-peer receipt of bytes; retain generic multi-hop pin semantics while designing the stronger consumer guarantee |
| `MX20` | At the source baseline in section 4.18, the node supplied no effective connect deadline/cancellation or post-await ownership check, contrary to the ratified acquisition contract. | Closed locally, `B52`; [section 4.20](#420-acquisition-repair-review-and-local-commit) records the reviewed commit and verification scope; no push, independent acceptance or pre-fix runtime reproduction is claimed |
| `MX21` | Identity admission holds the transport reader, and final controller release waits for that reader; an unanswered admission can therefore retain an expired inbound connection indefinitely. | Open, `B53`; [section 4.21](#421-identity-admission-timeout-and-teardown-finding) records the finding; [section 4.25](#425-admission-lifetime-independent-review) preserves the first FAIL; [section 4.26](#426-admission-lifetime-handoff-revisions-and-zorg-response) records revision 3's technical design PASS; [section 4.31](#431-admission-assurance-preparation-and-consumer-pin-publication) records the fresh-reader assurance FAIL; [section 4.32](#432-admission-assurance-findings-triage) records author triage; [section 4.33](#433-admission-lifetime-clarification-and-independent-review) records revision 4's independent technical and scoped M7 PASS; [section 4.34](#434-admission-clarification-assurance-preparation) preserves the new instrument's readiness FAIL; [section 4.38](#438-admission-assurance-accounting-correction-and-bounded-recheck) records the prospective accounting correction and bounded recheck PASS; fresh assurance, final adoption and runtime repair remain outstanding |
| `MX22` | The director intends hundreds of concurrent browser peers against one node, while confirmed intent still targets fewer than twenty nodes. Current configurable limits do not establish support for the expanded use case. | Open, `B54`; [section 4.78](#478-browser-peer-scale-public-binding-handoff) records the public-binding request placed with context-lab after key/protocol PASS; owner confirmation, execution validation/resources, fresh-reader assurance, ratification and the operating envelope remain open |
| `MX23` | The current session-timer callback dispatches expiry without rereading its stored monotonic deadline; transport-close cancellation also acts directly on its callback. Zorg reports an early-wakeup defect in its own call layer, not a reproduced AGP failure. | Open investigation, `B55`; [section 4.30](#430-session-timer-deadline-authority) pins the source observation, limits the claim and separates this review from B48's accepted consumer outcomes and B53's admission repair |
| `MX24` | At the pre-repair baseline, disposition flush discards the rejectable `writeControl` result inside a synchronous catch; carrier failure, queue refusal or shutdown can therefore leave that promise unobserved. | Open, `B56`; [section 4.80](#480-disposition-repair-main-publication-for-consumer-verification) records director-selected repair-only publication on remote `main` for consumer verification; four runtime properties and a distinct acceptance judgment remain unestablished |

**Currency correction (2026-10-09):** `MX4` retains its original measurement, which predates subsequent optimisation decisions and cannot rank a present fix.\
`MX12` retains the consumer location at assessment; Zorg later moved opcall to `apnex/opcall` and renamed its registry entry `CONTRACT.md`.\
The contract still says not yet built.\
Section 4.10 records the current evidence and the resulting priorities.

`MX1` was reproducible and understood, and `D19` ratifies the mechanism that closed it.\
`ws` emits every frame parsed from one TCP segment in a single turn, so a burst of small messages arrives faster than `pause()` can take effect and the configured bound is exceeded within one tick.\
Loopback is unaffected because it applies backpressure synchronously, and the pre-shared-key profile only survives longer because TLS adds enough latency per message to stay ahead.

The adapter follows the letter of its contract: `binding-websocket.md` section 10 requires `RECEIVE_OVERFLOW` when backpressure cannot prevent the bound being exceeded, and `D14` states that a fulfilled `send()` does not prove peer receipt.\
What the contract does not state is the consequence, which is that AGP v1 has no end-to-end flow control and a fast sender therefore resets a healthy session rather than being slowed.

Two details made this a design question rather than a patch.\
Pausing at a high -water mark below the bound was tried and does not fix it, because the frames are already parsed.\
And `binding-websocket.md` says the adapter pauses *before* exhausting the bound while the implementation pauses *at* it, so the wording and the code disagree even though neither prevents the overrun.

`MX2` was separated from `MX1` on evidence rather than on suspicion.\
With credit disabled the cell fails at both deadlines, and with credit enabled it passes at twenty seconds and fails at two, so the loss and the expiry are two faults rather than one.\
The expiries also land on sessions with no data on them, which no per-hop grant can be pacing.\
What is not yet established is whether the deadline is simply too tight for a topology of this size on a shared event loop, or whether something is starving the acknowledgement path, and the difference decides whether this is a harness bound or a defect.

`MX2` was not a harness bound and was not credit.\
The write path of the operations plane was quadratic, and it blocked the event loop for up to five hundred and ninety milliseconds at a time.\
Everything measured against a deadline during such a stall was being compared to a clock the stall had already moved, which is why route acknowledgement, credit replenishment and delivery all degraded together and why explaining any one of them alone failed.

The ladder in `scripts/latency-ladder.mjs` localised it, and a processor profile named it.\
Deep cloning was thirty-one percent of all processor time, because every commit returned a freshly materialised clone of the whole of canonical state and a delivered message commits three times.\
`D21` records the correction and the invariant it rests on.

| Measure | Before `D21` | After |
|---|---|---|
| Matrix, every carrier, deepened | 68 of 70 in 284s | 70 of 70 in 38s |
| One write against 500 held entries | 1529us | 3us |
| Per-write growth for tenfold held state | tenfold | none |
| Credit replenishment, worst | 14.6ms | 8.3ms |

Two figures previously published here have been withdrawn rather than restated.\
A drain time and an event-loop worst case were quoted from an instrument that measured only the interval after the send loop had finished, so the two phases overlapped and the number reported whichever ended last.\
It read lower for more messages, which should have been caught when it was written.\
The ladder now times from the first send to the last arrival, and the lag sampler uses a fixed-rate timer rather than one that re-arms after firing, because a self-rearming sampler stops sampling exactly when the loop is busiest and understates the stall it exists to detect.\
The measures kept above are the ones that survived the correction: an end-to-end sweep and a microbenchmark, neither of which depended on the faulty instrument.

The credit replenishment figure is the one worth reading twice.\
It was the number the whole investigation began from, it was assumed to be credit's, and credit never touched it.

Three further projections were memoised against exact change signals after `D21`, and session transitions and timer resets were narrowed to commit session state alone.

A fourth was tried and reverted, and the negative result is worth more than the change would have been.\
Per-session route import and export views sit inside the connection projection and are rebuilt twice per delivered message against routing that has not moved, which is the same fault as the three that paid off.\
Memoising them against the routing revision produced no measurable improvement, on the ladder or on the deepened sweep, so the machinery was removed rather than kept on the strength of the argument for it.\
Two caches and their invalidation are a standing liability; an unmeasurable gain does not buy one.

#### The per-message bill

Counted rather than reasoned about, across a node pair, for one delivered message.\
A message is one JSON envelope in one WebSocket frame, so this is the whole cost of moving 258 bytes between two nodes.

| Work | Before | After | Note |
|---|---|---|---|
| Operations revisions | 6.07 | 5.07 | One commit wrote nothing and said so |
| `encodeAgpPacket` | 2.04 | 1.03 | The sender serialised the same packet twice |
| Schema validations | 3.07 | 2.07 | One per encode, one per parse |
| `parseAgpPacket` | 1.03 | 1.03 | |
| Preflight scans | 1.03 | 1.03 | |
| Operational events | 4.10 | 3.07 | The self-transition is recorded, not announced |

Measured against each other in one session, three runs each, the pair moved from about 768 to about 679 microseconds per message.

The double encode existed to size an admission before allocating a return token, then encoded again with the real token and asserted the sizes matched.\
That assertion could not fail, because the token is fixed-width by contract and that is the only reason a preview was legal in the first place.\
The second encode proved what the contract already guaranteed and charged a serialisation and a validation to do it.\
Deciding everything that does not need the encoded size first leaves one encode.

The label binding commit that follows every local delivery supplies a set the delivery never altered.\
The projection is memoised, so an unchanged set arrives as the same reference and is recognised without inspection, and the commit now writes nothing and issues no revision.\
A revision denotes a change to canonical state; issuing one for a commit that wrote nothing makes it useless as a change signal and forces every consumer polling on it to re-read.

The transit path carried the same fault and is now closed too.\
Classification encoded a preview and forwarding encoded again, and the restructuring that removed it is `B28`: the decision those two shared is resolved once, so there is one encode per forwarding hop rather than two at every transit.\
Measured over a two-hop chain, a delivered message costs 2.07 encodes, which is one per hop that forwards it and a fraction for control.

The fourth event per message was a `session.transition` announcing that the session stayed `Established`.\
`D22` records why it is now withheld for a delivery and kept for a keepalive, and the short of it is that the delivery already announced itself three times while the keepalive announces nothing else.\
Three events per delivered message remain, and all three are earned.

#### What the saturation actually was

`B18`.\
The residual stall was attributed to distributed cost on the strength of one steady-state profile, and that attribution was wrong twice over.

It was wrong because it was never tested.\
Section 4.9 rule 11 requires disabling a suspected path and requiring the number to move, and none of the three suspects a profile had named was ever disabled.\
When they finally were, none of them moved the stall at all.

It was also wrong because it was measured co-located, where two nodes share one event loop.\
`B22` later put the co-located stall at 450 ms against 30 ms isolated, so most of what had been profiled was two nodes contending rather than one node working.

Disabling each suspect in turn, with the driver yielding so its own loop was not the subject:

| Suspect disabled | Throughput | Worst stall |
|---|---|---|
| Schema validation on encode | +6% to +14% | unchanged |
| Schema validation on parse | +4% to +12% | unchanged |
| Event materialisation | 0% to +4% | unchanged |
| Session state clone per command | 0% | unchanged |

So the cost was concentrated and the stall was somewhere else entirely.

The stall was the load generator.\
`saturate` awaits `send()` in a tight loop, every step of admission settles as a microtask, and microtasks are drained to exhaustion before a timer fires, so the loop never reached the macrotask queue and the one-millisecond sampler never ran.

| Driver yields | Throughput | Worst stall |
|---|---|---|
| Never | 4983 msg/s | 25181 us |
| Every send | 4683 msg/s | 4279 us |
| Every 16 sends | 5352 msg/s | 10242 us |
| Every 128 sends | 4882 msg/s | 31798 us |

Around 21 ms of the 25 was the harness, and about 4 ms is the node.

That is not only an instrument fault, which is why it produced a decision rather than a correction.\
Any application that awaits `send()` in a loop starves the same loop, and the timers it starves include this node's hold and route-acknowledgement deadlines, which is the `MX2` teardown mechanism exactly.\
`D28` makes the node yield every sixteenth send so a caller cannot do this, and `D27` stops validating outbound messages this node built itself.

Measured together over three clock-matched pairs, against the same binary without them: throughput up 14.8, 15.9 and 16.8 per cent, and the worst stall down 53, 40 and 44 per cent.

#### What loop saturation does to an event subscriber

`MX3` was scored a latent correctness fault on the argument that a stall moves deadlines.\
It has a second consequence that can be demonstrated rather than argued, and it is the clearer reason to care.

A delivered message produces about three operational events, so four hundred messages produce about twelve hundred.\
A subscriber that stays on the microtask queue keeps up with all of them and loses nothing.\
A subscriber that yields to the macrotask queue, which is what any subscriber doing real work does, is scheduled about as often as the loop drains, and under a stream that is roughly twelve times in total.

| Subscriber, 400 messages | Buffer | Gaps | Events reaching it |
|---|---|---|---|
| Does nothing | 256 | 0 | 1205 |
| Yields a microtask | 256 | 0 | 1205 |
| Yields a macrotask | 256 | 260 | 15 |
| Yields a macrotask | 2048 | 0 | 746 |

`D24` corrected this by separating the streams rather than by enlarging a bound.\
Re-measured against a 600-message stream, an operator subscriber doing real work lost 256 events at a buffer of 256 and 175 at the default of 1024; it now loses none at a buffer of one, because the operations stream is no longer traffic-rated.

The per-message detail is unchanged for a consumer that asks for it, and still costs what it always did: that stream is traffic-rated by construction and its consumer sizes it.\
What changed is who pays, and it is no longer the operator who only wanted to know when something broke.

The bound is not the subscriber's speed and not a defect in the subscriber queue, which behaves exactly as specified and reports every drop.\
It is that the buffer must absorb the whole burst rather than bridge the subscriber's own latency, because saturation removes the subscriber's opportunities to drain.\
The buffer a deployment needs is therefore set by how badly the node saturates its loop, which is `MX3`, rather than by anything the operator controls about their own consumer.\
Twelve hundred events against a default of 1024 makes that default marginal for a burst of this size.

An earlier reading here concluded that buffer size made no difference at all.\
That was wrong: the harness ignored the parameter being varied, so three runs at three nominal sizes were three runs at 256.\
The instrument is now parameterised, and the rule it cost is in the method below.

Absolute figures drift between sessions on a shared machine, and this is where that was learned.\
The same measurement read 525 microseconds per message one hour and 670 the next with no change in between, and the deepened sweep read 40 seconds and then 25.\
Only measurements taken against each other within one session are comparable, and any figure quoted here without its counterpart is an observation rather than evidence.\
A message costs about 525 microseconds end to end through a node pair, down from roughly one millisecond, and the deepened sweep runs in about 40 seconds against 284 before any of this began.\
Six commits per delivered message was the next thread, and it ran out.\
`D25` took a delivered message from 9.17 canonical revisions to 5.29 by stopping four traffic-rated values inside a session record from claiming that canonical state changed, and what remains is the counter increments, which are genuine.

`MX3` and `MX4` are separated because confirmed intent scores them differently.\
There is no performance target, so a cost that is merely large is not a defect and `MX4` is an opportunity rather than an obligation.\
A stall is not merely a cost: it moves every deadline sharing the loop, and that is the exact mechanism by which a healthy session was torn down before `D21`.\
`MX3` is therefore chased as a latent correctness fault and `MX4` is taken when a way is found.

#### Throughput ceiling

Measured one carrier per process, because measuring three in one gave the later ones warm compilation and a grown heap and reported TLS as faster than an in-process fabric.\
One thousand messages, three runs, median.\
Compare the columns to each other and to nothing else.

Isolation now covers both socket carriers, and the pre-shared-key carrier authenticates across processes with a key table the parent generates and hands to each child.\
No isolated figure is published here yet.\
Three attempts produced three orderings, the last of them putting pre-shared keys at three times Loopback, and the machine they ran on was saturated by the work that produced them.\
The capability is landed and the measurement is `B22`, to be taken on a quiet machine.\
Two contaminations specific to an isolated run are already known and belong to that work: delivery is observed by the parent over a channel the parent must be scheduled to drain, and the sender and receiver are timed by different clocks.

The figures above were taken with both nodes of each pair sharing a process.\
Isolation is now an axis of the geometry harness rather than a separate harness, so `node scripts/throughput.mjs --isolation=process` runs each node on its own.\
A first isolated reading put a WebSocket pair near the co-located one with a wider spread, which says the one-hop carrier comparison was not badly distorted by co-location, and says nothing yet about deeper shapes where four nodes shared one loop.\
When nodes are isolated the loop-lag sampler measures the driver rather than the nodes, and is labelled accordingly.\
Loopback has no cross-process carrier yet, so once the other two are isolated it stops being a like-for-like baseline and becomes the node's own ceiling instead; `F08` records the mechanism that would restore the comparison.\
The carrier comparison is sound because every carrier was measured the same way, but the absolute rate is a floor rather than a ceiling.\
`B22` owns re-measuring against the independent-process harness the end-to-end suite already uses.

| Carrier | One hop | Two hops | Against Loopback |
|---|---|---|---|
| Loopback | 2849 msg/s | 1221 msg/s | 100% |
| WebSocket | 2890 msg/s | 1080 msg/s | 101% and 88% |
| WebSocket with pre-shared keys | 1868 msg/s | 744 msg/s | 66% and 61% |

The carrier is not the bottleneck at one hop.\
An in-process fabric and a real TCP socket measure the same, because the node's own per-message cost dominates both, and that cost is the subject of `MX3`.\
Pre-shared keys cost about a third, and a second hop costs slightly more than half, which is the transit node paying the same per-message cost again.

#### What a node costs itself, measured with each node in its own process

`B22`.\
Five arms, interleaved: each round runs every arm once, in a fresh process, and the table reports the median over rounds.\
Interleaving is what makes this readable at all, and the reason is in section 4.9 rule 8.

| Arm | Median | Relative | Isolation gains |
|---|---|---|---|
| Loopback, co-located | 2405 msg/s | 100% | not possible, `F08` |
| WebSocket, co-located | 2455 msg/s | 102% | |
| WebSocket, isolated | 3517 msg/s | 146% | 43% |
| WebSocket with pre-shared keys, co-located | 1748 msg/s | 73% | |
| WebSocket with pre-shared keys, isolated | 2699 msg/s | 112% | 54% |

Two nodes in one process cost about a third of throughput, because they share an event loop and contend for it.\
Section 4.9 already required isolation for a measurement that compares; this is the size of what it was requiring.

Pre-shared keys cost 29 per cent co-located and 22 per cent isolated.\
The difference is the second process: the cipher gains somewhere else to run.

Co-located, Loopback and a real TCP socket still measure within two per cent of each other, which is the earlier finding unchanged.\
Isolated, WebSocket reaches 146 per cent of the Loopback baseline, so what made the carrier look irrelevant was the node contending with itself rather than the carrier being free.

The worst loop stall under each arm is the clearest single number here: 450 ms co-located on Loopback against 30 ms isolated on WebSocket.\
That is `MX3` seen from the outside.

A first attempt at this table put the isolation gain at 67 to 82 per cent and was wrong.\
It ran the co-located arms and the isolated arms as separate invocations, and the isolated ones happened to fall at a higher processor clock, so half the gain was the host.\
The figures above were taken while the clock moved by nineteen per cent and are stable across invocations to within five points, because no arm gets a clock the others did not.

#### What loop saturation does to an event subscriber

`MX3` was scored a latent correctness fault on the argument that a stall moves deadlines.\
It has a second consequence that can be demonstrated rather than argued, and it is the clearer reason to care.

A delivered message produces about three operational events, so four hundred messages produce about twelve hundred.\
A subscriber that stays on the microtask queue keeps up with all of them and loses nothing.\
A subscriber that yields to the macrotask queue, which is what any subscriber doing real work does, is scheduled about as often as the loop drains, and under a stream that is roughly twelve times in total.

| Subscriber, 400 messages | Buffer | Gaps | Events reaching it |
|---|---|---|---|
| Does nothing | 256 | 0 | 1205 |
| Yields a microtask | 256 | 0 | 1205 |
| Yields a macrotask | 256 | 260 | 15 |
| Yields a macrotask | 2048 | 0 | 746 |

`D24` corrected this by separating the streams rather than by enlarging a bound.\
Re-measured against a 600-message stream, an operator subscriber doing real work lost 256 events at a buffer of 256 and 175 at the default of 1024; it now loses none at a buffer of one, because the operations stream is no longer traffic-rated.

The per-message detail is unchanged for a consumer that asks for it, and still costs what it always did: that stream is traffic-rated by construction and its consumer sizes it.\
What changed is who pays, and it is no longer the operator who only wanted to know when something broke.

The bound is not the subscriber's speed and not a defect in the subscriber queue, which behaves exactly as specified and reports every drop.\
It is that the buffer must absorb the whole burst rather than bridge the subscriber's own latency, because saturation removes the subscriber's opportunities to drain.\
The buffer a deployment needs is therefore set by how badly the node saturates its loop, which is `MX3`, rather than by anything the operator controls about their own consumer.\
Twelve hundred events against a default of 1024 makes that default marginal for a burst of this size.

An earlier reading here concluded that buffer size made no difference at all.\
That was wrong: the harness ignored the parameter being varied, so three runs at three nominal sizes were three runs at 256.\
The instrument is now parameterised, and the rule it cost is in the method below.

Absolute figures drift between sessions on a shared machine, and this is where that was learned.\
The same measurement read 525 microseconds per message one hour and 670 the next with no change in between, and the deepened sweep read 40 seconds and then 25.\
Only measurements taken against each other within one session are comparable, and any figure quoted here without its counterpart is an observation rather than evidence.\
A message costs about 525 microseconds end to end through a node pair, down from roughly one millisecond, and the deepened sweep runs in about 40 seconds against 284 before any of this began.\
Six commits per delivered message was the next thread, and it ran out.\
`D25` took a delivered message from 9.17 canonical revisions to 5.29 by stopping four traffic-rated values inside a session record from claiming that canonical state changed, and what remains is the counter increments, which are genuine.

`MX3` and `MX4` are separated because confirmed intent scores them differently.\
There is no performance target, so a cost that is merely large is not a defect and `MX4` is an opportunity rather than an obligation.\
A stall is not merely a cost: it moves every deadline sharing the loop, and that is the exact mechanism by which a healthy session was torn down before `D21`.\
`MX3` is therefore chased as a latent correctness fault and `MX4` is taken when a way is found.

#### Throughput ceiling

Measured one carrier per process, because measuring three in one gave the later ones warm compilation and a grown heap and reported TLS as faster than an in-process fabric.\
One thousand messages, three runs, median.\
Compare the columns to each other and to nothing else.

Isolation now covers both socket carriers, and the pre-shared-key carrier authenticates across processes with a key table the parent generates and hands to each child.\
No isolated figure is published here yet.\
Three attempts produced three orderings, the last of them putting pre-shared keys at three times Loopback, and the machine they ran on was saturated by the work that produced them.\
The capability is landed and the measurement is `B22`, to be taken on a quiet machine.\
Two contaminations specific to an isolated run are already known and belong to that work: delivery is observed by the parent over a channel the parent must be scheduled to drain, and the sender and receiver are timed by different clocks.

The figures above were taken with both nodes of each pair sharing a process.\
Isolation is now an axis of the geometry harness rather than a separate harness, so `node scripts/throughput.mjs --isolation=process` runs each node on its own.\
A first isolated reading put a WebSocket pair near the co-located one with a wider spread, which says the one-hop carrier comparison was not badly distorted by co-location, and says nothing yet about deeper shapes where four nodes shared one loop.\
When nodes are isolated the loop-lag sampler measures the driver rather than the nodes, and is labelled accordingly.\
Loopback has no cross-process carrier yet, so once the other two are isolated it stops being a like-for-like baseline and becomes the node's own ceiling instead; `F08` records the mechanism that would restore the comparison.\
The carrier comparison is sound because every carrier was measured the same way, but the absolute rate is a floor rather than a ceiling.\
`B22` owns re-measuring against the independent-process harness the end-to-end suite already uses.

| Carrier | One hop | Two hops | Against Loopback |
|---|---|---|---|
| Loopback | 2849 msg/s | 1221 msg/s | 100% |
| WebSocket | 2890 msg/s | 1080 msg/s | 101% and 88% |
| WebSocket with pre-shared keys | 1868 msg/s | 744 msg/s | 66% and 61% |

The carrier is not the bottleneck at one hop.\
An in-process fabric and a real TCP socket measure the same, because the node's own per-message cost dominates both, and that cost is the subject of `MX3`.\
Pre-shared keys cost about a third, and a second hop costs slightly more than half, which is the transit node paying the same per-message cost again.

#### What a node costs itself, measured with each node in its own process

`B22`.\
Both tables below are one session on one machine, five runs per carrier, and both ran at 4100 to 4165 MHz, which is why they may be compared with each other at all.

| Carrier | Co-located | Isolated | Isolation gains |
|---|---|---|---|
| Loopback | 2779 msg/s | not possible, `F08` | |
| WebSocket | 2862 msg/s | 4785 msg/s | 67% |
| WebSocket with pre-shared keys | 2070 msg/s | 3769 msg/s | 82% |

Two nodes in one process cost between forty and forty-five per cent of throughput, because they share an event loop and contend for it.\
Section 4.9 already required isolation for a measurement that compares; this is the size of what it was requiring.

Pre-shared keys cost 28 per cent co-located and 21 per cent isolated.\
The difference is the second process: the cipher has somewhere else to run.

Co-located, Loopback and a real TCP socket still measure the same, which is the earlier finding unchanged.\
Isolated, WebSocket reaches 4785, so what made the carrier look irrelevant was the node contending with itself rather than the carrier being free.

The worst loop stall under each run is the clearest single number here: 383 ms co-located on Loopback, against 24 ms isolated on WebSocket.\
That is `MX3` seen from the outside.

These are burst figures, and the sustained ceiling used to be a different number entirely.

A label binding is retained for every message a node originates, and AGP had no delivery acknowledgement, so nothing could release it early: it waited out the label binding lifetime whether or not the message arrived.\
The sustained rate was therefore capacity divided by lifetime, about 136 messages a second at defaults, against a burst ceiling near 2850.\
It arrived in cycles rather than smoothly, because a burst of correlations created together expires together: measured over forty seconds, 4096 admitted immediately, nothing for the next twenty seconds, then 4096 more.

`D23` corrects this, and `scripts/sustained-rate.mjs` measures the correction as an in-session A/B against the same binary.\
One arm holds both batch bounds open so no report returns, which reproduces the old behaviour without reverting code; the other leaves them at their defaults.

| arm | admitted | refused | in-window msg/s |
|---|---|---|---|
| held | 512 | 79824 | 102 |
| released | 5847 | 9 | 1222 |

The held arm admits exactly the label count and then refuses everything, so its rate column understates it: the true sustained rate is the label count over the retention window, and no measurement window changes that.\
The released arm is no longer bounded by the table at all, and its nine refusals are the batch interval briefly outrunning the offered rate rather than a ceiling.

A label binding holds no payload and is not load-bearing for delivery.\
It is the reverse path: `D8` returns an outcome through label bindings rather than through the RIB, so each hop keeps a record of who to tell if a later hop complains.\
A missing or expired one degrades to `unreturnable`, which is discarded rather than fatal, so the retention window bounds how long an error can find its way home and bounds nothing else.

That is what made the behaviour an anomaly rather than a cost.\
A node was throughput-capped by state it retained exclusively for failures that did not happen, and a quality knob was serving as a hard bound.\
The design that corrects it is written out in [`design/message-labels.md`](design/message-labels.md), together with the per-flow alternative that was considered and the reason it is not being built.\
`F11` records why a store-and-forward relay would meet this ceiling before anything else does.

Two things learned while measuring this are worth keeping.\
Holding the old behaviour open takes both batch bounds: pinning only the debounce interval leaves the outcome count at its default of 256, which sends the batch anyway and makes the two arms measure the same thing.\
And the debounce that drains an origin's table is the far end's rather than its own, because the far end is what reports; configuring only the sender configures the wrong half.

#### Eliminated causes

A cause is recorded once it is ruled out, so the same candidate is not tested twice.

The first measurement taken through the projection `D20` requires put a figure on it.\
A sender paced by a fourteen-packet grant stalled eight times over ninety messages and waited between eleven and fifteen milliseconds for each replenishment, over loopback, with the process otherwise idle.\
That is the number the investigation is chasing, and it is now a query rather than a reconstruction.

The projection itself is not a plausible contributor.\
Recording an observation costs about three nanoseconds and advancing the read counter about two, against a replenishment measured in milliseconds; only the snapshot allocates, and it runs once per query rather than once per packet.

| Candidate | Why it is eliminated |
|---|---|
| Small-write batching by the carrier | `ws` calls `socket.setNoDelay()` inside `setSocket`, which both the client path and the server path reach, so the algorithm that would delay a small frame behind an outstanding acknowledgement is disabled at both ends |
| Acknowledgement held behind paced data in the sender queue | Traced leaving the queue ahead of the stall, by the exception that permits exactly that |
| A credit deadlock | The stall wakes, and the same cell completes whole when only the acknowledgement deadline is widened |

---

### 4.7 Matrix execution

The geometries, transports, and traffic drivers are declarative, so any combination can be executed rather than only the cells the default suite names:
```bash
npm run test:matrix          # every legal loopback cell
npm run test:matrix:all      # every carrier
node scripts/run-matrix.mjs --deep --geometry=chain
node scripts/run-matrix.mjs --transport=all --plan --json
node scripts/run-matrix.mjs --transport=all --cover --json
```

A sweep is a diagnostic instrument and deliberately not part of `npm test`.\
A failing cell reports that a combination broke, not which layer owns it, and section 2.1 requires a failure to name its owning layer.\
Use a sweep to find where to look, then reproduce what it found in a named file with a specific oracle.

A cell asserts convergence and surviving reverse reachability, plus its traffic oracle: one expected payload, an exact ordered stream, or settled burst admissions with matching arrival count and no observed duplicates.\
Shape-specific properties stay in named tests, because only a triangle test can assert that no exported path repeats a node and only a diamond test can assert an alternate candidate stays observable.

[`matrix-coverage.json`](design/matrix-coverage.json) owns the dimensions, depth profiles, X3 exclusion, mechanism-exercise rules, and assertion definitions (`B3`).\
`--plan --json` emits each legal cell's effective counts, matching rule IDs, exercised mechanisms, assertions, and coverage keys without opening a topology.\
`--json` on an execution adds per-cell results and the assertions actually passed; a plan alone claims no execution.\
The conformance gate resolves the declarations to the mechanism register, source files, and runner assertions.\
A live cell also checks that its executed oracles match its declared assertions.

`--cover` selects a deterministic, unweighted covering subset over single-axis values, mechanism IDs, and assertions in the requested space.\
It removes individually redundant cells but does not claim a globally minimum set, every dimension interaction, or complete certification of any mechanism.\
Mechanisms not exercised by the requested space are explicitly listed.\
All full mechanism contracts remain owned by the named gates.\
The ordinary sweep remains unchanged in breadth: 30 Loopback or 70 all-carrier legal cells.\
The covering subset is opt-in, not a replacement for that sweep or `npm test`.

Plans and execution share effective parameters.\
`AGP_DEEPEN_CHAIN`, `AGP_DEEPEN_STREAM`, `AGP_DEEPEN_BURST`, and `AGP_DEEPEN_ROUTES` override the chosen profile; routes controls the moderate endpoint count per node.\
Counts must be positive safe integers, a chain has at least three nodes, and the entire requested plan must fit the 256-route snapshot ceiling before execution begins.\
Every matrix topology remains in-process; independent-process evidence belongs to the named equivalence and resilience tests.

Historical measured cost: 30 loopback cells in about 4 seconds, 70 cells across all carriers in about 9 seconds, and roughly two minutes deepened.

A sweep runs on demand and on no schedule, ruled by the director.\
That historical cost informed the ruling not to build a persistent cost model (`B4`).\
The runner reports elapsed time for an execution but collects no cost history and does not use timing to select cells; `B3` selects by declared coverage alone.\
The trigger is sweep runtime becoming a felt cost, which is also the point at which a schedule would begin to earn its keep.

---

### 4.8 Excluded combinations

Each exclusion is a decision with a re-entry condition, in the same form as the deferred mechanisms in [`design/mechanisms.md`](design/mechanisms.md).

| ID | Excluded | Why | Re-entry condition |
|---|---|---|---|
| `X1` | Full mesh geometry | Per-pair keying is unsolved, and one key per node would let a single compromise forge every identity | A mesh key model under `F07` |
| `X2` | Partition and heal | Injected adversity is owned by `AX8`; `AX7` proves healthy composition only | None; already covered at its own gate |
| `X3` | `burst` over a real socket | Concurrency against a real carrier makes the oracle timing-dependent, and the same bound is proved deterministically over Loopback | A defect that reproduces only over a real carrier |
| `X4` | Channel protection per geometry | The profile is carrier-level and geometry-independent, so one witness under transit is sufficient | A geometry whose behavior depends on the security profile |
| `X5` | Traffic or route volume on every geometry | Volume stresses a transit hop and a RIB, neither of which varies with shape once one transit exists | A geometry whose volumetric behavior differs from `line` |

---

### 4.9 Chasing a timing defect

A timing defect is a class, not an incident, and it resists the method that works on functional defects.\
Everything passes while it is present, so there is no failing assertion to bisect toward, and reasoning about it produces plausible causes at a rate that feels like progress.\
`MX2` absorbed two rounds of that before anything moved.

The order below is the one that worked, and it is ordered deliberately.

1. **Read the plane before reaching for a trace.**\
   `D20` requires bounded resources and measured durations to be queryable.\
   Reaching for a trace instead means the plane is missing something, and that absence is filed as a finding rather than worked around.
2. **Measure with a clock.**\
   Line numbers in a log are not time, and treating them as time is how a first pass concluded that packets were being dropped when they were being read late.
3. **Repeat before believing.**\
   A single stream run varies by a factor of two on an idle machine, so the ladder repeats and reports best, median and worst.\
   Acting on one sample is how a regression and an outlier become indistinguishable, and a reading of 979 microseconds per message was nearly acted on before three further runs put it at 525.
4. **Let an isolated node generate its own load.**\
   Driving sends from the parent puts an inter-process round trip in front of every one, so the figure measures the harness channel rather than the subject.\
   Done that way, the pre-shared-key carrier read as the fastest of the three, because its round trip happened to be cheapest that run.\
   The parent says how many to send; the node sends them and reports what it took.
5. **Give each node its own process when the measurement compares.**\
   Nodes sharing a process share an event loop, a heap and a compilation state, so they contend in ways a deployment would not and they warm each other up.\
   Measuring three carriers in one process reported TLS as faster than an in-process fabric purely because it ran last.\
   This binds on measurement, not on correctness: a functional test co-locates nodes deliberately and cheaply, and isolating it would cost minutes and prove nothing.\
   A figure taken with nodes co-located is reported as such or it is not reported.\
   Loopback cannot be isolated today because its fabric is an in-process object, which is a fact about the current implementation and not about the transport; `F08` records what a cross-process carrier would take.
6. **Prove the knob moved before believing the result.**\
   A control that varies nothing produces three identical readings and reads as a strong negative.\
   A parameter was passed to a harness that did not accept it, and the conclusion drawn was the opposite of the truth.
7. **Compare within one session, never across them.**\
   The same unchanged measurement read 525 microseconds per message and then 670 an hour later, and a sweep read 40 seconds and then 25.\
   An A and a B taken hours apart compare the machine, not the change.
8. **Interleave the arms; do not try to hold the host still.**\
   A scaling processor clock is a property of every host worth measuring on, so an instrument that needs it pinned is an instrument nobody can use.\
   Under a scaling governor the clock ran between 4200 and 800 MHz, and five identical invocations read 4824, 4967, 4902, 4044 and 3555 messages a second in that order, which looks exactly like a regression and is the clock winding down.\
   Three earlier attempts at this measurement produced three orderings and the machine was blamed for being busy; it was not busy, it was at a different speed each time.\
   Running all of A and then all of B puts that drift between the arms, where it becomes the difference.\
   Alternating them puts the same drift through both, where it cancels.\
   Measured: two interleaved invocations whose absolute throughput differed by sixteen per cent reported ratios within two points of each other, and the arms include how a node is deployed, because whether nodes share a process is exactly the sort of thing worth comparing.\
   The clock is still sampled and reported, not to gate anything, but so a reader knows which figures are absolute and which are the ratios worth trusting.
9. **Climb the ladder, do not measure the whole.**\
   `scripts/latency-ladder.mjs` adds one layer per rung, so the rung where the milliseconds appear names the layer that owns them.\
   A single end-to-end number cannot do that, and chasing one produces hypotheses rather than causes.
10. **Sample event-loop lag underneath every measurement, in the process doing the work.**\
   In a single-process topology a slow path and a starved one look identical.\
   `test/support/loop-lag.js` separates them, and in `MX2` the lag was the finding.\
   Sample it where the work happens: a driver that samples its own loop while the node runs elsewhere read 1251 microseconds against the node's 42688 and reported a stall-free node.
11. **Profile before fixing.**\
   A processor profile named the function in one run, after reasoning had failed twice.\
   `node --cpu-prof` against one ladder rung is enough.
12. **Prove the cause before believing it.**\
   Disable the suspected path, measure again, and require the number to move.\
   Two suspects were eliminated this way before the third survived.
13. **Fix the shape, not the constant.**\
   A tenfold constant improvement on a quadratic is a longer fuse, not a fix, and it will read as success on every benchmark small enough to run in a test.
14. **Revert what cannot be shown to help.**\
   A change that is principled, small and unmeasurable is still machinery somebody must maintain and can get wrong.\
   Record the negative result so the next reader does not spend the same afternoon proving it again.

Measured cost of the instruments: recording an observation is about three nanoseconds, and advancing a counter about two.\
An instrument that perturbs what it measures makes every number taken through it unfalsifiable, so this bound is a requirement rather than a boast.

---

### 4.10 Board reconciliation

**Status update:** this section retains the initial reconciliation and its pre-implementation source observations.\
`B35` subsequently closed under section 4.11, and `B47` closed against committed consumer evidence under section 4.12.\
The director requested no additional response; neither contact nor record reconciliation is consumer-acceptance evidence.

Review date: 2026-10-09.\
AGP baseline: `4ae96f17542a439021aaa92aa45436e3b35ea068`; `git ls-remote --heads origin main` returned the same revision.\
Consumer sources: Zorg `8b8e9259d616bf42ebaaf1a9209d650259f0aab3` and opcall `4cc3626076bbb7538aa47c25de1341fbd18f1f04`, both clean at inspection.\
These are source-state observations, not deployment or consumer-acceptance evidence.

The review reconciles four input paths: current AGP contracts and source, the consumer's own proposal and current records, the history of earlier choices and rejected approaches, and the executable checks that constrain the claims.\
Agreement among AGP-authored records alone is not independent consumer confirmation.

| Input | What it establishes | What it does not establish |
|---|---|---|
| D31/D32, SDK contract, `send-admission.ts`, and delivery/correlation regressions | The three consumer fixes have implementation and named AGP proof obligations | That opcall consumes them correctly |
| Zorg's original filing, current `upstream/agp-capabilities.md`, D16/D17, and opcall's `CONTRACT.md` | The consumer record still describes the fixes as pending; opcall is a separate, unbuilt component | A running integration or a newly reproduced AGP defect |
| Commits `35c4cc5`, `da1a03a`, `6cdf503`, `d2174a2`, and `4ae96f1` | The register's trial, rejection of architecture bookkeeping, and subsequent landed work | That register maintenance caused a correctness improvement |
| Record-integrity gates, coverage selector, named event waits, test runner and CI workflow | Structural checks, implemented coverage selection, and concrete gaps in test failure bounds | Prose correctness, a current performance baseline, or an observed hang |

#### Corrections and prioritisation

| Item | Before | Reconciled state and reason |
|---|---|---|
| `B40` | Landed row still named an architecture absorption extension | Landed as a spent-trigger gate; the extension was rejected in `da1a03a` |
| `B41` | Held on `D40` or the already-landed architecture decision | Review performed below; provisionally held on future evidence, not the spent trigger |
| `B4` | Cost-model deferral argued there was no covering subset worth selecting | Coverage-only selection is built under `B3`; cost modelling remains held until measured runtime justifies it |
| `B25` | Cited `F08`, which actually defers cross-process Loopback | Cites the isolated geometry builder and child transport setup, which pass per-run PSK identities across processes, alongside section 4.6's measurements; remains landed |
| `B19` | Only scheduled-looking open move, supported by an old cost comparison | Held as an opportunity, with fresh measurement and a concrete hypothesis required before implementation |
| `B35` | Held until a hang, with an unsupported fixed count of six files | Open preventive work based on the named current-source witnesses below; the old hang trigger has not been observed |
| `B47` | Consumer handoff absent from the board after AGP fixes landed | First consumer-facing move: reconcile the downstream contract reading and retry qualification with its owners |
| `B48` | AGP tests and consumer acceptance not separately tracked | Open acceptance work, dependent on `B47` and implemented opcall; `B35` can proceed independently |

Mesh, certificate/HTTP-authentication, route volume, geometry-test consolidation, and architecture splitting retain their existing triggers.\
Zorg's current target is one hub and one client; it supplies no new requirement for those changes.\
All records in AGP's trace graph are marked built, so no ratified-but-unbuilt structural decision presently fires the architecture-split trigger.\
Readiness remains deferred until an implemented connect path demonstrates the need.\
The three accepted Zorg requests stay closed, and the consumer-owned follow-up does not reopen their runtime fixes.

#### Absorption-register review

The `B40` trigger fired in `da1a03a`: architecture received a check on its existing maturity table, not another register.\
That rejected extension is evidence against expanding per-decision bookkeeping by analogy alone.

The vision register records actual purpose changes for D23 and D26, with D30 naming the intent amendment already carried by D26.\
Those are real amendments, but three absorbed entries are not three independent benefits, and the record does not show that a separate register caused an amendment that would otherwise have been missed.\
The gate proves that every decision has a disposition and a substantive-length reason; it cannot prove that the reason is right or that anyone used it in a scope decision.\
The original ceremony predicate is not established either: the entries are not all not-applicable.

Disposition: keep the register provisional, add no second register, and make no upstream promotion claim.\
Folding the reasons into the existing traceability records remains the leading alternative, but this reconciliation supplies no measured benefit that warrants performing that migration now.\
Re-triage at D40, before proposed reuse or expansion, or after a stale-purpose miss or conflicting duplicated reason.\
The next review must distinguish useful scope reasoning from entry-filling, and assess whether preserving that reasoning in traceability removes a genuine maintenance cost.

#### Bounded-failure witnesses

`packages/node/test/contract/late-handler-settlement.test.js` awaits `started` and `returned` without a deadline.\
The resilience tests `cross-dial-race`, `c2-reconnect-cross-dial`, `queue-saturation`, `c2-saturation-withdrawal`, and `handler-drain-race` await barrier arrivals without a local or test-level timeout.\
`observer-pressure.test.js` similarly awaits `subscription.next()` without a bound.\
These are named witnesses, not a claim that the repository contains exactly that many unbounded waits.

`scripts/run-tests.mjs` invokes Node's test runner without a per-test timeout.\
`.github/workflows/ci.yml` limits a job to 30 minutes, which bounds CI wall time but not local failure diagnosis.\
In contrast, the newer send-admission and delivery-certainty regressions already declare test bounds, and disposition settlement has a bounded wait.\
This is a source-established diagnostic gap; no missing-event experiment or recurring hang was observed in this reconciliation.\
`B35` must prove bounded failure and cleanup with an absent event while retaining deterministic positive oracles, rather than merely adding timeout options and counting them.

Reconciliation validation: all 47 conformance tests across 21 files pass, including board/record joins, link targets, architecture records, and vision dispositions.\
Documentation style and `git diff --check` pass.\
This review changes records only; it does not rerun or newly certify runtime behavior or consumer acceptance.

---

### 4.11 Bounded test failures

Validation date: 2026-10-09.\
`B35` changes test infrastructure and test commands, not production runtime code, protocol timing, or delivery semantics.

Implementation commit: `d857f63ab5ef08a9a9cdd1e2cedbdba77b7e71b0`.

One shared helper supplies named event deadlines and optional test-context cancellation, preserves successful values and source errors, and removes its timer and abort listener when settled.\
The matching-event helper closes its owned subscription on success, failure, cancellation, or early stream termination; unrelated events do not renew its deadline.\
Named barrier and stream waits in the node/core package tests and resilience suite use these helpers, with release/close/stop hooks installed before work can fail.\
The isolated-node process harness also bounds acquisition and replies, observes child closure from construction, rejects outstanding requests on termination, and waits for graceful or forced exit before deleting its temporary configuration.\
Normal package, CLI, and system commands supply Node's 120-second default test timeout.

The new executable checks divide the proof by boundary:

| Owner | Evidence | Observed result |
|---|---|---|
| `test/conformance/test-wait-bounds.test.js` | Value/error preservation, exact missing-event error, cancellation, invalid bounds, matching, total deadline, and stream termination | Seven cases pass; timer/listener and subscription cleanup asserted |
| `test/resilience/test-wait-cleanup.test.js` | Actual cross-dial, saturation, and late-handler tests with one stimulus withheld; separate absent-event subscription check | Four cases pass; child tests fail by the expected event name, reach Stopped, and exit without the outer watchdog; subscriber capacity is reusable |
| `test/e2e/test-process-wait-cleanup.test.js` | Missing readiness/reply, early exit, ignored stop, and healthy isolated WebSocket/plain and PSK delivery | Six cases pass; failed acquisition removes temporary configuration, ignored stop reaches observed forced exit, and owned PIDs are absent after cleanup |

Each missing-event mutation asserts that its replacement lands exactly once; a cleanup witness then checks the node's public terminal state.\
The first mutation run exposed a variable-shadowing error in two newly added witnesses; the witnesses were corrected and all three mutations then passed, without weakening the underlying tests.\
Timeouts remain failure bounds: existing positive payload, event, route, counter, and lifecycle assertions are retained.

Full validation: `npm test` exits zero with 434 passing tests, no failures, cancellations, or skips, including all five workspace suites across 71 files.\
That command also passes the build, documentation style, and test-ownership checks; the ownership check reports 218 test files.\
`npm run schemas:check`, `npm run architecture:check`, and `git diff --check` also exit zero.

Limits: this is targeted coverage of the audited waits and shared harness, not proof that every possible asynchronous wait is locally named or that cleanup can recover a broken runtime.\
Timer and test-runner deadlines require a responsive event loop; synchronous starvation still requires an external watchdog.\
The missing-event children have a separate process watchdog and are required to exit before it acts.\
No consumer integration, independent verification, deployment, or new throughput measurement is claimed.

---

### 4.12 Consumer handoff reconciled

Review date: 2026-10-09.\
`B47` and `MX13` are closed against committed downstream evidence, not an inferred result of contacting the consumer.

| Requirement | Source inspected | Result |
|---|---|---|
| Read the implemented AGP baseline and retire pending-change claims | Zorg `f7374370071148ff9f41c815fc36eedaf4c9813f`, `upstream/agp-capabilities.md` | Names AGP `4ae96f1`, explains explicit unknown delivery and enforced pre-admission deadlines/cancellation, and states application-owned reply correlation |
| Keep definite refusal scoped to its attempt | operation-call `32af328fd7f08f186e3db64f8709bd5c36e37e17`, `CONTRACT.md`, `VISION.md`, and decision D2 | Earlier attempts' uncertainty stands; repeat safety belongs to the effect owner's policy |
| Confirm the consumer's record reconciliation | Zorg commit `23b540ae34ca507e18e0d3463b66d1d583206e9f`, retained in `upstream/agp-feedback.md` | Explicitly records B47 complete on the consumer side and B48 awaiting implementation |
| Distinguish planned acceptance from observed behavior | Zorg's proposed `docs/DELTAS/DELTA-1.md`, criterion E6; operation-call's `src/index.ts` and contract-coverage test | All five AGP cases are planned, but the public implementation remains `export {}` and capability tests remain to-do; B48 stays open |

The consumer checkout was renamed from `opcall` to `operation-call` during this closeout.\
Both consumer worktrees then contained in-progress naming changes; the B47 proof above was read from their committed objects, excluding those edits.\
Historical opcall references remain as authored; the live board uses the current checkout name.\
No downstream file was changed and no additional response was sent.

The remaining next move is `B48`, once operation-call's actual adapter and connect path exist.\
Run the five cases against named consumer and AGP revisions and retain the observed outcomes; a planned E6 or an AGP-only regression is not a pass.\
This closeout establishes no new runtime requirement and no reason to reopen a held mechanism.

Reconciliation validation: all 54 conformance tests across 22 files pass, including board/record joins, link targets, and the consumer-handoff record references.\
Documentation style, test ownership, and `git diff --check` pass; the earlier 434-test runtime validation is retained in section 4.11.

### 4.13 Browser peer feasibility and board re-triage

Review date: 2026-10-10.\
The [bounded feasibility review](reviews/browser-peer-feasibility.md) separates source observations, analytical conclusions, ordinary functional investigations and decisions requiring consumer input.\
It does not select an authentication mechanism or certify browser conformance.

The director selected AGP-side feasibility review and board reconciliation after Zorg's browser feedback, with quality in scope, transport-first ownership, common CLI/browser semantics and a bounded leaked-credential admission window as constraints.\
IAP integration stays above AGP; optional browser certificates must not silently replace the certificate-free native option.\
The existing connection should survive successful routine rotation; live renewal, revocation and outage policy still need explicit decisions.

| ID | Candidate | Impact | Breach | Evidence | Status |
|---|---|---|---|---|---|
| `B49` | Restore the documented disposition methods to the public node type | `I2` | `P2` | `MX16`; [typing correction](#414-public-disposition-typing-restored) | landed |
| `B6` | Resolve direct-peer authentication and credential-lifecycle feasibility | `I3` | `P3` | `MX17`; [boundary assessment](reviews/browser-peer-feasibility.md#4-boundary-assessment-tier-3) | open |
| `B50` | Establish browser carrier and portable-runtime contract feasibility | `I3` | `P3` | `MX18`; [independent investigations](reviews/browser-peer-feasibility.md#5-work-that-can-proceed-independently) | open |
| `B51` | Resolve principal-based endpoint permissions and delivery evidence | `I3` | `P3` | `MX19`; [boundary assessment](reviews/browser-peer-feasibility.md#4-boundary-assessment-tier-3) | open |

The table records this review's scores and current dispositions; the corresponding board rows are derived from it.\
`B49` was open at review and subsequently closed by the correction in section 4.14.\
The typing defect had observable consumer impact and a documented-contract mismatch, so it ranked ahead of the unimplemented browser capabilities.\
Browser/security questions are honestly open requirements, not established runtime vulnerabilities.

| Prior board state | Reconciled state and reason |
|---|---|
| `B6` held until fresh intent | Reopened for feasibility; the director supplied that intent, but no production profile is ratified |
| `B48` the only open move | Remains dependent on real operation-call implementation; the current clean consumer baseline `16d3ccdc35ceb0b9def466ca8c1a24e5883756b1` still exports no behaviour |
| No decisions required | Credential acquisition, live authorization, browser guarantees and endpoint policy now block specific production designs, not source review or the typing correction |
| `B7` and `B12` held | Still held: no measured topology requiring the wire ceiling to change, and no new structural design ratified |

Section 4.12 remains the historical closeout of the earlier handoff, not the current next-move assessment.\
Zorg's collaboration brief remains an uncommitted workspace draft; no receipt, agreement or new downstream response is claimed.\
No AGP runtime, normative contract, vision or ratified decision changed in this review.

Working-tree validation:

| Check | Result |
|---|---|
| `node scripts/run-tests.mjs test/conformance` | 54 tests pass across 22 files; no failures, skips or to-do cases |
| `tools/check-docs.sh docs/BOARD.md docs/VERIFICATION.md docs/design/mechanisms.md docs/reviews/browser-peer-feasibility.md` | All four changed documents pass the repository's style checks |
| Review links and record-derived board rows | 26 local source/contract links resolve; all four generated review rows match the record |
| `git diff --check` | Clean |

Run output was captured under `/tmp/agp-browser-review.tgnxeJ/`.\
These checks validate the documentation and existing conformance suite, not an authentication design or native browser implementation.

### 4.14 Public disposition typing restored

`B49` and `MX16` are corrected in the working tree on source baseline `ee99d741b6c250c0f2525a24b8dbd4ef3a14cab8`.\
This is local implementation and self-check evidence, not a commit, publication, downstream acceptance, or independent verification claim.

**Subsequent status:** the repair is now committed locally; [section 4.17](#417-zorg-requirements-review-and-current-handoff) records that change without rewriting this before/after evidence.

The [public interface](../packages/node/src/node.ts) now declares `disposition()`, `settled()`, and `dispositions()` with the signatures already specified by the [SDK contract](design/sdk.md#41-factory-and-composition).\
The factory still returns `AgpNode`; runtime implementations, wire format, schemas, and delivery semantics are unchanged.\
No authentication or browser design decision is implied.

The [compile regression](../packages/node/test/contract/disposition-types.test.js) compiles a [consumer fixture](../packages/node/test/fixtures/disposition-consumer.mts) through the built `@agp/node` package export, not private source or a cast to `NodeImpl`.\
It covers inferred factory and explicit interface use, exact method signatures, possible untracked results, promise settlement, optional source filtering, asynchronous iteration, and explicit stream closure.\
Negative calls require compiler errors for missing or numeric message IDs, numeric source names, destination filtering, and synchronous iteration.

| Check | Observed result |
|---|---|
| Before correction: `npm run build`, then `node --test --test-timeout=120000 packages/node/test/contract/disposition-types.test.js` | Build exits zero; regression exits one with missing-method `TS2339` diagnostics and the consequent unused synchronous-iteration expectation |
| After correction: `npm run build`, then `node --test --test-timeout=120000 packages/node/test/contract/disposition-types.test.js packages/node/test/contract/disposition-surface.test.js` | Build exits zero; all eight tests pass |
| `npm test` | Exits zero; 435 tests pass with no failures, cancellations, skips, or to-do cases; all five system suites pass |
| `npm run schemas:check` and `npm run architecture:check` | Both exit zero |
| Test ownership and board-row reconciliation | 219 test files have owners; all four review-derived board rows match their recorded candidate, scores, and state |

Environment: Node `v24.12.0`, TypeScript `5.9.3`, strict `NodeNext` compilation with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and no emit.\
Raw before/after build and test output is retained under `/tmp/agp-b49.4RojhM/`.\
The original finding remains in the baseline-pinned review; the board removes the completed typing work from its build order and puts `B50` browser carrier/runtime feasibility next.

---

### 4.15 Browser carrier and runtime observations

`B50` now has a [complete registry mapping and bounded browser observations](reviews/browser-carrier-feasibility.md), on the same AGP source baseline as section 4.14.\
The [standalone probe](../scripts/browser-feasibility.mjs) adds no production dependencies and implements no AGP carrier.\
It exercises public-package bundling, ordinary page imports under CSP, and finite loopback binary exchanges with the native browser API.

| Check | Observed result |
|---|---|
| `npm run build` | Exits zero |
| Chrome `136.0.7103.113` and headless shell `151.0.7922.47` | Each observation run exits zero with `complete: true`; native byte order, snapshot and clean-close assertions pass |
| Public browser bundle | `@agp/node` blocked on eager `node:crypto`; protocol, core and transport bundles build |
| Shared-package imports with `script-src 'self'` | All three fail with dynamic-evaluation `EvalError`; all load when only `'unsafe-eval'` is added as a diagnostic control |
| Failure close-code API calls | All five binding-required codes throw `InvalidAccessError` locally; no malformed wire input sent |
| Conformance registry mapping | All 26 entries accounted for as plausible implementation work, contract gaps, or listener-only cases outside a declared dial-only capability; none certified by this probe |
| `node scripts/run-tests.mjs test/conformance` | All 54 existing tests pass across 22 files; no failures, cancellations, skips or to-do cases |
| `npm run test:architecture` | Exits zero; 219 test files have owners |
| Documented reproduction commands | Rerun successfully; substantive observations match the retained Chrome 136 evidence |
| Documentation and evidence checks | Four edited documents pass style checks; 26 mapped IDs exactly match the registry, 12 report-local links resolve, and both complete browser reports contain identical bundles |

The [Chrome 136](reviews/evidence/browser-feasibility-chrome136.json) and [Chrome 151](reviews/evidence/browser-feasibility-chrome151.json) outputs retain timestamps, worktree state, tool paths, bundle hashes and per-case observations.\
Both are one browser family, not Zorg's target matrix.\
The first instrument run was incomplete because its automation-side CSP observer failed; the corrected runs use ordinary page networking to report results without CSP bypass.

This evidence does not measure AGP session startup, cancellation races, hard native bounds/release, suspension recovery, timer fairness, TLS or authentication.\
`B50` and milestone `M14` remain open; the next move is shared-contract reasoning with explicit resource ownership and the required consumer inputs, not silently weakening the current binding.\
No runtime, normative contract, ratified decision or Zorg-owned implementation changed in this investigation.

---

### 4.16 Shared transport intent and Zorg draft intake

**Subsequent intake correction:** [section 4.17](#417-zorg-requirements-review-and-current-handoff) reviews Zorg's sent response, which incorporates D39 and supplies browser/CSP and permission proposals.\
The draft observations below remain the historical intake at their named revision, not current readiness blockers.

The director answered both rounds of the [shared-transport survey](surveys/shared-transport-survey.md).\
The record preserves the exact picks and per-question interpretations, not a ratified production design.

| Answer | Recorded consequence |
|---|---|
| `1ac` | Explore explicit runtime limits while withholding final browser guarantees pending Zorg input |
| `2a` | Automatic reconnection and application resynchronization, without replay of uncertain operations |
| `3c` | Justified API or wire migrations may be proposed; no specific breakage approved |
| `4abc` | Keep drafting, waiting and portability priorities visible; portable-runtime proposals and evidence review can proceed, but substantive transport drafting before consumer review is not unambiguously selected |
| `5` deferred to the displayed recommendation | Record `5a`: bounded overlap with closing sockets; retained resources consume budget until release is confirmed; pause reconnection at the limit |
| `6a` | Applications own fresh offline work; no new AGP offline outbox and no change to already accepted work implied |

The director separately reported six minutes across both rounds, completing the required timing calibration.\
The survey captures intent without approving a design or implementation.\
Its canonical survey headings use the repository's explicit, reasoned S13 exemption mechanism so the supplied survey validator can read them without a format fork.

During capture, Zorg's clean workspace exposed a committed [requirements draft](../../zorg/upstream/agp-requirements-response.md), inspected at `7f7155b7847b20520b1d835f767d714018612626`.\
The file still says its candidate comparison precedes sending; this is local availability, not a claim of formal handoff or agreement.\
It must be read with Zorg's [D38 and subsequent D39](../../zorg/docs/DECISIONS.md#d39---credential-issuer-one-sovereign-component-issues-and-redeems-the-credentials-that-reach-a-hub).

| Source-observed input | Consequence for the next review, not an adopted AGP decision |
|---|---|
| A shared worker per application, identity and target is the intended browser peer; tabs use message ports | Review worker ownership and lifecycle, not a per-tab connection assumption; no worker survivability result is claimed |
| Same-origin and separately hosted hubs must work; native PSK remains a proposed option | Compare proof paths without relying on page cookies reaching the hub |
| Fresh, roughly minute-lived, single-use, hub-specific admission keys; existing sessions continue until disconnection | Separate admission expiry from live authority and routine rotation; the short ticket lifetime does not itself bound an already-admitted session |
| Reuse closes the first session in the response; D39 restricts that behaviour to a still-live key | Evaluate stale evidence, replay-triggered termination, retained redemption state and the identity of the session being closed |
| Immediate sign-in revocation in the response; D39 conditions it on an application revocation record | Reconcile the response before relying on its revocation claim; offline assertion verification alone is not the stated mechanism |
| Zorg's current hub topology disables peer forwarding and delegates operation permissions to applications | Narrow present consumer requirements without declaring general AGP endpoint-policy or relayed-identity questions solved |
| Required browser versions are unstated; present drawv2 has no CSP | Do not treat current application configuration as an agreed browser support or CSP contract |

The next work is reconciliation of this draft and its amendments alongside portable-runtime proposals.\
No production implementation, authentication profile, transport revision, downstream response, commit or push was performed in this capture.\
Existing `B50`, `B6`, `B51` and `B48` investigations remain open; no new board identifier or severity is needed merely to record this input.

Verification for this capture: all 54 conformance checks pass, the three changed documentation files pass S6/S8/S10/S12/S13, and `git diff --check` is clean.\
The survey validator also passes the completed envelope, including the director-reported integer time-cost field.

---

### 4.17 Zorg requirements review and current handoff

The [requirements review](reviews/zorg-requirements-review.md) assesses Zorg's sent response at `56144bf56f326651f3dac89a5945fc28b66c0a9e`.\
It is a source-backed assessment with explicit analytical recommendations, not a ratified design, independent verifier attestation or security certification.\
It uses the response and component contracts alongside AGP source, browser standards, TLS/token standards and Node's callback contract; related Zorg documents count as one evidence family.

| Previous state | Reconciled state and consequence |
|---|---|
| Draft available, not sent | Sent by Zorg's director and reviewed; stop treating receipt as outstanding |
| D39 qualifications not reflected in the draft | Live-key-only reuse closure and conditional sign-in revocation are incorporated; retain the old intake as history |
| Consumer policy/browser constraints missing | Hub-local permission matrix, shared-worker scope, strict CSP and a proposed browser set are supplied; numerical bounds and support commitments remain proposals |
| `B6` awaiting consumer input | Ready for the two-seam lifecycle comparison; source confirms missing node-owned acquisition cancellation/deadline and public exact-session control, with retry ownership also unresolved |
| `B50` first while requirements were missing | `B6` now has the shared ownership question needed before authentication profile selection; portable-runtime proposals remain independently ready under `B50` |
| `B51` awaiting a permission matrix | Matrix supplied; transit-off suppresses learned peer exports and peer forwarding at source; qualify reply-name ownership and destination selection before adding general APIs |
| `B49` fixed only in the working tree | Committed locally at `1723c9d10870806f9e84630085110f35c1f8077b`; tracking state is one commit ahead of `origin/main`, with no push performed |
| `B48` awaiting the real consumer | Still open: operation-call at `16d3ccdc35ceb0b9def466ca8c1a24e5883756b1` exports no implementation from `src/index.ts`; local manifest/probe changes do not supply consumer acceptance |

The review requires explicit proof-purpose separation, a clock/restart and admission-commit model, one retry/cancellation owner, incarnation-safe session association and corrected experiment expectations.\
It recommends comparing transport-owned reservation against one-shot credential admission, not selecting by patch size or the first browser experiment to pass.\
No issuer policy, browser carriage, new wire exchange, live-renewal mechanism or endpoint-permission API is ratified.

The separate typing commit contains the interface methods, public-package compile test and fixture, and test ownership documentation.\
Immediately before that commit, the build succeeded, all eight targeted disposition tests passed, and test architecture reported 219 owned files; raw output is in `/tmp/agp-typed-surface-commit.6k4NIT/`.\
Those checks are the prior commit's evidence, not new consumer tests or publication evidence.

This reconciliation preserves the open items and their scores: `B6`, `B50` and `B51` remain `I3`/`P3`; `B48` remains `I3`/`P4`.\
Held items and their revival triggers are unchanged.\
The only current recommendation is contract comparison first, with independent portability work available; no production implementation or downstream message was performed in this review.

| Reconciliation check | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 tests pass; no failures, cancellations, skips or to-do cases |
| New review's local links, checked separately because it is untracked | All 17 references resolve, including named Markdown anchors |
| Style checks on the review, board and verification record | All three pass S6/S8/S10/S12/S13 after correcting two non-ASCII quote lines found by the first pass |
| `git diff --check` | Clean |

Raw reconciliation output is retained under `/tmp/agp-zorg-review.1uvAEH/`.\
These are documentation/self-check results, not a cold-reader evaluation or consumer/runtime acceptance run; the typed-surface commit's earlier tests remain separately attributed above.

---

### 4.18 Shared admission lifecycle comparison

**Subsequent implementation:** [section 4.19](#419-outbound-acquisition-ownership-repair) records the director-selected repair, and [section 4.20](#420-acquisition-repair-review-and-local-commit) records its local commit.\
The source observations and no-production-change statement below describe the comparison's original baseline, not the later repair.

The director selected drafting the shared lifecycle comparison after section 4.17.\
The [draft](reviews/admission-lifecycle-comparison.md) maps redemption at identity admission and redemption in the binding against the same owner, cancellation, retry, exact-session and resource obligations.\
It consumes the completed intent survey and the reviewed Zorg response; it selects neither a production design nor a browser credential carriage.

| Comparison result | Consequence |
|---|---|
| Credential use, session establishment and resource release are independent states | A spent credential need never establish; a terminal session may still consume cleanup budget; admission expiry does not revoke an established session |
| Redemption in the binding consumes earlier than redemption at identity admission | The two candidates differ on interrupted pre-OPEN attempts; agree one use-commit meaning across profiles rather than promising identical outcomes from different phase rules |
| Acquisition cancellation ends at channel transfer | Subsequent cancellation needs exact session-owner authority and a guarded handoff; aborting the old signal is not session control |
| Binding redemption is the leading recommendation | Conditional on safe bounded association, expiry semantics and owner agreement; one-shot credential admission remains an explicit alternative |
| Existing acquisition duties are already normative | Classify the missing node supervision as existing-contract debt, independently actionable before either credential design is implemented |

**Existing-contract finding, source baseline `1723c9d10870806f9e84630085110f35c1f8077b`.**\
[Transport section 11.2](design/transport-contract.md#112-deadline-ownership) assigns the connect deadline to the adjacency supervisor; [section 14](design/transport-contract.md#14-mapping-into-the-session-fsm) disallows stale completion after stop/replacement.\
In [`NodeImpl.#dial`](../packages/node/src/node.ts), the only host-state check precedes `await capability.connect(...)`, its new abort controller is not retained, and completion proceeds directly to `#createController`.\
The stop path cancels retry timers and existing controllers, not pending dial controllers; the WebSocket binding does listen to its supplied signal, so the missing ownership is at the node call site.\
This establishes a contract/source mismatch; indefinite waiting and session creation after invalidation are consequences inferred from that path, not results of an executed reproduction.

| ID | Candidate | Impact | Breach | Evidence | Status |
|---|---|---|---|---|---|
| `B52` | Enforce bounded outbound acquisition and reject stale completions | `I2` | `P2` | `MX20`; [acquisition obligations](reviews/admission-lifecycle-comparison.md#1-inputs-and-existing-obligations); [local commit](#420-acquisition-repair-review-and-local-commit) | landed |

`I2` reflects the source-visible inability to guarantee a bounded attempt/stop boundary; `P2` reflects an already-ratified contract rather than an unimplemented future intent.\
The board row is derived from this record; the original priority placed `B52` ahead of the future `I3`/`P3` capabilities.\
Its closure required a scoped correction and ordinary lifecycle regressions for cancellation, deadline ownership, stop/late completion and single retry disposition, now recorded in section 4.20; no credential protocol is part of that correction.

The draft also requires guard checks before association side effects, one retry scheduler with typed host eligibility, separate historical admission evidence and current application authorization, and continued accounting for unsettled providers and closing resources.\
Numeric bounds, browser guarantees, schema/capability shapes and wire migration remain open.\
No production source, normative contract, downstream workspace, commit or push changed during this comparison; no vulnerability-triggering input was created or run.

| Documentation check | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 tests pass; no failures, cancellations, skips or to-do cases |
| Untracked review links, checked separately | All 29 local references resolve: 11 in the comparison and 18 in the preceding review, including named Markdown anchors |
| Board derivation | `B52` candidate, impact, breach and status match the authoritative row above |
| Style checks on the comparison, preceding review, board and verification record | All four pass S6/S8/S10/S12/S13 |
| `git diff --check` | Clean |

Raw check output is retained under `/tmp/agp-admission-lifecycle.jSXxGG/`.\
These are documentation/self-check results, not runtime acceptance, security certification or an independent cold-reader evaluation.

---

### 4.19 Outbound acquisition ownership repair

**Subsequent commit:** [section 4.20](#420-acquisition-repair-review-and-local-commit) records the completed review and local commit.\
The implementation checkpoint below retains its original uncommitted state and author-check evidence.

The director selected the `B52` correction after reviewing the lifecycle comparison.\
The repair is local and uncommitted, against parent `1723c9d10870806f9e84630085110f35c1f8077b`; it does not select either credential-admission design.

| Obligation | Implemented boundary |
|---|---|
| Node-owned acquisition deadline | `timers.transportConnectTimeoutMs` is an optional positive safe integer, defaults to 10,000 milliseconds, and is independently bounded from the later OPEN exchange |
| Cancellation and exact ownership | An internal `OutboundAcquisition` owns one signal and monotonic deadline; the node checks attempt identity and lifecycle inside its serialized executor before constructing a session |
| Stop and host failure | Pending acquisition signals and scheduled retries are cancelled; a later channel result is aborted without a session, OPEN or retry |
| Timer correctness | Successful adoption releases the acquisition timer without aborting the adopted channel; elapsed time is checked again at adoption and long deadlines are scheduled in native-width chunks |
| Bounded replacement work | One unsettled connect call per adjacency remains retained through cancellation; retry waits for settlement, uses the existing backoff, and cannot displace a pending call, controller or retry timer |
| One failure owner | Before adoption, acquisition failure owns retry and a canonical transport-error count; after adoption, controller release owns retry; node deadline expiry is reported as `CONNECT_TIMEOUT` rather than a generic transport abort |
| Public contract alignment | The timer's source generator, schema, generated schema bundle, catalogs, TypeScript configuration, SDK description and architecture module map are updated together |

The new [contract tests](../packages/node/test/contract/outbound-acquisition-lifecycle.test.js) use ordinary controlled transports and a manual clock.\
They distinguish native channel commit from node adoption, and cover deadline, shutdown, host failure, delayed cleanup, failed acquisition, adopted-channel release and new-attempt isolation.\
No credential replay, impersonation experiment, browser implementation or wire change is part of this repair.

The original defect is source-backed; no failing-before runtime or mutation run is claimed.\
All verification here is author self-check, not an independent acceptance verdict.\
Cancellation cannot force arbitrary injected code to finish: an unsettled transport call remains retained and prevents a replacement on that adjacency; native physical-release guarantees remain the transport's obligation.

`B52` remains open at its recorded `I2`/`P2` scores pending review and commit; its next move is no longer implementation.\
The wider acquisition/authentication comparison remains a proposal, and no downstream workspace, commit or push was changed in this repair.

| Verification command or check | Observed result |
|---|---|
| `npm run build` | Exits zero |
| New acquisition contract test file | All 13 cases pass |
| `npm test --workspace @agp/node` | Final run: all 119 tests pass, including the new acquisition cases and the public disposition compile test |
| `npm test --workspace @agp/core` | All 73 tests pass |
| `npm run test:system` | All five suites pass across 71 files: 54 conformance, 18 end-to-end, four integration, 25 resilience and 28 topology tests |
| `npm run schemas:check` and `npm run architecture:check` | Both exit zero; generated artifacts match their sources |
| `npm run test:architecture` | Exits zero; 220 test files have documented owners |
| Board, record and tracked Markdown-link tests | All 13 pass after record reconciliation |
| Untracked review links and board derivation | All 30 local references resolve; `B52` candidate, scores and status match its record |
| Documentation style and diff checks | All six edited documents pass S6/S8/S10/S12/S13; `git diff --check` is clean |

All reported test runs have zero failures, cancellations, skips and to-do cases.\
Environment: Node `v24.12.0`, TypeScript `5.9.3`; raw command output and a rechecked SHA-256 manifest of the changed implementation/schema/test sources are retained under `/tmp/agp-b52.T66MPZ/`.\
These results do not claim a full browser matrix, native Rust CLI verification, publication, real-consumer acceptance or an independent review.

---

### 4.20 Acquisition repair review and local commit

**Subsequent finding:** [section 4.21](#421-identity-admission-timeout-and-teardown-finding) records a separate session-admission teardown defect and the resulting priority change.\
The acquisition correction below remains closed; its review did not cover the later admission callback's lifetime.

The director selected review and local commit of the scoped `B52` repair.\
Commit `f16266aaafa66f6301d7afbf09c55e3a1f990274` contains the implementation, 13 contract regressions, generated configuration artifacts and directly related API, architecture and test-ownership documentation across 12 files.\
Its parent is `1723c9d10870806f9e84630085110f35c1f8077b`; no push was performed.

The author reviewed the complete scoped diff, including cancellation handoff, serialized adoption, deadline expiry with delayed callbacks, native timer width and single-owner retry.\
No blocking issue was found in that review; it is not an independent verifier or gate attestation.

| Review input | Constraint checked |
|---|---|
| AGP transport contract, native WebSocket acquisition source and earlier send-admission correction | Acquisition cancellation ends at native channel transfer; the node must separately reject stale adoption and leave adopted-channel teardown to its session |
| [WHATWG DOM abort model](https://dom.spec.whatwg.org/#aborting-ongoing-activities) | Cancellation requires cooperation from the consuming API; aborting a signal does not itself settle arbitrary injected work |
| [ECMAScript promise reactions](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromisethen) | Promise fulfillment and execution of its continuation are separate steps; native commit is not proof of current node adoption authority |
| [Node timer contract](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args) | Callback timing is not exact, fractional delays truncate, and oversized delays collapse to one millisecond; adoption rechecks elapsed time and scheduling uses rounded native-width chunks |

These are separate source families used to challenge implementation assumptions, not four independent reviews or runtime observations.\
The Node link is the current documentation, observed as `v26.11.1`; execution below used installed Node `v24.12.0`, not that documentation version.

| Commit-time check | Observed result |
|---|---|
| `npm run build` | Exits zero |
| Acquisition contract tests | All 13 pass, with zero failures, cancellations, skips or to-do cases |
| `npm run schemas:check` and `npm run architecture:check` | Both exit zero |
| `npm run test:architecture` | Exits zero; 220 test files have documented owners |
| Scoped documentation style and staged diff checks | Three committed documents pass S6/S8/S10/S12/S13; `git diff --cached --check` is clean |
| Prior implementation/schema/test SHA-256 manifest | All nine entries still match; section 4.19's broader node, core and system results apply to the unchanged sources, not newly executed full suites |

Raw commit-time output, the exact staged path inventory and staged patch are retained under `/tmp/agp-b52-commit.82TKQ0/`.\
`B52` is landed on local `main`, closing `MX20` and milestone `M15`; publication remains separate.\
Immediately after commit, local `main` is two commits ahead of the existing `origin/main` tracking reference; no fresh remote comparison is claimed.

Post-commit reconciliation passes all 13 board/record/link tests, all 30 separately checked review references, board derivation, style checks on the three reconciled documents and `git diff --check`.\
Its raw output is retained in the same commit-time directory.

Earlier browser/authentication research, its probe and survey, and the board/verification reconciliation remain uncommitted and were excluded from this repair commit.\
No downstream workspace was changed, and no credential-admission design, browser conformance claim or real-consumer acceptance was approved.\
The next legal move is joint owner review of the drafted `B6` lifecycle comparison; `B50` portability work remains independently available, and `B48` still requires the implemented consumer.

---

### 4.21 Identity admission timeout and teardown finding

The director selected recording the admission-timeout defect and drafting a response to Zorg, not implementing a correction in this step.\
AGP owns the connection lifecycle: an admission provider that does not answer must not keep the ended connection's teardown pending indefinitely.

| Input | Scope and authority |
|---|---|
| [Zorg's admission-timeout question](../../zorg/upstream/agp-build-questions.md#the-question) | [Original report](https://github.com/apnex/zorg/blob/70248f3721dac59f31d2a1c35982e9e3f4e54474/upstream/agp-admission-timeout-question.md), reporting against AGP `1723c9d10870806f9e84630085110f35c1f8077b`; the question attributes a ten-minute observation to Zorg's stage 4b verifier |
| Current AGP source | `f16266aaafa66f6301d7afbf09c55e3a1f990274`; the session controller and core FSM are unchanged from the reported baseline |
| Existing contract | [FSM timers](design/fsm.md#5-timers), [identity admission](design/fsm.md#64-opensent) and [teardown order](design/fsm.md#7-teardown-order) require bounded admission, invalidation on expiry and finite transport teardown followed by the appropriate terminal projection |
| Provider cancellation boundary | The [DOM abort model](https://dom.spec.whatwg.org/#aborting-ongoing-activities) requires cooperation from the consuming API; cancellation cannot force arbitrary provider work to finish |

The source establishes the dependency described by Zorg; the ten-minute observation remains attributed to Zorg rather than represented as an AGP-run probe.\
This intake is not a runtime reproduction, an independent gate verdict or a security certification.

#### Observed mechanism

| Boundary | Source observation |
|---|---|
| Admission and reader | In [the session controller](../packages/node/src/session-controller.ts), `#readLoop` awaits `#handleMessage`, which awaits `#handleOpen`, which directly awaits `identityAdmission.evaluate` |
| Protocol expiry | [The core FSM](../packages/core/src/fsm.ts) clears `pendingAdmission` and issues `ReleaseTransport` on expiry; ending protocol authority does not settle the external promise |
| Final release | `PeerController.#release` closes or aborts the channel, then awaits `#readCompletion` before calling `controllerReleased`; the reader can still be waiting for admission |
| Operations retention | In [the node](../packages/node/src/node.ts), `controllerReleased` removes the controller, while `#connectionSnapshots` projects a controller without admitted identity as `identityState: "pending"`, including its `Idle` state |
| Separate admission timer | `identityAdmissionTimeoutMs` exists in [the configuration type](../packages/core/src/types.ts) and schema, but has no reader in the node runtime; the identity-admission path does not arm the contract's separate admission deadline |
| Late-result side effects | `#handleOpen` calls `retainIdentity` before dispatching the tokened result to the FSM; the correction must validate current authority before those effects, not rely only on the reducer's later stale-token check |

The score below covers the reported retention and the existing timeout/teardown contract mismatch.\
The late-result path is an adjacent source-observed concern to guard during correction; no executed collision or replacement-interference result is claimed.

| ID | Candidate | Impact | Breach | Evidence | Status |
|---|---|---|---|---|---|
| `B53` | Bound identity admission and release expired connections | `I2` | `P2` | `MX21`; [expiry contract](design/fsm.md#64-opensent); [teardown contract](design/fsm.md#7-teardown-order) | open |

`I2` reflects a retained connection that a consumer must work around; `P2` reflects existing contract debt, not an unimplemented credential feature.\
The board derives this row and places `B53` ahead of the future authentication and browser capabilities.\
`B52` remains closed because it governs outbound transport acquisition before this session-admission phase.

#### Correction obligations and limits

- Enforce identity-admission lifetime at the owning session boundary, including the existing timer setting and its relationship to OPEN expiry, stop and transport termination.
- Let terminal handling complete without awaiting the provider's answer, while preserving the sole transport reader, ordered draining and exactly one release disposition.
- Check the exact current controller and continuation before invoking admission or applying any result, including identity retention and collision effects.
- Remove the ended accepted connection after owned transport cleanup; preserve the contract's explicitly retained dial-retry projection rather than requiring every connection row to disappear at the instant of expiry.
- Account separately for provider work that remains unfinished, with finite capacity and refusal when exhausted; neither hiding a snapshot nor abandoning a wait proves resource release.
- Preserve timely allow/deny behaviour and unaffected connections; confirm that retry remains owned by the existing supervisor and cannot accumulate unbounded unfinished work.

The correction must examine the analogous route-admission reader wait before introducing an identity-only lifetime mechanism.\
That is a required related-path review, not a claim that this intake has established or reproduced every route-admission failure.

Exact capacity values, cancellation capability shape and any new operational projection remain design work.\
This record selects no new public API, wire exchange, credential-redemption location or provider-isolation mechanism.\
No in-process deadline can promise to preempt provider code that synchronously blocks the event loop; logical revocation and physical resource release remain separate obligations.

#### Consumer consequence and handoff

The [draft response in Zorg](../../zorg/upstream/agp-admission-timeout-response.md) accepts AGP's responsibility and asks Zorg to retain its bounded admission wrapper while the defect is open.\
That wrapper is protection at the consumer boundary, not a substitute for AGP's own lifecycle guarantee or evidence that AGP has been repaired.\
The draft does not change Zorg's contracts or claim its adoption; AGP did not edit the incoming question.

During drafting, Zorg moved the question to `upstream/agp-build-questions.md` and added a separate, explicitly unverified packet-depth question.\
The source links follow that move while retaining the original committed report above; the new question is not assessed or answered by this admission-timeout response.\
Zorg's concurrent commit `992eedead5013d1b48505e42be4fcc646898d642` contains the move, the second question and the initial response draft; the subsequent response reference/scope corrections remain local at this checkpoint.

This step changes only the finding, board, comparison forward pointer and draft response; no runtime code, AGP commit or push was performed.\
Closure requires the scoped correction and evidence for the obligations above; documentation checks alone cannot close `B53`.

| Initial record validation | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 pass, with zero failures, cancellations, skips or to-do cases |
| Additional local-link and derivation check | All 190 references across the four edited documents resolve, including the untracked comparison and cross-repository response; `B53` matches its authoritative scores/status and is first in build order; `B52` remains landed |
| Documentation style | All four edited documents pass S6/S8/S10/S12/S13 |
| Source comparison | The reported and current revisions have identical session-controller and core-FSM files |

Raw output and the additional link/derivation checker are retained under `/tmp/agp-admission-record.2n1Nf7/`.\
These are author self-checks of the record and draft, not a cold-reader evaluation or runtime verification of a correction.

**Validation update:** a subsequent pass caught two broken references when Zorg renamed the incoming question during drafting.\
The failed record and link-check output is retained in `record-tests-final.log` and `local-links-and-derivation-final.log`; references now follow the renamed file rather than restoring or overwriting Zorg's work.

After that reconciliation, all 13 record tests, all 190 local references, board derivation and all four documents' style checks pass again.\
The successful rerun output uses the `-reconciled.log` suffix in the same evidence directory.

---

### 4.22 Admission lifetime correction design

The director selected designing the `B53` correction, including the related route-admission path, without implementing runtime changes.\
The [draft design](reviews/admission-lifetime-correction.md) separates the existing lifecycle obligation from proposed public additions.\
`B53` remains open at `I2`/`P2`; `B52` remains closed locally.

Source checkpoint: `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
The session-controller and core-FSM file comparison against Zorg's reported baseline still has no difference.\
No admission-hang reproduction was created or run for this design.

| Related-path observation | Corrective consequence |
|---|---|
| `#handleRouteUpdate` directly awaits `routeAdmission.evaluate` on the sole reader, like identity admission | One lifetime mechanism must cover both; the route path is no longer merely an unexamined analogue |
| Both admission timer settings and the continuation queue settings are declared but unconsumed by runtime configuration | The design makes existing settings effective rather than inventing a browser-specific lifecycle |
| The reader cannot observe later in-band notification or transport terminal while awaiting either provider | A timer race alone is insufficient; retain the sole reader with a bounded ordered continuation queue |
| Admission fault and expiry branches do not check their continuation token in the core reducer | Guard every outcome, not only a successful result |
| Identity retention and assignment to `#pendingRoute` precede the reducer's stale-result check | Authority checks must precede these effects, not merely eventual identity or route commit |
| `#release` awaits notification write before invoking close | The teardown deadline must act even while that earlier write wait is outstanding |
| `ArmProtocolTimers` cancels OPEN at identity commit rather than establishment | Preserve the existing outer opening bound through confirmation, including zero-hold negotiation |
| Operational-domain exhaustion currently zeros resource gauges and freezes commits | The proposed retained-work gauges need an explicit terminal projection; a zero cannot imply that outstanding provider work completed |

These are static source observations from the controller, core FSM, configuration resolver and route-import implementation linked in the draft.\
They do not claim an executed route failure, replacement collision or delayed-cleanup result.\
The incoming packet-depth question remains separate and unassessed.

#### Proposed mechanism and public impact

| Part | Proposed treatment |
|---|---|
| Admission lifetime | Exact invocation permit, monotonic deadline and pre-effect guard shared by identity and route |
| Ordered input | Existing finite queue settings govern later ordinary wire commands; terminal causes bypass that barrier |
| Work accounting | Separate node-wide identity/route pools retain unresolved work independently of connection cleanup; settled results also retain capacity until disposal |
| Cooperative cancellation | Optional shared process-local options on both admission ports; current one-argument providers remain a compatibility requirement, not a measured result yet |
| Configuration | Existing admission timers and continuation bounds gain effective defaults; separate provider-evaluation caps are proposed additions |
| Operations | Actual timers/queue usage plus node-scoped retained-work gauges, without secrets, private handles or a new history endpoint |
| Retry | Existing supervisor remains the only scheduler; local capacity eligibility must not create another reconnect loop |

The ledger can bound outstanding port evaluations, not unobservable work a provider leaves running after answering.\
The provider still owns that work's actual cancellation and resource accounting.\
No in-process timer can preempt synchronous event-loop blocking, and no aborted signal proves resource release.

The [acceptance obligations](reviews/admission-lifetime-correction.md#acceptance-obligations) cover normal allow/deny behaviour, exact result authority, FIFO progress, conserved capacity, one release event, route atomicity, operational truth and public compatibility.\
They are requirements for later verification, not current passes.

#### Authority and next move

The existing survey is carried forward without converting its socket-overlap pick into approval of provider-work limits.\
The draft records an explicit fixed-intent survey bypass for correcting an existing contract under the director's selection; new public options and defaults remain proposals.\
The ratified AGP axiom-applicability map is unchanged; delivery guidance was read from the validated mission-kit cache at `3c43dad1c35fda1457f3bdbf7f194fa5ff47398e`.

Next: adversarially review the shared mechanism, cancellation surface, capacity defaults, queue-overflow classification, route commit, teardown/retry seams and terminal resource projection.\
Record the required axiom-alignment verdict and obtain public-surface agreement before implementation approval.\
The draft names independent source families but claims neither an independent reviewer nor a fresh-reader evaluation.

No runtime, public types, schema, normative design contract or downstream file was changed in this step.\
No commit, push or new message to Zorg was performed.\
The board advances from corrective design to design review, not to a closed finding or an approved build.

#### Draft validation

| Author check | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 pass, with zero failures, cancellations, skips or to-do cases |
| Additional local links and board derivation | All 194 references across the three edited documents resolve, including the untracked draft; `B53` matches the authoritative title/scores/open status and remains first; `B52` remains landed |
| Documentation style | All three edited documents pass S6/S8/S10/S12/S13 |
| Source and index scope | No tracked changes under `packages`, `cli`, `test` or `schemas`; index remains empty and HEAD is unchanged |

Raw output and the local link/derivation checker are retained under `/tmp/agp-admission-design.6Vubvj/`.\
The initial style pass found sentence-layout failures in the new draft and record section; its `style.log` is retained, and scoped formatting followed by `style-final.log` passes.\
These are document self-checks, not a runtime correction, independent design verdict or cold-reader evaluation.

---

### 4.23 Admission lifetime author review

The director selected adversarial review of the draft before implementation.\
The [review and corrected draft](reviews/admission-lifetime-correction.md#author-adversarial-review) retain one identity/route admission-lifetime mechanism and distinguish author findings from independent assurance.\
`B53` remains open at `I2`/`P2`; `B52` remains closed locally.

Source checkpoint: `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
Review date: 2026-10-11.\
AGP source/contracts, Zorg's consumer report, the DOM abort model, ECMAScript promise reactions and Node timer semantics supply independent input families, not independent reviewers.\
No runtime reproduction, implementation, package/type/schema change or consumer acceptance is claimed.

#### Findings and corrective proposals

| Finding in the draft | Corrective proposal | Remaining obligation |
|---|---|---|
| Releasing the barrier at admission completion could let new packets overtake a draining backlog | Keep it engaged through draining; release only when an executor turn observes no admission, backlog or drain; transfer queue ownership before refunding it | Independent review and later FIFO/conservation verification |
| Settlement was named as the capacity wake even though a settled result can retain its reservation | Wake on actual release; atomically check/register a bounded wait; recheck eligibility under the existing supervisor without a second retry loop | Verify no lost wake, over-cap invocation or backoff inflation |
| Extracting route validation unchanged would preserve the source's all-routes policy set | Prepare static rejections and the policy-eligible subset before invocation; validate exactly that subset and compute current global RIB capacity at commit | Preserve one validation owner and atomic controller/RIB revision semantics |
| Resource truth after operational-domain exhaustion was left unresolved | Capture retained work and freeze terminal resource values, revision and capture time together; later private cleanup cannot publish another mutation | Explicit terminal-contract agreement; last-known counts are not live cleanup telemetry |
| Capacity refusal and continuation overflow lacked precise local classification | Propose `AdmissionCapacityExceeded` and `ContinuationQueueOverflow`, with existing `INTERNAL_ERROR` notification/retry semantics | Agree coordinated FSM/type/schema/event contract; no new wire code |

The terminal-accounting recommendation is grounded in both `OperationsStore.#commitMonotonicExhaustion`, which zeros gauges, and `#capture`, which currently assigns fresh wall time to later reads.\
Preserving unfinished counts without their measurement time would leave a misleading projection.\
The recommendation preserves the immutable terminal revision; it explicitly proposes clarifying the existing logical-release wording, not silently changing a normative contract to fit current source.

The optional cancellation parameter and separate identity/route limits remain recommendations.\
This review does not invent Zorg's agreement to use a new signal, prove one-argument type compatibility before the signature exists, or establish an optimal workload default.\
The draft now normalizes provider-owned results outside the executor and retains the limitation that in-process code cannot preempt a provider that blocks the event loop.

#### Alignment, authority and next move

The author assessment maps the corrected design to the ratified AGP scope of A3, A4, A8, A9 and A14, with explicit implementation guardrails.\
Delivery guidance was freshly read from validated mission-kit `2d9e66873c40b53ba2d62d36d462df5fe994d536`; the product applicability pin remains unchanged.\
Research-artifact guidance kept source observations separate from analytical recommendations; naming guidance kept local capacity/queue outcomes distinct from policy decisions.

The independent design gate has no verdict: the draft author is not an eligible independent judge.\
No pass, fail, verifier attestation or cold-reader result is claimed.\
Next: an independent review of the corrected draft, followed by director agreement on public and terminal-contract changes before implementation.\
The board records that dependency rather than treating the author's corrections as an approved build.

No normative contract, runtime or downstream file was changed; no commit, push or new Zorg response was performed.\
The incoming packet-depth question remains separate and unassessed.

#### Review record validation

| Author check | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 pass, with zero failures, cancellations, skips or to-do cases |
| Additional local links and board derivation | All 198 references across the three edited documents resolve; `B53` retains its authoritative title, scores and open status, with independent review next; `B52` remains landed |
| Documentation style | All three edited documents pass S6/S8/S10/S12/S13 |
| Diff, source and index scope | `git diff --check` passes; no tracked changes under `packages`, `cli`, `test` or `schemas`; index is empty and HEAD unchanged |

Raw output and the link/derivation/scope checker are retained under `/tmp/agp-admission-review.a78kIa/`.\
These checks validate the documents, not runtime behaviour, public compatibility, independent design approval or fresh-reader assurance.

---

### 4.24 Zorg review reply assessment

The director supplied Zorg's `upstream/agp-review-reply.md` and identified its new incoming-draft folder.\
The [assessment](reviews/zorg-review-reply-assessment.md) records the reply at SHA-256 `ccf5f57294f9f6df2ca9a6bf0610ad2dc4350b570d6e1b65c9ccd8dcb93587b9`, against AGP `f16266aaafa66f6301d7afbf09c55e3a1f990274` and Zorg `c1aeff3767765518df436d47195cd9600daaa847`.\
Review date: 2026-10-11.\
Zorg moved to D48 during the review; that consumer proxy ruling supersedes the reply's D46 comparison without changing AGP's boundary.

Zorg's D47 answers the four credential-owner questions: early irreversible use is acceptable, expiry bounds redemption, explicit issuer refusal pauses while unclassified transport failure remains retryable, and the first version shares one process/monotonic clock with pre-restart credentials refused.\
These are consumer decisions, not selection of an AGP authentication profile or proof that the proposed composition is complete.

| Review result | Consequence |
|---|---|
| The fixed reply endpoint plus destination pin does not supply the claimed confidentiality | D26 intentionally allows selected-route fallback and enforces the pin at local delivery; a hub-originated reply can reach another peer's channel when the intended instance is absent. `B51` needs an atomic authorized-egress guarantee or another scoped ownership design, preserving generic multi-hop semantics |
| The claimed last-establishment bound omits redemption to the OPEN anchor | `B6` must give the server ownership of that interval or one absolute remaining establishment deadline; neither a client timeout nor B53 alone closes it |
| X2 correctly labels its numbers as proposals, but release wording is incomplete | Admission/failure/timeout may end authentication authority, not physical ownership; transfer or retain unresolved resources in a finite budget until actual release |
| Clock/restart and proof-purpose choices narrow the initial design | Specify generation, atomic redemption after completed proof, exact association and pause/rearm; distributed redemption and live renewal remain outside the initial requirement |
| Operation-call exists but is not certified | `B48` now waits for correction and revision-pinned consumer acceptance, not initial implementation; passing counts are not the five-case acceptance verdict |

The routing finding is static source/contract analysis, not an executed disclosure or a breach of D26's existing handler-selection promise.\
The acquisition/admission mechanisms remain independently owned; no new generic permission API, TTL or browser profile is adopted.\
Scores and statuses of `B6`, `B50`, `B51` and `B48` remain unchanged.

Zorg's [correspondence rules](../../zorg/upstream/README.md) reserve `upstream/incoming/` for ignored drafts, with receipt owned by Zorg.\
No response was placed there in this step and no Zorg-owned record was edited.\
The incoming packet-depth question remains separate and unassessed.

---

### 4.25 Admission lifetime independent review

The director explicitly authorized a separate review agent to challenge the corrected draft.\
The [independent review](reviews/admission-lifetime-independent-review.md) records a valid technical-gate **FAIL - revise before implementation**, not absence of a verdict.\
The frozen [draft](reviews/admission-lifetime-correction.md) remains at SHA-256 `01bae9c2446bf6ff6d8e0027735976f5ff84c4216d31942c2d8fef80ffde0ed0`; AGP HEAD remains `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
Review date: 2026-10-11.

| Severity | Independent finding | Required design correction |
|---|---|---|
| High | OperationsStore can replace a publication with terminal failure without revoking runtime authority or vetoing already-applied routing and later ACK/export effects | Specify serialized preflight and authoritative ordinary-commit versus terminal-replacement outcome before admission effects become irrevocable; revoke authority and capture retained work through an explicit owner handoff |
| Medium | Pre-acquisition capacity waiting has neither a complete supervisor lifecycle nor a truthful adjacency projection | Define transitions and state/reason/retry-time meaning, refusing-pool lifetime, wake/backoff interaction and stop/collision cleanup; do not fabricate a session token for a pre-session wait |

The reviewer retained the shared identity/route mechanism, barrier-through-drain, separate authority/cleanup/work lifetimes, static route preparation, exact stale-result guards and bounded OPEN/teardown design.\
Frozen terminal accounting remains defensible once the runtime handoff is explicit.\
The proposed public options/defaults still need director adoption; their unapproved status did not cause the technical FAIL.

Delivery guidance was read from validated mission-kit `fab44bfdf205b08e3a50932614e727a946c23ef6`; AGP's product axiom pin is unchanged.\
The independent assessment maps A3, A4 and A8 as load-bearing and A9/A14 only within AGP's ratified subsets.\
AGP, Zorg, DOM, ECMAScript and Node sources are input families, not five reviewers or runtime certification.

`B53` remains open at `I2`/`P2` and first in the build order.\
Next: correct the two design handoffs, obtain a renewed verdict against the revised draft and obtain public-surface agreement before implementation.\
The frozen draft is deliberately not rewritten by its review record; the earlier author checkpoint's no-verdict statement describes that earlier stage.

No runtime, normative contract, public type or schema was changed.\
No commit, push, new Zorg response, runtime security reproduction or fresh-reader evaluation was performed.

#### Review record validation

| Author check | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 pass, with zero failures, cancellations, skips or to-do cases |
| Additional local links and derived board state | All 231 references across the four changed records and frozen draft resolve; `B53` title/scores/open status match the finding, its FAIL is recorded, `B52` remains landed and the stale `B48` implementation wait is removed |
| Documentation style | All four changed records pass S6/S8/S10/S12/S13 |
| Frozen inputs and scope | Draft and Zorg-reply hashes match; `git diff --check` passes; no tracked package/CLI/test/schema changes, no index changes and unchanged AGP HEAD |

Raw outputs and the link/derivation/scope checker are retained under `/tmp/agp-zorg-reply-review.oKDY6L/`.\
These checks validate the records, not runtime correctness; the independent design verdict remains FAIL.\
The research scaffold was written after the first source-reading pass, not before it; no pre-reading planning compliance is claimed.\
Research and writing guidance kept consumer statements, source observations and recommendations distinguishable; naming guidance kept the two reviews separately discoverable.

---

### 4.26 Admission lifetime handoff revisions and Zorg response

The director continued correction and collaboration after the independent FAIL.\
Review date: 2026-10-11; AGP source remains `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
The original frozen draft and section 4.25 verdict remain unchanged.

| Revision | Corrective scope | Independent result |
|---|---|---|
| [Revision 2](reviews/admission-lifetime-correction-r2.md) | One node-owned prepared-transaction/terminal handoff and a complete capacity-wait supervisor/projection table | [FAIL](reviews/admission-lifetime-independent-review-r2.md): original omissions specified, but the new table resets retry history on identity ownership before Established |
| [Revision 3](reviews/admission-lifetime-correction-r3.md) | Preserve suppression while separating establishment-only reset; pre-establishment loss uses retained failure history and stale success cannot reset newer history | [PASS - technical design gate only](reviews/admission-lifetime-independent-review-r3.md); no remaining material blocker within that gate |

Revision 2 is frozen at SHA-256 `b89a3328ae7cd41feb38a498b75b16fe06d47f232d9c09dffe42542438f005fb`; revision 3 at `6ccf9ba0e7d94b83897fade8f865fe3fb1328db292d92cce4d5cc85bc28fc2f2`.\
The same explicitly authorized non-author reviewer assessed the revisions; repeated verdicts are not additional independent reviewers.\
The prepared-transaction integration remains a required internal prerequisite across every runtime operations publication, not a generic transaction framework.\
Public cancellation options, capacity/defaults, local classifications and terminal-accounting semantics remain proposed; M2 fresh-reader assurance has not been performed.

The renewed review rechecked the complete contract and applicable A3/A4/A8 obligations, with A9/A14 scoped by AGP's ratified map.\
Current review guidance measured mission-kit `8e469b3d64068c4f29a742ee3d0f00342521a58d`, with no relevant guidance diff from the draft's historical `fab44bfdf205b08e3a50932614e727a946c23ef6`; product applicability remains pinned to `5026604d3ef695651c21b24bd78410c7fec04b58`.\
The PASS closes the design omissions, not the runtime finding or the remaining adoption and assurance gates.

#### Refreshed Zorg input

During this work Zorg advanced to `42ba5729bcb1f3807feeafb7bcde1eaa2d4642ef`.\
Its reply was formally sent at `d47fb61d0a32ec2ec33dafc18f4c3e3195069f26`; SHA-256 is now `1db25956ac6354722a65097b79a32444ee80c8428972ed53249ba2dabd97289e`.\
The measured reply diff changes only its sent status and adoption of target browsers through [D49](../../zorg/docs/DECISIONS.md#d49---the-browsers-a-browser-capable-design-serves).\
Section 4.24 remains the historical assessment of the previous hash.

D49 makes current and previous major Chrome, Edge, Firefox and Safari releases with shared workers a Zorg requirement; browsers without shared workers are unsupported.\
It does not certify an AGP browser contract or turn X2's numeric proposals into guarantees.\
The four D47 credential-owner answers and the reply-isolation and redemption-to-OPEN qualifications are unchanged.\
Operation-call's stage 4 remains built but not certified; amendment 4's proxy-design certification is not stage 4 consumer acceptance.

The [response draft](reviews/zorg-review-response.md) carries those distinctions and asks whether pending replies may move to an authorized replacement session or must retain the requesting incarnation.\
It requests the whole server-owned establishment bound and retains Zorg's wrapper until a verified AGP migration exists.\
The draft is placed byte-for-byte in [Zorg's ignored incoming folder](../../zorg/upstream/incoming/agp-review-response.md), under the unchanged [correspondence rules](../../zorg/upstream/README.md).\
Placement is not receipt or acceptance; no Zorg-owned record was edited and no draft was added to its index.

`B53` remains open at `I2`/`P2`; `B52` remains landed locally.\
Next: agree revision 3's public contract choices and complete fresh-reader assurance before design adoption and implementation.\
No normative contract, runtime, public type or schema has changed; no runtime reproduction, commit, push or consumer certification is claimed.

#### Revision and handoff validation

| Author check | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 pass; zero failures, cancellations, skips or to-do cases |
| Additional links and board derivation | All 306 local references across eleven documents resolve; B53 title/scores/open status match the finding and it remains first, with B51 second and B52 landed |
| Documentation style | Eight current-turn documents, including the incoming copy, pass S6/S8/S10/S12/S13 |
| Frozen inputs and copy fidelity | All three draft hashes match; the refreshed reply matches its pinned Zorg commit; incoming and AGP copies are byte-identical at SHA-256 `f76295f2c26678321c011d33bc1d1dc838133afbd1ca7de5b459b9c0f614bd17` |
| Scope and placement | Incoming copy is ignored by Zorg; both indexes remain unchanged; no tracked or untracked package/CLI/test/schema changes; AGP HEAD is unchanged and `git diff --check` passes |

Raw outputs and the supplemental checker are retained under `/tmp/agp-admission-revision.DloRzB/`.\
Initial style checks caught a paragraph break and a board sentence-layout issue; those were corrected before the passing checks, without modifying frozen reviewed inputs.\
These are document checks, not runtime or fresh-reader assurance.\
The pre-reading revision plan and versioned research artefacts preserve scope and failed inputs; naming and writing guidance kept current proposals separate from historical verdicts and adopted contracts.

---

### 4.27 Browser peer scale intent proposal

The director asked whether hundreds of concurrent browser endpoints against one AGP node require a vision adjustment, then approved drafting the offered scale-intent amendment.\
This authorizes a proposal, not ratification, default selection, implementation or a support claim.\
Assessment date: 2026-10-11; AGP source remains `f16266aaafa66f6301d7afbf09c55e3a1f990274`.

The [proposed amendment](reviews/browser-peer-scale-amendment.md) retains the vision and one uniform node contract while expanding the intended deployment envelope.\
It records the old scale sentence, replacement wording, re-aim rationale, unchanged boundaries and the inputs needed before claiming capacity.\
The survey fixed-intent bypass is recorded in that proposal and the working plan: the director supplied the direction, while unresolved quantitative choices remain open rather than becoming invented answers.

| Source fact | Interpretation and limit |
|---|---|
| Confirmed intent targets fewer than twenty nodes in star and line topologies | A declared-scope amendment is needed for the requested use case; the root vision already accommodates uniform named reach |
| Node defaults allow 64 sessions and 64 pending handshakes | Configurable guards, not a benchmark, protocol ceiling or proof of hundreds of supported established peers |
| Protocol snapshots hold at most 256 routes | Per-peer export volume is a separate dimension; endpoint counts and transit policy determine whether `B7` must reopen |
| B53 revision 3 has a technical design PASS, but proposed work budgets remain unadopted | Correctness work remains first; the expanded envelope must inform any claim that those budgets suit hundreds of peers |

No runtime capacity experiment was conducted for this amendment.\
`VISION.md`, `DECISIONS.md`, all frozen admission drafts and the previous Zorg response remain unchanged.\
M2 comparison, director ratification and a verified operating envelope remain outstanding.

Authoritative board candidate:

| ID | Candidate | Impact | Breach | Evidence | Status |
|---|---|---|---|---|---|
| `B54` | Decide peer-scale intent and define its operating envelope | `I3` | `P3` | `MX22`; [proposed scale amendment](reviews/browser-peer-scale-amendment.md) | open |

`I3`/`P3` describes an intended capability not yet established, not an observed capacity failure or a newly ratified numerical promise.\
Derived order: `B53`, `B54`, `B51`, `B6`, `B50`, `B48`.\
The scale decision precedes endorsing numerical budgets for that deployment; it does not block the already-owed B53 correctness repair or independent browser and lifecycle design.

#### New Zorg correspondence

Zorg received the [previous response](../../zorg/upstream/agp-review-response.md) unedited at `1b62af8eb3565f2207f7c4be59e00aa3a63bd29a`.\
The AGP copy, received copy and incoming copy remain byte-identical at SHA-256 `f76295f2c26678321c011d33bc1d1dc838133afbd1ca7de5b459b9c0f614bd17`.\
This is new receipt evidence after section 4.26's placement checkpoint, not a correction to that historical checkpoint.

Zorg's [new follow-up](../../zorg/upstream/agp-review-response-reply.md), sent at `1b7f4a3cc5029ddeb2c1b2d79a4b7d897a3c7e74`, was read for this amendment.\
SHA-256: `e93d6f8fef2d8bb27aeea33f1c7e4ceecd2b9f8543d46c1d647d23a90c51dc34`.\
Its shared-network scale question supports the draft's relevance; its other proposals have not received a full adversarial review here.

- D51 permits pending replies to use a replacement connection of the same requesting node and proved principal, not another node of that identity; the former peer-confidentiality claim is withdrawn for Delta 1.
- Zorg prefers an optional exact-peer egress constraint while preserving generic D26 forwarding; its broader trusted-relay option requires reconciliation with its direct-only application guarantee before any AGP adoption.
- It proposes atomic post-proof redemption and one absolute redemption-to-OPEN deadline, with finite accounting for unreleased resources; no figure or AGP handoff contract is selected here.
- Operation-call remains built but not certified; the new note reports a second verification's early-timer finding. The five revision-pinned acceptance outcomes remain the closure requirement for `B48`.
- End-to-end caller identity across relays is a separate unbuilt consumer candidate; the packet-depth question remains open and outside this amendment.

The board now records those proposals as available for review rather than asking Zorg to answer the superseded session-incarnation question again.\
No new response was sent to Zorg and no Zorg-owned file was edited.

#### Amendment validation

| Author check | Observed result |
|---|---|
| Board, record and tracked Markdown-link tests | All 13 pass; zero failures, cancellations, skips or to-do cases |
| Current-document links and board derivation | All 213 local references across the three edited documents resolve, including the untracked proposal; B53 and B54 agree with their records, B53 remains first, B54 is second and B52 remains landed |
| Documentation style | All three documents pass S6/S8/S10/S12/S13 |
| Preserved inputs and correspondence | Vision, decision register and all three frozen admission-draft hashes are unchanged; the previous response copies remain identical, and Zorg's receipt and new reply match the pinned commits |
| Scope | No tracked or untracked package/CLI/test/schema changes; AGP index and HEAD remain unchanged; `git diff --check` passes |

Raw results, the working plan and supplemental checker are retained under `/tmp/agp-browser-scale.vVcnHh/`.\
Sentence-level amendment and research guidance kept existing intent intact and separated a proposed target from measured support.\
These are author document checks, not load support, independent design review or M2 fresh-reader assurance.\
No commit, push, runtime change or new outbound correspondence was performed.

---

### 4.28 Admission lifetime adoption preparation

The director selected preparation of the B53 adoption decision, not adoption or implementation.\
Assessment date: 2026-10-11; AGP remains `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
The [adoption recommendation](reviews/admission-lifetime-adoption.md) makes the public choices, costs, baseline defaults and remaining gates explicit without replacing the frozen revision 3 mechanism.

The existing shared-transport intent and revision 3's fixed-intent survey bypass remain applicable to preparing the already-selected lifetime repair.\
No new survey answers, delegated approval or broadened runtime guarantees are inferred.\
Guidance was read from the clean mission-kit cache at `8e469b3d64068c4f29a742ee3d0f00342521a58d`, freshly matched against remote main; the product axiom pin is unchanged.

#### Source and consumer observations

| Source | Measured observation |
|---|---|
| AGP core public admission ports | `IdentityAdmissionPort` and `RouteAdmissionPort` each take one request and return a promise; the source and built declarations agree on those signatures |
| Provider inventory in AGP packages, examples, root tests and CLI | The built-in allow-identity provider takes no arguments, allow-routes takes one; injected identity providers occur in `identity-peer-evidence.test.js` and `secure-websocket-star.test.js` |
| Caller-identity `4f365cfd9cb200bc4220bb44be741422e3db856c`, clean main | Its [admission wrapper](../../caller-identity/src/caller-identity.ts) exposes one argument, calls the host ruling with one argument and can settle a timeout denial while the underlying ruling remains unresolved |
| Zorg sent reply `1b7f4a3cc5029ddeb2c1b2d79a4b7d897a3c7e74` | The [whole-interval proposal](../../zorg/upstream/agp-review-response-reply.md#2-the-whole-establishment-interval) remains unchanged at SHA-256 `e93d6f8fef2d8bb27aeea33f1c7e4ceecd2b9f8543d46c1d647d23a90c51dc34`; Zorg HEAD at intake was `3c3120399367978f4bfe78d889959d6c8ce6269f` |
| Current accepted-channel interface | `TransportAcceptedChannel` exposes only `channel`; there is no inherited opening-deadline field on that interface |

The inventory is scoped to those local sources, not every external AGP provider.\
The source observations do not certify caller-identity's private resource budgets or the proposed credential lifecycle.\
No runtime defect reproduction or provider workload was executed.

#### Recommendations and unchanged boundaries

The recommendation retains revision 3's optional cancellation argument, separate finite evaluation pools, local classifications, existing-supervisor capacity waiting and frozen numeric-terminal accounting.\
Its proposed defaults remain baseline policy; B54 must establish the envelope before they are endorsed for hundreds of peers.\
Source compatibility does not remove the duties of wrapper-owned work or prove consumer behavior after an expired session.

The Zorg comparison found compatible lifetime separation, not a completed redemption-to-establishment mechanism.\
That handoff still needs B6's clock, authority and deadline contract; reply egress and relayed identity remain separate.\
No technical delta to the frozen revision 3 was made, and its technical PASS is not broadened to these unrun adoption gates.

`B53` remains open at `I2`/`P2` and first in build order; `B54` remains second.\
Next: select or revise the proposed public-contract direction and complete fresh-reader assurance before ratification and implementation.\
M2 requires a precommitted probe/key and fresh-reader use; neither commit nor reader execution occurred in this preparation.\
No new response to Zorg or edits to its files were made.

#### Preparation checks

| Author check | Observed result |
|---|---|
| Candidate type compatibility | TypeScript 5.9.3, strict and no emit: zero diagnostics for existing port assignments, the public caller-identity admission type, zero/one-argument and cancellation-aware providers, and composition with the current node dependencies |
| Scope of the type check | Candidate interfaces exist only in scratch; imports resolve to the packages' declared public type entry points. No published option/export, runtime signal delivery or consumer certification is claimed |
| Initial check correction | The first scratch configuration could not resolve package-directory aliases under NodeNext. Mapping those aliases to the measured public declaration entry points corrected resolution; the failed log is preserved and is not a provider-compatibility failure |
| Board, record and tracked Markdown-link tests | All 13 pass; zero failures, cancellations, skips or to-do cases |
| Supplemental links and board derivation | All 225 local references across the board, verification record, scale amendment and adoption recommendation resolve; B53 and B54 match their authoritative rows and remain first and second |
| Documentation style | The three edited documents pass S6/S8/S10/S12/S13 |
| Preserved records and scope | Vision, decisions, all three frozen admission drafts and the revision 3 verdict retain their hashes; previous response copies remain identical; no package/CLI/test/schema, index or HEAD change; `git diff --check` passes |

Plan, compile-only fixture, configuration and logs are retained under `/tmp/agp-admission-adoption.xUCWIl/`.\
Research and naming guidance kept source evidence, recommendations and authority distinct, with the complete frozen design retained as the mechanism reference.\
No normative contract, public type, schema, runtime, index or commit was changed by this preparation.

---

### 4.29 Operation-call consumer acceptance closeout

The director selected board reconciliation and evidence closeout after Zorg submitted its [operation-call acceptance record](../../zorg/upstream/agp-operation-call-acceptance.md).\
Assessment date: 2026-10-11; this is a review of retained source and execution evidence, not a new consumer test run.

#### Submitted position - Tier 1

Zorg's sent note names both source revisions and reports all five [consumer-handoff cases](ZORG-RESPONSE.md#consumer-handoff) passing at stage 4's third verification.\
Its [stage record](../../zorg/docs/DELTAS/DELTA-1.md#stage-4) records the earlier failures and their resolution.\
The certification verdict is retained as a verdict; the source assertions and execution logs below supply the acceptance evidence.

#### Inspected evidence - Tier 2

| Input | Measured identity and scope |
|---|---|
| AGP verifier checkout | `f16266aaafa66f6301d7afbf09c55e3a1f990274`; clean at inspection, matching the current AGP HEAD |
| Operation-call verifier checkout | `2e435a8e09a46b1b2bf32c26ea6383514b47d2ea`; clean at inspection |
| Zorg at receipt review | `2e46c8b25d880ca44adc50e1ad60d9c822672e27`; the acceptance note was sent at `28ea329`, and stage 4 certification recorded at `8a76e1b` |
| Verification provenance | [Retained checkout record](reviews/evidence/operation-call-acceptance/checkouts-o.json) pins all five repositories; [launcher result](reviews/evidence/operation-call-acceptance/run-o.out) records `codex:gpt-6-astra` and exit zero |
| Independent review record | [Retained stage 4 verifier record](reviews/evidence/operation-call-acceptance/cert-o.txt); its AGP copy, Zorg archive and original under `/home/apnex/zorg-eval-work/verify-s4a3/out-o/` have identical SHA-256 |
| Consumer mechanism | The inspected case assertions, shared ending checks, reply-label assertion and `test/support/fixture.js` match the certified operation-call revision; the fixture uses `@agp/transport-loopback`, separate AGP/call clocks and an executor barrier |

The original per-case logs were read in full and retained byte-for-byte: [honest call ending](reviews/evidence/operation-call-acceptance/case-logs/honest-call-ending.test.js.log.txt), [not-delivered signal](reviews/evidence/operation-call-acceptance/case-logs/not-delivered-signal.test.js.log.txt), and [request correlation](reviews/evidence/operation-call-acceptance/case-logs/request-correlation.test.js.log.txt).\
They record 44, 9 and 6 passing cases respectively, with zero failures, cancellations, skips or to-dos in these three files.\
Acceptance rests on the following assertions and their named passing entries, not on those totals.

| AGP handoff case | Inspected consumer assertion at the pinned revision | Observed execution entry |
|---|---|---|
| Handler ran, then return channel lost | `src/suite/channel-loss-cases.ts` records a held handler, loses its channel, observes `unknown`, and asserts an unchanged unknown ending at the call bound | Pass in honest-call-ending log; both the unknown-before-report and delivered-before-loss schedules pass |
| Queued admission expires or aborts | `src/suite/not-delivered-cases.ts` asserts `TIMEOUT` or `ABORTED`, releases and drains the executor, and asserts zero handler runs; `honest-call-ending-cases.ts` also separates the two clocks | Both pass in not-delivered-signal log; both deadline orders and post-admission alternatives pass in honest-call-ending log |
| Earlier reply cannot complete a later attempt; report is not answer | `src/suite/bound-and-correlation-cases.ts` checks the repeat remains pending and its own reply wins; `test/contract/request-correlation.test.js` checks the reply's exact label and source; delivered and unknown reports leave the call pending | Pass in request-correlation log, with the unknown-report schedule in honest-call-ending log |
| Observed route disappears before send | `src/suite/not-delivered-cases.ts` observes reachability, closes the host, observes withdrawal, and checks the actual refusal plus zero runs across both hosts | Pass in not-delivered-signal log |
| Unknown attempt followed by definite refusal | `src/suite/not-delivered-cases.ts` checks the same invocation, a different attempt and `earlierAttemptsUncertain = true` on the refused repeat | Pass in not-delivered-signal log |

Evidence fingerprints, measured with SHA-256:

| Artifact under `docs/reviews/evidence/operation-call-acceptance/` | SHA-256 |
|---|---|
| `case-logs/honest-call-ending.test.js.log.txt` | `8f525d67bb18e688e9296a137a7ef9fd63b8741fabb8b86fb07d207966fcebc0` |
| `case-logs/not-delivered-signal.test.js.log.txt` | `b50ad78897b667d4fa8a6207efd2262bf53ff036a4e286e23a34432644bab567` |
| `case-logs/request-correlation.test.js.log.txt` | `6e541c909ab23946a6358f36260dd6bcb5915e45f06bc4a2e967f00b58fee5ec` |
| `checkouts-o.json` | `46fe733dc9799e3a3294c097cdb206b1493cd2199559e5b9d9da896a775ad36b` |
| `cert-o.txt` | `e1cb917a0b21b994df126f37643b955002025fbb0ff4d20b6c5def738805fd88` |
| `run-o.out` | `c7b317357c4b6119ef28fdf2442a1b3efd4d987da65a163227e28fad2a9bc9ac` |

All six retained files match their originals by SHA-256.\
The three logs use an added `.txt` suffix to avoid AGP's general log exclusion; the verifier's `cert-o.md` is retained as `cert-o.txt`, with its original text and relative references unchanged.\
Five originals are in `/home/apnex/zorg-eval-work/verify-s4a3/out-o/`; the launcher result is from `/home/apnex/taceng/zorg-eval-runs/stage-4/verify-attempt-3/run-o.out`.\
The retained evidence is part of this uncommitted closeout, not a published AGP release or a copy of every stage 4 artifact.

#### Acceptance disposition - Tier 3

Close `MX14` and `B48`, completing M11's consumer-acceptance requirement.\
The prior implementation-wait and not-certified states remain correct for their historical assessment points; this receipt and log review supersede them in the live board.\
No additional response or repeated test request to Zorg is needed for these five cases.

The accepted scope is operation-call against the pinned AGP build over its production in-process carrier.\
The verifier explicitly distinguishes working stand-in hops from operation-proxy's own stage 4a; this closeout does not certify that proxy, browser execution, confidentiality, hundreds of peers, a published AGP revision or the complete Zorg application.\
The timer observation is recorded separately in section 4.30 and is not a retroactive consumer-acceptance condition.\
`B53` remains the first implementation priority; no adoption decision or normative design was changed.

### 4.30 Session timer deadline authority

#### Reported observation - Tier 1

Zorg's [acceptance note](../../zorg/upstream/agp-operation-call-acceptance.md#one-observation-for-agp) reports that its call-layer timer previously ended a call before the elapsed bound.\
Its correction rechecks the call clock on wakeup.\
This is a consumer observation, not an AGP early-expiry reproduction.

#### Source observation - Tier 2

AGP source baseline: `f16266aaafa66f6301d7afbf09c55e3a1f990274`, unchanged during this review.

| Path | Inspected behavior |
|---|---|
| [`SystemClock.schedule`](../packages/core/src/deterministic.ts) | Delegates to `setTimeout`; the callback wrapper does not recheck monotonic elapsed time |
| [`PeerController.#arm`](../packages/node/src/session-controller.ts) | Records `deadlineMonotonicMs`, then deletes the timer and dispatches its expiry event from an executor callback without comparing the clock to that deadline |
| [`PeerController.#release`](../packages/node/src/session-controller.ts) | Schedules transport-close cancellation directly, without an elapsed-time recheck in that callback |
| [`SendAdmissionGuard`](../packages/node/src/send-admission.ts) and [`OutboundAcquisition`](../packages/node/src/outbound-acquisition.ts) | Recompute remaining monotonic time on wakeup and reschedule positive remainders, rounded upward and capped to native timer width |

No early callback, stale callback or premature AGP session/close outcome was executed or measured in this review.

#### Follow-up and limits - Tier 3

The source leaves the named session/close paths without the elapsed-time protection present in the two deadline guards.\
That supports a bounded follow-up, not a claim about the frequency or demonstrated impact of premature AGP expiry.

| ID | Candidate | Impact | Breach | Evidence | Status |
|---|---|---|---|---|---|
| `B55` | Check session timer deadline authority | `I3` | `P4` | `MX23`; the source paths above and Zorg's reported observation | open |

The score is provisional: a timing guarantee needs assessment; no observed user failure or established contract breach is claimed.\
Re-triage if the review establishes stronger impact or a breached timer contract.

The follow-up must identify the session/close guarantees owed, the authoritative monotonic deadline, and the treatment of early wakes and callbacks from cancelled or superseded timers.\
It must also distinguish the paths already owned by B53 from any remaining timer work, then state a scoped correction and its acceptance obligations.\
B53's frozen revision 3 already requires monotonic bounds, timer generations, upward rounding and chunking for its admission/supervisor work; no change to that draft or expansion of its technical PASS is made here.\
Coordinate any common controller changes under one implementation owner, rather than creating competing repairs.

No AGP runtime, public type, schema or test was changed, and no downstream file, commit or publication was produced.\
Research-record guidance kept the submitted claim, inspected artifacts and closeout judgment distinct; naming guidance supplied the single searchable follow-up title.

#### Reconciliation checks

| Author check | Observed result |
|---|---|
| Board, record and tracked Markdown links | All 13 tests pass; zero failures, cancellations, skips or to-dos |
| Documentation style | Both edited documents pass S6/S8/S10/S12/S13 |
| Evidence retention | Six byte-identical copies retained in AGP; the five-case logs and checkout record no longer depend on the external run directory |
| Scope preservation | Vision, decisions, frozen admission revision 3 and its independent technical verdict retain the previously recorded hashes; B53's open status and first priority are unchanged |
| Diff hygiene | `git diff --check` passes; pre-existing worktree changes remain, with no index or HEAD change |

The plan and document-check captures are retained under `/tmp/agp-consumer-closeout.U9Xx35/`.\
These are author checks of the reconciliation, not a new independent consumer run, runtime timer test or fresh-reader design gate.

---

### 4.31 Admission assurance preparation and consumer pin publication

Assessment date: 2026-10-12; this checkpoint records preparation, completed fresh-reader assurance and limited publication, not a runtime acceptance result.

#### Selected direction and measurement readiness

The director selected the complete B53 public-contract direction for assurance, then resumed it; final adoption and implementation remain unapproved.\
The [preregistered packet](reviews/admission-lifetime-assurance/admission-assurance-preregistration.md) was committed at `5e2265e45c247e86bf9f76c6797342ac66f66e41` before the independent key audit.\
It preserves both raw designs and opaque reader projections, twelve decision probes, eleven unchanged controls and three fresh model families per arm.

The [first independent audit](reviews/admission-lifetime-assurance/key-audit-01.txt) returned FAIL for measurement readiness: judge-visible version provenance, required-versus-ancillary ambiguity and incomplete validity rules.\
It did not overturn revision 3's separate technical verdict.\
The [pre-execution amendment](reviews/admission-lifetime-assurance/admission-assurance-amendment-01.md) was committed at `c4d9a1275bd31702be41efad06f841fdcd620cab`; a bounded independent recheck is pending.\
No scored reader or isolation reader had run at this checkpoint, and both frozen designs remain unchanged.

| Author check | Measured result and limit |
|---|---|
| Shared evaluator | Clean context-lab `6e6d0a92965a15ec473c661887b2b9c5037fedcf`; 270 tests pass, no failures, cancellations, skips or to-dos |
| Actual judge prompt rendering | Capture-only public renderer: 24 prompts cover twelve question/key/rubric sets without tested version/arm disclosure; no model invoked and no vote cast |
| Source separation | Original and projected hashes remain those in the [input manifest](reviews/admission-lifetime-assurance/admission-input-manifest.json); no frozen input change in the correction |
| Documentation checks | Seven board and Markdown-link tests pass; amended prose passes S6/S8/S10/S12/S13; staged diff check passes |
| Evaluation status | No reader-performance evidence or assurance gate verdict; all 72 outcomes and 144 vote slots must be accounted for under the amended rules |

Preparation logs remain under `/tmp/agp-admission-assurance.A3BdFx/`; the prompt fixture records are under `/tmp/agp-admission-prompt-preview.pf3DsT/`.\
The packet and its correction are local commits only; pre-existing worktree changes are preserved.\
At that checkpoint `B53` remained open and first, with recheck and blinded comparison still required before ratification.

Subsequent readiness checkpoint: the [independent recheck](reviews/admission-lifetime-assurance/key-audit-02.txt) passes the corrected packet, with no remaining necessary fixes.\
Its raw verdict and the experiment register were committed at `494130b0962f407c905e0d4d8c93b9a51e955c8b`, before any runtime probe or scored reader.\
At execution launch, the registered comparison `2026-10-12-032023-admission-lifetime` began under the pinned evaluator with runtime isolation checks; completion and disposition are recorded below.

#### Completed comparison and independent disposition

The [retained run](reviews/admission-lifetime-assurance/records/2026-10-12-032023-admission-lifetime/run.json) completed all six first-attempt reader cells, 72 answers and 144 cross-family votes; six reader and three judge isolation checks passed.\
The [independent gate review](reviews/admission-lifetime-assurance/admission-gate-review-01.txt) reconciled raw answers, blinded units, actual judge prompts and every accepted vote/reason; it found no substantive measurement defect requiring a no-verdict disposition.\
Its verdict is FAIL on the frozen grounding/completeness and control criteria, not a finding that the candidate mechanism is defective.

The [result assessment](reviews/admission-lifetime-assurance/admission-assurance-result.md) records the full per-probe comparison and limitations.\
Only Q06 meets the candidate's two-of-three grounded-answer threshold; Q01/Q03/Q10/Q11 regress as controls.\
Q08 improves, and no candidate answer scores 0; these facts do not override the failed criteria.\
Fifteen exact-quote caps affect three otherwise-2 outcomes, so punctuation fidelity is not the whole explanation.

The [reader deviation](reviews/admission-lifetime-assurance/reader-p87-g-events.jsonl) and [discarded judge attempt](reviews/admission-lifetime-assurance/judge-o-06-rejected-events.jsonl) remain raw records.\
The denied reader read exposed no additional source; the tool-bearing judge reply was discarded under the existing runner rule and replaced in a fresh invocation.\
There were 25 replies across 24 judge batches, not 24 uniformly instruction-compliant replies; no original score or input was repaired after outcomes.

Next: separate missing grounding, genuine document ambiguity and measurement sensitivity before proposing a bounded change or new preregistration.\
`B53` remains open, `I2`/`P2` and first; public ratification, runtime implementation and closure remain unapproved.\
No authentication, browser resource or peer-scale claim follows from this comparison.

| Final author check | Measured result and limit |
|---|---|
| Accounting replay | All 72 outcomes and 144 slots reproduce the retained mechanical accounting byte for byte; the independent review separately reconciled them against raw records |
| Documentation | Seven board/link tests pass with no failures, skips or to-dos; result prose passes S6/S8/S10/S12/S13, and the edited board, verification and adoption prose pass S6 |
| Change boundaries | Pre-commit staged and unstaged diff checks pass; only assurance artifacts were staged, leaving mixed pre-existing documentation work uncommitted; no AGP runtime file changed |

Final check logs remain under `/tmp/agp-admission-assurance.A3BdFx/result-final-*`; raw reader/judge evidence was not reformatted.

The result, raw records and independent verdict are committed locally at `278409997116573140c9b1248082a8aa35d946ce`.\
All four assurance commits remain unpublished; the board, verification record and pre-existing mixed work remain uncommitted.

#### Zorg publication request

Zorg's [pin-push request](../../zorg/upstream/agp-pin-push-request.md), committed at `a63de9788177c18b9d8bd227e03bde2520ee882a`, was its only new upstream file since the prior intake at `2e46c8b25d880ca44adc50e1ad60d9c822672e27`.\
Zorg HEAD at inspection was `d2e39f669d20bcedfd4b43d04d6576eae85dce03`; the request concerns remote reproducibility, not a new B53 design requirement.

The director explicitly approved publication of exactly the two existing commits, leaving assurance work local.\
An explicit non-forced refspec advanced AGP `origin/main` from `ee99d741b6c250c0f2525a24b8dbd4ef3a14cab8` to `f16266aaafa66f6301d7afbf09c55e3a1f990274`; a fresh remote read verified that full revision.\
The published history includes unchanged `1723c9d10870806f9e84630085110f35c1f8077b`; no rebase, amendment or squash was performed.

Confirmation was placed in Zorg's ignored `upstream/incoming/agp-pin-push-response.md` for its receipt process.\
No Zorg tracked file was changed or committed, no assurance commit was pushed, and no new AGP runtime change was made.

### 4.32 Admission assurance findings triage

Assessment date: 2026-10-12; the director resumed the recommended findings triage, not design adoption or implementation.\
Yield: all twelve probe groups and both arms' reader observations reconciled, with two author-recommended design-closure items and no runtime repair.\
The [findings triage](reviews/admission-lifetime-assurance/admission-assurance-findings-triage.md) separates recorded evidence, inherited contracts, instrument sensitivity and prospective recommendations.

#### Evidence and limits

All six complete reader answers and observation sections, all 144 retained vote reasons, both reader documents and their difference were read.\
The frozen inputs still match their manifest hashes; revision 3 matches its retained source copy.\
Relevant FSM, routing, operations, SDK and runtime files have no difference between published source `f16266aaafa66f6301d7afbf09c55e3a1f990274` and result checkpoint `278409997116573140c9b1248082a8aa35d946ce`.

The candidate already states the rules behind most omitted or unquoted required decisions.\
Existing contracts also resolve policy-result faults, canonical per-route capacity denial and revision behavior; those external sources cannot retroactively ground a reader's answer.\
Two competing implementation choices remain worth closing explicitly: who commits expiry when result handling observes the elapsed deadline before timer delivery, and which configuration supplies the total terminal-to-release budget.

This is author analysis, not a new independent verdict.\
The valid assurance FAIL, its control regressions and the original raw evidence remain unchanged.\
No answer was regraded, no model was rerun and no runtime behavior or scale capacity was tested.

#### Recommended next move

Draft a scoped clarification of those two items and the inherited-rule connections, then independently review its semantic and compatibility consequences before preregistering any fresh comparison.\
The proposed expiry owner and reuse of the existing close-timeout setting are recommendations, not adopted contracts.\
New questions should distinguish omitted decisions, missing support and exact-quotation sensitivity without retroactively weakening this experiment's gate.

`B53` remains open, `I2`/`P2` and first; the remaining build order is unchanged.\
Final ratification, implementation and closure remain outstanding; no push or new Zorg message was performed by this triage.

#### Author checks

| Check | Measured result and limit |
|---|---|
| Board and links | Seven tests pass, with no failures, skips or to-dos; the new triage note is included in the tracked-document scan |
| Prose | New triage note passes S6/S8/S10/S12/S13; the edited board and verification prose pass S6 |
| Frozen evidence | No tracked assurance evidence differs from the result checkpoint; all four input hashes match the manifest and the standalone revision 3 hash matches its frozen source |
| Change boundary | Pre-commit staged and unstaged diff checks pass; only the new triage note was staged, with no AGP runtime changes |

Logs remain under `/tmp/agp-admission-triage.R48T1x/`.\
These checks establish document integrity and record preservation, not independent design acceptance or runtime correctness.

The triage note is committed locally at `5b04712035b68277d0d608989d3baab491275e38`.\
The five local assurance/triage commits remain unpublished; mixed board, verification and prior documentation work remain uncommitted.

### 4.33 Admission lifetime clarification and independent review

Assessment date: 2026-10-12; the director selected "continue with next best action" after the completed findings triage.\
Scope: author the clarification and obtain independent review, not final adoption, runtime implementation, a new reader experiment or publication.\
The [revision 4 draft](reviews/admission-lifetime-correction-r4.md) preserves the complete prior mechanism while specifying the two closure items and inherited-rule connections.

#### Proposed choices and compatibility

| Concern | Proposed treatment | Cost or boundary |
|---|---|---|
| Expiry first discovered by result handling | One serialized owner commits the appropriate expiry immediately; final-guard expiry discards the result plan; identity admission and OPEN share explicit earliest-deadline selection, with OPEN winning equality | No second callback is required; stale results remain disposal-only; numeric terminal replacement still dominates |
| Total teardown budget | Reuse resolved `transportCloseTimeoutMs` from terminal-cause commit through notification, send, close and terminal observation; actively stop the writer and abort when elapsed | Existing name/default retained, but the public interval changes and must be adopted explicitly; neither a phase reset nor per-send allowance can extend it |
| Cleanup races | Keep original terminal cause and cleanup generation across later write expiry, terminal evidence and node detachment | Logical forced termination is not exact wall-clock completion or proof of physical resource release |
| Inherited rules | State semantic-backlog disposal, route fault/capacity/empty-batch behavior, stopped accounting revisions, exact lost-winner clearing and optional-options shape at their use sites | No new wire code, authentication policy, browser-specific mechanism or retry-reset phase |

Read-only configuration inventory found the existing close setting in core types, the timer schema/generator, node configuration/controller and a resilience fixture.\
The timer schema permits zero while `resolveConfig` requires positive values; this mismatch was supplied to the reviewer rather than silently reconciled.\
The writer's current send call passes its stop signal; merely resolving `transportWriteTimeoutMs` does not establish per-send deadline enforcement.\
No tracked Zorg reference to either timeout field was found by exact-name search, which does not establish compatibility for external deployments or unnamed assumptions.

The subsequent source check found that [SDK configuration](design/sdk.md#41-factory-and-composition) explicitly separates schema validation from contextual rules.\
The current `positive()` validator rejects non-safe-integer or non-positive values, and revision 4 explicitly requires positive safe-integer limits.\
Thus the schema's representable domain is not the effective `createNode()` domain; the absorption record must preserve that distinction rather than claim the two are already aligned.

#### Frozen review submission

| Input | Measured identity |
|---|---|
| Revision 4 | SHA-256 `082b2c704dfdc3338283f3733732388a15fbffec5d1f28bf78313bad884b97b4` |
| Preserved revision 3 | SHA-256 `6ccf9ba0e7d94b83897fade8f865fe3fb1328db292d92cce4d5cc85bc28fc2f2` |
| Implementation baseline | `f16266aaafa66f6301d7afbf09c55e3a1f990274`; inspected core/node and normative contract paths have no committed difference at triage checkpoint `5b04712035b68277d0d608989d3baab491275e38` |
| Delivery guidance | Clean mission-kit checkout and remote main matched `45a0fc205a4820fcc60e8eb1799d2b6d788eb7dc`; product applicability and the old experiment's pins remain unchanged |

At submission, the separate non-author reviewer `/root/admission_r4_review` was assessing the full draft against its stated technical condition and the scoped product-axiom gate.\
No new verdict existed at that checkpoint; neither revision 3's technical PASS nor its assurance FAIL was altered by authoring revision 4.\
Only document checks were run by the author: seven board/link tests pass, and the draft passes S6/S8/S10/S12/S13.\
Logs are retained under `/tmp/agp-admission-clarification.EltXEe/`; these are author checks, not independent acceptance.

The unchanged draft is committed locally at `45fbd5e252e7185eddca8aa658c8d66c2e2f5de0`.\
The new author checks confirm unchanged revision 3, both reader-input hashes and mechanical accounting; the frozen assurance directory and runtime packages have no diff against their recorded checkpoints.

#### Independent disposition

The [independent review](reviews/admission-lifetime-independent-review-r4.txt) is preserved verbatim, with SHA-256 `7f3b6b0e24acf55d7795e6ec7454724b678bc6359639c80c999d93a6c463b88c` matching the original reviewer output.\
The reviewer read the complete frozen draft and its difference from revision 3, with source, contract, consumer-report and primary platform inputs; no runtime test or new reader experiment was performed.

| Gate | Judge and condition | Verdict and limits |
|---|---|---|
| Technical design completeness | Non-author `/root/admission_r4_review`; the complete design needs no invented correctness-critical authority, ordering, budget or resource semantics, and its clarifications preserve prior handoffs and selected direction | PASS; no material design blocker found in the bounded static review, not implemented behavior |
| Scoped product-axiom alignment | Same non-author reviewer, separately applying AGP's pinned applicability map | M7 PASS with absorption and implementation guardrails; no expansion to excluded product axioms or production/browser assurance |
| Fresh-reader assurance | The previously recorded independent experiment and judge | Prior FAIL unchanged; no new comparison, retrospective regrade or selective rerun |

Required later work includes explicit adoption of the changed close-timeout interval, coordinated contract/type/schema absorption, and reconciliation of the schema-representable versus effective runtime timeout domains.\
Implementation must enforce per-send and total teardown deadlines, preserve send/close exclusion and timer progress, inventory every operations publication, and retain the draft's exact-generation and resource-accounting guarantees.\
The review's optional wording polish is not a design blocker; the frozen draft was not edited to incorporate it.

The board now offers prospective fresh assurance preparation: new questions/readers, a committed preregistration and independently reviewed criteria before execution.\
This is the next proposed move, not approval to implement, ratify, publish or close B53.

#### Local handoff checks

All seven board/link tests pass with zero failures, cancellations, skips or to-do cases; all four authored Markdown surfaces pass S6.\
Staged and unstaged diff checks pass; revision 3, revision 4, the verbatim review, both reader inputs and mechanical accounting retain their measured hashes.\
The frozen assurance directory has no diff from the triage checkpoint, and runtime packages plus the reviewed normative contracts have no diff from the implementation baseline.\
These are document/integrity checks only, not runtime verification or a new assurance result.

The initial author link-check failure from an incorrect SDK heading anchor is retained in `final-documents.log`; the corrected result is in `documents-after-anchor-correction.log`.\
The subsequent review-closeout checks use the `review-final-` prefix in the same scratch directory, preserving rather than replacing the failed output.

The verbatim independent review is committed locally at `e8fe9c789e82ec396abe61bd2c567f0cfd9c9b44`.\
The branch is seven commits ahead of the tracked published baseline; the draft and review are committed, while mixed board, verification and prior documentation work remains uncommitted.\
No additional publication is authorized or claimed.

`B53` remains open, `I2`/`P2` and first; the other build-order items retain their scope and priority.\
No current normative contract or runtime file was changed, and no push or Zorg message was performed by this work.

### 4.34 Admission clarification assurance preparation

Assessment date: 2026-10-12; the director selected "continue" after the recommendation to prepare fresh questions and independently reviewed criteria.\
Scope: a prospective document-comprehension packet and non-author key/readiness audit, not scored execution, ratification, runtime implementation, publication or Zorg correspondence.\
The [preregistration](reviews/admission-lifetime-assurance-r4/admission-assurance-preregistration.md) is committed locally at `e9fc08b9c340c11e4f094408ca298dbe28419127`, before the independent audit.

#### Frozen comparison and criteria

| Component | Prepared input or rule | Claim boundary |
|---|---|---|
| Comparison | Immediate predecessor revision 3 versus revision 4, with complete raw sources and identically generated neutral reader copies | Neither arm describes a repaired runtime; omitted history and linked-contract navigation are outside this comprehension claim |
| Coverage | Twenty-four fresh question headings: fifteen controls and nine clarified-decision cases | The author saw the earlier findings; this is a prospective regression/clarity comparison, not untouched held-out evidence |
| Population | The original three model-family profiles, one fresh reader per family and arm | Six descriptive cells, not statistical power or repeated within-family measurement |
| Accounting | 144 answer outcomes and 288 expected other-family vote slots | Missing answers, invalid inputs and infrastructure failures remain distinct; no favorable retry or author-substituted vote |
| Scoring | Minimum of two other-family scores, followed by exact-input quote checks | Correctness, completeness, semantic support and quotation defects are retained separately without weakening the grounded score-2 requirement |
| Decision | Each candidate heading needs two grounded complete answers and no zero; no individual control may regress; at least one heading must improve | A non-author judges the whole record; invalid required inputs yield no verdict, and valid unmet conditions yield FAIL |

The [manifest](reviews/admission-lifetime-assurance-r4/admission-input-manifest.json) records both raw-source and reader-input hashes, arm mapping and provenance.\
The [coverage map](reviews/admission-lifetime-assurance-r4/admission-assurance-coverage.json) and [question/key file](reviews/admission-lifetime-assurance-r4/admission-clarity-probes.json) fix the required decisions before independent review.\
Scores from this instrument cannot be compared numerically with the prior twelve compound questions, and the earlier assurance FAIL remains unchanged.

The evaluator remains context-lab `6e6d0a92965a15ec473c661887b2b9c5037fedcf`, reconstructed in a separate clean checkout with dependency installation and build both exiting zero.\
The preparation guidance pin is mission-kit `45a0fc205a4820fcc60e8eb1799d2b6d788eb7dc`.\
During review, local and remote mission-kit main advanced to `3e8659e7ac7fa2ce78b197b61150c7811b775da8`; the measured difference contains only two unrelated experiment-registration files, not guidance or skills.\
The packet retains its preparation-time pin rather than silently changing provenance.

#### Author preparation checks

| Check | Measured result | Evidence limit |
|---|---|---|
| Whole-input identity and projection fidelity | Five tests pass, including proven-applied in-memory documentation mutations and a missing-boundary rejection | No runtime admission input or network traffic |
| Public pack and prompt rendering | Public pack check passes; two identical reader question/instruction prompts and 48 judge prompts captured, covering all 24 keys/rubrics | Capture-only stand-ins; 144 synthetic units and 288 null slots are not answers or votes, and runtime isolation is untested |
| Board and Markdown links | Seven tests pass with all fourteen packet files staged for discovery | Structural document integrity, not substantive design acceptance |
| Style | Preregistration passes S6/S8/S10/S12/S13; both reader copies pass S6 | No rewriting of the frozen source copies |
| Preservation | Original assurance directory has no diff from `5b04712035b68277d0d608989d3baab491275e38`; runtime packages and inspected normative contracts have no diff from `f16266aaafa66f6301d7afbf09c55e3a1f990274` | Existing mixed documentation changes remain outside the packet commit |

Raw author logs remain under `/tmp/agp-admission-assurance-r4-prep.HwH4LK/`; the final renderer capture is `/tmp/agp-admission-clarity-preview.ZWSuuA/`.\
These checks establish preparation consistency, not a scored assurance verdict or future delivery/isolation success.

At the submission checkpoint, fresh non-author reviewer `/root/admission_r4_key_audit` was assessing the exact committed packet against both complete reader inputs.\
The requested verdict is instrument readiness only; the auditor is not a scored reader and cannot supply an assurance result.\
No experiment registration, runtime isolation probe or scored reader/judge execution has occurred in this preparation step.

#### Failure-accounting mismatch

The auditor identified a concrete mismatch in the preregistration's behavior-failure rule; the author's subsequent source read corroborated it.\
At the pinned evaluator revision, `run-conductor.ts` retains a partial scored file but parses answers only from valid phases; `blinder.ts` creates judge units only for those valid-phase properties, and `tally.ts` assigns ended properties the bottom of their scale.\
This packet has only one answer phase, so a behavior failure can leave readable partial text without any eligible answers or judge units.

The frozen preregistration instead promises to score reached material and treats present answers without votes as no-verdict.\
Retained text, eligible answers and ended-phase zeroes therefore need an explicit prospective distinction before execution.\
This is an instrument-readiness defect, not a newly established AGP mechanism defect or a reinterpretation of the original assurance FAIL.\
The reviewed packet remains unchanged while the independent disposition is preserved.

#### Independent readiness disposition

The [independent key/readiness audit](reviews/admission-lifetime-assurance-r4/admission-key-audit-01.txt) is preserved verbatim, with SHA-256 `21561fbc58fdb51d8d7a62ce9cfb5e383423b700a585abe459213055538ce35e` matching the reviewer's original output.\
Reviewer `/root/admission_r4_key_audit` read both complete reader inputs and all twenty-four question/key pairs at the frozen packet commit, then reconciled source support, projection fidelity, controls, captured prompts and evaluator accounting.

| Gate | Condition and judge | Verdict and boundary |
|---|---|---|
| Instrument key/readiness | Fresh non-author reviewer; fair supported questions, faithful neutral inputs, withheld key/provenance and an unambiguous accounting contract carried by the pinned public evaluator | FAIL on `KR-01`, the sole-phase behavior-failure accounting mismatch; one necessary prospective correction before execution |
| Question/key and control inspection | Same bounded audit; both full inputs and every required decision read | No material wrong-key finding established; all fifteen controls have predecessor support; this does not override the readiness FAIL or predict reader scores |
| Fresh-reader assurance | No new scored comparison occurred | Prior assurance FAIL unchanged; no new assurance verdict |

The reviewer independently reran five input tests and seven document tests, verified the public pack, compared actual one-phase and preview prompt rendering, and reconciled all 48 captured judge records and 288 placeholder slots.\
These are preparation checks only; the auditor did not rebuild the evaluator, execute its runtimes or establish isolation/model availability.

The next proposed move is a separate pre-execution correction that follows the pinned phase-state boundary: twenty-four ended zeroes and forty-eight not-cast vote slots for a behavior-failed sole phase, with saved text retained as raw material rather than rescued into judged answers.\
The two-vote requirement and missing-vote no-verdict rule must apply to eligible present answers, not merely any retained text.\
Preserve this FAIL and commit the correction before a bounded non-author recheck; do not revise questions or thresholds to improve anticipated scores.

Runtime delivery/isolation, registration, actual reader/judge execution, complete project accounting and the final non-author assurance gate remain later prerequisites.\
No scored execution is selected by this preparation, and final adoption, runtime repair and B53 closure remain outstanding.\
The board keeps B53 first and open; other priorities and the separate authentication, permission, browser and scale scopes are unchanged.

#### Preparation handoff

The verbatim audit is committed locally at `2d0f4875ad94e51e3274871f8221163d6ee445e2`, separately from the frozen packet.\
Final checks pass: five input tests, seven board/link tests, S6 for six authored/reader Markdown surfaces, and staged/unstaged diff checks.\
The `final-` logs in the preparation scratch directory retain these author results; they do not change the independent readiness FAIL.

The branch is nine commits ahead of the tracked published baseline at this checkpoint.\
The packet and audit are committed, while board, verification, adoption and older mixed documentation work remain uncommitted; no blanket staging or publication was performed.\
No new scored reader/judge run, AGP runtime change, normative adoption or Zorg message occurred in this preparation turn.

---

### 4.35 Disposition write observation repair

Assessment date: 2026-10-16; the director selected the disposition repair after adversarial review of Zorg's new report.\
Scope: observe disposition write failures through the existing exact-controller callback, without changing batching, delivery certainty, wire format, authentication or transport configuration.\
Initial implementation checkpoint: local uncommitted repair with bounded author checks, not a closed release or independent assurance verdict.\
The subsequent source review and local commit are recorded in [section 4.36](#436-disposition-repair-source-review-and-local-commit).

#### Source and observation boundary

The report is Zorg's `upstream/agp-stage6-bug-reports.md` at `b03baff7de76c8579c2af6ef11c0e74b9fc3b5b0`, SHA-256 `01b41acb26b7a3d306027743c4c8256b062701dfa4b639ffcc04b055499e9e57`.\
The AGP source baseline is `2d0f4875ad94e51e3274871f8221163d6ee445e2`; the inspected disposition source is unchanged from the published consumer baseline before this repair.\
Zorg's original `zorg-eval-runs/stage-6/session-a/report-a.md` section 6.2 records a test-process rejection and a separate peer-disconnect probe that did not crash the hub.\
This repair does not upgrade that report into a reproduced remote hub crash.

Source inspection confirms that `ExactController.writeControl()` returns `Promise<void>`, while `DispositionEngine.#send()` previously discarded it inside a synchronous catch.\
The writer's separate transport-failure callback does not observe this returned promise, and queue refusal or discard can reject it without a carrier send failure.\
The patch attaches a rejection handler immediately and routes the cause through the same `onWriteFailure(batch.controller, cause)` callback as synchronous failures.\
The production callback still terminates that exact controller through the existing serialized, released-guarded teardown path; no node-wide rejection filter, retry, replacement-session lookup or certainty change is introduced.

| ID | Candidate | Impact | Breach | Evidence | Status |
|---|---|---|---|---|---|
| `B56` | Observe disposition write failures through the existing exact-session teardown path | `I2` | `P2` | `MX24`; source review and the bounded checks below | open |

The impact score concerns an observable failure; whole-process loss is a source-supported risk, not an AGP runtime reproduction in this work.\
The breach is failure isolation promised by the existing [teardown contract](design/fsm.md#7-teardown-order), not a new feature requirement.\
The selected repair precedes further `B53` assurance preparation because it corrects the running implementation without selecting any pending admission design.

#### Bounded author checks

The new `disposition-write-observation.test.js` returns only fulfilled native promises and observes whether the writer's completion receives a rejection handler before flush returns.\
Its four cases cover explicit flush, flush-all, timer and count-limit entry points, with unchanged successful packets and no failure callback on fulfillment.\
This is a guard for handler registration, not a substitute for rejected-write recovery or process-survival evidence.

On Node `v24.12.0`, from the AGP workspace root:

| Check | Measured result | Log under `/tmp/agp-disposition-repair.vUzvJr/` |
|---|---|---|
| Original source control, confirmed identical to `HEAD` by `git diff --exit-code HEAD -- packages/node/src/dispositions.ts`, then rebuilt | All four observation cases fail on zero registered handlers; every supplied write fulfills | `observer-baseline-build.log`, `observer-baseline.log` |
| Restored repair and `npm run build` | Exit zero | `final-build.log` |
| Observation guard, public disposition types and selected valid relay cases | Eleven tests pass | `final-contracts.log` |
| Selected healthy release, correlation and disposition-surface cases | Seven tests pass | `final-healthy-delivery.log` |
| `npm run test:architecture` | Exit zero; 221 test files have ownership entries | `test-architecture.log` |
| Board and cross-record checks | Eleven tests pass | `final-records.log` |
| `tools/check-docs.sh docs/BOARD.md docs/VERIFICATION.md packages/node/test/README.md` | Three files pass all five style checks after correcting two code-block introducer gaps | `docs-style.log`, `final-docs-style.log` |

The baseline guard was run with this command:
```bash
node --test --test-concurrency=1 --test-timeout=120000 packages/node/test/contract/disposition-write-observation.test.js
```

The final selected contract checks were run with these commands:
```bash
node --test --test-concurrency=1 --test-timeout=120000 --test-name-pattern='successful disposition write|public node package|Given a transit binding|Given several bound labels|outcomes with distinct denominators' packages/node/test/contract/disposition-write-observation.test.js packages/node/test/contract/disposition-types.test.js packages/node/test/contract/disposition-relay.test.js
node --test --test-concurrency=1 --test-timeout=120000 --test-name-pattern='Given messages that all succeed|Given far more messages|Given a request with attempt correlation|Given a message that is delivered|Given a message whose outcome|Given a stream filtered|Given a destination on the sending node' packages/node/test/contract/disposition-release.test.js packages/node/test/contract/disposition-surface.test.js
```

The record checks were run with this command:
```bash
node --test --test-concurrency=1 --test-timeout=120000 test/conformance/board-record.test.js test/conformance/record-integrity.test.js
```

No crash reproducer, rejected-write stimulus, peer-disconnect race or malformed URL input was created or executed.\
The full package/system suites, rejection recovery, late-failure session isolation and process survival remain unmeasured here.\
The new guard and its ownership row make that boundary explicit; they do not close those assurance gaps.

The URL round-trip concern and scheme-correct listener default port remain separate follow-up work from the reviewed report.\
At this implementation checkpoint, no explicit-port requirement for `displayAddress` was adopted, `B53`'s frozen design and assurance record were unchanged, and no Zorg response, commit or publication occurred.

---

### 4.36 Disposition repair source review and local commit

Assessment date: 2026-10-16; the director selected continuation of the focused repair review for commit.\
The code, observation guard and test-ownership entry are committed locally at `ae83dc3574c7e84549b9e7097bc077495f8ac3b9`.\
This is an author source review and local checkpoint, not independent acceptance, a full regression verdict or publication.

#### Review conclusions and limits

The source review found no blocking defect in the patch's production composition.\
It compared the current diff with the consumer baseline, the original disposition implementation at `d21a333c98463ccfcb8b98a1b9cfde3f3c0f79ec`, the certainty correction at `6cdf5030ab5463ec8363d50ce9478f736000c2c9`, the existing teardown contract and Zorg's original observation in section 6.2 of its Stage 6 builder report.\
The inspected pre-repair controller, writer and disposition files match the published consumer baseline; the missed observer predates the later certainty correction.

| Challenge | Source-backed conclusion | Evidence boundary |
|---|---|---|
| Does the new handler change session ownership? | It captures the same `batch.controller` as the write and calls the existing `onWriteFailure` callback; no replacement lookup occurs | Late-failure replacement-session behavior was not executed |
| Can the writer and disposition callback both start teardown? | Both reach the same serialized controller; terminal reduction releases it synchronously, and later queued termination checks `released` before dispatch | Source-level idempotence reasoning, not a new teardown-race measurement |
| Does failure observation change successful sends? | No await, retry, wire change or certainty mapping was added; successful delivery and relay cases pass | Selected healthy cases only |
| Is the observation guard equivalent to rejected-write recovery? | No; it detects missing registration with fulfilled promises, but does not exercise the handler's rejection branch | The recorded acceptance gap remains open |

The [ECMAScript promise contract](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-promise.prototype.catch) confirms that `catch` calls `then` with the rejection callback, which is the registration the guard observes.\
The derived promise can still reject if a custom failure callback throws; this patch relies on the existing production callback, which invokes the owned controller termination path and returns normally, rather than introducing a general callback-fault policy.\
No claim is made that the guard would catch a changed callback that swallowed failures or targeted the wrong controller.

#### Commit and verification boundary

The commit contains exactly three files: `packages/node/src/dispositions.ts`, `packages/node/test/contract/disposition-write-observation.test.js` and `packages/node/test/README.md`.\
The staged diff was read in full, its path set was checked, and the tested working files were confirmed identical to the index before commit and to `HEAD` afterward.\
The index is empty after commit; mixed documentation and research work remain outside it.

Fresh checks on Node `v24.12.0` repeat the exact selected commands in section 4.35.\
The build exits zero; eleven observation/type/relay tests and seven healthy delivery/surface tests pass, as do the 221-file ownership check and package test-document style checks.\
Raw output is retained under `/tmp/agp-disposition-commit.r0KSvt/` in `build.log`, `contracts.log`, `healthy-delivery.log`, `architecture.log` and `package-docs.log`.\
The earlier four-failure original-source control was inspected, not rerun or represented as a new crash reproduction.

No crash or rejected-write stimulus, peer-disconnect race, malformed URL input, full-suite run or independent review was performed.\
`B56` remains open for acceptance rather than being closed by a commit; its unchanged gaps are rejection recovery, process survival and late-failure session isolation.\
The local board and this verification record remain uncommitted because they contain earlier mixed work that was not part of the selected code commit.

A read-only remote check still reports `origin/main` at `f16266aaafa66f6301d7afbf09c55e3a1f990274`; local `main` is ten commits ahead of that revision.\
No push, PR change or Zorg correspondence was performed, and this checkpoint authorizes none of those actions.

---

### 4.37 Disposition repair independent source review and acceptance requirements

Assessment and recording date: 2026-10-16.\
The director selected an independent read-only review, then selected recording that review and the remaining acceptance requirements before considering publication.\
The reviewed revision is `ae83dc3574c7e84549b9e7097bc077495f8ac3b9`, against parent `2d0f4875ad94e51e3274871f8221163d6ee445e2`.\
The reviewer was `/root/disposition_independent_review`, a separately invoked agent with no inherited conversation history and no authorship of the change.\
The implementation owner records the completed response below; this transcription is not a new reviewer verdict or an implementation-owner acceptance.

#### Recorded independent review

The reviewer's complete substantive response follows, with headings, line layout, punctuation and source-link locations normalized for this repository.\
Source line numbers refer to the reviewed revision; temporary log paths identify earlier author-run evidence, not newly executed checks.

Independent static verdict: no blocking source defect found in `ae83dc3574c7e84549b9e7097bc077495f8ac3b9` against parent `2d0f4875ad94e51e3274871f8221163d6ee445e2`.\
This is a source-review conclusion, not runtime or release acceptance.

##### Source assessment

Failure observation is correctly added.\
[dispositions.ts:367](../packages/node/src/dispositions.ts#L367) immediately attaches the rejection callback to the exact write promise and forwards its cause and captured controller.\
The existing synchronous encode/write exception path remains.\
This addresses a real pre-existing omission: `writeControl()` returns `Promise<void>`, and the writer can reject on queue refusal, discard, or carrier failure.\
Its separate transport-failure callback does not observe that returned promise.\
See [controller.ts:17](../packages/node/src/controller.ts#L17), [session-writer.ts:151](../packages/node/src/session-writer.ts#L151), and [session-writer.ts:289](../packages/node/src/session-writer.ts#L289).

Session ownership remains exact.\
The production callback terminates the captured controller, without resolving a replacement by peer or public session ID: [node.ts:436](../packages/node/src/node.ts#L436).\
`terminate()` checks release both before queuing and inside the serialized command: [session-controller.ts:337](../packages/node/src/session-controller.ts#L337).\
Release permanently sets `#released`; no reset exists.\
Retry removes the old controller and schedules another acquisition, whose adoption constructs a new `PeerController`: [node.ts:905](../packages/node/src/node.ts#L905), [node.ts:1460](../packages/node/src/node.ts#L1460), [node.ts:1570](../packages/node/src/node.ts#L1570).\
A late completion therefore does not acquire authority over the replacement.

Duplicate failure observation is source-consistent with existing teardown ownership.\
A carrier send failure already invokes the writer's failure callback.\
The additional disposition callback may queue another termination, but terminal reduction releases the same controller synchronously; subsequent queued termination checks its released state.\
See [fsm.ts:655](../packages/core/src/fsm.ts#L655), [fsm.ts:1096](../packages/core/src/fsm.ts#L1096), and [session-controller.ts:998](../packages/node/src/session-controller.ts#L998).\
This is static reasoning, not a teardown-race measurement.

Batching and delivery certainty are unchanged.\
All four flush entry points converge on `#send`; timer cancellation, pending-batch removal, live-session checks, compression, and packet construction precede the changed statement.\
The patch adds no wait, retry, rerouting, or success/failure reinterpretation.\
Session loss continues to produce `unknown`, consistent with `D31`.\
See [dispositions.ts:317](../packages/node/src/dispositions.ts#L317) and [node.ts:924](../packages/node/src/node.ts#L924).

Callback assumption, not a demonstrated introduced defect: the discarded promise returned by `.catch()` could itself reject if a custom `onWriteFailure` throws.\
The callback type does not enforce non-throwing behavior.\
The inspected production callback invokes the existing termination path and returns normally; this patch does not provide general callback-fault containment.\
Existing termination/executor limitations are not newly introduced by this diff.

##### Test and evidence limitations

The new [observation test:12](../packages/node/test/contract/disposition-write-observation.test.js#L12) uses fulfilled native promises and observes registration through their overridden `then`.\
Its assertions distinguish missing registration, preserve the successful disposition body, and reject a spurious failure callback on fulfillment.

It does not establish that the registered function forwards the correct controller/cause, performs teardown, survives a rejected write, or isolates a replacement session.\
A registered no-op rejection callback could satisfy these assertions.\
The [ownership entry:27](../packages/node/test/README.md) accurately excludes recovery, survival, and teardown races.

I inspected the existing author-run logs, without rerunning them.\
They report:

- Four baseline observation-test failures, each at zero registered handlers versus one expected.
- Eleven selected observation/type/relay passes and seven selected healthy-delivery passes.
- Passing test-ownership and package-document checks.

These are prior author-run evidence, not independent runtime measurements.\
The build log contains the build invocation without an embedded exit-status or revision attestation; revision binding is described in the author's verification record.

The original consumer [report section 6.2](../../zorg-eval-runs/stage-6/session-a/report-a.md) records one test-process rejection and a separate disconnect probe that did not crash the hub.\
The subsequent handoff is derivative, not another independent reproduction.

Runtime acceptance remains unestablished: rejected-write recovery, process survival, late-failure session isolation, and full-regression behavior were not measured by this review.

##### Inputs actually examined

I examined the complete three-file diff; parent source; the production controller, writer, executor, node composition and relevant core FSM paths; the new test and fake controller; `D23`, `D31`, batching/reverse-disposition and teardown contracts; original commits `d21a333`, `af8ced7`, and `6cdf503`; author intent/review in verification sections 4.35-4.36; both original consumer records; and all six specified existing logs.\
Applicable standing guidance, `M1`, and evidence/independence entries were read.

The initial source assessment preceded reading the author's conclusions.\
Multiple author records and their logs were not counted as independent measurements.

Recommended next step: return this satisfactory source review to the owner for the publication decision, retaining `B56`'s runtime acceptance gap explicitly.\
No additional source edit is justified by this review, and "crash proven fixed" would exceed the evidence.

No files were changed, code executed, tests run, probes performed, or publication attempted.

#### Recording-owner clarification and evidence index

The preceding first-person statements belong to the independent reviewer and describe that review turn only.\
This recording turn edits the board and verification log, not the implementation or its tests.\
Sections 4.35 and 4.36 remain historical checkpoints; their statements that independent review had not yet occurred are not rewritten.

The six logs inspected by the reviewer are `build.log`, `contracts.log`, `healthy-delivery.log`, `architecture.log` and `package-docs.log` under `/tmp/agp-disposition-commit.r0KSvt/`, plus `/tmp/agp-disposition-repair.vUzvJr/observer-baseline.log`.\
The consumer inputs are `../zorg/upstream/agp-stage6-bug-reports.md` and `../zorg-eval-runs/stage-6/session-a/report-a.md`, relative to the AGP repository root.\
The report identity and original observation boundary are pinned in section 4.35.\
The temporary logs do not embed a complete command, revision and exit-status manifest; neither the review nor this transcription repairs that provenance limitation by assertion.

#### Remaining acceptance requirements

These requirements spell out the existing acceptance gaps rather than add a new runtime contract or weaken the gate to fit the evidence available.\
They name properties to establish, not reproducer inputs or instructions to execute failure experiments.

| Acceptance property | Evidence currently available | What remains unestablished |
|---|---|---|
| Failure callback behavior | The source forwards the captured controller and cause; the guard measures handler registration only | Behavioral evidence that unsuccessful control writes reach the intended failure callback with the correct controller and cause, rather than a no-op or misdirected callback |
| Exact-session teardown | The production callback and released-state checks support duplicate-safe termination by source inspection | Behavioral evidence of the existing terminal path completing without duplicate teardown when more than one failure observer reports the same session loss |
| Process survival | The original consumer observed a test-process rejection; the separate hub probe did not crash it | Process-level evidence that the repaired production composition contains failed disposition writes without an unhandled write rejection ending the process |
| Replacement-session isolation | Retry constructs a new controller; release is permanent on the captured old controller | Behavioral evidence that a late completion belonging to the old controller leaves the replacement session unaffected |
| Regression scope | Eighteen selected author-run observation/type/relay/healthy-delivery checks pass; source review found no batching or certainty change | A declared release-regression scope with results and exclusions, rather than treating selected healthy cases as the full suite |
| Evidence provenance and judgment | The source target and prior author checks are recorded; the independent reviewer inspected them without rerunning | Acceptance evidence tied to the exact candidate, runtime, commands, exit statuses and raw results, followed by a distinct acceptance judgment on that evidence |

General containment of an arbitrary throwing custom callback is not silently added to `B56`; the recorded source conclusion is for the inspected production composition.\
The remaining requirements do not reopen `D31`, select an authentication mechanism, or alter the separate admission, timer, URL or listener-port work.

#### Disposition and publication boundary

`B56` remains open at `I2`/`P2`: code committed locally and independently source-reviewed, runtime acceptance not established, publication not performed.\
The source review is complete; it is not a runtime PASS, and repeating the same source review cannot supply the missing behavioral evidence.\
The review found no additional implementation change to make; any new change needs its own source basis rather than being invented to compensate for an evidence gap.

The board and `MX24` now point to this checkpoint while preserving the acceptance requirements.\
No source change, runtime fault experiment, full-suite run, commit, push, PR change or Zorg correspondence is part of this recording step.\
Publication remains a separate decision; this record neither authorizes it nor makes a consumer acceptance claim.

#### Documentation validation

For this recording change, the eleven board and cross-record checks pass, and both edited documents pass all five repository style rules.\
The checks are `node --test --test-concurrency=1 --test-timeout=120000 test/conformance/board-record.test.js test/conformance/record-integrity.test.js` and `tools/check-docs.sh docs/BOARD.md docs/VERIFICATION.md`, each exiting zero.\
Raw output is retained in `/tmp/agp-disposition-record.oJDPXi/records.log` and `/tmp/agp-disposition-record.oJDPXi/style.log`.\
These checks validate record consistency and document form, not AGP failure recovery; they add no runtime acceptance evidence.

---

### 4.38 Admission assurance accounting correction and bounded recheck

Assessment date: 2026-10-16; the director selected the recommended accounting correction and bounded independent recheck.\
Scope: resolve `KR-01` before execution, preserving the failed checkpoints; no scored comparison, AGP runtime implementation, ratification or publication.

#### Prospective correction

The [accounting amendment](reviews/admission-lifetime-assurance-r4/admission-accounting-amendment-01.md) and preregistration correction banner are committed at `da024b29250e47bd19e44c660ba1bce535c379cb`.\
The commit contains exactly those two files, with 92 insertions and no deletions; removing the three-line banner reconstructs the original preregistration byte-for-byte.

The amendment follows the pinned evaluator's existing phase boundary:

| Recorded condition | Project disposition |
|---|---|
| Sole answer phase ends on runner-classified behavior failure | Twenty-four ended zeroes and forty-eight explicit not-cast vote slots, even if partial or complete text survives |
| Valid phase has a missing answer | One deterministic zero and two missing-answer not-cast slots for that heading |
| Valid phase has a present eligible answer | Both other-family votes, then the existing conservative aggregation and quote/support checks |
| Required input or eligible-answer vote remains unresolved | No project gate verdict; do not substitute zeroes, author scores or a reduced denominator |

The full 144-outcome and 288-vote-slot identities remain required.\
Questions, keys, controls, source and reader inputs, population, phase shape, evaluator pin, thresholds and retry limits are unchanged.\
The prior readiness FAIL and scored assurance FAIL are preserved, not reinterpreted.

#### Bounded independent verdict

Fresh non-author reviewer `/root/admission_accounting_recheck` returned PASS for the exact correction at `da024b29250e47bd19e44c660ba1bce535c379cb`.\
The [complete report](reviews/admission-lifetime-assurance-r4/admission-key-recheck-02.txt) is committed separately at `f6ebdd6690fc6fb44a9df43faee3d120dd488a8b`; its SHA-256 is `e280c067606dd737e694b995284d4c52a3ebae4584ab4a702ae52efb284fd438`, unchanged from the reviewer's saved output.

The reviewer read the complete amendment, preregistration, first audit and exact diff, and reconciled snapshot retention, phase state, extraction, blinding, classification, retry and tally against the pinned evaluator source.\
Independent checks established the thirteen untouched original packet files, exact preserved preregistration body, unchanged original audit, all fifty-seven earlier-assurance files, and the six/144/288 declared identities; five inspected input tests passed.

This recheck resolves the accounting defect, not the whole design or scored assurance.\
The original audit's question/key and semantic-fairness coverage is inherited for unchanged surfaces, not represented as a fresh full-key audit or cross-model measurement.\
No reader/judge models, runtime delivery/isolation probes, evaluator failure experiment or AGP runtime test were run for the recheck.

#### Author checks and preservation

On Node `v24.12.0`, five input-preservation tests and thirteen board/link/record tests pass; the two correction documents pass S6/S8/S10/S12/S13.\
The tested files matched the staged bytes and the correction commit; the index was empty before staging each narrowly scoped commit.\
The original assurance directory and AGP runtime packages have no diff from the turn's starting checkpoint.

Raw author checks and their command/exit records are in `/tmp/agp-admission-accounting.pwxxXY/inputs.json`, `records.json` and `style.json`; `identity.json` binds the tested content hashes to the correction commit.\
These are document/input checks, not evidence of reader performance or AGP failure recovery.

After the board and verification update, the five input and thirteen record checks pass again, and all four changed Markdown surfaces pass style checks.\
The `final-` logs in the same directory retain those results; the existing mixed documentation changes remain outside both commits.

#### Next decision and remaining prerequisites

Instrument readiness now permits a separate director execution decision.\
The old temporary evaluator checkout is absent; this correction and recheck read the exact pinned Git object from the sibling repository, without substituting its current HEAD or certifying a runnable build.

After execution is selected, restore or verify the pinned evaluator/build, validate and register the frozen packet, record common launch settings, establish actual reader/judge delivery and isolation, and verify full project accounting before relying on the comparison.\
The evaluator's generic tally can omit unrun cells or use fewer actual judges, so it is not a substitute for the fixed project outcome and vote identities.\
A later scored result still requires its own non-author verdict before any public-contract ratification or implementation recommendation.

`B53` remains open at `I2`/`P2`; the board records the execution decision rather than the completed accounting correction as its next move.\
`B56` runtime acceptance remains open and separate, and no Zorg correspondence or push occurred.\
The mixed board and verification work remains local and uncommitted; neither narrow commit absorbed it.

---

### 4.39 Admission assurance execution preflight

Assessment date: 2026-10-16; the director selected execution preflight and then the frozen six-reader comparison if prerequisites pass.\
Status: preflight stopped at provider selection; no new scored assurance result or gate verdict.

#### Measured preparation

The [preflight record](reviews/admission-lifetime-assurance-r4/admission-execution-preflight-01.json) preserves command outputs, exact identities and the provider comparison separately from the recommendation.\
AGP remained at `f6ebdd6690fc6fb44a9df43faee3d120dd488a8b`; the seventeen committed R4 packet files and all fifty-seven earlier-assurance files matched that checkpoint.

| Check | Observation |
|---|---|
| Pinned evaluator | Restored `6e6d0a92965a15ec473c661887b2b9c5037fedcf` in a clean detached worktree at `/tmp/agp-admission-execution.z0MIOj/context-lab`; the sibling checkout was not switched |
| Install/build | `npm ci --ignore-scripts` and `npm run build` exited zero on Node `v24.12.0` |
| Input preservation | Five inspected static input tests passed |
| Public prompt rendering | Existing capture-only check passed: twenty-four questions, fifteen controls, forty-eight judge prompts, 144 fixture units and 288 null fixture vote slots; no model invoked |
| Local runtimes | `opencode` reported `1.19.0`; Codex reported `0.162.1`; local refusal checks accepted the declared settings, which does not establish provider availability |
| Default provider configuration | Only `litellm-nexus` is configured; the frozen `litellm-netbird` entries have no matching default provider |

The pinned runtime and isolation source was inspected; no full evaluator suite, AGP runtime test or vulnerability-triggering input was executed.\
The capture-only check was run twice, both successfully; its generated records are previews, not reader outcomes or valid votes.

#### Provider change and authority boundary

Retained operator configuration snapshots contain the old provider; comparison with the current configuration shows a different endpoint, added model limits and a Gemini-specific client-package override.\
These observations do not establish an equivalent alias or identical backend versions.\
The pinned evaluator's settings-refusal check does not validate an unset provider when a member declares no settings, so its null refusal was not treated as launch readiness.

Context-lab's `docs/DECISIONS.md`, decision `0021`, at `0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68` records migration to the new endpoint and retirement of the old one for its Delta-2 live work.\
That ruling is not automatically an amendment of AGP's frozen experiment; nor is AGP's execution selection assumed to authorize reviving the old provider.\
A bounded DNS/TCP check reached the old port, without an application request or credential; no outage, model-serving capability or permission to use it is inferred.

No provider alias, operator-config edit, model substitution, experiment registration, live isolation probe, reader or judge invocation occurred.\
No new accounting implementation was written; full fail-closed accounting of 144 outcomes and 288 intended vote slots remains a prerequisite.\
The frozen questions, keys, source/input projections, profiles, rules and earlier FAIL records remain unchanged.

#### Recommendation and continuation condition

Tier 3: obtain director selection for a prospective provider-migration amendment and bounded non-author readiness recheck.\
Retain AGP's existing three model identities/families, six cells, questions, controls, evaluator pin, scoring and retry rules; record the changed provider configuration explicitly.\
Do not inherit the sibling experiment's additional models or new output-limit settings by implication.

After that decision and recheck, finish complete project accounting, register the final packet, establish actual delivery/isolation and run the whole comparison with recorded common launch settings.\
Without that selection, execution stays on hold; no scores or candidate verdict are inferred from the preflight stop.

`B53` remains open at `I2`/`P2`; its execution-authorization question is resolved and replaced on the board by the specific provider decision.\
Public-contract ratification, runtime repair, `B56` acceptance and publication remain separate; no commit, push or Zorg correspondence occurred in this turn.

---

### 4.40 Admission provider amendment and execution accounting

Assessment date: 2026-10-16; the director selected "continue. approve the amendment" after the provider-preflight recommendation.\
This authorizes the explicit current-provider migration, a bounded independent readiness recheck and conditional execution of the whole comparison; it does not authorize AGP runtime implementation, public-contract ratification, B53 closure or publication.

#### Committed preparation

The [provider amendment](reviews/admission-lifetime-assurance-r4/admission-provider-amendment-01.md) is committed at `3878f2d0dc494ba01d98241bbd40b8cdd938f2db`.\
The pack changes only its two provider prefixes from `litellm-netbird` to `litellm-nexus`; the current provider's endpoint, model limits and Gemini SDK override are explicit in the frozen configuration.\
Only the two selected provider model entries are retained, with an environment credential reference and no literal credential; shared operator configuration is not edited.

The [execution driver](reviews/admission-lifetime-assurance-r4/run-admission-comparison.mjs), [project accounting](reviews/admission-lifetime-assurance-r4/account-admission-comparison.mjs), [evidence analyzer](reviews/admission-lifetime-assurance-r4/analyze-admission-comparison.mjs), tests and author-check record are committed at `b2514d0337ed5a127f5cd15ade639189be8e4fd9`.\
They use the pinned evaluator's public API and preserve all 144 outcome identities and 288 intended other-family vote slots.\
The invocation guard requires all six reader-profile and three judge-profile probes to pass before any scored model call; the generic evaluator's reduced-population behavior is not accepted as project readiness.

The [execution configuration](reviews/admission-lifetime-assurance-r4/admission-execution-config.json) fixes six-way parallelism, one run per cell, 1,200-second reader/probe limits and 900-second judge limits.\
The driver records exact reviewed-source and runtime identities, input/configuration hashes, the prior registration and generated run seed; it refuses an existing run directory rather than overwriting or silently retrying a comparison.

#### Author checks and preserved boundaries

The [raw author-check record](reviews/admission-lifetime-assurance-r4/admission-provider-author-checks-01.json) retains command output and exit status.\
Seventeen static accounting/input tests pass, including missing answers, whole ended phases, unresolved failures, missing/duplicate votes and provenance, quote caps, conservative aggregation and control regression.\
The clean pinned evaluator rebuild and capture-only prompt check pass; the latter again accounts for forty-eight prompts, 144 fixture units and 288 null fixture vote slots, not model evidence.\
Both changed Markdown documents pass the selected style rules, and `git diff --check` passes.

Fifteen of the seventeen previously committed R4 files are byte-identical to the previous checkpoint; only the pack's two provider prefixes and a three-line preregistration banner differ.\
Removing the new banner reconstructs the previous preregistration exactly; all fifty-seven earlier-assurance files and the retained provider-preflight stop are unchanged.\
The input manifest's historical provenance, designs, questions, keys, controls, thresholds, retry rules, prior FAIL records and accounting correction remain frozen.

#### Independent gate and remaining work

A fresh non-author reviewer assessed that exact committed checkpoint for provider/execution/accounting readiness.\
No experiment registration, live delivery/isolation probe, scored reader/judge call or completed-comparison verdict has occurred at this preparation checkpoint.\
An independent readiness PASS and actual runtime prerequisites must precede the selected comparison; any incomplete or invalid measurement remains without a project verdict.

`B53` remains open at `I2`/`P2`; its provider-selection question is resolved, not silently carried forward.\
`B56` acceptance and all other design/publication decisions remain separate.\
Only the scoped preparation was committed; the pre-existing mixed board, verification and other documentation work remains local and uncommitted, and no push or Zorg correspondence occurred.

#### Readiness failure and prospective correction

The [independent review](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-03.txt) returned FAIL at `b2514d0337ed5a127f5cd15ade639189be8e4fd9`.\
It accepted preservation and the explicit provider migration, but found that votes were not bound to raw judge replies, raw probe/reader evidence could disappear without invalidating accounting, and receipt coverage could omit required frozen inputs.\
The review's false-completeness cases are static record measurements, not live gate bypasses or AGP vulnerability reproductions.\
The complete report is preserved verbatim at `1f271a484e38822454798bd4b1978d6cc911cced`; no scored execution was launched on that checkpoint.

The [evidence correction](reviews/admission-lifetime-assurance-r4/admission-evidence-correction-01.md) is committed separately at `9b18d1657ac4ed37e09a723887b0e73bc25078cb`.\
It replays retained replies through the pinned public judge panel, reconciles raw probe/reader observations and derives receipt coverage from the exact reviewed Git object, including readiness identity.\
The [author-check record](reviews/admission-lifetime-assurance-r4/admission-evidence-author-checks-01.json) retains twenty-five passing static tests and the capture-only rendering check.\
These are prospective evidence checks, not new model answers, altered scores or runtime assurance.

The same non-author's [bounded recheck](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-04.txt) returned FAIL at that checkpoint.\
It found that replies could cross a public judge-job boundary while equal global votes still passed accounting; the original raw-evidence and receipt findings were addressed within the stated static limits.\
That complete report is preserved verbatim at `3e324f380a0a8fca50b7c909c38a56ec13da421b`; no registration or scored execution followed it.\
The original designs, keys, provider amendment, acceptance criteria and all earlier FAIL records remain unchanged.

#### Job boundary correction and resumed preflight

After the director resumed work, the [prospective correction](reviews/admission-lifetime-assurance-r4/admission-evidence-correction-02.md) was committed at `fe6e7675cb440ec129f9e2c77ba82b71612d510a`.\
Replay now follows the serial public panel's actual job-completion records, rejects leftover replies before moving jobs, and requires exact public job inventory and prompt/reply/failure equality.\
The [author record](reviews/admission-lifetime-assurance-r4/admission-evidence-author-checks-02.json) retains 26 passing static tests, including full 144-unit/288-slot coverage across 48 jobs and later-job pending completion or failure.\
These are static fixture checks and source remediation, not a rerun of the earlier constructed record reassignment or a measured comprehension result.\
The fresh non-author's [bounded recheck](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-05.txt) is PASS for static instrument readiness at that exact checkpoint, preserved verbatim at `85284e801c43cf6d7dfa496fa80f9481d8c7cd24`.\
It independently ran all 26 static tests and traced the actual job boundary through the public panel and both accounting consumers.\
The prior constructed cross-job case's correction is source-derived, not claimed as a recreated test; the verdict does not waive live prerequisites or establish scored assurance.

The [resumed preflight](reviews/admission-lifetime-assurance-r4/admission-execution-preflight-02.json), preserved at `03b22aebb9c154721d1d352a7841ea0f128e5056`, records a separate execution stop.\
The prior temporary evaluator checkout was absent; a fresh detached checkout at the same frozen revision was restored, installed and built successfully without switching the sibling repository.\
All 36 committed packet files match the reviewed target, pack validation passes, and the capture-only preview again covers 48 prompts, 144 fixture units and 288 null vote slots.\
The actual public runtime version queries report OpenCode `1.19.2`, against the frozen `1.19.0`; the Codex and Bubblewrap versions match, and the credential-presence check reveals no credential value.

No registration, actual delivery/isolation probe or scored reader/judge invocation has started.\
Static instrument readiness cannot waive a runtime-version mismatch.\
The next execution choice is to restore the exact frozen runtime in isolation or explicitly amend the version with its bounded compatibility/readiness check; shared runtime/configuration and frozen criteria remain untouched.

#### Selected runtime amendment

On 2026-10-16 the director selected "continue, amend", choosing the installed runtime for the prospective comparison rather than restoring the old version.\
The [runtime amendment](reviews/admission-lifetime-assurance-r4/admission-runtime-amendment-01.md) and [author-check record](reviews/admission-lifetime-assurance-r4/admission-runtime-author-checks-01.json) are committed at `d1632ef02acd34c0460426185242174f7896a463`.\
Only `expectedRuntimeVersions.opencode` changes, from `1.19.0` to `1.19.2`; all other configuration values and 37 prior packet files are byte-identical to the preceding checkpoint, as are all 57 original assurance files.

The pinned evaluator rebuild, 26 static tests, capture-only rendering and documentation checks pass.\
Public runtime queries now match all three configured versions; local interface checks accept the selected profiles, without establishing live compatibility, availability or isolation.\
The author record retains exact commands, outputs, hashes and the unchanged prior stop/review identities without exposing a credential.

The bounded non-author recheck is against this exact amended checkpoint; the previous static PASS is not silently extended to it.\
Registration, all nine live profile probes, scored execution and the completed-measurement judgment remain outstanding at this preparation checkpoint.\
The board removes the resolved runtime-selection question; no shared runtime/configuration change, public-contract adoption, runtime repair, B53 closure, push or Zorg message is authorized by this amendment.

#### Independent runtime readiness and live launch

The [bounded independent runtime recheck](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-06.txt) returned PASS for static/configuration readiness at `d1632ef02acd34c0460426185242174f7896a463`.\
It independently verified all 40 reviewed packet files, the one-field version change, runtime version queries and CLI interface, and reran all 26 permitted static tests.\
The report is preserved verbatim at `8e2abcc53bef3b233ce9097b1464f44b6ef105ba`; it does not claim live compatibility or scored assurance.

The unchanged driver registered the experiment at `2026-10-16T06:05:26.163Z`, then started run `2026-10-16-060526-admission-clarity` against that reviewed checkpoint.\
The [execution receipt](reviews/admission-lifetime-assurance-r4/records/admission-execution-receipt.json) records the exact runtime versions, review hash and all 40 reviewed file identities.\
The [run record](reviews/admission-lifetime-assurance-r4/records/2026-10-16-060526-admission-clarity/run.json) reached `probed` at `2026-10-16T06:06:00.046Z` with all six reader profiles and all three judge profiles passing their live checks.\
This establishes the named delivery/isolation checks for those invocations, not general runtime equivalence or AGP behavior.

Scored execution is underway; completed raw accounting, tally replay and the separate non-author measurement judgment remain outstanding at this launch checkpoint.\
The board still carries B53 open, and no source/runtime implementation or public-contract ratification follows from launching this experiment.

#### Completed comparison awaiting independent judgment

The run finished at `2026-10-16T06:14:37.709Z`; its registration, receipt, six cell records, all 32 judge jobs/replies, 192 accepted votes, blinded units and derived accounting are preserved at `327a5f303a54f940c1b0dfbd057fb10d72800553`.\
The [author execution record](reviews/admission-lifetime-assurance-r4/admission-execution-author-record-01.json) retains the command, complete console output, preservation checks and file hashes.\
All 40 reviewed packet files and shared operator configuration remain unchanged.

All six cells ran once; four completed valid answer phases, while both Gemini phases ended with no final message and no saved answer.\
The retained [candidate trace](reviews/admission-lifetime-assurance-r4/reader-m42-g-events.jsonl) and [predecessor trace](reviews/admission-lifetime-assurance-r4/reader-x19-g-events.jsonl) each report `reason: length`, zero visible output and reasoning-token usage.\
They match their runtime event files byte-for-byte; the responsible backend/client limit is not established, and declared provider limits are not treated as measured capacity.

Under the unchanged accounting amendment, those ended phases produce 48 deterministic zero outcomes and 96 explicit `not cast: ended phase` slots, with no retry or salvage.\
The other 96 eligible answers have all 192 required votes, and all 32 retained judge jobs/replies reconcile through the public panel with zero replay issues and no new model calls.\
The public tally replays byte-identically, and [project accounting](reviews/admission-lifetime-assurance-r4/records/2026-10-16-060526-admission-clarity/ADMISSION-ACCOUNTING.json) is mechanically complete for all 144 outcomes and 288 intended slots, with no recorded provenance issues.

The numerical candidate thresholds are not met, and controls `A08`, `A16`, `A17` and `A23` regress; the strict-improvement condition is met.\
These are mechanical results, not an author-issued assurance verdict or proof of a new design-mechanism defect.\
The non-author completed-measurement review is underway against the exact retained-evidence checkpoint; no models, questions, scores, thresholds or retry rules were changed after seeing results.

#### Independent completed-measurement disposition

The [independent review](reviews/admission-lifetime-assurance-r4/admission-gate-review-01.txt) gives NO VERDICT against evidence checkpoint `327a5f303a54f940c1b0dfbd057fb10d72800553`.\
Its complete report is preserved verbatim at `a73818e5a72b5c48252a99a6e4f40f11576069ae`; the [result handoff](reviews/admission-lifetime-assurance-r4/admission-assurance-result.md) separates that disposition from the retained numerical results and proposed next action.

The decisive finding is candidate Claude answer `A16`, blinded unit `u0065`, raw item `a3` in Gemini judge job `admission-clarity.answer.answers.g.15`.\
The accepted reason acknowledges correct, complete and supported required decisions, then penalizes the reader for accurately calling the unadopted proposal a recommendation.\
Both assigned designs explicitly carry that status; adoption is not an asked decision.\
The non-author establishes a substantive scoring-rule violation, not merely a malformed diagnostic or a disagreement about a required decision.\
Under the frozen post-response defect rule, the affected comparison cannot supply an assurance verdict, even though other numerical conditions independently fail.

The reviewer independently reconciled all 92 committed packet files at the evidence checkpoint, all 40 execution inputs, nine profile probes, six distinct reader sessions, 96 eligible answers and 192 accepted votes.\
Retained-evidence judge replay and tally replay pass without new model calls; the complete 144-outcome/288-slot accounting remains unchanged.\
The five conditions are reported separately: full accounting met, candidate thresholds numerically not met, control non-regression numerically not met, strict improvement numerically met, and substantive-defect exclusion not met.\
This is neither PASS nor a valid-measurement FAIL; no score is replaced, excluded or repaired.

Both Gemini zero-output phases and all four numerical control regressions remain recorded.\
The reviewer checked all submitted excerpts and found no candidate quote-copying failure; it did not establish a separate material candidate ambiguity in the asked decisions.\
Missing decisive support or coverage is not evidence that the corresponding design rule is absent, and the numerical gains are exploratory rather than validated improvement.

The recommended next action is a bounded prospective measurement-repair proposal, keeping the admission design and evidence frozen.\
It would trace the delivered scoring rubric against the required-decision/status distinction, investigate effective reader output limits from retained configuration and traces, and define an independently checked correction before seeking authority for another measurement.\
The backend/client cause remains unestablished; the frozen rule requires new questions/readers after a substantive scoring defect.\
This next proposal is not yet selected, and no new model calls, retrospective rescoring, public-contract ratification, runtime repair, B53 closure, push or Zorg message follows from the review.\
The board and this verification record are reconciled locally; their pre-existing mixed changes remain uncommitted.

#### Evaluation repair proposal

On 2026-10-17 Australia/Melbourne the director selected preparation of the recommended evaluation-repair proposal.\
The [source findings](reviews/admission-evaluation-repair-findings.md) record retained-data inspection against `354dd189eb0951e7cbd703237a75bce6272ab563`; the [proposal](reviews/admission-evaluation-repair-proposal.md) is author analysis, not a replacement gate or independent approval.

Those two records are committed locally at `bcf0738a7af8d17fefc9f83a293fd03bb7633d14`.\
Selected documentation checks and all 13 read-only board, record-integrity and architecture-record tests pass.\
Diff checks confirm both earlier assurance packets, the revision 4 design and AGP package/CLI source are unchanged against the starting checkpoint; these are author self-checks, not evaluation or runtime assurance.

All 32 judge jobs received the configured rules against unasked detail and scope hedges, but none of their introductions carried the readers' explicit unadopted-proposal context or the preregistered required-decision hedge definition.\
The pinned public judge panel delivers the configured text and validates score syntax, not semantic consistency of its reason.\
The proposal addresses delivery and validation separately; clearer wording alone is not asserted to guarantee correct judgment.

The two Gemini readers ended well before the reader wall-clock allowance, with `length`, no visible output and retained reasoning-token counts.\
Matching OpenCode release source implies a default client ceiling of 32,000, independent of the larger declared model limit; the pinned evaluator supplies no override.\
A later public evaluator setting can supply one, but the reported counts are below that ceiling and no retained request-body trace establishes the backend limit or cause.\
The old temporary execution and evaluator directories are absent at this follow-up; committed evidence and historical checks remain intact.

The recommended next selection is replacement-packet preparation and independent readiness review, without model calls.\
A finite, separately approved calibration would qualify judge distinctions and a representative reader workload before new questions/readers and a whole AGP comparison.\
No evaluator pin, token value, scoring rule, model population, runtime source or prior result changes in this proposal turn, and no independent proposal approval, push or Zorg correspondence is claimed.

### 4.41 Admission evaluation static preparation

On 2026-10-17 Australia/Melbourne the director selected the repair proposal's next move: replacement preparation and independent review, without model experiments.\
The [preparation packet](reviews/admission-evaluation-preparation/README.md) is committed locally at `bd95232aae3c22a8aaad965c5507080a1d601faa`; it is separate from both frozen assurance packets and changes no AGP runtime or CLI source.

The [independent pre-build design and M7 review](reviews/admission-evaluation-preparation/design-review-01.txt) is PASS for bounded static preparation only.\
Its SHA-256 is `aa94f13a5ba38dce2277da0d71af668ffd3f25a5b500a8b11f7d95305448c95d`; it preceded implementation and requires unchanged raw votes, absent-answer uncast slots, public-interface capture, independent semantic review and separate live authority.\
The design and runtime-findings Markdown subsequently received only repository formatting corrections; the exact-artifact review must bind their final identities.

| Author check | Observed result | Boundary |
|---|---|---|
| New policy/diagnostic and public-interface checks | 11 pass | No model comprehension or live runtime claim |
| Existing accounting and repository record checks | 28 pass | Historical rules preserved; not proof that a changed conductor is compatible |
| Complete synthetic panel | 144 outcomes, 288 cast votes, 48 jobs | Repeated unrelated headings test identity accounting, not 24 independent questions |
| Synthetic absent-reader panel | 120 present plus 24 absent outcomes, 240 cast plus 48 uncast slots, 40 jobs | Missing answers create no judge votes |
| Raw capture retention | Complete compressed payload, decoded SHA-256 `0c38179e7f6d26a7dbd0871effb6abc7388926f6d08ff5175ab690cbb3f00544` | Synthetic development records only |

The [author output](reviews/admission-evaluation-preparation/author-test-output.txt) preserves the full command and results.\
Every exported tracked evaluator file is checked against the candidate pin before a forced build and public-interface import.\
The static checker returns original scores and reasons unchanged, flags mechanically decidable contradictions and explicitly leaves semantic correctness to independent review.

The [runtime compatibility findings](reviews/admission-evaluation-preparation/runtime-compatibility.md) establish a public reply-cap setting and declared-route reporting, not an observed provider request or effective backend budget.\
They also identify a live-adoption blocker in the candidate evaluator: a tools-off probe can be retried after tool use while its returned record describes only the final attempt.\
The earlier cap-bearing upstream revision retains the old probe code but is only an alternative to review, not an adopted pin; no retry-policy change is accepted by implication.

The [first independent exact-artifact review](reviews/admission-evaluation-preparation/readiness-review-01.txt) is FAIL at the initial preparation checkpoint, preserved verbatim at `4a61bb63fb16aa19b4f48b8885130baf5b546a67`.\
The author raised a mixed-decision concern during review; the reviewer independently established that the original aggregate reason contract cannot express a wrong required decision alongside a separate material conflict.\
All 26 independently rerun preparation/accounting checks passed and the complete capture reconciled, but those facts did not erase the contract defect.

The [prospective correction](reviews/admission-evaluation-preparation/mixed-decision-correction.md) is committed separately at `725d616d836c5e3336d169fc8069c4075790a4ec`.\
It retains score-zero precedence for any wrong required decision while preserving the other conflict, affected IDs and uncertainty tag.\
The new guard fails before the fix and passes afterwards; [second author output](reviews/admission-evaluation-preparation/author-test-output-02.txt) retains both results and all 40 passing checks, including 12 preparation checks and the unchanged 28 existing checks.\
The second complete capture has decoded SHA-256 `2945c82c888e6f486bd4bc466dd09081c515dcbed882076d2ef4081f203e7435`; the first capture and failed review remain unchanged.

The [independent exact-artifact recheck](reviews/admission-evaluation-preparation/readiness-review-02.txt) is PASS for static preparation at `725d616d836c5e3336d169fc8069c4075790a4ec`.\
Its SHA-256 is `5ce147adf73a5fc7e3fb8cbad3c01554b19f8e5eb0bf3f2a2a8521eb64b7700e`; the reviewer independently reran 27 preparation/accounting checks, assessed the mixed-decision correction and reconciled the complete second capture.\
The [independent output](reviews/admission-evaluation-preparation/readiness-review-02-test-output.txt) has SHA-256 `f1f37ad38683a558746166e9634e6908d01e2907c851a2656e135c5d9750b9dd`; the corrected policy rejects scores one and two for the wrong-decision case while preserving all original fields.\
The [result handoff](reviews/admission-evaluation-preparation/readiness-result.md) carries G1-G6 and PREP-L1/L2/L3 forward: resolve evaluator compatibility before separately selecting bounded calibration, then fresh assurance.\
This PASS grants no live qualification or implementation authority.

The complete independent report, output and handoff are preserved locally at `0e4fb13921626d91199aadb508145c5d9d54cd47`.\
The handoff's initial sentence-layout check failed and was corrected by the repository formatter; the reviewer output's final blank line is retained verbatim rather than trimmed to satisfy a whitespace check.

No registration, live diagnostic/calibration, model experiment, token selection, retrospective rescoring, AGP adoption or implementation, push or Zorg message occurred.\
The original FAIL, later NO VERDICT and open B53/B56 statuses remain unchanged; board and verification edits remain local alongside their pre-existing mixed changes.

### 4.42 Admission evaluator compatibility review

On 2026-10-17 Australia/Melbourne the director continued the recommended compatibility review; no live execution or upstream change was selected.\
The [source findings](reviews/admission-evaluator-compatibility-findings.md) separate the newer probe retry from the existing classified cell retry and identify the immediate upstream parent as another candidate.\
The freshly observed upstream main remains `0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68`; the parent is `e705b3d749400d0a79efe98e5338e9c84a1695b8`.

The [author check record](reviews/admission-evaluator-compatibility-checks.json) retains twelve successful checks, all 128 exported tracked file comparisons, the forced isolated build output, and source blob inventories for 29 core files at four revisions.\
It also preserves the first failed inventory command: newer paths absent from the frozen revision are now represented as null rather than assumed present.\
The parent exposes the public output-cap setting and has the same probe code as the frozen evaluator; only the adapters and prober differ from the previously reviewed candidate.\
Current reader arms use instruction delivery only, the judge arm has no on-request folders, and the experiment declares one fresh-session answer phase.

The [author recommendation](reviews/admission-evaluator-compatibility-review.md) is to qualify that parent with checked delivery restrictions and a fresh exact-artifact independent review.\
This is not an independent readiness verdict, a changed preparation profile or a live pin selection; the changed conductor, episode and tally behavior relative to the original frozen evaluator still needs qualification.\
The alternative upstream remedy must retain every probe attempt and make its retry/aggregate policy explicit; no correspondence or sibling source change occurred.

The findings, recommendation and complete author check record are committed locally at `4655139a33990d9bb49cefac39a01348906655da`.\
The four selected documentation files and all thirteen board, record-integrity and architecture-record tests pass; the retained check outputs and derived source identities reconcile.\
The board and this verification record remain local with their pre-existing mixed edits.

All prior packets, scoring results, runtime code and current profile remain unchanged.\
The next choice is bounded parent qualification versus an upstream solution; diagnostic/calibration budgets and any fresh assurance comparison remain later decisions.\
No model experiment, provider/probe/conductor invocation, registration, cap selection, AGP adoption, push or Zorg message occurred.

---

### 4.43 Admission evaluator bounded static qualification

On 2026-10-17 Australia/Melbourne the director selected the compatibility recommendation's bounded parent qualification.\
The [prospective amendment](reviews/admission-evaluator-qualification/admission-qualification-amendment.md), [source findings](reviews/admission-evaluator-qualification/admission-qualification-source-findings.md) and [independent pre-build design/M7 PASS](reviews/admission-evaluator-qualification/admission-qualification-design-review-01.txt) are preserved at `fcc83415022926de58fab724ff3e5cd8959b9841`.\
The amendment's reviewed SHA-256 is `c40a17a89a5ac2dbd74194914873b91f9c6ac15d2ea07a65d82b716733ffc6af`; the review's is `cc307720a64e964ce80985dbd358e016feeee6f4fff79120153978a41ca2d3cd`.\
Its Q1-Q7 guardrails require raw hook/transform refusal before hook-capable validation, effective phase and composed-arm checks, full records, exact source, unchanged grading and separate live authority.

The implementation and [author handoff](reviews/admission-evaluator-qualification/admission-qualification-author-result.md) are committed at `febde60940f04bd36210c06494b4e577b3377254`.\
The only previous preparation code change adds optional profile-path resolution to the existing public panel test; its original profile and all historical policy, fixtures, reports and captures remain unchanged.

| Author evidence | Measured result |
|---|---|
| Exact exports and forced builds | Candidate and historical default: 128 files each; original evaluator: 121 files; all bytes and builds checked |
| Fresh panel/default regression | Full historical-default payload equals the retained second capture after two temporary prompt-path normalizations; candidate differs only by evaluator revision and those paths |
| Complete/missing fixtures | 144/120 present outcomes, 288/240 cast votes, 0/48 uncast slots, 48/40 public jobs |
| Restriction tests | 27 declaration and seven composition mutations landed and were rejected without execution |
| Ordinary synthetic episode | One new phase and fake invocation; answer bytes agree across workspace, snapshot and ledger; recorded diffs agree with the ledger |
| Pure tally parity | All 11 legacy fields match the original evaluator across five record cases; eight additive diagnostic fields are separate |
| Test inventory | Six qualification tests, eight reused panel tests and 36 unchanged policy/accounting/record tests pass: 50 total |

The [complete compressed evidence](reviews/admission-evaluator-qualification/admission-qualification-evidence.json.gz.base64) decodes to 8,725,616 bytes, SHA-256 `7f5d3749cd37ae81f243b84c1ab4f439121ba4eeed3658fc3c7d5445934b728f`.\
It retains full captures, source inventories, command output, rejected configurations, assembled instruction bytes, episode records and both tally results, not just counters.\
The first run stopped because an inherited Node test-runner marker skipped its child run; [failed output](reviews/admission-evaluator-qualification/author-test-output-01.txt) and the [child warning](reviews/admission-evaluator-qualification/initial-child-command.json) remain beside the corrected successful output.

The [independent exact-artifact review](reviews/admission-evaluator-qualification/admission-qualification-review-01.txt) gives STATIC QUALIFICATION PASS at `febde60940f04bd36210c06494b4e577b3377254`; its SHA-256 is `c282b24a84c2b838719b839f6355f8941c091c5f599e9eab60309df9c8c9d515`.\
The reviewer independently passed six qualification tests, eight actual child panel tests and 23 policy/accounting tests: 37 total, with no failures or skips.\
The complete fresh payload reconciles with the retained evidence after only enumerated temporary paths and ten child TAP timings are normalized; no substantive prompt, source, score, reason, outcome or disposition is normalized.\
All 727 tracked files in the declared qualification, preparation, frozen-assurance and implementation-preservation scope matched the reviewed checkpoint.\
The [full independent output](reviews/admission-evaluator-qualification/admission-qualification-review-output-01.txt) has SHA-256 `e33c2a6b10418e7c3c04a1ad1d86e9b8a4e9a1f65267d42d3c448c3d8ae5e105`; both reviewer-owned files are preserved verbatim at `60dab84e7f02e4f4b917163f357af8c10ea2f554`.

This PASS resolves only PREP-L1's bounded candidate-compatibility portion, not real delivery/isolation, complete live invocation capture or whole-conductor behavior.\
The zero-call profile also freezes the original member settings; a later cap requires an explicit prospectively reviewed diagnostic profile/guard delta, not reuse of this profile as execution authority.\
No live call, provider/sandbox/probe/conductor invocation, resume, registration, security-fault case or AGP runtime change occurred.\
The synthetic episode's classification is injected test data, not classifier assurance.\
The next recommendation is a finite-budget diagnostic/calibration proposal with exact caps, sanitized observations, representative reader/file checks and stop rules; execution and fresh assurance remain separate decisions.\
B53 and B56 stay open, with no push or Zorg message.

---

### 4.44 Admission diagnostic proposal and bounded design recheck

On 2026-10-17 Australia/Melbourne the director continued preparation of the bounded diagnostic/calibration proposal; no live execution or spending was selected.\
The [source findings](reviews/admission-diagnostic-source-findings.md) and [proposal](reviews/admission-diagnostic-proposal.md) are preserved at `2fe758d44c2edb672f3622bc4ce6140143f3f2b5`.\
The proposal addresses judge calibration and representative reader-file completion for B53, not AGP runtime verification or a general evaluator upgrade.

The [first independent design/M7 review](reviews/admission-diagnostic-design-review-01.txt) is FAIL at that checkpoint: the proposed total-spend wording did not distinguish required ordinary semantic review from additional driven model/scoring work.\
Its SHA-256 is `6d4fc259dfdd663ef78344f1fd955ca400502fe1c5867cb38b188f1c398fd722`; the full report and [check output](reviews/admission-diagnostic-design-review-output-01.txt) remain unchanged at `165990d828f217885e0e834863865a62c9aa6fb6`.\
The review also requires capability feasibility before investment in long fixtures or a driver.

The separate [prospective amendment](reviews/admission-diagnostic-amendment-01.md) is committed at `5ffad4a1df8e7ffb0b275378910aa273b336185f`, SHA-256 `e6aee7d5056871989af0230affa75dfb1b02d07388262ea4c4a50d41982e7fda`.\
It defines ordinary non-author review assignments at readiness and after each live stage, excludes their unestablished resource cost from the proposed driven diagnostic envelope without calling them free, and prohibits hidden extra scoring/model calls.\
Any additional driven review needs prospective authority and explicit recalculated accounting before the first diagnostic call.\
The proposed 90-minute elapsed deadline includes inter-stage review delay and cannot pause or reset.

Stage 0a now inventories existing supported budget, trace, retention, containment/delivery and review capabilities before fixtures or driver construction.\
An unknown or unavailable prerequisite produces a terminal zero-call gap record with its owner, scope and revival evidence; generic facilities remain the runtime/provider owner's concern.\
Only an established supported path and separately selected preparation permit stage 0b's exact-packet work.\
Neither stage permits a hidden paid probe or security-fault input.

The [independent exact-artifact recheck](reviews/admission-diagnostic-design-recheck-02.txt) gives PASS for the bounded design/M7 correction only, with G1-G8 retained.\
Its SHA-256 is `80bc5dbd22ddbe2ad4c77c10b9ae6ba7fe2cf9098af36a3eca4a5a971f33f418`; the [complete independent output](reviews/admission-diagnostic-design-recheck-output-02.txt) has SHA-256 `7baa59b8ccb76e562c84260c1724a031d89731a03db4dbc0066ee41cb344c17c`.\
The reviewer measured exact bytes, preservation and inert arithmetic, not provider capability, isolation, semantic model performance or execution readiness.\
The planned schedule remains nine judge jobs, 42 cast slots plus six uncast slots, six representative readers, 18 first-attempt runtime invocations and a maximum of 36; 120 provider requests and USD 20 remain proposed driven ceilings, not an observed cost or all-in session budget.

The [author check record](reviews/admission-diagnostic-author-checks.json) retains documentation, identity, link, arithmetic and record-conformance outputs, including the initial formatting failure and the malformed static-check capture command before their corrections.\
All five selected Markdown documents and all thirteen board, record-integrity and architecture-record tests pass; these are author checks, not independent runtime evidence.\
The original proposal, failed review, prior qualification/preparation/assurance records, policy, population and AGP package/CLI implementation remain unchanged.\
The board's next recommendation is only stage 0a's read-only capability inventory; B53 and B56 remain open, with final adoption, runtime repair and acceptance outstanding.\
No driven diagnostic/model/provider/probe/sandbox/conductor invocation, retrospective rescoring, shared configuration mutation, push or Zorg message occurred; ordinary author and independent review work is not described as resource-free.\
Board and verification edits remain local with their pre-existing mixed changes.

---

### 4.45 Admission diagnostic capability inventory and zero-call stop

On 2026-10-17 Australia/Melbourne the director selected stage 0a's read-only capability inventory.\
The [source findings](reviews/admission-diagnostic-capability-findings.md) separate pinned interface/configuration observations from the [author disposition](reviews/admission-diagnostic-capability-result.md): STOP, no supported path established and zero diagnostic calls.\
This is the reviewed amendment's terminal gap outcome, not a diagnostic FAIL, independent readiness PASS or finding that the deployed providers lack the capabilities.

Inspection used the static-qualified evaluator `e705b3d749400d0a79efe98e5338e9c84a1695b8` and local committed owner documentation at `ecb2f5f29d6aba8c58e9588d34b677b516ef03d8`, leaving the owner's dirty worktree untouched.\
It does not adopt that newer revision or claim remote freshness.\
The [complete inspection record](reviews/admission-diagnostic-capability-checks.json) retains bounded searches, source Git/blob and SHA-256 identities, frozen evidence hashes and selected old-run metadata against AGP baseline `d8305fcdda94613c116e6530af44458336d9d4ee`.

The inspected public surfaces expose declared output limits and returned token/runtime events, not the required pre-dispatch spend reservation or complete billable-request ledger.\
The frozen sanitized provider declaration records model/client/endpoint choices, not actual backend/account enforcement; Codex uses a separate path whose controls are also unestablished.\
The source retains runtime lines in memory before the return-time writer; no supported persistence/supervision boundary covering the required termination paths was established.\
These are bounded source/evidence gaps, not measured live enforcement defects.

The earlier six reader and three judge profiles remain accepted for their recorded evaluator/configuration; neither that acceptance nor the candidate's static qualification covers the proposed diagnostic profile by inheritance.\
The existing ordinary non-author review workflow is identified, with future assignments belonging to exact-packet readiness if the path is revived.\
The result names each gap's responsible role and exact revival evidence and drafts a bounded owner request; it has not been sent or placed in another repository.

All four selected Markdown documents and all thirteen board, record-integrity and architecture-record tests pass in the author's local checks.\
Their complete output is retained with the inspection record; these checks validate records, not deployed capability or independent readiness.

The board removes the resolved inventory-selection question and records owner evidence as the next dependency, without changing B53/B56's open status, priority or build order.\
No fixture/driver construction, live diagnostic/model/provider/probe/sandbox/conductor invocation, credential/account query, configuration mutation, security-fault input, AGP runtime change, push or Zorg message occurred.\
Ordinary author work is not represented as resource-free, and no fresh reviewer or additional review experiment was assigned.\
Preparation and execution remain separate selections; board and verification edits remain local with their pre-existing mixed changes.

---

### 4.46 Admission diagnostic owner handoff

On 2026-10-17 Australia/Melbourne the director selected the recommendation to send the bounded capability request.\
The [retained request](reviews/admission-diagnostic-owner-request.md) was placed in context-lab's newly created local `incoming` folder; the [handoff record](reviews/admission-diagnostic-owner-handoff.md) identifies the exact path, content hash and delivery boundary.\
Both copies are byte-identical at 5,316 bytes, SHA-256 `a28c10993dbc919f03ee73307fd645be5d3f2fa3a78207fe88ce046c417d1e19`.

Context-lab's tracked files are unchanged; no recipient-repository commit or push was made.\
Local placement does not establish owner acknowledgment or acceptance.\
No destination for the Nexus/OpenCode or separate Codex account operators was established by the bounded routing search; the director was asked, and direct provider delivery remains pending.\
The context-lab request also asks for the responsible owner or routing destination for questions outside that recipient's authority.

The request retains the original three questions, unchanged proposed diagnostic limits, complete source references and the separation between runtime and provider responsibilities.\
It asks for existing supported interfaces and evidence, not implementation, configuration changes or fresh live measurements.\
The [handoff checks](reviews/admission-diagnostic-owner-handoff-checks.json) retain the exact placement commands/results and before-state identities; these are author records, not capability qualification.

All five selected Markdown files and all thirteen board, record-integrity and architecture-record tests pass in local author checks.\
These checks establish record consistency, not recipient acknowledgment or runtime readiness.

The board replaces the resolved send-approval question with the actual routing dependency and preserves B53/B56's open status, scores and build order.\
The prior capability inventory and all frozen proposal/review/qualification/assurance records remain unchanged.\
No fixture/driver preparation, model/provider/probe/sandbox/conductor call, security-fault input, AGP runtime change, configuration mutation, push or Zorg message occurred.\
Board and verification changes remain local with their pre-existing mixed edits; the diagnostic remains stopped pending owner evidence and separate later selections.

---

### 4.47 Reply isolation proposal review

The director selected an advisory review of Zorg's exact-peer reply proposal, not implementation.\
The [review](reviews/reply-isolation-review.md) recommends accommodating optional direct-peer egress while revising the proposal's relay, identity-association and admission semantics.\
The [source manifest](reviews/reply-isolation-sources.json) pins AGP, Zorg and the consumer components, records file hashes and distinguishes uncommitted prior review inputs from committed source.

The source observations and recommendations are separate:

| Source observation | Review consequence |
|---|---|
| D26 intentionally permits unresolved-pin forwarding and checks the serving instance at delivery | Preserve ordinary multi-hop pins; the stronger constraint must act before bytes enter an unauthorized channel |
| Zorg's D51 permits same-node/same-principal replacement sessions, forbids relay channels, and also proposes trusted relays | Reconcile the conflicting clause; recommend a direct-only initial guarantee, distinguishing AGP relays from carrier terminators |
| Admission receives channel evidence but returns only allow/deny; send policy carries no principal constraint | Agree either an immutable node-to-principal admission invariant or an explicit authorization association, without putting issuer policy into routing |
| One exact writer owns admitted packets, and protocol dispositions retain exact controller bindings | Allow replacement selection before send admission, not migration/replay after it; do not change reverse-disposition ownership |
| Operation-call's reply and failed-end sends currently carry only the destination pin | Consumer adoption must cover every reply branch; an AGP capability alone would not close Zorg's guarantee |

The review names acceptance properties for provenance, principal continuity, direct egress, withdrawal/replacement, bounded retained authority, refusal/fallback behavior and CLI/browser parity.\
These are obligations for a later agreed design, not executed security tests or runtime evidence.\
External TLS and channel-binding references constrain the identity reasoning but do not certify AGP or select a new authentication protocol.

Author checks passed: the three changed Markdown records pass the documentation checks, and all 13 board, record-integrity and architecture-record tests pass.\
The source/preservation check verifies 33 input files and 27 local links, limits board changes to the four B51/M14 readiness entries, and confirms that all earlier verification content and the pre-existing mechanisms edit are preserved.\
The [check captures](reviews/reply-isolation-checks.json) retain these results; they do not establish runtime behavior or independent assurance.

The board now points B51 to scope and identity-association agreement rather than an unread proposal.\
Its score, open status and build-order position are unchanged; B53's evaluation dependency and B56's runtime acceptance remain open.\
No normative contract, runtime, consumer repository, credential configuration or frozen assurance record was changed, and no downstream message, commit or push was made.\
This is advisory source analysis, not an independent gate verdict or fresh-reader assurance.

---

### 4.48 Reply isolation response placement

The director selected continuation of the reply-isolation collaboration.\
AGP retained the [response](reviews/reply-isolation-response.md) and placed an identical draft at `zorg/upstream/incoming/agp-reply-isolation-response.md`, following Zorg's `upstream/README.md`.\
That ignored inbox is the draft channel; Zorg owns acceptance and any committed received copy.

Zorg's checkout advanced to `53923cbee49dc16f1ab16fb0af6a2182a4ae26bb`; its upstream correspondence and decisions had no diff from the prior review checkpoint.\
All 33 inputs in the [review source manifest](reviews/reply-isolation-sources.json) still matched their captured hashes at the handoff refresh.\
AGP remained at `0aa6be75ccacf4e2c3770a49c5ea39970a25a98a`; no new source finding or runtime claim is made.

The response carries the agreed replacement-session requirement forward and requests three contributions:

1. Resolve the conflicting trusted-relay clause against the proposed direct-only guarantee.
2. Identify the principal-continuity guarantee supplied by caller-identity and the credential owner, or the missing capability that requires an explicit immutable association.
3. Confirm operation-call integration across every reply branch and consumer acceptance against the resulting AGP revision.

The [handoff record](reviews/reply-isolation-handoff.json) retains copy identity, source-refresh results, before/after board changes and author checks.\
The board now names the pending Zorg response; B51's score, open status and build-order position are unchanged.\
Placement is not acknowledgment, contract agreement, independent assurance or permission to implement; no runtime, received Zorg record, earlier assurance record, commit or push was changed by this handoff.

---

### 4.49 Zorg reply and contract qualifications

Zorg's `D59` and [reply](../../zorg/upstream/agp-reply-isolation-reply.md) resolve the trusted-relay clause in favor of direct-only egress, select an immutable admission association, and commit every operation-call reply branch to the restriction.\
The reply's citation update at `487044caae81c7adb03c8176380c372af6839700` names the updated consumer contracts; it changes references, not semantics.\
Those contracts describe future adoption, while AGP's public types still lack the association and restriction and operation-call still sends with an ordinary destination pin.

The director selected continuation after the read-only assessment.\
AGP retained the [three qualifications](reviews/reply-isolation-qualifications.md) and placed an identical draft at `zorg/upstream/incoming/agp-reply-isolation-qualifications.md`:

1. An unauthenticated direct-only profile must be explicitly selected, not inferred as a fallback from missing, malformed or failed authentication.
2. A proved principal needs a trusted authority namespace; transport provenance or proof method alone does not establish equivalence across identity domains.
3. Issuing a key bound to a node name does not establish permission to reuse that identity; the credential and admission owners must state the ownership rule or explicitly narrow the original-instance guarantee.

These are source-grounded contract qualifications, not runtime defect reproductions.\
The response supports the proposed composition while keeping proof and node-identity policy with the credential and admission components, and shared request capture and atomic send enforcement with AGP.\
The [handoff record](reviews/reply-isolation-qualifications-handoff.json) retains source checkpoints, copy identity, before/after board changes and author checks.

The board now points B51 to shared contract drafting and these remaining owner decisions rather than an unread Zorg reply.\
Its score, open status and build-order position are unchanged; final public types, implementation and consumer acceptance remain open.\
Placement of this follow-up is not acknowledgment or ratification, and documentation checks are not runtime or independent assurance.\
No runtime, normative contract, received Zorg record, earlier review record, commit or push was changed by this handoff.

---

### 4.50 Direct peer send draft and Zorg lifetime review

The director selected the shared contract drafting step.\
AGP authored the [direct-peer send draft](design/direct-peer-send.md), using the existing survey and the explicit drafting instruction without inventing new stakeholder picks.\
It is a proposal, not a normative contract, implementation selection or independent assurance verdict.

During source inspection, Zorg received the preceding qualifications unchanged and sent its [D60 reply](../../zorg/upstream/agp-reply-isolation-qualifications-reply.md), recorded at `e035196e7e06371a8c4e97d3aa789f1a7d8550c1`.\
The revised caller-identity, credential-issuer and operation-call contracts supply explicit authenticated/unauthenticated modes and configured authority namespaces.\
Those two choices are incorporated as design inputs, not as implemented AGP capabilities.

The continuation-secret proposal improves ownership checks while the issuer retains a binding, but its maximum-call-bound retention rule does not establish retirement of all old host replies.\
Static source inspection shows that operation-call's request carries no deadline, its caller stops waiting at its bound, and its host can still await a handler and subsequently call the reply function.\
The draft recommends a non-secret instance-binding identifier that changes on reallocation, or a separately proved complete retirement rule; neither alternative is selected on Zorg's behalf.

Other proposed mechanics are an explicit restricted-send method with fail-closed support handling, immutable request capture, an explicit transport-protection minimum, atomic direct-candidate admission and the existing one-hop packet budget.\
Current `send()` reads only known options, so an option-only extension could be ignored by an older runtime; this is a source-based compatibility finding, not a runtime reproduction.\
Ordinary multi-hop pins and exact-controller disposition returns remain unchanged.

AGP retained a [focused response](reviews/direct-peer-send-draft-response.md) and placed an identical draft at `zorg/upstream/incoming/agp-direct-peer-send-draft-response.md`, pointing to the producer-owned contract draft.\
The [draft check record](reviews/direct-peer-send-draft-checks.json) retains source checkpoints, the concurrent Zorg update, before/after board changes, copy identity and author documentation checks.

B51 remains open at the same score and build-order position, now awaiting joint lifetime/API review rather than an initial response or an unwritten draft.\
The acceptance table is prospective; no runtime, exploit reproduction, independent design verdict, fresh-reader assurance, normative schema, earlier record, commit or push was changed or produced by this step.\
The admission repair, browser acceptance, scale envelope and credential-lifecycle agreements remain separate work.

---

### 4.51 Direct peer agreement and lease lifecycle boundary

The director selected incorporation of Zorg's agreement and resolution of the lifecycle boundary.\
The [D61 reply](../../zorg/upstream/agp-direct-peer-send-draft-reply.md) at `a2edadca5129eff7894ee9a2050cc9c950a3e684` selects `instanceBinding`, the proposed public shapes, identifier bounds and explicit protection handling across all reply branches.\
Caller-identity, credential-issuer and operation-call record that agreement in their owning contracts; no corresponding implementation is claimed.

The [reconciled draft](design/direct-peer-send.md) no longer presents those choices as unanswered.\
Its [exact earlier text](reviews/evidence/direct-peer-send-before-d61.txt) is retained against the original draft check hash, and section 4.50 and all earlier review records remain unchanged.

One declared dependency remains missing: D61's lease rule assumes `operations.connections()` can identify pending and admitted uses by `(node, instanceBinding)`.\
Static inspection of AGP's public types, schemas and runtime projection shows no such association; pending entries also omit the remote node.\
An admitted-only extension would not by itself account for redeemed uses before identity commit.

The draft now states the proposed release conditions: no outstanding usable admission credential, no pending work able to publish a session, no live admitted session, and an elapsed issuer grace interval with a final check serialized against renewal and redemption.\
Unknown lifecycle observations do not establish absence, late completion cannot revive a released binding, and terminal retained resources stay accounted for separately.\
The issuer keeps lease ownership; the joint B6 lifecycle must define exact facts and ownership transfer with AGP, coordinated with B53 without amending its frozen records.

A [focused lifecycle response](reviews/direct-peer-send-lifecycle-response.md) is placed in Zorg's ignored incoming folder for owner agreement.\
The [reconciliation check record](reviews/direct-peer-send-lifecycle-checks.json) retains source revisions, unchanged-file hashes, before/after board lines and identical-copy checks.\
Placement is not acknowledgment, and author documentation checks are not the adversarial or axiom-alignment verdict still owed before implementation.

B51 remains open with its score and build-order position unchanged.\
No runtime, normative schema, consumer implementation, earlier verification record, commit or push is changed by this step.

---
### 4.52 Direct peer D62 design and axiom review

The director selected D62 incorporation and AGP design/axiom review, then expressly authorized one independent read-only review agent.\
The [D62 reply](../../zorg/upstream/agp-direct-peer-send-lifecycle-reply.md) at `56350495934b90c63a17950bafaac71e16d7568e` agrees issuer-owned reclamation, all four release conditions and the two exact binding/AGP lifecycle facts.\
The owning credential-issuer and caller-identity contracts record the agreement; the exact producer API remains joint B6 work coordinated with B53, not a new unanswered B51 consumer requirement.

The [review record](reviews/direct-peer-send-design-review.md) and [independent verdict](reviews/direct-peer-send-independent-review.txt) record technical PASS and scoped M7 PASS for the [frozen D62 draft](reviews/evidence/direct-peer-send-design-review-input.txt), SHA256 `bede054da088b516f55e09aa02e111a9dfdb61b57ead5b493cc90f4f2110119a`.\
No required design correction or accepted deviation was identified.\
The five applicable product axioms remain pinned to the ratified source; current delivery-process guidance does not silently change that map.

The verdict carries exact-owner candidate resolution, guarded association installation, immutable bounded values, one shared admission/writer path, retained-metadata accounting and all-branch consumer adoption as implementation guardrails.\
Returning `allow` is explicitly not the controller-commit or reservation-transfer fact.\
The reviewer used four independently produced constraint families and did not count AGP history as independent corroboration of AGP source.

The [working draft](design/direct-peer-send.md) reflects review completion and remaining adoption gates; the exact submitted text and the [pre-D62 draft](reviews/evidence/direct-peer-send-before-d62.txt) are preserved separately.\
The [author check record](reviews/direct-peer-send-design-checks.json) records source identities, documentation and record checks, narrow board changes and preservation of earlier evidence.

B51 stays open at its existing score and build-order position.\
Next is the adoption packet and shared implementation sequence, with required documentation assurance before ratification and no bypass of B53's guarded-commit work.\
Production issuer reclamation separately requires the declared B6 lifecycle API and composition evidence; browser and scale acceptance remain open.

This is not M2 fresh-reader assurance, runtime verification, ratification or consumer acceptance.\
No runtime source, normative schema, earlier verification section, frozen review, consumer file, commit or push was changed by this step.

---
### 4.53 Direct peer send adoption preparation

The director selected preparation of the B51 adoption packet with "continue".\
The [adoption recommendation](reviews/direct-peer-send-adoption.md) carries the independently reviewed D62 contract into explicit public-contract absorption, one shared implementation sequence and acceptance ownership.\
It remains proposed: no ratification, implementation selection or new independent verdict is recorded.

The source inventory locates the public node interface, core data types, contract generator, generated catalogs/exports, runtime routing and controller boundaries, and the existing package-root compile-test pattern.\
The packet requires exact-owner candidate filtering, guarded association installation, immutable bounded capture and explicit retained-metadata accounting without a second send engine.\
It also records the existing schema-versus-invocation timeout-domain difference so shared normalization does not silently change ordinary send.

B53's guarded commit is an implementation dependency, not an implied approval of its unimplemented repair.\
B6's per-redemption transfer and exact-controller lifetime API remains a separate gate on production issuer reclamation, not a missing consumer choice for B51 adoption.\
No browser confidentiality, scale or consumer acceptance claim is added.

The remaining documentation-assurance work is bounded to prospective questions, an answer key and frozen reading sets before commit, fresh key audit and blinded readers.\
No reader, provider, evaluator, spending or execution setup is selected here; the prior design review is not M2 assurance, and the stopped B53 experiment supplies no B51 readiness verdict.

The [author check record](reviews/direct-peer-send-adoption-checks.json) records documentation and record-integrity checks, references, source identities, preservation checks and the narrow board update.\
B51 retains its score and build-order position; the next move is preparation of that prospective assurance packet.\
All earlier verification text and frozen reviews remain unchanged; no normative contract, runtime, consumer file, commit or push is changed by this step.

---
### 4.54 Direct peer send assurance preparation

The director selected preparation of fresh-reader questions, an answer key and frozen reading sets with "continue".\
The [prospective packet](reviews/direct-peer-send-assurance/direct-peer-assurance-preparation.md) contains twelve questions: eight controls and four adoption-planning questions.\
It compares the independently reviewed D62 contract with the identical contract plus adoption guidance, not with a superseded identity design.

The [manifest](reviews/direct-peer-send-assurance/direct-peer-input-manifest.json) fixes two complete source snapshots, opaque reading labels, the common instructions/questions and the separate author key.\
A pure projection removes review administration, the experiment protocol and provenance from reader material while preserving mechanism, ownership, acceptance and file-location information.\
The candidate retains the complete baseline prefix byte-for-byte; the original design, adoption packet and earlier review records are unchanged.

The proposed scoring distinguishes materially wrong decisions, safe but incomplete information, unsupported inference and intended unresolved choices.\
It retains per-control non-regression, explicit invalid-evidence handling and full answer/vote accounting.\
The proposed three-readers-per-reading comparison is descriptive; no model family profile, provider, evaluator revision, execution order or spending is selected.

Context-lab remains the owner of execution, isolation, judging and replayable records.\
This is a source packet for independent review, not a validated executable pack, and no harness is copied or model invoked.\
A future execution binding must establish eligible-response semantics and complete delivery before running; earlier B53 readiness and scoring records supply no inherited verdict.

The [author checks](reviews/direct-peer-send-assurance/direct-peer-preparation-checks.json) record deterministic packet checks, negative checks on duplicate IDs, missing quotations, changed bytes and missing source boundaries, documentation/record checks and preservation of existing work.\
These checks establish artifact integrity, not answer-key correctness, fresh-reader assurance or runtime acceptance.

B51 retains its score and build-order position.\
Next obtain approval for a local-only source-packet commit followed by one fresh read-only key audit; execution readiness and reader execution remain separate gates.\
No commit, push, independent-agent run, normative contract, runtime or consumer mutation occurred in this preparation.

---
### 4.55 Direct peer assurance local commit and key audit

The director selected the recommended local-only twelve-file assurance-packet commit and one fresh read-only key audit with "continue".\
Commit `669cbd78fe3d6d369324a11a6a901cdf92bf4e66` contains exactly the twelve prepared source-packet files and no earlier working changes.\
The packet's pre-commit authority/status sentences remain historical provenance; this selection authorized the local commit and audit, not reader execution, provider setup, a push or implementation.

The [independent review](reviews/direct-peer-send-assurance/direct-peer-key-audit-01.txt) reports KEY/COMPARISON-INSTRUMENT FAIL after reviewing all twelve questions against both complete readings and their source snapshots.\
Execution readiness was not reviewed; the verdict is about the instrument, not the previously reviewed AGP design.

| Finding | Defect and prospective disposition |
|---|---|
| F1, Q07 | The key adds operation-call origin validation, while the supplied contract assigns the origin-equality check to AGP capture and requires the consumer to use that captured target and validate configured mode; remove the unsupported consumer obligation |
| F2, Q11 | The question requests any known accounting limitation and the key says where available, but its support note automatically caps an honest absence statement; explicitly require the current-state diagnosis in the question/key or remove the conditional clause's automatic cap |
| Non-blocking rubric qualification | Preserve version-neutral grading qualifications when withholding role/support metadata from judges; do not discard semantic exceptions with the blinding data |
| Non-blocking external cross-check | The candidate mentions seven review closeout hooks without supplying their contents; identify that limit and never score guessed or unavailable obligations |

The author accepts both blocking findings after checking the question/key and the cited ownership/accounting text.\
For F2, the recommended correction is to ask explicitly for the current accounting diagnosis, preserving the intended actionable-planning duty while keeping a faithful gap distinct from a wrong answer.\
No question, key, source snapshot or reading is corrected in this step; the failed checkpoint and full verdict remain intact.

The auditor found the remaining ten keys sound within their stated scope and the declared projection consistent with the source snapshots.\
Those findings are not executed comprehension assurance, an exhaustive contract test, runtime acceptance or a new technical/M7 verdict.\
The [author checks](reviews/direct-peer-send-assurance/direct-peer-key-audit-checks-01.json) retain commit/blob identity, pre-commit checks, review capture, narrow board changes and preservation evidence separately from that verdict.

B51 retains its score, open status and build-order position; B53 and B6 remain separate implementation and production-lifecycle gates.\
Next obtain approval for a prospectively corrected question/key checkpoint, local commit and bounded recheck by the same independent auditor.\
No push, scored reader/judge run, execution configuration, normative contract change, AGP runtime change or consumer edit occurred; audit records and this board/verification update remain local and uncommitted.

---

### 4.56 Direct peer assurance key correction and recheck

The director selected the prospective correction, one new local checkpoint and one bounded read-only recheck by the same independent auditor with "continue".\
Commit `a09e4bcda9d668b52ff3212c3813fad30fa7ac10` contains exactly seven assurance files: the corrected questions, key, manifest and preparation banner, the correction record, and the unchanged original audit and author-check records.\
Its parent is the original failed checkpoint `669cbd78fe3d6d369324a11a6a901cdf92bf4e66`; no earlier working changes were included and no push occurred.

The [prospective correction record](reviews/direct-peer-send-assurance/direct-peer-key-correction-01.json) names the superseded clauses, preserved boundaries and original-revision access.\
Q07 now requires use of captured origin/association and validation of configured mode, without inventing another consumer origin-equality check.\
Q11 now explicitly asks for the current accounting diagnosis, so a faithful missing diagnosis remains incomplete rather than wrong, while identifying an unselected formula or API remains correct.

Version-neutral grading qualifications now live in explicit judge-facing guidance rather than private arm commentary.\
The common rubric excludes the unsupplied seven closeout-hook contents from extra scored duties.\
These are delivery requirements, not proof that any execution renderer implements them.

The [full bounded recheck](reviews/direct-peer-send-assurance/direct-peer-key-recheck-02.txt) returns KEY/COMPARISON-INSTRUMENT RECHECK PASS: both blocking findings are resolved, both qualifications are explicit, and no introduced regression requiring correction was found within its scope.\
This was the same non-author auditor, not a fresh independent sample or scored reader.\
Execution readiness remains NOT REVIEWED; the PASS is not documentation effectiveness, technical/design approval, ratification, runtime acceptance or experiment authority.

The original FAIL remains attached to its original checkpoint, and both full source snapshots, both readings, common reader instructions, projection and packet-test source remain unchanged.\
Only Q11's prompt and the identified Q07/Q11 required-decision clauses changed; the preparation document's original body is retained beneath its correction banner.\
The corrected manifest has SHA-256 `9a78da3b27721a851fa3f928b0cab502b01ea98a5dd39a7a41d0be442b30d2a6`; reader payloads are 35,902 and 52,784 bytes, which measures source size rather than delivery or model-context fit.

The [author-check record](reviews/direct-peer-send-assurance/direct-peer-key-recheck-checks-02.json) carries local commit/blob identity, deterministic checks, the full review's capture identity and preservation evidence separately from the independent verdict.\
The staged whitespace check reported the original review's verbatim two-space line ending; it was preserved and explicitly dispositioned, while the scoped authored-file check passed.

B51 retains its score, open status and build-order position; B53 and B6 remain separate implementation and production-lifecycle gates.\
The ruled correction/commit/recheck question leaves the board, with its selection recorded here.\
The recommended next move is a read-only assessment against context-lab's public execution contract, identifying supported bindings and readiness gaps without reaching into its implementation to judge fit.

No provider setup, execution-pack construction, scored reader/judge run, new agent, normative contract change, AGP runtime change, consumer edit or push occurred.\
The new recheck/check records and board/verification updates remain local and uncommitted; the corrected source packet and preserved original FAIL are committed.

---

### 4.57 Direct peer context-lab contract request

The director selected the read-only public-contract assessment with "continue", then selected a local, unsent owner-request draft with a further "continue".\
The assessment examined context-lab's public documents at `7388c9a68c446dc7b2a3db17613c9983973908a5`, not its implementation or a running configuration.\
Its conclusion is purpose fit with execution compatibility unestablished, not an independent execution-readiness verdict or a new failure of the corrected assurance key.

| Finding | Disposition in the local request |
|---|---|
| Documented retry conflict | AGP authorizes no automatic runtime/infrastructure retry; context-lab's runtime contract and completed Delta-4 H1 specify a rerun; ask for a supported no-retry binding or a separately reviewed prospective amendment |
| Eligible response and judge delivery | Ask for event-to-answer eligibility, response splitting without an implicit scored-file task change, complete judge qualifications and withheld role metadata |
| Complete records and acceptance | Ask for a stable export accounting for all 72 expected outcomes and 144 vote slots; AGP owns conservative scoring and acceptance, which generic `improve` does not implement in full |
| Limits and operator choices | Ask for supported byte/time/spend enforcement and failure accounting; profiles, order and budgets remain unselected |

The [draft request](reviews/direct-peer-send-assurance/direct-peer-context-lab-contract-request.md) carries the concrete requirements, source references and requested owner reply.\
Its four questions distinguish a documented conflict, missing public bindings and project-owned decision logic; they do not assert that uninspected runtime code lacks every possible facility.\
The source packet remains a source packet, not an executable context-lab pack.

During drafting, context-lab's observed head was `477e53882cb109ef1b05dbcd1605f60ef98167ae`.\
The intervening commit adds decision 0030; the cited operations, architecture and Delta-4 files are byte-identical to the assessed checkpoint, so it does not settle these questions.\
The [author-check record](reviews/direct-peer-send-assurance/direct-peer-context-lab-request-checks.json) retains the complete prior assessment, source identities, exact current edits, local checks and preservation measurements.

Only this append and four B51 current-state entries change the existing board/verification files.\
B51's score, open status and position are unchanged, as are B53 and B6's separate gates.\
The answered assessment-selection question leaves the board; the next decision concerns delivering the draft through a confirmed owner destination, not waiting for a response to an unsent request.

The corrected source packet, original FAIL, bounded key-recheck PASS and all prior assurance records remain unchanged.\
These are author documentation checks, not fresh-reader assurance or a new independent verdict.\
No delivery to another project, provider setup, execution-pack construction, model call, new agent, normative/runtime change, commit or push occurred in this step.

Mechanics: preserve the audited experiment and ask the execution owner for supported bindings.\
Rationale: settle compatibility before choosing or constructing the execution setup.\
Consequence: silently changing retries, output surfaces, validity or aggregation would measure a different experiment.

---

### 4.58 Direct peer context-lab owner handoff

The director selected delivery of the local direct-peer contract request with "continue".\
Context-lab's existing `incoming` folder contains the earlier AGP admission request and a maintainer response, establishing the local handoff route without creating a new channel or contacting another owner.

The [handoff record](reviews/direct-peer-send-assurance/direct-peer-context-lab-handoff.md) identifies the [placed request](../../context-lab/incoming/agp-direct-peer-assurance-contract-request.md) and exact source/delivery hashes.\
A 703-byte delivery cover clarifies current placement and the source's historical draft status; the full 8,914-byte approved request follows unchanged.\
The original draft, prior check record, assurance packet, original key-audit FAIL and bounded recheck remain untouched.

Only the new request was added to context-lab by this handoff.\
The [author checks](reviews/direct-peer-send-assurance/direct-peer-context-lab-handoff-checks.json) record placement equality, prior-file preservation and local documentation/record validation.\
Placement is not acknowledgment, acceptance, a new independent verdict or an execution-readiness result.

The delivery-selection question leaves the board, with its ruling retained here.\
Three other B51 current-state entries now identify the owner reply as the next input; B51's score, open status and position, and B53/B6's separate gates, are unchanged.\
The admission response already in the incoming folder is not a reply to this request and was not assessed as part of this delivery.

Mechanics: preserve the approved text and identify the reply dependency.\
Rationale: resolve public execution bindings with their owner before preparing the comparison.\
Consequence: acknowledgment or a proposed capability cannot silently alter the frozen measurement rules or authorize execution.

No provider setup, execution-pack construction, model call, experiment, new agent, normative/runtime change, commit or push occurred.\
These handoff and board/verification changes remain local and uncommitted.

---

### 4.59 Admission capability response and correction draft

The director selected read-only assessment of context-lab's admission capability response, then local preparation of the recommended correction request with "continue".\
The [draft](reviews/admission-diagnostic-correction-request.md) is unsent; no new cross-repository placement or owner work is authorized by this preparation.

The response usefully distinguishes client validation, sanitized declarations and emitted records from missing aggregate request/spend controls and parent-process crash retention.\
The assessed records do not establish a supported path for the exact proposed diagnostic profile, so the capability inventory's zero-call stop remains, without a new diagnostic FAIL or readiness PASS.

| Evidence correction | Measured basis |
|---|---|
| Three baseline identities do not resolve as written | Exact local commit lookups fail in all three non-shallow clones; context-lab and mission-kit short prefixes resolve to different full identities locally and through GitHub, while the Zorg prefix does not resolve in either lookup |
| Recorded Codex version is misquoted | Both cited run records contain `codex-cli 0.162.1`, not the response's `codex-cli 0.120.0`; this matches AGP's old runtime configuration but does not qualify the new profile |
| Retry counts are attributed to the wrong layer | The public Delta 4 definition counts cells with more than one harness attempt; the report's 436 GPT cells, 461 attempts and 25 retried cells do not establish hidden provider/SDK retries |

The draft requests an additive correction with exact identities, supported interfaces, sanitized evidence, covered scope/exclusions and confirmed owner routing.\
It distinguishes partial proposed facilities from closure of the required guarantees, preserves outstanding remote reservations after ambiguous termination, and does not select an implementation.\
Historical recorded probes remain scoped to their evaluator, role settings and allowed files; neither cited judge-probe list includes the Gemini Flash model selected by AGP.

The [author check record](reviews/admission-diagnostic-correction-checks.json) retains input identities, lookup results, bounded record projections, documentation checks and preservation comparisons.\
These are author observations and local validation, not independent assurance or provider acceptance.\
The writing skill kept the request in the existing review-document family; discoverable naming uses the admission-diagnostic prefix and separates the correction request from its checks.

Style checks pass for the three changed Markdown files; the documentation/record test run has 13 passing tests and one failing tracked-link test.\
That test joins absolute workspace links as relative paths and reports seven references whose actual targets exist; replay against the before-edit documents finds the same seven failures and no new ones.\
A separate absolute-aware check resolves the changed documents' local links, without replacing or relabeling the original failing test result.\
The check record retains both results; no checker or frozen source was changed.

The board now records the assessed response and unsent draft, with delivery as a director choice.\
B53's open status, scores and build-order position, B56's runtime-acceptance dependency and B51's separate direct-peer reply dependency remain unchanged.

Mechanics: retain the original response and request, identify factual corrections, and map unchanged prerequisites to owner evidence or explicit gaps.\
Rationale: historical success and partial telemetry cannot substitute for pre-dispatch guarantees and exact-profile acceptance.\
Consequence: no generic evaluator is rebuilt in AGP and no diagnostic resumes on an unsupported inference.

No shared configuration, provider setup, packet/driver construction, probe, model call, runtime change, new agent, commit or push occurred in this preparation.\
The draft and its tracking/check records remain local and uncommitted.

---

### 4.60 Admission diagnostic correction request handoff

The director selected delivery of the prepared admission correction request with "continue".\
The [handoff record](reviews/admission-diagnostic-correction-handoff.md) identifies the [placed copy](../../context-lab/incoming/agp-admission-diagnostic-correction-request.md), its content identity and the original source.

An 880-byte cover separates current delivery selection from historical draft status.\
Only twelve relative link targets in the enclosed request were rebased for the incoming folder; the inverse substitution reproduces the entire source byte for byte.\
The original draft, its preparation checks and the earlier context-lab correspondence remain unchanged.

The [handoff checks](reviews/admission-diagnostic-correction-handoff-checks.json) retain placement equality, link destinations, preservation and local documentation validation.\
These are author checks, not acknowledgment, capability acceptance, independent assurance or execution readiness.

The delivery question leaves the board, with its ruling retained here; B53 now awaits the owner's correction/addendum.\
B53's score, open status and build-order position, B56's runtime acceptance and B51's separate direct-peer reply dependency remain unchanged.\
Provider-operator destinations remain unresolved, and no diagnostic preparation or execution resumes.

The four handoff/tracking Markdown files pass style checks; the selected documentation/record tests remain 13 passing and one failing.\
The tracked-link checker still reports the same seven pre-existing absolute-path resolution failures retained in section 4.59; this handoff does not repair that checker.\
Separate handoff validation checks the delivered links and source equivalence without replacing the original failing result.

Mechanics: retain the approved source, add a delivery cover and adjust only link targets for their new location.\
Rationale: the recipient receives the approved request with usable evidence links, without changing its requirements or erasing preparation history.\
Consequence: file placement cannot be mistaken for owner agreement or permission to spend.

Only the correction request was added to context-lab in this handoff.\
A concurrent context-lab source edit outside this handoff was observed during validation and left untouched; it is not an owner reply or capability evidence.\
No configuration change, provider setup, experiment, diagnostic/model call, new agent, runtime change, commit or push occurred.

---

### 4.61 Admission use lifecycle proposal

The director selected developing the connection-lifecycle API proposal after the Zorg status review.\
The [draft](design/admission-use-lifecycle.md) recommends one process-local observation handle per attempted redemption, retained continuously through exact identity commit and terminal detachment.\
It is a preliminary producer proposal, not a complete acquisition API, adopted contract, independent review or implementation.

The proposal carries Zorg's settled ownership and four-condition reclamation rule without another requirements round.\
It distinguishes pending, admitted, established and terminal states; preserves a bounded admitted identity in the terminal result; and separates read authority, exact host termination and physical cleanup.\
It proposes conservative first-observed terminal time for reconnect grace, and keeps the complete-snapshot alternative and its completeness cost visible.

The factory, one-use attachment across inbound/outbound acquisition, shared clock domain and finite configuration remain design obligations.\
Identity commit must compose with B53's guarded transaction and B51's immutable association; the inherited deadline continues through confirmation.\
No normative transport/SDK/schema change or new package dependency is selected by this draft.

The [author check record](reviews/admission-use-lifecycle-checks.json) identifies inputs, preservation checks and local validation.\
B6 stays open at its existing score and build-order position; three current board entries now point to this proposal and its remaining work.\
Earlier admission/direct-peer reviews and context-lab assurance dependencies retain their scopes and status.

Mechanics: keep a non-reassignable per-use observation across ownership handoff, and publish its facts with the runtime commit.\
Rationale: the issuer needs authoritative facts about its known uses, without inferring absence from dropped events or an incomplete management projection.\
Consequence: either an early terminal claim or a handle retaining a detached controller would break the proposed lifecycle/resource boundary.

The three changed Markdown files pass the repository's style checks.\
The selected documentation/record suite is 14 passing and one failing, both before and after the tracking edits.\
The failure reports the same seven pre-existing absolute-path resolutions; it is retained as a failure, not replaced by supplementary link checks.

This step made no runtime changes, authentication probes, model calls, new agent assignments, outbound correspondence, commit or push.\
Independent technical/axiom review, documentation assurance, joint agreement and implementation selection remain open.

---

### 4.62 Admission acquisition and handoff proposal

The director selected completing the acquisition and handoff contract of the lifecycle proposal.\
The [expanded proposal](design/admission-use-lifecycle.md) now specifies a node-created acquisition source, one-use sealed channel handoff, both local-redemption acquisition directions, exact shared-clock ownership and required finite configuration.\
It remains a producer proposal awaiting independent technical/axiom review, documentation assurance, Zorg fit agreement and implementation selection.

The acquisition contract sits above neutral transport and converges on the existing controller owner.\
It separates channel custody, controller adoption and identity commit, keeps unfinished work charged after logical termination, and refuses unsupported composition before redemption.\
Local redemption is an authentication role, not connection direction: a client presenting a key to a remote hub does not invent a local redemption.\
Client fresh-key/refusal-rearm, concrete proof/carriage integration and browser/scale acceptance remain separate work.

The [initial proposal](reviews/evidence/admission-use-lifecycle-before-acquisition.txt) is preserved byte-for-byte, and section 4.61 and its check record remain historical.\
The [new author check record](reviews/admission-acquisition-handoff-checks.json) records source pins, documentation checks, in-memory type-coherence checks and preservation measurements.\
These are author evidence, not an independent verdict or public-package compatibility claim.\
B6 retains its score, open status and order; four current board entries now identify review of the concrete proposal as the next move.

Mechanics: one generation-bound use keeps its observer across explicit custody transfer, using one shared clock and separate pending/work budgets.\
Rationale: the issuer needs exact lifecycle facts without requiring application identity in neutral transport or interpreting missing management fields.\
Consequence: an ownership gap, refreshed deadline or premature work refund can invalidate reclamation even when each component appears locally correct.

No runtime implementation, authentication probe, model call, new agent assignment, outbound Zorg note, commit or push was made by this step.\
The existing documentation-link failure is recorded separately from the checks on the changed proposal; no earlier gate verdict is rewritten.

---

### 4.63 Admission acquisition independent design review

The director selected one independent read-only reviewer for the completed acquisition/lifecycle proposal.\
The [independent report](reviews/admission-acquisition-independent-review.txt) gives technical FAIL and scoped M7 FAIL against the [preserved exact input](reviews/evidence/admission-acquisition-review-input.txt).\
The [author assessment](reviews/admission-acquisition-review.md) accepts one blocking timing defect and one nonblocking accounting clarification.

The issuer checks credential expiry before AGP samples the later instant designated as redemption.\
The declared interface carries neither credential expiry into that check nor the sampled instant back to the issuer; synchronous serialization does not stop the monotonic clock.\
Repair must define one redemption instant for both validity and the inherited establishment deadline without moving credential policy into AGP.\
The clarification must preserve B53's distinction between ordinary-stop cleanup accounting and frozen numerical-terminal operations state.

The reviewed proposal remains byte-identical to its checkpoint; the full reviewer response, ruled-out concerns and validation guardrails are preserved separately.\
The finding is a proposed-contract defect, not an executed reproduction or a claim that current AGP implements the new API.\
This single static challenge is not wider M1 assurance, fresh-reader documentation assurance, joint acceptance or implementation approval.

B6 stays open at its existing score and order; four current board entries now place the timing amendment and re-review before Zorg issuer-fit review.\
Earlier B53/B51 verdicts, author checks and verification history are unchanged.\
The [author check record](reviews/admission-acquisition-review-checks.json) retains source identities, report/input equality, preservation and documentation-only checks, including the existing tracked-link failure.

Mechanics: preserve the failed design and independent verdict, assess each finding against its owning contract, and carry exact repair criteria into the next revision.\
Rationale: state serialization and a shared clock cannot substitute for an agreed temporal event at the issuer/node boundary.\
Consequence: an unspecified redemption anchor can break the expiry-to-establishment guarantee even when each component follows its own local sequence.

One independent reviewer was used.\
No runtime implementation, AGP execution, authentication probe, assurance experiment, new Zorg note, commit or push occurred.\
The next recommended action is a design amendment, not provisional consumer implementation.

---

### 4.64 Admission redemption timing amendment

The director selected amendment of the acquisition proposal after its independent technical and scoped M7 FAIL.\
The [amended working proposal](design/admission-use-lifecycle.md) now supplies the temporal input missing at the issuer/node seam: a trusted issuer authorization with an exclusive monotonic limit and the exact shared clock object.\
One final node sample checks that limit and anchors the inherited establishment deadline; the issuer retains proof, expiry policy, generation checks, irreversible use accounting and serialized registration.

The amendment declares normal expiry refusal, invalid authorization, duplicate recording, arming failure and exceptional registration dispositions.\
It explicitly acknowledges that checking clock identity and a finite number does not prove the trusted issuer derived the limit correctly.\
Ordinary stopped instances retain live cleanup accounting, while numerical operational-domain failure freezes resource values, revision and capture time together, preserving B53's distinction.

The [failed input](reviews/evidence/admission-acquisition-review-input.txt), [independent report](reviews/admission-acquisition-independent-review.txt), [author assessment](reviews/admission-acquisition-review.md) and all earlier check records remain unchanged.\
The original FAIL remains its historical verdict; this amended candidate has no independent verdict and does not close B6.

The [author check record](reviews/admission-redemption-timing-checks.json) carries source identities, exact change scope and documentation/type-coherence results.\
The in-memory declaration compile reports zero diagnostics with ten expected rejected type shapes; it does not import proposed methods from implemented packages or establish runtime behavior.\
The existing tracked-link failure is retained separately from checks on the changed Markdown.

Four current B6 board entries now identify independent re-review as the next action, followed by Zorg's issuer-integration fit assessment.\
No independent agent was assigned in this amendment step, and no runtime source, schema, authentication profile or consumer contract changed.\
No AGP runtime execution, authentication probe, Zorg message, commit or push occurred.

Mechanics: carry an issuer-selected exclusive limit into the same guarded recording event that starts the establishment allowance.\
Rationale: one temporal event composes the two owners' guarantees without running issuer policy inside AGP or introducing a provisional-token protocol.\
Consequence: an incorrectly derived limit still violates issuer duties, and the amendment must be independently challenged before consumer fit or implementation selection.

---

### 4.65 Admission redemption independent re-review

The director selected one independent read-only re-review of the amended acquisition/lifecycle proposal.\
The [unaltered independent report](reviews/admission-redemption-independent-review.txt) records technical PASS and scoped M7 PASS for the written contract, with no new blocking or nonblocking contract defect established.\
This is one independent design challenge, not completed wider M1 assurance, fresh-reader M2 assurance, consumer acceptance, ratification, implementation approval or runtime verification.

The [preserved input](reviews/evidence/admission-redemption-review-input.txt) and [working proposal](design/admission-use-lifecycle.md) share SHA256 `49a57e583eb0fbd6d46933273d376936e8cafc6ae95ec4944750ec2878b82097`; the candidate remains unchanged.\
Reviewer `/root/admission_redemption_re_review` checked the complete candidate, failed input/report, original Zorg requirements, issuer/caller contracts, prospective B53/B51 designs and actual source.\
The report retains measured source identities, ruled-out concerns, axiom mapping, tensions and implementation guardrails.\
The [original FAIL](reviews/admission-acquisition-independent-review.txt), its [input](reviews/evidence/admission-acquisition-review-input.txt), [assessment](reviews/admission-acquisition-review.md) and all earlier check records remain frozen; the candidate's submission-time status is not rewritten.

Author assessment: accept the independent design-level dispositions.\
The issuer's exclusive authorization limit is now checked at the same final node sample that anchors the opening allowance, resolving the original two-instant gap without moving credential policy into AGP.\
Correct limit derivation and serialized spent-use/handle registration remain issuer obligations; clock identity alone does not prove derivation.\
The stop-accounting wording now explicitly matches B53: ordinary-stop cleanup may update gauges and revisions, whereas numerical-domain terminal capture freezes values, revision and capture time.\
Neither disposition is implementation-level recurrence closure or evidence of physical resource release.

The review finds both original lifecycle facts coherently represented: exact pending-use handoff/termination and exact admitted-controller liveness/termination.\
Zorg still owns all four conjunctive lease-release conditions, finite reference retention and unknown-retains behavior.\
The scoped M7 PASS applies only at the [existing A3/A4/A8/A9/A14 boundaries](design/axioms.md); no excluded axiom, full A9/A14 conformance or inherited B53/B51 implementation assurance is claimed.

Four current B6 board entries now identify authorized Zorg issuer-fit review as the next action, without closing, rescoring or reordering B6.\
That review must assess limit derivation, shared-clock/generation ownership, prepared registration and failure handling, complete lifecycle-reference retention, identifier bounds, conservative observed-close grace and explicit finite limits.\
It is a fit review of the producer proposal, not a request to repeat requirements or implement provisional methods.\
Required documentation/design assurance, joint agreement, ratification, explicit implementation selection and producer-before-consumer verification remain; fresh-key-per-dial, refusal/rearm, browser carriage and deployment evidence are separate work.

The [author check record](reviews/admission-redemption-review-checks.json) preserves the exact input/report identities, source-manifest checks, baseline/final documentation results and change scope.\
The documentation-only suite retains its existing tracked-link failure separately from changed-file checks; its result is not the independent design verdict.\
Only the review evidence and current tracking changed: no runtime source, schema, prior evidence, consumer contract or candidate amendment.\
One independent reviewer was used; no AGP execution, authentication probe, new Zorg note, stage, commit or push occurred.

Mechanics: preserve the reviewed bytes and independent response, assess the findings against the original obligations, and advance the existing board item to consumer fit.\
Rationale: the repaired temporal contract can now be discussed with its issuer consumer without presenting proposal coherence as deployed capability.\
Consequence: skipping issuer fit or implementation verification could leave correctly specified guarantees unenforced; rewriting the historical FAIL would hide why the temporal input is required.

---

### 4.66 Admission lifecycle Zorg issuer fit handoff

The director selected placement of the issuer-fit request in Zorg's incoming folder.\
The [producer request](reviews/admission-use-lifecycle-fit-request.md) is now copied to [Zorg's incoming request](../../zorg/upstream/incoming/agp-admission-use-lifecycle-fit-request.md), following its [correspondence protocol](../../zorg/upstream/README.md).\
The receiving directory is `upstream/incoming/`, not a repository-root `incoming/`; Zorg intentionally ignores its drafts until its director accepts an unedited received copy.

The request targets the [frozen reviewed input](reviews/evidence/admission-redemption-review-input.txt), SHA256 `49a57e583eb0fbd6d46933273d376936e8cafc6ae95ec4944750ec2878b82097`.\
The [working proposal](design/admission-use-lifecycle.md) remains byte-identical and retains its submission-time banner; the request points separately to the later [independent static verdict](reviews/admission-redemption-independent-review.txt).\
The original FAIL, subsequent PASS and all prior evidence remain unchanged; no proposal amendment or new assurance verdict is made by this handoff.

The six fit areas cover redemption time/deadline ownership, serialized registration/failure, exact lifecycle/provider lookup, reclamation/grace, identifier/resource limits and hub/binding composition.\
In particular, the request explicitly asks Zorg to assess node-owned deadline recording against its earlier binding-owned wording, rather than treating that producer choice as agreed.\
It asks for consumer reasons and owning sections for gaps, not repeated requirements, runtime probes or an implementation PR.\
Existing caller-identity protections remain until a verified, agreed migration.

Only Markdown link destinations are rebased in the incoming copy, to absolute shared-workspace paths that remain valid if Zorg later copies it unchanged into `upstream/`.\
The proposal and review stay in AGP; the correspondence does not duplicate them as consumer contracts or claim a published package revision.\
Local file placement is verified, but receipt, acceptance and a reply are not claimed.

Four current B6 board entries now await Zorg's fit response without closing, rescoring or reordering the item.\
After that response, assess concrete gaps before amendment or joint agreement; remaining documentation assurance, ratification, implementation selection and producer verification are unchanged.\
Client fresh-key acquisition, refusal/rearm, browser carriage and deployment evidence remain separate work.

The [handoff check record](reviews/admission-use-lifecycle-fit-handoff-checks.json) records source identities, copy/link parity, baseline/final documentation checks and preservation of both repositories.\
The documentation-only suite retains its existing absolute-link failure; supplementary link checks are recorded separately.\
No runtime code, schema, consumer contract, prior correspondence, Git index or HEAD changed, and no reviewer, product execution, authentication probe, commit or push was used.

Mechanics: place a source-pinned fit request through Zorg's documented draft channel and record the exact copy transformation.\
Rationale: the consumer must judge its real transaction and retention constraints before the shared interface is agreed.\
Consequence: treating local placement or static design PASS as consumer approval would bypass that unresolved integration decision.

---

### 4.67 Zorg fit and context-lab replies reconciled

The director selected reconciliation of the newly received replies and local feedback drafts, explicitly unsent.\
This is an author assessment and current-state correction, not a new independent gate, product-contract amendment or implementation selection.

#### Received inputs and measured identities

| Input | Measured SHA256 | Intake state |
|---|---|---|
| Initial Zorg lifecycle fit reply hash checkpoint; original bytes not retained | `ebd0438cc67dd3b9e5b0a3bb387f62da5594549f2d3e9fe11cd63d5b0d3997cf` | Untracked reply and modified `D63` record at Zorg HEAD `0136fa1656ff295c488c0ae328629f3e301bdb71`; its sent-status text is not a measured commit |
| Subsequent Zorg reply text capture, preserved in the check record | `4f30443e6c8d08d246ba0e09c70d0a65e2e25089d78b7a0b50b1590a5500b9da` | Captured after the initial hash checkpoint and before the final issuer correction |
| [Admission diagnostic addendum](../../context-lab/incoming/agp-admission-diagnostic-correction-response.md) | `8d365d9faf48c8ca00b58a9ec1b07b938776ed0f0b50f61f642af997c0db60dd` | Local owner reply in context-lab's incoming folder |
| [Direct-peer assurance reply](../../context-lab/incoming/agp-direct-peer-assurance-contract-response.md) | `0e8d9e917672d858a98c13fb6759d2e62ee0ee220c766d3a5eafab9c2ef99252` | Local owner reply against context-lab `f454e18117586f55877f7a4a9f8fbcdb46526f64` |
| [Updated Zorg lifecycle fit reply](../../zorg/upstream/agp-admission-use-lifecycle-fit-reply.md) | `2b20c250deea3ade87b1c262008acd8ed560c130303ff87345a286f2d657e18f` | Updated during drafting; reply and `D63` incorporate the issuer corrections and are byte-identical in Zorg revision `25b08a58322c01bb0a126822eb6950f02e4cdf9f` |

Zorg's received fit request is byte-identical to the prior delivered copy and is now committed at its intake HEAD.\
That establishes receipt after section 4.66's placement checkpoint; the historical no-receipt claim remains unchanged at that earlier checkpoint.\
Correction during author validation: the initial Zorg hash observation and subsequent text capture were not atomic; the saved text hashes to `4f30443e6c8d08d246ba0e09c70d0a65e2e25089d78b7a0b50b1590a5500b9da`, not the earlier `ebd0438cc67dd3b9e5b0a3bb387f62da5594549f2d3e9fe11cd63d5b0d3997cf`.\
The [check record](reviews/upstream-reply-reconciliation-checks.json) retains both later Zorg reply texts and both context-lab replies with their measured identities, plus the initial source hashes and repository/index states; it does not claim to preserve the initial Zorg bytes.

#### Zorg fit and correspondence qualifications

Zorg reports that all six areas fit the reviewed input, SHA256 `49a57e583eb0fbd6d46933273d376936e8cafc6ae95ec4944750ec2878b82097`.\
The working proposal remains identical to the [frozen reviewed input](reviews/evidence/admission-redemption-review-input.txt).\
The author records design-level consumer fit with the explicit integration safeguards below: no additional lifecycle fact or producer API change is requested.

The initial reply's unconditional extra-retention bound of one sweep interval is not supplied by [producer section 6](design/admission-use-lifecycle.md#6-issuer-reclamation-and-exact-termination).\
Delayed sweeps and failed observations can retain a lease longer without a finite time bound; the first valid terminal observation remains conservative.\
Finite tables bound retained capacity and refuse new allocation; they do not establish a maximum reclamation time.

During intake, the issuer had already committed a correction at `8d75abf4c68489e641aa9493c5b88a71b0dd70a4`.\
Its [contract](../../credential-issuer/CONTRACT.md) now specifies pre-reserved prepared/uncertain storage, finish only after actual settlement/disposal, current-allocation checks, the qualified sweep-delay bound and historical treatment of the earlier deadline ownership.\
The [caller-identity contract](../../caller-identity/CONTRACT.md) is at `738435c61179e7d851749e271da8b6e043f04d59`.\
The initial reply cited the earlier issuer revision.\
Before this handoff, the issuer committed the additional correction `56f3583e4239c99b4248ef536394ec2e0555f4a9`: preserve the original registration on duplicate recording, retain issuance/renewal/redemption activity through compaction, and align the historical spend instant with recording or uncertainty.\
Zorg updated its reply and local `D63` record to carry these changes alongside the corrected registration, cleanup, allocation and sweep-delay semantics.\
The [local fit-response draft](reviews/admission-use-lifecycle-fit-response.md) now acknowledges that reconciliation and the committed reply; it does not repeat the correction request.

Zorg's reported multi-family review is not imported as an AGP assurance verdict.\
The producer's existing static technical and scoped M7 PASS remain scoped to their frozen input; documentation assurance, AGP ratification, implementation selection and verified consumer migration remain open.\
Proof-capable carrier composition, fresh-key acquisition, refusal/rearm, concrete CLI/browser carriage and deployment capacity remain separate work.

#### Context-lab compatibility and capability assessment

The admission addendum retracts the erroneous full revision identities, runtime version and internal-retry inference.\
Local commit resolution and the two cited run records confirm the corrected identities and recorded runtime version; no new execution evidence is produced.\
The addendum still identifies unsupported request/spend controls and parent-termination retention, unknown provider/account guarantees and unmatched exact-profile evidence.\
It names the workstation owner as a routing lead, not confirmed provider contacts; the existing zero-call stop remains.

The direct-peer reply identifies useful record and judge-delivery interfaces, but does not establish a compatible complete execution path.

| Boundary | Recorded assessment |
|---|---|
| Cell retries | Post-run rejection cannot implement a rule forbidding a second dispatch |
| Answer source | A file-writing task or implicit source fallback is not the agreed response-only task |
| Eligibility and accounting | Missing answers in an eligible response differ from unestablished eligibility; all expected outcomes/vote slots must be enumerated, not only present blinded units |
| Response and resource bounds | Output-token settings or post-run size checks do not alone supply the common response-byte contract, total deadline, pre-dispatch spending bound or complete capture |
| Owner implementation progress | Initially local changes added `maxAttemptsPerCell` and explicit `answerSource`; the owner then committed them with operations documentation at `de6f7d3246dff4893714d7df70d10901450d4d01`; the diff/commit observations are not AGP compatibility acceptance |

The [local context-lab feedback draft](reviews/context-lab-assurance-feedback.md) acknowledges both replies and the subsequent interface commit, requesting updated capability/evidence bindings and remaining exclusions.\
A scoped compatibility review of that commit remains to be selected; no prior evaluator qualification transfers to it.\
It retains separate admission and direct-peer protocols, limits and authority; no private evaluator, changed experiment, execution pack or model run is selected.

#### Board correction and validation boundary

The board's reply-pending entries now point to this assessment and the unsent drafts.\
Consumer fit questions are replaced with the remaining AGP ratification and concrete profile decisions; the later correspondence correction is recorded rather than left as an obsolete request.\
Scores, open/held/landed states and build-order positions remain unchanged, including B56's separate runtime-acceptance gap.

The [author-check record](reviews/upstream-reply-reconciliation-checks.json) carries before/after tracking changes, raw documentation-check results, supplementary local-link checks and source-preservation measurements.\
The baseline documentation suite reports fourteen passes and one failure for seven pre-existing absolute-path links; that failure is not a product-runtime result or a waived check.\
New feedback remains within AGP; no external delivery, source/schema change, provider execution, new reviewer, commit or push is part of this step.

Mechanics: retain the exact owner replies, reconcile their claims with the producer proposal and current consumer contracts, and update only current tracking.\
Rationale: a received fit answer ends a wait, but cannot supply missing execution capabilities or promote an unratified design.\
Consequence: conflating fit, committed support and verified behavior would erase the remaining gates.

---

### 4.68 Zorg and context-lab feedback handoff

The director selected delivery of both prepared feedback drafts through the existing incoming folders with "continue".\
This step records local placement and a newly received owner mapping, not recipient acceptance, design ratification or execution readiness.

| Recipient | Placed feedback | Placement boundary |
|---|---|---|
| Zorg | [Admission lifecycle fit response](../../zorg/upstream/incoming/agp-admission-use-lifecycle-fit-response.md) | Ignored draft channel under [Zorg's correspondence protocol](../../zorg/upstream/README.md); Zorg owns acceptance and any later received-copy commit |
| Context-lab | [Assurance capability feedback](../../context-lab/incoming/agp-assurance-capability-feedback.md) | Existing incoming channel; no acknowledgment of this feedback or acceptance of its requirements is claimed |

The [Zorg source](reviews/admission-use-lifecycle-fit-response.md) and [context-lab source](reviews/context-lab-assurance-feedback.md) remain unchanged, including their historical preparation-status lines.\
Each placed copy adds a delivery cover and rebases only Markdown link destinations to absolute shared-workspace paths.\
Removing the cover and reversing the four Zorg or five context-lab link substitutions recovers the respective source byte for byte.

Before placement, context-lab had updated its [direct-peer response](../../context-lab/incoming/agp-direct-peer-assurance-contract-response.md) to map the retry and answer-source controls to its public contract at `fe0a7b0092b477dc3424ff3ac1a239fd9d57a266`.\
The delivery cover acknowledges that the mapping request has already been answered and asks for no repeated mapping.\
The complete updated reply, SHA256 `7c43b3f23f7f307285e9cad7d004d0c019521b9fed5d264e13693af46a5cccfc`, is retained in the [handoff checks](reviews/upstream-feedback-handoff-checks.json).\
Its broader support claims, retry/resume and invalid-setting behavior, eligibility, complete accounting and byte/whole-run limits still require a scoped AGP compatibility assessment; the incoming update is not that assessment.

The board now records placement, removes the answered delivery question and identifies the refreshed mapping as the next B51 review input.\
B6 needs no repeated consumer fit study; AGP's remaining lifecycle assurance, ratification, carrier/client choices and verified implementation remain open.\
B53 retains its zero-call stop and unconfirmed provider destinations; B56's separate runtime-acceptance gap, all scores and build-order positions remain unchanged.

The handoff checks retain source/delivery identities, exact transformations, baseline and final documentation results and preservation measurements.\
The baseline documentation suite has fourteen passes and one pre-existing absolute-link failure; supplementary destination-aware checks do not waive it.\
No prior source, review, owner reply or contract is rewritten, and this step performs no product execution, model/provider call, new review agent, staging, commit or push.

Mechanics: preserve the approved feedback, add current delivery covers and verify reversible link rebasing through each owner's intake path.\
Rationale: owners receive usable correspondence without being asked to repeat a mapping that has already arrived.\
Consequence: treating placement or a refreshed capability claim as verified compatibility would bypass the remaining AGP decisions.

---

### 4.69 Context-lab assurance compatibility correction handoff

The director selected delivery of the [reviewed correction request](reviews/context-lab-assurance-correction-request.md) with "continue".\
The request is now [placed in context-lab's incoming folder](../../context-lab/incoming/agp-assurance-correction-request.md); placement does not imply recipient acknowledgment or acceptance.

The request incorporates the latest [capability reply](../../context-lab/incoming/agp-assurance-capability-feedback-response.md) and the read-only compatibility assessment at context-lab revision `d17feb9ea7cec067176804e7e3c25f92281e6d04`.\
The remaining owner requests concern judge eligibility and replay evidence, the 24 KiB UTF-8 bound before extraction, and retry consistency or explicit supported restrictions.\
The already-answered retry/answer-source mapping is not requested again, and source findings are not runtime proof.

The source is preserved, including its historical "local draft, not sent" marker.\
The placed copy adds a dated delivery cover and rebases only ten Markdown link targets; reversing those substitutions and removing the cover recovers the source byte for byte.\
The [handoff checks](reviews/context-lab-assurance-correction-handoff-checks.json) record source/delivery identities, destination resolution, owner-reply preservation and repository HEAD/staged-state checks.

B51 now records completed compatibility review and delivered corrections, without changing its priority or selecting an execution revision.\
AGP can next prepare its fixed outcome/vote accounting and judge-payload mapping while owner correction evidence is outstanding; that draft is not an executable pack or model-run approval.\
No product code, execution setting, prior reply or reviewed source is changed, and this handoff performs no product execution, model/provider call, new review agent, staging, commit or push.

Mechanics: preserve the reviewed request and verify the delivered copy's reversible link rebasing.\
Rationale: context-lab receives the unresolved compatibility corrections while AGP retains its own acceptance and accounting responsibilities.\
Consequence: neither inbox placement nor a capability claim clears B51's execution, assurance or adoption gates.

---

### 4.70 Direct peer assurance acceptance mapping

The director selected preparation of AGP-owned outcome/vote accounting and judge-payload mapping with "continue".\
The [local draft](reviews/direct-peer-send-assurance/direct-peer-acceptance-mapping.md) derives from the frozen protocol and corrected key; it is not an executable context-lab pack, implemented acceptance checker or independent assurance result.

The mapping enumerates six reader cells, 72 question outcomes and 144 expected other-family vote slots before attaching public records.\
It preserves the difference between an eligible missing answer scored zero and unestablished eligibility or a required missing judgment leaving no comparison verdict.\
It maps three score definitions, seven common rules, twelve prompts, 53 required decisions, 35 wrong conclusions and seven additional judge-guidance items, keeping private role/order information out of the proposed payload.

Two execution bindings need explicit review: the frozen instructions permit question identifiers as headings without fixing level three, while the reviewed parser contract names `### <answerHeading>`; and rubric fields alone do not establish delivery of each unit's assigned-text support.\
The draft also leaves diagnostic serialization, extraction edge cases, response truncation, profiles and resource policies open rather than selecting them implicitly.

Context-lab committed correction work at `49d7ccbe6bf3a418ae3a69861a3b0e6e374be495` during preparation.\
Its commit description identifies judge eligibility/replay, response bounds and retry/resume corrections; this step inspected that description, not the changed implementation or its runtime behavior.\
No separate correction response was present at the inbox check; the existing capability replies were unchanged.\
B51's next move is scoped review of the owner's committed corrections and any accompanying response against the placed request and this draft, not waiting without preparing or accepting the commit's closure claims.

The [author checks](reviews/direct-peer-send-assurance/direct-peer-acceptance-mapping-checks.json) retain exact commands, source identities and measured results.\
The existing packet suite passes all twelve tests; local inventory checks account for every question and family slot, and arithmetic checks cover six comparison examples and three quotation caps.\
Measured source payloads are 35,902 and 52,784 bytes before any harness wrapper; neither measurement proves actual runtime delivery or model-context fit.\
The new draft passes the semantic-line-break check after formatting; these checks are author evidence, not fresh-reader documentation assurance.

The frozen packet, prior requests/replies and normative AGP contracts remain unchanged.\
Only the new draft/check record, four current B51 board passages and this append belong to this step; scores, priorities and the separate B6/B53/B56 gates are unchanged.\
No consumer repository edit, product execution, model/provider call, new review agent, staging, commit or push was performed by this step.

Mechanics: preserve the instrument and make its accounting, source projection and unresolved execution bindings explicit.\
Rationale: the owner correction can now be assessed against AGP's complete acceptance obligations, including absent evidence.\
Consequence: numeric results from a narrower parser, incomplete judge context or missing records must not become assurance for Zorg's required AGP changes.

---

### 4.71 Context-lab assurance correction review and follow-up

The director selected placement of the consolidated correction-review response with "continue".\
The [response is placed in context-lab's incoming folder](../../context-lab/incoming/agp-assurance-compatibility-review.md); placement does not establish acknowledgment or acceptance.

| Review input or receipt | Identity |
|---|---|
| Reviewed context-lab revision | `97d08d2ca1dbe378f634bf45a438474f228b613d` |
| [Owner correction response](../../context-lab/incoming/agp-assurance-compatibility-correction-response.md) SHA-256 | `eb2383187cdf8d05ccf5da7b0f3e9dbca40d1ff63da7b7a839a974535b84d904` |
| Placed AGP response SHA-256 | `b4838c8f5bc777c28bf851b2094f72726361eb460bf15913eb201409809057d3` |

The static review supports the judge eligibility gate, returned-outcome replay records, bounded answer extraction and retained effective retry policy.\
The owner reports 331 passing tests; AGP did not rerun the product suite or reproduce the failure paths.

| Remaining item | Source-derived finding or open binding |
|---|---|
| Interrupted reader accounting | The resume guard searches cell-prefixed workspace/invocation names, while execution creates opaque names; the new test manufactures the searched prefix, so single-attempt continuation remains unestablished |
| Response surface | Answer extraction uses bounded text, while code-measure hooks receive raw final text; request a consistent supported surface or an explicit restriction |
| Judge replay | Invocation rejection can leave only job-level failure without that attempt's map; request retained metadata or an explicit missing-evidence exclusion |
| CLI validation | A present retry-limit flag without a following value is treated as absent; request rejection |
| Heading and judge context | Settle the permitted-heading/parser mismatch and demonstrate per-unit assigned-reading support and diagnostic interpretation through public interfaces |

The handoff preserves source facts separately from AGP implications and requested corrections.\
It asks the owner to resolve or qualify the remaining items without repeating delivered mappings, silently changing AGP's frozen rules, or introducing a private judging path.\
AGP retains population accounting, quotation checks, adoption arithmetic, execution-profile/resource choices and separate execution approval.

Author checks: all 17 local links in the placed response resolve, including its heading anchor; semantic-line-break, ASCII and whitespace checks pass.\
The cited implementation, tests and operations document match the reviewed commit.\
These are document/source checks, not fresh-reader documentation assurance or independent runtime acceptance.

Four current B51 board passages now record completed source review and placed follow-up; its score, open status and build-order position are unchanged.\
Earlier verification entries, the frozen packet, prior correspondence and pre-existing implementation/design work are preserved.\
No product code, execution setting, model/provider call, new review agent, staging, commit or push belongs to this handoff.

Mechanics: place one consolidated source-pinned response and reconcile the board's current-state references.\
Rationale: the owner receives the residual correction and binding questions while AGP keeps its acceptance duties.\
Consequence: an incomplete continuation or mismatched scoring surface cannot silently become assurance for Zorg's required AGP contract.

---

### 4.72 Disposition repair candidate publication

The director selected the recommended repair-only candidate publication with "continue".\
The approval covers a separate source branch and qualified Zorg handoff, not promotion to `main`, a package release, deployment or runtime acceptance.

| Publication item | Measured identity |
|---|---|
| Remote branch | `repair/disposition-write-observation` |
| Published candidate | `2f26eeb7a01e79a5ee0690b2b8ace32cd8c7fa2c` |
| Sole parent and unchanged remote `main` | `f16266aaafa66f6301d7afbf09c55e3a1f990274` |
| Original reviewed repair | `ae83dc3574c7e84549b9e7097bc077495f8ac3b9` |
| Unchanged local `main` tip at publication | `a09e4bcda9d668b52ff3212c3813fad30fa7ac10` |

The new commit contains exactly `packages/node/src/dispositions.ts`, `packages/node/test/contract/disposition-write-observation.test.js` and `packages/node/test/README.md`.\
The complete source-to-candidate comparison outside `docs/` is identical; the candidate's complete parent-to-tip delta is only those three paths.\
This is content equivalence, not commit ancestry or a new independent review.\
The nine preceding documentation/assurance commits, 32 later local commits and uncommitted work are not included.

An isolated worktree was installed from the lockfile with lifecycle scripts disabled.\
On Node `v24.12.0`, npm `11.6.2` and TypeScript `5.9.3`, the candidate build exits zero and all four fulfilled-write observation checks pass without failures, cancellations or skips.\
The test-ownership document passes the five repository style checks, and the candidate tracked/untracked status is clean.\
These are author checks of this candidate, not the earlier eighteen-check run, a full regression result or runtime failure acceptance.

The push created only the named branch, using an absent-ref lease and disabling automatic tag following.\
A subsequent remote read on 2026-10-18 confirms that branch at the candidate revision and `main` at the unchanged parent.\
No existing branch history was rewritten.\
The [publication evidence](reviews/disposition-repair-publication.json) retains the exact commands, working directory, runtime, exit statuses and raw results.

The [Zorg publication note](../../zorg/upstream/agp-disposition-repair-candidate-publication.md) is placed in its existing upstream correspondence directory.\
Placement establishes availability of the note, not Zorg acknowledgment or adoption.\
It preserves the [earlier status handoff](../../zorg/upstream/agp-disposition-write-status.md) and does not request a consumer pin change, workaround removal, new fault reproduction or reopening of its closed Delta 1.

`B56` remains open at `I2`/`P2` and first in build order.\
The [existing acceptance requirements](#437-disposition-repair-independent-source-review-and-acceptance-requirements) still require failure-callback behavior, duplicate-safe teardown, process survival, replacement-session isolation, a declared release-regression scope and a distinct acceptance judgment.\
Candidate publication does not satisfy those gates.\
The board and current `MX24` row now distinguish candidate availability from runtime acceptance; earlier checkpoints retain their historical publication statements.

Tracking validation: all eleven board/record checks and all five style rules across the three edited Markdown files pass after correcting sentence-break formatting in the new text.\
All seven new local links resolve; the other 77 pre-existing dirty AGP files, earlier verification content, both existing repository tips and both indexes are preserved.\
The local tracking edits, evidence file and Zorg note remain uncommitted and are not part of the published candidate.

Mechanics: publish one source-identical repair commit on a separate branch and verify the remote ref.\
Rationale: Zorg can identify the available candidate without coupling it to unrelated assurance work or implying a verified release.\
Consequence: neither candidate availability nor fulfilled-write checks can close the unmeasured failure-handling requirements.

---

### 4.73 Browser peer scale amendment refinement

The director selected revision of the [scale amendment](reviews/browser-peer-scale-amendment.md) after its source review.\
This authorizes the draft refinements, not ratification, a numerical envelope, changed defaults or implementation.

Source-review baseline: local AGP `a09e4bcda9d668b52ff3212c3813fad30fa7ac10`, with the existing uncommitted work preserved.\
The reviewed [Zorg requirements](../../zorg/upstream/agp-requirements-response.md) were last changed at `56144bf56f326651f3dac89a5945fc28b66c0a9e`; their declared connection model and proposed workload are consumer inputs, not runtime observations.

| Refinement | Evidence and effect |
|---|---|
| Useful capacity | `derivePeerExport` in `packages/core/src/routing.ts` suppresses candidates beyond `maxRoutesPerSnapshot` with `CAPACITY`; keeping sessions established and resources bounded cannot establish that the workload's required routes and exchanges are usable |
| Reference workload | Zorg declares shared-worker connection sharing per application, identity and hub within worker scope; its initial proposal is one hub with 19 peers, 30 changes per peer per five seconds, application fan-out and a one-second reconnect wave, not a hundreds-of-peers measurement or selected envelope |
| Acceptance dimensions | Separate idle occupancy, active service, reconnect and recovery cases; include fan-out and aggregate ingress/egress, and distinguish useful service within the agreed envelope from bounded refusal beyond it |
| Current priorities | The draft no longer assigns build order or describes the earlier Zorg inputs as newly awaiting review; the board and each mechanism's own gates retain those responsibilities |

Correction to the earlier draft: "Remains first: its correctness finding exists at small scale too." described `B53` as first in build order.\
That ordering is stale: the current board places `B56` first and `B53` second.\
The replacement preserves the small-scale correctness obligation and its independence from scale ratification without duplicating a priority list.\
The earlier dated verification checkpoints, including section 4.27, remain historical records.

The proposed replacement retains the original deployment direction and adds the sentence: "Within that envelope, the required routes and message exchanges must remain usable under AGP's contract."\
It selects neither a numerical throughput target nor a stronger delivery guarantee.\
`VISION.md` and `DECISIONS.md` remain unchanged; peer count alone does not select route deltas, an authentication mechanism or a browser-specific contract.

`B54` remains open at `I3`/`P3` and third in build order.\
Next is `M2` fresh-reader comparison against the prior confirmed intent, followed by director ratification or revision.\
The reference envelope must then be agreed with Zorg before capacity budgets and support claims can be justified.\
No capacity experiment, independent assurance verdict, outbound Zorg response, commit or push is part of this revision.

Author validation: all thirteen board, record and architecture checks pass; all five repository style rules pass across the three edited Markdown files.\
All 516 local references in those documents resolve; the other 77 pre-existing dirty files, prior board and verification content, repository tip and index are preserved.\
The [revision evidence](reviews/browser-peer-scale-revision-checks.json) retains the exact commands, raw output, prior draft and draft hashes for comparison.\
These checks establish document consistency, not useful capacity or independent assurance.

---

### 4.74 Browser peer scale fresh-reader preparation

The director selected preparation of fresh-reader assurance after the scale-amendment revision.\
The [prospective packet](reviews/browser-peer-scale-assurance/browser-scale-assurance-preparation.md) compares the earlier scale statement with the four proposed sentences inside identical vision and confirmed-intent context.\
It is preparation only: no commit, independent-agent invocation, scored comparison, provider selection, spending, implementation or ratification was performed.

The [input manifest](reviews/browser-peer-scale-assurance/browser-scale-input-manifest.json) pins the original source bytes, exact projections, author questions/key and preparation guidance.\
AGP source remains `a09e4bcda9d668b52ff3212c3813fad30fa7ac10`; the amendment source is identified by its unchanged content hash.\
The complete vision, selected confirmed-intent section and complete amendment are retained as separate snapshots; no existing source or earlier assurance packet is rewritten.

| Preparation fact | Scope and limit |
|---|---|
| Eight questions, four controls | Purpose, uniform node, delivery duties, security and authority remain testable alongside scope, useful service, quantity mappings and performance boundaries |
| Reading-specific answer key | A faithful old-scope answer or justified absence can receive full credit; changing desired deployment scope cannot manufacture a comprehension win |
| Six proposed reader cells, 48 question outcomes and 96 other-family vote slots | Three distinct families per reading, with all missing outcomes retained; profiles and execution are not selected |
| Reader payloads of 21,210 and 21,648 UTF-8 bytes | Reading plus common instructions/questions, below the proposed 65,536-byte bound; harness wrappers and actual model context limits remain execution checks |
| Same 24,576-byte response budget proposed | No enforcement claim; overflow, extraction, completion, memory and spending require a validated public execution binding |

The candidate reading contains only the proposed normative wording, not the amendment's explanatory envelope table, Zorg's workload or current implementation limits.\
The key does not require those withheld facts.\
The strict-improvement criterion is prospective and must itself be reviewed before use; an all-tie result supplies no improvement claim, and neither a comparison result nor a desired target establishes runtime capacity.

Context-lab's [new owner response](../../context-lab/incoming/agp-assurance-compatibility-review-response.md) reports corrections at `adf4b465f757eb09c1e74ee77f3dc3b6277512a0`, including heading extraction and assigned-reading delivery.\
The reply and revision identity were read, but no implementation-level acceptance of those claims was performed in this preparation.\
Those inputs remain available for the existing owner-correction review; this packet cannot inherit execution readiness from them or silently add a private evaluator.

Author-side validation passed: 12 packet-integrity tests, 13 board/record/architecture checks and all five documentation rules across the four changed Markdown files.\
The local-reference check found no broken targets or anchors; whitespace checks passed.\
The [raw author checks](reviews/browser-peer-scale-assurance/browser-scale-preparation-checks.json) also establish that HEAD, the index, normative sources and all 79 other pre-existing dirty files are unchanged; inverse-content checks limit the tracking edits to four board rows, the current `MX22` row and this new section.\
These checks establish preparation integrity, not independent key quality, execution readiness or fresh-reader assurance.

`B54` remains open at `I3`/`P3` and third in build order.\
The next gate is approval for a scoped local packet commit, followed by independent key/protocol audit before scored readers.\
Public execution binding, resource approval, the comparison itself, director ratification and a joint operating envelope remain separate obligations.

---

### 4.75 Browser peer scale key audit and correction

After section 4.74, the thirteen-file source packet was committed locally at `94ace293ad3ffc60fa048ac6f963d37d6c618314`.\
A fresh, independent, read-only key audit returned FAIL; the [original report](reviews/browser-peer-scale-assurance/browser-scale-key-audit-01.txt) is retained verbatim.\
Its eight question-specific requirements were substantively supportable for both readings, but two protocol defects blocked scoring.

| Finding | Author correction |
|---|---|
| Controls-only non-regression allowed all four scale questions to regress behind one control gain | Protect every question Q01 through Q08; retain the existing candidate floor and at least one strict question gain |
| Required judge prose revealed original/proposed treatment mapping | Neutralize that prose and explicitly project complete applicable grading content without private roles, history or the other reading's branch |

The review's numerical example is a logical counterexample, not observed reader data.\
The [correction record](reviews/browser-peer-scale-assurance/browser-scale-key-correction.md) preserves the former claims and explains the repair; [numeric conditions](reviews/browser-peer-scale-assurance/browser-scale-comparison-rule.json) govern invented test fixtures, not actual reader outcomes.\
An all-tie result still establishes no comprehension improvement, and faithful earlier-policy answers remain eligible for full credit.

The [judge-key projection](reviews/browser-peer-scale-assurance/project-browser-scale-judge-key.mjs) retains scoring, common rules and every applicable requirement, wrong conclusion and grounding excerpt.\
The protocol requires exact per-question delivery from those retained projections; the pure projection is not proof of live delivery or isolation.\
Execution binding, eligibility/extraction, resource settings and separate execution approval remain prerequisites, not implied successes.

Author-side packet validation passed: 24 checks covering artifact identity, original projection fidelity, judge-key field fidelity, known wording disclosures and numerical regression cases.\
The [correction checks](reviews/browser-peer-scale-assurance/browser-scale-key-correction-checks.json) retain the new checks separately from the unchanged historical preparation evidence.\
The source readings, questions, reader instructions, scale proposal, normative sources and unrelated work remain unchanged.

The author repair does not close the original independent FAIL.\
`B54` remains open at `I3`/`P3` and third in build order; a scoped correction commit and independent recheck precede scored readers.\
No commit, push, independent re-review, scored comparison, provider call, runtime change or outbound project response was performed in this correction step.

**Subsequent commit checkpoint.**\
The director then selected the scoped local commit, producing `a98c03fcfe3bfdaeee32c8943971ecc32eb4f898` with exactly eleven changed or new packet files.\
All twenty packet files in that commit match the validated working bytes; the original FAIL and both historical author-check records are retained unchanged.

Before committing, the 24 packet tests, 13 record checks, four-file documentation check and whitespace check passed again.\
After committing, the index is empty and the 81 previously unrelated or shared-tracking dirty paths remain uncommitted; no working-file bytes were changed by the commit.\
The packet's uncommitted/pending-commit labels describe their capture point; this checkpoint records the Git transition without rewriting those inputs.

Only the local-commit prerequisite is now satisfied.\
One fresh independent, read-only recheck of the committed correction is the next proposed action; no re-review, scored readers, push or external project contact occurred in this commit step.\
The board and this verification checkpoint remain local with their earlier uncommitted history.

---

### 4.76 Browser peer scale key recheck and execution readiness

One fresh, non-author, read-only auditor returned PASS for the complete corrected packet at `a98c03fcfe3bfdaeee32c8943971ecc32eb4f898`.\
The [full report](reviews/browser-peer-scale-assurance/browser-scale-key-recheck-02.txt) is retained unchanged with [invocation and preservation evidence](reviews/browser-peer-scale-assurance/browser-scale-key-recheck-checks-02.json).\
Both original protocol blockers are resolved at that revision, and all eight keys are supportable for both readings; the original FAIL remains historical evidence.

This is static key/protocol assurance, not a scored comparison, four-input review, execution authorization, ratification or capacity certification.\
The review's before/after check found all 103 compared working files unchanged, including the 20 committed packet files and 81 pre-existing dirty paths.

The [public-capability assessment](reviews/browser-peer-scale-assurance/browser-scale-execution-readiness.md) finds scored execution NOT READY.\
Context-lab now documents heading extraction, bounded measurement, assigned-reading delivery and corrected interrupted-reader/throwing-judge accounting.\
Those owner claims do not establish this packet's exact reading-specific key delivery, extraction/eligibility, resource bounds or retention.

Next: resolve the public pack binding and AGP acceptance map without model calls, routing an unexpressible requirement to the component owner.\
A two-experiment composition is a candidate public binding, not an approved or validated design.\
Do not substitute the generic comparator or the older direct-peer controls-only rule for this packet's all-question acceptance predicate.

The [author checks](reviews/browser-peer-scale-assurance/browser-scale-execution-readiness-checks.json) retain packet, record, documentation, link and scope-preservation results separately from the independent verdict.\
All 20 original packet files, normative sources and unrelated work remain unchanged; only four board entries, the current `MX22` row and this checkpoint change the shared tracking records.\
`B54` remains open at `I3`/`P3` and third in build order.

No scored runs, provider calls, new agents, implementation changes, sibling writes, commit or push occurred in this recording/readiness step.\
The board and new evidence remain local and uncommitted; the previously recorded local upstream reference is unchanged.

---

### 4.77 Browser peer scale public execution mapping

The [local public-mapping draft](reviews/browser-peer-scale-assurance/browser-scale-public-binding.md) proposes one pack with two one-arm experiments and reading-specific scenarios.\
Each scenario keeps all eight questions together; both experiments share reader instructions, question prompts and the eventual three family profiles.\
Complete applicable entries map to the existing string-valued `key` field, with the same scoring definitions and common rules in `judgeInstructions`.

The model-free author projection round-trips all 16 entries and both common grading objects without dropped fields.\
It derives six planned reader cells, 48 question outcomes and 96 vote slots; proposed reader source content is 20,780 and 21,218 UTF-8 bytes before wrappers/canaries.\
These measurements establish representability and cardinality, not a validated pack, emitted prompt or runtime behavior.

Context-lab's public contract leaves paired result-status preregistration and model-free inspection of exact assembled prompts unestablished for this composition.\
The draft consolidates those questions with delivery/masking/retry evidence requirements, requesting a contract answer only.\
It is not yet placed with the owner; no undocumented field, arbitrary `variation.difference` value, placeholder profile or private runner is introduced.

The [author checks](reviews/browser-peer-scale-assurance/browser-scale-public-binding-checks.json) retain projection, source identities, ordinary local validation and scope preservation.\
The 20 committed packet files, previous recheck/readiness evidence, normative sources and other pre-existing work remain unchanged.\
`B54` remains open at `I3`/`P3` and third in build order; placing the bounded owner questions is the next proposed move.

No context-lab command, runtime/provider call, scored run, new agent, sibling write, commit or push occurred.\
The independent key/protocol PASS is unchanged; pack validation, execution resources, scored assurance and scale ratification remain separate prerequisites.

---

### 4.78 Browser peer scale public binding handoff

The director selected placement of the prepared public-binding questions with "continue".\
The [request](../../context-lab/incoming/agp-browser-scale-public-binding-request.md) is now in context-lab's existing local `incoming` folder for a contract answer only.

The three questions concern paired preregistration, model-free inspection of assembled prompts, and exact delivery with replayable evidence.\
The placed copy preserves the [prepared mapping](reviews/browser-peer-scale-assurance/browser-scale-public-binding.md), with only the title, recipient, placement/source wording, reply instruction and local link destinations adjusted.\
No experiment requirement, question, key, scoring rule or proposed field mapping changed.

The [handoff checks](reviews/browser-peer-scale-assurance/browser-scale-public-binding-handoff-checks.json) retain exact source/delivery identities, reversible placement/link changes and local validation.\
Readback establishes file placement, not maintainer acknowledgment, contract acceptance or execution readiness.\
The source draft and section 4.77 retain their historical pre-delivery state.

The 20 committed packet files, previous review/readiness/mapping evidence, normative sources and unrelated work remain unchanged.\
Four current board entries and the current `MX22` row now name the owner-reply dependency; `B54` remains open at `I3`/`P3` and third in build order.

Mechanics: ask the component owner to identify the supported public contract before pack construction.\
Rationale: representable content is not proof of exact delivery or paired-run eligibility.\
Consequence: a reply must be assessed against the frozen experiment; it cannot silently change that experiment or authorize execution.

No implementation, context-lab command, provider setup, model call, probe, scored run, new agent, commit or push was part of this handoff.\
The new incoming request and AGP handoff/tracking changes remain local and uncommitted.

---

### 4.79 Disposition repair recurrence and candidate acceptance status

The director selected the `B56` acceptance and release assessment with "continue"; no promotion to `main` was selected.\
The [checks and retained inputs](reviews/disposition-repair-acceptance-checks.json) record exact revisions, source hashes, commands, runtime, exit statuses and raw output.

#### Measured evidence Tier 2

Zorg's [recurrence report](../../zorg/upstream/zorg-agp-disposition-write-recurrence.md) is committed at `707a8d5530f2cfc067ea3194f2f5ab4d23154608`.\
Its retained checkout log identifies AGP `f16266aaafa66f6301d7afbf09c55e3a1f990274`; the [test log](../../zorg-eval-runs/delta-4/stage-5/verify-attempt-3/logs/zorg-test.log) records a hub subprocess exiting 1 instead of 0, with `CHANNEL_TERMINAL` through the disposition timer and `writeControl`.\
That run reports 150 passing tests and one failure; the separate seven-test retry passes on the same baseline, not the repair candidate.

A fresh detached checkout tested `2f26eeb7a01e79a5ee0690b2b8ace32cd8c7fa2c`, whose sole parent remains the published baseline.\
Its complete parent-to-tip change is the same three repair paths; content outside `docs/` matches the originally reviewed repair.\
The older temporary checkout no longer exists; its stale registration was not repaired or removed.

| Check on the exact candidate | Result and scope |
|---|---|
| Offline lockfile installation with lifecycle scripts disabled | Exits zero; no dependency change |
| Build | Exits zero on Node `v24.12.0`, npm `11.6.2`, TypeScript `5.9.3` |
| Fulfilled-write observation, public types and valid relay cases | Eleven selected tests pass |
| Healthy binding release, correlation and disposition surface | Seven selected tests pass |
| Remote ref readback | Repair branch remains at the candidate; `main` remains at its parent |

The defined regression subset excludes unsuccessful control writes, teardown races, replacement-session failures and the WebSocket shutdown recurrence.\
It also excludes the other package, integration, topology, resilience, CLI and system tests; eighteen selected passes are not a full-suite result.

#### Author assessment Tier 3

Zorg's evidence strengthens the existing `B56` finding and confirms the local correspondence was received.\
It establishes an actual hub executable failing during verification, not a deployed-production incident.\
The claim that the candidate would have preserved that process remains an inference; the baseline failure and its passing retry supply no candidate recovery evidence.

| Existing acceptance requirement | Current assessment |
|---|---|
| Failure callback receives the correct controller and cause | Source support only; failed-write runtime evidence remains unestablished |
| Duplicate-safe exact-session teardown | Source support only; runtime evidence remains unestablished |
| Process survival after an unsuccessful disposition write | Baseline process failure is now captured; candidate survival remains unestablished |
| Isolation of a replacement session from an old session's late failure | Source support only; runtime evidence remains unestablished |
| Release-regression scope | The non-fault subset and exclusions are explicit; complete release coverage is not established |
| Candidate provenance and distinct judgment | Provenance is complete for these local checks; no distinct runtime acceptance judgment is supplied |

Release assessment: not ready for `main`; runtime acceptance has no verdict.\
The four missing runtime properties require existing candidate-specific evidence before a reviewer can assess them; another source review or healthy-test rerun cannot substitute for it.\
No new crash-triggering reproduction was created or run, and this assessment does not request one from Zorg.

`B56` remains open at `I2`/`P2` and first in build order; browser design and context-lab are not dependencies of this repair.\
Zorg's future pin change and consumer checks remain separate from AGP acceptance and publication.\
No implementation, test source, prior verdict, normative contract or other proposal changed, and no sibling message, new agent, model call, commit or push occurred.

Mechanics: bind each observed result to its tested revision and compare it with the pre-existing acceptance requirements.\
Rationale: evidence that the old release fails is not evidence that the candidate recovers.\
Consequence: retain the release hold without weakening the requirements or treating the unrelated local backlog as a repair-only publication.

---

### 4.80 Disposition repair main publication for consumer verification

On 2026-10-20 Australia/Melbourne, the director instructed "publish on main so zorg can verify" after the remaining acceptance gaps were stated.\
This selects publication of the existing repair before runtime acceptance; it does not supply an acceptance verdict or close `B56`.\
Section 4.79 remains the historical pre-publication assessment.

The published revision is `2f26eeb7a01e79a5ee0690b2b8ace32cd8c7fa2c`, whose sole parent is the previous remote main `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
The complete three-file delta was read before publication: `packages/node/src/dispositions.ts`, `packages/node/test/README.md` and `packages/node/test/contract/disposition-write-observation.test.js`.\
It contains the existing rejection-observation repair and fulfilled-write registration guards, with no unrelated local work.

Executed from the AGP repository root, exiting zero:
```text
git push origin 2f26eeb7a01e79a5ee0690b2b8ace32cd8c7fa2c:refs/heads/main
To https://github.com/apnex/agp.git
   f16266a..2f26eeb  2f26eeb7a01e79a5ee0690b2b8ace32cd8c7fa2c -> main
```

A subsequent `git ls-remote origin refs/heads/main refs/heads/repair/disposition-write-observation` exited zero and returned:
```text
2f26eeb7a01e79a5ee0690b2b8ace32cd8c7fa2c	refs/heads/main
2f26eeb7a01e79a5ee0690b2b8ace32cd8c7fa2c	refs/heads/repair/disposition-write-observation
```

Only the existing repair commit was pushed; no new commit, force push, rebase, reset or AGP runtime test was performed.\
Local `main` remains at `a98c03fcfe3bfdaeee32c8943971ecc32eb4f898`; after the push its ancestry is 44 commits ahead and one behind `origin/main`.\
The local tracking edits are not part of the published commit, and unrelated unpublished work remains local.

Zorg can now reference the published repair revision.\
The earlier build and eighteen selected non-fault passes remain the [recorded evidence](reviews/disposition-repair-acceptance-checks.json); this publication adds no failure-recovery evidence.\
The four runtime properties and distinct acceptance judgment in [section 4.37](#437-disposition-repair-independent-source-review-and-acceptance-requirements) remain open, so `B56` is published but not closed.\
No reproducer, test instructions or sibling correspondence were sent as part of publication.

Mechanics: advance only the remote main ref to the inspected repair commit and read back both published refs.\
Rationale: the director selected a consumable repair revision while keeping the evidence limitations visible.\
Consequence: consumer access is unblocked without representing publication as runtime acceptance.

---

## 5. Modular test architecture

### 5.1 Ownership layout

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
  contract/       public types, lifecycle, sessions, forwarding, errors, teardown
  fixtures/       compile-only public consumers
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

### 5.2 Self-description and orthogonality

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

### 5.3 Fixtures and timing

- A fixture contains immutable input and expected public output only.
- Valid fixtures never double as negative fixtures with fields mutated in
  hidden setup.
- Exact JSON Pointer, failed keyword, semantic rule ID, error code, transition,
  and close outcome are asserted where applicable.
- Manual clocks own protocol time. Named wall-clock deadlines bound
  test-harness event, barrier, and process waits; they never decide success.
- A timeout is never the positive oracle; an event, callback, packet, state
  revision, or process record is.
- System tests run in isolated clean processes. They do not share ports,
  mutable nodes, route state, or ordering assumptions.

---

## 6. Mechanics, rationale, and consequence

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
