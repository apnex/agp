# Zorg review reply assessment

Status: reviewed input, with unresolved design conditions; no authentication profile or public API approved.\
Tier 3 analysis by the AGP session, 2026-10-11; source observations and Zorg's stated decisions are labelled separately below.

Zorg has answered the four credential-owner questions and corrected most earlier acceptance wording.\
Two claims still prevent adopting the proposed composition: a destination pin does not guarantee that another peer cannot receive reply bytes, and the establishment bound omits the interval between redemption and the OPEN timer.\
Resolve those guarantees while correcting AGP's admission-lifetime design; do not reopen issuer policy or select a browser-specific authentication mechanism.

---

## Reviewed inputs

| Input | Measured checkpoint and authority |
|---|---|
| Zorg's reply | [agp-review-reply.md](../../../zorg/upstream/agp-review-reply.md), SHA-256 `ccf5f57294f9f6df2ca9a6bf0610ad2dc4350b570d6e1b65c9ccd8dcb93587b9`; the director supplied it for review, while its own status remains draft |
| Zorg decisions and build record | [D47 and D48](../../../zorg/docs/DECISIONS.md), [Delta 1 stage 4](../../../zorg/docs/DELTAS/DELTA-1.md#stage-4), at `c1aeff3767765518df436d47195cd9600daaa847`; D48 arrived during this review and supersedes the reply's D46 proxy comparison |
| AGP implementation and contracts | `f16266aaafa66f6301d7afbf09c55e3a1f990274`; local tracked source unchanged |
| Prior analytical inputs | [Requirements review](zorg-requirements-review.md), [lifecycle comparison](admission-lifecycle-comparison.md); recommendations, not adopted contracts |
| Operation-call implementation | `c08afa24428b2594b8cc910df807231613b05b72`; concurrent working changes are not the pinned implementation or accepted evidence |
| Correspondence ownership | Zorg's [upstream rules](../../../zorg/upstream/README.md): AGP drafts go in ignored `upstream/incoming/`; Zorg owns acceptance and the unedited received copy |

Zorg's reply, decisions and component declarations are one source family.\
AGP's normative contract and source constrain the composition independently; agreement among local comments and tests is not another independent instrument.\
The separate [admission-lifetime review](admission-lifetime-independent-review.md) supplies a non-author judgement of that draft, not certification of Zorg's proposal.

---

## What Zorg has settled

These are consumer decisions and requirements from the reply and D47, not new AGP guarantees.

| Subject | Consumer position | Remaining contract work |
|---|---|---|
| Early use | A failed establishment may leave the credential spent; the next attempt fetches fresh material | Name completed proof and atomic redemption separately from non-consuming key lookup; accepting the cost does not select the seam |
| Expiry | Lifetime bounds redemption, not the established session | Bound every subsequent phase through establishment |
| Refusal | An explicit issuer refusal pauses until proof changes; an unclassified transport failure remains retryable | Define pause/rearm on AGP's single supervisor without inventing information absent from browser errors |
| Initial deployment | One issuer/redeemer process and shared monotonic clock; refuse every pre-restart credential | Specify a restart generation or fresh issuance namespace, not a comparison of unrelated process clocks |
| Proof purpose | Trusted state binds proof mode, principal, issuer, hub, node and redemption identity; a PSK selector is not bearer authority | Carry those constraints through redemption and exact session association |
| Acceptance corrections | Expired reuse does not close the first session; fresh credentials do not override collision selection; resumption is profile-specific; first target is one hub plus eighteen peers | Turn the corrected requirements into agreed acceptance predicates; proposed browser and resource limits remain unapproved |

Multiple listeners can share one in-process redemption authority and atomic record.\
The distributed boundary is independent redemption state accepting the same audience, not listener count alone.\
A separate issuer's clock-error and rollback model remains deferred; a future-issued-key check alone would not prove a wall-clock rollback bound.

---

## Reply pinning does not establish peer confidentiality

**Source observations.**\
Zorg's section 4 uses one reply name, `operation-call/replies`, advertised under each peer's node, and pins replies to the request origin.\
[D26](../DECISIONS.md#d26---destination-selection) deliberately permits selected-route fallback when a hop lacks the named instance, because intermediate hops receive selected routes rather than every alternative.\
[`DataPlane.#resolveForwarding`](../../packages/node/src/data-plane.ts), lines 278-332, implements that fallback and refuses a mismatched pin where the message would be delivered locally.\
Its transit-off guard at lines 354-356 applies to session arrivals, not hub-originated replies; the selected egress carries the encoded payload when the remaining admission checks succeed.\
The existing [destination-selector contract test](../../packages/node/test/contract/destination-selector.test.js), lines 125-143, asserts that an unavailable instance does not serve the message, not that another peer's channel never receives its payload.

**Assessment: blocking for the proposed reply-isolation claim, not a breach of D26.**\
When the intended peer's route is absent and another permitted advertiser of the shared reply name is selected, the existing contract permits reply bytes to leave toward that other peer.\
A conforming receiving handler's rejection does not provide confidentiality from the peer that owns the connection.\
Route-origin and endpoint-name admission remain necessary, but do not supply the missing egress guarantee.

Required predicate: private reply bytes are never admitted to a channel belonging to another peer; route absence, withdrawal or replacement must not redirect them to an unauthorized destination.\
Refuse before transfer when the authorized target cannot be established atomically.\
Handler invocation counts alone cannot establish it.

Design work under `B51`: compare an atomic exact-peer egress constraint for this direct-peer topology with an ownership scheme giving each reply destination a unique authorized name.\
Neither is selected here; preserve endpoint grammar, deterministic routing and the ratified multi-hop pin behaviour.\
A separate route-table precheck is insufficient because the route can change before send admission.\
Do not globally change `pinned` into early refusal or quietly encode node addressing into endpoint strings.

This is a static contract-composition finding, not an observed disclosure or an executed vulnerability reproduction.

---

## The establishment bound needs the interval before OPEN

**Source observations.**\
Zorg's sections 1 and 2, and D47, add AGP's opening timeout directly to the last-redemption bound.\
The [FSM timer contract](../design/fsm.md#5-timers) anchors OPEN at local OPEN write admission, after channel acquisition.\
The [lifecycle comparison](admission-lifecycle-comparison.md#7-time-and-resource-bounds) already requires a bounded inbound phase and explicit deadline ownership at transfer.

**Assessment: material omission in the claimed upper bound.**\
For binding redemption, completed proof and use can precede the OPEN anchor.\
Remaining handshake, channel handoff and local OPEN admission cannot be assigned zero duration by implication.\
The server must own that bound; a cooperative client's outbound acquisition timeout cannot enforce it for every inbound peer.

The relationship to specify is:

- Last redemption: issue time plus credential lifetime and the agreed clock terms.
- Last establishment: last redemption plus the bounded remaining interval to the OPEN anchor plus the OPEN budget, or a single absolute deadline covering both remaining phases.

For the agreed same-process model, the clock terms vanish, but the phase between redemption and OPEN does not.\
Expiry must be checked at the atomic redemption point following completed proof, not just when a PSK secret is looked up.\
`B52` bounds local outbound acquisition and `B53` repairs admission/OPEN lifetime; neither by itself specifies a future binding's inbound redemption-to-OPEN budget.

Required predicate: every admitted inbound attempt has a server-owned finite deadline through establishment, with no unbudgeted handoff or reset that increases the declared total.\
Choose numerical values only after agreeing the owners and timing anchors.

---

## Resource release and consumer readiness

Zorg correctly reclassifies the X2 numbers as proposals, but its release-on-admit/fail/timeout sentence needs an ownership qualification.\
An authentication slot may end then; an unresolved provider, socket or closing resource cannot disappear from every finite budget at that instant.\
Admission transfers accounting to the active owner; failure or timeout transfers or retains it until the actual release observation.\
This follows the [cleanup-overlap intent](../surveys/shared-transport-survey.md) and the [lifecycle comparison](admission-lifecycle-comparison.md#7-time-and-resource-bounds); it is not approval of 10 seconds, 64 sockets or 16 KiB.

`B48` must no longer say operation-call has no implementation.\
Zorg's pinned stage-4 record reports a build and an unsuccessful first verification, with two blocking, two material and one minor finding accepted for correction.\
Its passing test count is not certification of the five actual-consumer handoff cases.\
Keep `B48` open for corrected, revision-pinned consumer acceptance; do not duplicate or edit Zorg's implementation work.

The reply's proxy comparison has also moved on: Zorg's D48 now compares the invocation to the direct call the proxy actually makes, with explicit transit and deadline qualifications.\
That is consumer-layer work, not a new AGP requirement or an AGP certification of proxy semantics.

---

## Next owner actions

The [ratified product axioms](../design/axioms.md) support these constraints: A3 keeps issuer policy and transport/runtime duties separate; A4 requires accurate phase and release claims; A8 forbids treating a consumer proposal as an adopted contract.\
The scoped A9 and A14 obligations require later boundary evidence and recorded closure, not new deployment or security-certification claims.

| Owner | Next action | Closure condition |
|---|---|---|
| AGP | Correct the admission-lifetime draft against its independent findings | Valid renewed design verdict and director agreement on public changes before building |
| AGP with Zorg | Define reply isolation at the channel boundary under `B51` | Shared invariant, scoped mechanism and acceptance obligations that preserve D26 |
| AGP with credential-issuer owner | Complete the redemption-to-session lifecycle under `B6` | Deadline transfer, atomic use, restart generation, exact association and pause/rearm have named owners |
| Zorg | Finish operation-call corrections and supply its acceptance record | Actual five-case outcomes against named AGP and consumer revisions |
| Both owners | Agree browser targets and retained-resource observations under `B50` | Honest carrier-specific evidence against the shared contract |

No runtime, normative contract or downstream file changes follow from this assessment.\
Any response draft for Zorg belongs in `upstream/incoming/`; this local record does not claim that one was sent or received.
