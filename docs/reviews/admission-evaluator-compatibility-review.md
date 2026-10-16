# Admission evaluator compatibility recommendation

Tier 3: AGP author analysis, 2026-10-17 Australia/Melbourne; not an independent verdict or adoption decision.

Recommend qualifying the upstream revision immediately before the probe-retry change for AGP's current instruction-only evaluation.\
The [source findings](admission-evaluator-compatibility-findings.md) identify a concrete candidate with public output-cap support and the frozen no-retry probe behavior, without copying or changing the evaluator.\
Its exact revision is `e705b3d749400d0a79efe98e5338e9c84a1695b8`.

## Options and costs

| Option | Benefit | Cost and boundary |
|---|---|---|
| Qualify the immediate parent | Preserves strict probe behavior and public cap support; retains the later conductor changes omitted by the earlier cap-introduction candidate | Requires a fresh exact-revision review and enforcement of the no-on-request delivery restriction; not a general evaluator endorsement |
| Request an upstream solution | Can retain the newest mount restrictions while making probe policy and all attempts explicit for consumers | Requires coordination and an upstream design/change before qualification; no such request has been sent |
| Qualify the earlier cap-introduction revision | Also contains the frozen probe and public cap | Its source differs in more places from the prepared candidate; the immediate parent offers the same relevant behavior with fewer intervening changes to account for |
| Remain on the original frozen evaluator | No evaluator migration | It lacks the required public cap setting; the proposed calibration path remains unqualified |
| Park the comparison | Frees effort for another selected AGP item | B53's document assurance and implementation remain outstanding |

The immediate parent is recommended because its missing mount restriction has no effect on this pack's empty on-request lists, while its strict probe behavior matches the frozen evaluation method.\
That conclusion is bounded to the inspected pack and must become a checked precondition, not a remembered assumption.\
If the replacement calibration needs on-request delivery, this recommendation no longer applies; use the upstream route instead.

---

## Qualification required before live selection

1. Record a prospective exact-pin amendment, retaining the current reviewed packet and both historical results unchanged.
2. Require instruction-only delivery, no on-request folders in any assembled reader or judge arm, the intended single fresh-session phase, and unchanged population, grading and failure rules.
3. Re-run public capture-only checks against the new pin and review the changed conductor, episode and tally behavior relative to the original frozen evaluator; panel source parity alone does not qualify them.
4. Obtain a non-author readiness judgment over that exact amendment, its complete records and its restrictions; do not transfer the previous static PASS by ancestry or source similarity.
5. Only then select a separate finite-budget diagnostic/calibration with exact caps, sanitized request observations, representative reader/file-writing checks and stop conditions.

The twelve author checks establish an inspectable candidate, not completion of these gates.\
The current preparation profile still names the previously reviewed candidate and authorizes no live calls.\
No cap, live evaluator revision, calibration or fresh assurance comparison is selected here.

---

## Upstream concern retained

The newer retry mechanism remains a shared evaluator concern even if AGP qualifies the parent.\
Before moving to that mechanism, require an explicit prospectively fixed retry rule and a durable record of every probe invocation, its outcome, reason for retry and contribution to the aggregate result.\
A policy must state whether an earlier tool use or other failure remains disqualifying; a later clean attempt cannot silently erase it.\
Keep the existing tools-off mount restrictions when pursuing that upstream change.

These are proposed consumer requirements, not a chosen API or authorization to change another project.\
Do not reconstruct evidence from unindexed temporary folders, falsify outcomes through a runtime wrapper, or copy the prober into AGP.\
The review's scope ends at this local recommendation; upstream correspondence and implementation need their own selection.

Rationale: preserve AGP's measurement contract while using an existing public revision whose relevant differences can be bounded.\
Consequence: B53 remains open until exact-revision qualification and the later assurance gates complete; a compatible source candidate is not an AGP runtime repair.
