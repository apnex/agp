# Admission use lifecycle proposal

Status: amended producer API proposal for `B6`, coordinated with `B53` and `B51`; independent re-review pending, not ratified, implemented or sent to Zorg.\
Audience: AGP maintainers and Zorg's credential-issuer and caller-identity owners.

Correction: the [reviewed acquisition draft](../reviews/evidence/admission-acquisition-review-input.txt) received technical FAIL and scoped M7 FAIL in the [independent report](../reviews/admission-acquisition-independent-review.txt).\
This amendment replaces its two-instant redemption sequence with one clock-bound authorization check and clarifies ordinary-stop accounting.\
The earlier draft, report and [author assessment](../reviews/admission-acquisition-review.md) remain historical; this revision has no independent verdict yet.

Recommend one process-local observation handle for each attempted credential redemption, retained continuously from before redemption until the exact admitted controller becomes terminal.\
The issuer records that handle with the successful redemption; AGP updates its admission and terminal facts at the corresponding guarded commits.\
The issuer can then reclaim a lease without inferring absence from a management snapshot or depending on delivery of an event.

The proposed acquisition contract sits above the neutral packet transport and feeds the same AGP session owner for CLI and browser carriers.\
It specifies factory activation, one-use handoff, clock ownership and required finite configuration; joint agreement and independent review remain prerequisites to implementation selection.\
It does not select browser credential carriage, an authentication protocol, live reauthorization or new credential policy.

---

## 1. Authority and source boundary

The director selected this work by replying "continue" to developing the connection-lifecycle API proposal after the Zorg status review.\
The fixed brief is Zorg's two agreed lifecycle facts, with one mechanism across CLI and browser carriers and clean ownership of credential policy.\
Explicit survey bypass: those outcomes are already specified by the director and [Zorg's lifecycle reply](../../../zorg/upstream/agp-direct-peer-send-lifecycle-reply.md), so this step proposes technical choices rather than running another intent survey.\
The [existing survey](../surveys/shared-transport-survey.md) retains its qualifications, including bounded cleanup overlap, application-owned offline work and separate approval of migrations.

| Input | Constraint carried into this proposal |
|---|---|
| [Zorg's lifecycle reply](../../../zorg/upstream/agp-direct-peer-send-lifecycle-reply.md) | Issuer owns the lease and reclamation; binding/AGP owes exact redemption handoff or termination and exact admitted-controller lifetime |
| [Zorg's establishment clarification](../../../zorg/upstream/agp-review-response-reply.md#2-the-whole-establishment-interval) | One absolute bound from redemption through establishment, including pre-channel work and handoff |
| [Credential-issuer contract](../../../credential-issuer/CONTRACT.md) | One in-process redeemer per audience, irreversible use, generation-based restart refusal and four conjunctive reclamation conditions |
| [Caller-identity contract](../../../caller-identity/CONTRACT.md) | Application identity remains consumer-owned; existing bounded admission and record retention remain until verified migration |
| [Direct-peer contract draft](direct-peer-send.md) | Immutable authorization association, stable instance binding across reconnects, distinct binding on later allocation |
| [Admission correction revision 4](../reviews/admission-lifetime-correction-r4.md) | Guarded commits, independent provider-work accounting, runtime-terminal preflight and no external callbacks inside the executor |
| [Earlier lifecycle comparison](../reviews/admission-lifecycle-comparison.md) | Binding-side redemption remains the leading candidate, not an adopted authentication profile |

Measured source facts, distinct from proposed behavior:

- [Transport acquisition types](../../packages/transport/src/types.ts) return a channel or accept a channel envelope; neither declares a redeemed-use attachment or inherited opening deadline.
- [Identity admission types](../../packages/core/src/types.ts) provide a credential-free request and allow/deny result; no exact lifetime handle exists there.
- [The node's connection projection](../../packages/node/src/node.ts) derives from its controllers, so it is not an inventory of the binding's pre-acquisition work.
- [The controller's admission path](../../packages/node/src/session-controller.ts) receives the policy answer before identity retention and FSM identity commit; callback `allow` is not the commit fact.

The [initial check record](../reviews/admission-use-lifecycle-checks.json) and [preserved initial proposal](../reviews/evidence/admission-use-lifecycle-before-acquisition.txt) retain the earlier observation-only scope.\
The [acquisition check record](../reviews/admission-acquisition-handoff-checks.json) pins the subsequent acquisition draft's sources and author validation.\
The director then selected an independent challenge and, following its FAIL, selected this timing amendment.\
The [amendment check record](../reviews/admission-redemption-timing-checks.json) identifies this revision and its author-only validation.\
Neither continuation ratifies new public surfaces or changes earlier review verdicts or the frozen admission-correction documents.

---

## 2. Choice and alternatives

| Candidate | Benefit | Cost and limitation |
|---|---|---|
| Exact per-use query handle, recommended | Starts before redemption, follows one controller and retains its terminal fact without a subscription | Requires a declared creation/attachment boundary and bounded issuer-held handle retention |
| Extended complete connection snapshot | Fits existing sweep-oriented consumers and can show a population in one read | Must include binding-owned pre-acquisition uses, exact incarnations and a complete consistent cut; adding `instanceBinding` alone is insufficient |
| Lifecycle events alone | Prompt notification with small common-case latency | Missed events, late subscription and observer failures require authoritative resynchronization; events alone cannot establish absence |
| Existing snapshots plus a grace TTL | No new producer surface | Does not establish the agreed pre-admission or exact-controller facts and cannot support production reclamation |

An extended snapshot is not intrinsically incorrect.\
Its complete inventory would be a larger contract than the per-use fact Zorg needs, and it still needs the underlying lifecycle accounting.\
Keep management snapshots observational; do not make issuer correctness depend on adding authority to that projection.

No callback stream is required for the first query-handle design.\
Zorg can use its existing sweep model over a finite set of handles; delayed sweeps conservatively delay reclamation.\
If wakeups are later earned, they only request a reread and cannot authorize release by themselves.

---

## 3. Proposed observation surface

The handle is a trusted process-local capability, not a JSON credential, wire field, public session identifier or portable proof.\
One handle denotes one attempt and can acquire at most one admitted controller for its entire lifetime.\
The same object survives the binding-to-controller ownership transfer, so the issuer never removes one reservation while waiting to learn its replacement.

Proposed types, using the association from the separate direct-peer draft:
```ts
interface AdmissionSessionIdentity {
  readonly remoteNodeId: NodeId;
  readonly localSessionId: SessionId;
  readonly authorizationAssociation: PeerAuthorizationAssociation;
}

type AdmissionUseSnapshot =
  | { readonly state: "pending" }
  | {
      readonly state: "admitted" | "established";
      readonly session: AdmissionSessionIdentity;
    }
  | {
      readonly state: "terminal";
      readonly admittedSession?: never;
      readonly reachedEstablished: false;
    }
  | {
      readonly state: "terminal";
      readonly admittedSession: AdmissionSessionIdentity;
      readonly reachedEstablished: boolean;
    };

interface AdmissionUseObservation {
  readAdmissionUse(): AdmissionUseSnapshot;
}

interface AdmissionUseControl {
  requestAdmissionTermination(): void;
}

interface RedeemedAdmissionContext {
  readonly redemptionId: string;
  readonly lifecycle: AdmissionUseObservation;
}
```

`AdmissionSessionIdentity` is copied descriptive data; its session string is never the key for control or reclamation.\
The non-reassignable handle itself identifies the exact attempt/controller incarnation, even when public identifiers are reused.\
Two handles may carry equal session strings and association values without denoting the same controller.\
No handle, control capability or retained controller is added to `EndpointDeliveryContext.directPeer`.

`readAdmissionUse()` is a synchronous, bounded, side-effect-free read of AGP-owned state.\
It returns a fresh or shared immutable value and runs no consumer callback, getter, clock adapter or diagnostic sink.\
A read is a point-in-time fact; a previously returned pending/admitted value is not a liveness guarantee for a later decision.\
Terminal is irreversible and remains queryable from an already-held handle after runtime detachment, without retaining the controller, channel, provider result or node object graph.

Permitted progression:
```text
pending -> admitted -> established -> terminal
pending --------------------------> terminal
           admitted --------------> terminal
```

`admitted` means identity and collision ownership actually committed, including the immutable authorization association.\
`established` additionally means protocol confirmation committed.\
Either state retains the issuer's lease; the opening deadline still applies while merely admitted.\
Terminal retains the bounded last admitted identity, if any, and whether establishment occurred, so a consumer that missed both intermediate states does not invent pre-admission failure.

Query failure, an invalid result, a missing registration or lost lifecycle knowledge means unknown to the consumer, never terminal.\
A copied or deserialized object is not a valid handle; construction and attachment must validate runtime provenance, not rely on TypeScript structural typing alone.\
An untrusted `redemptionId` string is not proof of credential redemption.

Propose the same bounded-string rule as the association draft for `redemptionId`: 1 to 256 Unicode scalar values, excluding controls and unpaired surrogates.\
The issuer must confirm that bound fits its identifier format; AGP treats the value as opaque and compares it exactly.\
The terminal variants deliberately prohibit a claim of establishment without an admitted identity.

---

## 4. Continuous reservation and handoff

### 4.1 Node construction and activation

Recommend an explicit admission-acquisition composition supplied through the existing `createNode()` factory.\
Do not add credential metadata to the neutral transport's channel envelope, overload `peerEvidence`, or recover it through an ambient lookup keyed by a session string.\
The higher-level contract can require an attachment on both acquisition directions without making `@agp/transport` import AGP identity types.

The proposed dependency alternatives are mutually exclusive:
```ts
/** Builds an inert admission acquisition composition using the node's clock. */
type AdmissionAcquisitionFactory = (
  context: AdmissionAcquisitionContext,
) => AdmissionPeerAcquisitionPort;

/** Identifies the local acquisition contract and the exact shared clock object. */
interface AdmissionAcquisitionContext {
  readonly contract: "agp.admission-acquisition/v1";
  readonly clock: ClockPort;
}

/** Selects ordinary transport or required admission acquisition, never both. */
type NodeAcquisitionDependencies =
  | {
      readonly transport?: PeerTransportPort;
      readonly createAdmissionAcquisition?: never;
    }
  | {
      readonly transport?: never;
      readonly createAdmissionAcquisition: AdmissionAcquisitionFactory;
    };

/** Resolves admission acquisition capabilities without carrier-specific fields. */
interface AdmissionPeerAcquisitionPort {
  readonly contract: "agp.admission-acquisition/v1";
  readonly clock: ClockPort;
  resolveListener(reference: TransportRef): AdmissionListenCapability | undefined;
  resolveTarget(reference: TransportRef): AdmissionConnectCapability | undefined;
}

/** Accepts only sealed admission handoffs within one listener generation. */
interface AdmissionListenCapability {
  listenAdmission(
    options: TransportListenOptions,
    callbacks: AdmissionAcceptCallbacks,
    uses: AdmissionUseSource,
    signal: AbortSignal,
  ): Promise<TransportListenerPort>;
}

/** Returns one sealed admission handoff for one node-owned dial attempt. */
interface AdmissionConnectCapability {
  connectAdmission(
    options: TransportAcquisitionOptions,
    uses: AdmissionUseSource,
    signal: AbortSignal,
  ): Promise<AdmissionChannelHandoff>;
}

/** Transfers a handoff synchronously; a callback throw leaves binding ownership. */
interface AdmissionAcceptCallbacks {
  acceptAdmission(handoff: AdmissionChannelHandoff): void;
  capacityRejected(kind: "pending-acquisition" | "active-channel"): void;
}
```

`NodeDependencies` would compose `NodeAcquisitionDependencies` with its existing non-transport dependencies.\
This is one node factory, not a browser factory or a second session runtime.\
The ordinary `transport` branch retains its current contract; all configured acquisitions in the new local-redeemer branch require admission handoffs, with no per-channel fallback to an uncredentialed path.\
This proposal does not introduce mixed-carrier composition or several listeners in `NodeConfig`.

Local redemption is an authentication role, not a synonym for accepting a socket.\
A local verifier may acquire a peer by listening or dialing; both paths below carry its local redemption.\
A client merely presenting a key to a remote hub must not fabricate a local redemption or import the hub's monotonic deadline.\
Its fresh-key-per-dial and refusal/rearm contract remains separate B6 work; this completion does not claim that client-facing acquisition contract is designed.\
The distinction is identical for CLI and browser carriers, and costs a deliberately homogeneous local-redeemer composition until a different local trust profile is explicitly designed.

Construction validates core configuration, selects and captures the node clock, and calls `createAdmissionAcquisition` exactly once, outside the executor.\
The factory constructs configuration and capabilities only: no listener, credential fetch, proof, redemption, socket or timer starts there.\
The node checks the contract discriminator, exact clock-object equality, required admission configuration and provider support, then resolves every configured reference once before returning the node.\
Supplying both dependency branches, missing configuration, a missing capability, a clock mismatch or a throwing factory fails synchronously as `CONFIG_INVALID`, with no acquisition source activated.

An older node that ignores the new dependency cannot invoke its factory or supply an active `AdmissionUseSource`; the composition therefore cannot start redemption.\
No pre-created credential-enabled transport is also supplied under the legacy field as a fallback.\
Contract tests must exercise this fail-closed composition, not merely test whether an optional property exists.

On start, the node creates a source bound to the exact listener generation or outbound acquisition attempt before invoking the corresponding capability.\
A listener source may reserve multiple bounded uses until that listener ends; a dial source permits at most one successful reservation for its entire invocation, even if that reservation later fails.\
Stop, failure, source closure or replacement revokes unused reservation authority; restarting requires a new node and new sources.\
An already-adopted controller no longer depends on its listener or dial source being live.

### 4.2 Reservation and sealed attachment

The proposed process-local capabilities are:
```ts
/** Reserves pending-use and acquisition-work capacity before external work starts. */
interface AdmissionUseSource {
  reserveAdmissionUse(): AdmissionUseReservationResult;
}

/** Refusal allocates no use, starts no work and never queues the caller. */
type AdmissionUseReservationResult =
  | { readonly kind: "reserved"; readonly use: AdmissionUseReservation }
  | {
      readonly kind: "refused";
      readonly reason: "inactive" | "capacity" | "acquisition-consumed";
    };

/** Holds one admission attempt; accounting completion is not session termination. */
interface AdmissionUseReservation {
  readonly lifecycle: AdmissionUseObservation;
  readonly control: AdmissionUseControl;
  readonly redemption: AdmissionUseRedemption;
  readonly acquisitionSignal: AbortSignal;
  sealAdmissionHandoff(channel: TransportChannelPort): AdmissionHandoffSealResult;
  finishAdmissionAcquisition(): void;
}

/** Authorizes redemption strictly before an issuer-selected shared-clock limit. */
interface AdmissionRedemptionAuthorization {
  readonly clock: ClockPort;
  readonly validBeforeMonotonicMs: number;
}

/** Records one use at a clock reading that also checks its authorization limit. */
interface AdmissionUseRedemption {
  readonly lifecycle: AdmissionUseObservation;
  recordAdmissionRedemption(
    redemptionId: string,
    authorization: AdmissionRedemptionAuthorization,
  ): AdmissionRedemptionResult;
}

/** Refusal grants no publication; an earlier recorded use is never replaced. */
type AdmissionRedemptionResult =
  | { readonly kind: "recorded"; readonly context: RedeemedAdmissionContext }
  | {
      readonly kind: "refused";
      readonly reason:
        | "inactive"
        | "expired"
        | "authorization-expired"
        | "already-recorded"
        | "invalid-redemption"
        | "invalid-authorization";
    };

declare const admissionHandoffBrand: unique symbol;

/** Identifies a sealed channel/use pair; its contents and brand are producer-owned. */
interface AdmissionChannelHandoff {
  readonly [admissionHandoffBrand]: true;
}

/** A refused seal leaves the channel with its binding for terminal cleanup. */
type AdmissionHandoffSealResult =
  | { readonly kind: "sealed"; readonly handoff: AdmissionChannelHandoff }
  | {
      readonly kind: "refused";
      readonly reason: "inactive" | "expired" | "not-redeemed" | "already-sealed";
    };
```

These sketches declare a proposed contract, not methods available from current package exports.\
Every successful reservation creates one lifecycle cell, one coalesced control latch and one acquisition-work receipt.\
All views return the same observation object; a redemption capability cannot attach a channel or request termination.\
The source, reservation and handoff have producer-owned runtime provenance, checked by object identity and private state rather than structural shape, a public string or `instanceof` alone.\
The authorization is instead trusted issuer input to that capability: a finite exclusive time limit plus the exact shared clock object, validated as section 4.4 specifies.\
It is not a credential, transferable proof or independently authenticated claim about the origin of a number.

Reserve before starting proof, redemption, credential acquisition or other profile-owned work.\
For inbound native arrivals, any resources acquired before this reservation remain under the carrier's existing finite pending-acquisition budget; failure to reserve refuses that arrival before proof/redemption.\
The node does not claim to bound a carrier's invisible native allocations.

`sealAdmissionHandoff()` binds the exact channel object to the recorded use, source generation and inherited deadline once.\
It neither commits AGP identity nor transfers channel ownership by itself.\
The channel already meets the neutral packet contract, including bounded early-packet admission and immutable peer evidence.\
Sealing cannot refresh a deadline, substitute another channel later, or accept the same channel under a second use.\
A seal refusal leaves the channel with the binding, which invalidates the attempt and performs its bounded cleanup; the key remains spent after successful redemption.

The sealed object is not a bag of caller-supplied fields.\
Node-private attachment state holds the channel and deadline; the public observation holds neither.\
The node consumes a handoff at most once and only for its originating listener/dial source and node generation.\
A foreign, copied, previously consumed or wrong-source handoff never constructs a controller or authorizes disposal of a different source's channel.

### 4.3 Channel custody and controller adoption

Distinguish neutral carrier acquisition, acquisition handoff to the node, controller adoption and identity admission.\
Only the last changes the observation from `pending` to `admitted`.

| Boundary | Channel owner and effect | Failure disposition |
|---|---|---|
| Before sealing | Binding owns its partial work or acquired channel | Invalidate publication; request binding cleanup; keep work charged |
| Sealed but not delivered | Binding still owns the exact channel and the only offer | Abandoning the offer terminalizes the use; the binding disposes the channel and offer |
| Inbound `acceptAdmission` normal return | Custody transfers to a bounded node handoff record, which may await controller adoption | If the callback throws, this invocation transferred nothing; the binding cleans up only what it still owns and applies the existing listener callback-fault discipline |
| Outbound successful `connectAdmission` settlement | Custody transfers to the node even if its promise continuation has not yet run | A rejected invocation transfers no offer; the binding invalidates and disposes any sealed offer it still owns |
| Guarded controller adoption | Node consumes the matching handoff and installs the exact pending controller | On expired deadline, revoked source, stop or session capacity refusal, the current custodian terminalizes and disposes without constructing a live controller |
| Guarded identity commit | Controller identity, collision ownership, association and admitted lifecycle fact install together | Denied, invalid, stale or expired results cannot install any of these effects |

The node reserves its outbound outcome record before invocation and attaches fulfillment/rejection handling in that same non-yielding invocation turn.\
Handoff retention is part of the reserved use rather than a second queue.\
The source tracks sealed but undelivered offers, so cancellation or timeout revokes their publication authority even when a callback or promise is delayed.\
A fulfilled outbound offer still reaches node cleanup after stop; it cannot regain adoption authority.\
There is no claim of physical cleanup at the instant a JavaScript continuation has not yet run.

At inbound callback entry, the node validates and records custody synchronously without invoking policy, reading channel properties, awaiting the executor or running channel cleanup.\
It has already normalized external channel facts during sealing, outside the commit.\
The callback returns normally for a valid offer, including one that must be disposed, and the node performs guarded adoption or disposal afterwards.\
A provenance fault throws before taking custody; the binding applies the same first-terminal-wins callback-fault contract as neutral acquisition.\
Replaying an already-transferred offer cannot restore binding ownership or authorize it to abort the node's channel.\
An outbound resolution with a foreign or invalid offer likewise transfers no authority over that foreign channel; it invalidates the originating attempt and leaves its undelivered offer with its existing custodian for cleanup.\
No fallible external call may occur between custody installation and normal return.

The originating source's cancellation rules apply until controller adoption; after adoption, the exact controller and the inherited opening bound own termination.\
Listener close does not close adopted controllers, and later cancellation of the original dial signal does not close an adopted channel.\
`acquisitionSignal` requests cleanup only while acquisition remains with the binding or handoff owner; after adoption it cannot become a second session-close mechanism.\
The separate `AdmissionUseControl` follows the exact use across every phase.

`finishAdmissionAcquisition()` is an idempotent statement by the composition that its work, retained results and callbacks for this use have settled or been disposed.\
It revokes any still-unconsumed sealing authority; it never terminates an adopted controller or clears issuer registration.\
With no sealed handoff and no remaining publication path, finishing terminalizes the pending use through the current owner rather than leaving a reservation waiting for a callback that cannot arrive.\
The work slot returns only when that statement and the node's handoff disposition are both complete: adopted, or terminal with a binding-owned undelivered offer or node-owned delivered offer disposed by its custodian.\
An unsettled connect invocation, a queued offer or an undisposed binding result therefore remains charged even after this method is called.\
A composition that hides continuing descendant work behind an early finish violates the contract and must retain its own finite budget; a finish call is not proof of native socket release.

### 4.4 Redemption and admission commits

The repair passes the issuer's time-limited authorization into the node, rather than checking expiry at one instant and starting the opening allowance at another.\
The issuer selects an exclusive upper bound `E = validBeforeMonotonicMs` no later than the credential's actual expiry in the shared monotonic domain.\
After proof and all non-temporal checks succeed, it authorizes this one redemption only at an instant strictly before `E`.\
AGP enforces that declared limit as a temporal guard; it does not parse credentials, select lifetimes or decide issuer policy.

`AdmissionRedemptionAuthorization.clock` must be the exact node/redeemer clock already agreed at construction, not a structurally equivalent clock or a clock-domain label.\
The node checks object identity and a finite numeric bound without coercion, copies the bound before entering its commit, and samples only its captured clock.\
The issuer must derive the limit from that clock and the current issuing generation; wall-clock timestamps, remote samples and expiry translated afresh into a remaining lifetime are not valid inputs to this composition.\
An issuer may shorten the authorized interval but cannot extend credential expiry.\
Object equality and numeric validation reject mismatched domains and malformed values; they cannot prove that a trusted issuer derived a number honestly.\
That derivation is an explicit issuer integration obligation, not a runtime provenance claim or an authorization accepted from the remote peer.

Let `r` be the node's single final monotonic sample after normalization and transaction preflight, and `R = r + establishmentTimeoutMs`.\
For a successful redemption, `r` is the linearization instant for both owners: the credential must be authorized at `r < E`, and the inherited opening deadline is exactly `R`.\
The same sample checks every currently active acquisition bound; equality at any applicable bound refuses.\
The node installs the reference and deadline without yielding, calling issuer code or resampling an anchor; later reads can check expiry or schedule a wake but cannot replace `r` or extend `R`.

The following sequence is the producer obligation for the leading binding-redemption candidate:

| Step | Owner and effect | Required invariant |
|---|---|---|
| Reserve attempt | `reserveAdmissionUse()` obtains the pending cell and work receipt before invoking redemption | No irreversible redemption depends on these capacities being allocated afterwards; controller capacity can still refuse later |
| Prepare redemption | After proof, issuer holds serialization, validates generation, unspent state and all non-temporal policy, derives `E`, and prepares bounded spent-use and handle registration | Preliminary expiry rejection is allowed, but is not the authoritative check; no external success or handoff is visible |
| Record redemption | Issuer calls `recordAdmissionRedemption(redemptionId, authorization)` while serialization remains held | Node validates the authorization's clock and shape, preflights the transaction, samples `r` once, requires `r < E` and all active acquisition bounds, then records the reference and `R` |
| Commit issuer state | On a recorded result, issuer installs its prepared spent record and handle registration in the same non-yielding serialized turn | The successful transaction linearizes at `r`; registration completes before success, handoff or another issuer decision becomes visible |
| Transfer acquired channel | Binding seals and delivers that use's exact channel through the acquisition contract | The one-use offer transfers custody without replacing the lifecycle handle or resetting its deadline |
| Evaluate identity | AGP supplies the trusted redemption reference and observation through process-local evaluation options | The provider checks node/issuer/principal/binding constraints; no secret enters the request DTO or `peerEvidence` |
| Commit identity | AGP's prepared guarded transaction installs exact controller ownership, validated association and the handle's admitted state together | Provider `allow`, collision preparation or an unconsumed transaction permit cannot publish admission |
| Confirm establishment | The exact controller passes every active opening guard and commits protocol confirmation | Handle becomes established and the opening deadline loses authority only at this commit |
| Terminate | The current owner irrevocably removes publication/use authority and commits terminal state | Late work can complete accounting only; it cannot reattach the handle or affect another attempt |

The issuer holds serialization from its final non-temporal policy checks through recording and installation of both the spent use and handle.\
All fallible issuer validation and capacity preparation precede the call; the time-dependent final check is explicitly delegated by the supplied authorization.\
No asynchronous gap, reentrant consumer call or second independent issuer writer is permitted before registration completes.\
AGP never calls back into the issuer and cannot infer proof or registration from a reference; only the trusted redeemer may invoke this capability after proof.\
The issuer adopts the node's successful recording event as redemption, not a separately sampled earlier check or later installation time.\
Expiry passing after `r` but before the prepared installation does not retroactively invalidate a successful redemption: it was authorized at `r`, and its remaining establishment allowance is still bounded by `R`.\
This relies on the serialized non-yielding transaction, not on an assumption that time stops during it.

Refusal and failure have explicit dispositions:

| Outcome | Recording and issuer disposition | Lifecycle and resource disposition |
|---|---|---|
| `authorization-expired` | At `r >= E`, no redemption reference or opening anchor is installed; discard the prepared uncommitted registration | Revoke this unrecorded use's publication authority and make it terminal; no retry with a later limit on that use |
| `expired` | A still-active acquisition bound has elapsed; no new recording is installed, even if issuer authorization would allow it | Terminalize the attempt and retain unfinished work until its existing release conditions |
| `invalid-authorization` or `invalid-redemption` | Clock mismatch, non-finite or malformed authorization, or an invalid reference cannot record a new use | An unrecorded attempt loses publication authority; correct the composition, not the same attempt's deadline |
| `inactive` | Source revocation, termination, finish, an unavailable coordinator or failed runtime grants no new recording | A terminal use stays terminal; reentrant refusal cannot mutate an in-progress commit or create a replacement permit |
| `already-recorded` | Keep the original reference, anchor and issuer obligation; do not treat the refusal as a fresh unspent key | No refresh, replacement or termination of an existing successful use solely because recording was repeated |
| `inactive` after clock/arithmetic/arming failure | No successful recording is returned; if a private fact was installed before arming failed, it remains historical and grants no publication | Revoke through the same coordinator before return; retain work and fail the composition as required, without manufacturing physical cleanup |
| Recorded result followed by exceptional issuer installation failure | Retain the lease and any genuinely spent or uncertain use; never restore the key to unused | Host composition invalidates publication through the existing control capability and disposes the attempt; no handoff may be published |

An acquisition expiry takes precedence over an authorization expiry at the same sample, retaining the existing local-deadline classification; neither result is an identity-provider denial.\
A refusal on an unrecorded attempt cannot spend a key on AGP's authority, and cannot undo a spend already made by the issuer.\
No successful-use registration is required for an ordinary pre-recording expiry refusal because that use has no publication authority; the issuer still applies its outstanding-key and activity rules.\
Discarding a prepared registration is not returning acquisition work capacity: `finishAdmissionAcquisition()` and actual settlement/disposal still govern that release.\
A duplicate invocation never erases an earlier record, even with different authorization data.

If issuer work settles after local termination, it may still retain an irreversible spent-use record against the same already-terminal handle, but recording refuses fresh authority.\
It cannot publish a new session or revive a released lease; the issuer checks its current allocation/generation while holding serialization through the recording turn.\
Its usable-key check and serialized redemption/reclamation rules remain essential even before a successful-use registration exists.

The alternatives explain the seam choice:

| Timing contract | Benefit | Cost and decision |
|---|---|---|
| Issuer-selected, clock-bound exclusive limit; recommended | One recording operation uses one sample for validity and the opening bound, with no issuer callback | The trusted issuer must supply a correctly derived limit; AGP validates and enforces it as data, not credential policy |
| Node-issued provisional time token, then issuer validation and a second commit | The issuer keeps the time comparison, and the node can authenticate its own token | Adds prepared/committed/abandoned states and another bounded capability protocol; not needed when this issuer's remaining time condition is one exclusive upper bound |
| Issuer-supplied redemption timestamp | The issuer can check validity at its chosen sample | Requires an additional event-provenance and freshness contract; an unchecked timestamp or remaining timeout is insufficient |
| Issuer validation callback inside node commit | Both decisions can see one sample | Violates the coordinator's callback/reentrancy boundary and couples policy execution to AGP's commit |

This proposal deliberately supports a policy stable under issuer serialization whose remaining time condition is an exclusive upper bound.\
A policy that cannot express its remaining time dependence that way needs a reviewed extension, not a callback hidden in this data object.

The identity-admission-redemption alternative remains in the earlier comparison, but cannot use this specific pre-redeemed handoff unchanged.\
Selecting it would require an explicit replacement attachment/credential-carriage contract; permitting an unredeemed handoff as a hidden fallback would defeat this proposal's construction guarantee.\
Neither alternative is selected by client type.

---

## 5. Deadline and resource boundaries

### 5.1 Shared clock and absolute bounds

The redemption-to-establishment deadline is distinct from credential expiry, AGP's existing OPEN timer and the admission-provider timeout.\
Credential expiry limits successful redemption; it does not terminate an established connection.\
The inherited opening bound covers all remaining proof/handshake completion, channel transfer, identity admission and confirmation, with no reset at a phase boundary.

The first supported composition shares the exact `ClockPort` object supplied in `AdmissionAcquisitionContext` between its redeemer, binding lifecycle and AGP runtime, as Zorg's in-process deployment permits.\
The factory supplies that clock to its redeemer or refuses a pre-existing redeemer configured with a different object; its returned port declares the same object, checked by the node.\
One audience may share one serialized redeemer across several acquisition sources only if all share this clock; no source is interchangeable with another.\
Clock identity is a composition check, not proof that an injected clock behaves correctly: the trusted clock must be finite, monotonic, bounded, synchronous and non-reentrant, and scheduled callbacks must not run inline.\
Clock failure revokes publication and fails the composition rather than falling back to wall time.

`recordAdmissionRedemption()` validates the issuer's clock-bound exclusive authorization limit and uses one sample for both that guard and the privately stored establishment bound.\
This replaces the earlier draft's refusal to carry any temporal input: the declared input is an issuer policy limit, not a caller-selected redemption timestamp, establishment duration or copied opening deadline.\
Sealing and adoption carry the same cell, not a copied remaining timeout.\
Do not compare unrelated `performance.now()` values, worker clocks, or values from different process lifetimes; a remote redeemer needs a separately designed contract.\
Restart creates a new node/source scope, while issuer generation refusal remains the issuer's independent obligation.

Required configuration is proposed under `NodeConfig.admissionUse`:
```ts
/** Configures finite local-redeemer limits; enabled compositions have no defaults. */
interface AdmissionUseConfig {
  readonly acquisitionTimeoutMs: number;
  readonly establishmentTimeoutMs: number;
  readonly maxPendingUses: number;
  readonly maxAcquisitionWork: number;
}
```

All four fields are required positive safe integers and resolve once at construction; zero, infinity and silent coercion are invalid.\
The new acquisition branch requires this configuration, and the legacy branch rejects it as an unsupported composition rather than ignoring it.\
The effective configuration exposes these data-only limits without handles or credentials.\
No numeric default is selected: a deployment must state its bounds explicitly, and the future operating-envelope work must justify them before a scale claim.

| Bound | Anchor and expiry | Ends |
|---|---|---|
| Acquisition bound | Successful reservation time plus `acquisitionTimeoutMs` | Exact controller adoption, not sealing or connect settlement |
| Redemption authorization limit | Issuer-selected `validBeforeMonotonicMs`, checked at the recording sample `r` | Successful redemption; never becomes an established-session expiry |
| Inherited opening bound | The same successful recording sample `r` plus `establishmentTimeoutMs` | Exact protocol establishment commit |
| Existing outbound connect bound | Existing node-owned dial invocation plus `transportConnectTimeoutMs` | Existing guarded outbound adoption |
| Existing OPEN/provider bounds | Their respective existing/proposed B53 anchors | Their existing guarded completion or terminal transition |

Before adoption, every still-active acquisition/opening bound applies; after adoption, the acquisition bound ends but the inherited opening bound does not.\
This prevents a pre-redemption stall from using the later deadline to extend its acquisition allowance, and a handoff stall from refreshing the establishment allowance.\
Non-finite clock samples or deadline arithmetic refuse the operation and revoke the attempt; long waits are scheduled in finite chunks, not narrowed into a timer integer that wraps.

Every publication guard checks `now < deadline`; equality is expired.\
The earlier active bound wins, independently of callback arrival order.\
An inherited bound uses the existing OPEN-expiry semantics after channel adoption and terminates the pending attempt before adoption; equal OPEN bounds have the same outcome.\
An equal admission-provider and opening bound retains the admission correction's OPEN precedence.\
An early timer wake rearms the positive remainder, and a stale wake has no authority.

Deadline arming is completed before a recorded redemption can return success or a sealed handoff can be published.\
Arming uses the remaining time to `R`, not a fresh full establishment allowance; later reads never replace the authoritative redemption sample.\
Timer/signal delivery requests re-evaluation; final guards remain authoritative if delivery is delayed.\
An acquisition expiry before adoption is a local acquisition deadline failure, not identity rejection; once adopted, an elapsed inherited bound uses OPEN expiry, including while admitted but not established.\
No bound promises that a blocked event loop or native cleanup completes at an exact wall-clock instant.

The inherited bound remains active through `admitted` until `established`.\
Routine successful credential rotation changes neither an established handle nor its immutable association.\
Live revocation or changing the admitted principal is a separate policy and control contract.

### 5.2 Capacity charged by lifetime

Let `P` be configured `maxPendingUses`, `W` be `maxAcquisitionWork`, and `S` be existing resolved `capacity.maxSessions`.\
These are node-wide across all sources, not per-listener allowances that multiply silently.\
Reserve pending-use and work capacity together before profile work starts; exhaustion of either refuses without reserving the other or creating a wait queue.

| Retention | Finite ceiling | Owner and release condition |
|---|---|---|
| Pending use, including sealed/queued handoff and unadmitted controller | `P` | Node acquisition/session owner; release on guarded identity commit or irreversible terminal invalidation |
| Admitted lifecycle cell | At most `S` live controllers | Node session owner until terminal detachment; admission transfers accounting without an uncharged interval |
| Acquisition work, result or offer retained after logical termination | `W`, shared with active acquisition work | Composition's finish receipt plus node-observed settlement/handoff disposition; terminal alone never returns the slot |
| Identity and route provider work/results | Separate B53 evaluation limits | Existing admission-work owner until settlement and disposal, not logical terminal or acquisition finish |
| Closing socket and native work | Carrier's declared pending, active and detached-cleanup limits | Carrier owner until its own resource-release observation, including after lease reclamation |
| Issuer use/lease references and terminal observations | Issuer's explicit finite tables | Issuer's serialized reclamation and compaction, not AGP controller removal or garbage-collection timing |

Pending controllers also consume existing `maxSessions`; admission cannot manufacture a controller slot from a pending-use reservation.\
At most `P + S` nonterminal lifecycle cells are producer-retained, with pending controllers counted conservatively in both bounds; handoff records are a subset of pending uses, not extra capacity.\
Work is charged to `W` from reservation, not moved into a newly checked pool only when it times out, so every started use already has room to remain retained.\
A conforming composition can still become unavailable when unfinished work fills `W`; it refuses new uses without evicting live sessions or pretending abort released resources.

The per-use cell retains only bounded identifiers, one association, fixed state and fixed control/attachment slots.\
There is no transition history, subscriber queue or node-owned terminal-use archive.\
Terminal detachment clears links to the controller, source, executor, clock, timer and channel; observation/control references thereafter retain only bounded terminal data and an inert close latch.\
Separate unfinished-work receipts may remain in their charged owner, but an observer must not keep that owner alive through a closure.\
Issuer-held memory is not attributed to AGP's runtime budget: Zorg must bound retained use records and may compact terminal facts only after incorporating the required identity/close activity in its serialized lease state.

Add proposed `pendingAdmissionUses` and `admissionAcquisitionWork` resource gauges with current, maximum and high-water meanings following the existing resource contract.\
The second includes active and terminal-but-retained work; neither is a heap-byte measurement or a native-resource count.\
Capacity refusal is local acquisition capacity, never a credential-policy denial; inbound profiles report the existing pending-acquisition capacity category, while configured outbound adjacencies use B53's one supervisor and coalesced level-check/wait rule.\
Actual slot release requests re-evaluation without minting a retry permit, resetting backoff or creating a second retry loop.\
The finite wait set is bounded by configured adjacencies; explicit issuer-refusal rearm remains separate B6 work.

---

## 6. Issuer reclamation and exact termination

Within the issuer's serialized reclaim decision, it checks all four conditions agreed with Zorg: no usable key, no pending use that can publish, no live admitted controller, and elapsed reconnect grace.\
The handle set is complete because registration accompanies every successful redemption, not because AGP enumerates all credentials.

For each registered use, only a valid terminal observation satisfies both lifecycle absence conditions.\
A pending, admitted, established or unknown observation retains the lease.\
The issuer checks its allocation generation and outstanding keys again in that same no-yield decision before releasing; issuance, renewal and redemption cannot interleave with it.\
If implementation needs to await any observation, it must reacquire the issuer's serialization and redo the whole decision, not release using the earlier checks.

Recommendation: use the issuer's first valid terminal observation as the conservative close-activity timestamp for its reconnect-grace calculation.\
This can extend retention by a sweep delay but cannot shorten the agreed grace after actual close.\
It avoids exporting another clock-sensitive timestamp solely for reclamation; tighter reclamation timing would require a separately specified authoritative timestamp mapping.\
Later issuance or renewal still advances activity, and no prior terminal handle may release a newer allocation.

The separate `AdmissionUseControl` is handed only to authorized host composition.\
`requestAdmissionTermination()` is idempotent, targets that handle's one incarnation and coalesces to at most one outstanding control intent.\
It synchronously revokes any still-available publication permit, so a queued owner turn cannot allow a later seal, adoption or identity commit; abort listeners and physical cleanup run outside the commit.\
Its return acknowledges a request, not terminal state or physical release; the consumer rereads the observation to establish completion.\
The intent follows an ownership transfer, and the current owner applies it through its guarded terminal path without replacing an earlier terminal cause.\
The binding controls its pending carrier; after handoff, AGP controls the session and invokes carrier cleanup through the normal transport contract.

The issuer decides whether a proved live-key reuse warrants that request under its existing policy.\
AGP does not inspect reuse events, decide key validity, close every session for a node or expose this capability to remote messages.\
Expired reuse remains issuer policy and does not gain new close authority from this draft.

---

## 7. Integration with admission repair and public packages

The lifecycle state change must be part of the same prepared commit as identity ownership and the `B51` association.\
No issuer callback, arbitrary property access, observer notification or abort handler runs inside that commit.\
On node stop/failure, revoke every attached publication permit and make its terminal fact authoritative as part of runtime detachment.\
Ordinary stopped instances retain B53's live cleanup accounting: actual settlement/disposal may update gauges and revisions without reopening session authority or event subscriptions.\
Only the numerical operational-domain terminal barrier freezes the final retained-resource values, revision and capture time together.\
Later private cleanup cannot turn that frozen capture into a fresh resource-release claim; logical termination in either case is not physical release.

### 7.1 One prepared commit owner

Reservation, redemption recording, custody disposition and controller transitions use the same node-owned runtime gate and prepared-commit coordinator.\
The synchronous public methods need a bounded, non-reentrant entry to that coordinator; they do not call issuer code from inside an executor turn or await that executor while the issuer holds serialization.\
Normalize caller/channel data before entering, preflight the full ledger/projection change, recheck current source/use/deadlines, then install only producer-owned values without yielding.\
An already-active commit cannot invoke external composition; a reentrant public call is refused rather than nested into it.\
These entry points are an explicit integration obligation of B53's coordinator, not permission for a second independently mutating work ledger.

Schedule/cancel operations and signal delivery are bounded post-commit effects.\
If required deadline arming fails before the public method returns, revoke the new permit through the same gate and return failure; no handoff is publishable in between.\
The issuer must use a trusted non-reentrant clock and perform its final prepared installation without further external calls, as section 4.4 requires.\
Neither side claims rollback after process failure or allocation failure.

Both ordinary transport and admission acquisition normalize into the existing controller-adoption path.\
The new branch additionally supplies a validated lifecycle attachment and inherited deadline, never an alternative FSM, identity directory, routing table or retry engine.\
Numerical-terminal replacement invalidates all sources, unconsumed offers and attached cells before the final resource capture; it cannot leave a live pre-controller use behind a frozen terminal snapshot.

### 7.2 Package and provider contracts

Recommended public placement and migration obligations:

| Owner | Proposed treatment |
|---|---|
| `@agp/core` | Public observation/value/control types, `RedeemedAdmissionContext`, identity evaluation options and schema-backed `AdmissionUseConfig`; no channel capability or carrier implementation import |
| `@agp/node` | Public acquisition factory/port, source, reservation, redemption authorization/result and sealed-handoff types; private implementation of cells, custody, provenance, work accounting and guarded commits |
| `@agp/transport` | Existing packet channel, listener and neutral data contracts unchanged; no redemption, authorization association or AGP deadline field |
| Carrier implementation | Proof/carrier mechanism and finite physical cleanup; receives declared callbacks/capabilities from host composition without interpreting AGP identity or importing node internals |
| Host's admission-acquisition composition | Implements the higher-level acquisition port, connecting the node-issued capabilities to its proof-capable binding and issuer through public contracts |
| Credential issuer and identity provider | Issuer owns credential/generation/lease policy; provider matches trusted redemption to OPEN and returns the B51 immutable authorization association |
| Management and ordinary delivery | Data-only effective configuration/resource gauges; no lifecycle-control endpoint, credential exposure or change to ordinary send semantics |

The neutral transport must not import AGP core/node, and the carrier must not interpret `PeerAuthorizationAssociation`.\
The higher-level composition imports public AGP and carrier contracts; AGP node never imports that concrete composition.\
No new package is required solely to hold these declarations, and no controller implementation is exposed to the host.\
The observation may be shared with the issuer without close authority; its redemption capability adds only the ability to record this one proved use under a supplied time limit.\
The authorization object is consumed synchronously, never retained as issuer-owned mutable state or passed to identity evaluation, channel evidence, wire data or management views.

Propose `IdentityAdmissionEvaluationOptions` extending B53's optional `AdmissionEvaluationOptions` with optional `redeemedAdmission: RedeemedAdmissionContext`.\
The identity port uses that options type; the route port keeps the shared signal-only options, and both retain compatibility with one-argument providers.\
The local-redeemer acquisition branch additionally requires the identity provider's explicit `supportsRedeemedAdmission: true` declaration, captured and checked at construction before work can start.\
Every identity evaluation in that branch receives the exact recorded context, and every accepted result must contain a valid B51 authenticated association; absence, `unauthenticated` mode or invalid association is rejected before identity commit.\
The provider still owns proving that issuer, principal, instance binding and claimed node correspond: the declaration is an explicit support contract, not a substitute for its validation or assurance.

The provider resolves the trusted issuer record by both `redemptionId` and the identical registered observation object, then checks the record's claims against OPEN.\
A matching string alone, an unregistered handle or a record from another issuer/allocation is insufficient; the returned association comes from that verified record.\
AGP validates the result's bounded shape and commits it with the exact use, but does not duplicate the issuer's credential database.

Keep secrets, clock/control capabilities and redemption attachments out of schema-backed requests and wire DTOs.\
Evaluation cancellation retains evaluation-only authority, distinct from the acquisition signal and session control.\
Current one-argument providers remain valid on the ordinary transport branch; they cannot silently opt into redeemed admission merely by ignoring the new options.

The extra acquisition API is a real compatibility cost, justified by its different ownership postcondition and by refusing unsupported use before redemption.\
It repeats the resolver/listen/connect outline but delegates channel semantics to the existing neutral contract and convergence to the single node adoption owner.\
An optional neutral-channel property would cost fewer declarations but could be discarded by older runtimes; a hidden channel side table would require an additional mandatory discovery contract to avoid the same failure.\
Neither alternative earns a second protocol path.

The ordinary neutral adapter cannot by itself implement this profile: a proof-capable binding must expose its own declared completion and cleanup seam to the host composition.\
Browser credential carriage, concrete proof hooks, client fresh-key acquisition and refusal/rearm still need their separate B6/B50 contract decisions.\
This proposal gives those components an acquisition/lifecycle boundary to implement, not a claim that an existing transport wrapper already supplies proof or that the current Node.js package is browser-portable.

---

## 8. Acceptance properties for later verification

These are defensive contract predicates for later verification, not runtime tests executed by this drafting step.

| Property | Required result |
|---|---|
| Continuous registration | Every successful redemption is already represented by exactly one issuer-held handle before it can publish a session |
| Identity commit fidelity | Pending becomes admitted only with the exact guarded identity/collision/association commit; callback allow alone changes no observation |
| Missed intermediate observations | A terminal read identifies whether identity and establishment committed even if the consumer never observed those states |
| Incarnation isolation | An old handle cannot become live again or observe/terminate a replacement using the same public session strings |
| Deadline conservation | Handoff, identity commit and confirmation never refresh the inherited redemption bound; all publication checks use the still-current absolute deadline |
| Single redemption instant | One final sample `r` satisfies the issuer's exclusive authorization limit and anchors `R`; preliminary issuer checks and later installation or timer setup never become a different anchor |
| Expiry refusal | At or after the authorized limit, an unrecorded attempt becomes terminal without a reference, opening anchor or publication permit; prepared registration is discarded without refunding unfinished work |
| Authorization ownership | Issuer derives a limit no later than actual expiry from the agreed clock/generation; AGP rejects clock mismatch or malformed values and executes no issuer callback to validate it |
| Post-sample expiry | Expiry after a successful `r` does not undo redemption or reset `R`; issuer registration still completes before any publication and remains serialized against reclamation |
| Terminal and late settlement | Revoked work cannot publish; irreversible redemption remains spent; provider and carrier reservations remain charged until their own release conditions |
| Reclamation serialization | A complete valid terminal set is necessary but not sufficient; usable keys, current allocation and grace are checked together with issuance/redemption/renewal excluded |
| Unknown observation | Observation failure never becomes absence and never causes live lease eviction |
| Exact close | One host request follows the same pending/admitted owner, preserves first cause and cannot act on a replacement or claim physical cleanup |
| Routine rotation | Expiry or a fresh admission key does not terminate or mutate an already-established association |
| Capacity conservation | Nonterminal cells and retained work stay within their separately declared limits; capacity refusal starts no unaccounted work |
| Scope restart | Old handles and credentials cannot attach to a new node/redeemer generation; no cross-process clock comparison is assumed |
| Compatibility | Existing providers compile; credential-enabled composition fails closed on missing support; both acquisition directions carry the same declared ownership contract |
| Carrier parity | The same observation, deadline and termination rules apply to native and browser profiles; physical resource guarantees remain profile-specific and unclaimed until verified |
| Unsupported composition | An old node, absent provider declaration, wrong clock, missing required configuration or both acquisition branches results in no active source and no proof/redemption work |
| Source binding | A handoff belongs to one node generation and one listener/dial source; replay, cross-source presentation and a second channel under one use produce no controller |
| Pre-controller custody | Callback return and outbound successful settlement identify the cleanup owner even before controller adoption; every delivered/undelivered offer remains charged |
| Registration failure | A failed issuer installation after recording cannot publish an unregistered use, undo a spent key or authorize a new redemption |
| Finite retention | Filling pending capacity or retaining unfinished work refuses new work without live eviction; terminal observations retain no node/controller/channel graph |
| Clock and timer setup | Independent clocks, non-finite samples/arithmetic and failed arming grant no handoff; delayed wakes cannot extend an absolute bound |
| Authentication role | A remote key presenter never fabricates local redemption; dial versus accept and CLI versus browser do not select different redemption semantics |
| Coordinator integration | Every new ledger/state change is preflighted before installation; numeric terminal replacement grants no source, redemption or adoption permit |
| Stop accounting | Ordinary-stop cleanup can advance resource gauges and revisions; a numerical-terminal capture stays frozen, and neither terminal observation nor cancellation proves physical release |

---

## 9. Remaining decisions and handoff

The near-term choice is whether to use this per-use query handle as the joint lifecycle observation contract.\
Recommendation: advance it for review, including the conservative observed-close grace rule; keep the complete-snapshot alternative visible with its inventory cost.

The factory, local-redeemer attachment across both acquisition directions, package placement, shared-clock checks and finite configuration remain concrete proposals.\
The timing amendment supplies the missing authorization limit and one-sample rule; the prior independent FAIL remains the verdict for its original input, not a verdict on this revision.

Before this can be a build-ready design:

1. Independently re-review this amended contract, explicitly reassessing the original timing blocker and stop-accounting clarification, the trusted limit's clock provenance, refusal dispositions and the retained custody/resource guardrails.
2. Ask Zorg to assess its issuer transaction and clock-bound authorization fit, observation/terminal-history shape, conservative observed-close grace, identifier bounds and explicit configuration; provide this proposal for fit review, not an instruction to implement provisional methods.
3. Resolve material findings, complete scoped axiom and required documentation assurance, then seek AGP ratification and explicit implementation selection; a positive consumer fit response is not an implementation gate by itself.
4. Implement with the admission repair's guarded commit and the direct-peer association; verify the producer before consumer migration and production lease reclamation acceptance.

Separate follow-on design still owes concrete proof/carriage integration, client fresh-key-per-dial and explicit refusal/rearm, plus browser and scale acceptance.\
Their absence does not make Zorg's two lifecycle requirements unanswered, but it prevents describing this slice as complete authenticated-browser support or closure of B6.

This is not a request for Zorg to repeat its settled requirements or build against provisional methods.\
No new outbound note is sent by this drafting step.\
The original admission and direct-peer assurance gates remain separate; neither blocks preparing this proposal nor closes through it.

The [ratified axiom applicability map](axioms.md) remains unchanged.\
Review must make A3 load-bearing at the issuer/binding/node boundaries, A4 load-bearing for exact state meanings and retained agreements, and A8 load-bearing for the distinction between this proposal and verified capability.\
A9 and A14 apply only within AGP's already-declared verification and finding-lifecycle subsets; this author mapping is not an independent verdict.

---

## 10. Mechanics rationale and consequence

### Mechanics

One bounded, non-reassignable observation follows one redemption attempt through an explicit sealed channel handoff into at most one admitted controller.\
The issuer supplies its exclusive authorization limit on the agreed clock; one node sample checks that limit and anchors the unchanged establishment allowance.\
The producer commits lifecycle facts with runtime authority, while the issuer serializes registration and its complete lease-release predicate and the carrier accounts for physical cleanup separately.

### Rationale

Zorg's contract already assigns finite use accounting to the issuer, which needs exact facts about those uses rather than a second credential database or a widened management authority.\
A stable handle preserves continuity across the handoff and permits sweep-based consumption without an event-delivery guarantee.\
A declarative time limit lets the issuer own policy while AGP enforces both temporal obligations at one event, without a policy callback or a provisional-token transaction.

### Consequence

Returning terminal before publication is irrevocably disabled could release a still-usable lease.\
Retaining a raw controller behind a terminal handle could instead make correct logical reclamation hide unbounded runtime retention.\
Checking validity before the actual redemption sample could admit an expired key; resampling the opening anchor could extend the agreed bound.\
The corrected timing seam and honest resource accounting both need independent review before this proposal can advance.
