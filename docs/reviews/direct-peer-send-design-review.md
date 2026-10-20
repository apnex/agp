# Direct peer send design review and D62 reconciliation

Status: independent technical PASS and scoped M7 PASS for the proposed `B51` design, with implementation guardrails.\
Not ratified, implemented, runtime-verified or M2 documentation-assured.\
Tier 3: author reconciliation and assessment; the independent review is preserved separately and supplies the verdicts.

Zorg's D62 settles the lifecycle obligations raised in AGP's response.\
It requires no further consumer policy choice for this direct-peer design review.\
AGP now owes adoption work and a coordinated implementation plan; the exact lifecycle producer API remains separate joint `B6` work.

---

## 1. Authority and frozen inputs

The director selected D62 incorporation and design/axiom review, then explicitly authorized one independent read-only reviewer.\
This step authorizes neither ratification nor implementation, commit, push or new outbound correspondence.

| Input | Measured identity or scope |
|---|---|
| [Reviewed draft](evidence/direct-peer-send-design-review-input.txt) | SHA256 `bede054da088b516f55e09aa02e111a9dfdb61b57ead5b493cc90f4f2110119a`; 34,955 bytes |
| [Independent review](direct-peer-send-independent-review.txt) | Reviewer `/root/direct_peer_send_design_review`; technical PASS and scoped M7 PASS; no required design correction or accepted deviation |
| [Pre-D62 draft](evidence/direct-peer-send-before-d62.txt) | SHA256 `2a91d6c8d8263bc39a94880d93d95506fa7ab0e5d359f4f150d84153a0b6b251`; earlier checks remain point-in-time records |
| AGP source | `0aa6be75ccacf4e2c3770a49c5ea39970a25a98a` |
| [Zorg D62 reply](../../../zorg/upstream/agp-direct-peer-send-lifecycle-reply.md) | Zorg `56350495934b90c63a17950bafaac71e16d7568e`; D62 amends D61's snapshot dependency |
| Owning components | Caller-identity `df4778e1cd5a0c2e9628492355f2475d2709ef51`; credential-issuer `ea5e34fd08d0b4764d3af09614f1a2a3593b20e7`; operation-call `3bfff2c7f9a6dee26fb9e3897b7c41a5437ea931` |
| Product axiom authority | [Ratified applicability map](../design/axioms.md), pinned to mission-kit `5026604d3ef695651c21b24bd78410c7fec04b58`; A3, A4, A8, A9 and A14 only |
| Delivery-process guidance | Initially verified mission-kit `b09fc28d8e710d9a8939f57557d0bda46cf89919`; canonical main advanced to `abedf32ee4be5bc46dd4f24d0c625cfbd525d61c` during review, with relevant guidance unchanged |

The [working draft](../design/direct-peer-send.md) records the completed review and next adoption gates.\
Its contract text is preserved in the reviewed checkpoint; later status/gate edits do not retroactively change the input the reviewer judged.\
Unrelated dirty mission-kit component documents were excluded, and the product axiom pin was not advanced.

---

## 2. Consumer commitments and source facts

### Consumer commitments, not implemented behavior

The [D62 decision](../../../zorg/docs/DECISIONS.md#d62---lease-reclamation-in-credential-issuer-requires-four-conjunctive-lifecycle-conditions-and-composes-with-the-joint-admission-lifecycle-contract-b6-b53) and [credential-issuer contract](../../../credential-issuer/CONTRACT.md) agree:

- The issuer owns finite lease capacity, outstanding usable keys, renewal and serialized reclamation.
- Release requires all four conditions: no usable key, no pending work able to publish, no live admitted controller, and elapsed reconnect grace.
- Unknown lifecycle information retains the lease; older completions cannot revive a released binding or release a replacement reservation.
- Binding/AGP must provide per-redemption handoff or terminal pre-admission outcome, and exact admitted-controller liveness/termination.
- The snapshot-versus-lifecycle-query choice remains joint `B6` design, coordinated with `B53`; it does not reopen the agreed `B51` public shapes.

The draft now records these as agreed obligations rather than unanswered owner questions.\
No new snapshot, callback or public lifecycle handle is selected by implication.

### Measured source facts

| Source | Fact relevant to this review |
|---|---|
| [Data-plane resolver](../../packages/node/src/data-plane.ts) and [destination-selection contract](../design/destination-selection.md) | Ordinary pins may traverse another peer; the proposed direct restriction cannot be inferred from today's pin |
| [Core routing](../../packages/core/src/routing.ts), [public candidate types](../../packages/core/src/types.ts) and [node lookup](../../packages/node/src/node.ts) | Internal controller ownership exists, but the present candidate projection and node lookup use public session pairs rather than the proposed exact-owner constrained query |
| [Send guard](../../packages/node/src/send-admission.ts) and [session writer](../../packages/node/src/session-writer.ts) | The shared serialized path has a cancellation commit boundary and synchronous bounded writer admission |
| [Admission controller](../../packages/node/src/session-controller.ts) | Callback `allow` precedes identity retention and the FSM's `CommitIdentity` action; callback completion is not the actual commit fact |
| [Handler ledger](../../packages/node/src/handler-ledger.ts) and data plane | Handler accounting charges a supplied byte count; current local-delivery resolution supplies payload bytes, not the proposed association metadata |
| [Operation-call host](../../../operation-call/src/host.ts) | Ordinary and fallback replies share one send closure; the owning contract's restricted-send adoption is not yet implemented |

These are static observations, not runtime reproductions.\
The full independent review identifies source locations and four independent constraint families: AGP, the consumer, IETF bearer-token semantics and ECMAScript value semantics.\
AGP history and its current source are one family, not multiple confirmations.

---

## 3. Assessment and implementation guardrails

Author assessment: the explicit `sendDirectPeer` entry point is appropriate because it requests a stricter delivery constraint while preserving one shared admission mechanism.\
The independent reviewer reached the two PASS verdicts separately; this assessment does not supply or broaden them.

| Guardrail | Required implementation treatment |
|---|---|
| Exact route ownership | Carry or establish controller incarnation through a declared core/node contract; filter before canonical selection, without operations-snapshot authority or pair-only lookup |
| Guarded association installation | Validate and copy first; install only at the successful exact guarded commit, coordinated with `B53`, never on callback `allow` alone |
| Runtime value fidelity | Enforce scalar bounds and closed plain-data shapes; copy nested values before asynchronous work; shallow freezing or TypeScript `readonly` alone is insufficient |
| One send mechanism | Reuse source ownership, size/export precedence, cancellation, labels, dispositions and the exact writer; derive the pin and one-hop budget without post-admission replay or migration |
| Finite retention | Account for added metadata in the relevant budgets; context copies must not retain closed controllers or carrier objects |
| Consumer acceptance | Preserve the captured target and explicit protection floor on every reply branch; absence or unsupported methods refuse use without ordinary-send fallback |

The independent M7 mapping makes A3, A4 and A8 load-bearing, with A9 and A14 supporting only within AGP's ratified subsets.\
It preserves the issuer/transport/core/node/consumer/deployment ownership split and supplies the validation closeout hooks.\
No excluded product axiom, full deployment conformance or physical-process exclusivity claim is imported.

---

## 4. What remains and the next move

| Work | Remaining obligation |
|---|---|
| `B51` adoption | Prepare the AGP decision and implementation-selection record with the reviewed guardrails; complete required fresh-reader documentation assurance before ratification |
| `B51` implementation | Public types, owned schemas, validation, exact-owner routing query, shared send enforcement, metadata accounting and all consumer branches remain unbuilt |
| `B53` integration | Preserve the guarded-commit correction and its existing gates; the new association cannot depend on an unverified stale-continuation path |
| `B6` lifecycle API | Select the declared pending-use handoff and exact-controller lifetime contract; prove continuous reservation accounting before production issuer reclamation acceptance |
| `B50` and `B54` | Browser carrier acceptance and the operating envelope remain separate; this review makes no browser-confidentiality or hundreds-of-peers capacity claim |

Recommended next action: prepare the bounded `B51` adoption packet and shared implementation sequence, carrying these guardrails and the remaining assurance gate.\
Do not start another Zorg requirements round for the settled shapes, wait for the `B6` API before recording this review, or start implementation on the strength of the review alone.

The [check record](direct-peer-send-design-checks.json) records documentation checks, record-integrity checks, exact source/artifact identities and preservation of unrelated work.\
These author checks do not constitute runtime acceptance or M2 fresh-reader assurance.\
The board retains `B51` open at its existing score and build-order position; no earlier verification section or frozen review was amended.

---

## 5. Mechanics rationale and consequence

### Mechanics

Preserve the submitted design, record the independent verdict separately, and carry its concrete guardrails into the adoption and implementation gates.

### Rationale

D62 resolves ownership questions while leaving producer API selection and verification with their actual owners.\
That permits progress on direct-send design without inventing lifecycle capabilities that AGP does not yet expose.

### Consequence

Treating a review PASS as runtime proof would skip the exact ownership and accounting work it requires.\
Treating the separate lifecycle API as an unanswered direct-send requirement would reopen settled consumer choices and obscure AGP's next action.
