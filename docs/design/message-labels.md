# Message labels and delivery disposition

> **Status:** Ratified as `D23`, not yet built. The per-flow design is recorded for comparison and is not built.\
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

Every code in that set names an outcome.\
A suppression report, saying a copy was discarded as a duplicate, would name something else, and it is not added here.\
A vocabulary that holds one kind of thing should not acquire a second by having a value added to it.

The number of destinations a message was divided into is not an exception to that.\
It is a field on an outcome rather than a code, it is absent unless the number exceeds one, and it is stamped by the hop that enumerated because no hop downstream of the division knows the total.\
It rides on every disposition rather than the first, so losing one report costs an outcome rather than the denominator, and a relay that passes a disposition through must preserve it.

With several destinations, terminal outcomes arriving over time are themselves a progress stream: the count falling from five to four to three is progress built entirely from settled things.\
The denominator is the only information in this mechanism that is not an outcome, and carrying it as a field is what keeps the vocabulary holding one kind.

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

### 4.6 Outstanding accounting

A binding carries a count of what remains outstanding against it, and is released when that count reaches zero.

For a message with one next hop the count is one, so this is the same rule as releasing on the disposition and nothing observable changes.\
It is written this way because the general case is a message with several next hops, and a rule that reads `count reached zero` needs no exception for it.

The count is the number of destinations a hop is responsible for, and not the number of copies it sent.\
A hop that sends one copy covering three destinations is responsible for three, and will see three dispositions returned.\
Counting copies instead would go negative the first time a downstream hop divided further.

The origin retains which destinations are outstanding, and an intermediate hop retains only how many.\
An intermediate never needs to name them, and a count is smaller; the origin does need to name them, because that is what an application asks.\
Retaining the set at the origin also makes a repeated report harmless there, rather than leaving a bare integer to be defended by the consume-once rule of a hop further away.

Two behaviours follow without being designed separately.\
A destination that fails decrements the count with a failure code, so the count reaches zero carrying mixed outcomes, which is what happened.\
A destination that never reports leaves a non-zero count visible, so an application sees a stall rather than inferring one from a timeout, and expiry remains the backstop.

This is the same shape as the table an origin keeps for its own sends, and the same shape a request and response surface would need for calls in flight.\
One substrate serves all three: an entry keyed by correlation, carrying what is outstanding, released when nothing is.

### 4.7 What the application receives

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

## 7. Demarcation - what per-message owes a future flow layer

Flow semantics will be wanted by some applications.\
Per-message is chosen anyway, on the condition that it does not foreclose them, so this section states what per-message must hold true for a flow layer to be added later as a sovereign layer above rather than a revision of what is beneath it.

### 7.1 Two different analogies, and the line between them

A flow layer can be built two ways, and the two are not variations of one idea.

| Model | AGP form | State lives | Buys |
|---|---|---|---|
| A transport header inside a network payload | A flow layer wraps the payload | The endpoints only | Sequencing, gap detection, reliable delivery, connection lifecycle |
| A signalled label-switched path | Per-flow labels, design B | Every hop | Per-flow credit, path pinning, transit fairness |

The second model exists for bandwidth reservation, explicit paths and traffic engineering.\
Those are exactly the three things a layer above cannot reach, which is why the line falls where it does rather than somewhere convenient.

### 7.2 The flow layer carries its own header in the payload

A flow layer belongs in the first model.\
Its state is endpoint to endpoint, so its header travels inside the payload, which AGP bounds and carries and never interprets.

That the flow layer dictates the payload shape is the layering working, not a leak.\
An application talks to the flow layer, not through it to AGP, in the same way that an application using a transport does not see the transport's sequence number.\
Mixing the two is not supported, and is not meant to be.

`extensions` on the envelope is a different slot for a different concern.\
It is the hop-visible one: metadata an intermediate node may read.\
A flow layer's state has no business being hop-visible, so needing a metadata channel is not a reason to open that field for origination, and if it is opened later it must be for a concern that intermediate nodes genuinely act on.

### 7.3 The five guarantees

1. A disposition is per message at the interface, whatever its wire form. Batching into ranges is a wire economy and must never surface as the shape an application sees, because a layer above maps one disposition to one sequence and cannot do that from an aggregate.
2. `messageId` is stable end to end and the disposition names it, so a layer above can correlate without inventing an identifier of its own.
3. AGP bounds and carries the payload and never interprets its content. A wrapper draws on the same depth and size allowance as the application data it carries, which a flow layer must budget for.
4. A disposition carries its reason and whether that reason is retryable, so a layer above can distinguish a condition worth retrying from one that will never clear.
5. The absence of a disposition means unknown and never means undelivered. The signal is best effort, so a layer above still owns its own timeout, and nothing may be built on silence.

Four of these are already true or are simply how the disposition is written.\
None requires an interface change, which is the point: the cost of keeping this door open is close to zero now and considerable once applications depend on a shape.

### 7.4 What a layer above will never reach

Per-flow credit, per-flow path selection and per-flow fairness in a transit queue all require a transit node to know that a flow exists.\
No arrangement of endpoint state provides them.

That, and not throughput, is the condition that would revive design B.

---

## 8. Forward compatibility - what this design keeps open

Flow-aware forwarding is wanted later: per-flow guarantees, quality of service, and eventually replication.\
Per-message is built now, so this section states what it must do differently in order that those arrive as extensions rather than as a rework of the primitives beneath them.

### 8.1 Five adjustments to the primitives

1. The label vocabulary is generic and directionless. A `LabelTable` keyed by controller and label holds a binding; a forward binding is structurally the same record as a reverse one, so the table is not named or shaped for one direction.
2. Label allocation is a session primitive rather than a detail of the return path. The allocator is already monotonic per session, which is what a label allocator is, so a forward label later draws on the same primitive instead of a parallel one.
3. Forwarding takes a key rather than a destination. The key today is the destination endpoint, and a richer classification later replaces the key rather than every call site that resolves one. This is the most expensive adjustment to retrofit and the cheapest to make now.
4. The disposition code space is open. A reason that does not exist yet, such as a class or reservation failure, must not require a wire change in order to be reported.
5. Nothing assumes exactly one disposition per message. A message with more than one next hop has more than one fate.

The fifth looked like cheap insurance when it was written and is load-bearing once replication exists.

### 8.2 Two grades, and only one is expensive

| Grade | What a label changes | Additionally requires | Collides with |
|---|---|---|---|
| Along the selected path | How a hop treats a message, never where it goes | A forward label on the wire, and a way for it to acquire meaning | Nothing |
| Along an engineered path | Where a message goes | A signalling plane that establishes path state | `D6`, and `D4`'s distribution model |

The first grade is the one that buys per-flow credit, per-flow queues and per-flow accounting, because it gives a transit node somewhere to hang state.\
It is label switching that mirrors the routing table, in the manner of a label distribution protocol rather than a traffic-engineering one.

The second grade is what a resource reservation protocol adds, and it is excluded: AGP does not diverge from the routing table.

### 8.3 The classification is already on the wire

A per-flow class can be formed from `source.endpoint`, `source.originNodeId` and `destination`, all of which every data message already carries.\
Nothing new is needed in order to recognise a flow; only to label one.

### 8.4 A return label is not a forward label

The label in use today is allocated by the sender, understood only by the sender, and used to correlate a disposition.\
A forward label would be meaningful to the node receiving it, and would tell that node how to treat what it carries.

They share an allocator, a table shape and a vocabulary.\
They must not share a field.\
One field serving both directions couples the reverse path to the forwarding path, after which neither can change without the other.

### 8.5 The stack question, when the field is added

Nesting is what gives a label-switched network tunnels, hierarchy and multi-tenancy.\
Nothing here precludes it, and whether the forward label field is one value or a list is a decision to take deliberately when the field is introduced, because it is free then and a wire change afterwards.

### 8.6 A label may be learned rather than signalled

A label distribution protocol is a substantial addition, and it may not be needed.\
The reverse label already demonstrates the alternative: it is allocated unilaterally and never understood by anyone else.

A forward label could be learned from the data plane instead of signalled.\
The first message of a flow carries full addressing and a label, the receiver retains the association, and later messages carry the label alone, with an unrecognised label falling back to full resolution.

This is promising and unverified.\
It is recorded because it would avoid the single largest cost in the grade above, and because discovering it after building a signalling plane would be expensive.

### 8.7 What follows the routing table moves when the routing table moves

A flow follows whatever path is currently selected, so reconvergence moves it and per-hop state re-establishes on the new path.

This is not a defect and it is how a label-switched path behaves when its interior routing changes.\
It does mean a per-flow guarantee holds along the currently selected path and not across a reconvergence, which must be stated before anything is promised on top of it.

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
- Surfacing a batched disposition as the shape an application sees would
  foreclose a flow layer, because one disposition must map to one sequence
  and an aggregate cannot be decomposed after the fact.
- Interpreting payload content, or letting a flow layer's state travel in the
  hop-visible extension field, would put endpoint state where intermediate
  nodes can read and eventually depend on it.
- Serving both directions with one label field would couple the reverse path
  to the forwarding path, after which neither can change independently.
- Hardcoding the destination endpoint as the forwarding key, rather than
  passing a key, makes a richer classification a change to every call site
  that resolves one.
