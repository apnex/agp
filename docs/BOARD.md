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
| `B22` | Measure throughput with each node in its own process | `I3` | `P3` | [`MX4`](VERIFICATION.md#46-open-findings-from-sweeps), [`VERIFICATION.md` section 4.9](VERIFICATION.md#49-chasing-a-timing-defect) | open |
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
| `B18` | Explain the residual event-loop stalls under a stream | `I2` | `P3` | [`MX3`](VERIFICATION.md#46-open-findings-from-sweeps) | open, re-scoped |
| `B29` | Move per-message events off the operations stream | `I2` | `P3` | [`D24`](DECISIONS.md#d24---the-operations-stream-is-a-channel-not-a-ledger), [`MX3`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B30` | Stop traffic-rated session values advancing the canonical revision | `I3` | `P2` | [`D25`](DECISIONS.md#d25---a-revision-denotes-a-change-to-canonical-state), [`D10`](DECISIONS.md#d10---atomic-canonical-state) | landed |
| `B19` | Take the per-hop cost against the carrier, opportunistically | `I4` | `P4` | [`MX4`](VERIFICATION.md#46-open-findings-from-sweeps) | open |
| `B15` | Give a deployment the switch `D19` says it has, and credit control alongside data | `I3` | `P2` | [`D19`](DECISIONS.md#d19---per-hop-credit-flow-control) | open |
| `B2` | Reconcile the pause wording in `binding-websocket.md` with the code | `I4` | `P2` | [`MX1`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B12` | Split current and target architecture instants | `I4` | `P2` | [`ARCHITECTURE.md` section 12](ARCHITECTURE.md#12-owed-and-open) | open |
| `B3` | Machine-readable cell to mechanism mapping | `I4` | `P3` | [`VERIFICATION.md` section 4](VERIFICATION.md#4-coverage-register) | open |
| `B13` | Generate the package and dependency tables from the manifests | `I4` | `P3` | [`ARCHITECTURE.md` section 12](ARCHITECTURE.md#12-owed-and-open) | open |
| `B4` | Cost model for matrix cells | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | open |
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | [`X1`](VERIFICATION.md#48-excluded-combinations), [`F07`](design/mechanisms.md) | held |
| `B6` | Certificate and HTTP-authenticated WebSocket profiles | `I3` | `P3` | [`F07`](design/mechanisms.md) | held |
| `B7` | Route volume beyond the 256 snapshot ceiling | `I3` | `P3` | [`D4`](DECISIONS.md#d4---full-route-snapshots) | held |
| `B8` | Rewrite named geometry tests onto shared builders | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | held |
| `B10` | Author an enduring intent statement for AGP | `I4` | `P3` | [`ARCHITECTURE.md` section 10](ARCHITECTURE.md#10-scope-boundary), [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | open |

---

## Closed

Two milestones are complete and are kept here as one line each; their detail is in the record they cite.

**Stop the node dying.**\
`B20` and `B21`, both `I1`, landed together because fixing the first reproduced the second within minutes.\
A node accepted `maxLabelBindings` messages and then refused every further one for the rest of its life, and an inbound dispatch failure ended the process rather than the session.

**Close the open correctness finding.**\
`B1`, `B14` and `B16`.\
The deepened sweep reads 70 of 70 and runs in about a quarter of the time it did.\
`MX1` was closed by credit and `MX2` by `D21`, and neither was what it first appeared to be.

---

## Build order

Severity says what matters; this says what can be done next.\
Where the two disagree it is because of dependency, never because a severity was overridden.

| Order | Item | Ready | Why here |
|---|---|---|---|
| 1 | `B28` | Landed | Scored lowest on the board and built first, because both items after it change the forwarding decision |
| 2 | `B23` | Landed | Removed the sustained ceiling `MX7` recorded. The `error` message retired into it, so one message now reports the fate of a message whichever fate it was |
| 3 | `B22` | Yes | Cheap, and wants a quiet machine rather than a queue position |
| 4 | `B27` | Landed | Ratified as `D26` and built. Building it against a chain rather than a star showed that only the hop adjacent to the advertisers holds the alternatives, so a pin is enforced where a message would be delivered rather than where it was admitted |
| 5 | `B15` | Blocked | Waiting on the credit switch question below |
| 6 | `B30` | Landed | Ruled as `D25` and built. 9.17 revisions per delivered message down to 5.29. The first rule tried excluded only the hold timer and bought 11%, because the timer was one of four traffic-rated values and the smallest |
| 7 | `B29` | Landed | Ruled as `D24` and built. An operator subscriber doing real work lost 256 events of a 600-message stream at a buffer of 256, and 175 at the default; it now loses none at a buffer of one |
| 8 | `B18` | Re-scoped | What remains after `B29` and `B30` is the distributed cost, which is `MX4`'s character rather than a defect |
| 9 | `B12`, `B10`, `B3`, `B13` | Yes | Record work, none of it blocking |
| 10 | `B19`, `B4` | Yes | Taken when a way is found, not scheduled |

Both of `B18`'s remaining questions were decisions rather than measurements, and both are now ruled, as `D24` and `D25`.\
What they leave is two buildable items and a residue: `B29` removes the starvation, `B30` removes 45% of the revisions, and what is left of `B18` after them is distributed cost with no next single fix.\
`B22` and the record work remain independent of all of it.

---

## M3 - Remove the sustained send ceiling

Severity `I2`.

| ID | Move | Note |
|---|---|---|
| `B28` | Resolve a forwarding decision in one place instead of three | Landed. One resolver answers for both admission paths, and the transit preview encode went with it, so a forwarding hop encodes once rather than twice. The refusal precedence turned out to be specified rather than incidental, and the first attempt inverted two codes; the gate that owns it caught that before it left the machine |
| `B23` | Build `D23` | Landed. A binding is released by the report that returns for it, so expiry became the backstop rather than the mechanism. The `error` message retired into the disposition, because a vocabulary that holds one kind of thing cannot also keep a second message for half of it. The denominator stays absent on the wire when it is one and the schema forbids spelling one, so absence is unambiguous and the codec normalises it at a single site. Two measurement mistakes are recorded with the instrument: holding the old behaviour open takes both batch bounds, and the debounce that drains an origin's table belongs to the far end |

A node used to sustain about 136 messages a second against a burst ceiling near 2850, because a reverse-path binding was released by failure or expiry and never by success.\
The ceiling was not a capacity to raise; it was a quality mechanism acting as a throughput bound.\
`scripts/sustained-rate.mjs` holds both batch bounds open to reproduce the old behaviour against the same binary, and measures the correction without reverting code.

---

## M4 - Finish the thread `MX2` opened

Severity `I2`.

| ID | Move | Note |
|---|---|---|
| `B18` | Explain the event-loop saturation that remains under a stream | Advanced, and now at diminishing returns. Three projections are memoised, a session transition and a timer reset commit session state rather than everything held, and a fourth memoisation was tried and reverted for producing no measurable gain. A steady-state profile shows the remaining cost is distributed rather than concentrated: schema validation on encode and parse, event materialisation, and the state and action clones the session machine makes per command. There is no next single fix, which is why this should be re-scoped before more is spent on it |

---

## M5 - Stop a contract claiming something untrue

Severity `P2`.

| ID | Move | Note |
|---|---|---|
| `B15` | Give a deployment the switch `D19` says it has, and govern control alongside data | `D19` states that a deployment configures whether it grants at all, and no such configuration exists. It also leaves control ungoverned, drawing on a reserve rather than a grant, so the ring is bounded by construction rather than by accounting |
| `B12` | Split the architecture into current and target instants | Now legal, and smaller than when it was filed. The trigger was `D19` ratified but unbuilt; `D19` is built except for the switch `B15` owns, so one declared surface still has no running counterpart. Doing this before `B15` would describe a divergence that `B15` is about to remove |

---

## M6 - Addressing that a flow can rely on

Severity `I3`.

| ID | Move | Note |
|---|---|---|
| `B27` | Let a message name the instance it is for, not only the endpoint | Addressing by name alone means any advertiser may serve the message, which is anycast and arrived as a consequence rather than a choice. It is the wrong default for a flow with state on one instance. The candidate routing table already holds what is needed, so this asks a different question of state already kept. `Q1(b)` was amended on 2026-08-23 to permit it, so what remains is to ratify the design and build it. It pays forward: a named instance completes the classification that per-flow labelling would later use |

---

## M7 - Measure what a deployment would see

Severity `I3`.

| ID | Move | Note |
|---|---|---|
| `B22` | Re-measure throughput with each node in its own process | Fully unblocked. Both socket carriers isolate and an isolated node generates its own load, so the harness is ready. Three measurement attempts produced three orderings on a machine saturated by the session that built them, so the number is worth nothing until it is taken quiet. Two contaminations specific to an isolated run are known and belong here: the parent observes delivery over a channel it must be scheduled to drain, and sender and receiver are timed by different clocks |

---

## M8 - Record what the system already knows about itself

Severity `P3`.\
Grouped by severity rather than theme, so three unrelated subjects sit together because they cost the same to leave unwritten.

| ID | Move | Note |
|---|---|---|
| `B10` | Author an enduring intent statement | Scope and anti-goals are recorded, but the purpose they serve is not. A proposal is currently tested against an unwritten standard |
| `B3` | Declare which mechanisms each matrix cell exercises | Makes a minimal covering subset computable rather than editorial. `traceability.json` links requirements to tests but not to dimension values |
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
| `B8` | Named geometry tests onto shared builders | `I4` | `P4` | Duplication becoming a real maintenance cost. Their oracles are shape-specific, and rewriting a passing test to share a builder is a known way to weaken an assertion |

---

## Decisions required

| Question | Blocks |
|---|---|
| Whether a node should be able to decline to grant at all, and what a deployment that does so is choosing | `B15`. The wire field is optional and an absent grant is unlimited, so a peer that never negotiated credit is unaffected. What is not built is the switch `D19` says a deployment has, and the default was set to grant because leaving `RECEIVE_OVERFLOW` reachable is the fault `D19` exists to remove |
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
