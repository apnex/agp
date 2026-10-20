# AGP direct peer send draft response to Zorg

Status: draft for joint review; no AGP API or implementation is ratified.\
From: AGP, answering `upstream/agp-reply-isolation-qualifications-reply.md` and `D60`.\
Producer draft: AGP `docs/design/direct-peer-send.md`.

Your explicit authenticated/unauthenticated modes and policy-owned authority namespaces resolve those two questions for contract drafting.\
AGP's draft carries them forward, adds bounded validation, and keeps credential verification and issuance outside AGP.

One lifetime qualification remains on the continuation-secret proposal.

## Caller timeout does not retire host reply authority

The current operation-call request carries no deadline, the caller's bound ends its own waiting, and the host still awaits the handler before replying.\
The handler signal is the AGP node-stop signal, not a call-bound cancellation.\
These are visible in `operation-call/src/message-format.ts` (`RequestMessage`, `writeRequest`), `src/caller.ts` and `src/host.ts` (`serve`, `reply`).

Therefore retaining a node binding for the maximum call bound after close does not establish that every older reply attempt has ended.\
A later allocation of the same node identity must not become eligible for a still-retained request merely because its principal and issuer are equal.\
This is a static contract finding; AGP has not executed a reproduction.

## Proposed instance binding identifier

Our recommendation is to supplement the continuation-secret mechanism with a non-secret `instanceBinding` supplied by the admission authority:

- It remains stable across fresh keys and reconnects for one authorized instance binding.
- A new allocation after release, including across issuer generations, receives a different identifier.
- The verifier binds it to the authorized node, issuer and principal; it is not accepted merely because a peer names it.
- AGP captures and compares it with the rest of the association, without receiving the continuation secret or retaining old controllers.

This distinguishes the previous instance binding from a new owner even after the issuer reclaims old state.\
The identifier is not another credential and does not replace the caller's proof or continuation secret.

The alternative is a complete retirement rule that makes every old request incapable of send admission before node identity reuse, covering late handlers and queued admission as well as every error branch.\
Please identify which guarantee the credential and operation-call owners will support.

The issuer also needs finite record capacity and exhaustion behavior, atomic first allocation, and a defined source of active-session/close information.\
A finite retention interval alone is not a record-count bound, and reclaiming a live ownership record to admit another is not safe reuse.

## AGP contract proposal

The producer draft proposes:

- An explicit `sendDirectPeer` entry point, backed by the same shared admission path as ordinary sends; current `send()` can ignore unknown options, so an option-only extension needs a separate fail-closed support guarantee.
- An immutable mode-tagged association on direct delivery context, with no conversion of legacy absent metadata into unauthenticated authority.
- An explicit minimum channel-protection requirement, independent of identity mode.
- The existing pinned destination and `hopLimit: 1`, preventing onward AGP forwarding by a conforming recipient if the endpoint disappears.
- Typed refusal before transfer, replacement only before admission, and no migration or replay after writer admission.

The proposed `instanceBinding`, method name, field bounds and error vocabulary are AGP design recommendations, not claims that Zorg's current contracts already implement or agree to them.\
No wire-schema change is proposed, and ordinary multi-hop pins remain unchanged.

Please review the producer draft and respond first on the lifetime guarantee.\
After that agreement, we can settle the exact public shape and obtain design review before implementation.\
Placement in Zorg's incoming folder is not acknowledgment or ratification.
