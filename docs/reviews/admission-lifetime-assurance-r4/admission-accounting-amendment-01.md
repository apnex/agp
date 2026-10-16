# Admission clarification accounting amendment

Status: prospective correction of `KR-01`, before scored execution; bounded independent recheck required.\
Tier 3: the accounting rule below governs the proposed measurement, not observed reader performance.

The director selected the accounting correction and independent recheck.\
This amendment distinguishes retained text from judge-eligible answers without changing the admission design or authorizing a reader run.

---

## Scope and precedence

The [preregistration](admission-assurance-preregistration.md) was frozen at `e9fc08b9c340c11e4f094408ca298dbe28419127`; the [independent audit](admission-key-audit-01.txt) records its readiness FAIL and the necessary correction.\
That audit and the [earlier assurance FAIL](../admission-lifetime-assurance/admission-assurance-result.md) remain unchanged.

This amendment supersedes only the preregistration's present/reached-answer terminology, behavior-failure disposition and associated missing-vote rule, and clarifies the six measurement-usable outcomes requirement.\
The original body remains as-authored, with a correction banner directing future execution to this amendment.

Questions, keys, controls, source and reader inputs, population, phase shape, evaluator pin, conservative aggregation, quote checks, score thresholds, retry limits and authority boundaries are unchanged.\
The amendment and review metadata stay outside reader and judge delivery.

---

## Recorded evaluator behavior

Tier 2: source inspection at the evaluator revision pinned in the [input manifest](admission-input-manifest.json), `6e6d0a92965a15ec473c661887b2b9c5037fedcf`; no reader failure was executed for this correction.

| Source under `packages/core/src/` | Recorded mechanism |
|---|---|
| `episode.ts`, lines 235-253 | A workspace snapshot can survive a behavior-classified phase failure |
| `run-conductor.ts`, lines 353-377 | Raw `scoredFile.content` can be retained; answer extraction uses only properties whose phase state is `valid` |
| `blinder.ts`, lines 100-124 | Only valid-phase properties can produce judge units; absent answers are recorded separately |
| `tally.ts`, lines 66-90 | `ended` properties take the bottom score; unresolved non-behavior failures are excluded from the evaluator tally, not converted to reader zeroes |

The [experiment](admission-clarity-experiment.json) has one `answer` phase for all twenty-four headings.\
It has no earlier valid phase whose judged answers could survive failure of a later phase.

---

## Corrected accounting rule

Tier 3: these are the prospective project rules, following the pinned evaluator's phase boundary.

- **Retained raw text** is saved file or trace content, whether partial or complete; retention alone gives it no scoring eligibility.
- **Judge-eligible present answer** is a nonempty answer extracted by the pinned evaluator for a heading whose property phase is `valid` in a measurement-usable cell.
- **Missing answer** is a null, undefined or whitespace-only extracted answer in a valid phase; it is distinct from an `ended` property.
- **Reached material** eligible for judging means valid-phase answers, not merely headings visible in a saved file.

Account for all 144 reader/heading outcomes and 288 expected other-family vote slots fixed by the manifest.\
Keep each outcome's cell and heading identity and each vote slot's intended other-family judge identity, including when no vote was cast.\
Do not reduce the denominator because a unit, answer, cell or vote is missing.

| Condition | Project outcome | Vote accounting |
|---|---|---|
| Valid phase with a judge-eligible present answer | Lower of the two valid other-family scores, then the existing downward-only quote cap | Both valid votes required; retain original reasons and every attempt |
| Valid phase with a missing answer, including a missing file or unrecognized heading | Deterministic zero for that heading | Two explicit `not cast: missing answer` slots; no invented votes |
| Sole answer phase ends on runner-classified behavior failure | All twenty-four properties are `ended` and score zero, even when some or all answer text was saved | Forty-eight explicit `not cast: ended phase` slots; no judge units or votes required for them |
| Required cell or phase has unresolved infrastructure, isolation or delivery failure, or is `incomplete` | No project gate verdict; preserve the unresolved outcome identities, not reader zeroes | Preserve any actual attempts or votes and mark unresolved slots explicitly; no fabricated completion |
| Judge-eligible present answer lacks either required valid vote | No project gate verdict | Retain actual replies and identify the missing or invalid slot; no author-substituted score |

A completed valid phase can contain truncated or incomplete answers: grade each present answer under the unchanged rubric and score only absent answers as deterministic zeroes.\
Malformed or unsupported quotations on a present answer still require both votes and the existing quote/support checks; they do not make that answer absent.

For the behavior-failed sole phase, retain saved text and observations as raw/exploratory material only.\
Do not salvage headings into judged units, reparse the file outside the phase rule, or treat its expected uncast slots as missing required votes.\
Neither an ended-phase zero nor a missing-answer zero is a judge vote.

Use the pinned runner's actual failure classification and retry contract, not an author's inference from the presence of text or the word timeout.\
A behavior-failure disposition receives no retry; infrastructure or isolation may use the existing one permitted reader-cell retry, retaining every attempt.\
Judge-output completion remains the pinned panel's separate bounded process; no low score, diagnostic-tag defect or adverse observation earns a favorable rerun.

---

## Gate interpretation and stop

Six measurement-usable outcomes means all six declared reader cells are accounted for by valid completed phases or runner-classified behavior-failure dispositions, with required delivery/isolation provenance intact.\
A behavior-failed sole phase is usable as twenty-four deterministic zeroes, not as a valid phase or as evidence of document comprehension.\
Unresolved infrastructure/isolation/delivery failure, incomplete required phases or missing valid votes for eligible answers leave the comparison without a gate verdict, even if other scores would fail its thresholds.

Apply all five original gate conditions unchanged to a measurement with valid required inputs and complete accounting.\
A candidate behavior failure necessarily violates the no-candidate-zero condition; a predecessor behavior failure remains in the comparison and is not automatically a candidate failure or a whole-comparison invalidity.\
The final non-author reviewer still examines raw observations and both arms; unresolved material candidate/comparison ambiguity prevents PASS.

Commit this amendment and the preregistration banner before the bounded non-author recheck.\
The recheck must reconcile the corrected phase/accounting boundary with the pinned source and verify preservation of the rest of the frozen packet.\
An instrument-readiness PASS would permit a separate execution decision, not scored execution by itself.

Before any later execution, restore or verify the pinned evaluator checkout/build, validate the final frozen packet, register it, pass the required runtime delivery/isolation checks and verify complete project accounting.\
Final assurance, public-contract ratification, runtime repair, B53 closure and publication remain separate.
