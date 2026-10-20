# Shared admission lifecycle comparison

Status: draft for joint AGP and Zorg review; no candidate, public API or wire revision selected.\
Assessment: AGP, 2026-10-11; Tier 3 design proposal, with source observations identified separately.

**Subsequent implementation:** the existing acquisition gap identified here has a [reviewed local commit](../VERIFICATION.md#420-acquisition-repair-review-and-local-commit); no push or independent acceptance is claimed.\
The baseline observations below are retained; neither authentication candidate is selected by that correction.

**Subsequent finding:** [identity-admission timeout and teardown](../VERIFICATION.md#421-identity-admission-timeout-and-teardown-finding) is tracked separately as `B53`.\
Both candidates need that existing session-lifetime obligation corrected; the completed acquisition repair does not settle it.

Prefer proof verification and single-use redemption at the transport boundary, followed by an incarnation-safe association with the AGP session, if the ownership handoff below can be kept explicit and bounded.\
Redemption at identity admission remains a viable alternative with different credential exposure and failure timing.\
Both designs need the same connection-attempt supervision, exact-session control and truthful resource accounting; neither needs AGP to issue credentials or implement IAP policy.

The decision is where redemption happens and what authority crosses into identity admission.\
Browser credential carriage is a subsequent, separate choice.

---

## 1. Inputs and existing obligations

| Authority | Input to this comparison |
|---|---|
| Director intent | [Completed survey](../surveys/shared-transport-survey.md): unified semantics, transport-first proof, certificate-free native PSK, automatic reconnection, bounded cleanup overlap and application-owned offline work |
| Reviewed consumer requirements | [Zorg response](https://github.com/apnex/zorg/blob/56144bf56f326651f3dac89a5945fc28b66c0a9e/upstream/agp-requirements-response.md), especially sections 6 and 7; [AGP review](zorg-requirements-review.md) preserves the qualifications and unresolved policy choices |
| Current normative boundary | [Transport contract](../design/transport-contract.md), sections 6, 10, 11, 12 and 14; [session FSM](../design/fsm.md) |
| Source baseline | AGP `1723c9d10870806f9e84630085110f35c1f8077b`; runtime mechanisms are unchanged from Zorg's `ee99d74` baseline |

The following are source observations, not proposed requirements:

| Existing obligation | Observed mechanism and consequence |
|---|---|
| Acquisition cancellation applies before channel commit, not afterwards | [Contract section 6.2](../design/transport-contract.md#62-outbound-acquisition) already defines the ownership transfer; a design cannot cancel an established session by continuing to abort its acquisition signal |
| The adjacency supervisor owns the connect deadline | [Contract section 11.2](../design/transport-contract.md#112-deadline-ownership) already requires it; [`NodeImpl.#dial`](../../packages/node/src/node.ts) supplies a never-aborted signal without an enclosing deadline |
| Stale acquisition cannot create a session after stop/replacement | [Contract section 14](../design/transport-contract.md#14-mapping-into-the-session-fsm) requires stale completion rejection; `#dial` has no ownership check after awaiting acquisition, and `#stop` cancels retry timers/controllers rather than pending acquisition controllers |
| Identity admission is not establishment | [`reduceOpenSent` and `reduceOpenConfirm`](../../packages/core/src/fsm.ts) commit identity into `OpenConfirm`, then establish on the peer's keepalive |
| A stale result is not permission to perform earlier side effects | The FSM ignores stale admission continuations, while [`#handleOpen`](../../packages/node/src/session-controller.ts) calls identity retention before dispatching that continuation; a new association must validate ownership before its own effects, not rely only on the later FSM filter |

The acquisition findings are existing-contract debt, independent of which authentication design is selected.\
This comparison does not claim a runtime reproduction or modify those mechanisms.

---

## 2. Ownership model

All rows below propose one owner for both native and browser peers.

| Owner | Owns | Does not own |
|---|---|---|
| Application and issuer | Sign-in/code authority, entitlement to obtain a credential, issuer availability and credential format/lifetime | AGP session state or transport scheduling |
| Credential redeemer | Trusted claims, allowed proof mode, atomic single use, restart generation and the consumer's reuse policy | AGP routing, native sockets or an alternative reconnect loop |
| Outbound adjacency supervisor | One current attempt generation, deadline, cancellation, resource eligibility and reconnect scheduling | Credential interpretation or application-operation replay |
| Listener and transport binding | Inbound pending limits, carrier protection/proof, pre-acquisition resources and truthful immutable transport evidence | Parsing AGP OPEN to decide node identity or changing application authorization |
| Session controller and identity policy | OPEN validation, exact session incarnation, claim-to-node binding, collision/identity commit and establishment | Issuing credentials or changing historical transport evidence |
| Caller identity and application policy | Historical admitted principal, bounded evidence access and authorization of each operation or push | Inferring current authorization from a credential's admission expiry |

The binding invokes injected verification/redemption capabilities; it does not absorb the issuer's implementation.\
The host translates a reuse-policy result into a close request; the resource's current owner performs termination.\
Diagnostic sinks remain observations, never a channel for retry or admission decisions.

---

## 3. Common lifecycle and commit points

Credential use, session establishment and physical cleanup are different state dimensions:

| Dimension | States that must not be conflated |
|---|---|
| Credential | Unspent or spent; independently live or expired; expiry cannot make a spent credential reusable |
| AGP attempt/session | Acquiring, awaiting admission, identity committed, established, terminal; a spent credential need never reach establishment |
| Resources | Reserved, owned, closing, released; a terminal AGP session can still retain resources |

Both candidates preserve these events; their placement of redemption relative to channel acquisition differs.

| Commit | Proposed meaning and owner |
|---|---|
| Attempt start | Supervisor allocates a non-reused local generation and budget before calling the credential source; inbound listener allocates equivalent pending ownership |
| Credential redemption | Redeemer atomically validates the required proof/context and records one irreversible use; successful cancellation later never restores eligibility |
| Channel acquisition | Binding transfers one conforming channel and its immutable evidence to the node; any admission attachment transfers with that exact channel or is disposed with it |
| Exact association | A spent credential record refers to one live candidate incarnation, after trusted claims match OPEN; association neither declares establishment nor grants endpoint permissions |
| Identity commit | Current owner, identity policy and collision selection permit the candidate; association is consistent with that owner before identity publication |
| Establishment | Existing protocol confirmation completes; only then may this session carry established AGP work |
| Logical terminal | One cause wins, forwardability ends and late results lose authority; credential consumption and prior delivery uncertainty are preserved |
| Physical release | The owning binding confirms release of its resources; only then does their retained-resource budget become available |

Redemption and local session activation need no invented cross-component transaction.\
If redemption commits but association or activation fails, the credential remains spent and the attempt terminates; a late result can finish accounting, not revive the attempt.\
Association must be idempotent for the same incarnation and refuse reassignment to a different one.

Under Zorg's admission-only policy, expiry or routine issuer/key rotation after admission does not tear down an established session.\
Admission-record retention and the application's historical principal record therefore have different lifetimes.

---

## 4. Candidate descriptions

These are candidate contract shapes, not new public method or schema names.

### Redemption at identity admission

The binding acquires a protected, compatible channel and provides a bounded one-shot admission attachment alongside immutable transport evidence.\
After OPEN supplies the node/session context, identity admission invokes the redeemer and associates a successful use with that exact candidate before identity commit.

| Concern | Required shape |
|---|---|
| Bearer path | Only the authorized admission verifier can consume the one-shot credential; no operational DTO, callback diagnostic or general handler receives it |
| Native PSK path | Admission receives authentic evidence of completed possession proof plus the matching redemption reference, never a public selector treated as proof and never the PSK secret |
| Evidence | Transport evidence reports only facts established before acquisition; later admission claims belong in a separate immutable admission record, not a mutation of `peerEvidence` |
| Resource cost | Unverified admission material may remain during OPEN/admission; byte, count, deadline and disposal limits apply after channel acquisition as well as before it |
| Failure timing | Failure before redemption leaves no committed use; after redemption, failure leaves the key spent even if no session establishes |

The benefit is that redemption has the AGP identity context immediately available.\
The cost is credential-handling authority above the transport boundary and proof-specific attachment rules; the current identity request cannot honestly be treated as a ready-made raw-token port.

### Redemption in the binding followed by exact association

The binding completes the required proof and invokes the redeemer before channel acquisition commits.\
It transfers a bounded credential-free association capability with the channel; identity admission checks the authenticated claims against OPEN and associates the reservation with the exact candidate.

Here, reservation means an irreversible successful redemption awaiting association, not a lease whose release restores single use.

| Concern | Required shape |
|---|---|
| Before acquisition | The binding owns the exact pending carrier and its termination; no fabricated AGP session identifier is needed |
| At ownership transfer | The association capability and any pending termination intent follow one channel into one controller incarnation; there is no interval in which neither owner can terminate it |
| After acquisition | Requests reach the session controller's guarded termination authority; the redeemer does not retain a raw socket or independently operate the controller |
| Claims | Immutable authenticated principal and scope constrain OPEN; transport proof alone never accepts the remote node assertion |
| Evidence | Projection is truthful at acquisition; the privileged association capability is not a serializable part of `peerEvidence` |
| Failure timing | A proof may be consumed before OPEN exists; a failed acquisition, cancelled association or collision loser still leaves that credential spent |

The benefit is retaining secret handling and proof verification at their transport boundary.\
The cost is an explicit authority handoff and a pending-use record before AGP identity is known.\
A termination request during that interval should terminate or invalidate the exact pending attempt, rather than wait indefinitely for a session name.

TLS possession proof is not complete merely because a PSK lookup returned a secret; the binding must observe the required completed handshake ([TLS authentication](https://www.rfc-editor.org/rfc/rfc8446.html#section-4.4.4)).\
The selected native profile must prevent resumption from bypassing fresh admission; certificate transport resumption does not itself replace an application credential check.

---

## 5. Cancellation and exact ownership

One local serialized disposition gate decides which event owns an attempt; an abort notification alone does not reverse a commit that already won.

| Situation | Required outcome in either candidate |
|---|---|
| Cancellation wins before channel acquisition | Reject acquisition, revoke publication authority and dispose late material/results; no live channel is delivered to a new session |
| Acquisition wins before cancellation | Transfer ownership once, then terminate through the session owner if the attempt is no longer eligible; aborting the old acquisition signal is insufficient |
| Redemption commits while local cancellation settles | Keep the credential spent; any resulting reservation is marked terminal/unassociated or attached only to the already-terminal incarnation |
| OPEN/admission work completes after its incarnation is invalidated | No identity retention, association mutation, route installation or establishment from that result; perform only bounded cleanup |
| Collision selection rejects the candidate | Preserve the existing canonical winner rule, terminalize only the loser and retain truthful consumption history |
| Exact close targets a pending candidate | Prevent that candidate from becoming established; report that no established session existed |
| Exact close targets an established incarnation | Commit one session disposition and normal teardown; do not select another session using only the remote node or a reusable session ID |
| Exact close is repeated or late | Return the same terminal disposition or a bounded already-ended result; never close a replacement incarnation |
| Carrier teardown completes later | Complete resource accounting only; no second terminal cause, route purge or retry |

The association capability is privileged even though credential-free.\
Its scope is the local incarnation and its ownership handoff, not a portable bearer token or a callable object embedded in a schema-backed request.\
Exact close is a host capability; no new close command from a remote peer is implied.

Close intent, session disposition and transport terminal are distinct records.\
Keep the first causal session reason and the binding's actual terminal outcome, rather than overwriting a carrier failure to make it look like a later policy close.

Cancellation revokes result authority; it cannot guarantee that arbitrary injected asynchronous code physically stops.\
Providers must cooperate with cancellation and bounded settlement, while unsettled work retains budget and exhaustion prevents further attempts.\
A cleanup fault is reported as such, never converted into evidence of release.

---

## 6. Retry and refusal

Recommendation for both candidates: keep scheduling in AGP's adjacency supervisor and let the host supply a typed eligibility decision tied to the current attempt/credential generation.\
The issuer and operation-proxy report policy and readiness; neither launches a competing AGP redial loop.

| Observed condition | Proposed supervisor action |
|---|---|
| Transient issuer/carrier failure or deadline | End the attempt; use configured backoff when eligible and within budget; next attempt obtains fresh material |
| Explicit issuer refusal of the standing proof | Pause that adjacency until the host supplies changed authority/readiness; do not infer a permanent refusal from a generic transport error |
| Admission material expired or a generic upgrade failed | Obtain fresh material on a later eligible attempt; do not diagnose sign-in expiry without evidence |
| Cleanup budget exhausted | Pause acquisition until a valid release observation restores capacity; do not launch a credential fetch just to wait behind a retained socket |
| Host stops or replaces the peer configuration | Invalidate its generation, cancel pending work and prevent future scheduling; discard old eligibility notifications |
| Host reports renewed credentials/readiness | Rearm the same supervisor once with a new eligibility generation; no manual operation replay |

Eligibility is scoped per adjacency, not globally across all identities or targets.\
Both candidates need a named control contract: existing generic connection failures, diagnostics and immutable peer evidence do not provide it.

The alternative is for the host to own all reconnection with AGP retry disabled, but that requires a complete replacement lifecycle contract for every native and browser consumer.\
Retaining AGP's existing scheduling owner is the recommendation, not a claim that the current API already supports pause/rearm.

Browser scripts cannot distinguish several network, TLS and opening-handshake failures ([WebSocket failure reporting](https://websockets.spec.whatwg.org/#feedback-from-the-protocol)).\
A shared failure model therefore preserves an unknown-cause acquisition failure and offers specific issuer refusal only when actually observed.\
One vocabulary must not become invented parity of observations.

---

## 7. Time and resource bounds

Numeric values are parameters still to be agreed, not adoption of Zorg's proposed 60/65-second admission budget or its pending-socket limits.

| Bound | Owner and rule |
|---|---|
| Outbound acquisition deadline | Supervisor; covers credential acquisition and every binding step before channel transfer, without resetting at each asynchronous operation |
| OPEN/identity-admission deadline | Session controller; starts at its declared lifecycle point and includes the admission hook; a post-acquisition credential operation cannot escape into an unbounded phase |
| Inbound pending deadline | Listener/binding before transfer, controller after it; specify whether transfer preserves one total admission deadline or starts a separately bounded phase |
| Credential expiry | Redeemer's trusted clock/generation model; the proposed semantic reference point is successful atomic redemption, with remaining time to establishment separately bounded |
| Pending attempts and bytes | Owning binding/controller; moving from acquisition to admission transfers accounting, never removes the still-unestablished attempt from all limits |
| Closing resources | Keep consuming aggregate retained-resource budget until the agreed release observation; browser limitations must be resolved under `B50`, not hidden by an abort return |
| Used-key records | Redeemer; retained through the permitted acceptance/reuse window and pending-result reconciliation, then retired without restoring eligibility |
| Session evidence | Caller-identity/host; remains available for the admitted session and already-admitted work that needs it, independently of credential expiry, with explicit count/lifetime limits |

Choosing redemption as the expiry checkpoint defines a last-redemption bound, not a promise that all establishment completes by that instant.\
If the requirement instead bounds establishment itself, both candidates need a final expiry decision before establishment and an explicit effect on already-spent credentials.\
Zorg must agree which event its leak-window claim measures; the clock, restart and multi-redeemer qualifications in the [requirements review](zorg-requirements-review.md#the-claimed-admission-deadline-needs-a-clock-model) remain open.

Close-on-reuse uses Zorg's live-key qualification, not an AGP default.\
Expiry alone does not close the first session, and a fresh credential does not itself choose the winner of AGP's ordinary collision rule.

---

## 8. Comparison and recommendation

| Criterion | Redemption at identity admission | Binding redemption and association |
|---|---|---|
| Secret-handling boundary | Wider: one-shot bearer material reaches the admission verifier | Narrower: raw credential stays with proof-owning binding and injected verifier |
| Node binding | Available when use commits | Checked after use commits, against authenticated constraints |
| Ownership work | Guard admission, consumption and teardown for one candidate | Guard those plus the pre-acquisition to controller handoff |
| Failed-before-OPEN consumption | No use commits if redemption has not run | Use may already have committed |
| Existing evidence rule | Requires a separate later admission result and privileged attachment path | Requires a privileged association path alongside immutable evidence |
| General utility | Useful when admission must interpret credentials with full session context | Useful when multiple proof mechanisms should yield a uniform bounded admission result |
| Main cost | Credential exposure and longer sensitive-material retention | More exact lifecycle coordination before session identity exists |

The candidates are not observationally identical at every pre-admission failure: their use-commit timing differs.\
Choose one common rule across the selected profiles; do not silently redeem browser credentials earlier and native credentials later while calling the semantics identical.\
In either design the client discards attempt material and fetches fresh material for a later connection, without assuming whether an interrupted remote redemption committed.

Recommendation: advance binding redemption plus exact association as the leading design, conditional on a bounded, incarnation-safe ownership handoff and agreed expiry semantics.\
Retain identity-admission redemption if that handoff cannot meet the obligations without leaking transport internals or creating competing owners.\
Requiring a one-shot credential path is not automatically wrong; requiring a credential-free capability is not automatically safe.

The following remain separate decisions:

- Redemption location and its irreversible-use semantics.
- Browser carriage: upgrade, cookie where applicable, or a bounded protected-channel exchange.
- Evidence and capability shapes, including principal/issuer/expiry representation and exact-close authority.
- Numerical deadlines, cleanup budgets, supported browsers and deployment trust.

---

## 9. Contract impact and next handoff

| Work | Proposed treatment |
|---|---|
| Existing acquisition ownership/deadline gap | Correct under the current transport contract independently of credential design; specify deadline configuration and stop/late-completion ownership explicitly |
| Per-attempt credentials | Compose with a bound connect capability; keep secrets out of node configuration and avoid mutating a shared PSK provider across concurrent attempts |
| Admission attachment and exact control | Named process-local capability revision; inventory existing consumers and migration effects before selecting public signatures |
| Evidence | Preserve historical truth; revise the closed schema only for justified new facts, not to carry a live handle or credential |
| Retry eligibility and cancellation | Node lifecycle/control revision with native defaults preserved; do not repurpose a diagnostic sink or a carrier error string as authority |
| Browser carrier | Continue `B50` resource/terminal feasibility and portability work independently; no conformance claim follows from this comparison |
| AGP wire | No wire change selected here; a protected pre-admission exchange would require its own framing/negotiation and migration decision |

For joint review, Zorg's credential owner needs to answer four focused points: whether early irreversible use is acceptable, which event expiry bounds, how refusal/readiness is reported, and what atomic redemption/restart scope it can guarantee.\
AGP must then turn the selected ownership model into a concrete contract with both native and browser profile mappings, reviewed before implementation.\
The comparison is available locally; no new downstream delivery or agreement is claimed.

---

## 10. Consequence of violation

- Treating acquisition, authentication and establishment as one commit loses the owner of an interrupted attempt.
- Returning a reservation to the unused state after teardown contradicts single-use semantics.
- Reusing acquisition cancellation after transfer leaves an already-owned channel outside the requested close.
- Associating by a reusable session ID allows stale authority to address the wrong incarnation.
- Resetting accounting at a phase boundary makes bounded recovery an unbounded resource claim.
- Treating admission expiry as current authorization silently changes Zorg's session-lifetime policy.
- Treating this draft as a selected design would bypass the remaining owner agreements and ratification.
