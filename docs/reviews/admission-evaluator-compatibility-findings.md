# Admission evaluator compatibility findings

Tier 2: source and author-check observations on 2026-10-17 Australia/Melbourne.\
Scope: public output-cap support, probe retries and records, and the current AGP pack's exposure to the changed mount rule.\
No provider, probe, conductor or experiment-registration invocation was performed.

## Inspected revisions

| Role | Exact context-lab revision |
|---|---|
| Frozen AGP evaluator | `6e6d0a92965a15ec473c661887b2b9c5037fedcf` |
| First public output-cap revision | `9a9b5e96c484b37d3f3fdbf34c0e7b726747a0a1` |
| Parent candidate | `e705b3d749400d0a79efe98e5338e9c84a1695b8` |
| Previously reviewed candidate and freshly observed upstream main | `0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68` |

The [check record](admission-evaluator-compatibility-checks.json) retains the remote observation, all commands and outputs, and the 29 core source-file blob identities at each revision.\
The parent candidate is the observed tip's immediate parent, not a locally patched evaluator.

---

## Probe policy and retained records

| Surface at the observed tip | Source observation |
|---|---|
| [Probe invocation](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/packages/core/src/isolation-prober.ts#L59) | A first outcome containing tool calls causes one fresh invocation; its outcome replaces the first before answer construction |
| [Public probe types](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/packages/core/src/isolation-prober.ts#L29) | Returned answers contain question, response, finding and tool count, but no attempt collection, invocation reference or raw outcome; options contain no retry-policy choice |
| [Probe consumers](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/packages/core/src/run-conductor.ts#L297) | The conductor stores returned probe results and uses their pass flags to select judges and cells |
| [Cell retry loop](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/packages/core/src/run-conductor.ts#L344) | Cell attempts are retained and a separate validity classification determines whether the second attempt is permitted |
| [Common classifier](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/packages/core/src/validity-classifier.ts#L51) | Infrastructure and isolation causes permit retry; behavior does not; the probe retry does not call this classifier |

The [upstream test](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/packages/core/test/isolation-prober.test.ts#L81) explicitly expects a clean second probe to pass after a first tool call.\
That test was inspected, not executed.\
The [upstream architecture](https://github.com/apnex/context-lab/blob/0c0ab1f0248ef0cbb21885d7d6af76586d8a1b68/docs/ARCHITECTURE-TARGET.md#L73) declares whole records and failure classification; its once-only retry description is about cells.

AGP's [frozen validity rules](admission-lifetime-assurance-r4/admission-assurance-preregistration.md#validity-and-full-accounting) permit the pinned runner's infrastructure/isolation retry and require every attempt retained.\
Its [probe accounting](admission-lifetime-assurance-r4/account-admission-comparison.mjs) checks the returned answer tool counts, not an independent invocation inventory.\
The new probe branch is therefore a distinct mechanism from the permitted classified cell retry; this source inspection does not label its first outcome a runner-classified behavior failure.

---

## Parent candidate and current delivery shape

The parent candidate's [probe implementation](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/isolation-prober.ts#L66) invokes once per question and retains that question's tool count.\
Its complete probe file is identical to the frozen evaluator's, blob `bdb5c0b7b4d7be9fb6b6c6c5b0dfd9a69e57d9fb`.\
Its adapter file is identical to the first cap-bearing revision's, blob `d0f0554147d82d79267483ede44c294b360e099e`.

Only `adapters.ts` and `isolation-prober.ts` differ between parent and tip among the 29 core source files.\
The adapter delta consists of two guards that remove `onRequest` mounts for tools-off invocations; the public panel, conductor, episodes, tally, exports and dependency declarations are unchanged between those two revisions.\
This is source identity, not qualification of those components.

The current [AGP pack](admission-lifetime-assurance-r4/pack.json) has two instruction-only arms and no hooks.\
The [arm composer](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/arm-composer.ts#L40) starts `onRequest` empty and populates it only for on-request delivery; the [judge arm](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/judge-panel.ts#L43) also has none.\
The changed mount expressions therefore both yield empty lists for this declared shape.\
This does not establish sandbox behavior or suitability for a pack with on-request delivery.

---

## Author checks and limits

The [complete check record](admission-evaluator-compatibility-checks.json) contains twelve successful author checks, including byte comparison of all 128 exported tracked files, a forced isolated TypeScript build and non-invoking public-interface checks.\
The parent accepts the positive integer test cap through OpenCode's public refusal check and reports it in the declared route; Codex refuses it.\
The test value is not a live selection, and neither client-request nor backend-budget behavior was observed.

The first inventory command failed because it assumed every newer path existed at the frozen revision.\
Its full command and failure remain in the record; the completed inventory represents absent historical paths as null.\
No prior experiment, prepared policy, reviewed profile or AGP source was changed.

The changed conductor, episode and tally paths relative to the original frozen evaluator remain unqualified for a replacement run.\
No new capture-only panel run or independent readiness review was performed against the parent candidate in this inspection.
