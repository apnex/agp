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
| `B4` | Cost model for matrix cells | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | open |
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | [`X1`](VERIFICATION.md#48-excluded-combinations), [`F07`](design/mechanisms.md) | held |
| `B6` | Certificate and HTTP-authenticated WebSocket profiles | `I3` | `P3` | [`F07`](design/mechanisms.md) | held |
| `B7` | Route volume beyond the 256 snapshot ceiling | `I3` | `P3` | [`D4`](DECISIONS.md#d4---full-route-snapshots) | held |
| `B8` | Rewrite named geometry tests onto shared builders | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | held |
| `B10` | Author an enduring intent statement for AGP | `I4` | `P3` | [`ARCHITECTURE.md` section 10](ARCHITECTURE.md#10-scope-boundary), [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | open |
| `B31` | Generate the code unions that are currently written twice | `I4` | `P2` | [`D3`](DECISIONS.md#d3---sovereign-contracts), [`sdk.md` section 3.1](design/sdk.md#31-schema-backed-dtos) | landed |

---

## Closed

Eight milestones are complete and are kept here as one line each; their detail is in the record they cite.

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
`B31`, and `B12` returned to Held.\
Nine closed code domains were written once in `codeSets` and again by hand in `types.ts`, which section 3.1 of `sdk.md` says the SDK does not do; `AgpErrorCode` had already drifted and a compiler error rather than a gate had found it.\
They are generated now, so adding a value to a schema reaches the type with no edit, and `generate:check` rejects a hand edit to the generated file.\
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
| 1 | `B10` | Yes | A proposal is currently tested against an unwritten standard, which makes every other item on this board harder to argue about |
| 2 | `B13`, `B3` | Yes | Record work. `B3` wants `B4` first if cost-aware subset selection is the point of it |
| 3 | `B19` | Opportunistic | No next single fix. Taken when a way is found, not scheduled |
| 4 | `B4` | Blocked | Waiting on the sweep-schedule question below |

One item is blocked, on a decision rather than on work.\
Everything else is available and nothing depends on anything else here.

---

## M8 - Record what the system already knows about itself

Severity `P3`.\
Grouped by severity rather than theme, so three unrelated subjects sit together because they cost the same to leave unwritten.

| ID | Move | Note |
|---|---|---|
| `B10` | Author an enduring intent statement | Scope and anti-goals are recorded, but the purpose they serve is not. A proposal is currently tested against an unwritten standard |
| `B3` | Declare which mechanisms each matrix cell exercises | Makes a minimal covering subset computable rather than editorial. `traceability.json` links requirements to tests but not to dimension values |
| `B31` | Generate the code unions that are currently written twice | `AgpErrorCode`, `SessionEventCode` and `ConnectionState` are hand-written unions in `core/src/types.ts` beside generated schemas carrying the same values. Section 3.1 of `sdk.md` says the SDK does not create a second handwritten representation, so the document is untrue rather than merely aspirational. The class is live rather than theoretical: `AgpErrorCode` was missing `INSTANCE_UNREACHABLE` when `D26` added it, and the drift was found by a compiler error rather than by a gate |
| `B13` | Generate the package and dependency tables from the manifests | Both are derivable and hand-maintained. `contracts.md` carried three stale paths for months, and section 10 is still forked with the `F` series, so the fault class is observed rather than theoretical |

---

## M9 - Opportunistic improvement

Severity `P4`.\
Confirmed intent section 2.5 sets no performance target and asks that opportunities be taken as they are found, so an item here earns its place by being found rather than by clearing a threshold.

| ID | Move | Note |
|---|---|---|
| `B19` | Reduce the per-hop cost against the carrier beneath it | `MX4`. Roughly half a millisecond per message through a node pair against a 75 microsecond carrier round trip. Nothing is breached and nothing obliges this, which is exactly why it is scored `P4` and taken only when a way is found |
| `B4` | Record matrix cell timings as data rather than run output | Prerequisite for cost-aware subset selection under `B3`. Worth nothing on its own |

---

## Held

Scored on the same scale, so not choosing them is visible.

| ID | Held item | Impact | Breach | Revival trigger |
|---|---|---|---|---|
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | A deployment that needs mesh. One key per node lets a single compromise forge every identity, so mesh needs a per-pair model first |
| `B6` | Certificate and HTTP-authenticated profiles | `I3` | `P3` | Fresh intent. Pre-shared keys meet the stated requirement, which was confidentiality and peer authentication without certificate infrastructure |
| `B7` | Route volume beyond 256 | `I3` | `P3` | A topology needing more than 256 routes. `D4` names deltas as the change required |
| `B12` | Split current and target architecture instants | `I4` | `P3` | A decision that changes structure being ratified before it is built. `ARCHITECTURE.md` opens by saying there is no target-state companion because the two have not diverged, and that the split happens when they do rather than in anticipation. Nothing is ratified and unbuilt today, and `B26` gave such a record a home in the trace graph, so the trigger is further away than when this was filed |
| `B8` | Named geometry tests onto shared builders | `I4` | `P4` | Duplication becoming a real maintenance cost. Their oracles are shape-specific, and rewriting a passing test to share a builder is a known way to weaken an assertion |

---

## Decisions required

| Question | Blocks |
|---|---|
| Whether a matrix sweep should run on a schedule, and if so at what depth | `B4`, and whether cost data is worth collecting at all |

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
