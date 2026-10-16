# Admission evaluation preparation contract

Tier 3: prospective replacement preparation, selected by the director's continuation of the repair proposal.\
This is not a registered experiment, qualified instrument or AGP adoption decision.

## Mechanics

Prepare the scoring and runtime interfaces described in the [repair proposal](../admission-evaluation-repair-proposal.md), without live model calls.\
The [source findings](../admission-evaluation-repair-findings.md) establish the observed grading violation and the unresolved reader-stop cause.\
The original packet, answers, scores, FAIL and NO VERDICT remain immutable.

| Boundary | Owner | Preparation artifact and check |
|---|---|---|
| Meaning of AGP comprehension scores | AGP evaluation packet | One policy source renders judge instructions and the property rubric; all delivered profiles are captured through the public judge panel |
| Mechanical score/reason contradictions | AGP evaluation packet | Pure validator reports issues without replacing scores or making semantic judgments |
| Judge dispatch, parsing, assignment and runtime environment | Public context-lab interfaces | Use public exports; no copied renderer, parser, panel or sandbox |
| Requested versus effective provider budget | Runtime/provider boundary | Source compatibility record and unresolved observation requirements; no claim that a configured cap reached the backend |
| Semantic validity and preparation readiness | Independent non-author reviewer | Check the near-final design before implementation, then inspect the actual replacement artifacts and retained captures |

The preparation implementation has no execution or registration entry point.\
Its integration test injects a local capture-only runtime into public `judgeAll`; that runtime returns synthetic replies and cannot launch providers.\
Tests use unrelated document-comprehension material, never fresh AGP assurance questions.

---

## Scoring invariants

1. Judges receive the common fact that both source documents are proposals, not adopted or implemented contracts.
2. Score only explicitly numbered required decisions, against the supplied key and excerpts; do not require adoption, preferred wording, one quotation per clause or unasked detail.
3. Score 2 requires all required decisions correct, complete, grounded and settled by the answer; 1 means safe incompleteness, missing support or uncertainty/conflict about a required decision; 0 means a wrong/unsafe required decision or no answer.
4. Accurate status qualifications and intended scope exclusions are not uncertainty about a required decision; an answer that actually withholds a required decision remains incomplete even if its explanation mentions proposal status.
5. Several exact excerpts may jointly entail a decision; semantic sufficiency remains judgment, and exact-source quotation validation remains a separate conservative cap that never raises a score.
6. A penalty identifies the affected numbered decisions and a concrete deficiency; no outside rule may fill a gap.
7. Reason tags are diagnostic evidence, not an alternative score or proof that their assertions are true.

The replacement reason prefix keeps `DECISION`, `COVERAGE`, `SUPPORT` and `HEDGE`, and adds `REQUIRED` and `ISSUE`, followed by `WHY` text.\
`REQUIRED` is `none`, a comma-separated list of distinct required-decision IDs, or `all` only for a wholly absent answer.\
`ISSUE` is `none` or a comma-separated list from `wrong-decision`, `no-answer`, `omission`, `uncertainty`, `support`, `conflict`.\
`DECISION=missing` means a wholly absent answer; an omitted part of a present answer is expressed by `COVERAGE=incomplete` and `ISSUE=omission`.\
This prospective clarification does not reinterpret historical tags.

The mechanical validator checks field syntax, allowed values, required-ID membership, nonempty explanation and these declared contradictions:

- Full credit with a deficiency, affected decision, uncertainty or non-complete/non-supported/non-correct tags.
- A penalty with no affected decision or no issue.
- A penalty when all tags assert correct, complete, supported and unhedged decisions with no issue.
- A wrong-decision or no-answer finding with a nonzero score.
- A zero score explained only by safe incompleteness, support or uncertainty.
- An issue inconsistent with its corresponding diagnostic tag, such as `uncertainty` with `HEDGE=no`.

The validator returns the original score/reason unchanged beside its findings.\
A finding stops promotion for independent validity review; it never requests a replacement response or repairs a vote.\
A mechanically clean reason can still be semantically wrong, including falsely labelling an accurate status caveat as required-decision uncertainty.\
Independent semantic review must examine both penalties and full-credit votes against the question, answer and quoted source; no clean-tag shortcut is allowed.\
After assurance answers have been read, a confirmed substantive evaluator defect follows the frozen invalidation rule: no verdict and a new prospective comparison, not regrading the affected run.

---

## Runtime preparation and retention

Candidate context-lab revision: `0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68`.\
Review its public `outputTokenMax` setting and route disclosure against the historical evaluator, rather than assuming the whole upgrade is compatible.\
Capture-only integration qualifies only the public surfaces it exercises, not the changed conductor, live sandbox or provider.\
Use a clean, isolated export if compilation is needed; do not alter the sibling checkout or shared operator configuration.

The preparation runtime profile explicitly permits zero live calls.\
Keep the six-reader/three-family population, model routes, existing reader and judge wall limits and conservative accounting constraints visible by reference to the frozen packet.\
An explicit reply-cap field remains unselected until an authorized diagnostic establishes the observation method and budget.\
Do not set `outputTokenMax` on Codex, which does not support it.\
Any synthetic cap used to test the public interface is a test value, never a selected live value.

Retain complete capture prompts, synthetic replies, public panel job records, votes, pin identities and test output in a separate preparation evidence directory.\
Label every synthetic record as development evidence with zero model calls; it cannot contribute to historical or future assurance scores.\
Retain provider configuration only in its existing sanitized form; do not copy credentials, authorization headers or raw request bodies containing secrets.\
The eventual request-observation record must distinguish configured override, client-emitted parameter and backend-received/enforced value, with unknowns explicit.\
It must retain visible output tokens, reasoning tokens, finish reason, saved-file result and elapsed time separately.

---

## Acceptance and authority

| Check | Required result for preparation |
|---|---|
| Source parity | Every captured judge profile contains the exact rendered policy, question, key and rubric; no inferred proposal status is needed |
| Mechanical discrimination | Correct/full-credit, status-only qualification, genuine required uncertainty, missing support, omission, wrong decision and absent-answer fixtures distinguish permitted from contradictory diagnostic records |
| Public panel boundary | Three families, two cross-family votes per unit, all expected units/jobs/replies retained, tools off, no providers, no retries needed for well-formed synthetic replies |
| Historical preservation | No changed files in the frozen packet, AGP runtime, CLI or shared evaluator |
| Runtime honesty | Public cap and route seams source-reviewed; effective request budget and live suitability explicitly unverified |
| Independent gate | Non-author design/axiom review before code, then independent preparation-readiness verdict over the exact artifacts |

The later live decision must specify finite call/cost ceilings, exact selected caps, sanitized request observation, unrelated calibration cases with frozen expected outcomes, representative reader volume/file-writing checks and stop conditions.\
There is no automatic transition from preparation to diagnostic, calibration, assurance, AGP adoption, commit push or Zorg correspondence.\
New assurance questions and fresh sessions are prepared only after calibration qualifies the instrument.

---

## Rationale and consequence

The prior invalidation exposed missing delivered context and unrestricted reason semantics, not a demonstrated new AGP mechanism flaw.\
One delivered scoring source prevents declaration/prompt drift; mechanical checks catch decidable contradictions while independent review handles meaning.\
Keeping runtime budget observation distinct prevents an untested cap increase from being presented as a Gemini repair.\
This preparation makes the next live decision concrete without spending on another full comparison or weakening the original gate.
