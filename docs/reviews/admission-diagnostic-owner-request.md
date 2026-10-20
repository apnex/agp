# AGP admission diagnostic capability request

From: AGP project, 2026-10-17 Australia/Melbourne.\
To: context-lab maintainer; provider-side questions also need the Nexus/OpenCode and separate Codex account operators.

**Publication correction:** Repository-relative links replace the original workstation-absolute links below.\
The [original handoff bytes](https://github.com/apnex/agp/blob/0aa6be75ccacf4e2c3770a49c5ea39970a25a98a/docs/reviews/admission-diagnostic-owner-request.md) remain preserved; requirements and historical status are unchanged.

Please identify existing supported controls and evidence that could unblock AGP's admission-design diagnostic.\
This is an information request, not authorization to implement facilities, change configuration, run probes or spend on model calls.\
AGP's read-only inventory stopped before any diagnostic call because the required evidence was not established; it does not claim the deployed providers lack the capabilities.

## Questions for the owners

1. Which supported interfaces and sanitized, versioned deployment/account records cover pre-dispatch request admission and worst-case spend reservation, every billable retry/tool turn, and correlation from provider requests to runtime invocations and judge jobs?
2. Which supported persistence/supervision boundary retains full sanitized events and accounting across the relevant local deadlines/exceptions, and which already accepted containment/delivery evidence covers the proposed diagnostic profile?
3. For each unavailable or unknown capability, who owns it and what existing evidence or separately selected owner-side work could close the gap?

Please answer separately for the Nexus/OpenCode and Codex paths.\
For each capability, give supported, unsupported or unknown; the owning team/contact; the exact interface/version/configuration; an evidence reference; and its covered scope and exclusions.\
Identify supported observations of emitted request settings and effective backend/account enforcement, with redaction boundaries; do not include credentials or private account data.\
If a provider question is outside your authority, identify its owner or routing destination rather than answering for that owner.

---

## Proposed profile for the capability answer

These are unchanged proposals, not an approved execution budget.

| Concern | Proposed requirement |
|---|---|
| Workload | Three ordinary-delivery calls, nine calibration jobs with at most three completion attempts each, and six representative reader cells; single-flight execution |
| Driven ceilings | At most 36 runtime invocations, 120 provider requests and USD 20 attributable spend, including retries and outstanding reservations |
| Time | 90 minutes elapsed from the first invocation, including inter-stage review; per-call limits of 60 seconds for ordinary delivery, 900 for judges and 1,200 for readers, clamped to the remaining deadline |
| OpenCode models | `litellm-nexus/claude-opus-5-5` and `litellm-nexus/gemini-3.8-flash`; proposed `outputTokenMax` 8192 for ordinary delivery/judges, 32000 for Claude readers and 65536 for Gemini readers |
| Codex model | `gpt-6-astra` with `reasoningEffort: high`; no unsupported reply-cap setting; request/spend bounds still apply |

Each new billable generation, including a hidden proxy/backend retry, must be counted or conservatively reserved before admission.\
A local timeout does not establish remote cancellation or release an outstanding reservation.\
A subscription/quota route needs an explicit equivalent bound for AGP to approve; unknown billing is not free.\
Ordinary author/non-author review resources are outside the driven ceilings and are not represented as free.

The old nine accepted isolation/delivery profiles cover their recorded configuration, not this proposed profile by inheritance.\
Please cite matching already accepted evidence or identify the missing prerequisite; this request does not authorize producing it with new live calls.\
Backend effective reply limits may remain unknown where independent aggregate request/spend guarantees satisfy the frozen proposal; please distinguish that case from missing budget guarantees.

---

## References and reply

The full [proposal](admission-diagnostic-proposal.md) and [capability-first amendment](admission-diagnostic-amendment-01.md) retain the requirements and stop rules.\
The [source findings](admission-diagnostic-capability-findings.md), [inventory result](admission-diagnostic-capability-result.md) and [complete inspection record](admission-diagnostic-capability-checks.json) preserve the exact observations and their limits.

| Reference | Identity |
|---|---|
| AGP inventory checkpoint | `0794d9355ccc30e8b26af06c31e700f80b55069c` |
| Static-qualified evaluator candidate, not adopted for live use | `e705b3d749400d0a79efe98e5338e9c84a1695b8` |

These links address the shared local workspace; publication of the AGP checkpoint is not claimed.\
A newer supported interface is a useful answer, but AGP must separately review compatibility before adopting another evaluator revision.

Please return a separate response in the shared workspace, identify its path, and retain this request unchanged.\
AGP will assess that response before selecting any preparation or execution; no automatic resume follows.\
The desired outcome is a supported path with evidence, or a specific owner-side gap, without building a generic evaluator facility inside AGP.
