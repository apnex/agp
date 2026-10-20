# Draft browser scale public execution mapping

From: AGP project.\
Audience: AGP maintainer and context-lab owner.\
Status: local draft, not delivered; no executable pack or execution approval.\
Tier 3 - proposed public-field mapping derived from the frozen experiment and documented component contract.

The proposed composition uses two one-reading experiments in one pack, with the frozen inputs and scoring unchanged.\
This is a candidate composition, not a claim that context-lab has validated it.\
The remaining owner questions are paired preregistration and exact prompt inspection without model calls.

## 1. Fixed experiment and public basis

The [protocol](browser-scale-assurance-preparation.md), [questions](browser-scale-questions.json), [reader instructions](browser-scale-reader-instructions.md), both retained judge keys and [numeric rule](browser-scale-comparison-rule.json) remain unchanged at the [independently reviewed revision](browser-scale-key-recheck-02.txt).\
Three distinct family profiles answer each reading: six reader cells, 48 question outcomes and 96 expected other-family vote slots.\
Slots include explicit not-cast cases; they are not invocation or billing limits.

The public basis is context-lab's [operations guide](../../../../context-lab/docs/OPERATIONS.md) at `ce9d513bb39d3469ca0af46a0320c6bf9cbbe469`, its [compatibility reply](../../../../context-lab/incoming/agp-assurance-compatibility-review-response.md), and the [component ownership contract](../../../../mission-kit/components/C2-context-lab.md).\
The [checks](browser-scale-public-binding-checks.json) retain exact source hashes and the author-side field projection.

---

## 2. Candidate pack composition

| Surface | Mapping |
|---|---|
| Sources and variants | One source directory per retained reading, pinned to the reviewed AGP commit; include only `browser-scale-reading.txt`, never the adjacent key or repository history |
| Arms | One instruction delivery per reading, using that same basename; no `on-request` repository access |
| Experiments | Two experiments, each selecting one arm and one reading-specific scenario; same three population members, one new phase and `runsPerCell: 1` |
| Common reader inputs | Exact reader instruction string in `instructions`; task contains every question identifier and exact prompt in source order, identically on both sides |
| Responses | Scenario `fixture: null`, `answerSource: "final"`; experiment `maxResponseBytes: 24576`, without a different scenario override |
| Attempts and judges | Proposed `maxAttemptsPerCell: 1`; all three families on the judge panel, with `outcomesPerPrompt: 1`; probe/judge attempt policy still needs freezing |
| Masks | No project identifier substitutions or self-explanation stripping proposed; built-in masking and wrapper behavior still require inspection |
| Preregistration | Freeze both experiments, their shared inputs, profile bindings and analytical role map before either runs; owner confirmation required in section 5 |
| Project acceptance | Join the two sets of public records under the single frozen AGP rule; do not use a generic aggregate as AGP's verdict |

One scenario containing all eight questions preserves the eight-answer response and its common byte budget.\
Eight independent question scenarios would create different reader cells and a different task.\
One experiment with both arms and both reading-specific scenarios would create unwanted cross-product cells; a shared scenario with both keys would violate judge isolation.

The opaque reading labels, family positions and physical file locations are analyst associations, not judge payload metadata.\
Runtime/model identities, settings, order, canaries, isolation probes and resource limits remain unselected.\
No placeholder model profiles are supplied merely to make a pack validator accept this draft.

---

## 3. Exact source-to-field projection

| Frozen content | Public destination | Fidelity condition |
|---|---|---|
| Three score definitions and all ten common rules | `judgeInstructions` | Serialize the complete `{scoring, rules}` object identically for both experiments |
| Question identifier and prompt | Property `id`, `answerHeading`, `question` | Preserve identifiers and exact prompt strings |
| One applicable projected entry | Property `key` | Serialize the complete entry, including `id`, `required`, `wrong` and `grounding`; include no other entry |
| Scoring mode | `type: "comprehension"`, `decidedBy: "judge"`, `scale: [0, 2]` | AGP accepts only integer scores 0, 1 or 2 |
| Assigned reading | `judgedWith: ["delivered"]` | Only the reading uses the delivered-file channel, so common instructions/questions do not become extra judge context |
| Answer under review | The corresponding extracted anonymous unit | Exactly one eligible answer per prompt, with its own reading and key |

Serializing a whole entry into the existing string-valued `key` avoids dropping qualifications between fields.\
It does not mean delivering the whole eight-entry judge-key file.\
JSON structure preserves the original values; it does not prove the component will render or retain them verbatim.

The model-free author check round-tripped all 16 question entries and both copies of the common grading object without dropping or rewriting fields.\
It also established identical reader instructions and question task, with proposed source-content totals of 20,780 and 21,218 UTF-8 bytes, excluding component wrappers/canaries.\
These are projection measurements, not emitted prompt measurements or model-context qualification.

---

## 4. AGP acceptance over public records

Use context-lab's extracted `CellRecord.answers` and retained raw responses; do not introduce a second answer parser to compensate for an unvalidated extraction rule.\
Associate every planned cell with its run, attempts, delivery/isolation evidence and completion state, then associate each question with its unit, both required judge families, exact attempt prompts and retained reasons.\
Identifiers must be unique across the combined record set, even if two run-local identifiers collide.

| Evidence state | Treatment |
|---|---|
| Eligible completed reader, established absence of a substantive answer | Score zero and retain two not-cast slots with the absence reason |
| Present eligible answer with two valid other-family votes | Use the lower score, capped at 1 for unsupported positive claims |
| Present text that extraction cannot reliably assign, or unclear completion/delivery/isolation | `NO VERDICT`; a missing extracted unit alone is not an absent answer |
| Required vote or attempt evidence missing/ineligible | `NO VERDICT`; do not replace it with zero, an average or a selected rerun |
| Material instrument ambiguity or defect | Preserve all records; `NO VERDICT`, with any correction prospective |

Quotation membership is deterministic against the exact assigned reading with whitespace normalization only.\
Entailment, justified absence and qualified inference remain judgments; quote membership cannot establish them.\
Use the retained reasons for separate wrong-decision, missing-decision, unsupported-inference, justified-absence, ambiguity and quotation/format diagnostics; a single exclusive category cannot represent mixed answers.\
AGP must freeze and validate that diagnostic representation before execution, without treating an omitted diagnosis as a favorable default.

After complete eligible accounting, the [numeric rule](browser-scale-comparison-rule.json) applies to all eight questions: candidate floor, no question-sum regression and at least one strict gain.\
Raw observations and reasons still require inspection before a conclusion.\
This post-run project calculation consumes public records; it does not launch readers/judges or replace context-lab's execution machinery.

---

## 5. Bounded questions for the context-lab owner

Please answer these contract questions without implementation, provider setup, probes or model calls.

1. **Paired preregistration:** Is one pack with two preregistered one-arm experiments supported for this six-cell comparison, with AGP joining their public records?\
   For result-status records, how do `variation.difference`, `variation.scope` and `default` represent the frozen rule without adding a new effect threshold?\
   Please state the units and semantics of `difference`, or identify the supported alternative; AGP will not invent a value just to satisfy validation.
2. **Model-free prompt inspection:** What supported public command/export can show the assembled reader and per-question judge payloads without contacting a runtime/provider?\
   The operations guide documents declaration checking and live execution, but no prompt-preview operation.\
   A successful `check` alone does not prove delivery; please identify an existing public seam or confirm the gap.
3. **Exact delivery and evidence:** With the mapping above, can the retained payload prove that no keys reach readers and that each judge sees only its exact question/answer/reading, common grading object and applicable entry?\
   Include wrapper instructions, any arm-guess task, masking, canaries, retries and the public record associations needed to reproduce each eligible vote.\
   Identify any transformation or mandatory instruction that prevents this contract, rather than asking AGP to infer behavior from implementation.

For each answer, give supported, unsupported or unknown; the public interface and revision; existing model-free evidence or the owner of remaining work.\
The delivered heading, bounded-measurement and interrupted-reader corrections are acknowledged; this is not a request to repeat those earlier repairs.\
The [resource and retention prerequisites](browser-scale-execution-readiness.md#4-acceptance-and-resource-boundaries) remain open separately and are not closed by a successful mapping answer.

---

## 6. Next boundary

The next action is to place these bounded questions with context-lab and assess its reply before constructing the executable pack.\
No owner response, declaration-check PASS, complete prompt preview, live isolation result or scored comparison is claimed by this local draft.

Mechanics: keep the experiment fixed, project complete key entries through documented string fields, and reconcile every expected public record.\
Rationale: content representability is narrower than correct delivery and paired-run eligibility.\
Consequence: unresolved component behavior is an owner question, not permission to create a private runner or weaken the approved experiment.
