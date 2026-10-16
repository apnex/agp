# Admission clarification comparison: no assurance verdict

Status: execution completed; the independent review found a substantive scoring defect, so this comparison cannot supply an assurance verdict.\
Tier 3: this handoff interprets the retained evidence and independent disposition; it does not replace either.

## Disposition

The [independent completed-measurement review](admission-gate-review-01.txt) gives `NO VERDICT` against evidence checkpoint `327a5f303a54f940c1b0dfbd057fb10d72800553`.\
Its complete report is preserved verbatim at `a73818e5a72b5c48252a99a6e4f40f11576069ae`.

The decisive case is candidate Claude answer `A16`, judged by Gemini.\
That judge acknowledged correct, complete and supported decisions, but assigned `1` because the reader accurately called the unadopted proposal a recommendation.\
Both assigned inputs expressly use that status; it is not uncertainty about the required decision.

The review establishes this as a substantive violation of the frozen scoring rule, affecting a control comparison.\
The [preregistration](admission-assurance-preregistration.md#validity-and-full-accounting) requires no gate verdict after such a post-response defect, even if other numerical conditions also fail.\
No score is repaired, excluded or replaced, and this disposition is neither PASS nor a valid-measurement FAIL.

## Retained execution

The [runtime amendment](admission-runtime-amendment-01.md) changed only the required OpenCode version, before the [exact-checkpoint readiness PASS](admission-provider-readiness-06.txt) and any live call.\
The [execution receipt](records/admission-execution-receipt.json), [run record](records/2026-10-16-060526-admission-clarity/run.json) and [author execution record](admission-execution-author-record-01.json) retain the versions, registration, commands, outputs and identities.

| Recorded quantity | Result |
|---|---|
| Live prerequisite profiles | All six reader and three judge profiles passed |
| Reader attempts | Six, with no retry: four valid answer phases and two behavior-ended phases |
| Outcome accounting | All 144 outcomes retained |
| Intended vote slots | 288: 192 cast, 96 explicitly uncast for ended phases |
| Judge replay | All 32 jobs and 32 replies reconcile; no completion retry or new model call |
| Public tally replay | Byte-identical; independently repeated on scratch records |

Both Gemini readers produced no final message or saved answer.\
Their preserved [candidate](reader-m42-g-events.jsonl) and [predecessor](reader-x19-g-events.jsonl) streams report `length`, zero visible output and reasoning-token use; they do not identify the responsible backend or client limit.\
The unchanged accounting rule retains all 48 ended-phase zeroes and their 96 uncast slots without salvage or retry.

The [unchanged numerical table](records/2026-10-16-060526-admission-clarity/ADMISSION-ACCOUNTING.json) fails candidate thresholds and controls `A08`, `A16`, `A17` and `A23`.\
It records eleven improvements, including all nine clarification headings, four regressions and nine ties.\
Those exploratory ratings do not establish validated improvement or cancel the failed numerical conditions.

## Interpretation and limits

The [independent review](admission-gate-review-01.txt) found no candidate quote-copying failures and did not establish a separate material candidate ambiguity in the asked decisions.\
It distinguishes missing decisive support or coverage from absent design rules, and the scoring defect from the Gemini behavior failures.

The measurement does not justify rewriting AGP's mechanism from the score differences.\
It also supplies no permission to ignore unfavorable outcomes, narrow the population or rerun toward a pass.

Earlier assurance failures, readiness reports and preflight stops remain unchanged.\
AGP runtime source is unchanged; public-contract ratification, verified implementation and B53 closure remain outstanding.\
No push or Zorg correspondence occurred.

The handoff, board and verification record pass the selected documentation checks.\
All 13 read-only board, record-integrity and architecture-record tests pass; these check record consistency, not AGP runtime behavior.\
The board and verification updates remain local alongside their pre-existing mixed changes.

## Proposed next action

Prepare a bounded prospective measurement-repair proposal, leaving the admission design and this evidence frozen.

- Trace the judge-delivered rubric against the preregistered distinction between required-decision uncertainty and accurate scope/status qualifications.
- Investigate the effective reader output limit from retained configuration and traces, keeping an unmeasured backend/client cause explicit.
- State the corrective procedure and its independent check before seeking authority for another measurement; the existing rule requires new questions/readers after a substantive post-response scoring defect.

This is a recommendation for selection, not authorization to change the experiment, make new model calls or adopt the design.
