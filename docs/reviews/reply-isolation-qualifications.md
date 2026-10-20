# AGP reply isolation contract qualifications

Status: follow-up draft for Zorg's review; final AGP types and implementation remain unapproved.\
From: AGP, answering Zorg's `upstream/agp-reply-isolation-reply.md` and `D59`.\
Read against: Zorg `487044caae81c7adb03c8176380c372af6839700`; the revised `caller-identity`, `credential-issuer` and `operation-call` contract references were checked.

Your reply resolves the relay question, selects the immutable admission association, and commits every operation-call reply branch to the restriction.\
We support that direction: capture the request's authority once, then compare it at send admission without consulting mutable session history.\
Three details still need agreement before this becomes an implementable shared contract.

---

## Explicit unauthenticated operation

An authenticated reply restriction must require a valid, proved request association and an equal association on the candidate direct session.\
A missing, malformed or failed authentication result must not select a weaker mode.

Direct-only operation without principal continuity can remain available for an explicitly selected unauthenticated profile, including trusted development.\
A `null` association records that absence of proof; it is not, by itself, permission to weaken an authenticated request.\
Neither mode permits an unrestricted fallback or delivery through an AGP relay.

Please identify where the application selects the unauthenticated mode and how `caller-identity` and `operation-call` distinguish it from an authentication failure.\
This qualification concerns the new restriction; it does not silently change ordinary sends or existing admission defaults.

---

## Authority namespaces

The association's `issuer` must identify a trusted identity namespace, not merely the fact that transport evidence supplied the principal.\
AGP currently reports verified principals for both TLS PSK possession and same-process capabilities; those facts do not establish a shared identity authority.

The literal `"agp-transport"` is sufficient only where deployment policy explicitly establishes one authority for every principal mapped into that namespace.\
Adding a proof-method label alone would also be insufficient to distinguish independent authorities using the same method.\
Conversely, browser and CLI proofs may map to one association when trusted admission policy establishes that they represent the same principal under the same authority.

Please specify the canonical namespace, its trusted source, and who owns any mapping between proof mechanisms.\
AGP should validate and preserve the association and compare it exactly, without inventing equivalence or interpreting issuer policy.\
Carrier protection remains a separate requirement; association equality does not establish confidentiality.

---

## Authority to reuse a node identity

Binding a key to a node name checks that the connection presents that name; it does not establish who may obtain a fresh key for an already used name.\
Random instance tags distinguish cooperating instances, and a fresh hub generation rejects old keys, but neither rule alone authorizes a new credential for the previous instance's identity.

The outstanding question is whether another process holding the same principal may obtain a new credential for an existing `nodeId`.\
If it may, equal `nodeId`, `issuer` and `principal` establish the same authorized name and principal, not continuity of the original proxy or worker instance.

Please have the credential and admission owners specify the rule that authorizes reuse of a node identity across reconnects, including restart and identifier reuse, without relying on the swept session table.\
Our recommendation is to preserve the instance-isolation requirement in `D59` and make that ownership rule explicit.\
If the intended guarantee is instead only name-and-principal continuity, state that narrower guarantee for agreement rather than claiming original-instance isolation.

This does not ask AGP to become an issuer or add a new cryptographic mechanism.\
It asks the identity owners to state the authority behind the value AGP compares.

---

## Ownership and next response

The shared boundary remains:

- Credential and admission components own proof, authority namespaces, and permission to claim or reuse the node identity.
- AGP owns validated immutable request capture and atomic checks of the direct destination, live session association and writer admission, in one CLI/browser mechanism.
- `operation-call` derives the restriction from AGP delivery context and carries it through answers, refusals, descriptions, failures and fallback endings, never from handler-supplied JSON evidence.

Ordinary destination pins retain `D26` behavior.\
Existing route, export and capacity rules still apply; no eligible direct session means refusal before transfer, and a packet already admitted to a writer is not migrated or replayed.\
Admission-lifetime repair, credential lifecycle and browser-carrier acceptance remain separate open work.

Please reply to the three qualifications with the owning contract clauses, or identify the capability still missing.\
AGP can prepare the shared contract draft while those answers are resolved; final types and enforcement still need the agreed semantics and design review.\
The consumer contract additions record intended adoption, not an implemented or jointly finalized AGP API.

Placement in `upstream/incoming/` follows Zorg's draft process and is not acknowledgment or ratification.

---

## Source anchors

| Question | Source |
|---|---|
| Agreed direction and remaining claims | Zorg's `upstream/agp-reply-isolation-reply.md`, sections 1 to 3, and `docs/DECISIONS.md`, `D59` |
| Proof and proposed transport namespace | `caller-identity/CONTRACT.md`, `CI2` and `CI4` |
| Issuance, node binding and restart generation | `credential-issuer/CONTRACT.md`, `admission-key-issue`, `single-use-admission` and Design owed |
| Existing transport boundary | AGP's `docs/DECISIONS.md`, `D18`; `packages/transport-node-ws/src/security.ts`, `presharedKeyEvidence`; `packages/transport-loopback/src/fabric.ts`, `peerEvidence` |
| Current integration and missing AGP surface | `operation-call/src/host.ts`, `reply`; AGP's `packages/core/src/types.ts`, `EndpointDeliveryContext`, `IdentityAdmissionResult` and `SendPolicy` |
