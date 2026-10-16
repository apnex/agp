# Admission evaluation repair source findings

Tier 2: retained records and source inspection for the proposed evaluation repair.\
Observed on 2026-10-17 Australia/Melbourne against AGP checkpoint `354dd189eb0951e7cbd703237a75bce6272ab563`.

## Judge delivery

The [reader instructions](admission-lifetime-assurance-r4/admission-clarity-experiment.json) explicitly say the design is not implemented or adopted.\
The [candidate input](admission-lifetime-assurance-r4/inputs/m42/DESIGN.md) carries that status and describes the capacity-wait projection as a recommendation.

The [preregistration](admission-lifetime-assurance-r4/admission-assurance-preregistration.md#required-answers-and-diagnostic-separation) defines score 1 by a deficiency in a required decision or the quotation cap.\
Its validity section defines a hedge as uncertainty about a required decision and excludes intended scope exclusions.

Reading all 32 retained judge-job introductions gives the following census.

| Delivered text | Jobs containing it |
|---|---|
| Exact configured judge instructions | 32 of 32 |
| Prohibition on requiring unasked detail | 32 of 32 |
| Statement that intended scope exclusions are not hedges | 32 of 32 |
| Reader instruction that the design is not implemented or adopted | 0 of 32 |
| Preregistered phrase defining uncertainty about a required decision | 0 of 32 |

All 24 property rubrics are identical; they request `HEDGE=yes|no` but do not define proposal-status qualifications.\
The [actual A16 job](admission-lifetime-assurance-r4/records/2026-10-16-060526-admission-clarity/judging/admission-clarity.answer.answers.g.15.json) includes all five answer excerpts and the complete answer.\
Its Gemini reply assigns score 1 while declaring correct decisions, complete coverage and supported claims, solely penalizing the recommendation-versus-adopted-contract statement.

At the [pinned evaluator revision](https://github.com/apnex/context-lab/blob/6e6d0a92965a15ec473c661887b2b9c5037fedcf/packages/core/src/judge-panel.ts), `answerPrompt` supplies experiment judge instructions, question, key, rubric and answer, but neither the reader instructions nor the full assigned design.\
The custom judge instructions replace the generic fallback; that fallback is not an additional instruction delivered in this run.\
`validate` checks item/property association and integer score range, then retains the reason as text; it does not check whether the reason justifies the score.

## Gemini reader termination

The retained [candidate cell](admission-lifetime-assurance-r4/records/2026-10-16-060526-admission-clarity/cells/admission-clarity.m42.g.1.json), [predecessor cell](admission-lifetime-assurance-r4/records/2026-10-16-060526-admission-clarity/cells/admission-clarity.x19.g.1.json) and their [candidate](admission-lifetime-assurance-r4/reader-m42-g-events.jsonl) and [predecessor](admission-lifetime-assurance-r4/reader-x19-g-events.jsonl) streams record:

| Field | Candidate | Predecessor |
|---|---|---|
| Attempts | 1 | 1 |
| Runtime duration in seconds | 162.659 | 228.685 |
| Process exit and signal | 0 and null | 0 and null |
| Event finish reason | `length` | `length` |
| Visible output tokens | 0 | 0 |
| Reasoning tokens | 27,146 | 25,330 |
| Final message and answer file | Absent | Absent |

The [execution configuration](admission-lifetime-assurance-r4/admission-execution-config.json) allows 1,200 seconds per reader.\
Neither recorded stop is a wall-clock timeout.\
The [pinned parser](https://github.com/apnex/context-lab/blob/6e6d0a92965a15ec473c661887b2b9c5037fedcf/packages/core/src/parse-opencode.ts) adds visible and reasoning tokens into common `outputTokens`, retains `length` in the trace, and labels a zero-exit non-error stop `completed`.\
The [classifier](https://github.com/apnex/context-lab/blob/6e6d0a92965a15ec473c661887b2b9c5037fedcf/packages/core/src/validity-classifier.ts) then classifies an empty final message as behavior failure; that accounting remains unchanged.

## Client output ceiling and public configuration seam

The [frozen Gemini provider declaration](admission-lifetime-assurance-r4/admission-provider-config.json) sets `limit.output` to 65,536 through `@ai-sdk/openai-compatible`.\
It contains no Gemini reasoning-budget option or explicit output-cap override.

OpenCode tag `v1.19.2` resolves to `7901b7d325c34852caa84fc2c325f3a08dd7a473`; the local version query and retained runtime receipt both report `1.19.2`.\
This identifies the inspected release source, not an attestation that the historical binary was built from that exact commit.

- [Provider transform](https://github.com/anomalyco/opencode/blob/7901b7d325c34852caa84fc2c325f3a08dd7a473/packages/opencode/src/provider/transform.ts#L1386): the output ceiling is the minimum of the model limit and an override, whose default is 32,000.
- [Runtime flags](https://github.com/anomalyco/opencode/blob/7901b7d325c34852caa84fc2c325f3a08dd7a473/packages/opencode/src/effect/runtime-flags.ts#L50): the override comes from `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX`.
- [Request preparation](https://github.com/anomalyco/opencode/blob/7901b7d325c34852caa84fc2c325f3a08dd7a473/packages/opencode/src/session/llm/request.ts#L120): that calculation becomes `maxOutputTokens` before the SDK call.
- [Pinned evaluator runtime boundary](https://github.com/apnex/context-lab/blob/6e6d0a92965a15ec473c661887b2b9c5037fedcf/packages/core/src/adapters.ts): only `reasoningEffort` is accepted as a member setting; the constructed environment supplies no output-cap override.
- [Pinned sandbox](https://github.com/apnex/context-lab/blob/6e6d0a92965a15ec473c661887b2b9c5037fedcf/packages/core/src/runtime-sandbox.ts): the process receives that explicit environment, not the operator's inherited shell environment.

The matching release path therefore implies a 32,000-token client parameter, not the declared 65,536-token model limit.\
That is source-derived, not a captured historical request or backend-limit measurement.\
Both reported reasoning counts are below 32,000; neither establishes which layer caused the stop.

Upstream commit [`9a9b5e9`](https://github.com/apnex/context-lab/commit/9a9b5e96c484b37d3f3fdbf34c0e7b726747a0a1) adds public member setting `outputTokenMax`.\
At the inspected clean sibling revision `0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68`, the [runtime boundary](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/packages/core/src/adapters.ts#L184) accepts a positive integer, passes the override into the sandbox and records member settings with the route.\
The diff from AGP's pinned evaluator spans 30 files, including conductor and accounting-related code; adopting it would require compatibility review, not a version-only claim.

## Retention boundary

The historical temporary evaluator and execution directories are absent at this follow-up.\
The committed records and prior independent reconciliation remain available, but they contain no captured provider request body or effective backend budget.\
No shared operator configuration, credential, model response, source design, score or prior verdict was changed during this inspection.

The prompt census and cell fields above were re-read at `2026-10-16T21:11:18Z` using local JSON parsing only.\
The retained independent review SHA-256 remains `7197bfae7413f1ca76d47f0adbf2f376bb8a97a4731e2d427c18244f883689f9`; the two preserved event hashes remain those in its provenance section.
