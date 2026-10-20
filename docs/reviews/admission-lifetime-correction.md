# Admission lifetime correction

Status: draft corrective design for `B53`, revised after author adversarial review; no public API, default, implementation or gate approval is implied.\
Scope: identity and route admission after channel acquisition, including ordered input and teardown.

AGP should end an admission attempt without waiting for the provider to finish, while continuing to account for unfinished provider work.\
Use one admission-lifetime mechanism for identity and route policy, with a reader that never awaits a provider and a bounded queue for subsequent wire commands.\
Neither a browser-specific controller nor a change to credential policy is required.

The correction fulfils existing [FSM obligations](../design/fsm.md); the proposed cancellation option and resource limits below are separate contract additions.\
The [finding](../VERIFICATION.md#421-identity-admission-timeout-and-teardown-finding) remains open until implementation and verification, not merely this design, satisfy those obligations.

The [author review](#author-adversarial-review) corrects ordering, capacity recovery, route preparation and terminal accounting.\
Independent design assurance and public-surface agreement remain outstanding.

---

## Authority and scope

The director selected designing the admission-lifetime correction after recording Zorg's report.\
The fixed outcome is bounded session admission and teardown, not a new authentication scheme.\
The [completed intent survey](../surveys/shared-transport-survey.md) remains an input with all its qualifications: common semantics, truthful resource accounting, automatic connection recovery and no invented delivery certainty.\
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

---

## Source baseline and related path

Source checkpoint: `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
The session controller and core FSM match Zorg's reported `1723c9d10870806f9e84630085110f35c1f8077b` baseline by file diff.\
These are source observations; Zorg's ten-minute observation remains attributed to [its report](../../../zorg/upstream/agp-build-questions.md#what-was-observed).

| Boundary | Observed implementation | Design consequence |
|---|---|---|
| Reader | [`PeerController`](../../packages/node/src/session-controller.ts) awaits both `#handleOpen` and `#handleRouteUpdate`, which await their providers | Correct both through one mechanism; a timer race alone would still delay in-band notification and transport-terminal observation |
| Configuration | [`TimerConfig` and `CapacityConfig`](../../packages/core/src/types.ts) declare both admission timers and continuation queue limits; [`resolveConfig`](../../packages/node/src/node.ts) does not consume them | Make the existing settings effective and publish the resolved values |
| Invocation | Admission is invoked after dispatch even if the reducer did not authorize a `BeginIdentityAdmission` or `BeginRouteAdmission` action | Invoke only from an accepted, still-current admission action |
| Result authority | Identity retention runs before the reducer checks its token; route handling assigns `#pendingRoute` before that check | Guard before all effects, not only at the last reducer call |
| Error authority | [`reduceOpenSent` and `reduceEstablished`](../../packages/core/src/fsm.ts) token-check successful continuations, but their admission fault/expiry branches do not | Apply the same exact-token requirement to success, rejection, fault and expiry |
| Queue projection | `#connectionSnapshots` publishes a fixed empty continuation queue | Project the actual owned queue, including its byte/count limits and high-water marks |
| Cleanup | `#release` awaits notification write before close, then awaits the provider-blocked reader before `controllerReleased` | The teardown deadline must cover every wait it owns; reader completion cannot depend on provider settlement |
| OPEN confirmation | `ArmProtocolTimers` cancels the OPEN timer at identity commit; the [timer contract](../design/fsm.md#5-timers) stops it at establishment | Preserve the outer opening deadline through `OpenConfirm`, including when negotiated hold is zero |

Route import already has tuple/completeness validation in [`RoutingTable.importSnapshot`](../../packages/core/src/routing.ts), after the controller prepares its result.\
Do not copy a second routing validator into an admission wrapper.\
Factor the existing validation into a pure preparation step and a guarded commit so the [route-continuation contract](../design/fsm.md#67-route-admission-continuation) remains authoritative.

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
| Transport | Its existing packet FIFO, terminal and resource-release contract | Admission does not introduce another reader or reinterpret abort as proven native release |

Compose internal admission-lifetime and work-ledger units with the existing [`BoundedQueue`, `BoundedCapacity` and `ResourceLedger`](../../packages/core/src/bounded.ts).\
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

1. In a short executor turn, validate the wire command and current controller, prepare immutable bounded inputs, and accept the FSM's admission action.
2. Reserve a work slot before invoking the provider, install the exact token and engage the session's continuation barrier; capacity refusal invokes no provider.
3. Outside the executor, recheck the invocation permit and monotonic bounds, start the admission timer immediately before invocation, and observe both fulfilment and rejection.
4. Normalize a potentially current provider result outside the executor into bounded owned immutable data; reject invalid shape without retaining an unbounded copy. Property access, cloning and provider-controlled callbacks must not become application code running inside the executor.
5. Route the prepared completion through a short executor turn that checks current node lifecycle, controller identity, admission kind, token and deadline before any effect; perform final semantic validation and atomically commit identity/collision or route effects. Enter ordered draining, not unrestricted direct dispatch.
6. On expiry or terminal disposition, revoke authority first, cancel its timer, detach its effect target and request cooperative cancellation outside the executor; proceed with session cleanup without joining the provider.
7. On eventual provider settlement, dispose the retained work and release its reservation exactly once; stale success and stale failure have the same lack of authority.

No asynchronous gap is permitted between the final invocation check and calling the provider, or between the final effect check and its serialized commit.\
Deadline validity is checked again at result application, not inferred from whether the timer callback has run.\
Promise settlement only queues continuation work; it does not establish that AGP already applied the result ([ECMAScript promise reactions](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromisethen)).

The reducer also rejects mismatched admission fault and expiry tokens as defence in depth.\
There must be no stale path to `retainIdentity`, collision termination, `#pendingRoute`, route replacement, revision consumption or ACK enqueue.\
Host `Stopping`, `Stopped` or `Failed` state revokes pending admission before a later provider result can commit, even if transport draining continues.

Provider calls and abort-event delivery both stay outside the executor because either can run application code.\
Cancellation communicates a request; it cannot force an arbitrary promise to settle ([DOM abort model](https://dom.spec.whatwg.org/#aborting-ongoing-activities)).\
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
This relies on the existing [conforming transport terminal contract](../design/transport-contract.md#104-terminal-linearization), not a new promise of event-loop scheduling or browser-native release.

For an accepted connection, remove the ended connection projection after owned cleanup.\
For a configured dial adjacency, retain only the bounded terminal/retry projection permitted by [FSM teardown](../design/fsm.md#7-teardown-order); it owns no reusable admission authority.\
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

Use monotonic elapsed time, tokened timer generations and deadline checks at invocation and commit.\
Chunk oversized host timer delays and round positive fractional remainders upward; cancellation of a scheduled callback alone is not a stale-generation guard.\
Node documents delayed callback execution and delay coercion, so a callback's scheduling is not proof that a deadline remains valid ([Node timer semantics](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args)).\
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
The existing [`OperationsStore.#commitMonotonicExhaustion`](../../packages/core/src/operations.ts) instead zeros resource gauges and freezes later commits.\
That path cannot truthfully turn unfinished admission work into released capacity.\
Do not reset the ledger, restart a numeric domain or claim fresh release evidence to conceal that projection gap.

### Terminal accounting recommendation

On operational-domain exhaustion, detach all effect authority and dispose work that can actually be disposed, then capture the remaining work ledger in the final terminal snapshot.\
Freeze its resource values, revision and `capturedAt` together; subsequent aggregate and focused queries return that same terminal capture, not a new timestamp on old counts.\
Outstanding provider evaluations remain nonzero at that capture when unresolved; later private disposal can release internal reservations but cannot publish a new revision, event or counter.\
The final count is last-known at the terminal capture, not a live promise that resources remain allocated or that cleanup has finished.\
Ordinary stopped instances retain live accounting until an operational-domain terminal barrier actually occurs.

This uses existing snapshot metadata instead of adding a second live operations domain or a freshness field for this one feature.\
It still needs explicit agreement on the [terminal operations contract](../design/operations.md#32-snapshot-metadata-and-revisions): releasing logical effect authority must not be described as releasing unfinished provider work.\
The current implementation's `#capture` samples wall time afresh even after terminal failure; preserving gauges without freezing that metadata would not implement this recommendation.\
If post-failure live cleanup telemetry is required, that is a separately designed authority/revision surface, not an undocumented exception here.

The new gauge keys, local event names, capacity fields and effective defaults require a coordinated type/schema/catalog/document update where applicable.\
Generic map extensibility is not permission to invent undocumented meanings, and no new public per-evaluation history endpoint is needed.

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

---

## Review gate and handoff

This draft has author adversarial review and corrective proposals, not implementation approval.\
Keep the current normative documents unchanged until the new options/defaults are accepted and the design gate is complete.

| Review input | What it contributes |
|---|---|
| AGP contract, source, existing primitives and history | One evidence family for the owed semantics and the current mechanism |
| Zorg's original question and bounded-wrapper consequence | Independent consumer requirement; reported runtime observation remains attributed |
| DOM abort model | Independent cancellation limit; does not certify AGP cleanup |
| ECMAScript promise reaction model | Independent distinction between settlement and application of results |
| Node timer contract | Additional host scheduling constraint; not evidence for a browser guarantee |

Multiple source families do not constitute independent review of this author's design.\
Before implementation approval, the [mission-kit axiom-alignment review](https://github.com/apnex/mission-kit/blob/3c43dad1c35fda1457f3bdbf7f194fa5ff47398e/methods/M7-axiom-alignment-audit.md) must record its own verdict against the completed design and carry these guardrails into verification:

| Applicable product axiom | Weight | Alignment and tension to check |
|---|---|---|
| A3 | Load-bearing | One concern per internal unit; common mechanism with separate policy semantics; justify each added public field by its real consumer |
| A4 | Load-bearing | Preserve the report, exact authority and resource distinctions; operations must not erase unfinished work when a connection ends |
| A8 | Load-bearing | Contract and schema choices precede implementation; mechanism checks precede consumer acceptance; a draft is not a sealed gate |
| A9 | Supporting, within AGP's declared scope | Later verification must establish the lifecycle and resource predicates; no deployment or browser certification follows from source review |
| A14 | Supporting, within AGP's declared scope | Correct the shared cause and carry the related route path forward, instead of requiring each consumer to maintain the workaround |

The [ratified AGP applicability map](../design/axioms.md) and its pinned source remain unchanged.\
A1, A2 and A7 do not become new AGP product obligations merely because this correction has state, configuration and recovery; A13 guides director interaction, not the runtime.

Independent review must judge the corrected queue barrier, route preparation, capacity-wait integration, terminal accounting recommendation and proposed local event classifications.\
The optional cancellation surface and resource-limit defaults still require public-surface agreement; defaults are finite starting policies, not measured optimal workloads.\
The teardown budget remains conditional on a conforming transport and a progressing host event loop.\
Fresh-reader use is still required before this draft becomes a load-bearing design of record; author checks of links and prose do not supply that assurance.

No new message to Zorg is required to produce this draft.\
After AGP has an agreed design and verified correction, communicate the exact public changes, tested revision and retained provider duties; do not ask Zorg to weaken its wrapper or evidence-retention rules in advance.

---

## Author adversarial review

Review date: 2026-10-11; AGP source baseline remains `f16266aaafa66f6301d7afbf09c55e3a1f990274`.\
Tier 3 - analytical review by the draft author, based on static source and contract reads; not an independent attestation or executed runtime result.\
Recommendation: retain the shared lifetime design with the corrections above, then obtain independent review before adoption.

### Source observations

| Source family | Measured or attributed input |
|---|---|
| AGP source and ratified contracts | `BoundedQueue.dequeue` releases queue accounting immediately; route import validates policy against all routes before static rejection; `#scheduleDial` owns the existing retry timer; operational-domain failure zeros resources and freezes commits, while `#capture` still stamps reads with fresh wall time |
| Zorg consumer report | The caller-identity wrapper now answers within a host-supplied deadline; the unresolved-port ten-minute observation remains attributed to Zorg, not reproduced here |
| DOM | [Abort steps](https://dom.spec.whatwg.org/#run-the-abort-steps) run algorithms and dispatch the abort event; cancellation delivery itself may execute provider code |
| ECMAScript | [Promise reactions](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromisethen) enqueue jobs; settlement is not serialized AGP result application or disposal |
| Node | [Timer semantics](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args) do not guarantee precise callback timing; deadlines still require monotonic checks |

These are independent input families, not five independent reviewers.\
No admission-hang, packet-depth or other vulnerability-triggering reproduction was constructed or run.

### Findings and dispositions

| Finding | Why it matters | Draft disposition and falsifier |
|---|---|---|
| High - barrier released before backlog drain completes | A new ordinary command could bypass older queued commands during a yield | Corrected: barrier covers admission and draining; any overtaking or direct dispatch while backlog remains refutes the design |
| High - capacity wake tied to settlement, with registration ordering unspecified | Settlement need not free capacity; a release between checking and registering could leave an eligible adjacency waiting | Corrected: actual-release notification plus atomic level check/registration; a missed release or over-cap invocation refutes it |
| High - route validator extraction did not specify static eligibility | The source's all-routes decision set differs from the ratified eligible-subset contract; early global-capacity preparation also becomes stale | Refined: one shared validation owner, static preparation before policy and current capacity at commit; a rejected static route reaching policy or any partial revision/RIB commit refutes it |
| High - terminal resource truth left unresolved | Zeroing hides unfinished evaluations; retaining counts with a fresh timestamp misrepresents their measurement time | Recommendation supplied: frozen last-known values and capture metadata; no post-terminal public mutation; disagreement with this contract must be resolved before adoption |
| Medium - local capacity and continuation overflow lacked exact classification | Misclassification could blame identity policy, blame an uninvoked provider or select the wrong reconnect disposition | Proposed two explicit local events and existing `INTERNAL_ERROR` wire/retry semantics; catalogue/type and reducer agreement remains an implementation prerequisite |

The optional shared cancellation options remain useful for the existing provider seams, but this review does not claim that Zorg has agreed to consume them.\
The correction's safety does not depend on providers honouring cancellation; one-argument compatibility must still be compiled after a public shape is agreed.\
Separate identity/route limits remain recommended because their contention affects different session phases; no evidence here selects a universally optimal numerical default.

### Axiom alignment and gate status

Delivery guidance was re-read from validated mission-kit `2d9e66873c40b53ba2d62d36d462df5fe994d536`; the earlier guidance pin above remains the original drafting checkpoint.\
The product applicability source remains the ratified pin in `docs/design/axioms.md`, not the newer delivery-guidance revision.

| Product axiom | Author assessment and implementation guardrail |
|---|---|
| A3 | Shared mechanism and separate policy ownership align; keep work accounting internal, use the existing retry owner and justify public cancellation through actual provider needs |
| A4 | Preserve correction history and the distinction between current authority, retained work and last-known observations; frozen terminal metadata is load-bearing |
| A8 | No implementation approval follows from this author review; agree contract changes and obtain a valid design verdict before building |
| A9, AGP subset | Later owned-boundary evidence must cover FIFO handoff, release conservation, stop dominance and ordinary controls; source inspection is not deployment or browser certification |
| A14, AGP subset | Correct both provider paths at their shared cause and carry each finding into acceptance; keep Zorg's workaround until verified closure |

Under [mission-kit gate authority](https://github.com/apnex/mission-kit/blob/2d9e66873c40b53ba2d62d36d462df5fe994d536/entities/E7-gate.md), this author cannot judge the required independent-agent gate.\
Gate status: no verdict; no independent judge has run, and neither pass nor fail is claimed.\
The independent review must issue its own axiom-alignment verdict on this corrected draft; public-surface adoption remains a director decision.\
Author document checks do not substitute for the outstanding fresh-reader assurance.
