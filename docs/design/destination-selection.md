# Destination selection

> **Status:** Design under consideration. Not built.\
> One part of it changes confirmed intent and is a director decision rather than a design one.

## 1. Purpose

A data message names its destination by endpoint alone, and every hop resolves that name against its own routing table.

This document states what that means today, why it is a form of anycast that nobody chose deliberately, and what a message would need in order to reach one named instance instead of any of them.

It is separate from [`message-labels.md`](message-labels.md) because it is a different concern.\
That document governs how the fate of a message is tracked and reported.\
This one governs which instance a message is for.

---

## 2. What happens today

A data message carries an asymmetry.

The source is `endpoint` and `originNodeId` together, because both are needed to authorise forwarding: a node checks that the source is feasible from the ingress it arrived on, and that it has itself exported that source to the peer it is about to forward to.

The destination is an endpoint name alone.\
Each hop resolves that name in its own selected routing table and forwards to whatever next hop that yields.

The same endpoint name may be advertised by more than one node.\
Selection under `D6` is deterministic, so nodes holding the same routing state resolve it the same way, and nodes holding different routing state during reconvergence may not.

So a destination endpoint means **any node advertising this endpoint**, resolved independently at each hop.\
That is anycast, and it arrived as a consequence of addressing by name rather than as a decision.

---

## 3. What a selector would add

A destination becomes an endpoint, an optional node, and a mode.

| Mode | Meaning | Behaviour when the named origin is not the selected route |
|---|---|---|
| Any | Any node advertising the endpoint, which is today's behaviour | Not applicable; no origin is named |
| Pinned | This instance or none | Refuse, with a reason distinct from an unresolvable endpoint |
| Preferred | This instance if it is reachable, otherwise any | Forward to the selected route, and report where it landed |

Each mode is enforced at every hop rather than at admission alone.\
A pin honoured only by the originating node pins nothing, because a later hop holding different routing state would resolve the name its own way.

Pinning yields **that instance or nothing**, not **always that instance**.\
It is a guarantee against misdelivery rather than a guarantee of reachability, and the name should not be allowed to suggest otherwise.

### 3.1 The substrate exists

`F01` keeps alternatives in the local candidate routing table while advertising and forwarding one selected path.\
A candidate carries its origin node and the session it was learned from, so a next hop toward a named origin is already resolvable.

Every candidate was accepted under `D5`, so its path is loop-free by construction, and forwarding along one is not less safe than forwarding along the selected route.

### 3.2 What a selector is not

Naming an instance is not source routing.\
It fixes which endpoint the message is for, and each hop still chooses its own next hop toward it.

The distinction matters because a mechanism that chose the path rather than the destination would be traffic engineering, would override `D6`, and is out of scope.

---

## 4. The confirmed-intent question

Confirmed intent `Q1(b)` states that every data path is gated by the local selected routing table.

Pinned and preferred modes gate on the candidate table instead.\
The selected route remains what is advertised and what an unqualified message follows, but it stops being the only route a message may take.

That is a small change in wording and a real change in what the gate is.\
It is recorded here as a question rather than resolved, because confirmed intent is not a design decision.

Nothing else moves.\
`D6` still selects deterministically and still governs what is advertised.\
`D7` still authorises by feasible ingress and acknowledged source export.\
The Vision still holds, because a message with no usable route is refused before it is sent.

---

## 5. Replication

Duplicating a message to every node advertising the endpoint fits the same addressing shape as a fourth mode, and it is not the same size of change.

The addressing generalises.\
The forwarding does not: replication needs a fan-out point, loop handling across branches, deduplication where branches reconverge, credit and queue accounting per branch, and a disposition for each branch rather than for the message.

The last of those is why `message-labels.md` requires that nothing assume exactly one disposition per message.\
A message with three branches has three fates, and a correlation table that assumes one would have to be rebuilt rather than extended.

Replication is therefore recorded as its own mechanism, sharing this addressing rather than this forwarding.

---

## 6. Mechanics, rationale, and consequence

### Mechanics

A destination is an endpoint, optionally a node, and a mode that says whether that node is required, preferred, or absent, with the mode enforced at every hop rather than at admission alone.

A named instance is resolved against the local candidate routing table, which already retains alternatives and already records the origin and learning source of each.

A refusal caused by an unreachable named instance is reported with a reason distinct from an endpoint that resolves nowhere, because an application that named an instance deliberately must be able to tell the two apart.

### Rationale

Addressing by name alone means any advertiser of that name may serve the message, which is anycast, and anycast is the wrong default for a flow that has established state on one instance.

The routing table already retains the alternatives and their origins, so naming an instance requires no new distribution and no new state, only a different question asked of state that is already held.

Enforcement at every hop is what makes a pin mean anything, because reconvergence is precisely the condition under which two hops resolve one name differently, and that is the condition a pin exists to survive.

### Consequence of violation

- Enforcing a pin only at the originating node pins nothing, because a later
  hop holding different routing state resolves the name its own way.
- Reporting an unreachable named instance as an unresolvable endpoint leaves
  an application unable to distinguish a moved instance from a withdrawn
  service, which are opposite remedies.
- Allowing a mode to choose a path rather than a destination turns instance
  selection into traffic engineering and overrides deterministic selection.
- Describing a pin as a reachability guarantee promises delivery that the
  mechanism does not provide; it guarantees only that misdelivery is refused.
- Adding replication as a mode rather than as a mechanism would put fan-out,
  loop handling and per-branch accounting behind a flag that reads like the
  other three.
