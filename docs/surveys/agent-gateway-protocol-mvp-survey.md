---
# Survey envelope — captures stakeholder intent BEFORE a design is committed.
# Scaffolded by survey-init.sh. Placeholders in <angle-brackets> are unfilled;
# validate-envelope.sh rejects any pick/required-field still left as <...>.
survey-title: Agent Gateway Protocol MVP
work-item: agp-mvp
methodology-source: "Codex survey skill (/home/apnex/.codex/skills/survey/SKILL.md)"
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: "Project owner direction — this conversation, 2026-07-29"
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: ac
    Q2: ac
    Q3: bc
  round-2:
    Q4: ab
    Q5: ab
    Q6: b
outcome-axis:
  # The consumer-supplied set of goals / objectives this work serves. Generic
  # replacement for any project-specific outcome framework. Free-form labels.
  primary: ["Protocol correctness", "Operational transparency", "MVP focus"]
  secondary: ["SDK reuse and developer experience", "Multi-hop extensibility"]
  round-1:
    primary: ["Protocol correctness", "Operational transparency"]
    secondary: ["SDK reuse and developer experience", "MVP focus"]
  round-2:
    primary: ["Multi-hop extensibility", "MVP focus", "Operational transparency"]
    secondary: ["Protocol correctness", "SDK reuse and developer experience"]
axiom-principle-anchors:
  # Free-form axiom/principle/goal anchors. These must also be explained in the
  # Round 1, Round 2, and final intent prose sections; labels alone are not enough.
  primary: ["Correctness is a public contract", "Operability is part of the product"]
  secondary: ["Defer behaviour, preserve the model", "Integrate continuously at explicit gates"]
  round-1: ["Correctness is a public contract", "Operability is part of the product"]
  round-2: ["Defer behaviour, preserve the model", "Integrate continuously at explicit gates", "One state model, many read-only views"]
anti-goals-count: 3
flags-count: 6
calibration-data:
  stakeholder-time-cost-minutes: 8
  comparison-baseline: "none"
  notes: "Stakeholder reported one minute per question plus two minutes for the interpretation walkthrough. The terse multi-picks composed cleanly: Q3 established contract-first then layered construction, while Round 2 preserved multi-hop in the model, restored continuous integration gates, and selected a local read-only HTTP attachment for the CLI."
---

# Agent Gateway Protocol MVP — Survey envelope

**Methodology:** Codex `survey` skill (2-round, 3-orthogonal-questions-per-round pick-list)
**Work item:** agp-mvp
**Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope grants no design, seed, implementation, or delivery effect.

---

## §0 Context

The project owner has accepted in principle an Agent Gateway Protocol (AGP): an
embeddable, reusable WebSocket substrate for bidirectional JSON messaging among
application components. AGP combines BGP-inspired control-plane signalling with
a generic JSON data plane. Connections follow an explicit BGP-modelled FSM;
spokes advertise named endpoints; a hub router maintains queryable connection,
advertisement, RIB, and forwarding state; and data envelopes resolve a
destination endpoint to an established next hop.

The north star is multi-hop endpoint routing with route propagation, path
selection, and loop prevention. The MVP is deliberately narrower: one hub
router with multiple directly connected spokes, structured so multi-hop can be
added without replacing the protocol, session, route, or SDK foundations. The
deliverable is sovereign importable package(s), a standard SDK/API, and a
minimal read-only CLI demonstrating connection and routing-table inspection.
The CLI should preserve the existing local prototype's decoupled
command/driver/`jq`-template/rendering structure without copying unsafe shell
patterns verbatim.

This survey is governed by the Codex `survey` skill and the lifecycle authority
`Project owner direction — this conversation, 2026-07-29`. Its consumer-supplied
outcome axes are:

1. **MVP focus** — prove a small, coherent single-hub system without importing
   premature distributed-routing scope.
2. **Protocol correctness** — make connection and routing behaviour formal,
   deterministic, and testable.
3. **Multi-hop extensibility** — preserve clean seams for learned routes,
   next-hop resolution, selection, propagation, and loop prevention.
4. **SDK reuse and developer experience** — provide sovereign, embeddable
   packages with a stable endpoint-centric API.
5. **Operational transparency** — expose structured configuration and runtime
   state for application queries and a thin read-only CLI.

---

## §1 Round 1 picks

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 — MVP success | **a, c** Protocol credibility + operational transparency | Working traffic is insufficient unless behaviour is formal and visible. |
| Q2 — Primary audience | **a, c** Application developers + operators | The MVP must serve both integration and diagnosis directly. |
| Q3 — Delivery cadence | **b, c** Layered foundations + contract-first | Establish contracts first, then implement the layers systematically. |

### §1.Q1 — Per-question interpretation

Given Q1's picks, the work item, and the full Round-1 aggregate, the hypothesis
is that the MVP earns credibility through demonstrable protocol behaviour and
equally demonstrable operational state. Merely moving a JSON object between two
sockets would not satisfy the intent: the FSM and route resolution must be
correct, and a consumer must be able to inspect the connection and routing
entities that explain the result.

This primarily advances **Protocol correctness** and **Operational
transparency**, with **MVP focus** secondary because both outcomes must be
proved within the constrained single-hub slice. Q1 did not select integration
utility or evolution readiness as release gates; those remain part of the
accepted work item but should not silently displace the selected proof points.

### §1.Q2 — Per-question interpretation

Given Q2's picks alongside Q1 and Q3, the hypothesis is that AGP has two direct
MVP consumers: the application developer who embeds and drives the packages,
and the operator who needs to understand live behaviour. The SDK therefore
needs both an endpoint-centric messaging surface and a structured, read-only
operational query surface; the CLI is a consumer of that second surface rather
than a separate source of state or routing logic.

This primarily advances **SDK reuse and developer experience** and
**Operational transparency**, with **Protocol correctness** secondary because
the operator-visible entities must faithfully represent protocol state. The
absence of protocol maintainers and independent cross-runtime implementers from
the direct audience constrains MVP scope; extensibility and wire discipline may
be preserved without optimizing the first release around those audiences.

### §1.Q3 — Per-question interpretation

Given Q3's combined picks, the hypothesis is a composed sequencing preference:
define schemas, public interfaces, and conformance expectations first, then
implement transport, FSM, routing, and SDK layers in a deliberate order. The
`b+c` multi-pick is therefore read as contract-first *followed by* layered
construction, rather than as a contradictory demand.

This primarily advances **Protocol correctness**, with **MVP focus** and **SDK
reuse and developer experience** secondary. It deliberately rejects a
demo-first cadence, but creates a late-integration risk: individually correct
layers can still fail at their boundaries. Round 2 should clarify where
end-to-end integration enters the sequence.

**Round-1 composite read:** The desired MVP is a formal and inspectable
messaging foundation for application developers and operators, built by fixing
its contracts first and then implementing its layers systematically. The main
tensions carried to Round 2 are avoiding late integration and deciding how much
multi-hop readiness is required when evolution readiness was not selected as an
MVP release gate.

**Round-1 axiom / principle anchoring:** **Correctness is a public contract**,
and **operability is part of the product**. Downstream design must make protocol
state and transitions both testable and inspectable; it must not treat
observability as logging added after the routing core is complete.

---

## §2 Round 2 picks

| Q | Pick | Round-1 aggregate relation | Intent reading (1-line summary) |
|---|---|---|---|
| Q4 — Multi-hop readiness | **a, b** Next-hop abstraction + extensible RIB model | Deepens and challenges Round-1 aggregate | Preserve the routing model, but defer future signalling and runtime behaviour. |
| Q5 — Integration timing | **a, b** Continuous skeleton + explicit integration gates | Disambiguates Round-1 aggregate | Contract-first layered work must still remain runnable end-to-end. |
| Q6 — Read-only CLI attachment | **b** Local read-only HTTP adapter | Deepens Round-1 aggregate | A thin HTTP view exposes canonical SDK state to decoupled CLI drivers. |

### §2.Q4 — Per-question interpretation

Q4 deepens and challenges the Round-1 aggregate by resolving how the accepted
multi-hop north star constrains a release whose selected gates were correctness
and visibility rather than evolution readiness. Given picks `a+b`, the
hypothesis is that the MVP must resolve named endpoints through a generic next
hop and must model routes in a RIB that distinguishes local from learned
origins and can later carry path attributes. Direct endpoint-to-WebSocket
coupling would violate the captured intent.

At the same time, the omission of `c+d` keeps future router-to-router control
contracts and runnable multi-hop behaviour outside the MVP. Direct-spoke
endpoint announcement and withdrawal remain necessary current behaviour; what
is deferred is the *inter-router* propagation contract. This primarily advances
**Multi-hop extensibility**, with **Protocol correctness** and **MVP focus**
secondary: preserve the model now without pre-implementing the future network.

### §2.Q5 — Per-question interpretation

Q5 disambiguates Q3's contract-first and layered cadence. Given picks `a+b`,
the hypothesis is that contracts and layers are ordering disciplines, not
permission to postpone integration. A minimal hub-and-two-spoke topology should
remain executable from the earliest transport milestone, and it should gain
observable capability at explicit gates: an established session, an installed
route, and a forwarded JSON envelope.

This primarily advances **MVP focus** and **Protocol correctness**, with **SDK
reuse and developer experience** secondary. It removes the late-integration
risk identified in Round 1 while retaining systematic layer ownership: each
gate must prove that the relevant contracts compose across layer boundaries.

### §2.Q6 — Per-question interpretation

Q6 deepens the dual application-developer/operator audience and the
operational-transparency release gate. Given pick `b`, the hypothesis is that
the SDK's structured state remains canonical, while the demo/router host
provides a small local read-only HTTP adapter over that state. The decoupled CLI
drivers query this adapter and pass returned JSON to entity-specific `jq`
templates and shared renderers.

This primarily advances **Operational transparency**, with **SDK reuse and
developer experience** and **MVP focus** secondary. The adapter is an MVP
attachment mechanism, not authorization for a production remote-management
service or mutating CLI; its bind scope, lifecycle, and access policy remain
design-review concerns.

**Round-2 composite read:** Round 2 sharpens the formal, layered direction by
requiring an extensible next-hop/RIB model, continuous runnable integration at
explicit gates, and a local read-only HTTP projection of canonical SDK state.
It keeps inter-router signalling, runtime multi-hop, and production management
outside the MVP.

**Round-2 axiom / principle anchoring:** **Defer behaviour, preserve the model**,
**integrate continuously at explicit gates**, and maintain **one state model,
many read-only views**. These principles refine Round 1 by showing how formal
contracts and operability remain grounded in a running system without expanding
into the multi-hop north star prematurely.

---

## §3 Composite intent envelope

The primary intent is to deliver a credible, inspectable AGP foundation for
application developers and operators. The MVP is an embeddable WebSocket system
with one hub router and multiple spokes; a BGP-modelled connection FSM; direct
spoke advertisement and withdrawal of named endpoints; a RIB that distinguishes
local and learned route forms; selected-route resolution through a generic next
hop; and bidirectional forwarding of generic JSON data envelopes. Protocol,
configuration, connection, advertisement, RIB, and forwarding state must be
available through structured SDK queries.

The work proceeds contract-first and by explicit layers, while preserving a
runnable hub-and-two-spoke skeleton. Integration gates prove, in order, that a
session reaches the protocol-established state, endpoint reachability installs
and resolves correctly, and JSON traffic follows the selected route. A thin
local read-only HTTP adapter projects the same canonical SDK state to a minimal
CLI whose command, driver, `jq` template, and renderer layers borrow selectively
from the local prior art.

Multi-hop is a north star rather than an MVP runtime feature. The route and
resolution models must permit learned routes and path attributes, but the MVP
does not need inter-router advertisement contracts, router peering, best-path
policy, propagated withdrawals, or loop prevention. Those behaviours are
follow-on design work and must not be simulated or hidden inside the single-hub
implementation.

**Final axiom / principle anchoring:** **Correctness is a public contract** and
**operability is part of the product** are the primary anchors. They require
state machines, route resolution, state projections, and integration gates to
be specified and tested together. **Defer behaviour, preserve the model**
constrains downstream design to create honest multi-hop seams without importing
unselected distributed-routing scope.

---

## §4 Scope summary

| Axis | Bound |
|---|---|
| Title | Agent Gateway Protocol MVP |
| Location / scope | `/home/apnex/taceng/agp` — a new clean project area; existing implementation directories remain reference-only |
| Primary outcome | Formal, inspectable single-hub endpoint routing and JSON forwarding through an embeddable SDK |
| Secondary outcomes | Multi-hop-ready route modelling, continuous integration proof, and a minimal read-only HTTP-backed CLI |
| Outcome-axis (primary) | Protocol correctness; Operational transparency; MVP focus |
| Outcome-axis (secondary) | SDK reuse and developer experience; Multi-hop extensibility |
| Outcome-axis (Round-1) | primary: Protocol correctness, Operational transparency; secondary: SDK reuse and developer experience, MVP focus |
| Outcome-axis (Round-2) | primary: Multi-hop extensibility, MVP focus, Operational transparency; secondary: Protocol correctness, SDK reuse and developer experience |
| Axiom/principle anchors | primary: Correctness is a public contract, Operability is part of the product; secondary: Defer behaviour, preserve the model, Integrate continuously at explicit gates |
| Axiom/principle anchors (Round-1) | Correctness is a public contract; Operability is part of the product |
| Axiom/principle anchors (Round-2) | Defer behaviour, preserve the model; Integrate continuously at explicit gates; One state model, many read-only views |

---

## §5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | Runtime multi-hop: router peering, propagated routes and withdrawals, best-path policy, and loop prevention | Follow-on AGP multi-hop routing design |
| AG-2 | Production or mutating CLI: configuration writes, interactive administration, remote fleet management, and polished distribution | Follow-on operations and administration tooling |
| AG-3 | Independent implementations in additional languages or runtimes | Follow-on wire-conformance suites and SDK implementations |

---

## §6 Flags / open questions for the design phase

Open questions and risks surfaced during interpretation, each with a recommendation
to challenge during design review.

| # | Flag | Recommendation |
|---|---|---|
| F1 | Initial implementation language, runtime support, and exact package boundaries are not yet selected. | Decide these before scaffolding while keeping the wire contract implementation-neutral. |
| F2 | “BGP-modelled FSM” still needs an explicit mapping of states, events, timers, liveness, reconnect, and error transitions onto WebSockets. | Produce and review a transition table plus executable conformance cases before FSM implementation. |
| F3 | Endpoint namespace, ownership, duplicate advertisements, and direct-route selection policy remain open. | Define stable endpoint and peer identities plus deterministic collision/selection behaviour in the protocol contract. |
| F4 | Control/data envelope versioning, validation, errors, correlation, delivery expectations, limits, backpressure, and security policy remain open. | Resolve the minimum safe envelope and failure semantics before opening a public send API. |
| F5 | The exact public boundary among candidate routes, selected RIB, forwarding resolution, snapshots, events, and counters remains open. | Specify immutable query DTOs independently from internal maps and transport objects. |
| F6 | A local HTTP adapter creates process-lifecycle, bind-address, discovery, and access-control questions even when read-only. | Keep it optional and local by default; threat-model and define ownership during design rather than treating read-only as inherently safe. |

---

## §7 Sequencing / cross-work considerations

### §7.1 Branch + review strategy

The repository root is not currently a Git worktree, while prior-art graph
directories are independent worktrees with existing changes. Before
implementation, establish a clean project worktree and leave all prior-art
directories untouched. Review gates should follow the captured cadence:
protocol/API contracts, transport skeleton, established-session proof,
route-installation proof, forwarding proof, and read-only operations proof.

### §7.2 Composability with concurrent / pending work

The local `socket/`, `websocket/`, `websocket-router/`, `websocket-client/`,
`graph-server-v2/`, and `graph-client-v2/` trees remain design archaeology. The
new work may selectively reuse the `cli/` command/driver/template/rendering
structure and small safe rendering fragments, but must not import legacy
transport, identity, mutation, or application-controller behaviour. The
single-hub route model becomes the substrate for a separately designed
multi-hop follow-on.

### §7.3 Compressed-timeline candidate?

Not a candidate for collapsing contract, design, and validation phases: protocol
state and route resolution are load-bearing correctness surfaces. The runtime
scope can remain compressed by deferring inter-router behaviour, while the
selected continuous skeleton and explicit integration gates keep feedback
early.

---

## §calibration — Calibration data point

Captures an empirical baseline for the methodology-evolution loop.

- **Stakeholder time-cost (minutes):** 8 (six minutes across the questions plus two minutes for the interpretation walkthrough)
- **Comparison baseline:** none
- **Notes:** The stakeholder confirmed the final aggregate interpretation. The terse multi-picks composed cleanly: Q3 established contract-first then layered construction, while Round 2 preserved multi-hop in the model, restored continuous integration gates, and selected a local read-only HTTP attachment for the CLI.

---

## §8 Cross-references

- **Codex `survey` skill** — the survey methodology this followed
- **agp-mvp** — source work item
- **`README.md` and local prior-art directories** — concept provenance and implementation archaeology
- **AGP formal design (pending)** — the design artifact this envelope will feed
- **AGP multi-hop routing (deferred)** — follow-on work for router peering, propagation, selection, and loop prevention

---

— Proposer: Codex / 2026-07-29 (Survey envelope; 6 question responses ratified across 2 rounds)
