# Evaluation runtime compatibility findings

Tier 2: local source inspection at `2026-10-16T21:30:30Z`; no provider request was sent.

## Inspected identities

| Role | Revision |
|---|---|
| Frozen AGP evaluator | `6e6d0a92965a15ec473c661887b2b9c5037fedcf` |
| Candidate evaluator, clean sibling checkout at inspection | `0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68` |
| Earlier upstream commit adding public reply-cap configuration | `9a9b5e96c484b37d3f3fdbf34c0e7b726747a0a1` |

The candidate was exported into a separate temporary directory and compiled with its existing TypeScript build.\
The sibling checkout and shared operator configuration were not changed.\
Compilation is not live-runtime qualification.

---

## Public surface findings

| Surface | Observed difference | Consequence for preparation |
|---|---|---|
| `judgeAll`, answer renderer and vote parser | `judge-panel.ts` is byte-identical at the frozen and candidate revisions; Git blob `306d7da951a88cefcdcfe0bc923ee4bbddab3070` | Capture-only use can exercise the same renderer/parser through the public export; semantic reason validation still belongs to the project |
| `Member.settings.outputTokenMax` | Candidate accepts a positive integer and explicitly adds `OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX` to the constructed OpenCode environment | Configuration is supported without patching a harness; this does not observe an SDK request or backend enforcement |
| `Adapter.route` | Candidate records model, endpoint, model settings and member settings; provider config is cached once per adapter | Useful declared-route evidence, not a wire trace; only the known sanitized provider configuration may be retained |
| Codex settings | No `outputTokenMax` support | A common population configuration must not pass this setting to Codex |
| `phase-driver.ts`, `validity-classifier.ts`, `parse-opencode.ts`, `workspace-builder.ts` | No source differences between these revisions | Their unchanged source does not establish the behavior of changed callers |
| Blinding | RNG/shuffle extraction, same loop and seed computation | Source-compatible mechanism; integration still needs exact unit/assignment checks |
| Tally | Adds held-out partitions, exposure and diagnostic results | Full result shape changes; any later replay must compare all relevant old fields and explicitly account for new fields |
| Conductor and episodes | New continuation/resume, phase and route-accounting paths | Not qualified by a judge-panel-only capture; require scoped compatibility checks before live use |

The total upstream diff is 30 files, 2,833 insertions and 127 deletions.\
This record does not certify the whole upgrade.

---

## Live-adoption blocker: probe retry and retention

At the candidate revision, `probeArm` invokes a fresh tools-off probe a second time if the first outcome contains tool calls.\
It replaces the local outcome variable and constructs the returned `ProbeResult.answers` from the final outcome only.\
The first invocation directory may remain on disk; the public returned result does not enumerate both attempts or their association.\
This is a source finding, not an executed failure reproduction.

The existing AGP record checks inspect the returned probe answers and require zero tool calls.\
They cannot infer from a clean final answer whether a discarded earlier probe used tools.\
Therefore those checks alone are insufficient for the candidate's retry behavior and all-attempt retention requirement.\
No such retry or changed failure policy is accepted by this preparation.

The earlier public-cap commit has the same `isolation-prober.ts` blob as the frozen evaluator: `bdb5c0b7b4d7be9fb6b6c6c5b0dfd9a69e57d9fb`.\
It is an alternative to review, not a selected live pin; it also lacks the candidate's tools-off on-request-mount change.\
Before live selection, either qualify a compatible upstream revision with unchanged policy or obtain an upstream attempt-recording/policy seam and review it.\
Do not copy or patch the shared evaluator into AGP to hide this difference.

---

## Unmeasured request budget

The [prior source findings](../admission-evaluation-repair-findings.md#client-output-ceiling-and-public-configuration-seam) derive a client-side default but do not contain a captured historical request.\
Neither the public route record nor a successful `refuse` check proves the client-emitted token parameter, the proxy transformation or the backend's effective limit.

Before selecting a live cap, agree a sanitized observation method that records each known layer separately and labels the rest unknown.\
Do not retain authorization headers, credential values or sensitive request content.\
The two old Gemini stops remain unexplained; their visible output, reasoning use and finish reason remain separate facts.

No runtime pin, live token value, retry policy, calibration budget or whole-comparison authorization is selected by these findings.
