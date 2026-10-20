# Admission acquisition independent review assessment

Status: technical FAIL and scoped M7 FAIL for the reviewed proposal; revise before implementation.\
One blocking timing defect and one nonblocking accounting clarification are accepted.\
This is the author's assessment; the [unaltered independent report](admission-acquisition-independent-review.txt) owns the verdicts.

The issuer's credential-expiry check and AGP's later redemption timestamp are not the same event.\
The next revision must define one authoritative redemption instant for both key validity and the inherited establishment deadline, while leaving credential policy with the issuer.\
No implementation or Zorg handoff is selected by this review.

---

## 1. Authority and reviewed input

The director selected one independent read-only reviewer by replying "continue" to that recommendation.\
The reviewer examined documentation and source without editing the candidate or executing AGP.\
This turn records the findings and tracking consequences; it does not ratify a design, select an authentication profile or authorize implementation.

| Input | Measured identity or boundary |
|---|---|
| [Reviewed checkpoint](evidence/admission-acquisition-review-input.txt) | SHA256 `2a2d73991919584990df6ac57a9d3f4eb78d8f4b5c7c8fc162d4c88db61b6900`; 652 lines |
| [Independent report](admission-acquisition-independent-review.txt) | Reviewer `/root/admission_acquisition_independent_review`; technical FAIL and scoped M7 FAIL |
| AGP source checkpoint | `a09e4bcda9d668b52ff3212c3813fad30fa7ac10`; per-file identities account for the dirty worktree |
| [Zorg lifecycle requirement](../../../zorg/upstream/agp-direct-peer-send-lifecycle-reply.md) | Zorg `56350495934b90c63a17950bafaac71e16d7568e`; issuer-owned reclamation and two exact binding/AGP lifetime facts |
| Product axiom authority | [AGP applicability map](../design/axioms.md), pinned to mission-kit `5026604d3ef695651c21b24bd78410c7fec04b58`; A3, A4, A8, A9 and A14 at its stated boundaries |
| Delivery guidance | Canonical main measured as `b145b359b40d234d8d42b06a85d903ec5f0ec699`; the local mission-kit checkout was clean at that revision |

The [working proposal](../design/admission-use-lifecycle.md) remains byte-identical to the reviewed checkpoint.\
Its submission-time status and earlier author-check records remain historical; this assessment records the subsequent FAIL without rewriting that input.\
The independent report is preserved as text, including its original formatting and citations.

This is one independent static challenge, not completed wider M1 assurance, fresh-reader documentation assurance or runtime acceptance.\
The full report separates source observations from design inference and retains concerns that the explicit contract already answers.

---

## 2. Findings and author disposition

### Blocking expiry and redemption timing gap

The [proposed redemption sequence](../design/admission-use-lifecycle.md#44-redemption-and-admission-commits) checks issuer proof, expiry and allocation generation before calling `recordAdmissionRedemption()`.\
That later method samples the shared clock and designates its sample as the redemption instant.\
Its declared interface carries only a redemption identifier into AGP and a reference plus observation back; neither credential expiry nor the sampled instant crosses the seam.

Author assessment: accept the finding.\
Serialization prevents competing state changes, but a monotonic clock can advance during synchronous work.\
A key valid at the issuer's check can therefore be expired at the later event this draft calls redemption.\
Calling the earlier check the redemption event instead would leave the establishment deadline anchored to the wrong event.

This conflicts with the [original establishment requirement](../../../zorg/upstream/agp-review-response-reply.md#2-the-whole-establishment-interval) and [issuer contract](../../../credential-issuer/CONTRACT.md): expiry is checked at redemption, and one absolute deadline starts from that same event.\
This is a defect in the proposed contract, not a reproduced vulnerability in current AGP.

The required repair must:

- Define the one redemption instant used for both validity and the establishment bound.
- Declare the time/authority handoff that allows each owner to apply its obligation without unchecked cross-clock values.
- Keep credential validity and generation policy in the issuer, with no issuer callback inside the node commit.
- Specify normal expiry refusal and disposition of any prepared or recorded lifecycle state before publication.
- Preserve complete issuer registration, irreversible spent-use accounting, finite retention and no revival after terminal invalidation.

The method names and corrected commit protocol remain design work.\
This review does not select a shortcut that moves credential policy into AGP or weakens the agreed expiry guarantee.

### Nonblocking stop accounting clarification

The [integration wording](../design/admission-use-lifecycle.md#7-integration-with-admission-repair-and-public-packages) broadly associates node stop/failure with freezing terminal operations state.\
The [B53 accounting contract](admission-lifetime-correction-r4.md#terminal-accounting-recommendation) instead distinguishes ordinary stopped instances, whose cleanup gauges can still change, from numerical operational-domain exhaustion, whose final values and capture time freeze.

Author assessment: accept this as a clarification, not a second established blocker.\
B53's specific rule supplies a compatible reading, and the proposal later refers specifically to terminal replacement.\
The amendment should state that distinction directly; it must not silently amend B53 or equate logical terminal state with physical cleanup.

---

## 3. Retained design and axiom boundaries

The review did not establish additional defects in the continuous per-use observation, exact incarnation identity, custody table, unfinished-work charging, termination authority or separation of local verifier role from connection direction.\
Those conclusions are static and scoped to the declared contract; they remain implementation obligations, not measured runtime guarantees.

The scoped M7 failure is load-bearing at A3 and A4: the issuer/node interface does not yet carry the temporal fact needed to support its guarantee.\
A8 prevents promotion on author checks or earlier B53/B51 verdicts.\
A9 remains limited to AGP's partial sandbox-evidence boundary, and A14 to its finding-lifecycle subset; no excluded product axiom or full conformance claim is imported.

Retain these boundaries through repair:

- One mechanism across CLI and browser profiles, with one session/FSM owner.
- Application identity, credential policy, usable-key tracking and lease reclamation remain consumer-owned.
- The lifecycle handle denotes one exact attempt/controller; management snapshots and reusable session strings do not supply its authority.
- Logical terminal invalidation does not refund unfinished work or prove native resource release.
- Routine key expiry or rotation does not terminate an already-established session.
- Browser carriage, client fresh-key/refusal-rearm, deployment envelope and production acceptance remain separate work.

The original B53 and B51 review and assurance records retain their scopes and verdicts.

---

## 4. Next action and Zorg handoff

Recommendation: amend this producer design to resolve the redemption instant and clarify stop accounting, then obtain an independent review against the new hash.\
The present FAIL and input remain frozen, with the amendment explicitly linked to both findings.

Once the timing contract is coherent, ask Zorg to review its issuer transaction fit, exact lifecycle registration, conservative observed-close grace rule, identifier bounds and finite configuration.\
That is a fit review of the producer's proposal, not a request to repeat settled requirements or implement provisional methods.\
No new note has been placed in Zorg by this step.

`B6` remains open at its existing score and build-order position.\
The [board](../BOARD.md) now identifies the repair before Zorg fit review; the findings are owned under that existing work rather than filed as new implemented-runtime defects.\
Documentation assurance, joint agreement, ratification, implementation selection and producer/consumer verification still follow; this review closes none of those gates.

---

## 5. Validation and preservation

The [author check record](admission-acquisition-review-checks.json) retains the exact input and report identities, baseline and final documentation-only results, source-manifest checks and preservation comparisons.\
It is not the independent verdict.

The existing tracked-link failure is retained separately from supplementary checks on the new assessment and tracking files.\
The reviewer report remains verbatim; its transcript formatting is not rewritten to satisfy Markdown style checks.

Only the review records and current tracking are changed.\
No runtime source, schema, transport, issuer/consumer contract, earlier review or original proposal is amended.\
There was one independent reviewer and no AGP runtime execution, authentication probe, assurance experiment, outbound correspondence, commit or push.

---

## 6. Mechanics rationale and consequence

### Mechanics

Keep the exact candidate and independent verdict, verify the findings against the original requirements, and record bounded repair criteria on the existing work item.

### Rationale

Sharing a clock and serializing state do not make two time observations identical.\
The issuer and AGP need an exact common redemption event before their separate guarantees can compose.

### Consequence

Ignoring the gap would require an implementer to invent validity semantics or extend the claimed establishment window.\
Rewriting the failed input or broadening this review into implementation approval would hide the unresolved obligation.
