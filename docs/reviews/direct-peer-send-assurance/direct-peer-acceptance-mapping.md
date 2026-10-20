# Draft direct peer assurance acceptance mapping

AGP must account for every planned reader, answer and judge slot before calculating whether the adoption guidance improves on the contract alone.\
This draft maps that accounting and judge delivery to the [frozen protocol](direct-peer-assurance-preparation.md), [corrected key](direct-peer-answer-key.json) and [input manifest](direct-peer-input-manifest.json).\
It introduces no new threshold, reader instruction, runtime, execution pack or selected model profile.

Status: local preparation for review, not an implemented acceptance checker or an execution-readiness verdict.\
Audience: the AGP maintainer preparing the comparison and the reviewer checking its public execution binding.

Context-lab owns execution, isolation, extraction, judging and replay records; AGP owns the experiment and its acceptance calculation.\
The [placed correction request](../../../../context-lab/incoming/agp-assurance-correction-request.md) remains the owner handoff.\
Context-lab committed correction work at `49d7ccbe6bf3a418ae3a69861a3b0e6e374be495` during this preparation; that commit has not been assessed here.\
The public field mapping below uses the already-read operations contract at `d17feb9ea7cec067176804e7e3c25f92281e6d04`, not an assumption that the newer work closes every requirement.

The [author checks](direct-peer-acceptance-mapping-checks.json) retain the source identities, measured inventory and local check results.\
The original protocol, correction history, questions, key and readings remain unchanged.

---

## 1. Declare the complete population first

The analyst starts from the frozen declaration, never from the subset of cells, units or votes that happened to be written.\
The three family positions below are symbolic requirements, not selected providers or model identities.

| Record set | Stable analytical identity | Expected population |
|---|---|---|
| Reader cells | Assigned reading and reader-family position | Two readings times three distinct families: six fresh readers, each answering all twelve questions |
| Question outcomes | Reader cell and question identifier | Six times twelve: 72, including absent answers and unestablished readers |
| Vote slots | Question outcome and one of the other two family positions | 72 times two: 144 expected slots, not 144 guaranteed cast votes or invocations |

The same three profiles must serve both readings, with no same-family judging.\
The sealed analyst mapping binds the opaque reading labels to baseline/candidate roles and the eventual family positions to approved profiles.\
Those roles, reader-profile identities, execution order and source record paths stay analyst-only; judges receive anonymous unit identifiers instead.\
Question identifiers and the content needed to assess an answer are not private treatment labels.

Each expected record retains its identity even when its observed cell, extracted answer or blinded unit is absent.\
Attach public records to that expected population and check cardinality, identity, uniqueness and cross-family assignment before scoring.\
An unexpected cell, conflicting duplicate, unknown unit or ambiguous attempt mapping is a reconciliation defect to resolve, not permission to drop a record or choose a favorable one.

### Public record attachment

These are required associations, not a declaration that the inspected revision already preserves every field.\
The [owner response](../../../../context-lab/incoming/agp-direct-peer-assurance-contract-response.md) names the public record surfaces; the correction request records the remaining evidence gaps.

| Public surface | Attach to the declared population | Required check |
|---|---|---|
| Frozen pack/configuration and `run.json` | Expected cells, exact inputs, runtime routes, profiles, effective policies and isolation records | Retain the actual configuration as well as its hash; reconstruct the same six cells without relying on present units |
| `cells/<cell>.json` | Every attempt, eligible response, phase, extracted answer and transformation | Distinguish completion from classification; retain raw/effective response provenance and byte-bound evidence |
| `sealed/units.json` | Present anonymous units and explicit absent-answer entries | Join through cell/question identity; a missing unit alone proves neither answer absence nor invocation eligibility |
| `judging/<job>.json` | Every judge attempt, actual prompt, local answer-to-unit map, reply and outcome | A retry over fewer answers needs its own map; retain rejected attempts and the eligibility basis |
| `judging/votes.json` | Accepted vote, question, unit, judge family and exact attempt | Both required families must be eligible and traceable; never count two votes from one family as two required judgments |

No attempt is silently removed because it failed, and no retry is silently promoted to a new reader.\
Reader retries, judge-format retries, isolation probes and hidden provider activity are separate accounting concerns; 144 vote slots is not a whole-run request or spending bound.

---

## 2. Establish eligibility before interpreting absence

For each reader, the execution binding must establish assigned-input delivery, isolation, invocation completion and the eligible response surface under a pre-audited contract.\
An aggregate `valid` flag or `behaviour` cause is not a substitute for those facts.\
In particular, a completed eligible empty response and an interrupted invocation with retained text cannot be classified from text presence alone.

| Established state | Question accounting | Vote accounting | Comparison consequence |
|---|---|---|---|
| Eligible completed reader; no substantive answer under the audited extraction rule | Record a missing answer and score zero, retaining the response and reason | Retain both slots as not cast because the answer is absent; invent no judge scores | Valid zero may affect the comparison |
| Eligible completed reader; substantive answer present | Retain exact extracted text and provenance; await both required judgments | Accept only eligible other-family judgments with replayable attempts | Calculate a conservative score only when both are available |
| Present answer; one required judgment missing or ineligible | Keep the answer and every received judgment | Mark the missing/ineligible slot explicitly not cast, with its reason | `NO VERDICT`, not zero and not a single-judge score |
| Delivery, isolation, invocation or response eligibility unestablished | Keep all twelve expected outcomes unresolved, with supporting observations | Keep the 24 expected slots visible; attach any observations without legitimizing them | `NO VERDICT` |
| Extraction or scoring instrument has a substantive defect | Preserve responses, extractions, votes and the defect | Do not repair the scored data by reinterpretation or selective rerun | `NO VERDICT` for the affected instrument; correct prospectively |

A well-formed score from an ineligible judge cannot satisfy a slot.\
The eventual contract must cover completion, exit status, filtering, runtime/provider error, tools and isolation independently of score parsing.\
Missing attempt evidence remains unknown even if a numeric vote is present.

### Extraction compatibility remains open

The [reader instructions](direct-peer-reader-instructions.md) require each question identifier as a heading but do not require heading level three.\
Section 3.3 of the reviewed [public operations contract](../../../../context-lab/docs/OPERATIONS.md) describes response splitting at exactly `### <answerHeading>`.\
That difference needs a supported extraction contract or a separately reviewed prospective instruction change; this draft does not choose one.\
An answer using a reader-permitted heading must not become zero merely because a narrower parser failed to recognize it.

Before freezing extraction, specify treatment of duplicate or reordered headings, empty sections, substantive text without a recognized heading, malformed `QUOTE:` records, trailing Observations and a response cut by the byte bound.\
A quote/format defect in a substantive answer is not automatically answer absence.\
Observations must remain available for the final review without becoming an unasked thirteenth scored question.

---

## 3. Deliver the complete judge rules without private labels

The future renderer must preserve source strings and their question association, not paraphrase the key or demonstrate coverage by counts alone.\
The measured inventory is three score definitions, seven common rules, twelve question prompts, 53 required decisions, 35 wrong conclusions and seven `judgeGuidance` items.

| Source | Proposed supported destination | Fidelity condition |
|---|---|---|
| Key `scoring` and all `rules` | Experiment `judgeInstructions` | Every definition and qualification reaches every relevant prompt, including retries |
| Question `id` and `prompt` | Property identity, `answerHeading` and `question` | One common question-to-property map for both readings; extraction compatibility is resolved first |
| Entry `required` | Property `key` | Preserve every item for that question; do not convert nonexclusive grounding aids into extra duties |
| Entry `wrong` and every applicable `judgeGuidance` | Property `rubric` | Preserve every item and its applicability, including the corrected Q07 and Q11 qualifications |
| Protocol score range and judging duty | Property `scale: [0, 2]`, `decidedBy: "judge"` | Integer scores 0, 1 or 2 from the two eligible other families |
| Eligible answer and assigned-text support | Anonymous unit plus a demonstrated public support-delivery seam | Bind support to the exact assigned reading; provide enough context for entailment, derivation and justified absence |

The private `role`, `supportNote`, grounding-role labels, arm/order map, source revision history and prior reviews are not judge payload fields.\
The key's grounding excerpt collection is an audit aid, not a substitute for the assigned reading or an exhaustive list of acceptable support.\
Content may naturally expose differences between readings; blinding forbids author labels, not the text the judge needs to assess.

| Question | Required decisions | Wrong conclusions | Additional guidance |
|---|---:|---:|---:|
| Q01 | 4 | 3 | 0 |
| Q02 | 4 | 3 | 0 |
| Q03 | 4 | 3 | 0 |
| Q04 | 4 | 3 | 0 |
| Q05 | 5 | 3 | 0 |
| Q06 | 4 | 2 | 0 |
| Q07 | 4 | 3 | 1 |
| Q08 | 4 | 3 | 0 |
| Q09 | 5 | 3 | 2 |
| Q10 | 5 | 3 | 1 |
| Q11 | 5 | 3 | 2 |
| Q12 | 5 | 3 | 1 |

These counts are an omission check, not proof of a delivered prompt.\
Acceptance of a future renderer requires exact source-value comparisons and inspection of the actual emitted prompts, including the wrapper, support, masking and retry maps.\
Removing one guidance item, substituting another question's key or leaking private metadata must fail that check.

### Support delivery and diagnostics need a public binding

The common `judgeInstructions` and per-question `key`/`rubric` fields do not by themselves demonstrate how each anonymous unit receives its assigned-text support.\
The owner must identify that seam or confirm a gap; AGP must not add a private judging path or silently give a judge an undifferentiated union of both readings.\
Within a batch, an answer must be judged against its own assigned material, not another unit's support.\
Full assigned text is a candidate support source, not a selected serialization or batch policy.

The key also requires separate diagnoses for wrong decision, faithful information gap, missing decision, unsupported inference and quote/format defect.\
Those distinctions and the positive-claim/justified-absence basis must be recoverable from retained judge reasons or a supported structured representation.\
This draft selects no new context-lab output field and does not pretend the numeric score alone carries those facts.

---

## 4. Separate quotation membership from judgment

Code checks each JSON-string excerpt against the exact assigned reading using whitespace-only normalization: replace whitespace runs with one space and trim the ends, as the existing packet checks do.\
It does not lowercase, repair punctuation, normalize identifiers, expand ellipses or use the other reading to rescue a quotation.\
Keep the original excerpt, parse result, normalized value and membership result with the answer's provenance.\
An empty normalized excerpt cannot establish positive textual support.

Judges decide whether the cited premises entail the claim and whether an absence statement is justified.\
Membership alone cannot establish those semantic facts, and the presence of the word "gap" cannot exempt an unsupported positive claim.\
The machine-readable diagnostic representation and quotation parser still require review before an executable acceptance checker is built.

For a present eligible answer, let `v1` and `v2` be the two valid other-family scores.\
Its conservative score is `min(v1, v2, quotationCap)`, where the cap is 1 for a positive claim missing valid quotation support and 2 when that cap does not apply.\
A justified absence claim need not fabricate a quote, and a cap never raises a zero.\
An unresolved fact needed to apply the cap or interpret a material claim requires review, not a favorable default.

The deterministic work is population enumeration, record joins, literal quote membership, integer-range validation, minima and threshold arithmetic.\
The cognitive work is correctness, entailment, actionability, justified absence and material ambiguity.\
The final reviewer inspects raw observations and reasons; a generic context-lab aggregate is not AGP's conclusion.

---

## 5. Apply the frozen comparison rule

Only an evidence-valid, fully reconciled comparison reaches the numeric rule.\
Unestablished required evidence or a substantive instrument defect yields `NO VERDICT`, even when the available scores would otherwise fail.\
Hold the conclusion while required observation/reason inspection is unfinished.

For each reading `a`, question `q` and reader-family position `f`, let `s(a,q,f)` be the established score from section 2 or section 4.\
Define `sum(a,q)` as the sum over the three family positions, with equal question weights.\
Controls remain Q01-Q08; Q09-Q12 remain adoption-planning questions.

A proposed documentation-assurance PASS requires all five frozen conditions:

1. All six readers are accounted for under validated delivery/isolation/eligibility rules, and every present eligible answer has both required judgments.
2. Every candidate question has at least two scores of 2 and no score of 0.
3. For every control, `sum(candidate,q) >= sum(baseline,q)`; gains elsewhere cannot offset a control regression.
4. At least one question has `sum(candidate,q) > sum(baseline,q)`; an all-tie comparison retains the baseline.
5. Raw observations and reasons have been inspected, with no unresolved material candidate/comparison ambiguity or measurement defect.

With valid evidence and completed review, failing the frozen rule is FAIL, not permission to rerun or change the key.\
Two of three readers hedging on the same required decision triggers the specified ambiguity review; an explicitly deferred choice is not a hedge, and a baseline-only limitation is not automatically a candidate defect.\
PASS supplies documentation evidence, not ratification, runtime acceptance, publication authority or closure of Zorg's implementation needs.

### Acceptance examples for the later checker

These are logical cases, not observed reader results or a tested runtime implementation.\
Each case assumes all unmentioned conditions hold.

| Case | Required result |
|---|---|
| Both readings score 2 for every answer | FAIL: no strict improvement |
| Baseline scores `[2, 2, 1]` for Q09 and 2 everywhere else; candidate scores 2 everywhere | PASS, after valid evidence and completed review |
| Candidate scores `[2, 2, 1]` on a control whose baseline is `[2, 2, 2]`, with a gain elsewhere | FAIL: control regression |
| Candidate scores `[2, 2, 0]` on any question | FAIL: candidate zero, despite two top scores |
| Candidate scores `[2, 1, 1]` on any question, even with improvement from the baseline | FAIL: candidate floor unmet |
| Candidate scores `[2, 2, 1]` on Q09 versus baseline `[2, 2, 2]`, with strict improvement on Q12 | PASS if all other conditions hold: the non-regression rule applies to controls, not every question |
| Eligible completed reader omits an answer | Score zero and retain two not-cast slots; apply the unchanged comparison rule |
| Present answer has only one eligible judge vote | `NO VERDICT`; neither zero nor an average over one vote |
| Both judge scores are 2 but a positive claim lacks valid quotation support | Conservative score 1 |
| One judge score is 0 and quotation support is defective | Conservative score 0 |
| Required eligibility evidence is unknown, or a material scoring defect is discovered | `NO VERDICT`; preserve the complete record |

---

## 6. Remaining binding and review work

| Requirement | Current preparation result | Remaining evidence or choice |
|---|---|---|
| Complete accounting | Six cells, 72 outcomes and 144 slots derived from the frozen declaration | Public-record reconciliation, eligibility and replay must be proved for the selected execution revision |
| Judge key coverage | All common and per-question source fields mapped without private labels | Actual prompt rendering, assigned-text support, masking, diagnostics and retry-map evidence |
| Reader inputs | Baseline 35,902 bytes; candidate 52,784 bytes for reading, instructions and questions | Both fit 65,536 bytes before any harness wrapper; validate the actual serialized payload and wrapper against model context limits |
| Response bound | Same required 24,576 UTF-8 bytes for every reader | Review owner enforcement and freeze truncation/completion/extraction treatment; scored-text limits do not bound capture memory, generation or spending |
| Reader attempts | No automatic retry after runtime/infrastructure failure | Verify effective policy and interrupted-dispatch accounting, including resume restrictions |
| Probes and judges | Distinct from reader retries and expected vote counts | Freeze their policies, batches, attempt bounds, retention and whole-run resource accounting |
| Extraction | Reader heading requirement and documented parser differ | Settle compatibility without silently changing frozen instructions or turning parser limitations into missing answers |
| Profiles and authority | No provider, model, execution order, budgets or public pack selected | Select only after supported-contract review; separate execution approval remains required |

The next review should compare context-lab's committed corrections and owner explanation against this mapping and the placed request.\
It should explicitly cover heading compatibility and assigned-text judge support, not infer them from `answerSource` or rubric fields.\
Further owner questions should be consolidated after that review rather than sent as a second overlapping correction request now.

---

## Mechanics rationale and consequence

Mechanics: derive a fixed population and source-to-payload map from the preserved protocol, then require complete eligible evidence before the frozen arithmetic.\
Rationale: AGP's decision depends on missing outcomes, qualified judgments and control behavior as much as on the scores that happen to exist.\
Consequence: starting from present units, dropping grading qualifications or silently narrowing extraction could create false assurance and delay the AGP contract Zorg needs.
