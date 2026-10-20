# AGP reply isolation response to Zorg

Status: draft for Zorg's review; public types and implementation remain unapproved.\
From: AGP, answering `zorg/upstream/agp-review-response-reply.md`, section 1, and Zorg's `D51`.\
Source checkpoint: AGP `0aa6be75ccacf4e2c3770a49c5ea39970a25a98a`; Zorg `53923cbee49dc16f1ab16fb0af6a2182a4ae26bb`.\
Full analysis and source evidence: AGP `docs/reviews/reply-isolation-review.md` and `docs/reviews/reply-isolation-sources.json`.

We recommend accommodating the requirement with an optional direct-peer-only send restriction in AGP's common CLI/browser path.\
We carry forward your decision that a reply belongs to the requesting node and its proved principal, not its original connection.\
Two points need agreement before public types: whether AGP relays are excluded, and which admission guarantee establishes principal continuity.

---

## Direct peers and relays

Your proposal and `D51` say that no other peer's or relay's channel may carry the reply, but also permit trusted relays in the preferred mechanism.\
Those are different guarantees.\
Our recommendation is direct-only for this work; please reconcile that clause in Zorg's own decision process.

An AGP relay is another peer forwarding the message.\
A TLS terminator carrying one AGP channel is a carrier-profile concern, including protection of the backend leg; it is not automatically an AGP relay.\
A proxy or shared worker that originated the request is the requesting node itself.

End-to-end identity through AGP relays remains a separate candidate.\
Revisit it when its owners specify which relays may read bytes and how authorization survives every hop; authenticating the first relay is insufficient.

---

## Mechanics

The proposed restriction would require:

- The destination is the requesting node instance, under the authority captured from its authenticated direct ingress; another node with the same principal is not eligible.
- A replacement connection may be selected before send admission if it proves that same node and principal and satisfies the agreed protected-carrier profile.
- Destination eligibility, the exact live channel, authorization and writer admission are checked together; ordinary endpoint-route, source-export and capacity rules still apply.
- No eligible direct route means refusal before transfer, not fallback through another peer, a local shortcut or waiting for a future connection.
- After admission, the chosen writer owns the packet; reconnecting does not migrate or replay it.
- Missing proof or an unsupported restriction never downgrades to an unrestricted send.

Ordinary destination pins retain `D26` behavior, including multi-hop forwarding.\
Protocol delivery dispositions retain their exact-controller return bindings; an application reply is a new message, not a disposition.\
Credential TTL continues to bound fresh admission, not the lifetime of an established channel.

---

## Principal continuity

A node ID alone suffices only if admission prevents that instance from changing principal for the lifetime of its outstanding work.\
Binding one credential issuance to a principal and node does not, by itself, establish that guarantee across later issuances.

| Composition | Required guarantee |
|---|---|
| Admission owns a stable node-to-principal binding | The same instance cannot be admitted under another principal across reconnects or fresh credentials while its work remains outstanding; restart and identifier reuse rules must preserve this without unbounded history |
| Admission supplies an immutable authorization association | The request retains that association and send admission compares it with the candidate channel's association; namespace, equality, ownership and bounded retention become an explicit shared contract |

We prefer keeping identity meaning with the admission and credential owners.\
Use the existing binding only if those owners can establish its invariant; otherwise the explicit association is the stronger candidate, without making AGP an issuer or application-permissions engine.\
A credential selector, session key or matching name is not that association by implication.

Please have caller-identity and credential-issuer identify the supported composition and its contract.\
State what authenticates and namespaces the principal, what binds it to the node instance across credentials, and what happens on restart, identifier reuse and removal of old session records.\
The original request's authority must not be reconstructed from whichever principal owns the node when the reply completes.

---

## Consumer integration and next reply

Operation-call must retain the restriction on every reply branch, including refusals, descriptions, failures and its failed-end fallback.\
Its current destination pin is insufficient; the plain-JSON evidence value is not automatically a capability-bearing send authority.\
An inability to obtain authority must never trigger an unrestricted error reply.

Please respond with:

1. Agreement or a concrete objection to the direct-only scope, resolving the trusted-relay clause.
2. The principal-continuity guarantee the identity and credential owners can provide, with named contracts and revisions or the missing capability.
3. Confirmation that operation-call will carry the agreed restriction through every reply branch and provide consumer acceptance against the resulting AGP revision.

AGP then owns the public send/evidence contract, refusal behavior and shared admission enforcement.\
After contract and design review, agree implementation ownership and consumer validation; a production PR is premature now.\
The admission-lifetime repair and browser-carrier acceptance remain separate dependencies, not capabilities this exchange closes.

---

## Rationale and consequence

A destination pin prevents the wrong endpoint instance from serving a message; it does not guarantee which peer's channel carries its bytes.\
Enforcing the stronger restriction at send admission preserves ordinary routing while preventing a later handler refusal from being mistaken for private delivery.\
Keeping principal continuity separate from connection identity permits legitimate reconnects without relying on an unproved node-name match.

This draft follows Zorg's incoming-correspondence process.\
Placement in `upstream/incoming/` is not acknowledgment, acceptance or ratification; Zorg owns any received copy and its response.
