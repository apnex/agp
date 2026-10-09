# Response to Zorg on AGP consumption

AGP accepts the three concerns, with a substantive correction to the delivery premise.\
The resulting changes distinguish uncertain delivery, enforce the existing admission deadline, and explain application-owned correlation.\
Request/reply matching, retry policy, and processing acknowledgements remain above AGP.

This response addresses Zorg's `upstream/agp-filing-proposal.md`, assessed against AGP baseline `63938e7`.\
The changes are implemented in AGP; verification results are tracked under `MX10` through `MX12` in [`VERIFICATION.md`](VERIFICATION.md#46-open-findings-from-sweeps).

**Handoff status correction (2026-10-09):** the fixes are committed in `6cdf503` and included in AGP main `4ae96f17542a439021aaa92aa45436e3b35ea068`, verified against remote main.\
Zorg has since moved opcall into its own repository and renamed the registry entry `CONTRACT.md`; that contract still says not yet built.\
The earlier copy placed in Zorg is an assessment-time snapshot, not the current commit or ownership status.\
The [follow-up](#handoff-follow-up) names the remaining consumer-owned changes.

**Consumer reconciliation update (2026-10-09):** `B47` is complete; the [closeout](VERIFICATION.md#412-consumer-handoff-reconciled) records the committed Zorg and operation-call (formerly opcall) evidence.\
The handoff follow-up below retains the checklist as it stood before that reconciliation.\
Only `B48`, executable consumer acceptance, remains open; no additional response is requested or sent.

---

## Proposal status

| Zorg request | Disposition | What remains |
|---|---|---|
| A / feedback 1: delivery promise | Amended and implemented as D31; the baseline's universal non-delivery inference was false | Upgrade peers together and handle explicit uncertainty in opcall |
| B / feedback 3: admission timeout | Accepted and implemented as D32; admission can wait behind serialized work | Keep admission and call deadlines distinct |
| C / feedback 4: correlation seam | Accepted; SDK guidance and an executable request/reply regression are in place | Build and verify opcall's own attempt pairing; its contract still says not yet built |
| Feedback 2: readiness helper | Remains deferred, as Zorg requested | Return with a built connect path and its polling evidence; readiness cannot reserve a future admission |
| Streaming claim in F10 | Corrected now; streaming does not inherently require new wire semantics | Validate application sequencing/completion in the consumer |
| Mission-kit C1 capability omissions | Separate registry-owner work, not an AGP runtime request | Update the registry from the current AGP contract; no registry change is claimed here |

AGP's architecture and scope records now match the implementation; package composition is generated and diagnostic matrix coverage is explicit.\
These record changes add no call-layer responsibilities to the kernel.

---

## Delivery certainty

The proposed inference that every failed report proves non-delivery was false at the assessed baseline.\
In both a direct production Loopback connection and a three-node chain, a destination handler ran before channel loss produced `failed / NEXT_HOP_UNAVAILABLE` at the origin.\
Repeating that attempt on the strength of the report could repeat an application effect.

[`D31`](DECISIONS.md#d31---preserve-delivery-certainty) now gives consumers three distinct observations:

| Outcome | Meaning for this attempt |
|---|---|
| `delivered` | The destination admitted the message to its handler; processing success is not established |
| `failed` | The attempt was refused before destination handler admission |
| `unknown` | AGP cannot establish whether destination admission occurred |

Session loss now produces `unknown`; a next hop refusing before forwarding can still produce `failed / NEXT_HOP_UNAVAILABLE`.\
No report, expired tracking, or a consumer's own deadline also cannot prove non-delivery.\
`settled: true` means tracking has its terminal observations, which can include `unknown`; it does not mean the handler finished.

A definite refusal removes delivery ambiguity for this attempt, not for previous attempts of the same operation.\
Zorg must retain operation-level retry and idempotency policy, and must not map an unknown attempt to "not delivered".

The wire change follows AGP's existing in-place v1 replacement policy: upgrade all peers together.\
Older peers cannot decode the new `unknown` disposition field.\
Consumer outcome switches must handle it explicitly.

---

## Admission deadlines

Zorg correctly identified a documented option that was not enforced.\
The claim that admission never waits needed qualification: the event-loop yield and serialized executor can both delay admission.

[`D32`](DECISIONS.md#d32---bound-send-admission) retains and implements `timeoutMs`.\
It bounds admission after validation, rejecting with `TIMEOUT`; an abort before admission rejects with `ABORTED`.\
Both prevent queued work from delivering after rejection.\
Once admission commits, neither revokes delivery, even if the receipt continuation has not run yet.

This is not a deadline for remote delivery, application processing, or a reply.\
Zorg still owns its call deadline and the interpretation of an admitted but unanswered attempt.

---

## Application correlation

The [`SDK contract`](design/sdk.md#53-routed-send) now explains the complete composition.\
The application supplies `correlationId`; AGP carries it through the receipt, handler context, and disposition.\
A reply is a new send with a distinct `messageId`, and the application must explicitly copy the correlation label when it wants to pair that reply.\
AGP does not generate unique attempt identifiers, pair messages, or suppress duplicates.

Zorg's one-label-per-attempt design fits this contract.\
The opcall contract still records "Not yet built", so the filing should describe a proposed consumer rather than claim a completed integration.\
An AGP regression exercises an actual request, copied reply correlation, distinct message identities, and both delivery reports; it is not evidence that Zorg's implementation is complete.

---

## Remaining boundaries

A readiness helper is not required by these fixes.\
Revisit one against an implemented consumer's concrete wait pattern; a readiness observation cannot reserve admission or guarantee a subsequent send.

Multiple replies or streaming are not by themselves proof that AGP needs a new wire concept.\
An application can carry sequence and completion fields in its payload; any proposed kernel change must identify a requirement that cannot be met at that layer.\
The F10 re-entry condition is corrected accordingly, consistent with F12's existing placement of endpoint flow semantics.

Mission-kit registry corrections belong in the registry project.\
No request/reply service, retry engine, fanout, or absent-destination queue has been added to AGP.

---

## Consumer handoff

Before claiming an integrated Zorg implementation, exercise these cases against the updated AGP build:

1. A destination handler runs, then its return channel is lost: preserve
   `unknown`, never infer "not delivered" or retry safety from that loss.
2. An admission expires or is aborted while queued: it rejects and never
   arrives later. A call deadline after admission remains a separate outcome.
3. A reply copies its attempt's correlation label explicitly; a late reply
   from an earlier attempt cannot complete a later attempt. Delivery reports
   must not be mistaken for successful application processing.
4. A readiness observation becomes stale before send: handle the actual
   send refusal rather than treating readiness as a reservation.
5. One attempt ends unknown and a later attempt is definitely refused:
   retain the earlier uncertainty for the invocation. The later refusal
   does not prove that the earlier attempt had no effect or make another
   retry safe without the application's idempotency policy.

Correct the filing's two premises: not every baseline failure proved non-delivery, and the proposed opcall composition is not yet evidence of a built consumer.\
This is an implementation response, not a published release or completed consumer acceptance.

---

## Handoff follow-up

The next work is adoption and consumer acceptance, not another AGP runtime feature.\
`B47` tracks record reconciliation; `B48` separately tracks the implemented consumer's acceptance evidence.

| Owner | Required follow-up | Completion evidence |
|---|---|---|
| Zorg | Update `upstream/agp-capabilities.md`, whose pending-change section still describes the fixes as uncommitted | A named AGP baseline, explicit unknown delivery, enforced admission bounds, and no stale pending-change claim |
| opcall | Qualify `CONTRACT.md`'s `not-delivered-signal`: an outright refusal proves non-delivery of that attempt, not of earlier attempts of the same invocation | Outcome/retry wording that retains earlier uncertainty and leaves repeat safety to the effect owner's idempotency policy |
| Zorg and opcall | Implement the adapter and connect path, then run the five consumer-handoff cases above | Both consumer and AGP revisions, observed results, and coordinated peer versions; AGP-only tests do not close this item |

The current consumer source locations and revisions are recorded in [`VERIFICATION.md` section 4.10](VERIFICATION.md#410-board-reconciliation).\
This follow-up is prepared in AGP; it does not claim those downstream records have been changed or accepted.\
A concrete inability to implement one of these cases returns as an AGP finding.\
Readiness, streaming wire changes, and retry machinery are not authorised by this follow-up.

---

## Verification

The complete `npm test` run passes: build, documentation, test architecture, every package, CLI, and all five system suites.\
The system run includes independent-process WebSocket and production Loopback examples, carrier equivalence, and the direct and transit delivery-uncertainty regressions.\
`npm run schemas:check` and `git diff --check` also pass.

The record-work checks include manifest/output mutation detection and matrix declaration/selection integrity.\
Both 70-cell full sweeps (default and deepened) and the five-cell declared-coverage subset pass; these diagnostic results supplement rather than replace the named gates.

Deadline coverage includes queued expiry and abort, delayed callbacks, cancellation after commit, timer cleanup, the production clock, and long deadlines.\
These results verify AGP's implementation; they do not claim an installed deployment or a completed Zorg integration.
