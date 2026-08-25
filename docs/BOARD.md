# AGP - board

The live, triaged set of legal next moves.\
It exists so a direction is selected rather than derived, and so a move not taken is a visible judgement rather than an omission.

Authored for director selection.\
Every item cites the record that evidences it.

---

## The contract between board and record

Every item cites a live record: a decision in [`DECISIONS.md`](DECISIONS.md), a deferred mechanism in [`design/mechanisms.md`](design/mechanisms.md), an exclusion or finding in [`VERIFICATION.md`](VERIFICATION.md), or a gate in [`GATES.md`](GATES.md).

An item with no citation is not a move, it is an opinion.\
A record row naming a board item must exist here, and this board must not disagree with the record about any item's state.

---

## Triage scale

Two orthogonal dimensions.\
**Order on the higher of the two, never on a blend.**

**Impact** - what it does to a user now.

| Level | Meaning |
|---|---|
| `I1` | Silent wrong result or data loss |
| `I2` | Observable failure a user must work around |
| `I3` | Degraded capability, correctly reported |
| `I4` | Internal only; no user-visible effect |

**Principle breach** - which standing commitment is violated.

| Level | Meaning |
|---|---|
| `P1` | An axiom or ratified decision is breached outright |
| `P2` | A gate or contract claims something untrue |
| `P3` | A stated intent is unimplemented but honestly recorded |
| `P4` | No breach |

Where the two disagree, that disagreement is the signal.\
An item that is `I4`/`P1` belongs early even though nobody feels it today, because a breached commitment keeps costing after present pain is gone.

---

## Triage ledger

| ID | Candidate | Impact | Breach | Evidence | Status |
|---|---|---|---|---|---|
| `B20` | Release expired label bindings, so a node can send more than 4096 messages in its life | `I1` | `P1` | [`MX5`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B21` | Stop discarding a rejectable promise on the inbound data path | `I1` | `P2` | [`MX6`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B22` | Measure throughput with each node in its own process | `I3` | `P3` | [`MX4`](VERIFICATION.md#46-open-findings-from-sweeps), [`VERIFICATION.md` section 4.9](VERIFICATION.md#49-chasing-a-timing-defect) | landed |
| `B24` | Give the equivalence line one declaration instead of two | `I4` | `P3` | [`VERIFICATION.md` section 4.9](VERIFICATION.md#49-chasing-a-timing-defect) | landed |
| `B25` | Give pre-shared keys a cross-process key exchange so that carrier can be isolated too | `I4` | `P3` | [`F08`](design/mechanisms.md) | landed |
| `B23` | Build the disposition design that removes the sustained send ceiling | `I2` | `P3` | [`D23`](DECISIONS.md#d23---delivery-disposition), [`MX7`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B26` | Let a ratified decision be recorded before it is built | `I4` | `P2` | [`GATES.md` section 2](GATES.md#2-gate-ax0---intent-applicability-and-knowledge) | landed |
| `B27` | Name a destination instance, not only an endpoint | `I3` | `P4` | [`D26`](DECISIONS.md#d26---destination-selection), [`destination-selection.md`](design/destination-selection.md) | landed |
| `B28` | Resolve a forwarding decision in one place instead of three | `I4` | `P3` | [`destination-selection.md`](design/destination-selection.md) | landed |
| `B1` | Implement `D19` credit flow control | `I1` | `P1` | [`MX1`](VERIFICATION.md#46-open-findings-from-sweeps), [`D19`](DECISIONS.md#d19---per-hop-credit-flow-control) | landed |
| `B14` | Name a reproduction for the route-ack expiry a stream provokes | `I2` | `P2` | [`MX2`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B16` | Project credit and timing into the operations plane | `I2` | `P1` | [`D20`](DECISIONS.md#d20---observability-of-bounded-resources-and-timing) | landed |
| `B17` | Derive the trace graph identifier set instead of hardcoding it | `I3` | `P1` | [`GATES.md` section 2](GATES.md#2-gate-ax0---intent-applicability-and-knowledge) | landed |
| `B18` | Explain the residual event-loop stalls under a stream | `I2` | `P3` | [`MX3`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B29` | Move per-message events off the operations stream | `I2` | `P3` | [`D24`](DECISIONS.md#d24---the-operations-stream-is-a-channel-not-a-ledger), [`MX3`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B30` | Stop traffic-rated session values advancing the canonical revision | `I3` | `P2` | [`D25`](DECISIONS.md#d25---a-revision-denotes-a-change-to-canonical-state), [`D10`](DECISIONS.md#d10---atomic-canonical-state) | landed |
| `B19` | Take the per-hop cost against the carrier, opportunistically | `I4` | `P4` | [`MX4`](VERIFICATION.md#46-open-findings-from-sweeps) | open |
| `B15` | Decide credit by the carrier rather than by configuration | `I3` | `P2` | [`D29`](DECISIONS.md#d29---credit-the-carrier-that-can-be-outrun), [`D19`](DECISIONS.md#d19---per-hop-credit-flow-control) | landed |
| `B2` | Reconcile the pause wording in `binding-websocket.md` with the code | `I4` | `P2` | [`MX1`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B12` | Split current and target architecture instants | `I4` | `P3` | [`ARCHITECTURE.md` section 12](ARCHITECTURE.md#12-owed-and-open) | held |
| `B3` | Machine-readable cell to mechanism mapping | `I4` | `P3` | [`VERIFICATION.md` section 4](VERIFICATION.md#4-coverage-register) | open |
| `B13` | Generate the package and dependency tables from the manifests | `I4` | `P3` | [`ARCHITECTURE.md` section 12](ARCHITECTURE.md#12-owed-and-open) | open |
| `B4` | Cost model for matrix cells | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | held |
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | [`X1`](VERIFICATION.md#48-excluded-combinations), [`F07`](design/mechanisms.md) | held |
| `B6` | Certificate and HTTP-authenticated WebSocket profiles | `I3` | `P3` | [`F07`](design/mechanisms.md) | held |
| `B7` | Route volume beyond the 256 snapshot ceiling | `I3` | `P3` | [`D4`](DECISIONS.md#d4---full-route-snapshots) | held |
| `B8` | Rewrite named geometry tests onto shared builders | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | held |
| `B10` | Author an enduring intent statement for AGP | `I4` | `P3` | [`ARCHITECTURE.md` section 10](ARCHITECTURE.md#10-scope-boundary), [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | landed |
| `B31` | Generate the code unions that are currently written twice | `I4` | `P2` | [`D3`](DECISIONS.md#d3---sovereign-contracts), [`sdk.md` section 3.1](design/sdk.md#31-schema-backed-dtos) | landed |
| `B32` | Give a closed domain a schema that is as closed as its type | `I3` | `P2` | [`D3`](DECISIONS.md#d3---sovereign-contracts), [`contracts.md` section 6](design/contracts.md#61-configuration) | landed |
| `B11` | Reconcile the scope boundary with the `F` series it is forked with | `I4` | `P2` | [`ARCHITECTURE.md` section 10](ARCHITECTURE.md#10-scope-boundary), [`F07`](design/mechanisms.md) | open |
| `B37` | Gate that a record citing a board item reaches the board | `I4` | `P2` | [`BOARD.md` section 1](BOARD.md#the-contract-between-board-and-record), [`ARCHITECTURE.md` section 1](ARCHITECTURE.md#1-status-and-authority) | landed |
| `B33` | Gate that a ratified decision reaches the vision it changes | `I4` | `P2` | [`VISION.md`](../VISION.md#authority), [`DECISIONS.md`](DECISIONS.md) | landed |
| `B34` | Give confirmed intent one subsection numbering | `I4` | `P2` | [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | open |
| `B35` | Bound the tests that await an event with no deadline | `I4` | `P4` | [`TESTING.md`](TESTING.md) | held |
| `B36` | Gate the self-consistency this board declares | `I4` | `P2` | [`BOARD.md` section 1](BOARD.md#the-contract-between-board-and-record) | landed |
| `B38` | Catch a direction change that carries no decision number | `I4` | `P2` | [`VISION.md`](../VISION.md#authority), [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | landed |
| `B39` | Reconcile the architecture with what has been built since it was written | `I4` | `P2` | [`ARCHITECTURE.md` section 1](ARCHITECTURE.md#1-status-and-authority) | open |
| `B40` | Extend absorption to the architecture, which owes the same duty | `I4` | `P2` | [`ARCHITECTURE.md` section 1](ARCHITECTURE.md#1-status-and-authority), [`DECISIONS.md`](DECISIONS.md) | open |

---

## Closed

Nine milestones are complete and are kept here as one line each; their detail is in the record they cite.

**Stop the node dying.**\
`B20` and `B21`, both `I1`, landed together because fixing the first reproduced the second within minutes.\
A node accepted `maxLabelBindings` messages and then refused every further one for the rest of its life, and an inbound dispatch failure ended the process rather than the session.

**Close the open correctness finding.**\
`B1`, `B14` and `B16`.\
The deepened sweep reads 70 of 70 and runs in about a quarter of the time it did.\
`MX1` was closed by credit and `MX2` by `D21`, and neither was what it first appeared to be.

**Remove the sustained send ceiling.**\
`B28`, `B23`, and the `LabelBinding` rename that followed them.\
A binding is released by the report that returns for it, so `MX7` is closed and expiry became the backstop rather than the mechanism.\
The `error` message retired into the disposition, because a vocabulary that holds one kind of thing cannot keep a second message for half of it.

**Addressing that a flow can rely on.**\
`B27`, ratified as `D26` under the amendment to `Q1(b)`.\
A message may name the advertiser it is for, and building it against a chain rather than a star showed that only the hop adjacent to the advertisers holds the alternatives, so a pin is enforced where a message would be delivered rather than where it was admitted.

**Measure what a deployment would see.**\
`B22`.\
Two nodes in one process cost about a third of throughput.\
Four contaminations were fixed rather than the two expected, and the three attempts that had produced three orderings were a scaling processor clock rather than a busy machine; the answer was to interleave the arms rather than to hold the host still.

**See an operator through a stream, and mean something by a revision.**\
`B29` and `B30`, ratified as `D24` and `D25`.\
An operator subscriber doing real work lost 256 events of a 600-message stream and now loses none at a buffer of one.\
A delivered message cost 9.17 canonical revisions and now costs 5.29, because a counter had been claiming that canonical state changed.

**Stop a contract claiming something untrue.**\
`B31` and `B32`, with `B12` returned to Held.\
Nine closed code domains were written once in `codeSets` and again by hand in `types.ts`, which section 3.1 of `sdk.md` says the SDK does not do; `AgpErrorCode` had already drifted and a compiler error rather than a gate had found it.\
They are generated now, so adding a value to a schema reaches the type with no edit, and `generate:check` rejects a hand edit to the generated file.\
`B32` was the mirror image and took two more passes to see whole: `SessionTimerName` enumerated ten values while the schema for the field carrying it accepted any non-empty string, and `Direction` was a duplicate that every check missed because it lives under `common` rather than `codes`.\
Every closed domain in a public object now has a schema as closed as its type, and no union is written twice anywhere.\
`B12` turned out not to be a breach at all: `ARCHITECTURE.md` opens by saying there is no target-state companion because the two instants have not diverged, and that the split happens when they do, so the item is honestly recorded and waiting on a trigger rather than open.

**Give the credit decision to the thing that knows the answer.**\
`B15`, ratified as `D29`.\
`D19` promised a deployment switch and never had one, but the evidence said it was not a deployment's question: a carrier whose send resolves only when the receiver has room cannot be outrun, and one behind kernel buffers always can.\
Loopback declares the guarantee and is no longer credited, which returned 21 and 23 per cent across two clock-matched pairs; socket carriers do not and are, unchanged.\
Disabling credit on a socket carrier with the nodes in separate processes reproduced `MX1` exactly, and with them in one process it did not, because two nodes sharing an event loop cannot outrun each other.

**Finish the thread `MX2` opened.**\
`B18`, ratified as `D27` and `D28`.\
The residual stall had been recorded as distributed cost with no next single fix, on the strength of one profile that was never tested against and was taken co-located.\
Disabling each named suspect moved the stall not at all: most of it was the load generator awaiting `send()` in a loop and never reaching the macrotask queue, which is also what any application doing the same would suffer, and the timers it starves are the ones that tore sessions down in `MX2`.\
Throughput up about 16 per cent and the worst stall down between 40 and 53 per cent, over three clock-matched pairs.

---

## Build order

Severity says what matters; this says what can be done next.\
Where the two disagree it is because of dependency, never because a severity was overridden.

Landed items leave this table rather than accumulating in it.\
What they decided is in the record they cite, and what they cost is in the milestone they closed.

| Order | Item | Ready | Why here |
|---|---|---|---|
| 1 | `B40` | Yes | The register already exists and the architecture owes the same duty, so this is one more consumer of a built mechanism rather than a new one |
| 2 | `B34` | Yes | Small, and the gates now hold the board still while it is edited |
| 3 | `B39`, `B11` | Yes | Both are the architecture disagreeing with another record, and both need reading rather than mechanism. `B40` first, so the gate says when they are done |
| 4 | `B13`, `B3` | Yes | Record work. `B3` selects a covering subset by coverage rather than by cost, now that cost data is not being collected |
| 5 | `B19` | Opportunistic | No next single fix. Taken when a way is found, not scheduled |

Nothing is blocked, and nothing here depends on anything else here.

---

## M10 - Make the records answer for each other

Severity `P2`.\
Each of these is a record stating something that is not true, rather than a record that is merely incomplete, which is why they sit above `M8`.

The gates this milestone opened with have landed, and a fourth landed after one of them was found to rest on a coincidence rather than a mechanism.\
What remains is the content a gate cannot judge: `B34` is a numbering an author must choose, and `B11` is two lists of deferrals that have to be read against each other.

| ID | Move | Note |
|---|---|---|
| `B40` | Extend absorption to the architecture, which owes the same duty | The vision is not the only living document a ratified ruling must reach. The register and its gate cover the vision alone, and the same eleven decisions were owed to the architecture, which is why the gap below went the same distance undetected |
| `B39` | Reconcile the architecture with what has been built since it was written | `ARCHITECTURE.md` opens by saying it describes AGP as it is built and proved today. Eleven decisions have been ratified and built since, and it names one of them, added this session. Section 8 is marked Approved against the reopen trigger `D19` credit admission lands in the send path; `B1` landed that credit and section 8 does not mention it, so a trigger fired and the section it governs never moved |
| `B34` | Give confirmed intent one subsection numbering | `DECISIONS.md` numbers two different sections `2.5` and orders them `2.3`, `2.5`, `2.4`, `2.5`. `BOARD.md` cites section 2.5 for the performance intent, and that citation is ambiguous by number rather than wrong |
| `B11` | Reconcile the scope boundary with the `F` series it is forked with | Section 10 lists what is included and deferred, and the `F` series lists deferred mechanisms with their re-entry conditions, so a deferral is written twice and section 10 is marked provisional because of it. Editorial work with its own risk: the two lists have to be read against each other before either can be cut |

---

## M8 - Record what the system already knows about itself

Severity `P3`.\
Grouped by severity rather than theme, so two unrelated subjects sit together because they cost the same to leave unwritten.

| ID | Move | Note |
|---|---|---|
| `B3` | Declare which mechanisms each matrix cell exercises | Makes a minimal covering subset computable rather than editorial. `traceability.json` links requirements to tests but not to dimension values |
| `B13` | Generate the package and dependency tables from the manifests | Both are derivable and hand-maintained. `contracts.md` carried three stale paths for months, and section 10 is still forked with the `F` series, so the fault class is observed rather than theoretical |

---

## M9 - Opportunistic improvement

Severity `P4`.\
Confirmed intent section 2.5 sets no performance target and asks that opportunities be taken as they are found, so an item here earns its place by being found rather than by clearing a threshold.

| ID | Move | Note |
|---|---|---|
| `B19` | Reduce the per-hop cost against the carrier beneath it | `MX4`. Roughly half a millisecond per message through a node pair against a 75 microsecond carrier round trip. Nothing is breached and nothing obliges this, which is exactly why it is scored `P4` and taken only when a way is found |

---

## Held

Scored on the same scale, so not choosing them is visible.

| ID | Held item | Impact | Breach | Revival trigger |
|---|---|---|---|---|
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | A deployment that needs mesh. One key per node lets a single compromise forge every identity, so mesh needs a per-pair model first |
| `B6` | Certificate and HTTP-authenticated profiles | `I3` | `P3` | Fresh intent. Pre-shared keys meet the stated requirement, which was confidentiality and peer authentication without certificate infrastructure |
| `B7` | Route volume beyond 256 | `I3` | `P3` | A topology needing more than 256 routes. `D4` names deltas as the change required |
| `B12` | Split current and target architecture instants | `I4` | `P3` | A decision that changes structure being ratified before it is built. `ARCHITECTURE.md` opens by saying there is no target-state companion because the two have not diverged, and that the split happens when they do rather than in anticipation. Nothing is ratified and unbuilt today, and `B26` gave such a record a home in the trace graph, so the trigger is further away than when this was filed |
| `B4` | Cost model for matrix cells | `I4` | `P4` | Sweep runtime becoming a felt cost. Ruled on demand and on no schedule: every carrier sweeps in about nine seconds, so there is nothing to select between and a cheaper covering subset would cost more to decide than to skip |
| `B8` | Named geometry tests onto shared builders | `I4` | `P4` | Duplication becoming a real maintenance cost. Their oracles are shape-specific, and rewriting a passing test to share a builder is a known way to weaken an assertion |
| `B35` | Bound the tests that await an event with no deadline | `I4` | `P4` | A hang masking a real failure, or a suite timeout recurring. Six files await an event indefinitely, so a broken assertion presents as the suite stopping rather than as a test failing. `TESTING.md` states no rule about this, so nothing is breached and the cost is diagnostic time |

---

## Decisions required

None outstanding.

The sweep schedule was ruled on demand and on no schedule, and `B4` is held with the trigger that ruling implies.\
Direction changes were ruled to carry a decision number always, which `D30` satisfies retrospectively and `record-integrity.test.js` now enforces.

---

## Mechanics

The board scores every candidate on impact and principle breach, orders on the higher of the two, groups selected moves into milestones by severity, and holds the rest with an explicit revival trigger.

Build order is stated separately from severity, because they answer different questions.\
Severity says which item matters most; build order says which can be done next without writing the same decision twice.\
Where they disagree the reason is a dependency, and it is named in the row rather than left to be inferred.

---

## Rationale

An architecture states a destination but selects nothing.\
Without a board the next move is chosen implicitly, item by item, under whatever pressure is loudest.\
Scoring on two dimensions keeps that choice honest: impact is what hurts today, principle breach is what keeps costing after today's pain is gone, and a single blended number cannot say that a low-impact item breaches a ratified decision outright.

---

## Consequence of violation

- Ordering on one collapsed score reintroduces shortest-path selection, and the
  item that breaches a commitment without hurting anyone today is never chosen.
- An item with no cited record is an assertion, and the board and the record
  drift until neither can be trusted.
- Dropping a candidate without a revival trigger converts a decision into
  forgetting, which is the fault the held section exists to prevent.
- Grouping milestones by theme rather than severity buries a correctness defect
  beside the cleanup work that happens to share its files.
- A decision entry that does not name what it blocks cannot be prioritised, so
  it waits on attention rather than earning it.
- Presenting build order as though it were triage hides a dependency behind an
  apparent judgement about severity, and the lowest-scored item on this board
  is the one that must be built first.
- Leaving a completed milestone in the live set makes the board a history
  rather than a set of legal next moves, which is what the record is for.
