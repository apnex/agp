# Admission diagnostic review boundary and capability-first amendment

Tier 3: prospective author correction, 2026-10-17 Australia/Melbourne.

This amendment addresses D1 and D2 from the [independent design/M7 FAIL](admission-diagnostic-design-review-01.txt).\
Read it with the [frozen proposal](admission-diagnostic-proposal.md), not as a replacement diagnostic.\
The proposal and source findings remain unchanged at `2fe758d44c2edb672f3622bc4ce6140143f3f2b5`; the complete failed review and output are preserved at `165990d828f217885e0e834863865a62c9aa6fb6`.

The changes below supersede the proposal's ambiguous total-spend wording and order its readiness work.\
They do not select spending, authorize implementation or qualify a provider capability.\
The composite needs its own independent exact-artifact design recheck.

## D1 - Explicit review workflow and resource boundary

The proposed **driven diagnostic execution envelope** is 36 runtime invocations, 120 provider requests and USD 20, with every retry, tool turn and outstanding reservation counted as the proposal requires.\
These limits cover stages 1-3's diagnostic execution only, not the ordinary author/reviewer sessions used to prepare and independently assess it.\
Those sessions consume resources outside this envelope; their cost is not established here, not included in USD 20, and not represented as free.\
USD 20 is therefore not an all-in project or session-cost claim.

The proposed semantic-assessment path uses the existing authorized ordinary non-author review workflow, not an additional experimental scoring round.\
The reviewer must not have authored the diagnostic cases, keys, reference answers, driver or outputs, and is not a scored diagnostic participant.\
Name the reviewer and record their authority and bounded assignments in the exact readiness packet before any call; unavailable independent review is a readiness stop.\
This workflow recommendation remains subject to that packet's selection and does not grant new delegation or provider authority.

| Gate | Required ordinary review assignment | Progression rule |
|---|---|---|
| Stage 0b, before execution | One non-author exact-packet review, including all rendered cases, independent keys, reference answers, capture evidence and resource guards | Retain the verdict before seeking separate exact-packet execution approval |
| After stage 1 | One non-author review of the three complete ordinary-delivery records and their request/profile attribution; author supplies deterministic reconciliation | Stage 2 waits for an explicit passing review; missing evidence stops |
| After stage 2 | One non-author semantic review of every original raw calibration reason and score against the full question, key, answer and source: all 42 planned cast slots, with six uncast slots reconciled separately | Stage 3 waits for an explicit passing review; an accepted defective judgment fails, never receives a replacement |
| After stage 3 | One non-author semantic review of all six reader outputs, covering each output's 24 decisions and excerpts, plus file/snapshot/ledger reconciliation and the whole diagnostic result | Only this completed review can supply the bounded diagnostic verdict; it cannot approve AGP adoption |

These are bounded assignments, not permission for recursive review or repeated scoring.\
The reviewer does not delegate or invoke an additional experiment, scorer, provider/model job or diagnostic runtime under the label of ordinary review.\
Read-only inspection and deterministic reconciliation are permitted; raw model judgments remain untouched.\
Any incomplete review leaves the gate unresolved and stops progression.

If an additional driven/model-based review is wanted, select that different path before the first diagnostic call.\
Its actual invocation/request/retry/spend requirements must be counted in recomputed ceilings and reservations, or have explicit separate prospective authority and accounting; no uncounted call is exempt because its purpose is review.\
Freeze and independently review the revised packet before execution, retaining the superseded plan.\
This amendment selects no such additional review path.

The proposed 90-minute local execution deadline is elapsed time from the first diagnostic invocation, including inter-stage review delays.\
Do not pause or reset it while waiting for a reviewer.\
At expiry the existing stop rule applies, outstanding remote reservations remain charged, and no later stage starts; ordinary record review may finish afterward but cannot turn a resource-limited run into qualification.

---

## D2 - Capability inventory precedes packet construction

Split the original stage 0 into ordered gates.\
Both use ordinary author/reviewer work and read-only or inert checks, with no driven diagnostic/model/provider calls.

1. **Stage 0a: read-only capability inventory.** Establish whether existing supported mechanisms and already accepted evidence cover request admission and worst-case spend reservation, hidden request/retry attribution, supported sanitized observation, complete record retention across local deadlines/exceptions, exact-runtime containment/delivery, and the ordinary review workflow above.
2. **Stage 0b: exact-packet preparation and readiness.** Only after stage 0a has a supported path and preparation is selected, construct the two representative documents, keys, profile/guard delta and public-seam composition; then perform the original capture-only checks and independent readiness review.

For stage 0a, record each prerequisite's owner, exact supported interface/configuration, evidence identity, covered scope and remaining unknowns.\
The inventory establishes whether a feasible supported path exists; it does not itself prove enforcement, delivery or containment.\
In particular, a return-time output writer is not proof of complete event retention if its supervisor can kill it before persistence.\
Identify the actual supported persistence/supervision boundary or record the gap.

Do not author the long fixtures or driver while stage 0a is unresolved.\
An unavailable or unknown prerequisite ends this attempt with a terminal zero-call gap record: missing capability/evidence, responsible owner, work not attempted, and the specific evidence or separately selected owner-side work that would revive it.\
The result is not a diagnostic FAIL, successful readiness or permission to build a general evaluator.

Missing generic budget, trace or runtime facilities remain context-lab/provider responsibilities.\
Preparing a precise request for later approval is allowed; sending it, changing shared configuration or implementing those facilities in AGP is not.\
A changed evaluator revision still requires scoped compatibility review.\
No paid prerequisite probe, security-fault input or live capability test is hidden in stage 0a or stage 0b.

---

## Recheck and unchanged boundaries

The independent recheck must assess D1/D2 against both frozen documents and this amendment; the original FAIL remains visible.\
Carry the failed review's G1-G8 guardrails into any later readiness packet and completed review, including complete attempt retention, the real public classifier, the stop latch and no replacement of unfavorable judgments.

No model identities, scoring policy, literal cases, stage 1-3 counts, proposed caps or acceptance conditions change here.\
No prior assurance result is regraded, and no live cap or monetary allowance is selected.\
The next recommended action is only stage 0a's read-only feasibility check.\
B53 admission repair and B56 runtime acceptance remain open; no AGP runtime change, publication, push or Zorg message follows.
