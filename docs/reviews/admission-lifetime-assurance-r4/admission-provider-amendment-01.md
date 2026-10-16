# Admission comparison provider amendment

The director approved migration to the current provider, a bounded independent readiness recheck and execution of the whole six-reader comparison if its prerequisites pass.\
The admission design, questions and acceptance criteria do not change.

Status: prospective execution amendment, before registration or model calls.\
Tier 3: the execution choices below are selected procedure, not measured model availability or assurance.

---

## Changed execution inputs

The [previous preflight](admission-execution-preflight-01.json) stopped because the frozen pack named a provider absent from the current operator configuration.\
It did not establish an outage at the retired endpoint, and remains unchanged.

| Member | Previous selection | Selected selection |
|---|---|---|
| c, Claude | `litellm-netbird/claude-opus-5-5` | `litellm-nexus/claude-opus-5-5` |
| g, Gemini | `litellm-netbird/gemini-3.8-flash` | `litellm-nexus/gemini-3.8-flash` |
| o, GPT | `gpt-6-astra`, high reasoning | Unchanged |

Tier 2: the current operator file was inspected on 2026-10-16.\
The [frozen provider configuration](admission-provider-config.json) retains only the selected Nexus provider and these two model entries; it contains an environment-variable credential reference, never the credential value.\
The old environment-variable name persists in the current configuration; it is not a provider alias or permission to use the retired endpoint.

The route is `http://100.80.94.9:4000/v1`.\
Claude uses `@ai-sdk/anthropic`, adaptive thinking and high output effort, with declared context/output limits of 1,000,000/128,000 tokens.\
Gemini overrides the provider SDK with `@ai-sdk/openai-compatible`, with declared limits of 1,048,576/65,536 tokens.\
These routing and limit declarations differ from the earlier operator snapshots; this is not asserted to be a byte-identical runtime or backend-equivalence migration.

Both arms use the same frozen configuration through context-lab's public `opencodeAdapter({ operatorConfig })` option.\
Shared operator configuration is not edited or used implicitly, and no global instructions, plugins or additional models enter the experiment.\
Actual availability, delivery and isolation remain execution prerequisites, not conclusions from configuration.

---

## Preserved comparison

The [pack](pack.json) changes only the two provider prefixes above.\
The three member IDs, model IDs, families, six fresh reader cells, twenty-four questions, fifteen controls, instructions, keys, source inputs, projections and opaque arm mapping remain fixed.\
The [input manifest](admission-input-manifest.json) retains its historical preparation and population provenance unchanged.

The evaluator remains pinned to `6e6d0a92965a15ec473c661887b2b9c5037fedcf`.\
The [accounting correction](admission-accounting-amendment-01.md), conservative minimum-vote aggregation, quote cap, thresholds, retry bounds, blinding and non-author gate remain unchanged.\
Neither sibling projects' larger populations nor their later output-token settings are adopted.

The [execution configuration](admission-execution-config.json) fixes six-way parallelism, one run per cell, 1,200-second reader/probe limits and 900-second judge limits using the pinned public runner.\
Record the actual runtime versions, source checkpoint, configuration hashes, register entry and generated run seed before interpreting results.\
Declared provider limits are not a promise of available capacity or permission to retry unfavorable outcomes.

---

## Readiness and stop conditions

Commit this amendment and its execution inputs before the bounded non-author readiness recheck.\
That recheck must verify the exact provider delta, frozen packet preservation, the public execution boundary and full accounting for 144 outcomes and 288 intended vote slots, including missing, ended and unresolved phases.\
It does not repeat the already completed key audit or supply scored reader answers.

After readiness PASS, verify the clean pinned evaluator build and runtime versions, register the unchanged experiment, then require all six reader-profile and all three judge-profile delivery/isolation probes to pass before any scored reader invocation.\
If any prerequisite fails, preserve the failure and stop scored execution; do not substitute models or run a reduced comparison.\
If execution later becomes incomplete or invalid, retain all outcomes and report no gate verdict under the existing accounting rule.

Retain every reader attempt and judge reply, replay the evaluator tally, produce complete project accounting and obtain the non-author completed-measurement judgment.\
The earlier assurance FAIL and both readiness checkpoints remain historical evidence.\
No outcome ratifies AGP's public contract, verifies its runtime, closes B53, authorizes publication or requires a message to Zorg.
