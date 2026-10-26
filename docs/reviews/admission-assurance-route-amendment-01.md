# Admission assurance route non-regression amendment

Status: prospective correction prepared; independent composite review and subsequent selection remain outstanding.\
Tier 3: AGP author amendment, 2026-10-26 Australia/Melbourne.

This amendment addresses findings 1 and 2 of the [independent route review](admission-assurance-revised-route-review-01.txt).\
Read it with the [frozen route](admission-assurance-revised-route.md); it is not a new assurance packet.\
[Decision 0004](admission-lifetime-approval-route.md#0004---preparation-only-retention-override-and-scoring-amendment) selects universal two-axis non-regression and records a preparation-only retention override, not a passing methodology or axiom verdict.

## 1. Evidence and replacement boundary

| Evidence | Measured SHA-256 and boundary |
|---|---|
| Frozen route | `a6a42f8fff9cb467d164523b158d1d44253cc1c209979c7ac868b5add457592b`; original 209-line proposal remains unchanged |
| Full independent report | `47ac7cfaaade410422742341066168cf6240c66654b1ebc85d875a62b00220f8`; methodology FAIL and scoped M7 FAIL remain unchanged |
| Evaluator owner's retention declaration | [Correction response](../../../context-lab/incoming/agp-admission-diagnostic-correction-response.md), `8d365d9faf48c8ca00b58a9ec1b07b938776ed0f0b50f61f642af997c0db60dd`; parent termination can lose buffered in-flight events |
| Later retention exclusion | [Compatibility response](../../../context-lab/incoming/agp-assurance-compatibility-correction-response.md), `eb2383187cdf8d05ccf5da7b0f3e9dbca40d1ff63da7b7a839a974535b84d904`; returned-attempt records do not close parent-termination loss |

The normative changes are limited to route section 5's condition 3 and the preparation disposition of the section 6/7 retention gap.\
The remaining validity, scoring, separation, resource, review and product gates continue unchanged, with the review's qualification guardrails retained below.\
No old result is rescored; the original assurance FAIL, later NO VERDICT and R4 technical review keep their separate meanings.

---

## 2. Every-probe two-axis non-regression

Replace condition 3 in the frozen route with:

> For every probe, the candidate arm's integer total must be at least the predecessor arm's integer total on each scoring axis separately, using the same three assigned readers in each arm.
> This applies to controls and clarifications, separating and nonseparating probes alike.
> No gain on another probe or on the other axis can compensate for a loss.

For probe `q`, let `D_old(q)` and `D_new(q)` be predecessor and candidate decision-correctness totals, each in `[0, 3]`.\
Let `G_old(q)` and `G_new(q)` be their grounded-usability totals, each in `[0, 6]`.\
Each total sums the three reader outcomes after the frozen route's conservative other-family minimum and, for grounding only, any downward quote cap.

Condition 3 is the conjunction, over all twenty-four probes, of `D_new(q) >= D_old(q)` and `G_new(q) >= G_old(q)`.\
Classification or separation cannot remove a probe from this predicate.\
The no-document arm is used for separation, never as a substitute predecessor or a weaker non-regression baseline.

This retains the route's per-probe arm-total grain, not a new family-wise test.\
The same three families remain assigned in every arm, but equal totals can conceal a loss in one family's outcome offset within that probe and axis by another family's gain.\
Report those underlying outcomes; do not claim family-wise non-regression, population superiority or statistical significance.

### Complete gate composition

Route section 5's conditions 1, 2, 4 and 5 remain in force alongside the replacement condition 3:

- Independent validity review reconciles every assigned slot and rejects unresolved delivery, isolation, extraction, record or substantive scoring defects.
- Every candidate probe still needs at least two of three conservative grounded scores equal to `2`, with none equal to `0`.
- Separating probes must cover all seven duties and public migration, with at least one separating strict grounded-usability improvement over the predecessor.
- Unresolved material candidate/comparison ambiguity still prevents PASS; majority uncertainty is checked against the supplied text.

Validity precedes the binary gate.\
A valid comparison with any negative per-probe axis difference is FAIL even if every other probe improves.\
Missing or unassignable evidence, or a substantive scoring defect, instead leaves NO VERDICT; arithmetic cannot repair it.\
Demonstrated behavioral absence retains zeroes and explicit uncast slots, never a smaller denominator or favorable separation credit.

### Analytical boundary cases

These are acceptance examples, not generated reader outcomes or an executed evaluator test.

| Case | Required consequence |
|---|---|
| Review's separating clarification: old `D=(1,1,1), G=(2,2,2)`; new `D=(1,1,0), G=(2,2,1)`; no-document `D=(0,0,0)` | Totals fall from `3/6` to `2/5`; condition 3 fails despite the candidate floor and separation |
| Decision loss with grounding gain: old `D=(1,1,1), G=(2,1,1)`; new `D=(1,1,0), G=(2,2,1)` | Decision total falls from `3` to `2`; grounding's rise from `4` to `5` cannot compensate |
| Grounding loss without decision loss: old `D=(1,1,1), G=(2,2,2)`; new `D=(1,1,1), G=(2,2,1)` | Grounding total falls from `6` to `5`; correct decisions alone cannot discharge condition 3 |
| Any control or nonseparating probe has a negative axis difference | Same rejection; neither classification creates an exemption |
| All per-probe totals tie | Condition 3 holds, but the required strict improvement in condition 4 is absent; no overall PASS |
| Cross-family redistribution leaves each per-probe total unchanged | Condition 3 holds at its declared grain, not a claim that every family's outcome was preserved |
| An answer or required vote is lost | NO VERDICT, not a scored zero, denominator reduction or ordinary non-regression FAIL |

For any probe and axis with a negative difference, one required conjunct is false.\
Other probes, the other axis and separation do not occur inside that conjunct, so none can reverse it.\
The later exact packet must mechanically check this predicate and retain every computable per-probe difference, including adverse outcomes in an otherwise invalid run.\
Unknown outcomes remain explicitly unknown, never computed as zero; no acceptance engine is implemented here.

---

## 3. Preparation-only retention override

Decision 0004 explicitly accepts the review's finding 2 as an A4 deviation for route preparation.\
It does not argue that invalidation preserves lost evidence or turn the scoped M7 FAIL into PASS.\
The owner-declared gap includes already emitted substantive answers and adverse observations that never reach durable records.

| Boundary | Selected disposition |
|---|---|
| What may proceed | Author this correction and prepare the route's review handoff despite the known retention gap |
| What is overridden | Only the retention-related prerequisite that would otherwise stop preparation under the failed scoped M7 gate |
| What is not overridden | Finding 1's scoring defect, any other review finding, independent composite review/selection, exact-packet readiness, document assurance or product gates |
| Experimental authority | None; a later execution decision must explicitly re-examine and accept the exact profile's loss exposure, or require qualified durable capture |
| Evidence after interruption | Preserve the manifest, surviving records, missing identities and uncertainty; incomplete invocation evidence invalidates the whole comparison |
| Recovery | No inferred outcome, automatic resume, selective replacement, favorable retry or cross-run splicing; any rerun needs a new decision and exposure disposition |
| Knowledge claim | Surviving evidence is retained; lost evidence remains lost, and neither its contents nor its absence can be reconstructed by assertion |

The deferred alternative is supported durable capture from the evaluator owner, followed by exact-profile qualification.\
Its cost is unresolved owner work; selecting it now would keep this route held, while holding all work would leave Zorg's native dependency unresolved.\
The chosen preparation costs author/review effort without granting experimental spending; later execution could lose knowledge and waste already incurred invocations.

Revival trigger: supported owner evidence of durable capture arrives, the selected profile's retention behavior changes, or an exact execution decision is requested.\
Each trigger requires re-triage of the retention boundary; it neither resumes an experiment nor carries this preparation exception into execution automatically.\
AGP does not implement a private persistence mechanism or send an owner request under this amendment.

---

## 4. Retained review and qualification obligations

| Review finding | Obligation retained for the later packet |
|---|---|
| 3: extraction completeness | Qualify the complete raw, bounded, selected, masked and judged text relation, including observations and noncanonical responses; only the public extractor produces judged text |
| 4: semantic scoring | Review complete answers, assigned inputs and accepted reasons; grounded `2` requires complete correct decisions, so a corresponding decision `0` needs investigation, not score repair |
| 5: descriptive separation | Keep fixed matched families, the one-third decision margin, all-nine-present favorable-separation rule and full duty/public-migration coverage; no significance or family-wise claim |
| 6: accounting and resources | Reconcile 432 axis outcomes and 864 vote slots, with explicit uncast slots; enumerate isolation probes separately from previewed reader/judge jobs, and do not call `9 + 2P + 3J` a provider ceiling |

The flat grammar remains a proposed restriction, not demonstrated extraction completeness or closure of B51/B50's owner requests.\
Exact routes, limits, calibration allowance, observed-cost stop rules and every retry association remain mandatory later; no historical budget is inherited.\
The product applicability pin and all seven B53 implementation duties remain unchanged.

---

## 5. Independent recheck and delivery boundary

Next recommended action: authorize one non-author read-only methodology/scoped M7 recheck of the exact frozen route, this amendment, decision 0004 and the original failed report.\
That assignment must examine the combined acceptance rule and the exception's actual scope, retain any remaining FAIL and distinguish a recorded override from alignment.\
It must not rewrite the original verdict or interpret preparation authority as permission to construct the exact packet.

No reviewer is assigned by this amendment.\
After a satisfactory disposition of the non-overridden findings and director selection, exact packet preparation may be selected; key/readiness review, conditional calibration/execution approval and completed-measurement review remain later gates.\
Public ratification, complete implementation, independent runtime verification and publication still precede Zorg's adoption; no new consumer requirement is needed here.

### Mechanics

Replace the incomplete non-regression predicate, record the retention deviation and its bounded authority, and submit the composite for a separately authorized independent recheck.

### Rationale

Document sensitivity is not improvement, and invalidation is not preservation.\
The correction addresses the scoring defect without exception, while the explicit retention decision preserves the unresolved cost instead of asserting alignment.

### Consequence

This produces a reviewable prospective route, not an accepted packet, successful document assurance or delivered AGP functionality.
