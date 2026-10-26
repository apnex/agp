# Admission lifetime implementation map

Status: source-grounded planning evidence for `B53`, not an approved implementation plan or a runtime verdict.\
Author: AGP session; 2026-10-20 Australia/Melbourne.\
Tier 1 records existing contracts and the frozen proposal's requirements; Tier 2 records inspected source.

The proposed repair spans seven implementation duties, with thirteen direct operations-publication sites and their callers identified below.\
The inventory records where integration is required; it does not establish that the integration has been implemented or independently verified.

## Evidence identity and boundary

| Input | Measured identity or scope |
|---|---|
| AGP source | `baa2c1a87f6c681f569f9e7b745e3e18b14c1160`; clean worktree before this documentation task |
| Frozen [revision 4](admission-lifetime-correction-r4.md) | SHA-256 `082b2c704dfdc3338283f3733732388a15fbffec5d1f28bf78313bad884b97b4` |
| Frozen [independent technical and scoped axiom review](admission-lifetime-independent-review-r4.txt) | SHA-256 `7f3b6b0e24acf55d7795e6ec7454724b678bc6359639c80c999d93a6c463b88c` |
| Change since R4's source checkpoint | Under `packages/`, only `packages/node/src/dispositions.ts`, its write-observation contract test and the node test index differ; the controller, node, FSM, routing, writer and operations files mapped here are unchanged |
| Delivery guidance | Clean mission-kit checkout matched live `main` at `8fa9dad08c98146a14a0596c93f528658b2403ac`; AGP's product-axiom pin is unchanged |
| Inspection boundary | Source and existing records only; no provider invocation, runtime reproduction, new model experiment or implementation change |

Line numbers below refer to that AGP source identity.\
The full R4 proposal and independent review remain authoritative within their recorded scopes; this map does not replace their text or acceptance obligations.

---

## Contract and proposed duties - Tier 1

The [existing FSM contract](../design/fsm.md#5-timers) already requires bounded identity/route admission, a bounded continuation barrier, exact continuation authority and OPEN timing through establishment.\
The [operations contract](../design/operations.md#32-snapshot-metadata-and-revisions) already requires pre-mutation numeric checks and runtime detachment on terminal replacement.\
The [transport contract](../design/transport-contract.md#82-ordering-and-concurrency) already forbids concurrent send and close initiation.

R4 adds or clarifies public cancellation, evaluation limits, local events, operational meanings and the total-teardown interpretation of the close setting.\
Those additions remain selected for assurance, not ratified.

| Duty | Requirement in the frozen R4 proposal |
|---|---|
| Runtime commit and terminal authority | [Prepare, preflight, guard, install and dispatch](admission-lifetime-correction-r4.md#runtime-terminal-preflight-and-commit-handoff) through one node-owned authority boundary; terminal replacement discards ordinary effects and hands cleanup to detached owners |
| Shared admission lifetime and work accounting | [Separate result authority, session cleanup and provider-work reservation](admission-lifetime-correction-r4.md#three-lifetimes); identity and route use one mechanism, separate finite pools and exact invocation/result guards |
| Ordered input and continuation storage | [Keep one reader and one bounded FIFO barrier](admission-lifetime-correction-r4.md#ordered-input-and-teardown), including during drain yields; terminal inputs bypass semantic backlog without abandoning transport evidence |
| Route preparation and atomic application | [Validate the eligible subset and complete result](admission-lifetime-correction-r4.md#source-baseline-and-related-path), then use current RIB capacity; revision, rejection list and routes commit before ACK authority |
| Deadline and cleanup composition | [Enforce one total teardown deadline](admission-lifetime-correction-r4.md#one-teardown-deadline-and-first-cause-ownership), independent per-send bounds and first-cause ownership; retain OPEN authority through confirmation |
| Single adjacency supervisor | [Make capacity an eligibility input](admission-lifetime-correction-r4.md#capacity-wait-lifecycle-and-projection), not another retry loop; preserve backoff and reset only at exact establishment success |
| Public contracts and operational truth | [Absorb options, configuration and accounting meanings](admission-lifetime-correction-r4.md#public-surface-and-migration-choices) together; stopped cleanup remains live, numerical terminal capture remains frozen and truthful |

The [complete acceptance table](admission-lifetime-correction-r4.md#acceptance-obligations) remains a requirement, not executed evidence.

---

## Current implementation owners - Tier 2

| Duty | Source observations at the measured baseline |
|---|---|
| Runtime commit and terminal authority | [Node](../../packages/node/src/node.ts) publishes through thirteen direct `#operations.commit` calls; [OperationsStore](../../packages/core/src/operations.ts), lines 275-281, can return store-only terminal replacement; node methods mutate before publication and some dispatch more work after its untagged receipt |
| Shared admission lifetime and work accounting | [PeerController](../../packages/node/src/session-controller.ts), lines 571-715, awaits both providers; identity retention and pending-route assignment precede the reducer's final token check; `BeginIdentityAdmission` and `BeginRouteAdmission` actions are ignored at lines 810-813; no admission ledger is wired in the node/controller |
| Ordered input and continuation storage | `PeerController.#readLoop`, lines 401-438, awaits message handling and observes peer credit before it; [node connection projection](../../packages/node/src/node.ts), line 1765, reports a constant empty continuation queue; [BoundedQueue](../../packages/core/src/bounded.ts), lines 137-181, already supplies count/byte reservation, `peek`, dequeue and clear |
| Route preparation and atomic application | [RoutingTable.importSnapshot](../../packages/core/src/routing.ts), lines 419-497, validates policy decisions against all routes before static rejection, computes final capacity, then mutates advertisements and inbound revision; controller lines 702-715 and 718-779 install pending/reducer state before routing application completes |
| Deadline and cleanup composition | Controller lines 745-752 cancel OPEN during `ArmProtocolTimers`; lines 998-1037 await notification, close and reader completion, with the close timer cancelled before the reader join; [SessionWriter](../../packages/node/src/session-writer.ts), lines 265-295, supplies the writer-stop signal to `send`, without a per-send deadline there |
| Single adjacency supervisor | Node lines 1431-1545 own acquisition, attempt and timer maps; channel adoption resets attempts at line 1467; lines 1887-1911 derive adjacency state from controller/timer presence; [core supervisor](../../packages/core/src/fsm.ts), lines 938-994, resets history on `satisfied()` and has no capacity-wait input |
| Public contracts and operational truth | [Core types](../../packages/core/src/types.ts), lines 650-677, declare admission timers and continuation limits that node `resolveConfig` does not consume; node `effectiveDocument`, lines 2238-2256, does not materialize resolved timer/capacity defaults; operations lines 476-503 zero gauges on numerical failure and lines 683-695 sample a fresh capture time |

The core FSM checks successful admission tokens but not all fault/expiry branches at `fsm.ts:371-436` and `fsm.ts:545-629`.\
The existing [BoundedCapacity and ResourceLedger](../../packages/core/src/bounded.ts) own reservation accounting; neither supplies admission authority, timers or provider cancellation.

---

## Operations publication inventory - Tier 2

Scope: all direct `OperationsStore` construction and commit references in production TypeScript under `packages/`, excluding generated build output and tests.\
The only live store owner found is `NodeImpl`; the thirteen direct commit sites are all in [node.ts](../../packages/node/src/node.ts).\
The five helper definitions are expanded into their callers in the next table, so a helper is not mistaken for an effect-free publication.

| Direct site | Current entry | State or effects surrounding publication |
|---|---|---|
| `node.ts:1156` | `#start`, entering `Starting` | Assigns host state first; listener acquisition follows |
| `node.ts:1187` | Listener `capacityRejected` callback | Counter-only publication directly from the callback, outside an executor wrapper at this site |
| `node.ts:1220` | `#start`, entering `Running` | Assigns host state first; records and returns `StartedNode` after the receipt |
| `node.ts:1256` | Start failure | Assigns `Failed` and cancels acquisitions before publishing; diagnostic and event-stream completion follow |
| `node.ts:1291` | `#stop`, entering `Stopping` | Closes endpoint bindings and removes routes first; route-removal helpers can publish recursively within this logical operation |
| `node.ts:1331` | Stop completion | Assigns `Stopped`, clears labels, flushes dispositions and clears outstanding messages first; stores the stop report and completes events afterward |
| `node.ts:1377` | `#listenerEnded` | Records listener terminal, assigns `Failed` and cancels acquisition first; controller termination follows the serialized turn |
| `node.ts:1492` | Dial failure continuation | Removes acquisition ownership and may schedule retry before the counter/adjacency commit |
| `node.ts:1623` | `#applyRoutingMutation` | Routing is already mutated; writer epochs close before publication; outbound route updates enqueue afterward |
| `node.ts:1648` | `#commitSessionState` | Publishes controller state/timers already installed by its callers |
| `node.ts:1655` | `#commitCanonical` | Publishes the release path's already-mutated controller, route, label and adjacency state |
| `node.ts:1666` | `#commitReverseOnly` | Publishes label changes after asynchronous data/disposition handling; callers do not wrap this commit in an executor turn |
| `node.ts:1683` | `#commitMessageOutcome` | Returns only a revision to data-plane/disposition callers; the return value cannot distinguish ordinary commit from terminal replacement |

### Helper callers and adjacent effects

| Helper or boundary | Inspected callers and effects |
|---|---|
| `#applyRoutingMutation` | Eight calls at `node.ts:567`, `838`, `857`, `876`, `898`, `950`, `1289` and `1698`: expose endpoint, establish session, import routes, acknowledge export, purge session, release controller, stop and close binding |
| `#commitSessionState` | Calls at `node.ts:1030` and `1038`: transition evidence and timer publication; controller `#dispatch` installs reducer state and applies actions before `PublishTransition` |
| `#commitCanonical` | Call at `node.ts:953`: `controllerReleased` removes controller/directory/evidence, removes labels, settles local outstanding messages, reports lost next hops and forgets disposition state before publication; retry may follow |
| `#commitReverseOnly` | Calls at `node.ts:1102` and `1137`: after `DataPlane.receive` and disposition processing; exact authority is not represented by a tagged transaction outcome |
| `#commitMessageOutcome` | Calls at `node.ts:413` and `460`: disposition publication and the injected `DataPlaneCommitPort`; local outstanding settlement can follow the first call |
| Data-plane commit port | Five calls in [data-plane.ts](../../packages/node/src/data-plane.ts) at lines 468, 558, 568, 604 and 670: accepted, refused, received, forwarded and handler-completion outcomes; handling/label reservation/writer admission or delivery-disposition reporting can follow receipts |
| Pre-publication data classification | `data-plane.ts:239-426` performs route checks and allocates return tokens; token exhaustion can call controller termination; `#sendInExecutor` also commits the send-admission guard before operations publication |
| Post-publication data ownership | `data-plane.ts:501-519` installs labels and writer work; `#dispatch`, lines 648-683, starts handlers; node `send`, lines 630-655, later opens and possibly settles origin-outstanding state |
| Identity and collision effects | `node.ts:778-820` mutates the pair directory and can terminate a collision loser before the subsequent identity transition is published |
| Controller creation and acquisition | `node.ts:1431-1479` and `1548-1594` adopt/register controllers and evidence before the start transition's publication; the acquisition object already has its own deadline and adoption guard |
| Operations-owned boundary | Store construction initializes state; `terminateEvents` at node lines 1274, 1354 and 1398 closes observation; store subscriptions change subscriber ownership but do not call `commit`; queries materialize state without advancing revision |

The store's numeric preflight precedes its projection installation, but it is not a node-wide pre-effect gate.\
Projection validation/cloning and canonical-change classification currently occur within `commit`, after its numeric check.\
This source inventory does not establish a complete prepared-state algorithm or prove every asynchronous callback effect-free; those are implementation/review obligations under R4.

---

## Public surface inventory - Tier 2

| Surface | Current source and adoption boundary |
|---|---|
| Admission ports | [Core types](../../packages/core/src/types.ts), lines 877 and 909, expose one-argument `evaluate`; [core exports](../../packages/core/src/index.ts) re-export these types; node dependencies and built-in providers consume them |
| Existing low-level node exports | [Node exports](../../packages/node/src/index.ts) expose `DataPlaneCommitPort`, `SessionHost`, `SessionRuntimeConfig`, `SessionWriter` and `SessionWriterLimits`; these are exported interfaces even when their duties are internal to the runtime |
| Timer/configuration domain | [Timer schema](../../packages/core/src/schemas/v1/configuration/timers.schema.json) represents zero; `node.ts:2084-2091` and `2351-2355` require positive safe integers for effective write/close timeouts; the hold timer separately permits zero |
| Continuation and evaluation capacity | [Capacity schema](../../packages/core/src/schemas/v1/configuration/capacity.schema.json) already declares continuation limits; the proposed identity/route evaluation limits are absent from current `CapacityConfig` and resolution |
| Closed session events | [Session-event schema](../../packages/core/src/schemas/v1/codes/session-event-code.schema.json) owns the enum used by [generated code types](../../packages/core/src/code-types.generated.ts) and FSM; R4's two new local events need sovereign-source changes and regeneration |
| Operational views | [OperationsStore](../../packages/core/src/operations.ts) serves focused and aggregate snapshots; [HTTP management](../../packages/management-http/src/server.ts) consumes the same reader; SDK, shell CLI and Rust CLI remain compatibility consumers, not independent truth owners |

The earlier [adoption record](admission-lifetime-adoption.md#compatibility-evidence) reports a compile-only optional-options check, including the consumer's then-current wrapper.\
That is historical evidence for its recorded types, not a compile result for a new implementation or all exported interfaces.

---

## Unchanged approval and verification boundary

The [independent R4 review](admission-lifetime-independent-review-r4.txt) passed technical completeness and scoped product-axiom alignment, while retaining public adoption, fresh-reader assurance and runtime verification as separate gates.\
The original [assurance FAIL](admission-lifetime-assurance/admission-assurance-result.md) and later [NO VERDICT](admission-lifetime-assurance-r4/admission-assurance-result.md) are unchanged.

No cancellation option, evaluation limit, local event, timer meaning or accounting meaning is adopted by this map.\
No claim is made for browser-native release, provider CPU/memory isolation, hundreds-of-peer capacity, credential rotation or consumer-wrapper removal.\
`B53` remains open; the source map supplies implementation coverage evidence, not closure evidence.
