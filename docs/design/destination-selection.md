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

Duplicating a message to every node advertising an endpoint fits the same addressing shape as a fourth mode, and it is not the same size of change.

The addressing generalises.\
The forwarding does not, and neither does the accounting, which is the second and less obvious reason it is a mechanism of its own rather than a mode.

### 5.1 The list is coordination, not optimisation

A replicated message carries the destinations it is responsible for, and each hop divides that list by next hop and forwards one copy per group.

A destination therefore appears in exactly one group at every level, so duplicates are impossible rather than suppressed, and the list strictly shrinks so termination does not depend on the hop limit.

Without the list, two hops that both hold a candidate for the same destination each conclude they are responsible for it.\
That is the diamond, where a message replicated at the top reaches the bottom by two paths and the ingress check is satisfied by both.\
The list is what divides responsibility; carrying it is the price of not needing to detect the collision afterwards.

An intermediate hop does not retain the list.\
It divides it, forwards the parts, and keeps only a count, as `message-labels.md` section 4.6 describes.\
The full list exists on the wire only between the origin and the first hop that divides it.

### 5.2 Who enumerates

The list can be built in two places, and the choice is about who decides the recipients rather than about efficiency.

| Built at | Recipients are | The sender knows them |
|---|---|---|
| The origin | Exactly these named instances | Before sending |
| The first dividing hop | Whoever that hop currently serves | Only from what returns |

Enumerating at the first dividing hop is loop-free for the same reason: before that hop there is one copy and nothing to duplicate, and from that hop onward the list divides as normal.\
It also puts the work where the fan-out is, so a leaf sending into a star carries no list at all and the centre does the dividing.

The second is more current, because the origin's view of who serves an endpoint may be stale.\
The first is exact, because the origin said who it meant.

### 5.3 The open question in the discovered variant

An origin that did not enumerate does not know how many destinations to expect, so it can count what arrives and never know it is finished.

Asking the local node for the group is not an answer.\
That returns the origin's own view, which is the view that was avoided by not enumerating, and completeness resting on it would hold until the two views differed.

The available answer is for the dividing hop to report its fan-out upstream, so the origin learns the number without having chosen it.\
That is a progress report rather than an outcome, and it is the first thing in this design that describes the journey instead of the destination.\
Whether the disposition vocabulary should carry such a thing is open, and it should be decided deliberately rather than added as another code.

### 5.4 The alternative that carries nothing, which is strict RPF

Responsibility can be derived instead of assigned, and the mechanism that does so already has a name in this record.

`D7` validates a source by feasible-path reverse path forwarding: the source must be an eligible route owned by the actual ingress session, and it need not be the selected reverse route.\
`M18` records that as aligned with [RFC 3704 section 2.3](https://www.rfc-editor.org/rfc/rfc3704#section-2.3), and `routing.md` section 8.2 states why the weaker form was chosen: strict validation would reject legitimate asymmetric best paths.

Strict RPF is the missing coordination.\
A hop accepts a replicated message only when the selected reverse route toward its origin points at the ingress it arrived on, and drops it otherwise.\
Every hop computes the same answer from routing state it already holds, so the surviving copies form a tree, and the diamond resolves with nothing carried on the wire.

The cost is not that it fails, but that it contradicts a ratified choice.\
A node would hold two source-validation rules at once: feasible-path for a unicast message and strict for a replicated one.\
Those two disagree in exactly the asymmetric cases `D7` exists to permit, so a topology where an asymmetric path is legitimate would deliver a unicast message and drop the replicated copy of it.

The accounting cost is separate and also real.\
A copy dropped this way is discarded silently, so there is no per-destination failure; an intermediate cannot know what it is responsible for, so there is no count; and an origin can never know it is complete.\
Restoring those needs a fan-out report, an outcome meaning a copy was suppressed, and a reconciliation between them, which is more parts than the list it replaces.

It is recorded as `F14` rather than dismissed.\
It is the right shape for fan-out that wants delivery without accounting, and deriving responsibility rather than assigning it is a genuinely different idea that should be findable by the name the rest of the record already uses for it.

### 5.5 What replication does to a label binding

One inbound message becoming several outbound copies makes a binding one to many: several outbound labels, all resolving to one ingress and one upstream label.

An upstream binding therefore cannot be released by the first disposition to return, or an origin learns one outcome of several.\
The outstanding count in `message-labels.md` section 4.6 is what makes this work, and it is the reason that count is defined now rather than when replication is built.

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
- Replicating without dividing responsibility explicitly leaves two hops each
  concluding they serve the same destination, which is a duplicate delivered
  rather than a duplicate suppressed.
- Counting copies sent rather than destinations owed makes an intermediate
  count go negative the first time a downstream hop divides further.
- Letting an origin infer completeness from its own view of the group, in the
  variant where it deliberately did not enumerate, rests completeness on the
  view that was avoided.
