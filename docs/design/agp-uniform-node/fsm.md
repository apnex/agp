# AGP uniform node - connection FSM

> **Status:** Ratified implementation design with transport-sovereignty
> amendment (2026-07-30). Release
> certification remains governed by `verification.md`.

## 1. Model

AGP retains the BGP-inspired states:
```text
Idle -> Connect / Active -> OpenSent -> OpenConfirm -> Established
```

They describe one local session controller, not a node role.\
A controller records how its transport was acquired:
```ts
type Acquisition =
  | { kind: "dial"; adjacencyId: string }
  | { kind: "accept"; listenerId: string };

type Direction = "outbound" | "inbound";
```

That distinction controls retry ownership only.\
Once `OpenSent` is reached, both acquisitions use the same FSM rows, protocol language, route import and export machinery, data path, timers, and teardown.

`Acquisition` is internal controller authority.\
The public schema-generated `Direction` is a read-only projection with one fixed mapping: `dial -> outbound` and `accept -> inbound`.\
No public `direction` value is read back to select retry, message legality, or any other FSM action.

The node listener and configured `AdjacencySupervisor` are outside the session FSM:

- the listener turns an accepted conforming packet channel into `StartAccept`
  followed by `TransportAccepted`;
- the supervisor turns desired outbound adjacency into `StartDial`, owns
  reconnect policy, and suppresses dialing while another winning session
  satisfies the remote-node adjacency;
- the node's session directory performs post-OPEN collision resolution.

---

## 2. State meanings

| State | Meaning | Transport | Allowed wire input |
|---|---|---|---|
| `Idle` | No active attempt; terminal for an accepted session or administratively stopped dial adjacency | none | none |
| `Connect` | One configured connection attempt is acquiring a packet channel | opening | none |
| `Active` | Waiting for accepted transport dispatch or a configured retry opportunity | none or not yet adopted | none |
| `OpenSent` | Packet channel adopted and local OPEN sent; remote OPEN/admission pending | open | `open`, `notification` |
| `OpenConfirm` | Remote OPEN admitted and local KEEPALIVE sent; peer confirmation pending | open | `keepalive`, `notification` |
| `Established` | Symmetric route exchange and JSON data are legal | open | all v1 types except another `open` |

A transport reporting a channel acquired never implies `Established`.

---

## 3. Controller state and invariants

One controller owns:

- one fresh six-lowercase-hex local `sessionId` per transport attempt;
- zero or one transport handle;
- acquisition evidence and, for dialed attempts, configured adjacency ID;
- zero or one admitted remote `(nodeId, sessionId)` and negotiated limits;
- one inbound route revision and per-session Adj-RIB-In;
- one outbound route-update slot, one coalesced desired successor, and
  acknowledged Adj-RIB-Out;
- zero or one bounded pending inbound route-admission continuation;
- timers, bounded queues, counters, and the last transition;
- tokened asynchronous identity/route-admission continuations.

`lastTransition` means the most recently committed semantic FSM event, including a self-transition such as `Established -> Established` on `KeepaliveReceived`.\
It is therefore the canonical source for CLI `LAST_EVENT`, not merely the last event that changed the state name.

Global FSM invariants:

1. Before remote identity admission, a fresh local session ID is reserved
   node-wide and the public record is a `PreIdentityControllerSnapshot`; it has
   no `remoteNodeId`, route authority, or pair-scoped session key.
2. After remote identity admission, a retained local session ID is unique only
   among live controllers to that same `remoteNodeId`; public lookup uses
   `(remoteNodeId, localSessionId)` and private authority uses exact controller
   identity.
3. Remote identity and negotiated values become authoritative together on
   `OpenSent -> OpenConfirm`; that transaction atomically replaces the
   pre-identity projection with an admitted `SessionSnapshot`.
4. Only `Established` accepts route updates, route acknowledgements, data, or
   recoverable errors.
5. Any departure from `Established` atomically purges the session's
   Adj-RIB-In and invalidates its Adj-RIB-Out before releasing its transport.
6. Protocol messages, timer firings, transport callbacks, and node commands
   enter one serialized executor.
7. External admission callbacks and application handlers never run inside that
   executor.
8. A stale callback/timer token cannot mutate a replacement session.
9. An accepted session never redials itself.
10. A configured supervisor does not redial while any collision-winning session
   to its expected remote node is live.
11. A fatal notification cannot return a session to `Established`; a
    recoverable `error` does not itself change state.
12. Each exact controller incarnation has one transport-disposition latch; the
    first acquisition failure, input rejection, terminal read/write outcome,
    write deadline, or administrative release owns teardown and all later
    transport completions are mechanically observed but semantically
    suppressed.
13. Every ended attempt emits exactly one mutually exclusive teardown event:
    `connection.preidentity-closed` when remote identity was not authoritative
    at the causal transition, otherwise pair-scoped `session.closed`. Claimed
    or configured identity is never substituted for an authoritative
    `remoteNodeId`.

---

## 4. Semantic events

| Event | Source | Meaning |
|---|---|---|
| `StartDial` | adjacency supervisor | Begin one configured outbound attempt |
| `StartAccept` | listener | Initialize a controller for an accepted transport |
| `Stop` | node lifecycle | Administratively terminate |
| `TransportOpened` | transport | Initiated conforming packet channel acquired |
| `TransportAccepted` | transport | Accepted conforming packet channel acquired |
| `TransportFailed` | transport | Current acquisition or adopted channel failed and won the controller's transport-disposition latch |
| `TransportClosed` | transport | A graceful remote channel terminal won the latch; an expected local close is teardown completion, not this event |
| `TransportInputRejected` | transport/binding | Common `PACKET_TOO_LARGE` or `MALFORMED_CARRIER_INPUT` rejection before protocol decoding |
| `OpenReceived` | protocol | Schema-valid OPEN |
| `KeepaliveReceived` | protocol | Schema-valid KEEPALIVE |
| `RouteUpdateReceived` | protocol | Schema-valid authoritative route snapshot |
| `RouteAckReceived` | protocol | Schema-valid route acknowledgement |
| `DataReceived` | protocol | Schema-valid routed JSON message |
| `ErrorReceived` | protocol | Schema-valid correlated nonfatal error |
| `NotificationReceived` | protocol | Schema-valid fatal notification |
| `InvalidMessage` | protocol | Invalid UTF-8, JSON, schema, semantics, or duplicate member in an accepted packet |
| `UnexpectedMessage` | dispatcher | Valid known message in an illegal state |
| `IdentityAdmissionResolved` | admission port | Tokened remote identity decision |
| `RouteAdmissionResolved` | admission port | Tokened import-policy decision |
| `AdmissionExpired` | clock | Current admission deadline expired |
| `AdmissionFaulted` | wrapper | Admission callback threw or returned invalid data |
| `LocalRoutesChanged` | routing executor | Desired Adj-RIB-Out may have changed |
| `RouteUpdateWritten` | writer | Exact outstanding packet crossed the transport's ordered send-acceptance point |
| `RetryExpired` | clock | Configured reconnect delay elapsed |
| `OpenExpired` | clock | OPEN/confirmation deadline elapsed |
| `KeepaliveExpired` | clock | No outbound AGP message within keepalive interval |
| `HoldExpired` | clock | No valid inbound AGP message within hold interval |
| `RouteWriteExpired` | clock | Outstanding update was not written in time |
| `RouteAckExpired` | clock | Written update was not acknowledged in time |
| `RouteRevisionRollover` | route export | A changed snapshot would exceed the safe wire revision |
| `ControlQueueOverflow` | writer | Mandatory notification/ACK/error cannot reserve bounded control capacity |

Carrier-private liveness may terminate an unusable channel but cannot emit an AGP keepalive event or refresh an AGP protocol timer.

### 4.1 Closed reconnect disposition

Only a configured dial adjacency can schedule another attempt.\
Its terminal cause has one closed disposition:

| Cause | Supervisor disposition |
|---|---|
| Transport open/read/write/close failure, graceful remote channel closure, transport input rejection, open expiry, hold expiry, route write/ACK expiry | Retry with configured bounded backoff |
| Remote `HOLD_TIMEOUT`, `ROUTE_REVISION_ERROR`, or `INTERNAL_ERROR` | Retry with configured bounded backoff |
| `ADJACENCY_COLLISION` | Suppress this loser while the canonical winning adjacency exists; resume configured retry only after winner loss |
| `CEASE`, `UNSUPPORTED_VERSION`, `INVALID_MESSAGE`, `UNEXPECTED_MESSAGE`, or `IDENTITY_REJECTED` | Terminal; no automatic retry for that configured adjacency |
| Local node `Stop` | Terminal; disable retry |

An accepted controller always terminates without dialing.\
"Retry outcome" in the transition tables means exactly this table; an implementation cannot invent a different code set.

---

## 5. Timers

| Timer | Starts | Reset/stops |
|---|---|---|
| Retry | retryable dial-session termination when configured reconnect is enabled | next attempt; entry to `Established` resets backoff; stop disables |
| Open | local OPEN write admission | entry to `Established` or teardown |
| Keepalive | remote OPEN accepted when negotiated hold is nonzero | every successfully accepted outbound AGP packet, including data |
| Hold | remote OPEN accepted when negotiated hold is nonzero | every valid inbound AGP packet reaching ordered dispatch |
| Identity admission | immediately before invoking the identity port | matching result or teardown |
| Route admission | immediately before invoking the route-admission port | matching result or teardown |
| Route write | authoritative update occupies the dedicated outbound slot | exact write callback or teardown |
| Route ACK | exact outstanding update enters the send sequence | matching ACK or teardown |
| Transport write | each packet-channel send | ordered acceptance, rejection, or forced abort |
| Transport close | graceful close begins | close completion or forced abort |

The hold negotiation and keepalive interval retain the existing contract: either zero offer disables both protocol timers; otherwise hold is the lower offer and keepalive is `floor(hold / 3)`.

`connections.list` TTL is the remaining monotonic duration on the active hold timer, rendered at whole-second granularity.\
Canonical state stores the timer; each operations query materializes `remainingMs` from the monotonic clock at its single capture instant.\
It does not create a revision every second merely for presentation.

---

## 6. Transition tables

All omitted wire inputs are `UnexpectedMessage`: if a safe notification can be written, send `UNEXPECTED_MESSAGE`, then perform fatal teardown.

`InvalidMessage` in any channel-owning state sends `INVALID_MESSAGE` when that packet was safe enough to answer, invalidates any continuation, purges any session-owned routes, releases the channel, and follows the ordinary retry outcome or `Idle`.\
Before `Established`, the route purge is an empty operation.

In the tables below, **transport termination** is the exact event set `TransportFailed | TransportClosed | TransportInputRejected`.\
`TransportInputRejected` is non-graceful and uses the same supervisor retry disposition as `TransportFailed`; its mandatory following channel terminal is mechanical evidence suppressed by the already-claimed transport-disposition latch.

### 6.1 `Idle`

| Event / guard | Atomic actions | Next |
|---|---|---|
| `StartDial` / configured adjacency | allocate a node-wide-reserved fresh local session ID; publish the pre-identity controller; start dial | `Connect` |
| `StartAccept` / accepted transport supplied | allocate a node-wide-reserved fresh local session ID; publish the pre-identity controller; enqueue `TransportAccepted` | `Active` |
| `Stop` | idempotent cleanup | `Idle` |

### 6.2 `Connect`

| Event / guard | Atomic actions | Next |
|---|---|---|
| `TransportOpened` / exact current acquisition token and conforming channel | adopt channel; send OPEN; arm open timer | `OpenSent` |
| `TransportFailed` or `TransportClosed` | release partial transport; ask supervisor for retry | `Active` if armed, else `Idle` |
| `Stop` | cancel attempt and timers | `Idle` |

### 6.3 `Active`

| Event / guard | Atomic actions | Next |
|---|---|---|
| `RetryExpired` / configured dial acquisition | retire any prior admitted projection; clear remote authority; allocate a node-wide-reserved fresh local session ID; publish the pre-identity controller; dial | `Connect` |
| `TransportAccepted` / accepted acquisition | adopt transport; send OPEN; arm open timer | `OpenSent` |
| late `TransportOpened` / current dial token | adopt transport; send OPEN; arm open timer | `OpenSent` |
| terminal transport event / dial | ask supervisor for retry | `Active` if armed, else `Idle` |
| terminal transport event / accept | emit bounded `connection.preidentity-closed` evidence; remove controller | `Idle` |
| `Stop` | cancel retry/transport | `Idle` |

### 6.4 `OpenSent`

| Event / guard | Atomic actions | Next |
|---|---|---|
| first valid `OpenReceived` | validate offers; begin tokened identity admission outside executor | `OpenSent` |
| admission allowed / identity and capacity valid, collision winner | atomically commit remote identity and negotiation, release the node-wide ID reservation, and replace the pre-identity projection with the pair-scoped session; send KEEPALIVE; arm hold/keepalive | `OpenConfirm` |
| admission allowed / collision loser | send `ADJACENCY_COLLISION`; release | retry outcome / `Idle` |
| admission denied | send `IDENTITY_REJECTED`; release | `Idle` |
| admission fault | send `INTERNAL_ERROR`; release | `Idle` |
| admission/open expiry | invalidate token; release | retry outcome / `Idle` |
| transport termination | invalidate token; release | retry outcome / `Idle` |
| `NotificationReceived` | record; release | retry only when section 4.1 classifies its code `Retry`; otherwise `Idle` |
| `Stop` | send `CEASE` if safe; release | `Idle` |

Later OPENs and all non-handshake messages are fatal.\
Identity admission holds only that session's later wire commands behind a bounded continuation barrier; timer, transport, and stop commands remain runnable.

### 6.5 `OpenConfirm`

| Event / guard | Atomic actions | Next |
|---|---|---|
| `KeepaliveReceived` | stop open timer; reset hold/backoff; commit Established; schedule initial route snapshot | `Established` |
| `KeepaliveExpired` | send KEEPALIVE | `OpenConfirm` |
| hold/open expiry | send `HOLD_TIMEOUT` if safe; release | retry outcome / `Idle` |
| transport termination | release | retry outcome / `Idle` |
| `NotificationReceived` | record; release | retry only when section 4.1 classifies its code `Retry`; otherwise `Idle` |
| `Stop` | send `CEASE` if safe; release | `Idle` |

Sending the local KEEPALIVE is insufficient; only receiving the peer's confirmation establishes the session.

### 6.6 `Established`

| Event / guard | Atomic actions | Next |
|---|---|---|
| `KeepaliveReceived` | reset hold; update event/counters | `Established` |
| valid expected `RouteUpdateReceived` / no continuation pending | retain one bounded prevalidated proposal and token; arm route-admission timer; invoke the batch admission port outside the executor; engage this session's wire continuation barrier | `Established` |
| `RouteAdmissionResolved` / exact current token and complete valid result | apply policy/capacity decisions; atomically consume revision and replace this Adj-RIB-In; recompute RIB/FIB/exports; clear continuation; commit; enqueue ACK; release barrier | `Established` |
| `RouteAdmissionResolved` / stale token | discard without mutation | `Established` |
| `AdmissionFaulted` or `AdmissionExpired` / exact current route-admission token | invalidate continuation; send `INTERNAL_ERROR` if safe; purge session routes; release | retry outcome / `Idle` |
| route update / wrong revision or fatal semantics | send notification; purge session routes; release | retry outcome / `Idle` |
| `RouteAckReceived` / exact outstanding ref and revision | commit accepted/rejected Adj-RIB-Out; release slot; promote coalesced successor | `Established` |
| route ACK / no exact outstanding match | send `INVALID_MESSAGE`; purge; release | retry outcome / `Idle` |
| `DataReceived` / admissible local destination | reserve bounded handler capacity; commit receipt/event; invoke handler outside executor | `Established` |
| `DataReceived` / admissible transit | resolve selected route; reserve egress; record reverse breadcrumb; commit; enqueue one decremented packet | `Established` |
| `DataReceived` / source fails feasible-path authorization | enqueue no onward data; send correlated `SOURCE_NOT_AUTHORIZED` directly to ingress | `Established` |
| `DataReceived` / source authorized but route/transit/hop/egress/size/export/token/capacity guard fails | enqueue no onward data; send the one precedence-selected correlated error directly to ingress | `Established` |
| `ErrorReceived` / exact current breadcrumb from recorded egress | consume breadcrumb exactly once; resolve locally or relay to recorded ingress | `Established` |
| `ErrorReceived` / unknown, stale, or wrong egress | publish uncorrelated diagnostic; do not reply | `Established` |
| `LocalRoutesChanged` | recompute desired per-peer snapshots; admit update or coalesce successor | `Established` |
| `RouteUpdateWritten` / exact outstanding | switch finite write timer to ACK timer | `Established` |
| `KeepaliveExpired` | send KEEPALIVE | `Established` |
| `HoldExpired` | send `HOLD_TIMEOUT` if safe; purge; release | retry outcome / `Idle` |
| route write/ACK expiry | send `CEASE` if safe; purge; release | retry outcome / `Idle` |
| `RouteRevisionRollover` / no update outstanding | send `CEASE`; purge; release so a fresh session restarts at revision `1` | retry outcome / `Idle` |
| `ControlQueueOverflow` | purge; force-abort; record typed outcome | retry outcome / `Idle` |
| transport termination | purge; release | retry outcome / `Idle` |
| `NotificationReceived` | purge; record; release | retry only when section 4.1 classifies its code `Retry`; otherwise `Idle` |
| `Stop` | send `CEASE` if safe; purge; release | `Idle` |

Admission of a route snapshot may pause only that session's subsequent wire commands.\
It never blocks other sessions, state queries, timers, or node commands.\
The consumed route revision and ACK are committed only after the admission result remains current.

### 6.7 Route-admission continuation

Route admission is one batch decision for one prevalidated snapshot.\
The retained proposal contains the exact envelope ID, expected wire revision, canonical route list, static per-route rejections, controller identity, and a fresh continuation token.

The external port receives only immutable schema-backed route inputs.\
Its result must contain exactly one `allow` or `deny` decision for every route not already statically rejected, keyed by the complete `(endpoint, originNodeId, path)` tuple.\
Missing, duplicate, unknown, malformed, thrown, or late current results are admission faults; an explicit denial becomes that route's nonfatal `POLICY` rejection.\
Capacity admission then runs in canonical order over allowed routes before the one atomic replacement.

The route revision is not consumed and no ACK or RIB mutation occurs while the continuation is pending.\
Later wire commands from that exact session remain in its bounded ordered continuation queue.\
Timer, transport, notification, and stop commands bypass the barrier; any terminal command invalidates the token.\
Overflow of the bounded continuation queue is fatal because dropping a command would destroy the packet-channel FIFO contract.

The node executor-not a peer-session FSM-owns local SDK `send()`.\
It resolves local or peer next hop against canonical routing state.\
For peer egress it atomically revalidates the exact `Established` controller, allocates the hop-scoped return token, and reserves that controller's queue/breadcrumb before enqueuing a peer write.\
An application-local node therefore sends to a local endpoint without fabricating an `Established` session.

---

## 7. Teardown order

Every terminal path uses the same idempotent order:

1. claim the controller's transport disposition (or stop if an earlier cause
   already owns it), so later read/write/close/abort completions cannot re-enter
   teardown;
2. mark the controller non-Established so no new next hop resolves through it;
3. invalidate admission, timer, write, and handler tokens;
4. in one routing transaction remove its Adj-RIB-In, recompute selected
   alternatives/FIB/exports, invalidate its Adj-RIB-Out, remove breadcrumbs
   whose ingress became unusable, and convert breadcrumbs whose egress failed
   into bounded direct `NEXT_HOP_UNAVAILABLE` results where return ingress is
   still usable;
5. stop protocol timers and close/abort the neutral channel within a finite
   deadline, treating returned or subsequently observed terminal evidence as
   cleanup evidence only;
6. commit the final controller transition and exactly one teardown event:
   `connection.preidentity-closed`, keyed only by the temporarily node-wide
   `localSessionId`, if identity was not authoritative at step 1; otherwise
   pair-scoped `session.closed`; retain one bounded last terminal only when a
   configured dial controller remains in `Active` for retry, otherwise remove
   the controller snapshot;
7. notify the adjacency supervisor, which independently decides whether a
   future attempt is desired.

No data admission can interleave between steps 2 and 4.

A retained dial controller keeps the projection appropriate to its last ended attempt until retry begins.\
If that attempt had admitted identity, the pair-scoped `SessionSnapshot` and its last terminal remain queryable in `Active`; `RetryExpired` then clears that authority and replaces it with a new `PreIdentityControllerSnapshot` before dialing.\
An unadmitted attempt remains a pre-identity projection.\
Neither form is an unbounded history row.

---

## 8. Mechanics, rationale, and consequence

### Mechanics

One acquisition-neutral controller implements the six states, a symmetric Established matrix, finite protocol/control timers, tokened external continuations, and ordered teardown.

### Rationale

Keeping connection mechanics independent from topology preserves the useful BGP lifecycle model while allowing any node to listen, dial, or do both.\
Serial state changes and finite deadlines keep distributed failures observable and bounded.

### Consequence of violation

- Branching Established legality on inbound/outbound direction recreates
  protocol roles.
- Treating channel acquisition as Established admits routes/data before identity and
  limits are known.
- Purging routes after transport release exposes stale forwarding.
- Letting callbacks mutate directly makes snapshots timing-dependent.
- Allowing error replies to generate errors creates recursive failure traffic.
