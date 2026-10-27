# Admission lifetime approval route proposal

Current preparation selection, 2026-10-27: [decision 0007](#0007---question-correction-and-focused-confirmation) selects the six-question correction, scoped local commits, model-free checks and one focused independent confirmation.\
Earlier selections and verdicts remain historical; execution, product implementation, publication and sibling correspondence remain unselected.

Current preparation selection, 2026-10-26: [decision 0006](#0006---exact-packet-preparation-and-independent-audit) selects the exact packet, scoped local commits and one independent key/readiness audit.\
Experiments, product implementation, publication and sibling correspondence remain unselected; earlier banners below are historical.

Current review update, 2026-10-26: [decision 0005](#0005---independent-amended-route-recheck) records methodology PASS for the composite and the retained scoped M7 FAIL with its preparation-only override.\
Exact-packet preparation is now selectable, not selected; earlier banners and decisions below remain historical.

Prospective preparation correction, 2026-10-26: [decision 0004](#0004---preparation-only-retention-override-and-scoring-amendment) authorizes a scoring amendment and a retention-related scoped M7 override for preparation only.\
The earlier status statements and decisions below remain historical; the independent FAILs remain, with no document-assurance waiver, new reviewer assignment or experiment authorized.

Current preparation update, 2026-10-26: [decision 0002](#0002---revised-resource-and-interruption-boundary) authorizes a prospective route with explicit resource/interruption limits.\
The earlier proposal and decision below remain as-authored; no experiment, assurance exception or product implementation is authorized.

Status: bounded preparation selected; feasibility found no supported replacement path; no gate waived or implementation authorized.\
Tier 3: AGP author assessment, 2026-10-20 Australia/Melbourne.\
Evidence baseline: the [implementation map](admission-lifetime-implementation-map.md#evidence-identity-and-boundary).

Initial recommendation: retain the full reviewed repair and prepare a bounded fresh-reader assurance route that does not depend on qualifying the stalled three-provider diagnostic campaign.\
This changes how document usability would be judged, not the runtime obligations or the requirement for independent evidence.\
The director selected feasibility-first preparation, not execution or adoption of a replacement gate.\
The [feasibility finding](admission-reader-feasibility.md#feasibility-disposition---tier-3) stops packet construction under the proposed boundaries; a smaller population does not establish the missing resource and retention guarantees.

## 0001 - Bounded reader-route preparation

Status: ratified for preparation only.\
Date: 2026-10-20 Australia/Melbourne.\
Authority: director.\
Amends: none.\
Supersedes: none.\
Affects: `docs/BOARD.md`, `docs/reviews/admission-reader-feasibility.md`, and this proposal's preparation status.

[DIRECTOR] "continue as recommended" selected the offered bounded-route preparation, including one independent review agent and no experiment execution.\
[ARGUED] This selects an initial feasibility check over immediate resumption of the campaign, a policy exception or holding without investigation; it does not select weaker guarantees.\
[ARGUED] The cost is bounded preparation/review effort with no promise that a supported path exists.\
[OPEN] Packet construction depends on establishing that path; execution, final gate choice, public ratification and implementation require later authority.

---

## What is ready and what is not

| Question | Evidence-backed position |
|---|---|
| Do we need more requirements from Zorg to define the repair? | No missing consumer requirement was identified in this bounded mapping; the [frozen proposal](admission-lifetime-correction-r4.md) and [independent technical review](admission-lifetime-independent-review-r4.txt) already define the correction |
| Is the mechanism technically reviewed? | Yes, R4 has its own technical-completeness and scoped axiom PASS; neither approves the public changes or verifies code |
| Is the implementation scope mapped? | The [source inventory](admission-lifetime-implementation-map.md#operations-publication-inventory---tier-2) locates thirteen direct commits, five helper definitions and their callers, including data-plane effects; no implementation-readiness verdict is claimed |
| Has documentation assurance passed? | No: the original comparison remains [FAIL](admission-lifetime-assurance/admission-assurance-result.md), and the later comparison remains [NO VERDICT](admission-lifetime-assurance-r4/admission-assurance-result.md) because of a scoring defect |
| Why is the existing recovery route stopped? | Its [capability-first result](admission-diagnostic-capability-result.md) lacks supported request/spend, complete-retention and exact-profile evidence; these are evaluation prerequisites, not AGP runtime dependencies |
| Do later evaluator improvements close that stop? | The maintainer [reports delivered eligibility, replay, response-bound and retry-record corrections](../../../context-lab/incoming/agp-assurance-compatibility-correction-response.md), while explicitly excluding parent-termination retention and provider billing bounds; delivery of those features is not qualification of the B53 profile |

The publication inventory exposes two integration costs worth making explicit.\
First, moving thirteen calls behind a wrapper is insufficient: routing, collision, send admission, return-token allocation and subsequent delivery effects must participate in the authority boundary.\
Second, several affected interfaces are [already exported](admission-lifetime-implementation-map.md#public-surface-inventory---tier-2), so internal ownership does not exempt changes from public type compatibility review.

---

## The decision and alternatives

Decide how B53 may obtain document assurance before public-contract ratification and implementation approval.\
The [previous repair proposal](admission-evaluation-repair-proposal.md#cost-and-alternatives) already identifies prospective replacement as a legitimate separate decision, not an automatic consequence of an invalid run.

| Route | What it would establish | Cost and limitation |
|---|---|---|
| Retain the existing campaign | The previously selected multi-family comparison, after instrument repair, qualification and fresh assurance | Keeps its broader model-family coverage; waits for provider/account evidence and exact-runtime qualification that AGP cannot infer or supply from its runtime source |
| Prepare bounded fresh-reader assurance, initially recommended | Whether fresh intended readers can derive the full repair's authority, ownership, configuration and migration decisions from the frozen document, with controls against its predecessor | Preparation was selected but stopped at feasibility; still needs fresh questions, independent key review, multiple blinded readers, full accounting and a selected execution budget; a single-family implementation would lose cross-family coverage and must say so explicitly |
| Director accepts the remaining document-assurance risk | A prospective policy exception allowing a separately specified approval path without a successful fresh-reader result | Not an assurance PASS and not an E7 change of judge merely because the original tooling is inconvenient; must name the unmet requirement, risk accepted and remaining gates; not recommended while a bounded reader route may be available |
| Hold B53 and select another board item | No new assurance or adoption claim | No evaluation spending, but the defect and Zorg's wrapper remain; resume on supported campaign evidence or a new route decision |

Changing only the repair's scope is a different decision, not an assurance route.\
The [adoption record](admission-lifetime-adoption.md#costs-and-adoption-gates) allows considering the already-owed correction without optional cancellation, at the cost of no AGP cancellation signal to providers.\
That does not remove exact authority, bounded retention, ordered input or independent cleanup, and it is not selected here.

---

## Proposed bounded route conditions

These conditions are a candidate for review, not a preregistration or permission to invoke readers.\
The replacement must retain mission-kit's distinction between an author's reading pass and actual use by fresh readers.

First establish, read-only, whether an existing supported review surface can meet the proposed isolation, retention and resource boundary; no alternative runtime is certified by this proposal.\
If it cannot, return that concrete gap for a route decision before constructing a new packet or harness.

1. Retain R4's exact content identity and use the predecessor for controls; a material design change requires a new target and review, not inheritance of the existing PASS.
2. Define fresh probes from the seven [implementation duties](admission-lifetime-implementation-map.md#contract-and-proposed-duties---tier-1), not only from R4's edits; include public status, owner boundaries, resource accounting and migration costs.
3. Commit probes and an explicit answer key before reader exposure; obtain an independent key audit, including the distinction between accurate proposal-status qualifications and uncertainty about a required decision.
4. Use multiple fresh, blinded readers per version with only the assigned document; proposed starting population is three per version, with no session history, repository access or answer key.
5. Require grounded decisions and support, preserving guesses as guesses; a non-author adjudicator reviews raw answers and support, not only an aggregate score.
6. Before execution, fix validity rules, all correctness-critical pass conditions, control non-regression, no-favorable-retry policy and treatment of absent or interrupted answers; no threshold is inherited or lowered implicitly.
7. Record every assigned attempt and its outcome, including incomplete work; an ambiguous or invalid measurement supplies no verdict, not permission for selective replacement.
8. Select an existing supported reader/review surface and explicit resource envelope; delegated cold-reader sessions are driven evaluation work, not free ordinary review or an exemption from call/cost accounting.
9. Record an exact-packet readiness verdict before seeking execution authority; unsupported isolation, retention or resource controls stop that proposed route too.

The proposed reader-family distribution and adjudication scheme change the old experimental design and require prospective approval.\
The claim would be bounded handoff usability for the selected reader population, not cross-family superiority, runtime correctness or production fitness.\
No new AGP-owned evaluator, hidden provider retry or proxy-budget mechanism is proposed.

A ceiling on assigned reader/reviewer sessions is not a proven ceiling on hidden provider requests or currency spending.\
The new readiness packet must distinguish those bounds and obtain explicit agreement on any different resource-risk boundary; it cannot silently inherit or claim to satisfy the stopped diagnostic's guarantees.

The preparation decision would authorize an exact replacement packet and a named independent review only if delegation is explicitly included.\
It would not authorize reader execution, provider spending, public adoption, code changes, publication or downstream migration.

---

## Gates that remain separate

| Stage | Required evidence or authority | What it does not grant |
|---|---|---|
| Route selection | Director chooses a prospective route and its preparation boundary | No change to historical verdicts or execution authority |
| Replacement readiness | Independently reviewed exact packet and scoped methodology/axiom assessment, including resource and evidence boundaries | No fresh-reader result or AGP implementation approval |
| Document assurance | Validly completed fresh-reader work and a non-author verdict under the approved condition | No public-contract adoption or runtime acceptance |
| Public ratification | Director decision with checkable absorption of the choices below | No claim that implementation already satisfies them |
| Implementation and verification | Approved complete repair, public compatibility evidence, independent verification of the retained R4 obligations at an exact revision | No browser, scale, credential-lifecycle or physical-release claim beyond the verified boundary |
| Publication and consumer handoff | Separately authorized publication, exact delivered revision and explicit migration duties | No instruction to remove Zorg's wrapper without verified replacement and consumer agreement |

These records must not be conflated: a valid FAIL remains FAIL; an invalid run retains no verdict; a new gate has its own condition, judge and result.\
A director-authorized exception would be recorded as an exception, never as a successful experiment or as proof that missing evidence exists.\
This proposal itself has no independent methodology verdict and does not amend mission-kit or AGP's standing gates.

---

## Public choices and implementation order

Public ratification still needs to settle the following as explicit contract changes.

| Choice | Reviewed direction to retain | Absorption duty |
|---|---|---|
| Provider cancellation | Optional shared second argument containing `readonly signal: AbortSignal`; existing one-argument providers remain usable | Core/public exports, SDK declaration and compile-time compatibility; no signal in request/result schemas |
| Finite work and local refusal | Separate identity/route evaluation pools, bounded continuation queue and truthful capacity/overflow events | Configuration resolution, effective values, closed event schema/generated types, resource gauges and operations readers |
| Defaults | Ten-second admission budgets; continuation limits from receive capacity; evaluation pools from pending-handshake/session limits | Document finite starting policy, not measured tuning for hundreds of peers |
| Teardown interval | Reuse the five-second default close setting for the full terminal-to-cleanup interval | Explicit semantic migration; preserve independent per-send enforcement and no concurrent close/send initiation |
| Value domain | Effective positive safe integers for the selected finite bounds | Reconcile structural schema and factory acceptance; do not change the separately supported zero-hold meaning |
| Terminal accounting | Ordinary stopped cleanup can publish; numerical exhaustion freezes actual retained counts, revision and capture time | Operations contract, focused/aggregate views and no false zero or new telemetry authority |
| Adjacency projection | One retry owner, capacity reasons and establishment-only attempt reset | FSM, operations meaning and SDK/HTTP/CLI interpretation; no fabricated timer or active controller |

After approval, the implementation order follows ownership dependencies rather than a timer-only patch.

1. Absorb the agreed contracts and establish the prepared-state/numeric-preflight/terminal boundary across the [publication inventory](admission-lifetime-implementation-map.md#operations-publication-inventory---tier-2), including all exported-interface compatibility obligations.
2. Integrate the shared lifetime and finite work ledger with both admission ports, route preparation and the bounded continuation reader.
3. Complete OPEN, per-send and total-teardown composition, plus the single supervisor's capacity eligibility and establishment-only reset.
4. Verify the complete change and its ordinary behavior, reconcile all retained R4 acceptance obligations and operational views, then obtain independent acceptance before claiming closure.

These are implementation dependencies, not promises that an intermediate slice is releasable or that each slice needs a separate director decision.\
The technical review's guardrails remain attached to the whole correction.

---

## Next selection after feasibility

The selected preparation reached its feasibility stop; the [independent advisory review](admission-reader-feasibility-review-01.txt) supports that limited conclusion, not an assurance verdict.\
The [route decision](admission-reader-feasibility.md#route-decision-and-revival) names the supported-evidence, changed-boundary, explicit-exception and other-work alternatives.\
Recommendation: retain the evidence boundary and select independent board work while B53 waits, unless the director explicitly chooses a different resource/evidence-risk boundary.

No new information request to Zorg is needed for this decision.\
Zorg can be told that admission repair remains open and its wrapper remains necessary; this task sends no message and gives no release date.

---

## 0002 - Revised resource and interruption boundary

Status: ratified for prospective route preparation only.\
Date: 2026-10-26 Australia/Melbourne.\
Authority: director.\
Amends: 0001, only the resource/evidence-risk prerequisite for preparing a replacement route.\
Supersedes: none.\
Affects: `docs/BOARD.md`, `docs/VERIFICATION.md`, `docs/reviews/zorg-authenticated-peer-delivery-plan.md`, `docs/reviews/admission-assurance-revised-route.md`, and this proposal's current preparation status.

[DIRECTOR] "continue as per recommendations" selects the offered revised-route preparation: no guaranteed provider-spending ceiling, interrupted evidence may invalidate a run, and execution requires separate approval.\
[ARGUED] The selected option permits preparation under those named limits rather than waiting indefinitely for stronger provider/retention guarantees or waiving fresh-reader assurance.\
[ARGUED] Retaining the old boundary would leave native delivery waiting; an assurance exception would accept proceeding without the evidence this route still seeks.\
[ARGUED] Costs are preparation/review work, potentially wasted future invocations after interrupted capture, and no guaranteed cap on future hidden provider requests or currency; this decision itself approves no experimental spending.

[MEASURED] The earlier [feasibility finding](admission-reader-feasibility.md) remains intact for its old boundary; no previously missing capability is claimed to have appeared.\
[OPEN] The [prepared route](admission-assurance-revised-route.md) is a new proposal, not a preregistered instrument or a supported-profile verdict; comparison design, independent methodology/key review, qualification and execution limits still require their own gates.\
[OPEN] This signal authorizes no new agent assignment, packet execution, experiment, assurance exception, public-contract adoption, code change, publication or downstream migration.\
[OPEN] B51's extraction dependency and all B6/native qualification duties remain separate; no further Zorg requirements are needed for this B53 preparation.

[MEASURED] The board now records the choice as settled for preparation and presents review of the new route next; the [checkpoint](../VERIFICATION.md#4130-admission-assurance-revised-route-prepared) records author checks and preservation, not independent assurance.


---

## 0003 - Independent revised-route review

Status: ratified for one read-only review, completed.\
Date: 2026-10-26 Australia/Melbourne.\
Authority: director.\
Amends: none.\
Supersedes: none.\
Affects: `docs/BOARD.md`, `docs/VERIFICATION.md`, `docs/reviews/zorg-authenticated-peer-delivery-plan.md`, `docs/reviews/admission-assurance-revised-route-review-01.txt`, and this preparation record.

[DIRECTOR] "continue" selects the immediately offered independent read-only methodology and scoped axiom review, with no reviewer edits or execution.\
[ARGUED] A non-author challenge is needed before the proposed acceptance rule becomes an executable packet; author self-review would not discharge that gate, and further scoring would precede the required methodology review.\
[ARGUED] The cost is one ordinary review and its retention, not experimental spending or implementation work.

[MEASURED] The [complete report](admission-assurance-revised-route-review-01.txt) records methodology FAIL and scoped M7 FAIL for route SHA-256 `a6a42f8fff9cb467d164523b158d1d44253cc1c209979c7ac868b5add457592b`.\
[ARGUED] Its counterexample permits a separating clarification to regress on both decision correctness and grounded usability while another improvement supplies the PASS condition; its separate axiom finding distinguishes invalidating a run from preserving knowledge lost during interruption.\
[OPEN] This authorization is not acceptance of either defect, an override of the failed gate, a change to decision 0002, permission for another substantive review, or approval for packet construction, calibration, an experiment, public adoption, implementation or publication.\
[OPEN] The next selectable preparation is a prospective amendment that forbids regression on either axis for every probe and makes the evidence-loss deviation and its alternatives explicit for a director decision; no such amendment or exception is approved here.


---

## 0004 - Preparation-only retention override and scoring amendment

Status: ratified for the specified preparation only; independent composite recheck remains outstanding.\
Date: 2026-10-26 Australia/Melbourne.\
Authority: director.\
Amends: 0002, prospectively and only for the retention-related scoped M7 preparation prerequisite.\
Supersedes: none.\
Affects: `docs/BOARD.md`, `docs/VERIFICATION.md`, `docs/reviews/zorg-authenticated-peer-delivery-plan.md`, `docs/reviews/admission-assurance-route-amendment-01.md`, and this preparation record.

[DIRECTOR] "continue" selects the immediately offered recommendation: "amend scoring and authorize the retention exception for preparation only."\
[ARGUED] This authorizes a prospective every-probe, two-axis non-regression amendment and an explicit override of finding 2's retention-related stop on preparation; it does not accept finding 1's scoring defect.\
[MEASURED] The [full review](admission-assurance-revised-route-review-01.txt), SHA-256 `47ac7cfaaade410422742341066168cf6240c66654b1ebc85d875a62b00220f8`, records methodology FAIL and scoped M7 FAIL for frozen route SHA-256 `a6a42f8fff9cb467d164523b158d1d44253cc1c209979c7ac868b5add457592b`.\
[ARGUED] Those verdicts remain FAIL; this ruling neither converts them to PASS nor retroactively changes decision 0002's original authority or decision 0003's completed review grant.

[ARGUED] The accepted A4 deviation is that preparing this route may rely on an evaluator whose parent termination can lose in-flight evidence, including substantive answers and adverse observations already emitted but not durably written.\
[ARGUED] Invalidating such a comparison protects verdict validity but cannot recover that knowledge; surviving evidence, missing identities and uncertainty must remain, with no automatic resume, reconstruction, selective replacement or cross-run splicing.\
[ARGUED] The alternative is requiring supported durable capture first, at the cost of unresolved evaluator-owner work; doing nothing leaves the native delivery path held.\
[ARGUED] This choice spends preparation effort only; potential later costs include irreversible knowledge loss and wasted invocations, but no experimental spending is selected now.

[OPEN] The [prospective amendment](admission-assurance-route-amendment-01.md) needs an independently reviewed composite and subsequent selection before exact packet construction; author arithmetic and documentation checks are not that review.\
[OPEN] The override ends at preparation: any exact execution decision must explicitly reconsider and accept that profile's loss exposure or require qualified durable capture; it cannot inherit this exception implicitly.\
[OPEN] Re-triage the retention choice when supported durability evidence arrives, the selected profile's retention behavior changes, or execution authority is requested; no automatic resumption follows.\
[OPEN] No new agent assignment, experimental packet/key, calibration, model/provider experiment, document-assurance waiver, public adoption, product code, publication or downstream message is authorized.\
[OPEN] No further Zorg input is needed; B53's full repair and all dependent native deliverables remain open.



---

## 0005 - Independent amended-route recheck

Status: ratified for one read-only recheck, completed.\
Date: 2026-10-26 Australia/Melbourne.\
Authority: director.\
Amends: none.\
Supersedes: none.\
Affects: `docs/BOARD.md`, `docs/VERIFICATION.md`, `docs/reviews/zorg-authenticated-peer-delivery-plan.md`, `docs/reviews/admission-assurance-revised-route-recheck-02.txt`, and this preparation record.

[DIRECTOR] "continue" selects the immediately offered one independent read-only composite recheck; the accompanying question asks whether progress is closing Zorg's blocked asks.\
[ARGUED] Rechecking the corrected condition and recorded exception is needed before selecting the concrete packet; author checks cannot supply that independent verdict.\
[ARGUED] The cost is one ordinary review and its retention check, not an experimental invocation allowance.

[MEASURED] The [full report](admission-assurance-revised-route-recheck-02.txt), SHA-256 `74d3eab1acf1f075ff4f415c1c5cfc4fd8307f61166a74e1c50829e17ae8f5a6`, records methodology PASS and scoped M7 FAIL with decision 0004's preparation-only override beside it.\
[MEASURED] It identifies no remaining non-overridden blocker to exact packet preparation selection; the reviewer also confirmed faithful retention of all 352 lines.\
[ARGUED] This resolves the scoring-method preparation blocker, not the physical retention gap, document assurance or Zorg's native delivery dependency.

[OPEN] Next selectable work is preparing and locally committing the exact packet and reviewed input chain, with fresh probes/key, coverage, projections, public declarations, deterministic checks, execution limits and one independent key/readiness review.\
[OPEN] This review grant does not select that work, approve experiments, extend the retention override into execution, ratify public contracts, authorize implementation or publish a release.\
[OPEN] Zorg's four native deliverables remain open; no new consumer requirement or repeat interface agreement is needed.

---

## 0006 - Exact packet preparation and independent audit

Status: ratified for preparation, scoped local commits and one independent audit.\
Date: 2026-10-26 Australia/Melbourne.\
Authority: director.\
Amends: none.\
Supersedes: none.\
Affects: the new `docs/reviews/admission-assurance-packet/`, its reviewed B53 input chain, this record and current board/verification tracking.

[DIRECTOR] "continue" selects the immediately offered recommendation to prepare, locally commit and independently audit the packet, with no experiments yet.\
[ARGUED] The methodology recheck permits preparation under decision 0004's recorded retention exception; it does not establish execution readiness or change the scoped M7 FAIL.\
[ARGUED] Costs are author work, deterministic local/model-free public evaluator checks, scoped local commits and one non-author key/projection/readiness review against committed inputs.

[OPEN] Prepare twenty-four fresh purpose-derived probes, both-axis keys, coverage, neutral projections, public pack declarations, calibration cases, exact accounting and resource declarations.\
[OPEN] Unsupported public limits or incomplete qualification must remain explicit readiness holds, not invented flags, private evaluator code or execution permission.\
[OPEN] Commit only this packet and the reviewed B53 input chain before the audit; preserve unrelated dirty work and all frozen originals, questions, answers, scores and reports.\
[OPEN] No experimental reader, judge, provider, isolation or calibration invocation is authorized; no product ratification, implementation, push, sibling message or downstream migration is selected.\
[OPEN] Execution would require a separate exact-profile decision that re-examines retention risk, followed by its own validity and assurance gates; Zorg's native release remains open.

---

## 0007 - Question correction and focused confirmation

Status: ratified for the bounded prospective correction and one independent confirmation.\
Date: 2026-10-27 Australia/Melbourne.\
Authority: director.\
Amends: none.\
Supersedes: none.\
Affects: `docs/reviews/admission-assurance-packet/`, this record, `docs/BOARD.md`, `docs/VERIFICATION.md` and `docs/reviews/zorg-authenticated-peer-delivery-plan.md`.

[DIRECTOR] "continue" selects the immediately offered six-question correction and focused independent confirmation.\
[ARGUED] Explicitly ask the existing mandatory details in Q05/Q10/Q11/Q16/Q19/Q21, retaining the common keys, both axes, all three arms and full coverage; weakening the required decisions would not resolve the same instrument defect.\
[ARGUED] The cost is scoped author work, local commits, model-free public checks and one non-author confirmation; doing nothing leaves the key-fit failure unresolved.

[MEASURED] The prior [audit](admission-assurance-packet/key-readiness-audit-01.txt) found unasked requirements, not unsupported technical rules.\
[OPEN] Retain its reviewed declarations and failed report; prepare separate amended declarations and commit them before the focused check.\
[OPEN] One non-author review may inspect the six corrected question/key contracts, unchanged coverage/scoring, exact bindings and model-free results; it is not a fresh-reader experiment or a new broad design review.\
[OPEN] Preserve unrelated dirty work; no experimental reader/judge/provider invocation, calibration, live isolation, product change, push, sibling message or execution-risk waiver is authorized.\
[OPEN] Public resource controls, calibration binding, live-profile qualification and an execution-specific retention decision remain separate; no further Zorg requirement is needed.
