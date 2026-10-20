# AGP direct peer send lifecycle response

Status: proposed integration clarification following Zorg's D61 agreement; AGP design approval remains open.\
From: AGP, answering `upstream/agp-direct-peer-send-draft-reply.md`.\
Producer draft: AGP `docs/design/direct-peer-send.md`, section 3.

D61 supplies the consumer agreement we requested: `instanceBinding`, the public send and delivery shapes, identifier bounds, explicit protection policy and every reply branch.\
We have incorporated that agreement into the draft; the instance-binding choice is no longer an unanswered question.

## The remaining dependency

Your lease rule depends on `operations.connections()` identifying admitted or pending sessions by `(node, instanceBinding)`.\
AGP's current `PreIdentityControllerSnapshot` has no remote node or association, and `SessionSnapshot` has no `instanceBinding`.\
The runtime projection agrees with those types (`packages/core/src/types.ts` and `packages/node/src/node.ts`, `#connectionSnapshots`); the direct-peer draft adds neither snapshot field.

That predicate needs a declared producer contract before an issuer can depend on it.\
An association exposed only after admission would also leave the redeemed-but-not-yet-admitted interval to account for.

## Proposed ownership and release rule

The issuer owns leases, outstanding usable keys, renewal, capacity and reclamation.\
The attempt/binding owner accounts for redeemed uses until exact terminal invalidation or transfer, and the AGP session owner supplies authoritative facts for the exact admitted controller.\
We recommend composing that handoff with the existing joint admission-lifecycle work, using one mechanism for CLI and browser carriers.

A lease can be reclaimed only when:

- No outstanding credential can still admit under that binding, whether because it expired or because fresh admission under it is irrevocably refused.
- No pending verification, opening or handoff can still publish a session, and no live admitted session uses the binding.
- The grace interval has elapsed and the final check/release is serialized against issuance, redemption and renewal.

Unknown or stale lifecycle information is not absence.\
A late callback must not revive a released binding, and an older attempt's terminal event must not release a replacement's reservation.\
Finite capacity refuses new allocation rather than evicting a live lease or accumulating an unbounded waiting queue.\
Physical cleanup that remains after terminal invalidation still consumes its retained-resource budget.

`instanceBinding` continues to protect an old reply from a later allocation; none of these conditions requires waiting for old operation handlers.\
Nor does a short TTL alone establish the conditions.

## Next joint step

Please confirm these ownership and release obligations with the credential owner, and identify the exact pending-use and session-lifetime facts it needs from the binding/AGP boundary.\
AGP will specify its side through the joint lifecycle design; we have not selected a snapshot extension or a new lifecycle API by implication.

This is a focused integration obligation, not a request to reopen the agreed direct-peer surface or put an issuer into AGP.\
The reconciled draft can proceed through design review, with production lease integration held to the resulting declared contract.
