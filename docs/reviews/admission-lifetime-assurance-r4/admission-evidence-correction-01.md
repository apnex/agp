# Admission execution evidence correction

The [independent readiness review](admission-provider-readiness-03.txt) found three blocking defects in the new execution/accounting tooling.\
This prospective correction binds derived scores to their retained evidence before the selected experiment can run.\
It changes no design, question, key, control, score, threshold, retry allowance or provider selection.

Status: author correction awaiting bounded independent recheck; no registration or model call has occurred.\
The failed checkpoint is `b2514d0337ed5a127f5cd15ade639189be8e4fd9`; its report is preserved verbatim in `1f271a484e38822454798bd4b1978d6cc911cced`.

---

## Corrections and consumers

| Finding | Correction | Consumer |
|---|---|---|
| `PR-01`: votes not linked to raw replies | Replay retained jobs through the pinned public `judgeAll` with a no-model reply source; require exact initial prompt/member, job/reply coverage and resulting vote identity, value and reason | Project accounting requires the replay result and its hash binding to the same retained inputs |
| `PR-02`: raw probe/reader evidence could disappear | Reconcile recorded probe questions and responses with the pinned canary/leak rules; require linked raw attempt/phase outcomes and prompt, and raw scored-file equality with eligible phase material | The launch guard checks actual recorded probe content; analysis additionally re-renders phase prompts and replays extraction/blinding |
| `PR-03`: receipt coverage was self-declared | Resolve the full reviewed Git commit, derive its complete packet inventory, compare every blob and required execution file, and verify the readiness report's hash, PASS and exact target | A shared checker runs before registration and during retained-record analysis |

Tier 2: these are source changes, not observations of actual provider or reader behavior.\
The [judge replay](replay-admission-judgments.mjs) invokes no runtime and changes no original record.\
It uses a temporary records directory and normalizes only that directory in the public renderer's warning; all other prompt content must match.\
The public panel owns parsing, local-ID reassignment, tools-off acceptance and pending-only completion, including retained exceptions.\
The original run remains six-way parallel; the deterministic replay is serial and is not another experiment or favorable retry.

Probe checks retain the pinned prober's actual allowance for an unanswered non-canary question when the required delivery/liveness conditions still hold.\
They do not substitute a stronger isolation guarantee for the limited canary/withheld-content observation.\
Raw evidence, exact-input quotation checks, all original reasons and non-author semantic review remain necessary; no checksum is presented as cryptographic runtime attestation.

---

## Author checks and remaining gate

Twenty-five static tests pass: five input/projection checks, fifteen accounting checks, three public-panel replay checks and two reviewed-receipt checks.\
The replay tests exercise real public prompt rendering/parsing with explicitly synthetic records; the receipt tests use temporary Git fixtures.\
The accounting unit tests use explicit replay stand-ins for arithmetic, while separate public-panel tests exercise the actual replay mechanism.\
None supplies a scored reader answer or measured comprehension result.

The checks reject the review's missing/non-JSON reply, altered vote/reason, misassigned prompt, missing raw observation and omitted receipt-coverage cases.\
They also cover pending-only reply completion, retained panel failure, incorrect first prompts, extra replies, wrong reviewed revisions and readiness/configuration drift.\
The original seventeen-test PASS and readiness FAIL remain historical records, not retrospectively repaired evidence.

Commit these prospective bytes, then obtain a bounded non-author recheck of `PR-01` through `PR-03` and preservation of the comparison.\
Do not launch on author tests alone.\
After readiness PASS, the already selected execution still requires actual runtime delivery/isolation and complete project accounting, followed by the independent completed-measurement verdict.\
AGP implementation, public-contract ratification, B53 closure, publication and Zorg correspondence remain outside this correction.
