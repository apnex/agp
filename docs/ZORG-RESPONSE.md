# Response to Zorg on AGP consumption

AGP accepts the three concerns, with a substantive correction to the delivery premise.\
The resulting changes distinguish uncertain delivery, enforce the existing admission deadline, and explain application-owned correlation.\
Request/reply matching, retry policy, and processing acknowledgements remain above AGP.

This response addresses Zorg's `upstream/agp-filing-proposal.md`, assessed against AGP baseline `63938e7`.\
The changes are implemented in AGP; verification results are tracked under `MX10` through `MX12` in [`VERIFICATION.md`](VERIFICATION.md#46-open-findings-from-sweeps).

---

## Proposal status

| Zorg request | Disposition | What remains |
|---|---|---|
| A / feedback 1: delivery promise | Amended and implemented as D31; the baseline's universal non-delivery inference was false | Upgrade peers together and handle explicit uncertainty in opcall |
| B / feedback 3: admission timeout | Accepted and implemented as D32; admission can wait behind serialized work | Keep admission and call deadlines distinct |
| C / feedback 4: correlation seam | Accepted; SDK guidance and an executable request/reply regression are in place | Build and verify Zorg's own attempt pairing; its registry still says not yet built |
| Feedback 2: readiness helper | Remains deferred, as Zorg requested | Return with a built connect path and its polling evidence; readiness cannot reserve a future admission |
| Streaming claim in F10 | Corrected now; streaming does not inherently require new wire semantics | Validate application sequencing/completion in the consumer |
| Mission-kit C1 capability omissions | Separate registry-owner work, not an AGP runtime request | Update the registry from the current AGP contract; no registry change is claimed here |

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
Its opcall registry still records "Not yet built", so the filing should describe a proposed consumer rather than claim a completed integration.\
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

Correct the filing's two premises: not every baseline failure proved non-delivery, and the proposed opcall composition is not yet evidence of a built consumer.\
This is an implementation response, not a published release or completed consumer acceptance.

---

## Verification

The complete `npm test` run passes: build, documentation, test architecture, every package, CLI, and all five system suites.\
The system run includes independent-process WebSocket and production Loopback examples, carrier equivalence, and the direct and transit delivery-uncertainty regressions.\
`npm run schemas:check` and `git diff --check` also pass.

Deadline coverage includes queued expiry and abort, delayed callbacks, cancellation after commit, timer cleanup, the production clock, and long deadlines.\
These results verify AGP's implementation; they do not claim an installed deployment or a completed Zorg integration.
