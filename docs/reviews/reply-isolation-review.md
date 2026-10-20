# Reply isolation proposal review

Status: advisory review for `B51`; revise the proposal before implementation approval.\
Tier 3 analysis by the AGP session, 2026-10-17; consumer requirements and source observations are labelled separately.\
Recommendation: accommodate optional direct-peer egress, retain the requesting node and proved principal across reconnects, and separate relayed delivery from this guarantee.

Zorg has identified a real composition gap: selecting the right endpoint instance does not ensure that reply bytes travel only over that instance's channel.\
The requirement belongs at AGP's send boundary, but the proposed option needs a precise identity association and admission point.\
Ordinary destination pinning stays unchanged; sign-in, credential issuance and application permissions stay with their existing owners.

This review changes no public contract and closes no runtime acceptance item.\
It is not an independent implementation, axiom-alignment or fresh-reader assurance verdict.

---

## Inputs and provenance

The [source manifest](reply-isolation-sources.json) records file hashes, committed-blob matches and the two uncommitted prior AGP review inputs.

| Input | Checkpoint | Use |
|---|---|---|
| AGP | `0aa6be75ccacf4e2c3770a49c5ea39970a25a98a` | Current source, public contracts, tests and ratified routing decisions |
| Zorg | `20d0d0a7dd08b417989bda48cfd0c18d0c5a0136` | [Current proposal](../../../zorg/upstream/agp-review-response-reply.md), [D51](../../../zorg/docs/DECISIONS.md#d51---a-reply-belongs-to-the-node-that-made-the-request), earlier requirements |
| Operation-call | `fe48a511826f26e3532ea8aa6007b23ba661d80e` | Actual reply construction and failure fallback |
| Caller-identity | `16a1c39f95f719b6123066d5f1a3fd99cfa590e5` | Request evidence, principal mapping and retained session records |
| Credential-issuer | `ff4d9ff5378f47000532c51acdfdf11cd7fc903d` | Proposed credential-to-principal/hub/node association, not an implementation |
| Destination-selection history | `e427b6d7b04e9be9b4565d8abc55653e9ceb806b` | Why early refusal was rejected for ordinary pins |

The review compares the existing baseline, the original [AGP response](zorg-review-response.md) and consumer intent, the routing change's history, and the external authentication constraints below.\
AGP's code, tests and design share provenance; Zorg and its components share consumer intent.\
These are complementary inputs, not independent runtime observations or four independent reviewers.\
Zorg's checkout advanced during inspection, but the three reviewed Zorg files are unchanged between the initial and captured heads.

---

## Consumer requirements

Tier 1: these are Zorg's declared requirements, not capabilities AGP currently guarantees.

| Concern | Requirement and source |
|---|---|
| Reply owner | The requesting node and the same proved principal; a replacement connection is allowed, another node with the same principal is not: D51 and the proposal's section 1 |
| Absence | No eligible direct channel means refusal before transfer; the call layer ends at its own bound: D51 |
| Relay scope | D51 and the proposal forbid another peer's or relay's channel, but their preferred-mechanism wording also permits trusted relays; both statements remain in the source |
| Opt-in behavior | One sender-selected constraint per message; ordinary D26 forwarding remains available: proposal section 1 |
| Lifetime | An established connection can outlive its admission credential; logout/revocation affect new admission under the current policy: [requirements section 4](../../../zorg/upstream/agp-requirements-response.md#4-identity) |
| Current security claim | Trusted-development node identity is asserted, not proved, and Zorg has withdrawn peer-confidentiality claims for Delta 1: proposal section 1 |

---

## Source observations

Tier 2: these statements come from the captured source and records; no runtime reproduction was executed.

| Observation | Source |
|---|---|
| An unresolved pin can use the selected route; the final local-delivery check refuses a different instance | [D26](../DECISIONS.md#d26---destination-selection), [forwarding resolver](../../packages/node/src/data-plane.ts), lines 281-332; [selector contract tests](../../packages/node/test/contract/destination-selector.test.js), including the absent-instance and multi-hop cases |
| The transit-off check applies to session arrivals, not locally originated sends | [Forwarding resolver](../../packages/node/src/data-plane.ts), lines 354-357 |
| Admission receives the exact channel evidence and both session identities; its public result carries allow or deny, not a retained application-principal association | [Identity admission](../../packages/node/src/session-controller.ts), lines 639-655; [public types](../../packages/core/src/types.ts), lines 862-879; [evidence contract test](../../packages/node/test/contract/identity-peer-evidence.test.js) |
| Delivery context carries source and ingress identifiers; send policy carries correlation, timeout and destination selector, with no principal/egress constraint | [Public types](../../packages/core/src/types.ts), lines 776-805; [send-policy schema](../../packages/core/src/schemas/v1/sdk/send-policy.schema.json) |
| Transport evidence is immutable and distinguishes protection from authentication; binding a transport principal to an AGP node is deployment policy | [Evidence schema](../../packages/transport/src/schemas/v1/contracts/transport-peer-evidence.schema.json); [transport decision](../DECISIONS.md), lines 463-484 |
| Route resolution and queue admission run in the node executor; the selected writer owns one channel, including while waiting for credit | [Data-plane admission](../../packages/node/src/data-plane.ts), lines 199-207 and 430-520; [session writer](../../packages/node/src/session-writer.ts), lines 63-66 and 258-297 |
| Cancellation authority ends at admission; reverse disposition bindings use exact controller identity, not replacement-session routing | [Send admission](../../packages/node/src/send-admission.ts), lines 37-52; [controller contract](../../packages/node/src/controller.ts), lines 8-17; [label table](../../packages/node/src/label-table.ts), lines 173-219; [exact-identity test](../../packages/node/test/contract/label-binding-exact-identity.test.js) |
| Operation-call pins every reply and its failed-end fallback to the request origin; the send closure does not use the operation's evidence value | [Operation-call host](../../../operation-call/src/host.ts), lines 163-211 |
| Caller-identity returns a frozen request record only from matching direct ingress, but its session table is replaceable and eventually forgotten; derived names are not automatically proved principals | [Caller-identity implementation](../../../caller-identity/src/caller-identity.ts), lines 142-184 and 342-363; [session records](../../../caller-identity/src/session-records.ts), lines 35-86; [CI2-CI4](../../../caller-identity/CONTRACT.md) |

External constraints provide a separate check on the identity reasoning.\
TLS distinguishes peer identity from the fresh session keys produced by each handshake; equal application identity need not mean equal keys or sessions.\
See [RFC 8446 Appendix E.1](https://www.rfc-editor.org/rfc/rfc8446.html#appendix-E.1).\
Channel-binding guidance distinguishes an authenticated application principal from the protected channel and cautions against carrying authentication assumptions across a replacement channel without the required binding.\
See [RFC 5056 section 2.1](https://www.rfc-editor.org/rfc/rfc5056.html#section-2.1) and [section 8.1](https://www.rfc-editor.org/rfc/rfc5056.html#section-8.1).\
These references support the separation of duties, not a requirement to implement an RFC 5056 mechanism or a claim that AGP is conformant to one.

---

## Assessment and required adjustments

Tier 3: the following are recommendations derived from those inputs.

### Direct peers and relays are different contracts

Recommend direct-peer-only for this requirement: the allowed AGP next hop is the requesting node itself.\
The same caller instance may reconnect; an AGP relay is a different peer and therefore cannot carry this direct-only reply.\
Ask Zorg to reconcile the conflicting clause in its own D51 and proposal before either project adopts the contract.

A TLS terminator is not necessarily an AGP relay.\
If it carries one AGP channel, its protection and trustworthy evidence belong to the carrier profile and the existing trusted-terminator question, including the protected backend leg.\
An application proxy or shared worker that made the request is the requesting node, not an intermediate AGP relay.\
Do not use one word to authorize all three cases.

Trusted AGP relays would require a separate agreement about who may read bytes, how downstream forwarding remains constrained, and what proves the original principal across hops.\
Authenticating only the first relay proves none of those downstream properties.\
Keep this expansion tied to Zorg's existing relayed-identity candidate, not silently included in the direct-peer option.

### Node identity needs an admission guarantee

Checking only a `NodeId` is sufficient for same-principal continuity only if admission guarantees that this node instance cannot be rebound to another principal for the lifetime of its outstanding work.\
Neither AGP's allow/deny result nor a credential binding one issuance to a node establishes that cross-issuance invariant by itself.\
A printable name, matching principal string or current credential selector must not become proof by implication.

Two compositions remain possible:

| Composition | Obligation and cost |
|---|---|
| Existing admission owns an immutable node-to-principal binding | AGP enforces direct egress to the pinned node; the admission owner must prove the binding survives reconnects, key rotation and identifier reuse without changing principal; this avoids introducing application principal semantics into AGP |
| Admission supplies an explicit immutable authorization association | The original request retains that association and send admission compares it with the candidate channel's association; its namespace, lifetime and comparison rules become a shared public contract |

The first is valid only with the stated invariant, not merely the naming convention.\
For a reusable guarantee across policies that cannot establish it, the second is the stronger candidate.\
Agree this boundary with caller-identity and the credential owner before choosing types; this review does not select a new principal registry, callback API or authentication protocol.

In either composition, the request's original authority is captured while its exact ingress evidence is available, and remains a bounded value for that request.\
For this direct-peer policy, the request origin must match that authenticated ingress; a relayed source does not inherit its relay's principal.\
Looking up whichever principal currently owns the node when the reply completes can change the authority being checked.\
Retaining the old controller or an unbounded session-history table is not required to retain that value.\
A raw credential, credential generation or TLS session key is not a stable principal identifier.\
Unproved or absent evidence cannot satisfy the authenticated guarantee, including on an encrypted channel.

Principal equality is interpreted within the admission authority's namespace, not inferred from a verification-method string.\
Different credential profiles may establish the same principal, and equal names under different authorities need not do so.\
The confidentiality claim also requires an approved protected carrier; the egress restriction neither adds encryption nor certifies a TLS terminator.\
Preserve the agreed admission-only credential lifetime: fresh admission proves a replacement, while expiry of the original credential does not itself invalidate an established channel.

### Enforce at admission and preserve writer ownership

The shared data-plane admission path is the appropriate enforcement site: validate the destination constraint, eligible route, exact live controller and required authorization together before admitting the packet to its writer.\
Keep source ownership/export checks, size limits, capacity, cancellation and deterministic selection in force.\
A management snapshot followed by ordinary send has a race and cannot provide this guarantee.

Select an eligible replacement only before the send commits.\
Once admitted, the packet belongs to the chosen controller's writer; do not migrate or replay it after route changes or reconnection.\
That distinction preserves AGP's existing admission and uncertainty contract while satisfying Zorg's permission to use a replacement when the reply is sent.\
It does not promise that a queued reply survives a connection failure.

No eligible direct route means refusal at admission, not waiting for a future connection.\
A direct connection without the required endpoint route or source-export authorization is insufficient.\
A local endpoint shortcut or a route through another peer cannot satisfy an explicitly requested direct-peer constraint.\
The contract must define typed refusal and option compatibility, with no downgrade to an ordinary send when the restriction is unsupported or unsatisfied.

The authorization association must be immutable while an admitted packet waits in the writer.\
If a later design permits in-place authorization changes, it must separately define revocation of queued work; the present credential-TTL policy does not require that expansion.

### Preserve generic routing and separate replies from dispositions

Treat the option as an additional eligibility restriction on a named destination, not a selected intermediate hop, an arbitrary path or a bypass around the routing table.\
This is a proposed fit with the [vision](../../VISION.md), not permission to redefine its traffic-engineering boundary.\
Record that scope judgement with the eventual decision; a trusted-relay list would require a separate scope assessment.

The direct-only check can be enforced locally by the sending node without placing a principal or new routing rule on the wire.\
That is a design inference for the proposed direct-only mode, not an assertion that the public API is already sufficient.\
Keep ordinary `any`, `preferred` and `pinned` behavior, including selected-route fallback and multi-hop pin propagation, unchanged.

An operation reply is a new application message.\
AGP delivery dispositions are protocol messages returning over exact retained controller bindings.\
Do not relax those bindings to implement replacement-connection replies.

### Consumer integration is part of completion

Operation-call must carry the restriction on every reply path: answers, refusals, description replies, operation failures and the failed-end fallback after a send refusal.\
Changing AGP alone would leave the current send closure unconstrained.\
The existing evidence value is plain data given to the operation; it is not presently an egress authority.\
Any new capability-bearing reference must not be routed through that plain-JSON evidence channel by accident.

An error reply still contains application information and must keep the same restriction.\
An inability to authenticate the reply owner must not produce an unrestricted fallback.\
Operation-call continues to own correlation, call deadlines and interpretation of unknown delivery; AGP gains no request/reply registry.

---

## Disposition of the proposal

| Part | Recommendation | Reason |
|---|---|---|
| Same node and proved principal across replacement sessions | Accept as a requirement | Matches where the pending call lives; replacement still needs fresh admission |
| Optional per-message exact-peer egress | Accommodate with adjustments | Enforce an explicit direct-peer and identity contract in the common admission path |
| Trusted AGP relays in that same option | Do not include in the initial contract | Conflicts with the direct-only requirement and adds downstream trust obligations |
| Permanent binding to the original session | Reject for this requirement | Contradicts Zorg's chosen replacement behavior |
| Global early refusal for unresolved pins | Reject | Breaks D26's demonstrated multi-hop use |
| Unique entitled reply names | Retain as an alternative | Can support a different naming/entitlement design, but still needs identity guarantees and carries the consumer cost Zorg declined |
| General principal-based advertise/discover/send engine | Not justified by this review | Existing admission and application operation policy remain separate; this result covers reply egress, not every permission or server-push question |

---

## Acceptance properties for the agreed design

These are observable obligations for later validation, not executed tests or an implementation recipe.\
The decisive egress observation is whether reply bytes were admitted to a disallowed channel; handler rejection alone is insufficient.

| Property | Required result |
|---|---|
| Original direct peer remains eligible | The send admits to that peer under the captured authority and ordinary route/source/capacity rules |
| Same node and principal reconnect before admission | A newly admitted replacement may carry the reply; equality of old session or credential identifiers is not required |
| Principal, node instance or proof does not match | No reply bytes enter a channel outside the captured authorization; another node with the same principal is still ineligible |
| Request provenance or carrier protection is insufficient | No direct authenticated authority is inferred from a relay, asserted identity or encryption alone; confidentiality requires the agreed protection profile |
| Endpoint route is absent, withdrawn or indirect | Refuse before transfer; no fallback to another advertiser or relay and no connection-wait queue |
| Routing or session ownership changes before admission | Admission decides against one coherent current state, with no separate precheck granting authority |
| Connection changes after admission | No packet migration or replay; existing delivery-certainty semantics remain truthful |
| Original session evidence is removed | The request's captured authority does not change; resources remain bounded and old controllers are not retained solely for late replies |
| All operation-call reply branches | The same restriction survives error and refusal fallbacks; failure to obtain authority never weakens the send |
| Ordinary sends and protocol dispositions | Existing multi-hop destination selection, source-export ordering, cancellation, exact-controller disposition isolation and local delivery remain unchanged |
| Unsupported or conflicting option combinations | A defined refusal occurs without silently selecting an unconstrained send; compile-time and runtime surfaces agree |
| CLI and browser composition | The same AGP contract applies to both; each protected carrier establishes the evidence it claims, and trusted-development success is not authenticated acceptance |

---

## Ownership and next decision

| Owner | Next contribution |
|---|---|
| AGP and Zorg | Confirm direct-only scope and reconcile D51's trusted-relay clause; agree whether the intended invariant or an explicit association supplies principal continuity |
| AGP | Specify the public send/evidence boundary, admission point, refusal semantics, bounded retention and compatibility; obtain design/axiom review before implementation |
| Caller-identity and credential owner | State what proves and namespaces the stable principal-to-node association across fresh credentials and replacement channels |
| Operation-call | Adopt the agreed restriction on every reply branch and supply consumer acceptance at named revisions |
| Carrier owners | Supply profile-specific protection and identity evidence; browser coverage remains in `B50` and credential association in `B6` |

`B51` stays open: this review narrows its next action, not its acceptance claim.\
Contract work can proceed independently of `B53`'s evaluation dependency, while shared admission/controller changes require coordination with that repair.\
Authenticated Zorg acceptance still needs the agreed credential association and browser carrier evidence; the earlier `B48` consumer acceptance does not establish these properties.\
The admission repair and disposition-write acceptance remain open on their own terms.

Recommended communication to Zorg: agree the direct-only interpretation first, then jointly specify the identity association and atomic send boundary before proposing a production patch.\
No downstream file has been written or message sent by this review.

---

## Mechanics rationale and consequence

### Mechanics

An opt-in restriction composes endpoint routing with an authenticated direct-peer eligibility check at send admission.\
Admission policy owns the meaning of identity, the runtime owns atomic enforcement and writer ownership, and the consumer owns reply construction and pending-call state.

### Rationale

Zorg needs private replies without separate browser and CLI semantics or a change to ordinary multi-hop routing.\
The existing shared admission path and exact-controller writer give the mechanism a defined home; the missing identity association must be explicit rather than reconstructed from current state.

### Consequence

Conflating a destination pin with channel authorization can expose bytes despite correct endpoint refusal.\
Conflating principal continuity with session or key equality rejects legitimate reconnects, while conflating it with a node-name match assumes an unproved admission invariant.\
Including relays without a separate trust contract changes the guarantee rather than generalizing it.
