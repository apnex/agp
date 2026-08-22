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

| ID | Candidate | Impact | Breach | Evidence |
|---|---|---|---|---|
| `B1` | Implement `D19` credit flow control | `I1` | `P1` | [`MX1`](VERIFICATION.md#46-open-findings-from-sweeps), [`D19`](DECISIONS.md#d19---per-hop-credit-flow-control) |
| `B14` | Name a reproduction for the route-ack expiry a stream provokes | `I2` | `P2` | [`MX2`](VERIFICATION.md#46-open-findings-from-sweeps) |
| `B16` | Project credit and timing into the operations plane | `I2` | `P1` | [`D19`](DECISIONS.md#d19---per-hop-credit-flow-control), [`MX2`](VERIFICATION.md#46-open-findings-from-sweeps) |
| `B17` | Derive the trace graph identifier set instead of hardcoding it | `I3` | `P1` | [`GATES.md` section 2](GATES.md#2-gate-ax0---intent-applicability-and-knowledge) |
| `B15` | Give a deployment the switch `D19` says it has, and credit control alongside data | `I3` | `P2` | [`D19`](DECISIONS.md#d19---per-hop-credit-flow-control) |
| `B2` | Reconcile the pause wording in `binding-websocket.md` with the code | `I4` | `P2` | [`MX1`](VERIFICATION.md#46-open-findings-from-sweeps) |
| `B3` | Machine-readable cell to mechanism mapping | `I4` | `P3` | [`VERIFICATION.md` section 4](VERIFICATION.md#4-coverage-register) |
| `B4` | Cost model for matrix cells | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) |
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | [`X1`](VERIFICATION.md#48-excluded-combinations), [`F07`](design/mechanisms.md) |
| `B6` | Certificate and HTTP-authenticated WebSocket profiles | `I3` | `P3` | [`F07`](design/mechanisms.md) |
| `B7` | Route volume beyond the 256 snapshot ceiling | `I3` | `P3` | [`D4`](DECISIONS.md#d4---full-route-snapshots) |
| `B8` | Rewrite named geometry tests onto shared builders | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) |
| `B12` | Split current and target architecture instants | `I4` | `P2` | [`ARCHITECTURE.md` section 12](ARCHITECTURE.md#12-owed-and-open) |
| `B13` | Generate the package and dependency tables from the manifests | `I4` | `P3` | [`ARCHITECTURE.md` section 12](ARCHITECTURE.md#12-owed-and-open) |
| `B10` | Author an enduring intent statement for AGP | `I4` | `P3` | [`ARCHITECTURE.md` section 10](ARCHITECTURE.md#10-scope-boundary), [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) |

---

## M1 - Close the open correctness finding

Severity `I1`.\
Status: **built and gated, one cell short of its oracle.**

| ID | Move | Why it is first |
|---|---|---|
| `B1` | Implement `D19`: envelope and `OPEN` credit fields, grant computation and enforcement beside `capacity-ledger`, and a regression test | The only `I1` on the board. A sender silently loses messages after `send()` resolves, and the session resets. `D19` is ratified, so only the build remains |
| `B14` | Name a reproduction for `MX2`, then decide whether it is a harness bound or a defect | The last two cells of the `B1` oracle fail on this and not on credit. It cannot stay a matrix observation, because a failing cell names a combination rather than an owning layer |
| `B16` | Project credit and timing into the operations plane, so a timing defect is read rather than derived | `B14` cannot proceed without it. Credit is the only bounded resource in AGP that no authorized actor can query, and the last investigation was conducted by patching built artifacts and reading line numbers as if they were a clock |

The oracle moved from 59 of 70 cells to 68.\
The nine cells credit recovered were all message loss under a stream.\
The two that remain are one cell on two carriers, and they fail for `MX2` rather than for anything credit governs, which is why `B14` now stands between `B1` and its oracle.

The internal order fixed by `D3` was followed: contracts and their gate first, then the grant primitives, then enforcement, then the regression.\
The compatibility posture under `Decisions required` was resolved by building the mechanism and leaving the switch to `B15`.

---

## M2 - Stop a contract claiming something untrue

Severity `P2`.

| ID | Move | Note |
|---|---|---|
| `B2` | Align the pause wording in `binding-websocket.md` with the implementation, or the implementation with the wording | Neither prevents the overrun, so this is a truth defect rather than a behaviour defect. Cheapest done inside `B1`, which edits the same paragraph |
| `B15` | Give a deployment the switch `D19` says it has, and govern control alongside data | `D19` states that a deployment configures whether it grants at all, and no such configuration exists. It also leaves control ungoverned, drawing on a reserve rather than a grant, so the ring is bounded by construction rather than by accounting |
| `B17` | Derive the required identifier set of the trace graph from the record, rather than stating it as a literal | `AX0` seals the intent graph against `D1` to `D17` written as a constant, while nineteen decisions are ratified. `D18` and `D19` are built and gated and appear nowhere in the graph, and the gate cannot detect the drift it exists to prevent |
| `B12` | Split the architecture into current and target instants | Not yet legal. `AR1` projects one architecture at two instants, and AGP has one because current and target converged. `D19` ratified but unbuilt is the trigger, so this becomes legal the moment `B1` starts |

---

## M3 - Record what the system already knows about itself

Severity `P3`.\
Grouped by severity rather than theme, so three unrelated subjects sit together because they cost the same to leave unwritten.

| ID | Move | Note |
|---|---|---|
| `B10` | Author an enduring intent statement | Scope and anti-goals are recorded, but the purpose they serve is not. A proposal is currently tested against an unwritten standard |
| `B3` | Declare which mechanisms each matrix cell exercises | Makes a minimal covering subset computable rather than editorial. `traceability.json` links requirements to tests but not to dimension values |
| `B13` | Generate the package and dependency tables from the manifests | Both are derivable and hand-maintained. `contracts.md` carried three stale paths for months, and section 10 is still forked with the `F` series, so the fault class is observed rather than theoretical |

---

## M4 - Instrumentation

Severity `P4`.

| ID | Move | Note |
|---|---|---|
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
