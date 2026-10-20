# Admission lifetime revision 2 independent review

**Gate verdict: FAIL - one remaining design blocker.**\
Reviewer: `/root/admission_design_review`, the same explicitly authorized independent, non-author reviewer.\
Review date: 2026-10-11.\
The two original omissions are specified; the revised supervisor table introduces a conflicting retry-reset phase.

This is a renewed technical design review, not runtime verification, public-surface adoption or M2 fresh-reader assurance.\
Pending adoption of proposed defaults and public semantics did not cause the FAIL.

---

## Inputs and integrity

| Input | Measured checkpoint |
|---|---|
| Reviewed revision | [Revision 2](admission-lifetime-correction-r2.md), SHA-256 `b89a3328ae7cd41feb38a498b75b16fe06d47f232d9c09dffe42542438f005fb` |
| Original draft | [Original correction](admission-lifetime-correction.md), SHA-256 `01bae9c2446bf6ff6d8e0027735976f5ff84c4216d31942c2d8fef80ffde0ed0` |
| AGP source | `f16266aaafa66f6301d7afbf09c55e3a1f990274` |
| Delivery guidance | Declared mission-kit `fab44bfdf205b08e3a50932614e727a946c23ef6`, read directly from git when the clean checkout advanced to `fc06e1d98dd2533567c898d960c92961dd8df734` |
| Product applicability | [Ratified AGP map](../design/axioms.md), retaining mission-kit pin `5026604d3ef695651c21b24bd78410c7fec04b58` |

The reviewer checked both draft hashes and AGP HEAD before and after review; all matched.\
The gate remains whether one coherent admission-lifetime contract is implementable without inventing correctness-critical ownership, ordering or resource semantics.\
The reviewer changed no files, ran no tests or reproductions, used no additional agents and sent no outbound correspondence.

---

## R2-1 - Identity ownership prematurely resets retry history

Severity: medium; static design finding, not an observed runtime failure.

**Source observations.**\
Revision 2's [capacity table](admission-lifetime-correction-r2.md#capacity-wait-lifecycle-and-projection), lines 251 and 259, allows satisfaction while the winner is in confirmation and applies the successful-attempt reset on satisfaction.\
The [ratified FSM](../design/fsm.md#65-openconfirm), lines 234 and 250, instead enters `OpenConfirm` on identity victory and resets backoff only on entry to `Established`; its [timer contract](../design/fsm.md#5-timers), line 173, agrees.\
The [core supervisor](../../packages/core/src/fsm.ts), lines 938 and 981, resets `retryAttempt` in `satisfied()` and calculates later retry delay from it.\
The [current node](../../packages/node/src/node.ts), line 1467, also resets its attempt map upon channel adoption; existing code cannot override the ratified phase rule.

**Design inference.**\
Identity ownership may suppress competing dials but is not a successful established session.\
Applying the reset then discards failure history before confirmation succeeds, so a retryable `OpenConfirm` termination would calculate backoff from prematurely reset history.\
An implementer would have to choose between the table and the ratified FSM.

Required correction:

- Winner ownership may clear obsolete waiter/timer authority and satisfy the adjacency projection, while preserving retry history through confirmation.
- Only the exact current winner's entry to `Established`, or adoption of an already-established winner, resets that history.
- Loss before establishment applies the existing reconnect disposition to the preserved history; stale winner notifications are inert.

Acceptance predicate: without an exact current `Established` success, channel acquisition, identity ownership, collision satisfaction and capacity transitions cannot reset failure history.\
Retryable pre-establishment endings retain configured backoff progression; exact successful establishment performs the reset.\
No new retry subsystem or public API is needed.

---

## Disposition of the original findings

| Original finding | Renewed assessment |
|---|---|
| Runtime terminal authority | Closed at design level: pure preparation, full preflight, final authority checks and tagged outcomes precede effects; the node closes the gate before detaching owners and capturing actual retained work |
| Capacity wait lifecycle | Original omission closed by the supervisor table, explicit reasons, genuine retry times and pool/waiter lifetime; R2-1 remains a new phase conflict within that table |

The runtime integration must inventory every operations publication; an unrelated publication cannot keep the old store-only terminalization path.\
This is an internal prerequisite, not an invitation to build a general transaction framework.\
Neither disposition says current code implements the proposed repair.

Retain exact continuation authority, finite work ownership through actual disposal, FIFO through drain, pure route preparation with current-at-commit capacity, immutable truthful terminal capture and one retry owner.\
Provider cancellation remains cooperative; no browser-native release, arbitrary descendant-work bound or non-progressing-event-loop guarantee follows.

---

## Evidence and scoped axiom alignment

AGP source/contracts, Zorg's attributed consumer reports, the DOM abort model, ECMAScript promise reactions and Node timer documentation remain five input families, not five independent reviewers.\
The author draft and earlier verdict are challenge inputs, not independent corroboration.

| Applicable product axiom | Assessment |
|---|---|
| A3 | Ownership boundaries align except for the satisfaction/reset composition |
| A4 | Capacity reasons and retained terminal counts improve truthfulness; distinguish identity ownership from establishment |
| A8 | Technical gate remains unsealed until R2-1 is corrected; public adoption and implementation evidence are separate |
| A9, AGP subset | Acceptance obligations only; no runtime, browser or deployment certification |
| A14, AGP subset | Shared identity/route cause is addressed in design; runtime closure still needs scoped verification |

No additional product axioms are activated.

---

## Next move

Correct the reset phase in a new frozen revision, then obtain its renewed verdict.\
Preserve both earlier drafts and FAIL records.\
`B53` remains open until implementation and verification satisfy its existing obligations; Zorg retains its bounded admission wrapper.
