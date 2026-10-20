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
| `B56` | Observe disposition write failures through the existing exact-session teardown path | `I2` | `P2` | [`MX24`](VERIFICATION.md#46-open-findings-from-sweeps), [main publication](VERIFICATION.md#480-disposition-repair-main-publication-for-consumer-verification) and [acceptance requirements](VERIFICATION.md#437-disposition-repair-independent-source-review-and-acceptance-requirements) | open |
| `B53` | Bound identity admission and release expired connections | `I2` | `P2` | [`MX21`](VERIFICATION.md#46-open-findings-from-sweeps), [admission-timeout finding](VERIFICATION.md#421-identity-admission-timeout-and-teardown-finding) | open |
| `B54` | Decide peer-scale intent and define its operating envelope | `I3` | `P3` | [`MX22`](VERIFICATION.md#46-open-findings-from-sweeps), [public binding handoff](VERIFICATION.md#478-browser-peer-scale-public-binding-handoff) | open |
| `B52` | Enforce bounded outbound acquisition and reject stale completions | `I2` | `P2` | [`MX20`](VERIFICATION.md#46-open-findings-from-sweeps), [local commit](VERIFICATION.md#420-acquisition-repair-review-and-local-commit) | landed |
| `B44` | Distinguish handler admission, definite refusal, and unknown delivery | `I1` | `P2` | [`MX10`](VERIFICATION.md#46-open-findings-from-sweeps), [`D31`](DECISIONS.md#d31---preserve-delivery-certainty) | landed |
| `B45` | Enforce send timeout and cancellation without allowing a rejected queued send to deliver later | `I2` | `P2` | [`MX11`](VERIFICATION.md#46-open-findings-from-sweeps), [`D32`](DECISIONS.md#d32---bound-send-admission) | landed |
| `B46` | Explain and verify application-owned correlation across request, reply, and dispositions | `I3` | `P4` | [`MX12`](VERIFICATION.md#46-open-findings-from-sweeps), [SDK contract](design/sdk.md#53-routed-send) | landed |
| `B43` | Make native operator discovery and in-shell management setup usable | `I2` | `P3` | [`MX9`](VERIFICATION.md#46-open-findings-from-sweeps), [operator results](rustcli/OPERATOR.md) | landed |
| `B42` | Integrate the configured Rust CLI across the complete management surface | `I3` | `P3` | [`MX8`](VERIFICATION.md#46-open-findings-from-sweeps), [consumer record](rustcli/INTEGRATION.md) | landed |
| `B20` | Release expired label bindings, so a node can send more than 4096 messages in its life | `I1` | `P1` | [`MX5`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B21` | Stop discarding a rejectable promise on the inbound data path | `I1` | `P2` | [`MX6`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B22` | Measure throughput with each node in its own process | `I3` | `P3` | [`MX4`](VERIFICATION.md#46-open-findings-from-sweeps), [`VERIFICATION.md` section 4.9](VERIFICATION.md#49-chasing-a-timing-defect) | landed |
| `B24` | Give the equivalence line one declaration instead of two | `I4` | `P3` | [`VERIFICATION.md` section 4.9](VERIFICATION.md#49-chasing-a-timing-defect) | landed |
| `B25` | Give pre-shared keys a cross-process key exchange so that carrier can be isolated too | `I4` | `P3` | [isolated geometry builder](../test/support/geometry.js), [child transport setup](../test/support/node-process.mjs), [`VERIFICATION.md` section 4.6](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
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
| `B19` | Take the per-hop cost against the carrier, opportunistically | `I4` | `P4` | [`MX4`](VERIFICATION.md#46-open-findings-from-sweeps) | held |
| `B15` | Decide credit by the carrier rather than by configuration | `I3` | `P2` | [`D29`](DECISIONS.md#d29---credit-the-carrier-that-can-be-outrun), [`D19`](DECISIONS.md#d19---per-hop-credit-flow-control) | landed |
| `B2` | Reconcile the pause wording in `binding-websocket.md` with the code | `I4` | `P2` | [`MX1`](VERIFICATION.md#46-open-findings-from-sweeps) | landed |
| `B12` | Split current and target architecture instants | `I4` | `P3` | [`ARCHITECTURE.md` section 12](ARCHITECTURE.md#12-owed-and-open) | held |
| `B3` | Machine-readable cell to mechanism mapping | `I4` | `P3` | [`VERIFICATION.md` section 4](VERIFICATION.md#4-coverage-register) | landed |
| `B13` | Generate the package and dependency tables from the manifests | `I4` | `P3` | [`ARCHITECTURE.md` section 7](ARCHITECTURE.md#7-package-and-module-composition) | landed |
| `B4` | Cost model for matrix cells | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | held |
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | [`X1`](VERIFICATION.md#48-excluded-combinations), [`F07`](design/mechanisms.md) | held |
| `B6` | Resolve direct-peer authentication and credential-lifecycle feasibility | `I3` | `P3` | [`MX17`](VERIFICATION.md#46-open-findings-from-sweeps), [boundary assessment](reviews/browser-peer-feasibility.md#4-boundary-assessment-tier-3) | open |
| `B7` | Route volume beyond the 256 snapshot ceiling | `I3` | `P3` | [`D4`](DECISIONS.md#d4---full-route-snapshots) | held |
| `B8` | Rewrite named geometry tests onto shared builders | `I4` | `P4` | [`VERIFICATION.md` section 4.7](VERIFICATION.md#47-matrix-execution) | held |
| `B10` | Author an enduring intent statement for AGP | `I4` | `P3` | [`ARCHITECTURE.md` section 10](ARCHITECTURE.md#10-scope-boundary), [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | landed |
| `B31` | Generate the code unions that are currently written twice | `I4` | `P2` | [`D3`](DECISIONS.md#d3---sovereign-contracts), [`sdk.md` section 3.1](design/sdk.md#31-schema-backed-dtos) | landed |
| `B32` | Give a closed domain a schema that is as closed as its type | `I3` | `P2` | [`D3`](DECISIONS.md#d3---sovereign-contracts), [`contracts.md` section 6](design/contracts.md#61-configuration) | landed |
| `B11` | Reconcile the scope boundary with the `F` series it is forked with | `I4` | `P2` | [`ARCHITECTURE.md` section 10](ARCHITECTURE.md#10-scope-boundary), [`F07`](design/mechanisms.md) | landed |
| `B37` | Gate that a record citing a board item reaches the board | `I4` | `P2` | [`BOARD.md` section 1](BOARD.md#the-contract-between-board-and-record), [`ARCHITECTURE.md` section 1](ARCHITECTURE.md#1-status-and-authority) | landed |
| `B33` | Gate that a ratified decision reaches the vision it changes | `I4` | `P2` | [`VISION.md`](../VISION.md#authority), [`DECISIONS.md`](DECISIONS.md) | landed |
| `B34` | Give confirmed intent one subsection numbering | `I4` | `P2` | [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | landed |
| `B35` | Bound the tests that await an event with no deadline | `I4` | `P4` | [`MX15`](VERIFICATION.md#46-open-findings-from-sweeps), [`TESTING.md`](TESTING.md#bounded-failure-reporting) | landed |
| `B36` | Gate the self-consistency this board declares | `I4` | `P2` | [`BOARD.md` section 1](BOARD.md#the-contract-between-board-and-record) | landed |
| `B38` | Catch a direction change that carries no decision number | `I4` | `P2` | [`VISION.md`](../VISION.md#authority), [`DECISIONS.md` section 2](DECISIONS.md#2-confirmed-intent) | landed |
| `B39` | Reconcile the architecture with what has been built since it was written | `I4` | `P2` | [`ARCHITECTURE.md` section 1](ARCHITECTURE.md#1-status-and-authority) | landed |
| `B40` | Reject spent architecture reopen triggers; do not add a second absorption register | `I4` | `P2` | [`ARCHITECTURE.md` section 1](ARCHITECTURE.md#1-status-and-authority), [reconciliation](VERIFICATION.md#410-board-reconciliation) | landed |
| `B41` | Judge whether the absorption register is evidence or ceremony | `I4` | `P4` | [`vision-absorption.json`](design/vision-absorption.json), [`traceability.json`](design/traceability.json) | held |
| `B47` | Reconcile the consumer handoff with landed AGP contracts and attempt-level retry certainty | `I3` | `P4` | [`MX13`](VERIFICATION.md#46-open-findings-from-sweeps), [consumer reconciliation](VERIFICATION.md#412-consumer-handoff-reconciled) | landed |
| `B48` | Verify the implemented operation-call consumer against AGP's corrected contract | `I3` | `P4` | [`MX14`](VERIFICATION.md#46-open-findings-from-sweeps), [consumer acceptance closeout](VERIFICATION.md#429-operation-call-consumer-acceptance-closeout) | landed |
| `B49` | Restore the documented disposition methods to the public node type | `I2` | `P2` | [`MX16`](VERIFICATION.md#46-open-findings-from-sweeps), [typing correction](VERIFICATION.md#414-public-disposition-typing-restored) | landed |
| `B50` | Establish browser carrier and portable-runtime contract feasibility | `I3` | `P3` | [`MX18`](VERIFICATION.md#46-open-findings-from-sweeps), [independent investigations](reviews/browser-peer-feasibility.md#5-work-that-can-proceed-independently) | open |
| `B51` | Resolve principal-based endpoint permissions and delivery evidence | `I3` | `P3` | [`MX19`](VERIFICATION.md#46-open-findings-from-sweeps), [boundary assessment](reviews/browser-peer-feasibility.md#4-boundary-assessment-tier-3) | open |
| `B55` | Check session timer deadline authority | `I3` | `P4` | [`MX23`](VERIFICATION.md#46-open-findings-from-sweeps), [session timer finding](VERIFICATION.md#430-session-timer-deadline-authority) | open |

---

## Closed

18 milestones are complete; their detail is in the record they cite.

**Accept the implemented operation-call consumer.**\
`B48` closes M11: the [acceptance closeout](VERIFICATION.md#429-operation-call-consumer-acceptance-closeout) matches all five handoff cases to pinned consumer assertions and Zorg's original per-case execution logs.\
This accepts the operation-call integration over AGP's production in-process carrier, not operation-proxy, browser execution, authenticated reply isolation, peer-scale capacity or publication.\
AGP reviewed existing execution evidence; no consumer tests were rerun for this closeout.

**Restore acquisition ownership guarantees.**\
`B52` closes M15: outbound acquisition has a node-owned deadline, stop/failure cancellation, stale-completion rejection and retained pending-work accounting.\
The [review and commit record](VERIFICATION.md#420-acquisition-repair-review-and-local-commit) identifies the local commit and author-check scope; publication and independent acceptance are not claimed.\
The correction implements an existing contract and selects no credential protocol.

**Restore the documented public type surface.**\
`B49` closes M13: `AgpNode` now declares the three disposition methods its implementation already supplied.\
A public-package TypeScript consumer regression fails before the correction and passes after it, including exact signatures and rejected invalid calls.\
The [verification record](VERIFICATION.md#414-public-disposition-typing-restored) records the repair; the [subsequent commit state](VERIFICATION.md#417-zorg-requirements-review-and-current-handoff) confirms it is committed locally, with publication and consumer acceptance still separate.

**Make missing-event failures diagnosable.**\
`B35` closes M12 with named wait deadlines, cancellation-aware foreground waits, registered resource cleanup, and a default test-runner bound.\
Missing-event mutations run the actual dial and handler tests and require both an attributable failure and stopped nodes.\
Separate regressions cover subscription release and child readiness, IPC, exit, and forced termination; healthy process checks retain delivery over both WebSocket profiles.\
The [verification record](VERIFICATION.md#411-bounded-test-failures) states the measured scope and the event-loop limitation; AGP runtime contracts are unchanged.

**Make the records answer for each other.**\
`B34`, `B39`, and `B11` close the remaining content work from M10.\
Confirmed intent had repeated and out-of-order subsection numbers; they are now unique without changing the recorded intent.\
The architecture's D19-era authority and processing account had not followed the built admission, disposition, observation, and credit decisions.\
Its paths now describe the built system and point at actual modules, with future-facing reopen triggers.\
Its duplicated deferral list is replaced by the vision and mechanism-register owners, including the already-built pre-shared-key profile.\
Structural gates protect numbering, module homes, and scope references; source review still owns prose correctness.

**Record what the system already knows about itself.**\
`B13` and `B3` close M8.\
Package and dependency tables were hand-maintained despite being derivable; they now regenerate from workspace manifests, with full-content drift and mutation checks.\
The trace graph linked requirements to tests but not matrix dimension values.\
The [coverage declaration](design/matrix-coverage.json) now makes that mapping executable, with JSON plans/results and an opt-in deterministic covering subset.\
The subset preserves declared exercise coverage, not every interaction or every mechanism's full contract; the full sweep and named gates remain distinct.\
No cost model or schedule is introduced.

**Make the consumer contract safe to compose.**\
`B44`, `B45`, and `B46` distinguish uncertainty from refusal, enforce pre-admission cancellation, and verify application-owned request/reply correlation.\
The [Zorg response](ZORG-RESPONSE.md) explains the corrected premises, retained boundaries, and coordinated peer upgrade requirement.\
`B47` closes the subsequent record handoff: Zorg now reads the landed baseline, and operation-call (formerly opcall) preserves earlier attempts' uncertainty.\
The [consumer reconciliation](VERIFICATION.md#412-consumer-handoff-reconciled) records the earlier handoff; [consumer acceptance](VERIFICATION.md#429-operation-call-consumer-acceptance-closeout) now closes `B48` separately.

**Configure management inside the operator shell.**\
`B43` closes the first-use discovery and setup failures with compact help, root navigation, and explicitly saved endpoint selection.\
The [operator record](rustcli/OPERATOR.md) retains live tests and the installed terminal journey.

**Use one configured native CLI across management.**\
`B42` supplies ten contexts, thirty verbs, and ten views in `rustcli/`, with [local live acceptance and installed terminal evidence](rustcli/INTEGRATION.md).\
AGP supplies authored data; the shared Rust CLI owns transport, navigation, and rendering.

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
| 1 | `B56` | Repair published on remote main for consumer verification; runtime acceptance remains open | [Publication checkpoint](VERIFICATION.md#480-disposition-repair-main-publication-for-consumer-verification) records the director-selected repair-only push; Zorg can pin the published revision, while the four runtime properties and a distinct acceptance judgment remain unestablished |
| 2 | `B53` | Capability feedback placed; execution prerequisites remain unmet | [Feedback handoff](VERIFICATION.md#468-zorg-and-context-lab-feedback-handoff) records placement with context-lab; request/spend, retention and exact-profile requirements and unconfirmed provider contacts still hold the zero-call stop |
| 3 | `B54` | Independent key/protocol PASS; public-binding questions placed with context-lab | [Handoff checkpoint](VERIFICATION.md#478-browser-peer-scale-public-binding-handoff) records the local contract request; paired preregistration and exact prompt inspection await the owner reply before pack construction |
| 4 | `B51` | Corrections reviewed; consolidated follow-up placed | [Review handoff](VERIFICATION.md#471-context-lab-assurance-correction-review-and-follow-up) identifies interrupted-reader accounting and response/replay/CLI qualifications; resolve those and the heading/assigned-reading bindings before selecting execution |
| 5 | `B6` | Consumer-fit acknowledgment placed; AGP gates remain open | [Feedback handoff](VERIFICATION.md#468-zorg-and-context-lab-feedback-handoff) records the response in Zorg's incoming folder; the six-area fit requires no repeated study, while AGP assurance, ratification and implementation remain separate |
| 6 | `B50` | D49 makes Zorg's browser set a requirement; portable-runtime proposals can proceed independently | [Refreshed input](VERIFICATION.md#426-admission-lifetime-handoff-revisions-and-zorg-response) fixes requested coverage, not conformance; final carrier guarantees still need resource bounds and browser evidence, while authenticated acquisition depends on `B6` |
| 7 | `B55` | Source-backed timer concern recorded; AGP early expiry is not reproduced | [Session timer finding](VERIFICATION.md#430-session-timer-deadline-authority) separates callback authority from elapsed time; check the existing session and transport-close paths, coordinate overlapping work with B53, and re-triage on established impact |

The [lifecycle comparison](VERIFICATION.md#418-shared-admission-lifecycle-comparison) refines the requirements review and separates already-owed acquisition behaviour from new credential features.\
The comparison is drafted, not ratified; the investigations remain open until their evidence and decision dependencies are resolved.\
`B52` is closed locally; `B56` runtime acceptance remains open, and the completed `B53` document-comprehension comparison supplies no assurance verdict because of an independently established scoring defect.\
`B54` records the proposed scale expansion before budgets are endorsed for hundreds of peers.\
The `B51` reply-isolation contract, `B6` joint lifecycle and `B50` portability proposals can proceed independently.\
`B48` is closed on the five consumer outcomes; `B55` is a separate timing investigation, not a new condition on that acceptance.\
This board does not authorise building Zorg's call layer or implementing a new authentication protocol before its design is agreed.

---

## M16 - Bound admission lifetime and teardown

Severity `I2`/`P2`: an unanswered identity-admission callback can retain a connection after protocol expiry, contrary to the existing lifecycle contract.\
Status: [revision 3 passes independent technical design review](reviews/admission-lifetime-independent-review-r3.md); the two original omissions and the subsequent retry-reset conflict are resolved at design level.\
The [adoption recommendation](reviews/admission-lifetime-adoption.md) now states the public choices, costs and baseline defaults, with a passing compile-only compatibility check.\
The director selected that complete direction for assurance; the [comparison packet](reviews/admission-lifetime-assurance/admission-assurance-preregistration.md) and pre-execution correction are committed locally.\
The corrected packet passed independent readiness recheck; the completed comparison has an [independent assurance FAIL](reviews/admission-lifetime-assurance/admission-gate-review-01.txt) on grounding/completeness and control criteria.\
The measurement is usable, but it does not prove a new mechanism defect.\
The director selected the [completed author triage's](reviews/admission-lifetime-assurance/admission-assurance-findings-triage.md) next move: [revision 4](reviews/admission-lifetime-correction-r4.md) now has its own [independent technical PASS and scoped M7 PASS](reviews/admission-lifetime-independent-review-r4.txt).\
These accept the proposed expiry selection and whole-teardown budget at design level, not the runtime or document assurance.\
The [review record](VERIFICATION.md#433-admission-lifetime-clarification-and-independent-review) carries the timeout-domain, per-send enforcement and full publication-site integration guardrails; the frozen assurance FAIL is unchanged.\
The [fresh packet](reviews/admission-lifetime-assurance-r4/admission-assurance-preregistration.md) is committed with twenty-four questions, fifteen of them controls; its original [independent key/readiness audit](reviews/admission-lifetime-assurance-r4/admission-key-audit-01.txt) remains FAIL at that frozen checkpoint.\
The separately committed [accounting amendment](reviews/admission-lifetime-assurance-r4/admission-accounting-amendment-01.md) distinguishes retained text, eligible answers and ended-phase zeroes; its [bounded independent recheck](reviews/admission-lifetime-assurance-r4/admission-key-recheck-02.txt) is PASS for that correction.\
The director selected execution; [preflight](VERIFICATION.md#439-admission-assurance-execution-preflight) restored the exact evaluator/build and passed input/rendering checks, then stopped because the frozen provider is absent from the current configuration.\
The director has now approved the [provider amendment](reviews/admission-lifetime-assurance-r4/admission-provider-amendment-01.md), retaining the same model IDs and families while explicitly freezing the endpoint, limits and Gemini client route.\
The first independent review found three evidence-boundary defects in the new execution/accounting tooling; its [FAIL](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-03.txt) is preserved.\
The [second recheck](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-04.txt) found one remaining judge-job attribution defect; its FAIL is preserved.\
The [job-boundary correction](reviews/admission-lifetime-assurance-r4/admission-evidence-correction-02.md) now uses completed public job records and exact per-job reconciliation; its [independent static readiness recheck](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-05.txt) is PASS, with 26 static tests independently passing.\
The [resumed preflight](reviews/admission-lifetime-assurance-r4/admission-execution-preflight-02.json) stopped execution on the then-frozen runtime mismatch and remains unchanged.\
The director selected the [prospective runtime amendment](reviews/admission-lifetime-assurance-r4/admission-runtime-amendment-01.md); its [independent exact-checkpoint recheck](reviews/admission-lifetime-assurance-r4/admission-provider-readiness-06.txt) is PASS for static/configuration readiness, with 26 independent static checks passing.\
The registered comparison passed all nine live profiles and completed with [full mechanical accounting](reviews/admission-lifetime-assurance-r4/records/2026-10-16-060526-admission-clarity/ADMISSION-ACCOUNTING.json): 144 outcomes, 192 cast votes and 96 explicit uncast slots for the two ended Gemini phases.\
Candidate thresholds and four control comparisons fail numerically; all raw records are committed and independent tally replay is identical.\
The [completed independent review](reviews/admission-lifetime-assurance-r4/admission-gate-review-01.txt) gives NO VERDICT: an accepted judge penalized accurate proposal-status wording despite acknowledging correct, complete and supported required decisions.\
The frozen rule makes that substantive scoring defect disqualifying for assurance; unfavorable scores and ended phases remain unchanged, with no retrospective rescoring.\
The director selected preparation of an evaluation-repair proposal; the [source findings](reviews/admission-evaluation-repair-findings.md) identify omitted judge context and a source-derived client output ceiling, without establishing the Gemini termination cause.\
The [proposal](reviews/admission-evaluation-repair-proposal.md) recommends explicit judging semantics, a reviewed public runtime configuration and bounded qualification before new assurance.\
The director then selected static preparation and independent review; the [replacement preparation](reviews/admission-evaluation-preparation/README.md) has an independent pre-build design/M7 PASS.\
The first exact-artifact review found a mixed-decision diagnostic contradiction; its FAIL is preserved, and the [corrected preparation](reviews/admission-evaluation-preparation/readiness-result.md) now has an independent static PASS at its exact checkpoint, with 27 checks independently rerun.\
The then-current evaluator's changed isolation-probe retry and final-only returned attempt record remain a [live-adoption blocker](reviews/admission-evaluation-preparation/runtime-compatibility.md#live-adoption-blocker-probe-retry-and-retention) for that revision; no live cap, calibration or fresh comparison is selected.\
The subsequent [compatibility review](reviews/admission-evaluator-compatibility-review.md) identifies the immediate upstream parent as a bounded candidate: it retains public cap support and the frozen probe, and the omitted mount restriction has no effect on this pack's empty on-request lists.\
The director selected bounded parent qualification; its [amendment](reviews/admission-evaluator-qualification/admission-qualification-amendment.md) passed independent pre-build design/M7 review before implementation.\
The [author results](reviews/admission-evaluator-qualification/admission-qualification-author-result.md) retain 50 passing tests, full fresh panel records, 34 rejected shape mutations, ordinary synthetic ledger/file evidence and legacy tally parity.\
The [independent exact-artifact review](reviews/admission-evaluator-qualification/admission-qualification-review-01.txt) now gives bounded STATIC QUALIFICATION PASS at `febde60940f04bd36210c06494b4e577b3377254`, with 37 checks independently passing and the complete fresh payload reconciled; it resolves only candidate compatibility.\
No live revision, cap, diagnostic or calibration is selected; real delivery/isolation, complete invocation capture and whole-conductor behavior remain unqualified.\
The [bounded diagnostic proposal](reviews/admission-diagnostic-proposal.md) then received an [independent design/M7 FAIL](reviews/admission-diagnostic-design-review-01.txt) for its ambiguous semantic-review resource boundary; that checkpoint remains unchanged.\
The separate [prospective amendment](reviews/admission-diagnostic-amendment-01.md) now has an [independent design/M7 recheck PASS](reviews/admission-diagnostic-design-recheck-02.txt), distinguishing ordinary review resources from driven diagnostic spending and requiring a capability-first zero-call stop before packet construction.\
The director selected that read-only inventory; the [completed stage 0a result](reviews/admission-diagnostic-capability-result.md) is a terminal zero-call stop, not a diagnostic FAIL or readiness PASS.\
The [pinned source inventory](reviews/admission-diagnostic-capability-findings.md) identifies missing supported request/spend, trace and retention evidence, while retaining the old isolation/delivery acceptance within its original scope.\
Actual deployed provider/account capabilities remain unknown; the director subsequently selected the bounded owner request.\
The [handoff record](reviews/admission-diagnostic-owner-handoff.md) preserves the initial local placement in context-lab; direct delivery to the provider operators still awaits their destinations.\
The maintainer's response was assessed and the correction request prepared; the director then selected its [local delivery](reviews/admission-diagnostic-correction-handoff.md) to context-lab.\
The [owner addendum assessment](VERIFICATION.md#467-zorg-fit-and-context-lab-replies-reconciled) now records the provenance, runtime-version and retry-attribution corrections.\
The request/spend, retention and exact-profile prerequisites remain unmet, provider contacts remain unconfirmed, and [follow-up feedback is placed](VERIFICATION.md#468-zorg-and-context-lab-feedback-handoff); the zero-call stop remains.\
Final public-contract ratification and verified implementation remain outstanding; no runtime repair is claimed.

| ID | Move | Note |
|---|---|---|
| `B53` | Resolve the outstanding capability and provider-owner dependencies | [Placed feedback](VERIFICATION.md#468-zorg-and-context-lab-feedback-handoff) retains unsupported/unknown prerequisites; assess new evidence when supplied, without inferring provider contacts, packet preparation or diagnostic execution |

---

## M14 - Establish feasibility for intended peers

Severity `I3`/`P3`: intended browser, identity and peer-scale capabilities are not yet established.\
Status: the corrected scale packet retains independent key/protocol PASS, with public-binding questions placed locally and awaiting context-lab's reply; scored execution is not ready, while the direct-peer design retains technical and scoped axiom PASS and its separate corrected instrument retains bounded key-recheck PASS.\
The [reply assessment](VERIFICATION.md#467-zorg-fit-and-context-lab-replies-reconciled) records qualified Zorg lifecycle fit; the [AGP acceptance mapping is drafted](VERIFICATION.md#470-direct-peer-assurance-acceptance-mapping), and the [correction-review follow-up is placed](VERIFICATION.md#471-context-lab-assurance-correction-review-and-follow-up) with context-lab.\
Execution readiness, documentation assurance, ratification, implementation and the declared credential-lifecycle API remain open.\
D49 remains the consumer browser requirement; shared-contract decisions, the operating envelope and browser acceptance remain open.

| ID | Move | Note |
|---|---|---|
| `B54` | Assess context-lab's browser-scale contract reply when available | [Handoff checkpoint](VERIFICATION.md#478-browser-peer-scale-public-binding-handoff) records the request about paired preregistration, model-free prompt inspection and exact delivery; placement is not acknowledgment or permission for implementation or model calls |
| `B6` | Resolve remaining AGP lifecycle adoption and carrier/client choices | [Placed response](VERIFICATION.md#468-zorg-and-context-lab-feedback-handoff) acknowledges the reconciled six-area fit without asking for repeated consumer work; AGP assurance/ratification, client fresh-key/refusal-rearm and concrete carriage remain open |
| `B50` | Reconcile browser carrier and runtime obligations | All 26 registry cases mapped; two Chrome versions expose CSP and native API gaps; D49 fixes Zorg's required browser coverage, while worker/CSP inputs permit portability proposals, not a full browser conformance claim |
| `B51` | Resolve the reviewed correction gaps and public execution bindings with context-lab | [Placed follow-up](../../context-lab/incoming/agp-assurance-compatibility-review.md) separates interrupted-reader accounting, bounded measurement, replay and CLI qualifications from heading and assigned-reading questions; assess the owner's next evidence without selecting execution or changing frozen rules |

---

## M17 - Check session timer deadline authority

Provisional investigation score `I3`/`P4`: elapsed-time protection is unestablished on the named timer paths; no premature AGP expiry or contract breach is claimed.\
Status: the source finding is recorded, with no runtime repair or reproduction.\
The review can proceed independently, but any shared controller changes must have one implementation owner with `B53`.

| ID | Move | Note |
|---|---|---|
| `B55` | Check session timer deadline authority | [Finding and scope](VERIFICATION.md#430-session-timer-deadline-authority); determine the guarantees owed by session expiry and transport close, account for early or stale callbacks, and define the correction and acceptance boundary without changing B53's frozen design by implication |

---

## Held

Scored on the same scale, so not choosing them is visible.

| ID | Held item | Impact | Breach | Revival trigger |
|---|---|---|---|---|
| `B5` | Full-mesh geometry and per-pair keying | `I3` | `P3` | A deployment that needs mesh. One key per node lets a single compromise forge every identity, so mesh needs a per-pair model first |
| `B7` | Route volume beyond 256 | `I3` | `P3` | A topology needing more than 256 routes. `D4` names deltas as the change required |
| `B12` | Split current and target architecture instants | `I4` | `P3` | A structural decision ratified before it is built. The trace graph currently records every requirement as built; `B47` and `B48` change no AGP structure. `B26` supplies the planned-state record when this trigger fires |
| `B4` | Cost model for matrix cells | `I4` | `P4` | Measured sweep runtime becomes a felt cost that the existing coverage-only selector cannot address. `B3` already supplies that selector; historical timings are not a current cost model. Sweeps remain on demand and on no schedule |
| `B8` | Named geometry tests onto shared builders | `I4` | `P4` | Duplication becoming a real maintenance cost. Their oracles are shape-specific, and rewriting a passing test to share a builder is a known way to weaken an assertion |
| `B41` | Judge whether the absorption register is evidence or ceremony | `I4` | `P4` | Reviewed after the spent `B40` trigger: retain provisionally, do not expand. Re-triage at `D40`, before any proposed reuse or expansion, or on an observed stale-purpose miss or conflicting duplicated reason. The [review](VERIFICATION.md#410-board-reconciliation) records both the real amendments and the absence of proof that a separate register caused them; folding reasons into traceability remains the leading alternative |
| `B19` | Reduce per-hop cost against the carrier | `I4` | `P4` | A source-backed optimisation hypothesis supported by fresh, clock-matched measurements under section 4.9 of the verification record, or a consumer showing felt cost. The old half-millisecond comparison predates later optimisations and is not a present baseline. No target or schedule is imposed |

---

## Decisions required

| Question | Blocks |
|---|---|
| Where should the Nexus/OpenCode and separate Codex provider-owner requests be delivered? | Direct provider-side handoff for `B53`; the [addendum assessment](VERIFICATION.md#467-zorg-fit-and-context-lab-replies-reconciled) records a workstation-owner routing lead, not confirmed provider contacts or guarantees; diagnostic execution remains stopped |
| Do we ratify the clarified admission contract after valid fresh-reader assurance? | `B53` adoption and implementation; [revision 4](reviews/admission-lifetime-correction-r4.md) retains independent technical and scoped M7 PASS, while the prior assurance FAIL remains unchanged and the completed new comparison supplies no valid assurance verdict |
| Do we adopt the proposed hundreds-of-direct-peers scope, and which reference envelope makes it testable? | `B54` intent amendment and scale acceptance; blocks endorsing numerical budgets for that deployment, not B53's already-owed correctness repair |
| Do we ratify the reviewed local-redeemer lifecycle after remaining assurance? | `B6` lifecycle adoption and implementation selection; [qualified consumer fit](reviews/admission-use-lifecycle-fit-response.md) covers the authorization, handoff, shared clock, finite configuration and observation/grace choices, but is not AGP ratification or production acceptance |
| Which common proof/carriage profile and fresh-key/refusal-rearm contract should follow? | `B6` and `B50` authenticated CLI/browser integration; the [fit response](reviews/admission-use-lifecycle-fit-response.md#remaining-joint-work) leaves concrete carrier completion/cleanup, credential carriage and client lifecycle as separate design work |
| What resource and terminal guarantees can the agreed browser support set honestly satisfy? | `B50` browser conformance claim and contract revision; not independent portable-runtime proposals |
| Do we ratify the reviewed direct-peer send contract after the remaining documentation assurance? | `B51` adoption and implementation selection; the [prepared recommendation](reviews/direct-peer-send-adoption.md) carries the independent review's guardrails and explicit absorption obligations, not runtime acceptance; ordinary D26 behavior is unchanged |

The [comparison handoff](reviews/admission-lifecycle-comparison.md#9-contract-impact-and-next-handoff) names the remaining owner agreements and contract impacts.\
The [completed survey](surveys/shared-transport-survey.md) adds bounded cleanup overlap and application-owned offline work; its mixed sequencing picks remain explicit.\
Zorg's six-area lifecycle fit and the earlier context-lab capability replies have [recorded assessments](VERIFICATION.md#467-zorg-fit-and-context-lab-replies-reconciled); the [correction-review handoff](VERIFICATION.md#471-context-lab-assurance-correction-review-and-follow-up) now records the unresolved owner corrections and public binding questions, and neither preparation nor handoff adopts an AGP contract or authorizes implementation.\
The `B49` and `B52` corrections implement existing contracts and settle none of these design choices; consumer-owned work still needs its owner's agreement.\
No readiness helper, RPC layer, wire extension or authentication mechanism is approved by this triage.

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
