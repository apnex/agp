# Admission diagnostic capability findings

Tier 2: pinned source and retained-record observations, 2026-10-17 Australia/Melbourne.\
The inventory made no diagnostic/runtime/provider call and read no credential store or account configuration.

## Inspection boundary

AGP baseline: `d8305fcdda94613c116e6530af44458336d9d4ee`.\
Selected static-qualified evaluator: `e705b3d749400d0a79efe98e5338e9c84a1695b8`.\
Owner documentation discovery used local committed context-lab `ecb2f5f29d6aba8c58e9588d34b677b516ef03d8`, not its dirty working files; this is not adoption or a remote-freshness claim.

The [inspection record](admission-diagnostic-capability-checks.json) retains exact commands, complete bounded-search output, source Git blobs/SHA-256, frozen evidence hashes and the selected old-run metadata.\
The search covers committed README, VISION, architecture, backlog, board, deltas, public exports and Outcome; it is not a provider/account audit.\
The source inventory identifies files, not a claim that every inventoried file was fully read.

---

## Public surfaces at the selected evaluator

| Surface | Source observation |
|---|---|
| Request admission and accounting | [Invocation/Adapter](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts) and [RunOptions](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/run-conductor.ts) expose invocation and wall-limit settings, not per-provider-request admission, monetary reservation or settled remote cancellation |
| Declared output limits | [OpenCode settings](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts) accepts positive integer `outputTokenMax` and forwards it through an environment setting; the Codex member-setting loop accepts only `reasoningEffort` |
| Returned usage and trace | [Outcome](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/outcome.ts) contains elapsed seconds, token counters, tool-call count and runtime trace, not a complete billable-request/retry ledger or currency reservation |
| Sanitized observation | [Declared routes and event writer](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts) omit selected credential/header fields and scrub known secret strings; these interfaces do not promise captured outbound HTTP requests or effective backend/account budgets |
| Retention boundary | [Sandbox runner](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/runtime-sandbox.ts) accumulates lines in process memory and kills the local child at its timer; both runtime paths call `writeEvents` after awaiting that runner and performing cleanup, not through a durable streaming callback |

The captured diff to the owner's later committed snapshot changes only two tools-off mount selections in `adapters.ts`; `outcome.ts` and `runtime-sandbox.ts` have no diff.\
README, VISION and architecture also have no diff between those two pins.\
Other evaluator files changed; this is not whole-evaluator equivalence.

---

## Retained configuration and acceptance evidence

| Evidence identity | Recorded scope and limit |
|---|---|
| [Frozen sanitized provider declaration](admission-lifetime-assurance-r4/admission-provider-config.json), SHA-256 `98668a42f2fb4e913b07a539b40df560d7cf6051dfe15226602e2f22cd37e7b0` | Nexus endpoint, Claude/Gemini clients, model limits/options and an environment credential reference; no request-count/spend reservation or authoritative billing-ledger configuration appears in this file |
| [Old execution configuration](admission-lifetime-assurance-r4/admission-execution-config.json) and [completed run](admission-lifetime-assurance-r4/records/2026-10-16-060526-admission-clarity/run.json) | Evaluator `6e6d0a92965a15ec473c661887b2b9c5037fedcf`, OpenCode 1.19.2, Codex CLI 0.162.1; six reader and three judge probe profiles record PASS with no reasons; reader population settings omit OpenCode caps and retain Codex high reasoning |
| [Completed independent review](admission-lifetime-assurance-r4/admission-gate-review-01.txt), lines 144-170 | Accepts those nine profiles within their preregistered isolation/delivery checks; the overall assurance result remains NO VERDICT for the separately established scoring defect |
| [Static qualification profile](admission-evaluator-qualification/admission-qualification-profile.json) and [independent review](admission-evaluator-qualification/admission-qualification-review-01.txt), lines 170-196 | Candidate compatibility only; zero live calls, no selected live cap, no client/backend observations, real delivery/isolation and full live capture unqualified |
| [Diagnostic design recheck](admission-diagnostic-design-recheck-02.txt) | Ordinary non-author design review was performed; its bounded design/M7 PASS is not an assignment or availability commitment for later packet/stage reviews |

The old run has no `routes` field; its selected metadata projection does not independently verify the declared provider route.\
No current binary version, deployed provider controls, Codex account controls, pricing or remote cancellation behavior was measured.\
The retained Nexus declaration does not describe the separate Codex account/runtime path.\
These scoped absences do not establish that the deployed services lack other facilities.
