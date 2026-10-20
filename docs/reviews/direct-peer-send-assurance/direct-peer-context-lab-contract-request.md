# Draft AGP direct peer assurance contract request

From: AGP project.\
To: context-lab maintainer.\
Status: local draft, not delivered.

**Publication correction:** Repository-relative links replace the original workstation-absolute links below.\
The [original handoff bytes](https://github.com/apnex/agp/blob/a97932d8582efa02ce4521061e0608852820f00d/docs/reviews/direct-peer-send-assurance/direct-peer-context-lab-contract-request.md) remain preserved; requirements and historical status are unchanged.

Please identify the supported public contract for running AGP's direct-peer documentation comparison without changing its frozen measurement rules.\
The immediate issue is automatic retry; answer extraction, record completeness and limit enforcement also need explicit bindings before AGP constructs an execution pack.

This requests a contract answer, not implementation, provider configuration, probes or model calls.\
Context-lab owns execution, isolation, judging and replayable records; AGP owns its experiment and acceptance decision.

## Comparison requirements

The [preparation protocol](direct-peer-assurance-preparation.md) and corrected [key](direct-peer-answer-key.json) govern the comparison.\
The [bounded key recheck](direct-peer-key-recheck-02.txt) passed instrument correctness, not execution readiness.

| Requirement | Frozen scope |
|---|---|
| Population | Two reading sets, three fresh readers per set from three distinct model families; identical profiles on both sides |
| Measurement | Twelve questions per reader: 72 expected outcomes and 144 expected other-family vote slots |
| Scoring | Scores 0, 1 or 2; lower of both valid judge scores, then a deterministic exact-quote cap |
| Delivery | Only the assigned reading, common instructions and questions; anonymous reader/question units for judges |
| Decision | Candidate question floor, no control regression, strict improvement and valid complete evidence under protocol section 5 |
| Unselected | Runtime/model/provider profiles, execution order, time/spending budgets and execution binding |

The public declarations appear able to represent the six reader cells and cross-family judging.\
The four questions below concern compatibility, not a claim that uninspected runtime code is defective.

---

## Mechanics

### 1 Retry policy

AGP's protocol section 5 authorizes no automatic retry after a runtime or infrastructure failure.\
Context-lab's [runtime contract](https://github.com/apnex/context-lab/blob/7388c9a68c446dc7b2a3db17613c9983973908a5/docs/ARCHITECTURE-TARGET.md#7-run-time) specifies one rerun for infrastructure and isolation failures; completed [Delta-4 criterion H1](https://github.com/apnex/context-lab/blob/7388c9a68c446dc7b2a3db17613c9983973908a5/docs/DELTAS/DELTA-4.md#5-binary-exit-criteria) explicitly tests that policy.

Which supported public setting or interface can preserve AGP's no-retry rule?\
The inspected [pack schema and run options](https://github.com/apnex/context-lab/blob/7388c9a68c446dc7b2a3db17613c9983973908a5/docs/OPERATIONS.md) do not document a retry-policy selector.\
If none is supported, identify the gap and recommend an upstream change or a prospective method amendment for AGP to consider before execution.

Please distinguish cell retries from judge-format retries, and state how each attempt is bounded and retained.\
AGP has not selected a new judge-retry policy or authorized a change to its cell accounting.

### 2 Eligible answers and judge delivery

Which public contract maps runtime events to the user-visible response eligible for judging, including failure, partial output and truncation?\
AGP must distinguish a completed eligible response missing one answer, which scores zero for that question, from unestablished invocation or eligibility, which leaves no comparison verdict.

The [scenario schema](https://github.com/apnex/context-lab/blob/7388c9a68c446dc7b2a3db17613c9983973908a5/docs/OPERATIONS.md#33-scenariosidjson-schema) binds `answerHeading` splitting to `scoredFile`.\
AGP's [reader instructions](direct-peer-reader-instructions.md) request a response, not a file, and prohibit executing code or opening other files.

Please identify a supported response-based split into the twelve question units.\
If a scored file is required, name the reader-task amendment for separate prospective review; do not treat it as already authorized.

Please also identify how the judge payload carries all common scoring rules, each question's required decisions and wrong conclusions, every applicable `judgeGuidance` item, and necessary assigned-text support.\
It must exclude role/order metadata, grounding role labels and `supportNote`; those exclusions must not remove substantive grading qualifications.

### 3 Complete records for AGP acceptance

Which stable public record/export contract lets AGP reconstruct every expected outcome and vote slot, including not-cast, missing, invalid and ineligible cases?\
Please cover raw eligible responses, extraction provenance, cell and judge attempts, individual scores/reasons, quote-check evidence and the sealed mapping available to the authorized analyst, not judges.

AGP's acceptance calculation is deliberately project-owned:

- Each present eligible answer needs both other-family judgments.
- Each candidate question needs at least two conservative scores of 2 and no 0.
- Each control's candidate sum must be at least its baseline sum, and at least one question must improve strictly.
- An all-tie result retains the baseline; invalid required evidence or unresolved material measurement ambiguity supplies no verdict.

The public `improve` comparison is not this whole rule: it checks property means and pooled improvement.\
For example, baseline scores all 0 and candidate scores all 1 meet those inequalities but fail AGP's required candidate floor; this is a logical illustration, not an experiment result.

The [hook contract](https://github.com/apnex/context-lab/blob/7388c9a68c446dc7b2a3db17613c9983973908a5/docs/ARCHITECTURE-TARGET.md#6-entities-the-pack-interfaces) places `outcome-measure` before judging.\
Please identify the supported seam for retaining exact-quote checks alongside final votes so AGP can calculate acceptance without copying a runner or asking context-lab to decide adoption.\
Quote matching normalizes whitespace only; missing/invalid support for a positive claim caps a safe answer at 1, never raises a 0, and justified absence claims need not invent quotations.

### 4 Enforced limits

Which supported controls enforce the same 24 KiB UTF-8 response bound for every reader, with explicit truncation accounting, and bound total time and spending?\
Please distinguish enforced limits from prompt instructions and observations, and account for probes, judges and any permitted retries.

AGP also limits reading/instructions/questions to 64 KiB, with the common wrapper measured separately against the actual model context limit.\
The public schema names OpenCode's `outputTokenMax` and hook `timeLimitSeconds`; neither alone establishes a uniform response-byte bound or a whole-invocation budget.\
Please identify the responsible public boundary and failure semantics, or the specific unsupported requirement, without supplying credentials or private account data.

---

## Requested reply

For each numbered question, please provide:

- Supported, unsupported or unknown.
- The exact interface or setting, component revision and public contract reference.
- Existing evidence covering the requested scope, or the owner and proposed work needed to close the gap.

A newer public contract is welcome; AGP will review it before adopting it.\
Please return a separate response and identify its path, preserving this request unchanged.\
A reply does not automatically resume preparation or execution.

---

## Reference checkpoints

| Source | Measured identity |
|---|---|
| AGP corrected source packet | `a09e4bcda9d668b52ff3212c3813fad30fa7ac10` |
| Context-lab public contract assessed | `7388c9a68c446dc7b2a3db17613c9983973908a5` |
| Context-lab head observed during drafting | `477e53882cb109ef1b05dbcd1605f60ef98167ae`; its only commit since the assessment adds decision 0030, with the cited operations, architecture and Delta-4 files unchanged |

AGP links address the shared local workspace; publication of the packet or local recheck is not claimed.\
This request is separate from the earlier admission diagnostic and inherits none of its provider choices, limits or acceptance evidence.

---

## Rationale

Resolving these contracts before pack construction keeps the comparison faithful to the audited questions and validity rules, while routing execution capabilities to their owner.

---

## Consequence

Silently adopting retries, substituting an answer file, losing absent vote slots or using an aggregate comparison as AGP's verdict would measure a different experiment.\
An unresolved binding therefore remains a preparation gap, not a failed AGP design or permission to execute.
