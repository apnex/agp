# Admission lifetime independent review

**Gate verdict: FAIL - revise before implementation.**\
Reviewer: `/root/admission_design_review`, independently delegated with a fresh context at the director's explicit request.\
Review date: 2026-10-11.\
This record preserves the non-author review's findings and verdict; the reviewed draft remains unchanged.

The shared identity/route lifetime mechanism survives the challenge.\
Two correctness-affecting handoffs remain insufficiently specified: operational-domain terminalization and pre-acquisition capacity waiting.\
Pending director adoption of optional APIs/defaults is separate and is not the reason for this technical failure.

---

## Gate inputs and scope

| Input | Measured checkpoint |
|---|---|
| Reviewed draft | [Admission lifetime correction](admission-lifetime-correction.md), SHA-256 `01bae9c2446bf6ff6d8e0027735976f5ff84c4216d31942c2d8fef80ffde0ed0`, checked before and after review |
| AGP source | `f16266aaafa66f6301d7afbf09c55e3a1f990274`, checked before and after review |
| Delivery guidance | Clean mission-kit cache at `fab44bfdf205b08e3a50932614e727a946c23ef6`; root verified remote main, and the reviewer read the applicable guidance from that cache |
| Product applicability | [Ratified AGP map](../design/axioms.md), retaining mission-kit axiom pin `5026604d3ef695651c21b24bd78410c7fec04b58` |

The gate asks whether the draft is sufficiently explicit to implement one coherent admission-lifetime contract preserving exact authority, FIFO, finite owned resources and truthful operations without inventing correctness-critical handoffs.\
The reviewer read standing context, INDEX, W10, M1, M7, R3, E7 and E8, relevant source/contracts and the pinned product axiom source.\
The reviewer reported no session-controller/core-FSM diff against Zorg's reported `1723c9d10870806f9e84630085110f35c1f8077b` baseline.

Findings below are Tier 3 design judgements grounded in the named source observations, not observed runtime failures.\
No files were changed by the reviewer, and no runtime tests, vulnerability-triggering reproductions, consumer certification or fresh-reader evaluation were performed.\
The author review is an input to challenge, not independent assurance.

---

## High severity terminal authority handoff

Draft locations: completion guard at line 110, host-terminal dominance at line 120 and terminal accounting at line 251 of the frozen draft.

**Source observations.**\
[`OperationsStore.commit`](../../packages/core/src/operations.ts), line 275, detects exhaustion inside the store and substitutes a terminal transaction.\
`#commitMonotonicExhaustion`, line 476, changes store-owned projections and freezes the store; it does not set the node's host state, revoke controller tokens or cancel acquisitions.\
[`NodeImpl.#applyRoutingMutation`](../../packages/node/src/node.ts), line 1609, receives an already-applied routing mutation, publishes operations, then schedules outbound updates without checking whether the publication was replaced by terminal failure.\
[`RoutingTable` route import](../../packages/core/src/routing.ts), line 495, mutates routing before that publication; [controller route completion](../../packages/node/src/session-controller.ts), line 759, subsequently sends the ACK on a successful routing result.\
The [operations contract](../design/operations.md#32-snapshot-metadata-and-revisions), line 198, instead requires preflight without mutation and replacement of the overflowing transaction.

**Design inference.**\
A host-lifecycle guard cannot cover a store that terminalizes independently, nor the transaction that itself discovers exhaustion.\
Freezing gauges and timestamps does not specify how the runtime learns that ordinary effects lost authority.\
The draft prohibits the wrong outcome but leaves the responsible owner, authoritative outcome and irreversible commit boundary unspecified.

Required delta: define one serialized terminal/preflight handoff covering:

- The runtime owner that gates acquisition, admission and continuation authority when exhaustion wins.
- An authoritative ordinary-commit versus terminal-replacement outcome across the core/node boundary.
- Preflight before identity retention, collision effects, route/FSM revision, RIB, ACK or export effects become irrevocable.
- Capture of the actual retained-work ledger after authority revocation without OperationsStore accessing node-private internals.
- Later private reservation disposal without another public mutation.

This can remain an internal contract.\
If runtime-terminal integration is a separate repair prerequisite, name it explicitly; neither a new public API nor an unrestricted operations redesign is required.

Acceptance predicate: an admission-related transaction replaced by terminal failure produces none of its ordinary identity, collision, route-revision, RIB, ACK or export effects.\
No provider invocation begins after the authoritative barrier.\
Already-started work remains truthfully represented in the immutable terminal capture, and later private disposal changes neither that capture nor session authority.

---

## Medium severity capacity wait lifecycle

Draft locations: capacity-wait integration at line 186, pre-acquisition check at line 195, local events at line 201 and operations proposal at line 239 of the frozen draft.

**Source observations.**\
The draft can park an adjacency before a session or admission token exists, but its specified `AdmissionCapacityExceeded` event requires an exact current admission kind/token and terminates a session.\
[`AdjacencySnapshot`](../../packages/core/src/types.ts), line 339, and its [schema](../../packages/core/src/schemas/v1/operations/adjacency-snapshot.schema.json) provide no defined capacity-wait interpretation.\
[`NodeImpl.#adjacencySnapshots`](../../packages/node/src/node.ts), line 1887, reports a controller-free, timer-free adjacency as `dialing`.\
The retry scheduler at line 1522 and [core adjacency supervisor](../../packages/core/src/fsm.ts), line 929, do not supply the new capacity transitions.

**Design inference.**\
Acquisition could be suppressed correctly while operations still claims `dialing`, retains a stale `retryAt`, or fabricates a session-tokened refusal event for a pre-session wait.\
The lifetime of the remembered refusing-pool set also remains unspecified.\
Existing public fields may suffice, but their meaning must be chosen before implementation.

Required delta: add a supervisor transition/projection table covering:

- Initial or retry acquisition blocked before a session exists, separately from capacity refusal during identity/route admission.
- Backoff still running versus elapsed while capacity is unavailable.
- Actual release, subsequent loss of availability and the serialized recheck before acquisition.
- Successful satisfaction, collision-winner suppression/loss, stop and failure.
- Clearing or replacing remembered refusing pools.
- Adjacency `state`, `lastReason`, `retryAt` and retained terminal-controller projection for each transition.

Keep one coalesced waiter and the existing retry owner.\
Do not invent a controller/token to reuse `AdmissionCapacityExceeded` for a pre-acquisition wait.

Acceptance predicate: every blocked adjacency truthfully reports that it is not acquiring, identifies its local restriction and exposes a retry time only for an actual timed retry.\
Capacity wakeups neither increment attempts nor restart backoff.\
Release cannot be missed, obsolete refusal reasons cannot indefinitely constrain unrelated attempts, and stop/failure leaves no waiter capable of restarting acquisition.

---

## Claims that survived challenge

- The barrier stays engaged through draining, preventing new ordinary arrivals from overtaking retained commands and preserving accounting through dispatch or ownership transfer.
- Result authority, session cleanup and provider-work reservation have separate lifetimes; settlement is not treated as application or disposal.
- Route preparation preserves static eligibility, exact tuple completeness and current-at-commit capacity.
- Teardown gives its deadline authority over notification wait and channel cleanup while retaining the sole reader for ordered terminal evidence.
- Exact-token guards cover failures as well as successes; OPEN remains bounded through confirmation.
- Separate finite identity/route pools are coherent; numerical defaults remain unmeasured proposals.
- Frozen terminal counts and capture metadata are defensible once the runtime authority handoff is specified.

---

## Source families and axiom alignment

The reviewer used five input families, not five reviewers:

| Family | Contribution and limitation |
|---|---|
| AGP source, contracts and history | Mechanisms and owed semantics, counted together |
| Zorg consumer records | Reported consumer consequence and retained wrapper; the original ten-minute observation was not reproduced |
| [DOM abort model](https://dom.spec.whatwg.org/#aborting-ongoing-activities) | Cooperative cancellation and observer execution, not an AGP cleanup guarantee |
| [ECMAScript promise reactions](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromisethen) | Settlement does not prove serialized application or disposal |
| [Node timers](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args) | Host callback timing and delay coercion constrain deadline handling |

| Applicable product axiom | Weight | Verdict and guardrail |
|---|---|---|
| A3 | Load-bearing | Shared mechanism and separate policy ports align; specify the core/runtime handoff and preserve one supervisor |
| A4 | Load-bearing | Provenance and retained-work distinctions survive; capture the missing capacity-state and terminal-authority decisions without implying resource release |
| A8 | Load-bearing | Technical gate fails until both deltas are specified; public agreement and implementation verification remain separate |
| A9, AGP subset | Supporting | Later boundary verification must establish the predicates with normal-traffic controls; no deployment/browser certification follows |
| A14, AGP subset | Supporting | Correct the common identity/route cause and retain the finding and Zorg's workaround until verified closure |

Do not activate additional product axioms or expand this correction into credential policy, browser release guarantees, provider isolation, packet-depth handling, offline replay, fair scheduling or unrestricted retry redesign.

---

## Gate conclusion and next move

**FAIL - revise before implementation.**\
Specify the runtime-terminal commit handoff and complete capacity-wait lifecycle/projection, then obtain a new verdict against a newly pinned draft.\
Director adoption of well-specified optional APIs/defaults remains separate.\
`B53` stays open; no runtime repair, stakeholder adoption or browser behaviour is certified by this review.
