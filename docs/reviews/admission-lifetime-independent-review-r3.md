# Admission lifetime revision 3 independent review

**Gate verdict: PASS - technical design gate only.**\
Reviewer: `/root/admission_design_review`, the same explicitly authorized independent, non-author reviewer.\
Review date: 2026-10-11.\
No remaining material design blocker was found within the stated gate.

Revision 3 closes the retry-reset conflict without reopening the terminal-authority or capacity-wait findings.\
This is not implementation verification, public-surface adoption, M2 fresh-reader assurance or closure of `B53`.

---

## Gate and frozen inputs

The gate asks whether one coherent identity/route admission-lifetime contract can be implemented without inventing correctness-critical ownership, ordering or resource semantics.\
The reviewer re-read the complete revision, not only the correction diff.

| Input | Measured checkpoint |
|---|---|
| Reviewed [revision 3](admission-lifetime-correction-r3.md) | SHA-256 `6ccf9ba0e7d94b83897fade8f865fe3fb1328db292d92cce4d5cc85bc28fc2f2` |
| Preserved [revision 2](admission-lifetime-correction-r2.md) | SHA-256 `b89a3328ae7cd41feb38a498b75b16fe06d47f232d9c09dffe42542438f005fb` |
| Preserved [original draft](admission-lifetime-correction.md) | SHA-256 `01bae9c2446bf6ff6d8e0027735976f5ff84c4216d31942c2d8fef80ffde0ed0` |
| AGP source | `f16266aaafa66f6301d7afbf09c55e3a1f990274` |
| Review guidance | Current mission-kit main and clean cache measured `8e469b3d64068c4f29a742ee3d0f00342521a58d`; re-read INDEX/W10/M1/M7/R3/E7/E8 have no diff from the draft's historical `fab44bfdf205b08e3a50932614e727a946c23ef6` checkpoint |
| Product applicability | [Ratified AGP map](../design/axioms.md), still pinned to mission-kit `5026604d3ef695651c21b24bd78410c7fec04b58` |

Before/after checks matched all three draft hashes and AGP HEAD.\
The [original FAIL](admission-lifetime-independent-review.md) and [revision 2 FAIL](admission-lifetime-independent-review-r2.md) remain valid historical verdicts; the frozen drafts' pending-review statements describe their submission checkpoints.

---

## Retry reset finding closed at design level

The [supervisor contract](admission-lifetime-correction-r3.md#capacity-wait-lifecycle-and-projection) now separates three events:

| Event | Required meaning |
|---|---|
| Winner ownership in `OpenConfirm` | Suppress competing dials and clear obsolete scheduling authority; preserve accumulated retry history |
| Exact current establishment success | Reset history once, including adoption of an already-established winner; stale or duplicate success cannot reset newer history |
| Winner loss | Apply the existing reconnect disposition using preserved pre-establishment history or the history reset by genuine success |

This matches the [ratified timer rule](../design/fsm.md#5-timers) and [establishment transition](../design/fsm.md#65-openconfirm).\
The revision explicitly separates the current [core supervisor's resetting satisfaction operation](../../packages/core/src/fsm.ts) and removes the [node's channel-adoption reset](../../packages/node/src/node.ts) when consolidating the path.\
Clearing a retry timer no longer implies clearing failure history.\
The implementer need not choose the reset phase; the acceptance predicate preserves that choice through verification.

---

## Whole contract challenge

| Failure hypothesis | Design-level disposition |
|---|---|
| Exhaustion rejects publication after ordinary runtime effects | Pure preparation, full preflight, final authority checks and tagged outcomes precede installation and effect dispatch |
| Store terminalization leaves runtime authority alive | One node-owned terminal sequence covers all publications and queued stop/failure continuations |
| Capacity wait invents a session event, hidden dial or retry time | One supervisor owns explicit initial/repeat transitions, level rechecks, real timer metadata and truthful projection |
| Settlement or cancellation grants effects or refunds retained work | Authority, cleanup and work reservation have separate lifetimes; disposal is the release boundary |
| Arrivals overtake queued commands or transfer to an unbounded queue | The barrier remains through bounded ordered drain and atomic empty observation |
| Route preparation uses stale capacity or changes revision early | Static eligibility, exact result validation and final serialized capacity checks precede the complete committed transaction |

The original two omissions remain closed at design level; no new design delta is required by this review.\
Every runtime operations publication must enter the shared preflight/terminal contract; an unrelated publication cannot retain store-only terminalization.\
This is integration of existing owners, not a generic transaction framework or additional public operations domain.

---

## Acceptance guardrails

These are later verification obligations, not observations made by this review:

- Exact current authority is required for invocation and every continuation outcome; expiry or replacement permits no identity, collision, route, revision or ACK effect.
- Terminal replacement causes none of the rejected transaction's ordinary effects and revokes the shared runtime gate before any later continuation.
- Finite pools retain outstanding evaluations and results until actual disposal; cancellation or snapshot removal cannot refund unfinished work.
- FIFO holds through admission and drain, without hidden unbounded queues or early protocol effects.
- Owned cleanup does not depend on provider settlement, subject to a conforming transport and progressing host event loop.
- Capacity notifications neither create attempts nor reset history nor authorize reservations; exact current establishment alone resets retry history.
- Numeric-terminal queries preserve one immutable capture, its timestamp and actual retained resources; later private disposal cannot publish or restore authority.
- Proposed options, defaults, reason meanings, gauges and events need coordinated contract/schema/type treatment before implementation relies on them.

Providers that never settle can exhaust finite capacity.\
Fairness, arbitrary provider-memory containment, CPU preemption and browser-native release are not promised; these remain explicit scope boundaries.

---

## Evidence and scoped axiom alignment

AGP source/contracts/history are one evidence family.\
[Zorg's report](../../../zorg/upstream/agp-build-questions.md#what-was-observed) supplies attributed consumer observations, not reproduced behaviour.\
Independent primary constraints were rechecked in the [DOM abort model](https://dom.spec.whatwg.org/#aborting-ongoing-activities), [ECMAScript promise reactions](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromisethen) and [Node timer documentation](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args).\
These are five input families, not five reviewers; prior verdicts are not evidence of correctness.

| Applicable product axiom | Weight and assessment |
|---|---|
| A3 | Load-bearing: core prepares/checks; controllers own ordered effects; ledgers own work; one supervisor schedules; node owns terminal authority |
| A4 | Load-bearing: authority and retained resources remain distinct; projections and immutable capture have explicit meanings; failed drafts are preserved |
| A8 | Load-bearing: technical design gate passes; adoption, fresh-reader assurance, implementation verification and consumer acceptance remain separate |
| A9, AGP subset | Supporting: later lifecycle/resource predicates are supplied, not runtime/browser/deployment conformance |
| A14, AGP subset | Supporting: both admission paths share the correction; finding closure still needs scoped implementation and verification |

No non-applicable product axioms were activated.

---

## Handoff

No files were changed by the reviewer, runtime tests or reproductions run, additional agents used, or outbound correspondence sent.\
The author may record this PASS but cannot broaden its scope.\
Next: agree the proposed public contract changes and complete fresh-reader assurance before adopting a load-bearing design; then implement and verify the correction.\
`B53` remains open, and Zorg retains its bounded admission wrapper until an explicit verified migration exists.
