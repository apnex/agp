# Admission lifetime design

Status: proposed design, not implementation verification or final adoption.\
Scope: identity and route admission after channel acquisition.

AGP should end an admission attempt without waiting for the provider to finish, while continuing to account for unfinished provider work.\
Use one admission-lifetime mechanism for identity and route policy, with a reader that never awaits a provider and a bounded queue for subsequent wire commands.

---

## Authority and scope

The director selected designing the admission-lifetime correction after recording Zorg's report.\
The fixed outcome is bounded session admission and teardown, not a new authentication scheme.\
The completed intent survey remains an input with all its qualifications: common semantics, truthful resource accounting, automatic connection recovery and no invented delivery certainty.\
Its socket-overlap choice is not treated as approval of a particular provider-work limit.

Explicit survey bypass: no new intent survey is needed to draft a correction to the already-ratified lifetime obligation under that selection.\
The recommendations below are technical proposals, not inferred stakeholder picks or approval of new public surfaces.\
If review changes the product outcome, that direction needs captured intent before commitment.

| Included | Excluded |
|---|---|
| Current identity and route callbacks, their deadlines and exact continuation authority | Credential format, PSK rotation, redemption location, IAP or issuer policy |
| Sole-reader progress, bounded continuation storage and terminal cleanup | New carrier, browser physical-release guarantees or runtime portability |
| Unfinished admission work, refusal at capacity and operational accounting | Worker/process isolation, arbitrary provider memory containment or CPU preemption |
| Existing OPEN lifetime through confirmation and node-stop dominance where they guard admission | General retry redesign, offline outbox, operation replay or the separate packet-depth question |
| Required runtime-terminal preflight and capacity-wait lifecycle integration | A general transaction framework or a new operations domain |

---

## Source baseline and related path


| Boundary | Observed implementation | Design consequence |
|---|---|---|
| Reader | `PeerController` awaits both `#handleOpen` and `#handleRouteUpdate`, which await their providers | Correct both through one mechanism; a timer race alone would still delay in-band notification and transport-terminal observation |
| Configuration | `TimerConfig` and `CapacityConfig` declare both admission timers and continuation queue limits; `resolveConfig` does not consume them | Make the existing settings effective and publish the resolved values |
| Invocation | Admission is invoked after dispatch even if the reducer did not authorize a `BeginIdentityAdmission` or `BeginRouteAdmission` action | Invoke only from an accepted, still-current admission action |
| Result authority | Identity retention runs before the reducer checks its token; route handling assigns `#pendingRoute` before that check | Guard before all effects, not only at the last reducer call |
| Error authority | `reduceOpenSent` and `reduceEstablished` token-check successful continuations, but their admission fault/expiry branches do not | Apply the same exact-token requirement to success, rejection, fault and expiry |
| Queue projection | `#connectionSnapshots` publishes a fixed empty continuation queue | Project the actual owned queue, including its byte/count limits and high-water marks |
| Cleanup | `#release` awaits notification write before close, then awaits the provider-blocked reader before `controllerReleased` | The teardown deadline must cover every wait it owns; reader completion cannot depend on provider settlement |
| OPEN confirmation | `ArmProtocolTimers` cancels the OPEN timer at identity commit; the timer contract stops it at establishment | Preserve the outer opening deadline through `OpenConfirm`, including when negotiated hold is zero |
| Operations exhaustion | `OperationsStore.commit` can replace a publication with terminal failure after node routing has already mutated, without changing runtime host authority | Make runtime-terminal integration a required internal prerequisite; preflight before effects, not after them |
| Capacity waiting | The node's timer/controller-derived projection has no capacity-wait meaning and the core supervisor is not its sole live state owner | Consolidate the existing retry path under one supervisor state and define its projection; do not instantiate a second retry scheduler |

Route import already has tuple/completeness validation in `RoutingTable.importSnapshot`, after the controller prepares its result.\
Do not copy a second routing validator into an admission wrapper.\
Factor the existing validation into a pure preparation step and a guarded commit so the route-continuation contract remains authoritative.

**Review refinement:** extracting that validator unchanged is insufficient.\
Today `validatePolicyDecisions` expects decisions for every input route, and static `LOOP`/`PATH_TOO_LONG` rejection follows it; the contract requires policy decisions only for routes not already statically rejected.\
Before invocation, validate the envelope, exact next revision and canonical snapshot, then prepare the immutable policy-eligible subset and retain static rejections separately.\
Validate the result against exactly that subset, including an empty subset.\
Compute available RIB capacity at the final serialized commit, because other sessions may change it while policy runs; do not reserve a stale global-capacity answer in the initial proposal.\
Neither the controller revision nor routing state may change until that complete preparation succeeds.

---

## Mechanics and ownership

| Owner | Responsibility | Boundary |
|---|---|---|
| Core FSM | Legal transitions, admission token and terminal disposition | No provider invocation, timer implementation or native resource control |
| Session controller | Exact incarnation, ordered wire dispatch, admission effects and teardown | Never awaits external admission on the reader or inside the executor |
| Admission lifetime | One evaluation's authority, monotonic deadline and cancellation request | No identity, collision, routing, transport or credential policy |
| Node admission work ledger | Reserve and retain finite evaluation capacity until actual settlement and result disposal | No authority to admit a peer or keep an ended connection live |
| Admission provider | Policy decision and the external work it starts | Cancellation cooperation, not control over AGP's session lifetime |
| Adjacency supervisor | The existing single retry owner | Capacity is an eligibility input, not a second retry loop |
| Node commit coordinator | Serialized preparation, preflight, runtime terminal barrier and publication | Core supplies pure plans and numeric-domain checks; no external policy or carrier callback runs in the commit |
| Core operations store | Exact numeric preflight, validated projection installation and immutable terminal capture | Does not independently terminalize the live node or reach into node-private ledgers |
| Transport | Its existing packet FIFO, terminal and resource-release contract | Admission does not introduce another reader or reinterpret abort as proven native release |

Compose internal admission-lifetime and work-ledger units with the existing `BoundedQueue`, `BoundedCapacity` and `ResourceLedger`.\
Keep them inside the runtime boundary; this work does not earn a generic public task framework.\
Identity and route policy supply their own request/result validation and commit actions to the same lifetime mechanism.

### Three lifetimes

| Lifetime | Starts | Ends | What remains possible afterwards |
|---|---|---|---|
| Result authority | Exact admission action accepted | Current result commits, deadline expires, or session/node revokes it | Accounting and disposal only; no identity, collision, route or ACK effect |
| Session cleanup | One terminal cause wins | Ordered channel terminal is consumed and owned cleanup completes | One bounded retry projection where the existing contract permits it |
| Provider-work reservation | Before external invocation | Permit revoked before invocation, or evaluation settles and AGP disposes its retained request/result | After invocation, no reset merely because the session ended or the abort signal fired |

An evaluation can finish before its serialized result is applied.\
Its capacity remains reserved while that result is waiting, preventing an unbounded queue of settled results behind the executor.\
Revocation detaches the result's session-effect target; a late observer retains only bounded work-accounting state, not a closure that keeps the controller and channel alive.

A reservation whose invocation permit is revoked before the provider is called can be released immediately.\
No evaluation began in that case; this is different from abandoning an already-started promise.

The ledger measures AGP port evaluations, not invisible descendant tasks started by a provider.\
A provider that answers from its own timeout race while leaving external work running still owns that work's cancellation and resource budget; its answered promise is not evidence of physical resource release.

---

## Admission sequence and invariants

1. In a short executor turn, validate the wire command and current controller, prepare immutable bounded inputs and the FSM's proposed admission action without changing live state.
2. Through the node commit coordinator, preflight and commit the action, work reservation, exact token and continuation barrier as one ordinary transaction; terminal replacement or capacity refusal invokes no provider.
3. Outside the executor, recheck the invocation permit and monotonic bounds, start the admission timer immediately before invocation, and observe both fulfilment and rejection.
4. Normalize a potentially current provider result outside the executor into bounded owned immutable data; reject invalid shape without retaining an unbounded copy. Property access, cloning and provider-controlled callbacks must not become application code running inside the executor.
5. Route the prepared completion through a short executor turn that checks the runtime authority gate, controller identity, admission kind, token and deadline; prepare all identity/collision or route effects, preflight the complete transaction and apply only its committed outcome. Enter ordered draining, not unrestricted direct dispatch.
6. On expiry or terminal disposition, revoke authority first, cancel its timer, detach its effect target and request cooperative cancellation outside the executor; proceed with session cleanup without joining the provider.
7. On eventual provider settlement, dispose the retained work and release its reservation exactly once; stale success and stale failure have the same lack of authority.

No asynchronous gap is permitted between the final invocation check and calling the provider, or between the final effect check and its serialized commit.\
Deadline validity is checked again at result application, not inferred from whether the timer callback has run.\
Promise settlement only queues continuation work; it does not establish that AGP already applied the result (ECMAScript promise reactions).

The reducer also rejects mismatched admission fault and expiry tokens as defence in depth.\
There must be no stale path to `retainIdentity`, collision termination, `#pendingRoute`, route replacement, revision consumption or ACK enqueue.\
Host `Stopping`, `Stopped` or `Failed` state revokes pending admission before a later provider result can commit, even if transport draining continues.\
Operational-domain exhaustion revokes through that same runtime gate, including when the attempted transaction itself discovers exhaustion.\
An operations receipt containing a terminal snapshot is not ordinary-commit authority.

Provider calls and abort-event delivery both stay outside the executor because either can run application code.\
Cancellation communicates a request; it cannot force an arbitrary promise to settle (DOM abort model).\
Providers must return promptly from synchronous code; hostile or CPU-blocking providers require isolation owned by their host, outside this correction.

---

## Ordered input and teardown

The reader awaits only channel reads and short runtime dispatch turns.\
While admission is pending or its backlog is draining, later ordinary wire commands enter the existing contract's per-session FIFO continuation queue, bounded by both original packet bytes and message count.\
There is at most one pending admission and one drain task per controller; processing a queued command that starts another admission stops that drain until the new result arrives.\
Yield between bounded drain batches so a full queue cannot starve another session or a timer.

**Correction - author review:** the original sequence said to "release the barrier and process queued wire commands in order" immediately after committing the result.\
That wording allowed a new arrival to bypass older queued commands during a drain yield.\
The barrier instead remains engaged through draining and opens only in the serialized turn that observes no pending admission, no queued command and no scheduled/in-progress drain.\
New ordinary arrivals join the same FIFO throughout; terminal commands still bypass it.\
Use the queue's head without releasing its reservation while the synchronous dispatch turn prepares the command; do not dequeue into a separate task queue.\
Dequeue only after dispatch has disposed the input or transferred it to another bounded owner, including a reserved evaluation record when another admission starts.\
The total bound distinguishes transport-ring storage, continuation storage, one read/dispatch item and retained evaluation inputs; a queue gauge is not a heap-size claim.

| Input while admission is pending | Treatment |
|---|---|
| Ordinary wire command, including KEEPALIVE, route ACK, data and disposition | Queue in arrival order; no protocol effect or hold-timer refresh before ordered dispatch |
| Fatal notification, invalid input, transport rejection or terminal | Bypass the barrier and use the one terminal disposition; preserve already-observed FIFO transport evidence |
| Timer, node stop or administrative terminal | Remain runnable through their existing owner; invalidate the pending token when terminal |
| Queue capacity would be exceeded | Proposed `ContinuationQueueOverflow` terminal event, with `INTERNAL_ERROR` notification only if safe; never drop one command and continue as if ordered delivery held |
| Packet read after logical release | Drain without protocol effects until the transport terminal, then stop the sole reader |

Reading ahead is not permission to apply a queued packet's peer-credit grant early.\
Receive-ring credit and continuation storage are distinct bounds: returning transport capacity must not release the queue's reservation.\
An admitted packet may become semantically inert after a session-fatal event, but the transport's already-accepted FIFO must still be drained; a second reader or an early read cancellation is not the correction.

Start one teardown budget when the terminal cause commits.\
The deadline actively stops the writer and aborts the channel even if notification write or graceful close has not settled; a signal passed only to a later `close()` call cannot bound an earlier wait.\
Observe the reader's final terminal and call `controllerReleased` once, independently of provider work.\
This relies on the existing conforming transport terminal contract, not a new promise of event-loop scheduling or browser-native release.

For an accepted connection, remove the ended connection projection after owned cleanup.\
For a configured dial adjacency, retain only the bounded terminal/retry projection permitted by FSM teardown; it owns no reusable admission authority.\
Do not retain a pending connection merely to account for unfinished policy work.\
Do not reset its work ledger on stop; stopped node instances cannot be restarted under the existing lifecycle contract.

---

## Timers and resource limits

These defaults are recommendations for review, not existing runtime behaviour or workload measurements.\
All limits resolve once, validate as finite positive safe integers, and appear in effective configuration.

| Setting | Proposed default | Reason and effect |
|---|---|---|
| Existing `identityAdmissionTimeoutMs` | `10000` milliseconds | Independent provider budget, consistent with the present default OPEN budget; the earlier applicable OPEN deadline still wins |
| Existing `routeAdmissionTimeoutMs` | `10000` milliseconds | Finite route-policy budget, including when hold is disabled; not a guarantee that the peer's ACK deadline will tolerate that delay |
| Existing `continuationQueueMessages` | Resolved `transportReceivePackets` | One explicit session queue with a familiar bounded count, not an unbounded promise chain |
| Existing `continuationQueueBytes` | Resolved `transportReceiveBytes` | Bound retained wire input; require room for one maximum-size received packet |
| Proposed `maxIdentityAdmissionEvaluations` | Resolved `maxPendingHandshakes` | A separate node-wide policy-work limit, not an extension of the listener's handshake accounting |
| Proposed `maxRouteAdmissionEvaluations` | Resolved `maxSessions` | One normal route evaluation per session with a finite aggregate ceiling |

The two proposed evaluation limits belong under `capacity` and can be configured independently of their default sources.\
Identity and route use separate pools so unadmitted identity work cannot consume every slot needed by established sessions' route policy.\
Both current and revoked-but-unsettled work consume their pool; neither timeout, connection replacement nor snapshot removal returns a slot.\
The request's protocol/schema limits bound the retained logical input size per call; these counts do not claim to bound a provider's arbitrary allocations or physical JavaScript heap bytes.

At capacity, refuse before provider invocation and report proposed `AdmissionCapacityExceeded`, not `IDENTITY_REJECTED` or a per-route `POLICY` denial.\
Its terminal effects follow the existing admission-fault cleanup and `INTERNAL_ERROR` reconnect disposition, but do not misreport a provider fault when no provider was called.\
The existing supervisor holds at most one capacity-wait record per eligible local dial adjacency; actual reservation release requests re-evaluation, subject to existing backoff, collision and stop guards.\
Remote refusals retain the existing reconnect classification; a remote error never proves that a local pool is full.

**Correction - author review:** the original proposal said "settlement wakes that supervisor".\
Settlement may leave a result awaiting application/disposal and therefore no free slot.\
Use a level check and waiter registration in the same serialized turn, and recheck after notification; notify on actual release, including a revoked pre-invocation permit.\
Capacity notifications coalesce rather than create a promise or retry timer per completion.\
Immediately before local acquisition, check identity-pool availability and any pool that caused that adjacency's prior local capacity refusal.\
Route-pool pressure alone does not prohibit an unrelated identity-only phase; a route-capacity refusal parks that affected adjacency on route capacity as well.\
At invocation, reservation remains atomic: an earlier eligibility check is not a reserved slot.\
Capacity wakes neither increment reconnect attempts nor restart an already-running backoff, and stop removes all wait records.\
This bounds local retained work and suppresses known local-capacity retry churn; it does not promise fair admission or suppress retries originating at remote peers.

| Proposed local event | Required treatment |
|---|---|
| `AdmissionCapacityExceeded` | Exact current admission kind/token; terminate once; retain which local pool refused for supervisor eligibility; no provider invocation or policy-denial result |
| `ContinuationQueueOverflow` | Exact live controller with engaged continuation barrier; terminate once; discard queued semantic work and drain transport evidence |

Both additions require coordinated core FSM, closed session-event schema/type and operations documentation changes.\
Neither introduces a wire code: a safe notification uses existing `INTERNAL_ERROR`, with existing bounded retry for configured dial adjacencies and no retry for accepted controllers.\
The existing terminal/transition events carry the distinction; do not add redundant per-cause counters merely to make the names queryable.

If a provider never settles, its slot stays occupied for that node instance's remaining lifetime.\
This deliberately favours bounded retained work over admitting unlimited replacements; recovery requires provider settlement or host-owned isolation/replacement with honest accounting for old work.\
Creating another node object does not prove that the old provider's resources stopped.

### Capacity wait lifecycle and projection

The node's existing retry owner remains the sole owner of one supervisor record per configured adjacency.\
Extend the core supervisor transition model and make node scheduling/projection consume it; remove competing state derivation from timer/controller maps for this path.\
Timers and capacity notifications are inputs to that owner, not separate retry engines.

The record holds the actual current attempt or winner, the existing backoff deadline/generation, at most one coalesced capacity waiter, and the local refusing-pool set from the most recently ended attempt.\
It also retains the last genuine terminal cause separately from the current capacity reason.\
At eligibility checks, identity capacity is always required; route capacity is required only when that set includes a local route-capacity refusal.\
Check levels and register the waiter in one executor turn; recompute blocked pools after every relevant release and immediately before acquisition.\
Availability is not a reservation, and provider invocation still reserves atomically.

Recommendation: reuse `AdjacencySnapshot.state = retry-wait` for waiting to start an initial or repeat acquisition, with or without a timer.\
Document three exact `lastReason` values for current local capacity restrictions: `identity-admission-capacity`, `route-admission-capacity`, and `identity-and-route-admission-capacity`.\
These are adjacency projection reasons, not session events, transport error codes or evidence of an issuer refusal.\
The internal supervisor reason type must represent them explicitly instead of casting them to `SessionReasonCode`.\
If both backoff and capacity block, the capacity reason is shown and `retryAt` still records the real timer; the genuine prior terminal cause stays in the retained connection projection.\
If no capacity restriction remains, show that prior cause while timed retry remains, or clear it when acquisition begins.

| Supervisor input and guard | Transition and ownership | Canonical adjacency projection |
|---|---|---|
| Initial acquisition eligible, identity pool full | Register one waiter; no attempt, session token or backoff is manufactured | `retry-wait`, capacity reason, no `retryAt`, no `activeControllerId`; `retryAttempt` unchanged |
| Initial acquisition eligible, required capacity available | Commit one actual acquisition start, then call the existing connect capability outside the executor | `dialing`, no capacity reason or `retryAt`; actual controller ID only if already allocated |
| Current identity/route invocation cannot reserve | Existing exact-token `AdmissionCapacityExceeded` ends that real attempt; remember its local refusing pool; after owned teardown the supervisor applies the ordinary reconnect disposition once | No replacement dial during cleanup; afterwards `retry-wait` if repeat is allowed, current capacity reason if blocked, `retryAt` only for a live backoff timer |
| Backoff running and capacity releases | Recompute levels; keep the original deadline and attempt count; remove waiter if no pool currently blocks | `retry-wait`; capacity reason if still blocked, otherwise prior terminal cause; original `retryAt` |
| Backoff expires but capacity is still unavailable | Consume only the timer; retain/register one waiter and the ended attempt projection | `retry-wait`, capacity reason, no `retryAt`; no new attempt |
| Backoff elapsed and capacity notification arrives | Recheck all levels and stop/collision/current-attempt guards; start once if eligible, otherwise keep waiting | `dialing` only on actual acquisition start; otherwise `retry-wait` with recomputed capacity reason |
| Capacity opens and is used elsewhere before this adjacency starts | The start-turn level check keeps the waiter; an older notification carries no permit | `retry-wait`, current capacity reason; retain a still-live timer only |
| Actual acquisition start commits | Clear the remembered refusing-pool set and capacity reason for the consumed wait; retire the previous terminal projection at this point, not merely when backoff expires | `dialing`; at most the new actual controller ID; no stale `retryAt` |
| Current attempt gains canonical identity ownership or another exact winner satisfies the adjacency | Clear waiter, backoff and remembered refusing pools; track the winning controller even if inbound; ordinary collision cleanup remains separate | `satisfied`, actual winning `activeControllerId`, no capacity reason or `retryAt`; the connection state distinguishes confirmation from Established |
| Exact satisfying winner is lost | Apply the existing reconnect disposition/backoff once; re-evaluate identity capacity, with no inherited refusing-pool set from the old loser | `retry-wait` when allowed, reason and `retryAt` as above; stale winner loss is inert |
| Terminal refusal or reconnect disabled after a real ended attempt | Clear waiter, timer and remembered pools; do not redial | `terminal`, actual cause, no `retryAt` or active controller |
| Node stop or failure | Invalidate supervisor generation and all start authority, clear timer/waiter/refusing pools | Ordinary stop/failure: `terminal`, `desired = false`, actual cause, no active controller or `retryAt`; operational-domain terminal capture removes adjacencies as already contracted |

`desired` remains true while the configured relationship is wanted; initial capacity waiting does not consume its initial-attempt entitlement.\
`reconnect.enabled = false` prevents repeat attempts, not the initial configured attempt or its pre-acquisition capacity wait.\
Only the existing real-failure/backoff transition changes `retryAttempt`; capacity observations never increment it or reset a running backoff.\
Satisfaction applies the existing successful-attempt reset.\
`retryAt` is the wall-time projection recorded when a real monotonic backoff timer is armed, not an estimate of when capacity will become available.

Remembered refusing pools persist across capacity fluctuations and backoff until one actual next acquisition begins; they are then consumed, not inherited indefinitely.\
A new local capacity refusal replaces the set for that newly ended attempt.\
Satisfaction, terminal disposition and stop/failure also clear it; remote refusal cannot add a local pool.\
Once an attempt is underway, changing pool levels does not retroactively cancel it: reservation at the relevant admission phase decides.

An ended dial controller's permitted last-terminal projection remains bounded and queryable while capacity blocks retry, but is not a live controller or admission target.\
The supervisor keeps the last cause without fabricating `activeControllerId`; timer expiry alone does not retire this projection or emit `RetryExpired` as though acquisition began.\
The retry-begin transition consumes it only when all eligibility guards permit the actual next attempt.\
On satisfaction by another winner or terminal adjacency disposition, remove the superseded ended-attempt row; maintain the one-row limit and the existing no-reusable-authority rule.

These are proposed semantic clarifications of existing fields, not an added public state or field; they still need contract agreement and checks of every operations reader.

Use monotonic elapsed time, tokened timer generations and deadline checks at invocation and commit.\
Chunk oversized host timer delays and round positive fractional remainders upward; cancellation of a scheduled callback alone is not a stale-generation guard.\
Node documents delayed callback execution and delay coercion, so a callback's scheduling is not proof that a deadline remains valid (Node timer semantics).\
The OPEN timer remains armed until `Established` or teardown; admission success cannot leave an unlimited confirmation phase when hold is zero.

---

## Public surface and migration choices

Recommendation: add one shared process-local `AdmissionEvaluationOptions` with a `signal` capability as an optional second parameter to both ports' `evaluate` methods.\
AGP always supplies it; existing one-argument implementations may ignore it.\
The signal owns only that pending evaluation; it is not an established-session close handle or a live credential-validity signal.\
Once a current result commits, later session events cannot reuse that evaluation's cancellation authority.\
Keep the request and result DTOs unchanged and credential-free, and keep clocks, callback handles and cancellation authority out of their schemas.\
There is no wire change.

| Choice | Benefit | Cost |
|---|---|---|
| Optional shared cancellation options, recommended | Both actual admission-provider seams can stop work promptly when supported | Public type/export review and compatibility checks; an ignored signal still requires the work ledger |
| Keep current one-argument ports | No port signature addition; internal lifetime safety still works | Providers cannot observe AGP cancellation, so their own deadline is the only cooperative cleanup mechanism |
| Require cancellation-capable providers | Stronger explicit provider obligation | Migration for every existing provider; still cannot guarantee that injected code honours cancellation |

Before adopting the recommendation, inventory providers through the public packages, compile existing one-argument implementations and a cancellation-aware implementation, and confirm the options do not leak into request schemas.\
Zorg's bounded wrapper stays useful and need not be removed; any use of the new signal would be an explicit consumer migration, not a downstream edit made by this design.

Use the existing `resources().gauges` shape for proposed `identityAdmissionEvaluations`, `routeAdmissionEvaluations`, `identityAdmissionRevokedUnsettled` and `routeAdmissionRevokedUnsettled` counts.\
The evaluation gauges include outstanding work and results awaiting disposal; the unsettled gauges count the revoked subset whose provider has not settled.\
They are node-scoped, survive removal of their connections, and carry current, maximum and high-water values without exposing principals, secrets or private handles.\
Publish real admission timers and continuation queue use through the existing connection fields.\
Record expiry and local capacity refusal through canonical transition/terminal events; late settlement changes work accounting, not session authority.\
Any additional diagnostic is bounded and observational; diagnostic-sink callbacks never drive control.

Ordinary stopped instances remain queryable: later settlement may update cleanup gauges without reopening the lifecycle or event subscriptions.\
The existing `OperationsStore.#commitMonotonicExhaustion` instead zeros resource gauges and freezes later commits.\
That path cannot truthfully turn unfinished admission work into released capacity.\
Do not reset the ledger, restart a numeric domain or claim fresh release evidence to conceal that projection gap.

### Terminal accounting recommendation

On operational-domain exhaustion, use the runtime handoff below to detach all effect authority and dispose work that can actually be disposed, then capture the remaining work ledger in the final terminal snapshot.\
Freeze its resource values, revision and `capturedAt` together; subsequent aggregate and focused queries return that same terminal capture, not a new timestamp on old counts.\
Outstanding provider evaluations remain nonzero at that capture when unresolved; later private disposal can release internal reservations but cannot publish a new revision, event or counter.\
The final count is last-known at the terminal capture, not a live promise that resources remain allocated or that cleanup has finished.\
Ordinary stopped instances retain live accounting until an operational-domain terminal barrier actually occurs.

This uses existing snapshot metadata instead of adding a second live operations domain or a freshness field for this one feature.\
It still needs explicit agreement on the terminal operations contract: releasing logical effect authority must not be described as releasing unfinished provider work.\
The current implementation's `#capture` samples wall time afresh even after terminal failure; preserving gauges without freezing that metadata would not implement this recommendation.\
If post-failure live cleanup telemetry is required, that is a separately designed authority/revision surface, not an undocumented exception here.

The new gauge keys, local event names, capacity fields and effective defaults require a coordinated type/schema/catalog/document update where applicable.\
Generic map extensibility is not permission to invent undocumented meanings, and no new public per-evaluation history endpoint is needed.

---

## Runtime terminal preflight and commit handoff

This is a required internal repair prerequisite of the admission correction, not a claim that the current OperationsStore already gates the runtime.\
The node owns one authoritative runtime gate and the serialized commit coordinator; the core owns pure transition/routing preparation and numeric-domain preflight.\
All runtime operations publications must reach this coordinator, including ones outside admission, so an unrelated counter/event/revision exhaustion revokes admission and acquisition authority too.\
No live-node call site may retain the old independent store-terminalization path.

One ordinary logical change follows this ordered contract, without yielding, recursive publication or external callbacks between preparation and installation:

| Phase | Owning action | Invariant |
|---|---|---|
| Prepare | The node asks the relevant core owners for bounded owned proposals against the current controller/directory/routing/ledger versions; gather proposed next states, complete projections, exact events/counter deltas and bounded outbound intents | No live identity retention, collision termination, FSM/route revision, RIB mutation, work-slot change or ACK/export enqueue has happened |
| Preflight | OperationsStore validates the complete projection and exact numeric cost, using its existing domain rules and canonical-change classification; return a one-use permit tied to this prepared change/current store version, or exhaustion evidence | The store does not publish or change lifecycle; failed semantic preparation is not numerical exhaustion |
| Final guard | Coordinator rechecks runtime authority, exact owners/tokens, monotonic deadlines and prepared versions immediately before consuming the permit | Expired/stale preparation is discarded or rebuilt before effects; the permit never crosses an asynchronous boundary |
| Ordinary commit | Consume the permit once; install the already-validated owned next states and canonical projection in the same executor turn | No subsequent validation or numeric check can turn the installed ordinary mutation into terminal replacement; no recursive operations commit from install actions |
| Effect dispatch | Return a tagged `committed` outcome with its revision and bounded post-commit intents; release only those intents through their existing owners | Controller code cannot treat a terminal receipt as successful admission; external callbacks run outside the executor and recheck exact live authority |
| Terminal replacement | On preflight exhaustion, discard the ordinary plan and enter the node-owned terminal sequence below; return `replaced-by-terminal` with its frozen capture, not success | None of the rejected transaction's ordinary effects occurs |

Already-terminal calls return `already-terminal` and the same frozen capture without effects, increments or another terminal transaction.\
Preparation must be complete: extracting only a numeric check ahead of the existing mutating route import or identity/collision methods is insufficient.\
Factor pure prospective directory/FSM/routing changes from installation, including any collision loser's cleanup effects that belong to the same logical change.\
Prevalidate all owned projection values and queue intents before installation; do not use mutation followed by rollback, a clone of the full node, or reentrant callbacks as the atomicity mechanism.\
Unexpected internal install faults are invariant failures with no ordinary post-commit dispatch; the design does not claim rollback from process failure or memory exhaustion.

The tagged outcomes describe an internal composition contract, not new SDK methods, wire messages or public snapshot fields.\
ACK/export intents are created with the plan but acquire writer authority only on `committed`; an asynchronous writer completion is a later guarded transaction, not a nested part of installation.\
Previously committed traffic is not retroactively reclassified as undelivered when a later transaction fails.

### One node owned terminal sequence

Within the serialized replacement turn:

1. Close the runtime gate and set host authority to `Failed`; invalidate the node generation, all admission invocation/result permits, acquisition adoption permits, supervisor wait/timer generations, and outstanding ordinary action intents.
2. Detach bindings and live controller/directory/routing authority, purge semantic queues and other logically releasable state through each owner's non-publishing terminal operation; transfer still-needed reader/channel cleanup to its existing bounded cleanup owner.
3. Release only uninvoked evaluation permits and actually disposable retained results; keep reservations for started unsettled evaluations and other genuinely retained resources. No provider callback or abort-event delivery runs here.
4. Gather the actual post-detachment retained-resource projection from node-owned ledgers and pass owned immutable values to OperationsStore; the store receives data, never a callback into those ledgers.
5. Install one terminal capture using the existing reserved numeric-domain rule, last valid counters and no ordinary events; freeze revision, values and capture time together, then complete event subscriptions.

After the turn, request cooperative abort and bounded transport/handler cleanup through the detached owners.\
These tasks cannot restore live authority, schedule retry or publish operations changes, even if they settle immediately.\
Unstarted external work remains unstarted; already-started work may release its private reservation only when actual disposal permits.\
Terminal cleanup cannot call the ordinary publishing purge/close methods recursively.\
A stop or listener-failure continuation already queued must observe the terminal gate and must not overwrite `Failed` with `Stopping` or `Stopped`, generate another revision, or rearm an adjacency.

The final capture preserves the contracted empty adjacency/connection/routing projections while separately retaining honest node resource counts.\
This is the explicit proposed clarification to the existing logical-release wording; neither an abort return nor removal from the snapshot counts as provider/native release.\
Ordinary stop remains distinct and may update cleanup accounting until a numerical terminal barrier supersedes it.

Before implementation can close this prerequisite, inventory every live runtime OperationsStore publication and each associated pre-publication mutation; route them through the same prepared-transaction/terminal gate or demonstrate they are effect-free.\
This is integration of the existing terminal contract, not a new generic transaction framework; admission must not be certified while an unmediated publication can leave runtime authority alive behind a terminal snapshot.

---

## Acceptance obligations

These are predicates for the correction's later verification, not executed reproductions or current passes.\
Exercise the shared mechanism at its owned boundary and preserve normal conforming traffic as controls.

| Obligation | Required observation |
|---|---|
| Timely identity result | Allow follows normal collision and confirmation rules; deny remains a policy refusal |
| Timely route result | Complete valid allow/deny decisions cause one atomic revision/RIB change and one ACK; per-route denials remain nonfatal |
| Deadline and terminal authority | Expired or revoked evaluations cannot acquire identity, displace a winner, import routes, consume a revision or enqueue an ACK |
| All continuation outcomes | Success, rejection, thrown/invalid result and timer callbacks obey the same exact current-token guard |
| Invocation permit | Illegal wire state, stale controller, stop or exhausted capacity causes zero provider invocations |
| Reader and barrier | One reader continues to terminal; arrivals during drain yields cannot overtake the backlog; barrier release is atomic with observing it empty; no hidden unbounded queue appears behind promises or executor submissions |
| Resource conservation | Current reservations never exceed their pool; logical expiry cannot decrease unfinished-work usage; actual settlement/disposal releases once |
| Cleanup independence | Session cleanup and its one terminal event do not require provider settlement; accepted connection removal and optional dial projection follow the contract |
| Teardown budget | Notification write, close and terminal drain are covered without an unbounded pre-close wait |
| OPEN and hold interaction | The opening deadline remains effective through confirmation, independently of admission and even with hold disabled |
| Route atomicity | Policy receives only the statically eligible subset and returns exactly one decision per requested tuple; current RIB capacity and complete validation precede the one committed revision and ACK; a failed preparation leaves no partial routing state |
| Isolation and recovery | Identity-pool pressure cannot consume route-pool slots; release cannot be missed between capacity check and waiter registration; a settled-but-retained result cannot enable another invocation; only the existing supervisor retries |
| Operational truth | Timer, queue and work gauges describe the same canonical state; removing a connection cannot make unfinished work disappear; numeric-domain failure preserves a truthful immutable terminal capture, including timestamp, without later public commits |
| Terminal replacement | Exact preflight replacement leaves no ordinary identity/collision/RIB/revision/ACK/export effect from that transaction; exhaustion from another runtime publication closes the same gate; no later invocation, stop completion or capacity wake bypasses it |
| Terminal capture ownership | Actual unresolved reservations survive authority detachment in the final capture; settled/uninvoked disposable work does not; private late disposal leaves all focused and aggregate captures unchanged |
| Capacity wait projection | Every table transition has the stated state/reason/retry-time/controller projection; initial waits need no session token; no timed retry means no `retryAt`; obsolete refusing pools clear on the named transitions |
| Single retry authority | Backoff, capacity, current attempt and collision satisfaction use one supervisor record; notifications cannot multiply timers/waiters, consume attempts, retire the last-terminal row early or restart after stop/failure |
| Compatibility | Current providers still type-check; new options remain process-local; no protocol-schema change or browser/CLI policy split |

No in-process acceptance claim includes stopping synchronous infinite computation, proving arbitrary provider allocations freed, or proving browser-native cleanup.\
Those are different ownership and isolation questions.

---

## Alternatives and consequences

| Alternative | Why it does not meet the whole correction |
|---|---|
| Race each provider promise with a timer on the current reader | Bounds that wait but still blocks in-band terminal/notification processing until the timer; accounting and pre-effect guards remain unsolved |
| Remove the connection snapshot on expiry | Changes the display without establishing reader, channel or provider-work ownership |
| Stop awaiting the reader during release | Can abandon already-accepted FIFO items and leave close waiting for their consumer |
| Abort the provider and immediately refund capacity | Treats a cancellation request as proof of completion and permits unbounded replacement work |
| Put the whole wrapper in each carrier or in Zorg | Duplicates session semantics across consumers and cannot correctly own AGP's collision, route or teardown commits |
| Isolate every provider in a worker/process | Could enforce a stronger termination boundary, but changes provider packaging and execution semantics beyond the existing callback contract |
| Leave the current implementation unchanged | Retains the source-backed lifetime defect and requires every consumer to compensate |

### Rationale

The reader, session and provider do not share one completion event.\
Separating their lifetimes allows connection cleanup to finish without falsely claiming that all external work has ended.\
One internal mechanism prevents identity and route handling from diverging, while separate policy ports preserve their distinct meanings.

### Consequence of violation

An expired callback that retains result authority can affect a different live session.\
A reader that waits for policy work cannot observe the transport termination it must drain.\
A refunded unfinished-work reservation converts finite connection limits into unbounded retained work across replacements.\
A hidden resource pool makes an unavailable provider appear to be an unexplained network or identity failure.
