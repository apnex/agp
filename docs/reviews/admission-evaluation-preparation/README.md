# Admission evaluation preparation

This packet prepares a corrected evaluation instrument; it does not qualify a live run or change AGP.\
The [selected repair proposal](../admission-evaluation-repair-proposal.md) defines the scope.

## Prepared surfaces

| Artifact | Duty |
|---|---|
| [Design](design.md) and [independent pre-build review](design-review-01.txt) | Bound the static work and its mandatory safeguards |
| [Scoring policy](admission-scoring-policy.mjs) | One delivered policy, shared rubric and raw-vote contradiction checker |
| [Unrelated cases](admission-scoring-cases.json) | Explicit author expectations for independent semantic review, not model observations |
| [Static interface tests](admission-public-interface.test.mjs) | Exercise public blinding, cross-family assignment, prompt rendering and reply parsing through local capture-only runtimes |
| [Preparation profile](preparation-profile.json) | Zero live calls/cost, unselected live cap and explicit live blockers |
| [Runtime findings](runtime-compatibility.md) | Separate supported public settings from unmeasured request/backend limits and changed retry policy |
| [Current author test output](author-test-output-02.txt) | Failing-before guard and complete passing output: 40 passed, including 12 preparation checks and 28 existing accounting/record checks |

The original design-review target was checked before code was written.\
Subsequent changes to the design and runtime-findings Markdown only applied the repository's layout formatter; the independent artifact review must check the resulting hashes.\
The first Markdown check failed layout rules; formatting corrected those failures without changing the scoring or runtime proposal.

The [first artifact review](readiness-review-01.txt) found a mixed-decision contract defect despite the passing checks.\
The [prospective correction](mixed-decision-correction.md) preserves wrong-decision precedence while retaining a separate conflict; its exact-artifact recheck is required before preparation readiness is claimed.\
The first capture and [first author output](author-test-output.txt) remain preserved.

---

## What the static results do and do not show

The complete panel fixture retains 144 synthetic outcomes and 288 cast vote identities in 48 jobs.\
The missing-reader fixture retains 120 present outcomes, 24 absent outcomes, 240 cast votes and 48 explicit uncast slots in 40 jobs.\
Every job has one synthetic reply, tools off, with the public attachment/stdin choice and exact policy, question, key and rubric checked.\
Twenty-four repeated library-rule headings exercise identity and volume accounting only; they are not independent comprehension probes, a representative reader workload or calibration results.

The checker consumes original raw votes before any quote cap and returns their score and reason unchanged.\
It detects structural contradictions in either direction; no clean result grants semantic correctness, and no finding changes, drops or retries a vote.\
Independent review must check both full-credit and penalized cases, including an accurate proposal caveat versus a caveat that actually withholds a required decision.\
The checker-only absent-answer diagnostic is never inserted into a real missing-answer vote slot.

No conductor, isolation probe or provider runtime is invoked.\
The whole evaluator upgrade remains unqualified, and its changed probe retry/attempt-recording behavior blocks live adoption.\
The original valid FAIL and subsequent NO VERDICT remain unchanged.

---

## Reproduce the checks

Use Node and the build dependencies declared by the candidate evaluator's package and lock files.\
Provide a clean source export of the revision in `preparation-profile.json`, its build dependencies, and the source Git repository as a read-only object cache.\
Do not point the export variable at a shared checkout.\
The integration test compares every exported tracked file with the pinned Git object and forces a fresh build before importing the public entry point.\
It creates fresh temporary fixture directories and retains their records; it does not register an experiment or use operator credentials.

From the AGP repository, substitute the two local paths and run:
```bash
AGP_PREPARATION_CORE_ROOT=/path/to/isolated/context-lab-export \
AGP_PREPARATION_SOURCE_REPO=/path/to/context-lab-repository \
node --test docs/reviews/admission-evaluation-preparation/admission-scoring-policy.test.mjs docs/reviews/admission-evaluation-preparation/admission-public-interface.test.mjs
```

The corrected complete capture is gzip-compressed and base64-encoded at `capture-only-evidence-02.json.gz.base64`.\
It contains all source fixtures, units, prompts, raw synthetic replies, public job records, votes, uncast identities and build provenance, not just counters.\
Its decoded JSON SHA-256 is `2945c82c888e6f486bd4bc466dd09081c515dcbed882076d2ef4081f203e7435`.\
The first capture remains at `capture-only-evidence.json.gz.base64`, decoded SHA-256 `0c38179e7f6d26a7dbd0871effb6abc7388926f6d08ff5175ab690cbb3f00544`.

To check the lossless retained payload:
```bash
set -o pipefail
base64 --decode docs/reviews/admission-evaluation-preparation/capture-only-evidence-02.json.gz.base64 | gzip --decompress | sha256sum
```

---

## Remaining gates

1. Independently review this exact preparation, including the declared semantic expectations and complete captures.
2. Resolve the evaluator compatibility blocker without accepting a changed retry/failure policy by implication or copying the harness into AGP.
3. Separately select bounded diagnostics/calibration: exact caps, observation method, finite call/cost ceilings, frozen cases and stop rules.
4. After qualification, prepare independently audited fresh assurance questions and sessions, then select any whole comparison.

No result here ratifies the admission contract, proves implementation behavior, closes B53, authorizes publication or sends Zorg a response.
