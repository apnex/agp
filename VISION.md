# Agent Gateway Protocol - Vision

**Status: enduring.**\
This document states why AGP exists and what it will never be.\
It carries no current state, no roadmap, and no schedule.\
Where the system is now belongs to [`docs/VERIFICATION.md`](docs/VERIFICATION.md), and what happens next belongs to [`docs/BOARD.md`](docs/BOARD.md).

Holding this document authorises nothing.\
It does not ratify a decision, certify a gate, approve a wire change, or promote code.\
Those powers belong to [`docs/DECISIONS.md`](docs/DECISIONS.md) and [`docs/GATES.md`](docs/GATES.md) respectively, and a direction change is recorded there first and absorbed here afterwards.

---

## North star

> Give named application endpoints the routing guarantees of an interior
> gateway protocol, so any component can reach any other by name across a
> topology no one centrally administers.

Three terms in that sentence carry weight, so this document defines them rather than leaving them to the reader.

**Routing guarantees** means the properties an interior gateway protocol provides and a message bus does not: every node computes reachability from state it holds, selection is deterministic, paths cannot loop, withdrawal is atomic, and a message with no usable route is refused before it is sent rather than accepted and lost.

**By name** means an endpoint is the unit of reachability.\
A sender names the endpoint it wants, never a host, port, address, or intermediate node.\
The name is what propagates, and the topology is what changes underneath it.

**No one centrally administers** means there is no broker, no registry, no controller, and no node whose failure removes reachability that other nodes could have computed.\
Every node runs the same implementation, and its position in a topology is configuration rather than identity.

---

## Why AGP exists

Software components increasingly need to address each other by name across topologies that nobody owns end to end.\
The available answers each solve a different problem.

A broker centralises delivery and becomes the thing that must not fail.\
A service mesh solves reachability at the infrastructure layer, which means it cannot see application endpoints and cannot be embedded.\
Remote procedure calls need an address before they can start.\
Publish and subscribe routes by topic, which is a different question from routing to a named destination.

Interior gateway protocols solved a structurally identical problem decades ago, for a different unit.\
Each node maintains its own view, exchanges reachability with its neighbours, selects one path deterministically, and refuses to forward what it cannot justify.\
That model degrades gracefully, survives partial failure, and requires no central authority.

AGP applies that model where the reachable unit is a named application endpoint rather than an address prefix.\
The protocol is BGP-inspired and deliberately not BGP-compatible: the mechanisms are borrowed where they fit, adapted where the unit differs, and departed from where a message plane is not a packet plane.\
[`docs/design/mechanisms.md`](docs/design/mechanisms.md) records which is which for every mechanism, so a resemblance is never mistaken for a conformance claim.

---

## What AGP is

A protocol and an embeddable runtime, composed of separable concerns.

| Concern | Owns |
|---|---|
| Control plane | Sessions, endpoint advertisement, route selection, propagation, withdrawal |
| Data plane | Admission, forwarding, hop accounting, correlated reverse failure |
| Management plane | Canonical state, events, counters, and the read-only projections over them |
| Wire and transport | The packet language, and the carrier-neutral channel beneath it |

Those are separable on purpose.\
A carrier can be replaced without touching routing, and a management surface can be added without the kernel knowing.\
Identity, resource governance, liveness, and observability cut across all four rather than belonging to any one of them.

AGP is a library first.\
It is embedded by an application that owns its own lifecycle, configuration, and deployment, and it does not assume a process, a scheduler, or an operator.

---

## What AGP is not

The boundary is the half of an intent statement that travels, so it is stated positively rather than left as an absence.

**Not a message broker.**\
There is no central node, no store, and no delivery agent.\
A node forwards or refuses; it never accepts custody on behalf of a destination.

**Not a durable queue.**\
Nothing is persisted, replayed, retried, or acknowledged end to end.\
A send that resolves means one node admitted it against a route it can justify, and that is all it means.

**Not a remote procedure call framework.**\
There is no request and response pairing, no service contract, and no interface description.\
A correlated reply is an application concern built on one-way delivery.

**Not a publish and subscribe bus.**\
Endpoints are addressed, not subscribed.\
There are no topics, no fan-out, and no subscription state.

**Not a service mesh.**\
AGP does not own infrastructure, inject sidecars, terminate traffic for workloads that did not ask, or implement deployment policy.

**Not an agent framework, and not itself agentic.**\
AGP carries messages for agentic systems; it contains no cognition, no model, no orchestration, and no autonomy.\
The name describes what it serves, not what it does.\
[`docs/design/axioms.md`](docs/design/axioms.md) records the axioms this exclusion makes inapplicable.

**Not a security product.**\
The transport can protect a channel and report what it observed.\
Deciding whether an authenticated peer may claim an identity is deployment policy, and AGP supplies the evidence rather than the ruling.

---

## What success means

Four dimensions.\
They are not weighted, and they do not collapse.

**Correctness under adversity.**\
Every forwarding outcome is justified by state the forwarding node holds, and remains so under loss, saturation, races, and partial failure.\
The measure is that adversity produces a refusal or a reconvergence, never a wrong delivery and never a silent one.

**Sovereignty of contracts.**\
Any one concern can be replaced without editing another.\
The measure is that a substitution is a substitution rather than a migration.

**Cold-reader comprehension.**\
A reader with no prior context reaches the same conclusions from the record that the author held.\
The measure is that a question about why something is the way it is has a written answer.

**Reach.**\
The same node implementation runs wherever a topology needs it, without a variant, a fork, or a privileged path.

A programme strong on three of these and weak on one is not mostly successful.\
It has one unmet dimension, and which one it is carries more information than any average of the four.\
Collapsing them into a score would hide exactly the signal that says what to do next.

---

## Authority

Held by the director.\
Drafted by anyone; ratified only by the director, because intent is the one input no other role may supply.

This statement is amended, never quietly rewritten.\
A ruling that changes direction is recorded as a decision and absorbed here, so the reasoning behind a change survives the change.

Where this narrative and a machine-verified record disagree about operational state, the record governs.\
This document states purpose, and purpose is not evidence.

---

## Related records

| Record | Holds |
|---|---|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Confirmed intent and the ratified decision register |
| [`docs/design/mechanisms.md`](docs/design/mechanisms.md) | Every mechanism, its analogue, and every deliberate departure and deferral |
| [`docs/design/README.md`](docs/design/README.md) | The current architecture and its scope boundary |
| [`docs/VERIFICATION.md`](docs/VERIFICATION.md) | What is proved, and what is knowingly unproved |
| [`docs/BOARD.md`](docs/BOARD.md) | The live, triaged set of next moves |

---

## Mechanics, rationale, and consequence

### Mechanics

The north star is one quotable sentence whose load-bearing terms this document defines.\
The boundary is stated positively.\
Success is a set of dimensions with an explicit refusal to collapse them.\
Authority names one holder, and the document carries no point-in-time state.

### Rationale

A programme is asked, repeatedly, whether some proposal is in scope.\
Without a written purpose that question is answered from whoever is in the room, which works while the founder is present and stops working the moment they are not.\
Stating the boundary positively matters more than stating the purpose, because the exclusions are what a proposal actually collides with.

### Consequence of violation

- Purpose left unwritten makes every scope question a matter of memory, and the
  answer changes with the reader.
- A purpose with no stated exclusions has not been bounded, and anything can be
  argued into it by resemblance.
- A single success score hides its weakest dimension, which is the one that
  should be driving the next move.
- Point-in-time state under an enduring status makes one line declare the
  currency of both, and the stale half is trusted because the fresh half is.
- An intent statement that reads as an approval will eventually be cited as one.
