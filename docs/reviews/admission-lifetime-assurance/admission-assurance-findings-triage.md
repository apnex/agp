# Admission assurance findings triage

Status: author assessment for director selection, 2026-10-12; no new gate verdict or adopted design.\
Tier 3: `[MEASURED]` records source observations; `[ARGUED]` marks their interpretation and recommended action.

Yield: twelve probe groups and both arms' reader observations reconciled; two design-closure items recommended, no runtime repair or mechanism rewrite delivered.\
The [independent assurance FAIL](admission-gate-review-01.txt) stands unchanged.\
[ARGUED] Prepare a scoped clarification of expiry ownership and teardown-budget configuration, with the inherited rules made explicit at their points of use; do not rewrite the architecture to chase quotation scores.

## Evidence and method

[MEASURED] Read all six complete answer files, their observations, all 144 retained vote reasons, both frozen reader documents and their difference.\
The [run](records/2026-10-12-032023-admission-lifetime/run.json), [votes](records/2026-10-12-032023-admission-lifetime/judging/votes.json), [blinded-unit mapping](records/2026-10-12-032023-admission-lifetime/sealed/units.json) and [accounting](mechanical-accounting.json) remain unmodified.

| Arm | Complete reader records |
|---|---|
| Predecessor | [Claude](records/2026-10-12-032023-admission-lifetime/cells/admission-lifetime.d41.c.1.json), [Gemini](records/2026-10-12-032023-admission-lifetime/cells/admission-lifetime.d41.g.1.json), [GPT](records/2026-10-12-032023-admission-lifetime/cells/admission-lifetime.d41.o.1.json) |
| Candidate | [Claude](records/2026-10-12-032023-admission-lifetime/cells/admission-lifetime.p87.c.1.json), [Gemini](records/2026-10-12-032023-admission-lifetime/cells/admission-lifetime.p87.g.1.json), [GPT](records/2026-10-12-032023-admission-lifetime/cells/admission-lifetime.p87.o.1.json) |

[MEASURED] The frozen input hashes still match the [manifest](admission-input-manifest.json); the standalone revision 3 file matches its retained source copy.\
Relevant FSM, routing, operations, SDK and runtime files are unchanged between source revision `f16266aaafa66f6301d7afbf09c55e3a1f990274` and the result checkpoint.\
Current guidance was read from a clean mission-kit checkout matching remote main at `45a0fc205a4820fcc60e8eb1799d2b6d788eb7dc`; this does not amend the experiment's frozen guidance pin.

[ARGUED] A missing quotation establishes incomplete grounding under this rubric, not absence of the rule from the design.\
A design-closure item must identify different implementation choices left open by the supplied text.\
An inherited contract found outside the reader packet can guide a revision, but cannot retroactively support a reader's answer or raise its score.

---

## Required-decision disposition

The [frozen questions and key](admission-lifetime-probes.json) define what was scored; the table classifies the recorded reasons rather than regrading answers.

| Probe | Recorded shortfall | Source reconciliation and disposition |
|---|---|---|
| Q01 | Settlement plus disposal or prohibited late effects not fully quoted | Already explicit in [three lifetimes](inputs/p87/DESIGN.md#three-lifetimes) and [sequence/invariants](inputs/p87/DESIGN.md#admission-sequence-and-invariants); retain mechanism, no new refund rule |
| Q02 | Reducer-only insufficiency omitted; some release/check details unquoted | [Baseline](inputs/p87/DESIGN.md#source-baseline-and-related-path) explicitly requires guards before all effects, not only the last reducer; [sequence](inputs/p87/DESIGN.md#admission-sequence-and-invariants) names application-time checks. Separate this grounding miss from the expiry-owner question below |
| Q03 | Hold/credit restrictions or single-reader/early-cancellation restrictions omitted or unquoted | Present in [ordered input](inputs/p87/DESIGN.md#ordered-input-and-teardown); candidate Claude's semantic-disposal question is a different issue from whether transport FIFO must drain |
| Q04 | No ACK on failed validation or immutable-subset support incomplete; candidate Gemini quote cap | [Preparation/dispatch contract](inputs/p87/DESIGN.md#runtime-terminal-preflight-and-commit-handoff) grants ACK authority only on committed outcomes; [route acceptance](inputs/p87/DESIGN.md#acceptance-obligations) supplies atomicity. Do not invent a new fault policy from the score |
| Q05 | External cleanup timing omitted; handoff steps not fully quoted | The numbered [terminal sequence](inputs/p87/DESIGN.md#one-node-owned-terminal-sequence) and its following paragraph already separate synchronous detachment from later external cleanup; make that boundary easier to carry into an answer, not a second cleanup mechanism |
| Q06 | Gemini omits explicit last-known interpretation | [Terminal accounting](inputs/p87/DESIGN.md#terminal-accounting-recommendation) states it directly; this is the only candidate probe meeting the threshold, not permission to drop its limits |
| Q07 | Refusing-pool persistence/clearing, acquisition guards or projection fields incomplete | Present in [capacity-wait lifecycle](inputs/p87/DESIGN.md#capacity-wait-lifecycle-and-projection); separate initial and retry scenarios prospectively, because their histories and reconnect eligibility differ |
| Q08 | Two answers leave lost-winner clearing implicit | The [supervisor table](inputs/p87/DESIGN.md#capacity-wait-lifecycle-and-projection) names winner loss/backoff but does not explicitly say to clear winner ownership in that row; state that transition explicitly. Keep the establishment-only reset; do not restore the predecessor's early reset |
| Q09 | Cooperative cancellation/continued accounting or API/migration details incomplete | [Public choices](inputs/p87/DESIGN.md#public-surface-and-migration-choices) and [sequence](inputs/p87/DESIGN.md#admission-sequence-and-invariants) contain the rules. Show optional second argument versus required signal within supplied options precisely; no mandatory provider migration or browser-specific port |
| Q10 | Hidden-work owner, retained data or unmeasured-default claims unquoted | Already explicit in [three lifetimes](inputs/p87/DESIGN.md#three-lifetimes) and [limits](inputs/p87/DESIGN.md#timers-and-resource-limits); neither a new resource guarantee nor scale tuning is warranted |
| Q11 | Atomic route outcome or existing `INTERNAL_ERROR` classification unquoted | Present in [acceptance](inputs/p87/DESIGN.md#acceptance-obligations) and [capacity treatment](inputs/p87/DESIGN.md#timers-and-resource-limits); no new wire classification |
| Q12 | Execution/transport limits unquoted, plus one exact-quote cap | [Teardown](inputs/p87/DESIGN.md#ordered-input-and-teardown) states those limits; retain them and separately close the budget-source question below |

[MEASURED] The predecessor and candidate share the control text; their changes concern retry-success history.\
[ARGUED] The four regressing controls therefore do not establish four damaged mechanisms or a causal effect of the retry edit.\
The observed comparison still fails its no-regression condition.

---

## Reader observations and inherited rules

These dispositions include observations outside scored decisions; none is silently added to the old key.

| Observation | Reconciliation | Consequence |
|---|---|---|
| Expired result reaches the executor before its timer | Candidate forbids all result effects, but does not expressly assign the expiry transition to that turn or the later timer | Resolve in the clarification below; not a proved stale-result-authority defect |
| Teardown has no named budget setting/value | Candidate says one budget starts at terminal-cause commit, without naming its source | Resolve in the clarification below; a numerical omission is not proof that bounded teardown is impossible |
| Queued semantic work after a fatal notification | [FSM invariants](../../design/fsm.md#3-controller-state-and-invariants) and [teardown](../../design/fsm.md#7-teardown-order) revoke protocol authority; the packet explicitly forbids protocol effects after release but uses tentative wording for already-queued semantic work | Say that all terminal causes invalidate/dispose semantic backlog while the sole reader drains transport evidence; make evidence preservation distinct from executing old commands |
| Route invalid result, expiry and identity denial/fault codes | [FSM events](../../design/fsm.md#4-semantic-events), [identity transitions](../../design/fsm.md#64-opensent), [route transitions](../../design/fsm.md#66-established) and [route continuation](../../design/fsm.md#67-route-admission-continuation) already own them | Carry or precisely reference the inherited rows; do not choose new codes or confuse policy denial with malformed result |
| Insufficient RIB capacity at final commit | [Routing validation](../../design/routing.md#52-route-validation-classes) and [capacity admission](../../design/routing.md#53-deterministic-capacity-admission) prescribe canonical per-route nonfatal `CAPACITY` rejection, followed by atomic replacement/ACK | This is not an undefined session-fatal condition; connect the delayed-policy proposal to that existing rule |
| Empty policy-eligible subset | [FSM route-start row](../../design/fsm.md#66-established) invokes the batch port for a valid update; [result contract](../../design/fsm.md#67-route-admission-continuation) requires decisions only for eligible tuples | Existing rules supply no empty-subset invocation exemption; make the empty batch/result explicit, not a new optimization |
| Ordinary-stop cleanup revision and timestamp | [Operations revision rules](../../design/operations.md#32-snapshot-metadata-and-revisions) distinguish canonical mutations from queries; candidate says stopped accounting stays live until numeric terminalization | Explicitly apply ordinary revision rules to cleanup updates; no unrevisioned public gauge mutation or new post-failure domain |
| Missing numeric defaults, retry arithmetic or nonconforming-transport fallback | Defaults reference resolved settings; existing retry rules own progression; transport conformance is a stated assumption | No peer-capacity claim or invented rescue guarantee; use named dependencies instead of duplicating unrelated policy |
| Q07 combines initial and repeat histories | Claude flags the wording; GPT explicitly treats them as separate contrasts | Future questions should state separate eligible histories, not change supervisor behavior; preserve the existing independent validity verdict |
| Pending adoption, type/schema changes and publication inventory | These are explicit remaining obligations in the candidate | Keep them as gates on adoption/implementation, not evidence the mechanism already exists |
| Undefined notification safety and unrelated instruction marker | Safe notification inherits existing terminal/writer constraints; the marker carried no design content | No new AGP requirement; preserve the original observations and do not use the marker as source support |
| Predecessor retry-reset conflict | Candidate explicitly distinguishes identity ownership from exact `Established` success | Retain the correction and its scoped technical review; an assurance FAIL does not reinstate the unsafe predecessor rule |

---

## Two design-closure items

### Expiry discovered during result application

[MEASURED] [Candidate sequence](inputs/p87/DESIGN.md#admission-sequence-and-invariants) says to reject elapsed results regardless of timer delivery, then separately describes expiry handling.\
It does not explicitly choose between disposing that result and waiting for the scheduled expiry input, or completing expiry in the current serialized turn.\
Both readings deny result effects, but differ on when cancellation, terminal cause and teardown ownership are committed.

[ARGUED] Recommended clarification: the first current serialized path that observes the deadline elapsed commits the existing kind-appropriate expiry transition through the shared lifetime owner; later timer/result paths are inert under the same token and terminal guards.\
This makes bounded cleanup independent of a second callback after expiry is already known, without creating a second expiry owner.\
Review the exact clock/check/terminal ordering before adoption; no claim that this behavior is implemented or that the old score proves a bug.

### Total teardown budget

[MEASURED] [Current configuration](../../../packages/node/src/node.ts) defaults `transportCloseTimeoutMs` to 5,000 milliseconds and `transportWriteTimeoutMs` to 10,000 milliseconds.\
The current [release path](../../../packages/node/src/session-controller.ts) already starts its close timer before awaiting notification write, but only gives cancellation to the later `close()` call.\
The candidate requires active enforcement but leaves the setting supplying its single terminal-to-release budget unnamed; the [FSM timer table](../../design/fsm.md#5-timers) still describes transport-close timing from graceful-close start.

[ARGUED] Recommended clarification: assess reusing the existing resolved close-timeout setting as the total teardown budget, anchored at terminal-cause commit, with no restart or extension at later close/drain phases.\
This matches the existing release path's timer placement, but its expanded public meaning and writer/deadline precedence must be recorded explicitly.\
A separate teardown setting is a real alternative if independent close timing must remain configurable; it adds a public field and another precedence rule.\
Do not silently infer either choice from the current draft or endorse either value for hundreds of peers.

---

## Prospective assurance and next action

[MEASURED] Q02 judges disagree about whether executor checks implicitly satisfy the reducer-only requirement; Q08 judges differ on implied lost-winner clearing.\
Quote fidelity independently caps fifteen answers but changes only three final outcomes.\
[ARGUED] Those are instrument sensitivities to retain, not grounds for author regrading or erasing the failed result.

Recommended next move:

1. Draft one bounded clarification addressing the two closure items and the inherited-rule links above, preserving the one admission mechanism and selected public-contract direction.
2. Independently review its semantic changes and compatibility duties; leave the frozen predecessor, candidate, key and result untouched.
3. Preregister a fresh comparison only after that review, with fresh decision scenarios, explicit requested decisions, unchanged controls and separate records for wrong decisions, omitted decisions and missing/exact-format support. Keep source grounding and safety requirements; do not retroactively change this run's scale or gate.

Alternatives: retain the current draft and seek an explicit director gate override, which leaves the failed verdict and unclosed design choices visible; or defer, leaving B53's existing defect and consumer workaround in place.\
[ARGUED] Prefer the clarification because it closes named implementation choices without claiming that safer answers or more citations alone establish implementation readiness.

No new survey is required for this recommendation: the product outcome and lifetime-repair direction remain selected.\
Ratification, implementation, B53 closure, a new model run, publication and a new Zorg message are not performed or authorized by this triage.
