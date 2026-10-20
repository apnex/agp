# AGP response to Zorg on admission and reply isolation

Status: draft for Zorg's review; no authentication profile, public API or implementation is approved by this response.\
From: AGP, responding to `zorg/upstream/agp-review-reply.md`.\
Source checkpoint: AGP `f16266aaafa66f6301d7afbf09c55e3a1f990274`; Zorg `42ba5729bcb1f3807feeafb7bcde1eaa2d4642ef`; reply SHA-256 `1db25956ac6354722a65097b79a32444ee80c8428972ed53249ba2dabd97289e`.\
Date: 2026-10-11.

Your four credential-owner answers give the shared design a concrete basis.\
We can retain the transport-first candidate and one CLI/browser lifecycle, with issuance, sign-in and application authorization above AGP.\
Two guarantees still need joint work: private replies must not reach another peer's channel, and every interval after redemption must be included in the server's establishment bound.

---

## Credential owner answers

We carry these forward as Zorg's requirements, not as unresolved questions to ask again:

- Early irreversible use is acceptable; a failed attempt fetches fresh material and never assumes interrupted redemption was rolled back.
- Credential lifetime bounds redemption, not established-session lifetime.
- An observed issuer refusal pauses until proof changes; an unclassified transport failure remains an unknown-cause failure under the existing retry owner.
- The initial issuer/redeemer shares a process and monotonic clock, and all credentials from an earlier process generation are refused.

The proof-purpose restrictions and corrected expiry/reuse, collision, resumption and nineteen-node wording are suitable inputs to the design.\
For PSK, non-consuming secret lookup, completed possession proof and atomic redemption remain distinct events; expiry must hold at redemption, not merely lookup.\
Please express restart refusal through a generation or fresh issuance namespace, not by comparing monotonic timestamps from different process lifetimes.\
Several listeners may share one in-process atomic redeemer; independently held redemption state for one audience is what requires the distributed design.

---

## Reply isolation needs more than a destination pin

AGP's D26 pin guarantees that the wrong endpoint instance does not serve a message.\
It deliberately permits selected-route forwarding when a hop lacks the pinned instance, so downstream hops can resolve alternatives not advertised upstream.\
That means a missing intended peer plus the shared `operation-call/replies` name can place reply bytes on another peer's channel, even when that peer's conforming AGP handler ultimately refuses them.\
Transit-off does not stop a hub-originated reply; its forwarding restriction applies to traffic arriving from another session.

This is a static composition finding against your confidentiality claim, not an observed disclosure or a request to change the ratified multi-hop pin behaviour.\
Route admission of only the peer's own reply name and origin is necessary but insufficient.

Proposed joint invariant: private reply bytes never leave the hub on a channel belonging to an unauthorized peer; if the authorized destination cannot be established atomically, the send is refused before that transfer.\
Compare a scoped exact-peer egress constraint with uniquely entitled reply names before choosing a surface.\
The former requires an atomic runtime check; the latter changes the consumer's naming and entitlement contract.\
A route-table check performed separately before send cannot supply the guarantee, and globally refusing unresolved pins would break D26's multi-hop purpose.

Please clarify one application choice: may a pending reply move to a replacement connection for the same authenticated node/principal, or must it remain tied to the requesting session incarnation?\
That determines the authority the eventual mechanism must retain; it does not call for separate browser and CLI implementations.

AGP source references: `docs/DECISIONS.md`, D26; `packages/node/src/data-plane.ts`, `#resolveForwarding`.

---

## Bound the whole establishment interval

AGP's OPEN timer starts at local OPEN write admission, after channel acquisition.\
With binding redemption, the remaining handshake, channel handoff and OPEN admission can occur after redemption but before that timer starts.

The bound is therefore:

- Last redemption: issue time plus TTL and the agreed clock terms.
- Last establishment: last redemption plus the bounded remaining interval to OPEN plus the OPEN budget, or one absolute deadline covering both remaining phases.

The shared-process clock removes the clock terms, not the interval before OPEN.\
The inbound binding/listener must own that interval; the remote client's acquisition timeout cannot enforce the server's admission guarantee.

We recommend stating the server-owned deadline and its exact transfer rule before choosing numerical limits.\
Please have the credential/binding design name atomic redemption, the remaining pre-OPEN budget, its timeout owner and the handoff to AGP's opening deadline.\
This keeps lifetime as a redemption bound and does not tie established sessions to credential TTL.

Likewise, an authentication slot may end on admission, failure or timeout, but an unresolved socket or provider must transfer to, or remain in, a finite retained-resource budget until actual release.\
Your X2 numbers remain proposals, not agreed guarantees.\
We now carry D49's browser set as Zorg's requirement: current and previous major Chrome, Edge, Firefox and Safari releases with shared workers; browsers without shared workers are unsupported.\
That fixes the requested coverage, not evidence that AGP currently meets it; the joint browser work must test the agreed contracts across that set.

AGP references: `docs/design/fsm.md`, Timers; `docs/reviews/admission-lifecycle-comparison.md`, Time and resource bounds.

---

## Admission correction and next collaboration

AGP's admission-lifetime correction is still design work, not a runtime repair.\
Independent review rejected two missing handoffs: operational terminal failure must revoke runtime authority before ordinary effects, and a capacity-blocked adjacency needs complete wait/resume semantics and a truthful projection.\
The reviewer accepted those handoffs in revision 2 but caught a premature retry-history reset before establishment.\
Revision 3 separates winner ownership from establishment-only reset and has passed independent technical design review; both earlier drafts and FAIL records remain preserved.\
Public-contract agreement and fresh-reader assurance still precede adoption and implementation; the technical PASS does not repair the current runtime.\
Keep caller-identity's bounded wrapper and resource accounting until a verified AGP revision supports an explicit migration.

| Owner | Next deliverable |
|---|---|
| AGP | Agree the proposed public changes, complete fresh-reader assurance, then implement and independently verify the reviewed admission correction |
| AGP and Zorg | Agree the reply-isolation invariant and replacement-session rule, then select its scoped mechanism |
| Credential-issuer and binding owners with AGP | Complete redemption/deadline/association and refusal/rearm contracts against the shared lifecycle |
| Zorg | Supply the corrected operation-call acceptance record, including all five handoff cases and both source revisions |

We now record operation-call as built but not yet certified, rather than waiting for an implementation.\
Zorg's D48 proxy correction is consumer-owned and does not change AGP's boundary.\
The packet-depth question remains separately open and unassessed; this response does not dispose of it.

Agree the contracts and acceptance obligations before assigning implementation or experiments.\
No credential carriage, new permission API, numeric browser guarantee or production change is selected here.

AGP review records, relative to the AGP repository: `docs/reviews/zorg-review-reply-assessment.md`, `docs/reviews/admission-lifetime-correction-r3.md`, and `docs/reviews/admission-lifetime-independent-review-r3.md`; the latter links both earlier FAIL records.\
This draft may be copied unedited from Zorg's ignored `upstream/incoming/` into its received correspondence only through Zorg's acceptance process.
