# AGP admission diagnostic evidence correction request

From: AGP project, 2026-10-17 Australia/Melbourne.\
To: context-lab maintainer; provider questions also need the Nexus/OpenCode and separate Codex account operators.\
Status: DRAFT - NOT SENT; the director selected local preparation only.

Thank you for distinguishing supported client facilities from unsupported harness controls and unknown provider guarantees.\
Your [capability response](../../../context-lab/incoming/agp-admission-diagnostic-capability-response.md) helps identify ownership, but does not establish a supported path for AGP's admission diagnostic.

Please supply a correction/addendum that resolves the evidence discrepancies below and identifies what could close each remaining capability gap.\
Retain the original response unchanged so the corrections remain traceable.\
This is an information request, not authorization for implementation, configuration changes, credential access, new probes or model calls.

## Evidence corrections

### Baseline revision identities

All three full revision identifiers in the response fail commit lookup in their respective inspected, non-shallow local clones.\
Independent short-prefix lookups produced the following results, also checked through the GitHub commit API.

| Repository | Identifier in the response | Independently resolved reference |
|---|---|---|
| context-lab | `2ffda23bc23b9d72b150e78bdcc1031e53075a16` | Prefix `2ffda23` resolves to `2ffda2386541bcf2fd7db67911a7c5f2e03514f1` |
| mission-kit | `d09461ec6c51d477ef36c59277f4d28b797be4a9` | Prefix `d09461e` resolves to `d09461e8d9588fba8e59f4a63d0f93418f773dbe` |
| Zorg | `cccf30e0138df7c9665f17c143d48511819cc109` | Neither the full identifier nor prefix `cccf30e` resolves locally; the GitHub prefix lookup returns no commit |

These results do not establish which revisions you actually inspected, or that the Zorg commit never existed elsewhere.\
Please confirm the correct full identities and rebind the affected capability/source citations to them; AGP will not silently substitute a matching prefix.

### Recorded runtime version

The cited [C0 run record](../../../mission-kit/docs/evals/runs/context-lab/2026-10-17-082606-c0/run.json) records `runtimes.codex: "codex-cli 0.162.1"`, not the response's `codex-cli 0.120.0`.\
The cited [adherence run record](../../../mission-kit/docs/evals/runs/context-lab/2026-10-14-112229-adherence/run.json) also records `codex-cli 0.162.1`.

Please correct the version attribution.\
The corrected version matches AGP's [old execution configuration](admission-lifetime-assurance-r4/admission-execution-config.json), but that match alone does not qualify the proposed evaluator, role settings, delivery configuration or allowed files.

### Retry counts and their layer

The [public Delta 4 definition](../../../context-lab/docs/DELTAS/DELTA-4.md) defines `retriedCells` as cells with `c.attempts.length > 1`.\
The [fault report](../../../context-lab/docs/probes/2026-10-17-provider-faults.json) records 436 GPT cells, 461 attempts and 25 retried cells.

Those figures establish harness-level cell reruns, not hidden provider/SDK retries within a runtime invocation.\
Please retract that inference or supply separate existing evidence for it, retaining the distinction between cell attempts, runtime invocations and billable provider generations.\
The need to bound hidden billable work remains; this correction does not establish that hidden retries are absent.

---

## Capability closure required

The [original request](admission-diagnostic-owner-request.md), [proposal](admission-diagnostic-proposal.md) and [capability-first amendment](admission-diagnostic-amendment-01.md) remain the requirements.\
The proposed driven envelope is at most 36 runtime invocations, 120 provider requests and USD 20, including retries, tool turns and outstanding reservations, with single-flight execution and a 90-minute elapsed deadline including inter-stage reviews.\
These are not an approved execution budget; ordinary author/non-author review resources remain outside that envelope and are not represented as free.

Please answer the following separately for Nexus/OpenCode and Codex.

| Requirement | What the response resolves | What is still needed |
|---|---|---|
| Pre-dispatch request and spend guarantees | Reports unsupported aggregate reservation/request ceilings in context-lab and unknown provider/account enforcement | Existing supported admission/refusal contract and sanitized deployment/account evidence for a finite run-total bound, covering billable input, reasoning/output, retries, tool turns and outstanding remote work; a subscription route needs an explicit equivalent bound for AGP to approve |
| Request attribution and observation | Reports sanitized client declarations and emitted runtime events, with hidden retries unobserved | Supported correlation from provider generations to invocations and judge jobs, including retry semantics, effective request settings and relevant backend/account guarantees, with explicit redaction boundaries and unknowns |
| Retention through termination | Distinguishes child timeout/crash retention from the parent-process kill gap | Supported persistence/supervision boundary and existing evidence covering complete sanitized events and accounting, invocation/request/job maps, exceptions and relevant parent termination paths; specify capture, flush/durability and reservation recovery semantics |
| Exact-profile containment and delivery | Cites historical recorded passes; explicitly excludes the proposed OpenCode cap profiles | Matching already accepted evidence for the evaluator, actual runtime binaries, role settings, delivery and allowed files, or a precise prerequisite gap; no new probe execution is requested |
| Provider ownership and routing | Names the Nexus and Codex operator roles | A confirmed owning team/contact or delivery destination for each path, or an explicit unknown; a service endpoint is not an owner contact |

Your proposed streaming writer and invocation/token guard may address parts of these gaps, but they are not established closure of the whole requirements.\
Post-invocation token totals do not reserve worst-case spend before dispatch; a runtime invocation cap does not itself bound provider generations within each invocation.\
Rate limits such as the cited `rpm_limit` and `tpm_limit` do not, by themselves, establish the required per-run request and currency ceilings.\
Please distinguish proposed facilities from supported interfaces and verified deployment guarantees, rather than marking a whole gap closed by an option.

Local timeout or process termination does not establish remote billing cancellation.\
An ambiguous remote request keeps its worst-case reservation charged until settlement or continued reservation accounts for it.

For exact-profile evidence, the two cited run records use `outputTokenMax: 1048576` for the relevant OpenCode members, not the proposed `8192` ordinary/judge caps and `32000` Claude / `65536` Gemini reader caps.\
Both records list judge probes for members `a`, `c`, `o` and `x`, not their Gemini Flash member `f`; AGP's [frozen population](admission-lifetime-assurance-r4/pack.json) names that model `g`, so compare model, runtime, settings and role rather than equating local member labels.\
Shared family membership alone is not matching judge-profile evidence.

The C0 record identifies evaluator `2ffda2386541bcf2fd7db67911a7c5f2e03514f1`, while AGP's [static-qualified candidate](admission-evaluator-qualification/admission-qualification-profile.json) is `e705b3d749400d0a79efe98e5338e9c84a1695b8` and is not adopted for live use.\
A newer supported revision is a useful answer, but adopting it requires a scoped compatibility review rather than transferring an earlier qualification.

---

## Requested reply and next decision

For every required capability, please return supported, unsupported or unknown, with the exact interface/version/configuration, evidence identity, covered scope/exclusions and owning team/contact.\
Where work is needed, identify the separately selectable owner-side work and what evidence would close the requirement; do not start or schedule it from this request.\
For provider questions outside your authority, identify the routing destination or record it as unknown rather than answering for that owner.\
Keep credentials and private account contents out of the reply; use only supported, sanitized evidence.

AGP retains the existing [zero-call stop](admission-diagnostic-capability-result.md): no supported diagnostic path is established.\
That is neither a new diagnostic FAIL nor readiness PASS, and the response does not reopen packet construction or execution.

Once an owner response establishes a supported path, AGP can reconsider the capability inventory, then separately select preparation, reviewer assignment, readiness review and exact-packet execution.\
Missing generic runtime budget, tracing or retention capabilities belong with context-lab/provider owners; AGP will not build a private evaluator substitute.\
B53 admission repair and B56 runtime acceptance remain open, and this request does not alter their frozen assurance records or authorize an AGP runtime change.\
This admission request is separate from the already delivered direct-peer assurance contract request.

---

## Evidence preservation and rationale

| Reference | Measured identity |
|---|---|
| Response assessed | 14,066 bytes; SHA-256 `f3e74ece7eee1eda14dde069ce05c3aade3317784ec1c5f74f652eed27052ecc` |
| Local AGP drafting baseline | `a09e4bcda9d668b52ff3212c3813fad30fa7ac10`, with pre-existing uncommitted work retained |

Mechanics: correct the source identities and retry attribution, then map each unchanged prerequisite to supported evidence or an explicit owner-side gap.\
Rationale: partial observability and historical passes cannot supply missing enforcement or exact-profile acceptance.\
Consequence: the diagnostic remains stopped until a supported path is established, preventing accidental spending, evidence loss or an AGP-local fork.
