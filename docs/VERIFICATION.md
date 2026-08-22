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
Message volume exercises ordering, breadcrumb churn, return-token cycling, and egress backpressure along one path.\
Route volume exercises Adj-RIB-In and candidate size, selection cost, export recomputation across every peer, and the encoded size of an authoritative snapshot.

Concurrency reaches a bound that sequential traffic never contends for.\
The bound a burst actually meets is the breadcrumb reservation rather than an egress queue, because a breadcrumb is expiring rather than delivery-consumed: a successful send leaves one behind, so a burst accumulates them while a queue drains between admissions.

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
| `MX3` | A stream saturates the event loop. A one-millisecond interval timer fires about twelve times across a whole run, so the loop drains roughly that often and the synchronous blocks between drains average around twenty milliseconds. A block of that size moves any deadline sharing the loop, which is the mechanism that tore down healthy sessions before `D21`, and it starves any event subscriber that touches the macrotask queue. Six operations commits land per delivered message. | Open, reduced, consequence demonstrated |
| `MX4` | A node hop costs far more than the carrier beneath it: a raw WebSocket round trip is about 75 microseconds against roughly half a millisecond per message through a node pair. Unexplained, and not a breach of anything. | Open, opportunistic |

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
What is not yet explained is why six commits are needed per delivered message, and that is the next thread rather than a conclusion.

`MX3` and `MX4` are separated because confirmed intent scores them differently.\
There is no performance target, so a cost that is merely large is not a defect and `MX4` is an opportunity rather than an obligation.\
A stall is not merely a cost: it moves every deadline sharing the loop, and that is the exact mechanism by which a healthy session was torn down before `D21`.\
`MX3` is therefore chased as a latent correctness fault and `MX4` is taken when a way is found.

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
```

A sweep is a diagnostic instrument and deliberately not part of `npm test`.\
A failing cell reports that a combination broke, not which layer owns it, and section 2.1 requires a failure to name its owning layer.\
Use a sweep to find where to look, then reproduce what it found in a named file with a specific oracle.

A cell asserts only what every geometry must satisfy: it converges, it delivers, nothing is duplicated, and reachability survives the traffic.\
Shape-specific properties stay in named tests, because only a triangle test can assert that no exported path repeats a node and only a diamond test can assert an alternate candidate stays observable.

Measured cost: 30 loopback cells in about 4 seconds, 70 cells across all carriers in about 9 seconds, and roughly two minutes deepened.

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
4. **Prove the knob moved before believing the result.**\
   A control that varies nothing produces three identical readings and reads as a strong negative.\
   A parameter was passed to a harness that did not accept it, and the conclusion drawn was the opposite of the truth.
5. **Compare within one session, never across them.**\
   The same unchanged measurement read 525 microseconds per message and then 670 an hour later, and a sweep read 40 seconds and then 25.\
   An A and a B taken hours apart compare the machine, not the change.
6. **Climb the ladder, do not measure the whole.**\
   `scripts/latency-ladder.mjs` adds one layer per rung, so the rung where the milliseconds appear names the layer that owns them.\
   A single end-to-end number cannot do that, and chasing one produces hypotheses rather than causes.
7. **Sample event-loop lag underneath every measurement.**\
   In a single-process topology a slow path and a starved one look identical.\
   `test/support/loop-lag.js` separates them, and in `MX2` the lag was the finding.
8. **Profile before fixing.**\
   A processor profile named the function in one run, after reasoning had failed twice.\
   `node --cpu-prof` against one ladder rung is enough.
9. **Prove the cause before believing it.**\
   Disable the suspected path, measure again, and require the number to move.\
   Two suspects were eliminated this way before the third survived.
10. **Fix the shape, not the constant.**\
   A tenfold constant improvement on a quadratic is a longer fuse, not a fix, and it will read as success on every benchmark small enough to run in a test.
11. **Revert what cannot be shown to help.**\
   A change that is principled, small and unmeasurable is still machinery somebody must maintain and can get wrong.\
   Record the negative result so the next reader does not spend the same afternoon proving it again.

Measured cost of the instruments: recording an observation is about three nanoseconds, and advancing a counter about two.\
An instrument that perturbs what it measures makes every number taken through it unfalsifiable, so this bound is a requirement rather than a boast.

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
- Manual clocks own protocol time. Wall-clock deadlines are used only at real
  process/carrier boundaries as a test-harness failure bound.
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
