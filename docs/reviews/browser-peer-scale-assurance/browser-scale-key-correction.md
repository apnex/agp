# Browser peer scale key correction

Status: author correction awaiting a scoped commit and independent recheck.\
Tier 3 - author disposition of the [independent key audit](browser-scale-key-audit-01.txt), not a replacement verdict.\
The director selected correction of the two protocol defects; the scale proposal, source readings, questions and reader instructions remain unchanged.

The original FAIL applies to `94ace293ad3ffc60fa048ac6f963d37d6c618314`.\
Reviewer `/root/browser_scale_key_audit` used a fresh session without this conversation and performed a static, read-only assessment; the report is retained in full, with its citations referring to that original revision.\
It found the eight question-specific requirements supportable, but rejected the comparison rule and judge-delivery contract.

---

## 1. Comparison correction

The former non-regression condition was:

> No control's candidate sum is below its baseline sum; gains elsewhere cannot offset a control regression.

The review supplied this logical example, not observed reader results:

| Questions | Baseline sum per question | Candidate sum per question |
|---|---|---|
| Q01 | 5 | 6 |
| Q02 through Q04 | 6 | 6 |
| Q05 through Q08 | 6 | 5 |

Each five can arise from scores of 2, 2 and 1, so the old candidate floor and control checks could pass while all four scale questions regressed.\
The illustrative total falls from 47 to 44; a total is explanatory here, not a substitute acceptance criterion.

**Correction:** the candidate sum must be at least the baseline sum for every question Q01 through Q08.\
The two-full-scores/no-zero floor and at least one strict question gain remain; all ties still establish no improvement.\
The [numeric declaration](browser-scale-comparison-rule.json) records these predicates, and [packet checks](browser-scale-packet.test.mjs) exercise the reported case, every question's regression, ties, genuine gains and invalid score fixtures.

This is question-level non-regression, not a claim about statistical significance or every model family improving.\
Complete eligible accounting and inspection of raw observations remain separate mandatory conditions in the [protocol](browser-scale-assurance-preparation.md#4-proposed-comparison-rule).

---

## 2. Judge delivery correction

The earlier key required exact delivery while its common rules and Q05 wrong-conclusion text exposed the treatment mapping.\
These original strings remain historical evidence, never judge input:

> Interpret each assigned reading on its own terms. A faithful old-scope answer is not wrong, and a justified absence is not penalized for failing to assert the proposed policy.
>
> Grade the baseline's faithful small-scope answer as incorrect because the preferred direction is larger.
>
> Treat the candidate target as verified support for every runtime/workload or all large topologies.

**Correction:** neutral wording preserves the same obligations: judge the assigned policy faithfully, allow justified absence and do not infer verified support from a deployment target.\
The cover rule is also stated without comparing versions; the former administrative delivery rule is held in the protocol, while the judge rule directs interpretation of the supplied question, answer, requirements and reading.

The [pure projection](project-browser-scale-judge-key.mjs) retains all scoring definitions and common rules, then selects every question's common and assigned requirements, wrong conclusions and applicable grounding excerpts.\
It performs field selection and ordered concatenation, not text redaction, requirement rewriting or scoring.\
Status, correction history, control/scale tags, reading-role fields and the other branch are omitted by an explicit field selection.

The manifest associates the two retained judge keys with their readings for analyst use only.\
A judge receives only the requested question's projected entry, complete scoring/rules, exact question, answer and assigned reading, under neutral delivery names.\
The author key, manifest, comparison rule, other questions' keys, review history and role mapping are excluded.

The checks compare every retained grading field with its source and detect the known label-bearing prose.\
Those checks do not prove semantic completeness independently or prevent all possible prose disclosures; both remain subjects of re-review and actual delivery validation.

---

## 3. Evidence and preservation

| Record | What it establishes |
|---|---|
| [Original independent audit](browser-scale-key-audit-01.txt) | The earlier revision's FAIL and the two correction criteria, with all eight question dispositions retained |
| [Updated input manifest](browser-scale-input-manifest.json) | Exact current input identities and the earlier revision/guidance lineage |
| [Historical preparation checks](browser-scale-preparation-checks.json) | Original author checks only; unchanged and not relabelled as correction evidence |
| [Correction checks](browser-scale-key-correction-checks.json) | New author-side results, source preservation and scoped tracking changes |

The source snapshots, paired readings, questions, reader instructions and reading projector are unchanged.\
No numerical threshold is relaxed and no answer from a scored reader exists to tune against.\
The correction changes this evaluation protocol, not AGP runtime behavior, configuration defaults or the proposed deployment scope.

---

## 4. Remaining gates

The original independent FAIL is not closed by these author changes.\
Commit the correction before independent re-review of the rule, neutral wording and complete judge projection.\
Public execution binding, actual isolation, eligibility/extraction, resource settings and separate execution approval remain prerequisites to scored readers.

Only a valid comparison can inform the later director decision; neither that comparison nor the scope statement establishes runtime capacity.\
No commit, push, independent re-review, scored run or outbound project response is selected in this correction step.
