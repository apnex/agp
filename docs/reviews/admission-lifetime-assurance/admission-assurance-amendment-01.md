# Admission assurance amendment 1: measurement readiness

Status: pre-execution correction, 2026-10-12; independent recheck required.\
Tier 3: scoring and disposition rules, not reader-performance evidence.

## Audit and scope

[MEASURED] The [first independent audit](key-audit-01.txt) rejected measurement readiness at `5e2265e45c247e86bf9f76c6797342ac66f66e41`: a judge-visible version label, ambiguous mandatory key content, two question boundaries and incomplete validity rules.\
[MEASURED] No scored reader, isolation reader or experiment registration had run before this correction.\
[ARGUED] This amendment refines the [original preregistration](admission-assurance-preregistration.md) before outcomes exist; it does not change either design, population, score scale, conservative aggregation, control requirement or ratification boundary.

---

## Key and delivery corrections

- Each key now numbers its required decisions and labels ancillary context explicitly; omitting ancillary context is not a defect.
- Q04 limits rejected-transaction revision claims to the route transaction; Q05 distinguishes owned synchronous disposal from external cleanup.
- Q06 asks metadata semantics only for the numeric-terminal node; ordinary-stop metadata detail and empty terminal projections are not mandatory.
- Q07 distinguishes initial capacity waiting from a real reservation refusal; the initial wait must not manufacture a session event, but event detail is not required.
- Q08 supplies reconnect and retry-budget eligibility, removes source-version labels and does not require an exact next attempt number or the unasked already-established adoption branch.
- Q10 consumer-wrapper retention and Q11 accepted-versus-configured retry detail are ancillary; Q12 accepts the supplied no-new-event-loop-scheduling statement as grounding.
- Judge delivery must contain no arm/order/candidate/control provenance; the manifest and this amendment remain auditor-only.
- Verify the actual public `judgeAll` prompt rendering with a capture-only adapter before scoring; its placeholder units and null votes are delivery-preview fixtures, never reader outcomes or judge evidence.

---

## Outcome accounting and validity

[ARGUED] Enumerate all 72 reader/probe outcomes and all 144 expected cross-family vote slots, including absences and failures.\
[ARGUED] A missing answer scores 0; if context-lab emits no unit for it, mark both vote slots `not cast: missing answer` and the outcome `deterministic zero`, never invent judge votes.\
[ARGUED] For every present answer, require two valid other-family votes; use their lower value, then apply the exact-quote cap.\
[ARGUED] Missing, malformed or nonmatching `QUOTE:` JSON source excerpts cap an otherwise-safe answer at 1; an unsafe answer remains 0.\
[ARGUED] Normalize whitespace only for exact-source matching; judges still decide whether an excerpt supports each decisive claim.

[ARGUED] A completed reader's truncation, wrong answer headings, missing file/answers or malformed quotes are reader outcomes, not grounds for infrastructure retry.\
[ARGUED] Context-lab's recorded behaviour failures remain reader outcomes and are not retried; retain their classification and deterministic zeros for unreached properties.\
[ARGUED] Use the pinned evaluator's actual error classification for runtime failures: isolation or infrastructure may retry once, behaviour never does; preserve every attempt and its trace.\
[ARGUED] The six-cell requirement means six measurement-usable outcomes: core-valid cells plus behaviour-failure dispositions, not six complete or high-scoring responses.\
[ARGUED] Unresolved infrastructure/isolation/delivery failure or missing valid votes for a present answer gives no gate verdict; a validly measured omission or low score can give FAIL.

---

## Interpretation and stop

[ARGUED] A majority hedge means at least two of the three readers within one arm/probe express uncertainty about a required decision; explicitly stating an intended scope limit is not a hedge.\
[ARGUED] Inspect observations and hedges in both arms against their actual text; the known predecessor Q08 defect does not itself become an unresolved candidate defect.\
[ARGUED] An unresolved material ambiguity affecting the candidate or comparison prevents PASS; faithful repetition of an unsafe supplied instruction remains document inadequacy, not reader invention.

[ARGUED] A substantive key, question, delivery or scoring defect found after responses exist requires independent substantiation and gives the affected measurement no gate verdict.\
[ARGUED] Preserve such outcomes as exploratory evidence; no retrospective key repair, regrade or selective rerun can turn them into a preregistered success.\
[ARGUED] Apply the original candidate thresholds, per-control comparisons and tie rule only after this validity accounting; do not replace them with the evaluator's general-purpose summary.

[OPEN] Commit this correction, verify actual prompt delivery and obtain the bounded independent recheck before registration or scored execution.\
[OPEN] Final adoption, implementation and B53 closure remain outside this assurance step.

---

## Delivery check

[MEASURED] The [prompt check](verify-admission-judge-prompts.mjs) exercised the pinned context-lab public renderer: 24 generated prompts covered all 12 questions/keys/rubrics, with no tested version/arm/provenance disclosure.\
[MEASURED] Its 72 placeholder units produced 144 null fixture vote slots; the capture-only adapter invoked no reader or judge.\
[MEASURED] Raw preview records are at `/tmp/agp-admission-prompt-preview.pf3DsT`; the first script attempt failed syntax checking before rendering, and the corrected attempt passed.\
[OPEN] This verifies delivery shape, not answer quality, isolation or a gate result.
