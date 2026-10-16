# Admission diagnostic source findings

Tier 2: read-only observations on 2026-10-17 Australia/Melbourne at AGP `60dab84e7f02e4f4b917163f357af8c10ea2f554` and context-lab `e705b3d749400d0a79efe98e5338e9c84a1695b8`.\
No runtime or provider invocation was made.

## Public execution and recording surfaces

| Source at the evaluator pin | Observation |
|---|---|
| [Invocation and Adapter](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts#L22) | Invocation declares a member, prompt, delivery mode, tools, workspace, work directory and wall limit; Adapter exposes refusal, invocation and optional declared-route reporting |
| [OpenCode settings](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts#L179) | A positive integer `outputTokenMax` is accepted and assigned to `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX`; the route reports declared member settings |
| [Codex settings](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts#L297) | The member-setting loop accepts only `reasoningEffort`; this public evaluator seam cannot apply `outputTokenMax` to Codex |
| [Common Outcome](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/outcome.ts#L29) | Returned cost contains elapsed seconds, token counters and tool-call count, not currency expenditure, a monetary reservation or an authoritative provider-request ledger |
| [OpenCode parser](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/parse-opencode.ts#L41) | Aggregates tokens across step-finish events; adds visible and reasoning output into the common output counter; retains individual finish reasons in trace |
| [Runtime events](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts#L96) | Writes scrubbed runtime event lines; neither the Invocation interface nor the Outcome contract promises emitted HTTP request bodies or effective backend budget observations |
| [Local wall timer](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/runtime-sandbox.ts#L69) | Timer kills the local sandbox process; the source does not acknowledge cancellation or settled billing at a remote provider |
| [Public exports](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/index.ts) | Exports runtime interfaces, `blind`, `judgeAll`, `runEpisode`, `classify` and `splitAnswers`; these permit public composition without copying their implementations |

The examined `Invocation`, `Adapter`, `Outcome`, `PanelOptions` and `RunOptions` interfaces contain no aggregate currency budget or per-provider-request admission reservation.\
This is a statement about those interfaces, not proof that the deployed provider or account has no budget facility.\
A runtime invocation and a billable provider request are separate units; the returned aggregate token count does not enumerate all transport retries.

---

## Judge jobs and existing calibration material

The [public panel](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/judge-panel.ts#L174) groups eligible units by judge, scenario, phase and answer/outcome form, then batches them by `outcomesPerPrompt`.\
Each unit is assigned only to other-family judges.\
An incomplete syntactic result can cause up to three invocation attempts for that job; an already accepted vote is not submitted again.\
The job record retains its initial prompt and reduced reply fields (`final`, tool count and error message), not each full Invocation/Outcome pair.\
Job records and invocation attempts have separate counts; neither supplies a complete provider-request count in this interface.

The unchanged [scoring cases](admission-evaluation-preparation/admission-scoring-cases.json) contain seven present answers and one absent answer.\
Their expected present scores, in file order, are `2, 2, 1, 1, 1, 0, 0`; the absent case has no raw vote and an outcome score of zero.\
They are author-authored library-policy development cases, not reader observations.\
The [scoring policy](admission-evaluation-preparation/admission-scoring-policy.mjs) is separate from the literal fixtures.

| Frozen file | SHA-256 |
|---|---|
| Scoring cases | `cb5a4f9416ab8673535b66260159672fcfef0a6be4d6772d75cdc0ef9e5a2436` |
| Scoring policy | `c92a6540eb1b4d01d84225e4abcd7e7c19800904e95888081bd4592f3c3d20fb` |
| Static qualification profile | `d101581d489ba78b1cede08439c8a0132f02dfa4936aab8bc837bd5b3611892b` |

---

## Recorded workload dimensions

The frozen [experiment](admission-lifetime-assurance-r4/admission-clarity-experiment.json) has two arms, three member families, one new answer phase, 24 questions and six outcomes per judge prompt.\
Its [execution configuration](admission-lifetime-assurance-r4/admission-execution-config.json) sets reader/judge wall limits to 1,200/900 seconds and records the prior runtime-version prerequisites.

| Retained input or output | UTF-8 bytes |
|---|---|
| Candidate instruction document | 61,616 |
| Predecessor instruction document | 48,331 |
| Scenario task | 8,668 |
| Experiment reader instructions | 1,018 |
| Four present answer files | 30,601; 29,689; 28,083; 30,595 |

The two other reader cells contain no answer file.\
The [prior source findings](admission-evaluation-repair-findings.md#gemini-reader-termination) retain their `length` finish reason, zero visible output and nonzero reasoning separately; they do not establish the cause.\
Bytes are not token counts or a measure of semantic difficulty.

---

## Preservation and scope

The [static profile](admission-evaluator-qualification/admission-qualification-profile.json) still declares zero live calls and cost, with no adopted live evaluator or selected live cap.\
The [shape checks](admission-evaluator-qualification/admission-qualification-shape.mjs) compare the complete original population/settings, limits, source declarations and 24-property shape, so a different diagnostic cannot inherit that exact configuration claim.
