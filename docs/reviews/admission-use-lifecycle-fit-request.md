# AGP admission lifecycle issuer fit review request

Status: draft for Zorg's incoming review, placed with AGP director approval; not a request to implement.\
From: AGP, for Zorg's credential-issuer, caller-identity and hub-composition owners.

Please assess whether the proposed admission lifecycle fits your issuer transaction and lease reclamation.\
It addresses the two facts requested in [D62](../../../zorg/upstream/agp-direct-peer-send-lifecycle-reply.md): exact redeemed-use handoff or termination, and exact admitted-controller liveness or close.\
We are asking about this concrete producer proposal, not reopening those agreed requirements.

---

## Review target and status

| Material | Scope |
|---|---|
| [Frozen reviewed input](evidence/admission-redemption-review-input.txt) | SHA256 `49a57e583eb0fbd6d46933273d376936e8cafc6ae95ec4944750ec2878b82097` |
| [Navigable producer proposal](../design/admission-use-lifecycle.md) | Byte-identical to the frozen input at handoff; section links below refer here |
| [Independent re-review](admission-redemption-independent-review.txt) | Technical PASS and scoped M7 axiom-alignment PASS for the written contract only |
| [Current review record](../VERIFICATION.md#465-admission-redemption-independent-re-review) | Records the resolved timing and stop-accounting findings and remaining gates |

The draft retains its submission-time review-pending banner; the subsequent verdict is recorded separately above.\
The [original failed review](admission-acquisition-independent-review.txt) remains attached to its earlier input.\
Neither verdict establishes implemented behavior, Zorg acceptance or completed wider design/documentation assurance.

These are shared-workspace references to an uncommitted proposal, not a published AGP package revision.\
The frozen input identifies the review target if the working draft later changes; the producer specification remains in AGP rather than being duplicated in your contracts.

---

## Fit questions

### 1. Redemption time and deadline ownership

Can your issuer derive `validBeforeMonotonicMs` from the exact shared `ClockPort` and current issuing generation, with its remaining time-dependent policy expressible as that exclusive upper bound?\
Can several listeners share that clock and serialized redeemer without translating wall-clock or cross-generation timestamps?

[Section 4.4](../design/admission-use-lifecycle.md#44-redemption-and-admission-commits) delegates the final time check to AGP's recording sample, which also anchors the opening allowance.\
This makes AGP own the recorded deadline from redemption through establishment, refining your earlier [binding-owned deadline wording](../../../zorg/upstream/agp-review-response-reply.md#2-the-whole-establishment-interval).\
Please explicitly assess that ownership change; AGP still receives an issuer-authorized limit, not authority to choose credential policy.

### 2. Prepared registration and failure

Can your issuer hold serialization from final non-temporal checks through recording and installation of both the spent-use record and the identical lifecycle handle, with no asynchronous gap or external publication?\
Assess the complete [refusal and failure table](../design/admission-use-lifecycle.md#44-redemption-and-admission-commits), including expiry before recording, arming failure and exceptional registration failure after a recorded result.\
Identify any fallible operation or capacity allocation your implementation would still need after recording, and how it prevents handoff while retaining genuinely spent or uncertain state.

### 3. Exact lifecycle and provider lookup

Does the [observation shape](../design/admission-use-lifecycle.md#3-proposed-observation-surface), including terminal admission/establishment history, supply both D62 facts to your sweep-based consumers?\
Can [caller-identity](../../../caller-identity/CONTRACT.md) resolve a trusted issuer record by both `redemptionId` and the identical registered observation, then validate OPEN claims and return the authenticated association under [section 7.2](../design/admission-use-lifecycle.md#72-package-and-provider-contracts)?\
Call out any required fact missing from the declared surface; a public session string or a provider's allow result must not substitute for the exact committed controller.

### 4. Reclamation and conservative grace

Does [section 6](../design/admission-use-lifecycle.md#6-issuer-reclamation-and-exact-termination) fit the issuer's serialized four-condition release decision?\
Please explicitly accept or challenge using the first valid terminal observation as the conservative close-activity time, including attempts that terminate before admission or establishment and sweeps that miss intermediate states.\
Explain how your finite reference table retains every relevant use until its terminal facts and activity are incorporated, without treating key expiry, spent-record compaction or observation failure as permission to forget a live or unknown use.

### 5. Identifier and resource limits

Does the proposed `redemptionId` bound fit your identifier format, and can the hub supply the four required `NodeConfig.admissionUse` fields in [section 5](../design/admission-use-lifecycle.md#5-deadline-and-resource-boundaries)?\
Identify a concrete conflict if those limits cannot represent your deployment, keeping issuer tables, acquisition work, provider work and carrier cleanup as separately owned finite budgets.\
Numeric defaults and hundreds-of-peers capacity are not being selected by this review.

### 6. Hub and binding composition

Can the proposed [acquisition seam](../design/admission-use-lifecycle.md#4-continuous-reservation-and-handoff) and [package boundaries](../design/admission-use-lifecycle.md#72-package-and-provider-contracts) compose with your planned proof-capable binding?\
Identify the owner of proof completion, channel handoff and actual cleanup, and any missing public capability needed to honor the declared custody and finish rules.\
Assess the common local-redeemer contract for the hub; client key presentation and concrete CLI/browser proof carriage remain separate design work.

---

## Response requested and next gate

Please reply through your usual upstream channel, naming the reviewed input hash.\
For each numbered area, state whether it fits, needs a change or cannot yet be assessed, with the consumer reason and relevant producer section.\
For a gap, identify which owner must change and what remains unsafe or unusable without that change; distinguish established requirements from a proposed preference.

A design-level transaction or ownership sketch is enough for this step; no runtime probes, implementation PR or adoption of provisional methods is requested.\
Keep your existing admission deadline and resource protection until a verified AGP revision supports an agreed migration.

AGP will assess the reply, amend and re-review material contract changes, and retain the remaining documentation assurance, joint agreement, ratification and explicit implementation-selection gates.\
Producer verification precedes consumer migration and production lease reclamation.\
Fresh-key-per-dial, explicit-refusal rearm, browser carriage, live reauthorization and deployment-capacity evidence remain separate work.
