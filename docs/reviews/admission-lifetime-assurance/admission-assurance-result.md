# Admission lifetime fresh-reader result

Status: FAIL at the preregistered fresh-reader assurance gate, independently judged on 2026-10-12.\
Tier 3 assessment by AGP; `[MEASURED]` identifies retained observations, `[ARGUED]` interpretation and `[OPEN]` remaining work.

The [independent gate review](admission-gate-review-01.txt) finds the measurement usable and its grounding/completeness thresholds unmet.\
It does not establish a new mechanism defect or overturn revision 3's separate technical-only review; ratification and implementation remain unapproved.

[MEASURED] Reviewer `/root/admission_key_audit` performed a read-only assessment; it was the non-author key auditor, not a scored reader or the packet author.

## Measurement and scope

[MEASURED] Run `2026-10-12-032023-admission-lifetime` completed with six first-attempt reader cells, 72 answers and all 144 cross-family votes.\
The [run record](records/2026-10-12-032023-admission-lifetime/run.json) retains its frozen inputs, registration, six passing reader isolation checks and three passing judge isolation checks.\
[MEASURED] The amended packet passed [independent readiness review](key-audit-02.txt) before registration and execution; neither design, question, key nor scoring rule changed after answers existed.

[MEASURED] The shared evaluator is pinned to context-lab `6e6d0a92965a15ec473c661887b2b9c5037fedcf`; the pre-execution registration and readiness checkpoint is AGP `494130b0962f407c905e0d4d8c93b9a51e955c8b`.\
[MEASURED] Replaying the evaluator's tally reproduced its general-purpose result byte for byte.\
[ARGUED] That summary is not this project's gate: the [preregistration](admission-assurance-preregistration.md#gate-rule-and-stop) and [amendment](admission-assurance-amendment-01.md#outcome-accounting-and-validity) require the lower cross-family vote, exact-source quotation cap, per-probe threshold and unchanged controls.

---

## Conservative scores

[MEASURED] The [accounting script](analyze-admission-assurance.mjs) reproduces all 72 outcomes and 144 vote slots in [mechanical accounting](mechanical-accounting.json).\
Each triplet below follows the registered Claude, Gemini, GPT family order; each score is the lower other-family vote after the frozen quotation cap.

| Probe | Decision | Predecessor | Candidate | Sum comparison |
|---|---|---|---|---|
| Q01 | Expiry, authority and retained work | 2, 1, 2 | 1, 2, 1 | 5 -> 4, control regression |
| Q02 | Late completion and execution checks | 1, 1, 1 | 1, 1, 1 | 3 -> 3 |
| Q03 | Ordered input and continuation barrier | 2, 1, 2 | 1, 1, 1 | 5 -> 3, control regression |
| Q04 | Route transaction atomicity | 1, 0, 2 | 1, 1, 1 | 3 -> 3 |
| Q05 | Terminal commit and cleanup | 1, 1, 1 | 1, 1, 1 | 3 -> 3 |
| Q06 | Terminal observation semantics | 2, 1, 2 | 2, 1, 2 | 5 -> 5 |
| Q07 | Capacity wait and retry ownership | 1, 1, 1 | 1, 1, 1 | 3 -> 3 |
| Q08 | Successful-attempt retry reset | 1, 0, 1 | 1, 1, 2 | 2 -> 4, changed decision improves |
| Q09 | Public compatibility and absorption | 1, 1, 1 | 1, 1, 1 | 3 -> 3 |
| Q10 | Consumer and authentication boundaries | 1, 1, 2 | 1, 1, 1 | 4 -> 3, control regression |
| Q11 | Ordinary success and route refusal | 1, 1, 2 | 1, 1, 1 | 4 -> 3, control regression |
| Q12 | Teardown guarantees and limits | 1, 1, 1 | 2, 1, 1 | 3 -> 4, control improves |

[MEASURED] Only Q06 meets the candidate requirement of at least two fully grounded answers; four unchanged controls regress.\
The candidate has five scores of 2, 31 scores of 1 and no score of 0; its retry-reset score improves, but neither numerical gate condition holds.\
[ARGUED] These are six reader cells, not a statistical estimate that the candidate is generally worse or a new runtime defect finding.

---

## Validity accounting

[MEASURED] Fifteen answers trigger the exact-quote cap, all from Gemini readers; it changes the lower-vote result in only three outcomes: predecessor Q01 and candidate Q04/Q12.\
The retained quote defects include omitted Markdown punctuation and added punctuation; the frozen rule permits whitespace normalization only.\
[ARGUED] Relaxing that rule now would change the measurement after observing outcomes, and would not explain the broader incomplete-grounding pattern.

[MEASURED] One candidate reader attempted an unavailable instruction-file read, which the runtime denied, then read back its own unchanged answer file.\
The core classified its cell valid without retry; the [raw reader log](reader-p87-g-events.jsonl) retains the instruction deviation, and all six reader diffs contain only the allowed answer file.\
[MEASURED] The independent review found no additional source exposure or basis to drop/retry the reader under the frozen rules; perfect instruction adherence is not claimed.

[MEASURED] One of 25 judge replies used a tool and was discarded under the pinned runner's existing rule; its fresh replacement supplied the accepted votes for that batch.\
The [rejected reply log](judge-o-06-rejected-events.jsonl) records a command that listed only its empty working directory and returned no files.\
The 24 retained batches contain all 144 accepted votes; no discarded score was substituted into the accounting.

---

## Interpretation and next action

[MEASURED] The independent reviewer reconciled every answer, unit, accepted vote/reason and actual judge prompt against the frozen packet and found no substantive measurement defect requiring a no-verdict disposition.\
It inspected both arms' complete observations: the predecessor has a majority Q08 hedge, while the candidate has no majority hedge about a required decision.\
[ARGUED] Preserve the FAIL without translating it into a claim that the retry correction damaged unchanged mechanisms.

| Finding | Bounded interpretation |
|---|---|
| Missing required detail or decisive excerpts | Many safe answers remain incomplete under the declared rubric; identify the exact missing support before proposing a document change |
| Q02 executor checks | Judges disagree about whether answers sufficiently exclude a final-reducer-only guard; this is not a demonstrated permission for stale effects |
| Q08 retry reset | Candidate readers preserve history through `OpenConfirm`; two lack fully grounded ownership detail. The predecessor's unsafe answer follows its supplied early-reset instruction |
| Reader observations | Queued-input concerns must be read against the explicit FIFO/sole-reader/no-protocol-effects text; unspecified values, detailed mappings and pending adoption work are not automatically required-answer defects |
| Exact-quote failures | Retain the frozen penalties; punctuation fidelity is not a mechanism safety finding |

[ARGUED] Next: make a bounded disposition of the failed required decisions and observations, separating existing-but-insufficiently-grounded text, genuine ambiguity and measurement sensitivity.\
Propose only the changes that this triage warrants; preserve the technical baseline and all original results.\
Any revised design or substantive measurement repair needs a new preregistration and fresh questions/readers, not retrospective regrading or a selective rerun.

[OPEN] Final ratification, AGP runtime implementation and B53 closure remain outside this completed assurance step.\
No authentication protocol, browser resource guarantee, hundreds-of-peers capacity or consumer migration is certified by these answers.
