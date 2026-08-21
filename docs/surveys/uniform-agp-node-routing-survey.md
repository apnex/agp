---
# Survey envelope - captures stakeholder intent BEFORE a design is committed.
survey-title: Uniform AGP Node and Per-Node Routing
work-item: agp-uniform-node-routing
methodology-source: "Codex survey skill"
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: "Project owner direction - this conversation, 2026-07-30"
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: abc
    Q2: bd
    Q3: ad
  round-2:
    Q4: abc
    Q5: abc
    Q6: bc
    Q6-rationale: "No compatibility requirement; update AGP v1 in place to the target state."
classification: refactor
outcome-axis:
  primary: ["Uniform node coherence", "Routing correctness"]
  secondary: ["Multi-hop evolvability", "Operational transparency", "Migration continuity"]
  round-1:
    primary: ["Uniform node coherence", "Routing correctness", "Multi-hop evolvability"]
    secondary: ["Operational transparency"]
  round-2:
    primary: ["Routing correctness", "Multi-hop evolvability", "Uniform node coherence"]
    secondary: ["Operational transparency", "Migration continuity"]
axiom-principle-anchors:
  primary: ["One node abstraction", "No selected route means no forwarding"]
  secondary: ["Loop-safe selected-route propagation", "Operability is part of the product"]
  round-1: ["One node abstraction", "No selected route means no forwarding", "Protocol symmetry before runtime cutover"]
  round-2: ["Selected-route path-vector propagation", "Fail closed and report toward the source", "One runtime API with a stable operational surface"]
anti-goals-count: 5
flags-count: 7
calibration-data:
  stakeholder-time-cost-minutes: 6
  comparison-baseline: "superseded MVP intent survey (retired)"
  notes: "The stakeholder completed both rounds in six minutes. Multi-picks composed cleanly into a protocol-first coordinated replacement, and a follow-up clarification explicitly removed legacy compatibility and authorized updating AGP v1 in place."
---

# Uniform AGP Node and Per-Node Routing - Survey envelope

**Methodology:** Codex `survey` skill (2-round, 3-orthogonal-questions-per-round pick-list) **Work item:** `agp-uniform-node-routing` **Classification candidate:** refactor **Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope grants no design, implementation, or delivery effect.

---

## section 0 Context

The project owner has accepted in principle a change from AGP's current role-specialized runtime to one uniform Node.js node implementation.\
Today only the hub-side `RouterImpl` owns a routing table and resolves destinations through that RIB; a spoke owns an endpoint-export registry and sends every outbound message through its single configured hub session.\
The proposed direction is that hub-like and spoke-like deployments run the same node code, every node owns a RIB, every outbound or transit data message consults the local selected route, and absence of a usable route prevents forwarding.

The open intent is the depth and sequencing of that change: whether the first slice should preserve the present single-central-node wire topology behind a uniform runtime, or also introduce symmetric route exchange and transit forwarding as the beginning of the multi-hop path-vector protocol.\
This survey captures that intent before a design is committed.

The consumer-supplied outcome axes are:

1. **Uniform node coherence** - one runtime abstraction and state model rather
   than behaviorally separate hub and spoke implementations.
2. **Routing correctness** - every data-plane decision is justified by a
   selected, usable route and fails closed when none exists.
3. **Multi-hop evolvability** - the change should advance or preserve the path
   toward symmetric route exchange, transit forwarding, and loop prevention.
4. **Operational transparency** - every node exposes comparable connection,
   route, endpoint, and forwarding state.
5. **Migration continuity** - existing SDK consumers and the working
   single-hub geometry should move deliberately rather than break accidentally.

---

## section 1 Round 1 picks

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 - Primary success | **a, b, c** Coherence + fail-closed routing + symmetric progress | The refactor succeeds only if the abstraction, data path, and distributed-routing direction move together. |
| Q2 - Protected consumers | **b, d** Operators + maintainers | Uniform observable state and removal of duplicated machinery should shape the architecture. |
| Q3 - Transition cadence | **a, d** Coordinated replacement + protocol-first | Specify symmetric protocol semantics first, then cut the runtime over without an interim compatibility phase. |

### section 1.Q1 - Per-question interpretation

Given the work item and the aggregate Round-1 picks, Q1 most likely means that renaming or wrapping the existing hub and spoke implementations is insufficient.\
The desired result is one genuine node model whose local and transit data paths both require a selected, usable route, while its control plane begins symmetric route exchange rather than retaining the current spoke-to-hub-only advertisement model.

This primarily advances **Uniform node coherence**, **Routing correctness**, and **Multi-hop evolvability**.\
Selecting all three makes them a joint acceptance envelope: architectural simplification may not weaken routing safety, and fail-closed local lookups may not be implemented as a temporary default-route facade that leaves the protocol asymmetric.

### section 1.Q2 - Per-question interpretation

Q2 indicates that the design should be evaluated foremost through operator and maintainer outcomes.\
Every process should expose the same meaningful RIB, connection, endpoint, and forwarding concepts, and implementation ownership should converge on shared session, routing, and forwarding machinery rather than duplicate role-specific state machines.

Application-facing convenience and protocol-research flexibility remain relevant constraints, but they were not selected as the primary design authorities.\
This gives **Operational transparency** secondary outcome status and reinforces **Uniform node coherence**: public state should make the shared model visible rather than cosmetically hiding divergent internals.

### section 1.Q3 - Per-question interpretation

Q3 composes a protocol-first sequence with a coordinated replacement.\
The likely intent is to define the symmetric wire and FSM contract-including the route information every node needs-before building the common runtime, then switch examples and consumers to that coherent model as one planned cutover.\
It explicitly rejects both an indefinitely maintained pair of compatibility facades and a first release that merely installs an implicit upstream/default route in former spokes.

This raises delivery risk deliberately: **Migration continuity** is an outcome axis under tension rather than a primary goal.\
The design must therefore make the breaking boundary explicit, version the protocol/API where appropriate, and prove the replacement topology before removing the old path, even though it need not preserve the old factories as a lasting product surface.

**Round-1 composite read:** Build a genuinely uniform, observable routing node against a symmetric protocol, with every data decision gated by its local RIB, then perform a coordinated cutover rather than shipping a compatibility or default-route intermediate.\
Round 2 must bound the symmetric protocol slice, define route-miss behavior, and decide how much loop safety belongs in that cutover.

**Round-1 axiom / principle anchoring:** The load-bearing principles are **One node abstraction**, **No selected route means no forwarding**, and **Protocol symmetry before runtime cutover**.\
The design must embody these in shared state/control machinery; configuration may create different topologies, but must not recreate hub and spoke as separate behavioral implementations.

---

## section 2 Round 2 picks

| Q | Pick | Round-1 aggregate relation | Intent reading (1-line summary) |
|---|---|---|---|
| Q4 - Symmetric routing depth | **a, b, c** Adjacent exchange + transit re-advertisement + path loops | Deepens Round-1 | The replacement includes a selected-route path-vector control plane, not merely uniform local RIB storage. |
| Q5 - Missing-route behavior | **a, b, c** Local rejection + transit drop + correlated error | Disambiguates Round-1 | No route can emit no onward data, but the source should receive explicit failure feedback. |
| Q6 - Coordinated cutover boundary | **b, c** Sole `createNode()` API + stable management/CLI | Refines Round-1 | Retire role-specific runtime factories while preserving useful operational consumers. |

### section 2.Q4 - Per-question interpretation

Q4 deepens the Round-1 requirement for immediate symmetric-routing progress.\
Every adjacency must be able to import and export endpoint routes, a node must be able to re-advertise its selected learned route to support transit, and route provenance must contain enough ordered path information to reject a route that would loop back through the receiving node.

Not selecting multiple eligible-path exchange, metrics, or policy attributes bounds the first symmetric protocol.\
The intended control plane is therefore a small selected-route path-vector: enough to construct multi-hop reachability and prevent loops, without attempting BGP-scale policy or multipath behavior.\
This primarily advances **Multi-hop evolvability** and **Routing correctness**.

### section 2.Q5 - Per-question interpretation

Q5 disambiguates "drop if route missing" into separate local and transit contracts.\
A locally originated call must consult the same selected RIB and reject before writing a data frame.\
A frame received for transit must not be forwarded when no usable route is selected, while the node should return a correlated nonfatal `NO_ROUTE` result toward the source.

This makes fail-closed behavior compatible with useful sender feedback: "drop" means no onward data-plane transmission, not silent disappearance.\
Structured route-miss events and counters were not selected, so they are not independently load-bearing intent; the tension with Q2's operator emphasis must be reviewed rather than silently promoted into scope.\
This primarily advances **Routing correctness**, with **Operational transparency** secondary through correlated protocol evidence.

### section 2.Q6 - Per-question interpretation

Q6 refines the coordinated replacement boundary.\
`createNode()` should become the sole runtime API and the role-specific `createRouter()` and `createSpoke()` factories should retire rather than persist as compatibility facades.\
At the same time, existing management HTTP resources and `agpctl` commands should remain stable wherever their schemas still truthfully represent uniform-node state.

The stakeholder clarified that there is no compatibility requirement and AGP v1 should be updated in place to the target state.\
The design therefore need not introduce `agp.v2`, negotiate with legacy peers, or retain the old wire semantics.\
It must instead replace the v1 role and direction rules consistently across schema, FSM, runtime, examples, and verification; mixed old and new v1 peers are unsupported by intent.\
This advances **Uniform node coherence** and preserves a deliberately narrow slice of **Migration continuity** for operators rather than old SDK or wire consumers.

**Round-2 composite read:** The coordinated replacement is a single uniform runtime with a selected-route path-vector control plane: all peers exchange routes, selected learned routes may be propagated for transit, path provenance prevents control-plane loops, and every data send/forward is gated by the local RIB.\
Missing routes stop data while producing correlated sender feedback; management HTTP and `agpctl` remain the stable operational window.

**Round-2 axiom / principle anchoring:** **Selected-route path-vector propagation**, **Fail closed and report toward the source**, and **One runtime API with a stable operational surface** sharpen Round 1.\
These principles require shared import, selection, export, and forwarding machinery while keeping multipath policy and legacy runtime facades out of the first cutover.

---

## section 3 Composite intent envelope

Replace AGP's behaviorally separate hub router and spoke client with one Node.js `AgpNode` runtime, created through `createNode()`.\
Configuration may make a node listen, dial configured adjacencies, expose endpoints, and permit or deny transit, but these are capabilities of the same implementation rather than protocol roles backed by different code.\
Topologies are assembled by composing identical node instances; terms such as hub, spoke, edge, or transit describe a node's configured placement and adjacencies only.\
Every node owns local endpoint candidates, per-peer imported candidates, a deterministic selected RIB, a forwarding projection, and per-peer export state.

The new symmetric control plane exchanges endpoint routes in both directions.\
Nodes export their selected routes, including selected learned routes needed for transit.\
Each route retains final origin separately from its immediate next-hop session and carries an ordered node path sufficient to reject control-plane loops.\
Multiple path export, metrics, and policy attributes are deferred.\
Every locally originated or received data message consults the same local selected RIB: a local route miss rejects before wire admission; a transit route miss produces no onward data frame and returns a correlated nonfatal error toward the source.

This is a coordinated replacement rather than a compatibility-facade migration.\
The old `createRouter()` and `createSpoke()` runtime APIs retire.\
AGP v1 is rewritten in place to the symmetric target state; interoperability with the old v1 language is explicitly not required.\
Management HTTP resources and `agpctl` remain stable where their contracts continue to represent the now-populated RIB on every node.

**Final axiom / principle anchoring:** The final design is governed by **One node abstraction**, **No selected route means no forwarding**, and **Loop-safe selected-route propagation**.\
Topology differences must arise from configuration, every forwarding outcome must be justified by local canonical route state, and operational views must expose that same state without reconstructing it independently.

**Stakeholder confirmation:** Confirmed on 2026-07-30 that topologies must be assembled using the same node code.

---

## section 4 Scope summary

| Axis | Bound |
|---|---|
| Title | Uniform AGP Node and Per-Node Routing |
| Classification | refactor |
| Location / scope | AGP protocol, core, runtime SDKs, operations, examples, and tests |
| Primary outcome | One uniform node runtime whose symmetric, loop-safe RIB controls every data path |
| Secondary outcomes | Comparable operations on every node and a deliberate clean cutover |
| Outcome-axis (primary) | Uniform node coherence; Routing correctness; Multi-hop evolvability |
| Outcome-axis (secondary) | Operational transparency; narrowly scoped Migration continuity |
| Outcome-axis (Round-1) | primary: Uniform node coherence, Routing correctness, Multi-hop evolvability; secondary: Operational transparency |
| Outcome-axis (Round-2) | primary: Routing correctness, Multi-hop evolvability, Uniform node coherence; secondary: Operational transparency, Migration continuity |
| Axiom/principle anchors | One node abstraction; No selected route means no forwarding; Loop-safe selected-route propagation |
| Axiom/principle anchors (Round-1) | One node abstraction; No selected route means no forwarding; Protocol symmetry before runtime cutover |
| Axiom/principle anchors (Round-2) | Selected-route path-vector propagation; Fail closed and report toward the source; One runtime API with a stable operational surface |

---

## section 5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | Multiple eligible-path export, metrics, and policy-based best-path selection | Future routing-policy phase |
| AG-2 | A uniform-runtime intermediate that still uses an implicit default route to one central hub | Not retained; superseded by symmetric route exchange |
| AG-3 | Long-lived `createRouter()` or `createSpoke()` compatibility facades | External migration package only if later authorized |
| AG-4 | Redesigning management HTTP or `agpctl` merely because the runtime changes | Future operations-version work where a semantic mismatch is proven |
| AG-5 | Compatibility negotiation with, or continued support for, the old AGP v1 wire behavior | None; v1 is replaced in place by authority |

---

## section 6 Flags / open questions for the design phase

| # | Flag | Recommendation |
|---|---|---|
| F1 | Path-vector checks prevent stable control-plane loops but not transient data-plane loops during convergence. | Design a bounded hop-limit field and exhaustion behavior for review; do not assume path provenance alone protects the data plane. |
| F2 | A node with no destination route must still return a correlated error toward the source. | Specify whether the error returns directly on the ingress adjacency or follows route state, and prove it cannot recurse or loop. |
| F3 | Current selected-reverse-path source validation can reject valid asymmetric multi-hop paths. | Replace it with an explicitly chosen origin/feasible-path authorization rule before transit is enabled. |
| F4 | Full route snapshots versus announcement/withdrawal deltas remains undecided. | Prefer bounded authoritative per-peer snapshots initially unless scale evidence requires deltas. |
| F5 | Uniform nodes may simultaneously dial and accept between the same pair. | Define deterministic adjacency collision resolution and whether parallel sessions are forbidden. |
| F6 | Management metadata currently describes `hub` or `spoke`, while Q6 requires truthful stable operations. | Preserve resource shapes but explicitly migrate or reinterpret role metadata; validate schema continuity rather than retaining obsolete roles. |
| F7 | Q2 prioritizes operators, but Q5 did not select structured route-miss events/counters. | Treat correlated error and RIB visibility as the minimum; ask design review whether counters are an existing invariant or an unauthorized scope addition. |

---

## section 7 Sequencing / cross-work considerations

### section 7.1 Branch + review strategy

Specify and review the replacement AGP v1 wire language, route invariants, and generalized session FSM first.\
Implement the uniform node and its import/RIB/export pipeline behind package-local tests, then replace the example topology and public runtime entry point in one coordinated integration.\
Preserve management and CLI contracts continuously so every intermediate review can inspect canonical state, even though the final runtime/API/wire cutover is atomic.

### section 7.2 Composability with concurrent / pending work

This work supersedes the MVP's explicit exclusion of router-to-router sessions and route propagation while retaining its reusable `RoutingTable`, `OperationsStore`, abstract `NextHopRef`, management adapter, and CLI projections.\
It must reconcile or replace the single-hub assumptions recorded in the existing protocol, FSM, routing design, and ADR-0002 rather than layering contradictory prose over them.

### section 7.3 Compressed-timeline candidate?

Not a safe compressed-timeline candidate.\
The desired clean cutover removes compatibility layers, but protocol language, FSM symmetry, loop safety, canonical route transactions, and data failure semantics still require independent review gates and modular verification before integration.

---

## section calibration - Calibration data point

- **Stakeholder time-cost (minutes):** 6
- **Comparison baseline:** the superseded MVP intent survey, since retired
- **Notes:** The stakeholder completed both rounds in six minutes. The questions
  exposed one important versioning ambiguity, resolved by the explicit
  clarification that compatibility is unnecessary and AGP v1 should be updated
  in place to the target state.

---

## section 8 Cross-references

- **Codex `survey` skill** - survey methodology
- **`agp-uniform-node-routing`** - source work item
- **Superseded MVP intent survey** - prior intent, retired with the MVP design set
- **Future uniform-node design artifact** - downstream planning input

---

- Proposer: Codex / 2026-07-30 (survey envelope; 15 option selections ratified across 2 rounds; composite intent confirmed)
