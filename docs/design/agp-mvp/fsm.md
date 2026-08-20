# AGP MVP connection finite-state machine

| Field | Value |
|---|---|
| Status | Proposed |
| States | `Idle`, `Connect`, `Active`, `OpenSent`, `OpenConfirm`, `Established` |
| Wire contract | [protocol.md](protocol.md) |
| Intent source | [AGP MVP survey](../../../surveys/agent-gateway-protocol-mvp-survey.md), especially Q1 and design flag F2 |

## 1. Model and adaptation

AGP adopts the six BGP state names and their broad responsibilities. RFC 4271
defines `Connect` as waiting for transport establishment, `Active` as trying to
acquire a peer, `OpenSent` as waiting for OPEN, `OpenConfirm` as waiting for
KEEPALIVE/NOTIFICATION, and `Established` as the state in which updates are
exchanged
([RFC 4271 §8.2.2](https://www.rfc-editor.org/rfc/rfc4271.html#section-8.2.2)).

AGP adapts rather than copies that FSM:

- WebSocket replaces TCP and already includes an HTTP upgrade handshake.
- The MVP has a fixed spoke-initiates/hub-accepts topology, so BGP connection
  collision/double-active election logic is not imported. AGP instead has a
  simple one-live-controller identity gate and a retryable collision result.
- `Active` covers waiting for an acceptable inbound transport or a reconnect
  retry opportunity; it does not mean the protocol session is established.
- AGP OPEN, KEEPALIVE, endpoint update, notification, and data semantics replace
  BGP binary messages.
- Application data is valid only in `Established` and shares the control
  connection.

Only the AGP FSM state is authoritative for protocol eligibility. A WebSocket
library reporting `OPEN` does not mean AGP is `Established`.

## 2. FSM ownership and identifiers

One FSM controller owns one local AGP session lifecycle. It has:

- stable configured local `nodeId` and role;
- a new local `sessionId` for every transport establishment/reconnect;
- at most one internal `transportId`/WebSocket at a time;
- remote identity/session fields populated only after validated OPEN;
- timers, counters, last transition, and failure reason; and
- on the hub, the active accepted set/candidates plus bounded
  `lastClaimedEndpoints` from the most recently consumed update, plus
  `rejectedEndpoints` and rejection reason present only when that update was a
  consumed whole-set rejection.

A spoke owns one dedicated endpoint-update slot. It holds at most one
outstanding record—admitted but possibly unwritten, or written and awaiting a
response—containing its globally unique message ID, revision, complete set,
added-name registration binding tokens, and phase deadline. It also retains the
last ACKed export set plus exactly one bounded, unrevisioned coalesced successor
desired set. The local binding tokens never appear on the wire; they prevent a
late rejection from marking a closed-and-freshly-reexposed binding. The slot
never waits for capacity in the shared control queue. A bounded session-scoped
recent-send table of data-message `(id, source)` pairs classifies every
asynchronous data error as correlated or uncorrelated.

An identity- or endpoint-admission request records an immutable request,
session/transport token, unique callback token, deadline, and per-session
continuation barrier. Application callback code never runs on the canonical
state executor.

The hub listener is transport infrastructure, not a protocol session. On an
accepted WebSocket it creates a controller with a new `sessionId` in `Active`
and immediately delivers `TransportAccepted`. A spoke supervisor persists
through retry cycles, but allocates a new `sessionId` before every `Dial`; a
failed attempt does not reuse its identifier on the next reconnect from the
same running ID-source instance. The reference source emits a six-lowercase-hex
value by walking a node-local 24-bit space from a random start; it is not
globally unique and promises no persistence across process restart. Hub-local
controllers require noncolliding `owningSessionId` values in their router,
while remote identity is `(nodeId, sessionId)`. This is the lifetime boundary
recorded in
[ADR-0005](decisions/0005-identity-lifetimes.md).

No route or application message may hold a raw WebSocket reference. It resolves
a next-hop/session reference through the session registry at send time.

## 3. State meanings and invariants

| State | Meaning | Transport | Permitted wire input |
|---|---|---|---|
| `Idle` | administratively stopped or stopped after a permanent protocol failure | none | none |
| `Connect` | spoke is attempting WebSocket connection | opening | none |
| `Active` | waiting for inbound acceptance or retry opportunity | none, except an acceptance event | none |
| `OpenSent` | WebSocket open; local OPEN sent; waiting for peer OPEN | open | `open`, `notification` |
| `OpenConfirm` | peer OPEN accepted; local KEEPALIVE sent; waiting for peer confirmation | open | `keepalive`, `notification` |
| `Established` | negotiated AGP session can exchange route control and data | open | role-appropriate messages |

Global invariants:

1. There is zero or one active WebSocket per controller.
2. `remoteNodeId`, `remoteSessionId`, negotiated hold time, and peer receive
   limit become authoritative together on the `OpenSent → OpenConfirm`
   transition.
   Identity collision checks cover every existing identity-bound nonterminal
   controller, not only controllers already in `Established`.
3. Endpoint updates and data are accepted only in `Established`.
4. Leaving `Established` removes all advertisements/candidates owned by the
   session and recomputes selected/forwarding state **before** another data
   message can resolve through it.
5. A fatal notification always begins close and never returns to Established.
6. A recoverable `error` in Established is observable but does not transition.
7. Every transition is serialized through one event queue; timer, transport,
   and message callbacks never mutate the FSM concurrently.
8. Any accepted hub-side controller that enters terminal `Idle` publishes that
   final transition and is then removed from current-session state. No
   historical session archive is retained.
9. A spoke admits data from a local source only after an `endpoint.ack` has made
   that source part of its last ACKed export set.
10. An admitted outstanding endpoint update always has either a finite write
    timer or a finite response timer, independent of the negotiated hold timer.
11. Every adapter text-send invocation has a finite transport-write deadline;
    every graceful close has a finite close deadline and then force-aborts.
12. Admission callbacks cannot block other sessions, timers, queries, or route
    transactions, and a stale callback result cannot commit.
13. Local handler admission has no waiting backlog and atomically reserves both
    one execution slot and active payload bytes.
14. Urgent control uses one fatal slot, one coalescing keepalive slot, and a
    16-message/2-MiB ACK/error lane; endpoint update remains in its dedicated
    slot.

## 4. Event vocabulary

Events are semantic inputs to the session core, independent of a particular
WebSocket library:

| Event | Source | Meaning |
|---|---|---|
| `StartDial` | SDK/admin | enable an initiating spoke |
| `StartAccept` | listener | initialize a newly accepted hub-side controller |
| `Stop` | SDK/admin | deliberate stop |
| `TransportOpened` | adapter | outbound WebSocket handshake completed with `agp.v1` |
| `TransportAccepted` | adapter | inbound WebSocket accepted with `agp.v1` |
| `TransportFailed` | adapter | dial/handshake/send failure, including an adapter text-send deadline expiry after force-abort |
| `TransportClosed` | adapter | close frame or underlying connection loss |
| `TransportInputRejected` | adapter or codec | close-only input rejection: the adapter rejected binary, invalid-UTF-8, or general over-limit input, or the codec found a schema-valid version-1 OPEN above 4,096 bytes; the adapter/core has begun exact Close `1003`, `1007`, or `1009`, and records the typed permanent peer-input failure without an AGP notification |
| `InboundAdmissionOverflow` | adapter | a complete inbound WebSocket message cannot reserve bounded per-session/global input count or bytes; pending token is invalidated, `INBOUND_ADMISSION_OVERFLOW` is recorded, and transport is force-aborted without AGP notification |
| `OpenReceived` | codec | schema-valid `open` |
| `KeepaliveReceived` | codec | schema-valid `keepalive` |
| `EndpointUpdateReceived` | codec | schema-valid `endpoint.update` |
| `EndpointAckReceived` | codec | schema-valid `endpoint.ack` |
| `DataReceived` | codec | schema-valid data `message` |
| `ErrorReceived` | codec | schema-valid recoverable `error`; correlation is classified by FSM state |
| `NotificationReceived` | codec | schema-valid fatal `notification` |
| `VersionMismatch` | version dispatcher | safely parsed envelope has integer `agp` other than `1`; missing/non-integer is `InvalidMessage` |
| `InvalidMessage` | codec | malformed JSON, schema failure, or invalid type-specific syntax/semantics |
| `UnexpectedMessage` | dispatcher | schema-valid known message received in the wrong FSM state or role direction |
| `LocalEndpointsChanged` | spoke SDK | export the latest authoritative endpoint set |
| `EndpointUpdateWritten` | adapter | the outstanding update entered the WebSocket send sequence successfully |
| `RevisionRolloverRequired` | spoke session | a pending endpoint change would require a revision greater than the wire maximum |
| `ControlQueueOverflow` | wire scheduler | mandatory ACK/error could not reserve the fixed urgent-response lane; records `CONTROL_QUEUE_OVERFLOW` |
| `IdentityAdmissionResolved` | identity policy port | tokened immutable OPEN result is allowed or denied |
| `EndpointAdmissionResolved` | endpoint policy port | tokened immutable update result is allowed or denied with a proposed newly-added subset |
| `AdmissionExpired` | clock | the matching identity/endpoint callback exceeded its configured finite deadline |
| `AdmissionFaulted` | admission wrapper | the matching callback threw or produced a malformed result |
| `LocalDataSubmitted` | SDK | send locally originated data |
| `RetryExpired` | clock | reconnect delay elapsed |
| `OpenExpired` | clock | peer OPEN/confirmation did not complete |
| `KeepaliveExpired` | clock | outbound protocol-idle interval elapsed |
| `HoldExpired` | clock | no valid inbound AGP message within hold time |
| `EndpointWriteExpired` | clock | the admitted outstanding update did not enter the WebSocket send sequence |
| `EndpointResponseExpired` | clock | no exact ACK/rejection arrived for the written outstanding update |

WebSocket Ping/Pong is deliberately absent. It may cause an adapter to emit
`TransportFailed`, but it cannot emit OPEN/KEEPALIVE events or reset an AGP
timer. RFC 6455 defines Ping/Pong as WebSocket control frames
([§5.5](https://www.rfc-editor.org/rfc/rfc6455.html#section-5.5)).

## 5. Actions

The transition tables use these atomic actions:

| Action | Required effect |
|---|---|
| `AllocateSession` | create a fresh, locally noncolliding `sessionId` and reset attempt-scoped fields/counters |
| `Dial` | start one WebSocket opening handshake offering `agp.v1` |
| `AdoptTransport` | bind one open WebSocket to the current `sessionId` |
| `SendOpen` | emit local OPEN and start `OpenTimer` |
| `BeginIdentityAdmission` | after prospective negotiation/capacity validation, capture immutable OPEN input and prospective values, install a tokened per-session continuation barrier, finite deadline, and core-owned abort signal, then invoke policy outside the canonical executor |
| `AcceptOpen` | after an allowed current callback result, recheck collision across all identity-bound nonterminal controllers, revalidate and commit the precomputed hold/receive/endpoint negotiation, and bind identity-admitted remote fields |
| `SendKeepalive` | ensure the one coalescing keepalive slot is occupied; only successful adapter completion counts as emission and restarts `KeepaliveTimer` |
| `ResetHold` | restart `HoldTimer` after a valid received AGP message when enabled |
| `BeginEndpointAdmission` | capture the expected whole/add/current sets, install a tokened per-session continuation barrier, finite deadline, and core-owned abort signal, then invoke endpoint policy outside the canonical executor without consuming the revision |
| `ApplyEndpointUpdate` | on a current allowed result, consume the expected revision, record its complete set as last claimed, atomically replace the active set/candidates, and clear rejection context; on a valid denied result consume the revision and retain bounded complete-claim/new-addition rejection context without route mutation |
| `AdmitEndpointUpdate` | when the dedicated slot is empty, snapshot current desired registrations minus session-rejected bindings plus binding tokens for added names, assign and reserve the next revision, place the whole-set envelope in that slot, and start its endpoint-write timer without testing shared control-queue capacity; the receiver consumes that revision only when it accepts or rejects the update |
| `StartEndpointWriteTimer` | arm the finite local phase deadline at dedicated-slot admission |
| `StartEndpointResponseTimer` | stop the write timer and arm the finite response deadline when the exactly outstanding update enters the send sequence |
| `ResolveEndpointUpdate` | validate exact ACK/rejection correlation, stop the active phase timer, update ACKed/rejected state, and clear the current slot; after ACK immediately promote the latest coalesced snapshot if present, while after rejection always recompute and promote current desired bindings (including coalesced changes) minus session-rejected binding tokens; assign the next revision/timer or take revision rollover in that same operation |
| `ForwardOrDeliver` | classify source ownership/claim state and resolve a tagged next hop; for `NextHop.local`, atomically reserve one execution slot plus active payload bytes and commit a delivery token, then invoke the handler outside the executor; for `NextHop.session`, require Established, enforce its peer limit, and admit its bounded queue; otherwise return the defined failure |
| `SendNotification` | emit one fatal notification if safe, then reject further AGP input |
| `PublishError` | record/surface a recoverable error without state transition |
| `PurgeSessionRoutes` | atomically remove every session-owned advertisement/candidate, clear claim/rejection context, and recompute selection/forwarding |
| `ReleaseTransport` | invalidate admission tokens, stop protocol timers, start graceful WebSocket close with its finite deadline, force-abort on expiry, and clear transport/remote negotiated fields |
| `ScheduleRetry` | arm retry only when automatic reconnect is enabled |
| `RetryOrIdle` | for a spoke with automatic reconnect enabled, schedule retry and select `Active`; for a disabled spoke select `Idle`; for an accepted hub controller select terminal `Idle` and mark it for removal after the row's transition publication |
| `PublishTransition` | append structured transition and update the canonical snapshot |

`PurgeSessionRoutes` is idempotent. Any transition away from `Established`
invokes it before `ReleaseTransport` or retry scheduling.

## 6. Timers and retry policy

| Timer | Default | Starts | Stops/resets |
|---|---:|---|---|
| `RetryTimer` | enabled; initial 1,000 ms, maximum 30,000 ms, multiplier 2, jitter ratio 0.2 | retryable transport/open/hold/identity-admission/endpoint-write/endpoint-response/collision or revision-rollover event when automatic reconnect is enabled | entry to Established resets retry index; Stop disables |
| `OpenTimer` | `openTimeoutMs`; default 10,000 ms, range 1–300,000 ms | after local OPEN | on entry to Established or any teardown |
| `KeepaliveTimer` | `floor(negotiatedHold/3)` | after peer OPEN accepted when hold non-zero | successful adapter completion for any outbound AGP message resets; teardown stops |
| `HoldTimer` | negotiated OPEN hold | after peer OPEN accepted when non-zero | every valid inbound AGP message resets when it reaches ordered session dispatch; teardown stops |
| `IdentityAdmissionDeadline` | configured `identityAdmission.timeoutMs`; default 5,000 ms, range 1–300,000 ms | immediately before invoking an identity port outside the executor | matching current result or any token-invalidating teardown |
| `EndpointAdmissionDeadline` | configured `endpointPolicy.timeoutMs`; default 5,000 ms, range 1–300,000 ms | immediately before invoking an endpoint port outside the executor | matching current result or any token-invalidating teardown |
| `EndpointWriteTimer` | `endpointResponseTimeoutMs`; default 10,000 ms, configurable 1,000–300,000 ms | when an `endpoint.update` is admitted to its dedicated slot | matching `EndpointUpdateWritten` or teardown stops; unrelated input never resets |
| `EndpointResponseTimer` | `endpointResponseTimeoutMs`; default 10,000 ms, configurable 1,000–300,000 ms | after the outstanding `endpoint.update` enters the WebSocket send sequence | exact `endpoint.ack`/`ENDPOINT_REJECTED` or teardown stops; unrelated input never resets |
| `TransportWriteDeadline` | `transportWriteTimeoutMs`; default 10,000 ms, range 1–300,000 ms | every time the serialized writer invokes adapter text-send for any AGP envelope | successful adapter completion or teardown; rejection/throw/expiry force-aborts and emits `TransportFailed` |
| `TransportCloseDeadline` | `transportCloseTimeoutMs`; default 5,000 ms, range 1–300,000 ms | graceful close begins | close completion; expiry force-aborts and completes teardown |

Reconnect defaults are `enabled=true`, `initialDelayMs=1000`,
`maxDelayMs=30000`, `multiplier=2`, and `jitterRatio=0.2`. Delay fields are
integers in `1..300000` with maximum at least initial; multiplier is finite in
`[1,10]`, and jitter ratio is finite in `[0,1)`. For consecutive retry index
`n` starting at zero:

```text
base = min(maxDelayMs, initialDelayMs * multiplier^n)  // saturating arithmetic
delay = clamp(1, maxDelayMs,
              round(base * (1 + jitterRatio * (2 * random.nextUnit() - 1))))
```

The scheduler samples exactly once for each armed retry, resets `n` on entry to
`Established`, and consumes no random value when jitter is zero or retry is not
armed. The injected `RandomPort` must return a finite value in `[0,1)`; an
invalid value is local `INTERNAL` and schedules no retry. An injected monotonic
clock and random port make tests deterministic. With reconnect disabled,
retryable cleanup enters `Idle`; explicit `StartDial` remains permitted.

The local OPEN offer defaults to a 30-second hold time. Both sides use zero if
either offers zero; otherwise both use the smaller offer. A zero hold disables
both AGP hold and keepalive timers, not WebSocket failure detection or the
admission, endpoint write/response, transport-write, or transport-close
deadlines.

BGP similarly has ConnectRetry, Hold, and Keepalive timers and recommends a
keepalive interval of one third of hold time
([RFC 4271 §10](https://www.rfc-editor.org/rfc/rfc4271.html#section-10)).
AGP chooses shorter application-component defaults and does not import BGP
route-advertisement timers.

Admission callbacks are continuations, not new BGP states. Starting one leaves
the controller in `OpenSent` or `Established`, records a unique
session/transport/request token, and places only that session's later wire
inputs behind a bounded ordering barrier. Callback code runs outside the
canonical executor. Completion posts a tokened event back to the owning
session; the core revalidates state and preconditions before one commit and
discards stale results.

Timer, lifecycle, and transport events bypass the wire-input barrier. In
particular, `AdmissionExpired`, `OpenExpired`, `HoldExpired`, `Stop`,
`TransportFailed`, `TransportClosed`, `TransportInputRejected`, and
`InboundAdmissionOverflow` invalidate the token and abort its core-owned signal
before cleanup, so they win over any later completion. Other
sessions, timers, queries, and route transactions continue while the callback
is pending. Inability to reserve the bounded inbound count/byte budgets
force-aborts that session without trying to manufacture a correlated
`BACKPRESSURE` response.

The expected endpoint update itself resets hold before its callback starts.
Later wire input waiting behind the continuation barrier does not reset hold
merely by entering the inbound queue. `HoldExpired` can therefore invalidate
the token and win before a queued keepalive is dispatched.

## 7. Transition table

`RetryOrIdle` below is role- and configuration-guarded: a dialling spoke goes
to `Active` and arms retry only when automatic reconnect is enabled. A disabled
spoke goes to `Idle`. An accepted hub-side controller publishes terminal
`Idle` and is then removed from current-session state. The independent hub
listener creates a new controller for a future accepted connection. `Permanent`
means go to `Idle` without automatic retry for either role. An explicit
`StartDial` remains valid after any disabled-retry outcome.

### 7.1 `Idle`

| Event / guard | Actions | Next |
|---|---|---|
| `StartDial` / local role is `spoke` | clear prior failure; `AllocateSession`; `Dial`; publish | `Connect` |
| `StartAccept` / accepted transport is present and local role is `hub` | clear prior failure; `AllocateSession`; publish; enqueue `TransportAccepted` | `Active` |
| `Stop` | idempotent cleanup and publish only if observable reason changes | `Idle` |
| anything else | ignore and increment invalid-local-event diagnostic | `Idle` |

### 7.2 `Connect`

| Event / guard | Actions | Next |
|---|---|---|
| `TransportOpened` / subprotocol is `agp.v1` | stop retry; `AdoptTransport`; `SendOpen`; publish | `OpenSent` |
| `TransportFailed` or `TransportClosed` | release partial transport; `RetryOrIdle`; publish | `Active` (reconnect enabled) / `Idle` (disabled) |
| `RetryExpired` | abort stale attempt; `AllocateSession`; `Dial`; publish retry attempt | `Connect` |
| `Stop` | release partial transport; stop timers; publish | `Idle` |
| any wire-message event | impossible without open transport; treat as local adapter fault | `Connect` |

A handshake that does not select `agp.v1` is `TransportFailed`; no AGP
notification can be sent because the subprotocol was not established.

### 7.3 `Active`

| Event / guard | Actions | Next |
|---|---|---|
| `RetryExpired` / dialling spoke and enabled | `AllocateSession`; `Dial`; publish | `Connect` |
| `TransportAccepted` / local role hub, subprotocol `agp.v1` | `AdoptTransport`; `SendOpen`; publish | `OpenSent` |
| late `TransportOpened` / valid current dial attempt | stop retry; `AdoptTransport`; `SendOpen`; publish | `OpenSent` |
| `TransportFailed` or `TransportClosed` / dialling spoke | release; `RetryOrIdle`; publish failure | `Active` (reconnect enabled) / `Idle` (disabled) |
| `TransportFailed` or `TransportClosed` / accepted hub controller | release; publish terminal failure; remove current session | `Idle` then removed |
| `Stop` | stop retry; release; publish | `Idle` |
| any wire-message event without adopted transport | ignore as stale callback and count | `Active` |

### 7.4 `OpenSent`

| Event / guard | Actions | Next |
|---|---|---|
| `OpenReceived` / schema, complementary roles and valid offers, but local spoke desired registrations exceed the prospective negotiated endpoint cap | `SendNotification(ENDPOINT_CAPACITY_MISMATCH)`; release; publish permanent failure; invoke no identity callback; export no subset | `Idle` |
| `OpenReceived` / schema, complementary roles, valid offers, prospective capacity valid, and no identity request pending | `BeginIdentityAdmission`; remain behind the tokened per-session continuation; publish pending admission | `OpenSent` |
| `IdentityAdmissionResolved` / exact current token, allowed, but identity now collides with another identity-bound nonterminal controller | invalidate request; `SendNotification(IDENTITY_COLLISION)`; release; `RetryOrIdle`; publish retryable collision | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `IdentityAdmissionResolved` / exact current token, allowed and collision-free, but spoke desired registrations grew above the prospective cap while pending | invalidate request; `SendNotification(ENDPOINT_CAPACITY_MISMATCH)`; release; publish permanent failure; export no subset | `Idle` |
| `IdentityAdmissionResolved` / exact current token, allowed and collision-free | invalidate request; `AcceptOpen`; `SendKeepalive`; start/reset hold; publish identity-admitted session | `OpenConfirm` |
| `IdentityAdmissionResolved` / exact current token, denied | invalidate request; `SendNotification(IDENTITY_REJECTED)`; release; publish permanent failure | `Idle` |
| `AdmissionExpired` / exact current identity token | invalidate request; release/close locally **without AGP notification**; `RetryOrIdle`; publish admission timeout | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `AdmissionFaulted` / exact current identity token, callback threw or result is malformed | invalidate request; `SendNotification(INTERNAL_ERROR)`; release; publish permanent local failure | `Idle` |
| `IdentityAdmissionResolved`, `AdmissionExpired`, or `AdmissionFaulted` / token is stale or no identity request is pending | discard; increment stale-admission diagnostic | `OpenSent` |
| `VersionMismatch` | `SendNotification(UNSUPPORTED_VERSION)`; release; publish permanent failure | `Idle` |
| `OpenReceived` / role invalid | `SendNotification(ROLE_MISMATCH)`; release; publish permanent failure | `Idle` |
| `InvalidMessage` | `SendNotification(INVALID_MESSAGE)`; release; publish permanent failure | `Idle` |
| `UnexpectedMessage`, or schema-valid endpoint update/ACK/data/keepalive/error | `SendNotification(UNEXPECTED_MESSAGE)`; release; publish permanent failure | `Idle` |
| `NotificationReceived` / code `HOLD_TIMEOUT` or `IDENTITY_COLLISION` | record remote code; release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `NotificationReceived` / any other code | record remote code; release; publish permanent failure | `Idle` |
| `OpenExpired` | release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `TransportFailed` or `TransportClosed` | release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `TransportInputRejected` | record typed input rejection; release already-closing transport without AGP notification; publish permanent failure | `Idle` |
| `InboundAdmissionOverflow` | invalidate pending token; record `INBOUND_ADMISSION_OVERFLOW`; release already-aborted transport without AGP notification; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `Stop` | `SendNotification(CEASE)` if safe; release; publish | `Idle` |

### 7.5 `OpenConfirm`

| Event / guard | Actions | Next |
|---|---|---|
| `KeepaliveReceived` / local role spoke | stop open timer; `ResetHold`; reset retry backoff; atomically `AdmitEndpointUpdate` for the authoritative revision-1 set (including empty) ahead of application data; publish | `Established` |
| `KeepaliveReceived` / local role hub | stop open timer; `ResetHold`; publish | `Established` |
| `KeepaliveExpired` | `SendKeepalive`; publish counter only | `OpenConfirm` |
| `HoldExpired` or `OpenExpired` | `SendNotification(HOLD_TIMEOUT)` if safe; release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `VersionMismatch` | `SendNotification(UNSUPPORTED_VERSION)`; release; publish permanent failure | `Idle` |
| `NotificationReceived` / code `HOLD_TIMEOUT` or `IDENTITY_COLLISION` | record; release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `NotificationReceived` / any other code | record; release; publish permanent failure | `Idle` |
| `InvalidMessage` | `SendNotification(INVALID_MESSAGE)`; release; publish permanent failure | `Idle` |
| `UnexpectedMessage`, or schema-valid OPEN/endpoint update/ACK/data/recoverable error | `SendNotification(UNEXPECTED_MESSAGE)`; release; publish permanent failure | `Idle` |
| `TransportFailed` or `TransportClosed` | release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `TransportInputRejected` | record typed input rejection; release already-closing transport without AGP notification; publish permanent failure | `Idle` |
| `InboundAdmissionOverflow` | record `INBOUND_ADMISSION_OVERFLOW`; release already-aborted transport without AGP notification; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| stale admission result/deadline/fault event | discard; increment stale-admission diagnostic | `OpenConfirm` |
| `Stop` | `SendNotification(CEASE)`; release; publish | `Idle` |

The `OpenConfirm → Established` transition is the only establishment point.
Sending one's own KEEPALIVE is insufficient.

### 7.6 `Established`

| Event / guard | Actions | Next |
|---|---|---|
| `KeepaliveReceived` | `ResetHold`; increment counters | `Established` |
| `EndpointUpdateReceived` / wrong direction | `SendNotification(UNEXPECTED_MESSAGE)`; `PurgeSessionRoutes`; release; publish | `Idle` |
| `EndpointUpdateReceived` / wrong revision | `SendNotification(UPDATE_REVISION_ERROR)`; `PurgeSessionRoutes`; release; publish | `Idle` |
| `EndpointUpdateReceived` / spoke→hub, expected revision, schema-valid set exceeds negotiated cap | `ResetHold`; consume revision without route mutation; retain full claim and `CAPACITY` rejection context listing all newly added names in ascending unsigned UTF-8 byte order; send correlated `ENDPOINT_REJECTED`; publish | `Established` |
| `EndpointUpdateReceived` / spoke→hub, expected revision, within cap, and no names newly added versus current accepted set | `ResetHold`; invoke no endpoint callback; `ApplyEndpointUpdate` accepted branch; commit retain/withdraw route changes; send correlated `endpoint.ack`; publish | `Established` |
| `EndpointUpdateReceived` / spoke→hub, expected revision, within cap, one or more names newly added, and no endpoint request pending | `ResetHold`; `BeginEndpointAdmission`; consume no revision yet; publish pending admission | `Established` |
| `EndpointAdmissionResolved` / exact current token and allowed | invalidate request; `ApplyEndpointUpdate` accepted branch; commit route changes; send correlated `endpoint.ack`; publish | `Established` |
| `EndpointAdmissionResolved` / exact current token and denied with a canonical unique non-empty subset of names newly added versus the current accepted set | invalidate request; `ApplyEndpointUpdate` rejected branch with reason `POLICY`; send correlated `ENDPOINT_REJECTED`; publish | `Established` |
| `EndpointAdmissionResolved` or `AdmissionFaulted` / exact current token but callback threw or result/subset is malformed, empty, duplicate, retained, or out of request | invalidate request; `SendNotification(INTERNAL_ERROR)`; `PurgeSessionRoutes`; release; publish fatal local failure | `Idle` |
| `AdmissionExpired` / exact current endpoint token | invalidate request; `PurgeSessionRoutes`; release/close locally **without AGP notification**; publish admission timeout | `Idle` |
| stale admission result/deadline/fault event | discard; increment stale-admission diagnostic | `Established` |
| `EndpointUpdateWritten` / local role spoke, event matches the one outstanding update | `StartEndpointResponseTimer`; publish written/deadline state | `Established` |
| `EndpointUpdateWritten` / no exact outstanding match | ignore stale callback and increment adapter diagnostic | `Established` |
| `DataReceived` / local role hub, ingress owns selected active source and `NextHop.local` resolves to an active binding with one execution slot and its active payload bytes atomically reserved | `ResetHold`; start local handler with the unchanged logical envelope; increment counters | `Established` |
| `DataReceived` / local role hub, ingress owns selected active source and `NextHop.session` resolves Established, encoded envelope fits peer limit, and egress queue is reserved | `ResetHold`; forward unchanged wire envelope; increment counters | `Established` |
| `DataReceived` / local role hub, active ingress source candidate exists but is not selected | `ResetHold`; send recoverable `SOURCE_NOT_SELECTED`; increment reject counters | `Established` |
| `DataReceived` / local role hub, source is not active but is in retained last claimed rejected set | `ResetHold`; send recoverable `SOURCE_NOT_ACTIVE` with retained policy/capacity or not-installed reason; increment reject counters | `Established` |
| `DataReceived` / local role hub, source is not active and is not covered by the latest rejected last-claimed context | `SendNotification(SOURCE_NOT_OWNED)`; `PurgeSessionRoutes`; release; publish security violation | `Idle` |
| `DataReceived` / local role hub, `NextHop.session` envelope exceeds destination peer receive limit | `ResetHold`; send recoverable `DESTINATION_LIMIT_EXCEEDED`; increment reject counters; do not enqueue | `Established` |
| `DataReceived` / local role hub, no destination route, unavailable local/session next hop, zero-backlog local slot/byte reservation failure, or egress-session queue reservation failure | `ResetHold`; send matching recoverable `NO_ROUTE`, `DESTINATION_UNAVAILABLE`, or `BACKPRESSURE`; increment reject counters | `Established` |
| `DataReceived` / local role spoke, exact destination is locally registered and one execution slot plus payload bytes are atomically reserved | `ResetHold`; start local handler; increment counters | `Established` |
| `DataReceived` / local role spoke, destination is not locally registered or either zero-backlog handler reservation is unavailable | `ResetHold`; drop; emit local delivery-failure event/counter; no wire acknowledgement | `Established` |
| `EndpointAckReceived` / local role spoke, refId and revision match the one outstanding update | `ResetHold`; `ResolveEndpointUpdate` accepted branch, immediately promoting any successor; publish export convergence | `Established` |
| `EndpointAckReceived` / local role spoke, no exact outstanding match | `SendNotification(INVALID_MESSAGE)`; `PurgeSessionRoutes`; release; publish | `Idle` |
| `EndpointAckReceived` / local role hub | `SendNotification(UNEXPECTED_MESSAGE)`; `PurgeSessionRoutes`; release; publish | `Idle` |
| `ErrorReceived` / local role spoke, `ENDPOINT_REJECTED` fails exact refId/revision, ordered unique non-empty newly-added-subset validation, or `CAPACITY` does not accompany an over-cap request and exactly list all additions | `SendNotification(INVALID_MESSAGE)`; `PurgeSessionRoutes`; release; change no local rejection state; publish | `Idle` |
| `ErrorReceived` / local role spoke, valid `ENDPOINT_REJECTED` for outstanding update | `ResetHold`; mark only listed registrations whose current binding token matches the outstanding snapshot; retain application desired state; `ResolveEndpointUpdate` rejected branch, generating and immediately promoting the next full set excluding marked bindings; `PublishError` | `Established` |
| `ErrorReceived` / local role spoke, any recoverable data error has a known recent-send `refId`, and `SOURCE_NOT_ACTIVE` also exactly matches retained source | `ResetHold`; publish correlated `message.failed` evidence; change no endpoint export/admission state | `Established` |
| `ErrorReceived` / local role spoke, recoverable data error has unknown/evicted `refId` or mismatched `SOURCE_NOT_ACTIVE.source` | `ResetHold`; publish uncorrelated protocol-error event/counter; do not falsely attribute or change endpoint state | `Established` |
| `ErrorReceived` / local role hub | `SendNotification(UNEXPECTED_MESSAGE)`; `PurgeSessionRoutes`; release; publish | `Idle` |
| `VersionMismatch` | `SendNotification(UNSUPPORTED_VERSION)`; `PurgeSessionRoutes`; release; publish permanent failure | `Idle` |
| `NotificationReceived` / code `HOLD_TIMEOUT` or `IDENTITY_COLLISION` | record; `PurgeSessionRoutes`; release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `NotificationReceived` / any other code | record; `PurgeSessionRoutes`; release; publish permanent failure | `Idle` |
| `LocalEndpointsChanged` / local spoke, dedicated slot empty and next revision available | `AdmitEndpointUpdate` immediately; reserve the revision; publish current phase/deadline | `Established` |
| `LocalEndpointsChanged` / local spoke, update outstanding | replace/coalesce exactly one bounded unrevisioned successor with the latest desired set; publish successor state | `Established` |
| `LocalEndpointsChanged` / local spoke, dedicated slot empty but next revision would exceed the maximum | enqueue `RevisionRolloverRequired`; consume no revision | `Established` |
| `RevisionRolloverRequired` / local spoke, no update outstanding | `SendNotification(CEASE)` if safe; `PurgeSessionRoutes`; release; `RetryOrIdle`; publish; any next dial allocates a new session ID | `Active` (reconnect enabled) / `Idle` (disabled) |
| `LocalDataSubmitted` / spoke source is locally exposed, in last ACKed export, not rejected, encoded envelope fits hub `peerReceiveLimitBytes`, and hub-session queue is reserved | enqueue; local admission may resolve SDK send receipt | `Established` |
| `LocalDataSubmitted` / spoke source is otherwise admissible but encoded envelope exceeds hub `peerReceiveLimitBytes` | reject synchronously with SDK `MESSAGE_TOO_LARGE`; do not enqueue | `Established` |
| `LocalDataSubmitted` / spoke source is otherwise admissible but hub-session queue cannot reserve count/bytes | reject synchronously with SDK `QUEUE_FULL`; do not enqueue | `Established` |
| `LocalDataSubmitted` / spoke source is no longer locally exposed, is new/pending/outstanding but not yet ACKed, or is known rejected | fail/defer local admission with endpoint-closed/pending/rejected status; do not enqueue data | `Established` |
| `LocalDataSubmitted` / hub-local route resolver selected `NextHop.session` bound to this controller, encoded envelope fits peer limit, and queue is reserved | enqueue one data message; local admission may resolve SDK send receipt | `Established` |
| `LocalDataSubmitted` / hub-local `NextHop.session` envelope exceeds selected session peer limit | reject synchronously with SDK `MESSAGE_TOO_LARGE`; do not enqueue | `Established` |
| `KeepaliveExpired` | `SendKeepalive`; increment counters | `Established` |
| `HoldExpired` | `SendNotification(HOLD_TIMEOUT)` if safe; `PurgeSessionRoutes`; release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `EndpointWriteExpired` / local spoke still has the matching admitted, unwritten outstanding update | `SendNotification(CEASE)` if safe; `PurgeSessionRoutes`; release; `RetryOrIdle`; publish write timeout | `Active` (reconnect enabled) / `Idle` (disabled) |
| `EndpointWriteExpired` / outstanding update was written, resolved, or replaced | ignore stale timer event and increment diagnostic | `Established` |
| `EndpointResponseExpired` / local spoke still has the matching written outstanding update | `SendNotification(CEASE)` if safe; `PurgeSessionRoutes`; release; `RetryOrIdle`; publish response timeout | `Active` (reconnect enabled) / `Idle` (disabled) |
| `EndpointResponseExpired` / outstanding update already resolved or replaced | ignore stale timer event and increment diagnostic | `Established` |
| `ControlQueueOverflow` / mandatory hub ACK/error cannot reserve the fixed urgent-response lane | record outcome/counter `CONTROL_QUEUE_OVERFLOW`; `PurgeSessionRoutes`; force-abort/release without AGP notification; publish | `Idle` |
| `TransportFailed` or `TransportClosed` | `PurgeSessionRoutes`; release; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `TransportInputRejected` | record typed input rejection; `PurgeSessionRoutes`; release already-closing transport without AGP notification; publish permanent failure | `Idle` |
| `InboundAdmissionOverflow` | invalidate pending token; record `INBOUND_ADMISSION_OVERFLOW`; `PurgeSessionRoutes`; release already-aborted transport without AGP notification; `RetryOrIdle`; publish | `Active` (enabled spoke) / `Idle` (disabled spoke or hub) |
| `InvalidMessage` | `SendNotification(INVALID_MESSAGE)`; `PurgeSessionRoutes`; release; publish | `Idle` |
| `UnexpectedMessage`, duplicate schema-valid OPEN, or other invalid direction | `SendNotification(UNEXPECTED_MESSAGE)`; `PurgeSessionRoutes`; release; publish | `Idle` |
| `Stop` | `SendNotification(CEASE)` if safe; `PurgeSessionRoutes`; release; publish | `Idle` |

For every AGP envelope, the serialized writer starts
`TransportWriteDeadline` when it invokes adapter text-send. Adapter rejection,
throw, or deadline expiry force-aborts the transport and emits
`TransportFailed`; the FSM follows teardown rather than attempting an in-place
resend. This includes failure to admit a hub's mandatory `endpoint.ack` or
recoverable `error` to the fixed urgent-response lane, which first records
`CONTROL_QUEUE_OVERFLOW`, as well as failure to write it: the hub purges the
session's routes and cannot remain Established with a silently missing
response. Failure while already sending a fatal notification continues
teardown without a second notification. Graceful close is likewise bounded by
`TransportCloseDeadline` and force-aborts on expiry.

Mandatory response reservation is part of the triggering serialized event
transaction. If it fails, `ControlQueueOverflow` is raised inline before a
healthy transition/route result is published; teardown and any required purge
win instead.

One serialized writer owns each WebSocket send sequence. Its fixed
per-session urgent reservation is one fatal-notification slot, one coalescing
keepalive slot, and a FIFO lane of 16 ACK/error responses additionally bounded
to 2 MiB. Fatal is selected first; a pending keepalive is selected after the
current call and fatal, ahead of responses; responses precede data. Repeated
keepalive expiries coalesce. Failure to reserve a mandatory response emits
`ControlQueueOverflow`, records `CONTROL_QUEUE_OVERFLOW`, and force-aborts.
The endpoint update remains in its separate dedicated slot.

Data remains FIFO relative to data. An `endpoint.update` carries a queue
barrier: it cannot be written until all earlier-admitted data whose source it
removes has been written. It may overtake earlier data from retained sources,
while data from newly added sources stays locally inadmissible until the exact
ACK. The writer therefore cannot create a post-withdrawal source violation
through control prioritization.

Endpoint registration state and queued wire state are distinct. With no
outstanding update, the latest desired set is always admitted immediately into
the dedicated endpoint slot, assigned the next revision, and protected by
`EndpointWriteTimer`; shared control-queue occupancy is irrelevant. While that
slot is outstanding, repeated expose/close changes replace exactly one bounded,
unrevisioned successor snapshot. Exact ACK/rejection resolution atomically
clears the current slot. ACK promotes the latest coalesced snapshot if one
exists. Rejection always recomputes and promotes the current desired
bindings—including coalesced additions and withdrawals—minus every
binding-token-matched session rejection, even when the result equals the last
ACKed set. Promotion starts the next timer. This removes both the
no-outstanding/control-queue-full limbo and any need for a queue-writable
wakeup event.

The revision maximum is `9007199254740991`. Revisions never wrap or repeat
within a session. Once the maximum update has been consumed, the current
accepted set remains usable; a later endpoint change raises
`RevisionRolloverRequired`. It starts a new session at revision `1` when
automatic reconnect is enabled, or stops in `Idle` until explicitly restarted
when disabled.

A correlated `ENDPOINT_REJECTED` consumes the referenced revision at the hub
but installs none of its set. Its unique non-empty rejected names must all be
new additions relative to the hub's current accepted set and the spoke's last
ACKed export; retained accepted names stay active. A capacity rejection lists
all newly added names in ascending unsigned UTF-8 byte order. The spoke marks the bounded
`rejectedEndpoints` session-locally and immediately promotes a complete
successor excluding them, so no accepted-baseline inference is required.
Authorization of a previously accepted name is immutable for that session; a
changed policy takes effect only after natural session replacement or a
host-wide router stop/restart, which withdraws all old session routes. It is
not an update rejection. The rejection marker is keyed to that registration
binding/session: unrelated changes keep excluding it, closing the binding and
freshly exposing the same name clears that marker, and a new protocol session
clears all old markers.
Only one update may be outstanding, and an update becomes the spoke's active
export only on its exact `endpoint.ack`; new-source data remains inadmissible
until then. Connection loss discards pending/outstanding wire state and session
rejection marks, but retains application desired registrations; the next
automatic or explicitly started session retries them in one complete
revision-1 set. Pending, outstanding, ACKed, rejected, and coalescing state is
operationally visible.

Dedicated-slot admission starts the endpoint-write timer. It covers scheduler
and removed-source barrier waiting through successful adapter completion. The
adapter additionally starts the generic transport-write deadline when its
text-send call begins. `EndpointUpdateWritten` is emitted only after the
complete update has entered the WebSocket send sequence; that event stops the
endpoint-write timer and starts the response timer. Only the exact ACK or
rejection completes the response phase. Either endpoint phase's expiry closes
the session even when `holdTimeMs=0`, while a stalled active adapter call takes
the ordinary `TransportFailed` path. Thus one-outstanding flow control cannot
stall forever while unrelated traffic remains valid.

For a hub-local send, route selection and next-hop resolution occur in the
router composition before a particular session receives
`LocalDataSubmitted`; the session FSM does not independently select a route.
Only `NextHop.session` enters this table. A hub-local `NextHop.local` bypasses
the session FSM and atomically reserves one execution slot plus its active
payload bytes, with no waiting backlog. Failure of either
`inboundHandlerConcurrency` or `inboundHandlerBytes` reservation rejects
synchronously as SDK `QUEUE_FULL`; the reference bounds are 32 concurrent
handlers and 32 MiB, with the byte bound at least one maximum envelope. For a
spoke-ingress message, the same saturation returns correlated wire
`BACKPRESSURE`. Handler completion releases both reservations. After any
successful local admission, an asynchronous handler failure emits only a local
handler event/counter and changes no send receipt, route, or FSM state. The
same event-only rule applies when a receiving spoke's handler fails.
The canonical executor performs binding revalidation, reservation, and
delivery-token commit, then invokes application code outside the executor with
a core-owned `AbortSignal`. Completion re-enters with that token and releases
both reservations exactly once. Binding/session/host teardown or drain expiry
aborts the signal; entering `Stopping` alone lets a pre-stop handler settle
within the drain deadline. Stale settlement is discarded and cannot mutate
protocol or route state.
For a spoke send, the spoke has no hub RIB and proves only local source
registration, the complete encoded envelope fitting the hub session's
`peerReceiveLimitBytes`, plus admission to its Established bounded outbound
queue. Oversize fails synchronously as `MESSAGE_TOO_LARGE`. SDK send success
linearizes at atomic queue admission, before adapter serialization/write. In
neither case does a later write failure or correlated wire `error`
retroactively alter the resolved local send result.

At admission, a spoke records the data message's `(id, source)` in a bounded
session-scoped recent-send table (reference default 4,096 entries), evicting
the oldest record on overflow. Every recoverable data error is attributed only
when `refId` is present; `SOURCE_NOT_ACTIVE` additionally requires its source
to match. An exact known reference produces correlated `message.failed`
evidence. Missing, evicted, or source-mismatched correlation produces only an
uncorrelated protocol-error event/counter, never false attribution or session
close. Neither case mutates endpoint export/admission state. Teardown clears
the table.

### 7.7 Host-level stopping precedes session `Stop`

`Stopping` is a host lifecycle state, not a seventh connection-FSM state.
Calling SDK `stop()` first enters host `Stopping` and starts
`drainTimeoutMs`, an integer in `0..300000` with reference default 5,000 ms;
zero requests immediate expiry. In one canonical commit the host disables
listener/dial/retry work, rejects new local `send()`/`expose()` calls, preserves
registered bindings for a possible restart, gates new application work, and
continues only the control/liveness needed to drain work admitted before that
revision. Queries remain available during cleanup.

A spoke attempts an authoritative empty export snapshot through its dedicated
slot/successor without mutating the application registrations preserved for a
possible restart; the normal removed-source barrier writes older admitted data
first. While stopping, a hub does not forward/dispatch newly received spoke
data and returns correlated `BACKPRESSURE`; a spoke drops newly received data
with local `STOPPING_REJECTED` evidence because version 1 has no reverse
delivery-error direction. No new local handler is admitted. Existing handler
completion can contribute to drain but cannot enqueue follow-on work.

Drain completes when pre-stop admitted data queues have been written, active
local handlers have settled, and an admitted withdrawal has ACKed or no session
remains. The host then dispatches session `Stop`. The session table's `Stop`
row sends `CEASE` when safe and performs immediate purge/close; it is not
itself the drain phase.

On deadline expiry the host discards remaining pre-stop queued data, aborts
active-handler signals, releases every logical reservation exactly once,
increments loss-after-admission counters, then dispatches session `Stop` and
forces bounded teardown. The separate finite transport-close deadline bounds
the closing handshake. The host, not an individual session FSM, owns
`StopReport`: `drainedMessages` and `discardedMessages` partition only
application data still queued, in-flight, or executing at the stopping
revision. Already completed work and control documents are not counted. No
public per-session administrative stop is implied.

## 8. Teardown ordering

For every exit from `Established`, the session core performs one serialized
transaction:

1. mark the session non-forwardable;
2. stop accepting its route or data input;
3. remove all advertisements/candidates owned by its local `sessionId`
   (`owningSessionId` in route state);
4. recompute selected routes and forwarding entries;
5. publish route/forwarding changes;
6. close/release transport and clear negotiated fields;
7. publish the FSM transition; and
8. schedule retry only for an automatic-reconnect-enabled spoke after a
   retryable transport/open/hold/identity-admission/endpoint-write/
   endpoint-response/collision or revision-rollover event; a disabled spoke
   enters `Idle`, while a hub-side controller publishes terminal `Idle` and is
   removed from current session state.

This order prevents a route from resolving to a closed or replacement
WebSocket. RFC 4271 likewise deletes routes associated with a connection when
leaving Established
([§8.2.2](https://www.rfc-editor.org/rfc/rfc4271.html#section-8.2.2)).

## 9. Invalid input and close behaviour

- Fatal protocol conditions send one `notification` when safe, then use the
  WebSocket close mapping in [protocol.md](protocol.md#9-close-mapping).
- Binary, oversize, or invalid-UTF-8 input is a typed permanent peer-input
  failure: the adapter begins exact Close `1003`, `1009`, or `1007`, and the
  FSM closes without an AGP notification because no safe AGP document/result
  can be accepted. Inbound-capacity exhaustion, admission timeout, or another
  WebSocket-level transport error may likewise close without an AGP
  notification, but follows its separately defined retry policy.
- Once close begins, all later message callbacks are stale and ignored except
  for transport close completion.
- Identity-policy denial and version/role/schema/state or admission-callback
  faults end in `Idle` to prevent an automatic reconnect storm. For a dialling
  spoke with automatic reconnect enabled, transient `IDENTITY_COLLISION`,
  transport failure, OPEN or identity-admission timeout, local or remotely
  notified hold timeout, and endpoint write/response timeout enter `Active` and
  may retry. The same events enter `Idle` when reconnect is disabled; an
  accepted hub-side controller also terminalizes in `Idle`. Endpoint-admission
  timeout occurs only on the hub-side receiver and terminalizes that controller
  locally without a notification.
- A recoverable `error` never tears down a session. The MVP exposes no
  per-session administrative stop; host-wide router `Stop`/restart and natural
  session replacement remain observable lifecycle actions.

RFC 6455 requires an endpoint failing an established WebSocket connection to
close it and recommends sending an appropriate Close frame when possible
([§7.1.7](https://www.rfc-editor.org/rfc/rfc6455.html#section-7.1.7)).

## 10. Required operational projection

Every current session snapshot exposes at least:

```json
{
  "sessionId": "7a2f10",
  "nodeId": "hub-a",
  "role": "hub",
  "remoteNodeId": "spoke-a",
  "remoteSessionId": "9f2c10",
  "remoteRole": "spoke",
  "remoteIdentity": {
    "posture": "self-asserted",
    "method": "development-trust"
  },
  "direction": "inbound",
  "state": "Established",
  "transportState": "open",
  "stateSince": "2026-07-29T01:02:03.000Z",
  "establishedAt": "2026-07-29T01:02:03.000Z",
  "lastTransition": {
    "sequence": "6",
    "from": "OpenConfirm",
    "to": "Established",
    "event": "KeepaliveReceived",
    "reasonCode": "PEER_CONFIRMED",
    "at": "2026-07-29T01:02:03.000Z"
  },
  "transitions": [
    {
      "sequence": "6",
      "from": "OpenConfirm",
      "to": "Established",
      "event": "KeepaliveReceived",
      "reasonCode": "PEER_CONFIRMED",
      "at": "2026-07-29T01:02:03.000Z"
    }
  ],
  "transitionEventsDropped": "5",
  "negotiated": {
    "holdTimeMs": 30000,
    "keepaliveTimeMs": 10000,
    "peerReceiveLimitBytes": 1048576,
    "maxEndpointsPerSession": 64
  },
  "timers": {
    "hold": {
      "enabled": true,
      "durationMs": 30000,
      "remainingMs": 24880
    },
    "keepalive": {
      "enabled": true,
      "durationMs": 10000,
      "remainingMs": 4880
    },
    "identityAdmission": { "enabled": false },
    "endpointAdmission": { "enabled": false },
    "endpointWrite": { "enabled": false },
    "endpointResponse": { "enabled": false },
    "transportWrite": { "enabled": false },
    "transportClose": { "enabled": false }
  },
  "queues": {
    "inbound": {
      "currentMessages": "0",
      "maximumMessages": "256",
      "highWaterMessages": "2",
      "currentBytes": "0",
      "maximumBytes": "16777216",
      "highWaterBytes": "1384"
    },
    "outbound": {
      "currentMessages": "0",
      "maximumMessages": "1024",
      "highWaterMessages": "2",
      "currentBytes": "0",
      "maximumBytes": "16777216",
      "highWaterBytes": "654",
      "readinessReservedMessages": "0",
      "readinessReservedBytes": "0"
    },
    "urgentControl": {
      "fatalOccupied": false,
      "keepaliveOccupied": false,
      "responseMessages": "0",
      "maximumResponseMessages": "16",
      "highWaterResponseMessages": "1",
      "responseBytes": "0",
      "maximumResponseBytes": "2097152",
      "highWaterResponseBytes": "196"
    }
  },
  "counters": {
    "message.received": "7",
    "control.queue_overflow": "0",
    "inbound.admission_overflow": "0"
  },
  "endpointState": {
    "kind": "hub-received",
    "acceptedEndpointCount": 2,
    "consumedEndpointRevision": "1",
    "lastClaimedEndpointCount": 2,
    "lastClaimedEndpoints": ["orders/status", "orders/submit"],
    "rejectedEndpointCount": 0,
    "rejectedEndpoints": []
  }
}
```

Wall-clock timestamps are for operators; timer correctness uses a monotonic
clock. For compactness this example uses a transition-retention setting of one,
so the five earlier transitions are reflected in
`transitionEventsDropped`. The object inhabits the public `SessionSnapshot`
DTO; optional fields are absent rather than `null`. Snapshots additionally
expose retry delay, transport/negotiated state, last error/close, typed timer status, counters
including `CONTROL_QUEUE_OVERFLOW` and `INBOUND_ADMISSION_OVERFLOW`, and the
role-discriminated endpoint state. A spoke endpoint state carries its
outstanding dedicated-slot record, optional coalesced successor, and bounded
recent-send correlation count. They never expose a mutable WebSocket object,
payload/correlation contents, or credentials.

Transition events are append-only and carry a per-session monotonically
increasing decimal-string `sequence`. Only a current session retains a bounded
ring of at most its latest 64 transitions; counters preserve totals and the
dropped-history count. When a terminal hub session publishes its final event,
its current snapshot and ring are removed. Bounded live subscriber events may
still observe that transition, but AGP provides no terminal-session archive or
event replay. The CLI and HTTP layer do not infer FSM state from socket status
or logs.

## 11. Conformance matrix

At minimum, deterministic tests cover:

1. every non-ignore row in the transition tables;
2. OPEN success, role/version/permanent identity-policy failure, retryable
   collision after callback recheck, and confirmation;
3. endpoint update/data rejected in all pre-Established states;
4. keepalive and hold timers, including `holdTimeMs=0`;
5. Ping/Pong proving no effect on the AGP hold timer;
6. transport loss from every state;
7. fatal notification versus recoverable error;
8. atomic route purge before transition publication;
9. stale callbacks from a replaced `transportId`;
10. exact retry formula/defaults, one deterministic random sample, backoff
    reset after establishment, and no retry after permanent protocol failure;
11. whole-set replacement, empty-set withdrawal, consumed rejection, and
    next-revision resynchronization;
12. one-outstanding endpoint update, exact ACK/rejection correlation, and
    new-source data gated on ACK;
13. immediate dedicated-slot admission when empty, one unrevisioned successor
    coalescing while occupied, atomic resolution/promotion with no shared
    control-queue limbo, and rejection-time recomputation that preserves
    coalesced additions/withdrawals while excluding only current-token rejected
    bindings;
14. claimed-but-rejected data race versus fatal never-claimed source;
15. rejection subsets containing newly added names only, deterministic
    all-additions capacity rejection, retained authorization for the session
    lifetime, stale binding-token rejection isolation, and changed policy
    taking effect only after replacement/restart;
16. tagged local/session next-hop branches, a zero-backlog handler's atomic
    execution-slot plus payload-byte reservation, wire `BACKPRESSURE` versus
    local `QUEUE_FULL`, outside-executor invocation, abort/stale completion,
    exactly-once release, and event-only handler failure;
17. a spoke's synchronous `MESSAGE_TOO_LARGE` against the hub peer limit versus
    the hub's asynchronous `DESTINATION_LIMIT_EXCEEDED` for another egress;
18. endpoint-capacity mismatch plus collision detection against every
    identity-bound nonterminal controller;
19. endpoint-write and response timer success, rejection, expiry with
    `holdTimeMs=0`, and stale callbacks;
20. every adapter envelope write deadline, force-abort on stalled promises, and
    finite graceful-close fallback;
21. fixed fatal/keepalive/ACK-error reservations, keepalive coalescing and
    priority, plus `CONTROL_QUEUE_OVERFLOW` force-abort;
22. priority-control overtaking, removed-source update barriers, and data FIFO;
23. exact, evicted, unknown, and `SOURCE_NOT_ACTIVE` source-mismatched
    correlation for every recoverable data error, with no false attribution or
    endpoint-state mutation;
24. identity and endpoint callbacks running outside the executor with bounded
    per-session continuation ordering, finite deadlines, no-notification
    timeout, fatal malformed/throw result, and stale-result discard after
    teardown-capable timers/lifecycle events;
25. exact binary/invalid-UTF-8/general-oversize adapter rejection and fixed
    OPEN-oversize codec rejection mapping to `TransportInputRejected`,
    permanent no-notification teardown, and stale subsequent close callbacks;
26. per-session/global inbound count/byte overflow recording
    `INBOUND_ADMISSION_OVERFLOW` and force-aborting without misusing correlated
    `BACKPRESSURE`;
27. every retryable failure with automatic reconnect both enabled and disabled;
28. maximum-revision rollover without wrap or reuse;
29. recursive finite-binary64/safe-integer validation before lossy conversion;
    and
30. host `Stopping` gating, best-effort withdrawal, bounded drain of only
    admitted work/active handlers, hub `BACKPRESSURE` versus spoke
    `STOPPING_REJECTED`, deadline discard/abort accounting that partitions
    pre-stop application data, and session `Stop` after that orchestration.
