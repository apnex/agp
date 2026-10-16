# Admission evaluation repair proposal

Tier 3: author recommendation, 2026-10-17 Australia/Melbourne; not an independently approved replacement procedure.

Repair and qualify the document-comprehension evaluation before spending another full comparison on AGP.\
Keep the admission design frozen: the [completed review](admission-lifetime-assurance-r4/admission-gate-review-01.txt) invalidated the measurement, not the proposed mechanism.

Gemini is a reader and cross-family judge in this evaluation, alongside Claude and GPT.\
It is not an AGP runtime dependency, and a successful evaluation would not verify AGP's implementation.

## Two separate repairs

The [source findings](admission-evaluation-repair-findings.md) distinguish an observed scoring violation from an unresolved reader-stop cause.

| Concern | Proposed correction | Evidence required before another comparison |
|---|---|---|
| Judge penalized accurate proposal status | Deliver the common proposed/not-adopted context and define a hedge as uncertainty about an asked decision; preserve penalties for genuinely missing, conflicting or unsupported required decisions | Capture every rendered judge profile; independently check that the delivered rule matches the declared rule and distinguishes scope/status from required-decision uncertainty |
| Syntactically accepted reasons can contradict scores | Require each penalty to identify the affected required decision and deficiency; flag score/reason contradictions for validity review | Mechanical checks for mechanically decidable contradictions, plus a non-author semantic check; no automatic score repair, replacement judge or favorable retry |
| Gemini ended without answers despite a large declared model limit | Make the effective reply cap explicit through the existing public evaluator setting, with a reviewed upstream pin; verify the actual route and budget before choosing a value | Sanitized request metadata or a separately approved controlled diagnostic; retain visible output, reasoning use and finish reason separately |

The first repair belongs in AGP's experiment pack, not AGP's runtime.\
The third uses context-lab's public configuration seam; any missing generic request-recording capability belongs upstream, not in a copied harness.\
The source-derived 32,000-token default is a candidate contributor, not a diagnosis of the two Gemini failures; increasing a declared limit alone is not an established repair.

## Qualify the instrument before fresh assurance

1. Prepare a separate replacement packet with one authoritative scoring policy, a reviewed evaluator pin and an explicit bounded runtime profile, leaving the old packet intact.
2. Check delivered prompts without models, then independently review the scoring contract, public-interface compatibility, full accounting and evidence retention.
3. Seek a separate decision for a bounded calibration using unrelated material: contrast complete answers with accurate status qualifications, required-decision gaps, wrong decisions and missing support; separately exercise a reader task with representative input/output volume and file-writing requirements.
4. Freeze calibration cases, expected outcomes, call ceiling and stop conditions before any call; use sessions that cannot become assurance readers, retain every outcome and stop on a failed check rather than tuning against the hidden assurance questions.
5. Only after that qualification, prepare independently audited new questions and fresh reader sessions for both unchanged AGP inputs, then seek authority for the whole comparison.

Known old cases may inform development checks but cannot become fresh assurance evidence.\
Calibration must show the specific distinctions and runtime behavior it claims; a short canary only proves delivery/isolation, and passing calibration cannot guarantee every later judge decision.\
The completed-measurement independent review therefore remains necessary.

Preserve the existing six-reader population, cross-family judging, conservative aggregation, quote validation, complete outcome accounting and no-favorable-retry rule.\
Do not lower thresholds, omit Gemini or a regressing control, reclassify the old empty responses, or rewrite AGP to remove an accurate proposal-status statement.\
Any future change to population, thresholds or failure policy is a separate prospective decision, not hidden inside this repair.

## Cost and alternatives

Recommended: prepare the replacement evaluation and its qualification checks, with no model calls yet.\
This costs an upstream compatibility review and later bounded calibration before another full comparison; it addresses the evaluator without treating success by one model as AGP's objective.

- Rerun unchanged: repeats a known inadequate judging context and an unexplained runtime profile; it cannot correct the invalid comparison.
- Change AGP's design now: the evaluation does not establish a new mechanism defect to repair.
- Pause this assurance path: avoids more evaluation work but leaves B53 adoption pending; unrelated authorized AGP work can proceed.
- Replace the assurance gate: potentially legitimate, but requires an explicit new decision about what evidence is sufficient, not a quiet waiver after failure.

## Next decision

Select preparation of the replacement evaluation packet and its independent readiness review, without registration or model calls.\
The later calibration decision must include a finite call/cost budget, request-observation method and exact stop conditions; this proposal does not select a token value or assume backend access.

The original valid assurance FAIL and the later NO VERDICT remain unchanged.\
Public-contract ratification, implementation verification and B53 closure still require their own decisions and evidence.
