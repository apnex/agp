# Admission evaluator static qualification author results

Tier 3: author handoff for independent exact-artifact review, not an assurance verdict.\
The selected candidate passed the bounded author checks under the [amendment](admission-qualification-amendment.md) and independent pre-build Q1-Q7 guardrails.

## Results and complete records

| Check | Measured result |
|---|---|
| Evaluator identity | Candidate and historical-default exports each matched all 128 tracked files; original evaluator matched all 121; all three force-builds passed |
| Original default | Complete fresh capture equals the retained second preparation capture after normalizing only two temporary records-directory prefixes in prompt fields |
| Candidate panel | Same complete payload as the fresh historical default, except the selected evaluator revision and those temporary paths |
| Complete panel fixture | 144 outcomes, 288 votes, 48 jobs/replies; every present outcome has two other-family votes |
| Missing-reader fixture | 120 present outcomes, 24 absent, 240 cast and 48 explicit uncast slots, 40 jobs/replies |
| Restrictions | 27 landed declaration mutations and seven landed composition mutations rejected as inert data; hooks are refused before hook-capable public calls |
| Composed readers | Both public variant/composer results contain only the frozen instruction bytes and canary, at the pinned source revision; folder-file/on-request lists are empty |
| Judge delivery | Public `EMPTY_ARM` is empty, as consumed by the unchanged public panel source; this is not a physical mount observation |
| Ordinary synthetic episode | Exactly one new phase/invocation; actual answer bytes equal workspace, snapshot and ledger-file bytes; recorded diffs equal the ledger diff |
| Pure tally parity | All 11 legacy fields agree with the original evaluator for complete, missing-reader, ended, incomplete and excluded records; eight additional diagnostic fields enumerated separately |
| Existing constraints | All eight scoring-policy, 15 pure accounting and 13 board/record tests pass |

The successful qualification suite has six top-level tests plus two reused four-test panel runs.\
Together with the 36 supporting tests, 50 tests passed with no skips, cancellations or to-do cases.\
Repeated library headings test identity/volume handling, not independent comprehension questions or representative reader behavior.

The complete [compressed record](admission-qualification-evidence.json.gz.base64) decodes to 8,725,616 bytes, SHA256 `7f5d3749cd37ae81f243b84c1ab4f439121ba4eeed3658fc3c7d5445934b728f`.\
It retains all three source-file inventories, command outputs, both full fresh panel captures, every rejected declaration, assembled instruction bytes, the synthetic episode invocation/outcome/phase/file/diff, and full original/candidate tally inputs and outputs.\
Compression was losslessly verified against the original generated file.

The [first output](author-test-output-01.txt) and [child command record](initial-child-command.json) preserve the failed attempt: inherited `NODE_TEST_CONTEXT` caused Node to skip a recursive test runner, so the required capture was absent and qualification stopped.\
The corrected launcher removes that marker for its separate child runner; [second output](author-test-output-02.txt) records the six successful qualification tests and [supporting output](supporting-test-output.txt) records the other 36.\
All four retained output files were byte-compared with their originals.

---

## Reproduction and preservation

Run the no-provider qualification from the AGP repository:
```bash
AGP_PREPARATION_SOURCE_REPO=/home/apnex/taceng/context-lab node --test --test-reporter=tap docs/reviews/admission-evaluator-qualification/admission-qualification.test.mjs
```

Run the unchanged policy/accounting and repository record checks:
```bash
node --test --test-reporter=tap docs/reviews/admission-evaluation-preparation/admission-scoring-policy.test.mjs docs/reviews/admission-lifetime-assurance-r4/admission-comparison-accounting.test.mjs test/conformance/board-record.test.js test/conformance/record-integrity.test.js test/conformance/architecture-record.test.js
```

Observed Node version: `v24.12.0`.\
Exports are new scratch directories, with dependencies read from the existing sibling dependency cache; this is not a hermetic dependency rebuild.\
The only prior preparation code change selects an optional profile path and resolves its references relative to that path.\
The original default profile, policy, fixtures, reports, captures, both historical assurance packets, AGP runtime and CLI are unchanged.\
The static profile references the old execution config only as a frozen limits baseline, never as new execution authority.

---

## Rationale and remaining gates

The [source findings](admission-qualification-source-findings.md) and new development evidence cover the selected shape without patching or copying the evaluator.\
The fake episode's classification is an injected valid fixture; no real classifier behavior, delivery or sandbox property is established by it.\
No conductor, resume, registration, isolation probe, provider-capable invocation or security-fault case ran.\
Public tally parity does not replace AGP's conservative minimum-vote and quote-cap accounting.

Independent review must now decide static qualification against the exact committed artifacts and full records.\
Even a PASS resolves only the candidate-compatibility portion of PREP-L1; complete live invocation capture, real delivery/isolation and whole-conductor behavior remain unqualified.\
PREP-L2 requires a separately selected finite-budget diagnostic/calibration with exact caps, sanitized observations, representative reader/file checks and stop rules.\
PREP-L3 still requires later audited fresh questions/readers and independent assurance; historical FAIL/NO VERDICT remain unchanged.\
No live cap, Gemini repair, AGP adoption/implementation, B53 closure, B56 change, push or Zorg communication follows from these author results.
