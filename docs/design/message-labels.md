# Message labels and delivery disposition

> **Status:** Design of record for the per-message design, and a documented alternative.\
> The per-message design is the target state. The per-flow design is recorded for comparison and is not built.

## 1. Purpose

AGP keeps a record at every hop that a message crosses, so that a delivery failure discovered downstream can find its way back to the node that sent it.

This document names that record, states the design that is being built, states a complete alternative that was considered, and contrasts the two against what AGP is for.

It exists because the alternative is not obviously wrong.\
It is more efficient in the dimension the current design is weakest in, and rejecting it on efficiency alone would be a mistake.\
The reason to reject it is what it would oblige AGP to become.

---

## 2. What the record is

The value carried on the wire is a hop-scoped label.\
The record held at each hop binds an outbound label to the ingress it arrived from and the label that ingress knows it by.

That is label swapping.\
The label is the label; the record is the cross-connect that swaps it.\
They are named accordingly: a `LabelBinding` held in a `LabelTable`, replacing the earlier name `breadcrumb`, which suggested something passively left behind rather than an active forwarding entry.

One property separates this from the mechanism it resembles.\
A label in a label-switched network identifies a class of traffic, so the table is proportional to the number of classes.\
An AGP label identifies one message, so the table is proportional to traffic.\
Every difference between the two designs below follows from that sentence.

---

## 3. The defect this design corrects

AGP has no positive acknowledgement.\
A binding is released by a delivery failure or by expiry, and never by success.

A flow that never fails therefore fills the table and stops the node sending.\
The sustained rate is capacity divided by the retention window, about 136 messages a second against a burst ceiling near 2850, and the window is not shortenable independently of the hold time.

The fault is the retention duration, not the placement of the state.\
A node is throughput-capped by records it keeps exclusively for failures that did not happen.

---

## 4. Design A - per-message labels with completion disposition

This is the target state.

### 4.1 Label lifetime

A binding is created when a message is forwarded to a peer, exactly as now.\
It is released when a disposition for that message returns, whether the disposition is success or failure.\
Expiry remains as a backstop for a disposition that never arrives.

### 4.2 Disposition

One wire message reports the fate of a message, carrying a code that distinguishes delivered from each failure reason, in the shape of a single control message rather than one message type per outcome.

A hop reports upstream only once its own downstream has reported to it.\
So a disposition arriving at the originating node means the network delivered the message to the destination endpoint.\
It does not mean the endpoint processed it, and it never will: what a handler does with a payload is above this layer.

### 4.3 Batching

Dispositions are batched per session, which is the coarsest grain available, because one session carries every flow between two adjacent nodes.

A batch is emitted when a debounce interval elapses or a message count is reached, whichever comes first, so acknowledgement latency stays bounded under load rather than only under idleness.

A batch expresses its contents as ranges of labels carrying an outcome code, rather than as a cumulative high-water mark or a flat list.\
Cumulative is unsafe because dispositions genuinely complete out of order: a failure two hops away returns sooner than a success four hops away, and the existing failure path consumes labels out of band.\
A flat list wastes the structure, because labels are allocated monotonically per session and a batch is usually contiguous.\
Ranges are exact when the batch is scattered, compact when it is not, and carry the outcome per range, which is what a single unified message shape needs anyway.

### 4.4 Capacity, and the second window

Credit under `D19` bounds what may be in flight to a peer, and releases when that peer reads.\
Label capacity bounds what may be awaiting disposition, and releases when the far end reports.

Labels are therefore held longer than credit, and for a reason that scales with path depth rather than with one hop.\
Sizing label capacity as though it were credit capacity would make labels the binding constraint again, which is the present defect wearing different clothes.\
Label capacity must cover the offered rate multiplied by the end-to-end round trip plus the debounce interval.

### 4.5 Pressure

Reaching label capacity evicts the oldest binding rather than refusing new work, so a reverse-path concern can never block the data plane.\
The behaviour is configurable, because a deployment that would rather stop than lose a disposition must be able to say so.

Eviction and completion need each other.\
Completion keeps the table small enough that eviction is rare, and eviction guarantees the table cannot cap throughput when completion does not arrive.\
Without completion, eviction alone would routinely discard dispositions for messages that succeeded, and an application would see a timeout for a message that arrived.

### 4.6 What the application receives

The disposition is surfaced on the SDK, per send and per endpoint.\
It is not surfaced as one operational event per message: that rate is what reduced a subscriber doing real work to fifteen events out of twelve hundred, and the operational stream carries counters and anomalies instead.

The signal is best effort.\
A lost disposition leaves an application with neither outcome, so an application building reliable delivery on this still needs its own timeout.\
Stating that plainly is part of the contract, because a signal that usually arrives is the easiest kind to over-trust.

---

## 5. Design B - per-flow labels

This is a complete alternative, and it is not built.

### 5.1 Flow identity

A label identifies a flow rather than a message.\
A flow is the tuple that determines a reverse path: the ingress it arrived on, the source endpoint with its origin node, and the destination endpoint.

Every message on that flow carries the same label at a given hop, and the label is swapped hop by hop exactly as in design A.

### 5.2 Per-message identity

A sequence number distinguishes messages within a flow.\
It is assigned once by the originating node and preserved unchanged along the path, so no hop needs per-message state to interpret it.

A disposition then names a flow label and a range of sequence numbers with an outcome code.

### 5.3 Lifetime

A flow binding is created by the first message of a flow, and released when the flow is idle for an interval, when the selected route for its destination changes, or when either adjacent session ends.

### 5.4 What it costs

A flow binding must be established and torn down, so the table trades a bound on messages for a bound on flows, and acquires a lifecycle of its own with its own capacity and its own eviction question.

A route change invalidates a flow binding, because the next hop it names is no longer the next hop.\
AGP exchanges authoritative full snapshots under `D4` and reconverges from empty derived state under `D9`, so route change is a routine event rather than a rare one, and the reverse path would become coupled to it.

A sequence space needs a reset and wrap policy, and the originating node must retain per-flow send state to correlate a returned range to the messages it sent.

### 5.5 What it would additionally enable

Contiguous sequence numbers let a destination detect a gap, so a receiver could report that something went missing rather than waiting for a sender to time out.

That is a real capability which design A does not provide, and it is the strongest argument for design B.

---

## 6. Contrast against intent and duties

The scope AGP holds is a control plane and a data plane for message packets between named endpoints, where a message is a datagram and end-to-end connection state belongs to the application integrating AGP.

| Question | Design A, per message | Design B, per flow |
|---|---|---|
| State grows with | Messages in flight | Flows in use |
| Released by | A disposition, success or failure | Idleness, route change, or session loss |
| Concept introduced | None | A flow, and a sequence space |
| Behaviour on route change | Unaffected; each label is independent | Bindings invalidate and re-establish |
| Failure attribution | Exact, per message | Exact, per sequence within a flow |
| Detects a gap | No | Yes |
| Wire cost per message | None; the label already exists | A sequence number |
| Wire cost per batch | Ranges of labels with codes | Flow label plus ranges of sequences with codes |
| Obliges AGP to own | Nothing new | Flow lifecycle and ordering state |

The decisive line is the last one.

Design B puts connection state into a data plane whose stated premise is that messages are stateless.\
A flow is a connection by another name: it is established, it has an identity that outlives a single message, it carries a sequence space, and it must be invalidated when the topology moves.\
That is precisely the end-to-end state that the scope assigns to the application, relocated into the component that was chosen for not having it.

The efficiency argument does not rescue it.\
Design B is more efficient in table size, but table size stops being the binding constraint once completion releases a binding: at the measured carrier ceiling with a fifty millisecond debounce, outstanding bindings number in the low hundreds per hop.\
Design B therefore buys an efficiency AGP does not need, at the cost of a concept its scope excludes.

Gap detection is the honest counterweight, and it is not enough on its own.\
An application that needs to know a message went missing can learn it from the absence of a disposition, which design A already provides, at the cost of a timeout it needs regardless because the disposition is best effort.

The condition that would revive design B is therefore not throughput.\
It is AGP acquiring a flow concept for some other ratified reason, at which point per-flow labels become the composition of an existing concept rather than the introduction of a new one.

---

## 7. Mechanics, rationale, and consequence

### Mechanics

A hop-scoped label is carried on every forwarded message, and a binding at each hop swaps it, so a disposition can travel the exact reverse path of the message it concerns.

A binding is released by the disposition, whether that disposition is success or failure, with expiry retained only as a backstop and eviction of the oldest retained so that reverse-path state can never refuse data.

Dispositions are batched per session as ranges carrying outcome codes, emitted on a debounce interval or a count, and a hop reports upstream only after its own downstream has reported to it.

---

### Rationale

The reverse path cannot use the routing table, because that would let any node inject a failure report at an endpoint it was never authorised to reach, and the binding is what makes a report provably the answer to one specific forwarded message.

The present design releases a binding only when something goes wrong, so a healthy node accumulates records of successful deliveries until it can no longer send, which prices a resource that grows with traffic against an event that occurs with route churn.

Per-flow labels remove that growth more completely, and are rejected because doing so requires a flow: an established, sequenced, route-sensitive identity that outlives a message, which is connection state in a plane whose premise is that there is none.

---

### Consequence of violation

- Releasing a binding only on failure returns the throughput ceiling,
  because success is the common case and nothing else clears the table.
- Refusing new messages when the table is full lets a reverse-path quality
  concern stop the data plane, which inverts the relationship between them.
- Sizing label capacity as though it were credit capacity reintroduces the
  ceiling, because a label is held for an end-to-end round trip while credit
  is released by one peer reading.
- Reporting a disposition as one operational event per message reproduces the
  subscriber starvation already measured, where a consumer doing real work
  received fifteen events of twelve hundred.
- Describing a delivered disposition as processing would promise handler
  semantics that this layer does not observe and cannot honour.
- Adopting per-flow labels for efficiency alone would introduce flow
  lifecycle, sequencing and route-change invalidation into a datagram plane,
  relocating into AGP the end-to-end state its scope assigns to the
  application.
