---
# Survey envelope — captures stakeholder intent BEFORE a design is committed.
survey-title: AGP Transport-Configurable Testing Design
work-item: agp-transport-configurable-testing-design
methodology-source: "Codex survey skill (/home/apnex/.codex/skills/survey/SKILL.md)"
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: "Project owner direction — full testing-design survey request, this conversation, 2026-07-31"
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: ac
    Q2: ac
    Q3: bd
  round-2:
    Q4: abcd
    Q4-rationale: "Classify by the intended semantic stimulus and oracle, not by accidental coupling in the current fixture. Where a valuable test intent is neutral, redesigning its stimulus through neutral contracts is a design-phase activity."
    Q5: ab
    Q6: bd
classification: refactor
outcome-axis:
  primary: ["Test sovereignty and maintainability", "Semantic coverage fidelity", "Transport extensibility"]
  secondary: ["Failure diagnosability", "Execution efficiency"]
  round-1:
    primary: ["Test sovereignty and maintainability", "Transport extensibility"]
    secondary: ["Semantic coverage fidelity", "Failure diagnosability", "Execution efficiency"]
  round-2:
    primary: ["Semantic coverage fidelity", "Failure diagnosability", "Test sovereignty and maintainability"]
    secondary: ["Transport extensibility", "Execution efficiency"]
axiom-principle-anchors:
  primary: ["A3 — Sovereign Composition", "A8 — Gated Recursive Integrity"]
  secondary: ["A4 — Zero-Loss Knowledge", "A14 — Compounding Learning"]
  round-1: ["A3 — Sovereign Composition", "Common contract, sovereign carrier proof", "One behavioral axis, one owner"]
  round-2: ["A8 — Gated Recursive Integrity", "No capability skips", "Matrix completeness is explicit data"]
anti-goals-count: 6
flags-count: 8
calibration-data:
  stakeholder-time-cost-minutes: 6
  comparison-baseline: "docs/surveys/uniform-agp-node-routing-survey.md"
  notes: "The stakeholder completed both rounds in six minutes. The picks established a strict no-skip common-matrix boundary, retained representative differential parity and sovereign carrier suites, and resolved the cadence tension by requiring registry-complete ordinary CI while preserving focused local lanes. During the interpretation walkthrough, the stakeholder confirmed that a currently carrier-coupled stimulus should be redesigned through neutral contracts when the test intent is genuinely neutral and remains valuable."
---

# AGP Transport-Configurable Testing Design — Survey envelope

**Methodology:** Codex `survey` skill (2-round,
3-orthogonal-questions-per-round pick-list)
**Work item:** `agp-transport-configurable-testing-design`
**Classification candidate:** refactor
**Lifecycle handoff:** `intent-open -> intent-captured` only; this envelope
grants no design, implementation, or delivery effect.

---

## §0 Context

The project owner has accepted in principle a testing-design refinement for
AGP. Tests whose stimulus and oracle are genuinely carrier-neutral should have
one sovereign scenario definition and be repeatable through a selected
production transport configuration. Tests whose purpose is a concrete
transport mechanism—such as RFC 6455 framing, native socket behavior,
independent processes, or Loopback fabric resource accounting—must remain
owned by that transport rather than being forced into a false common matrix.

The present topology suite does not yet embody that rule consistently. Eight
topology files directly instantiate production Loopback, two raw-peer
withdrawal files directly instantiate WebSocket, and only star and line have
separate normalized Loopback/WebSocket equivalence witnesses. The existing
verification design deliberately chose asymmetric witnesses and independently
named files, so moving to configurable common scenarios is an intent-level
change that must be captured before the verification design, harness,
traceability, and certification gates are revised.

This survey uses the following consumer-supplied outcome axes:

1. **Semantic coverage fidelity** — common scenarios prove the same
   protocol-visible behavior on every applicable production transport without
   normalizing away meaningful differences.
2. **Test sovereignty and maintainability** — each behavioral axis has one
   self-descriptive owner, assertion body, and durable reason to exist.
3. **Failure diagnosability** — failures identify the exact scenario and
   transport cell without hiding root cause in an aggregate.
4. **Execution efficiency** — local and automated runs spend time
   proportionately while full required coverage remains enforceable.
5. **Transport extensibility** — a future reliable ordered transport can join
   common verification through an explicit contract rather than copied tests.

---

## §1 Round 1 picks

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 — Primary success | **a, c** Sovereign semantic scenarios + native transport depth | Deduplicate common behavior without flattening carrier-owned mechanisms into generic tests. |
| Q2 — Protected stakeholders | **a, c** Test maintainers + transport implementers | Make ownership and adapter onboarding obvious to the people responsible for test durability. |
| Q3 — Verification cadence | **b, d** Selectable development lanes + independently scheduled carrier suites | Focused runs should be cheap while concrete transport proofs retain their own cadence and authority. |

### §1.Q1 — Per-question interpretation

Given the work item and the aggregate Round-1 picks, Q1 most likely means that
deduplication is an ownership correction, not a drive to make every test
generic. A genuinely transport-neutral behavior should have one scenario and
one semantic oracle. Carrier mechanisms should remain in independently owned
tests with their native vocabulary and exact evidence rather than being
normalized into the common harness.

Not selecting identical protocol expectations as a primary success criterion
means exact cross-transport equality is not itself the organizing principle;
the shared contract and scenario oracle determine required common behavior.
Not selecting minimum execution count means the design may execute one
scenario on multiple carriers when that evidence is useful. This primarily
advances **Test sovereignty and maintainability**, with **Semantic coverage
fidelity** secondary.

### §1.Q2 — Per-question interpretation

Q2 protects the people who must understand why a test exists and how a new
transport proves itself. The testing surface should therefore make scenario
ownership, common-harness obligations, carrier-specific responsibilities, and
failure attribution explicit. A transport implementer should be able to join
the applicable common suite without copying scenario bodies, while retaining
sovereign tests for its own binding, lifecycle, pressure, evidence, and
operations contracts.

Feature-developer speed and release-review evidence remain useful constraints,
but they were not selected as the principal authorities. The design should not
trade away maintainer reasoning or adapter contract clarity merely to produce
one convenient aggregate dashboard. This primarily advances **Test
sovereignty and maintainability** and **Transport extensibility**.

### §1.Q3 — Per-question interpretation

Q3 composes two cadence rules: developers can select one transport while
working on a common scenario, and transport-specific suites run independently
from that matrix. The likely intent is that test configuration controls
execution without changing scenario source or oracle, while each concrete
adapter keeps its own independently callable verification boundary.

The omission of a full matrix from every ordinary local run protects
**Execution efficiency**. The omission of mandatory common cells from CI and
certification leaves an accountability ambiguity: selectable tests can rot if
no authoritative aggregate ever requires them. Round 2 must therefore
distinguish “not every gate” from “never required,” and decide how matrix-cell
coverage remains inspectable without displacing the selected focused cadence.

**Round-1 composite read:** Establish one maintainable semantic owner for each
genuinely transport-neutral behavior, let transports execute that owner by
configuration, and preserve deep native tests under each adapter's own
authority. Optimize the workflow for maintainers and transport implementers
with focused lanes, while Round 2 resolves the minimum aggregate enforcement
and evidence needed to prevent optional lanes from drifting.

**Round-1 axiom / principle anchoring:** **A3 — Sovereign Composition** and
**One behavioral axis, one owner** are load-bearing: common semantics and
carrier mechanics must have exact, non-overlapping owners joined through a
small public test contract. **Common contract, sovereign carrier proof** means
reuse may remove duplicated scenario logic but must not erase the reason a
transport-specific test exists.

---

## §2 Round 2 picks

| Q | Pick | Round-1 aggregate relation | Intent reading (1-line summary) |
|---|---|---|---|
| Q4 — Common-matrix admission | **a, b, c, d** Neutral stimulus + canonical oracle + complete applicability + one semantic owner | Refines Round-1 aggregate | A scenario enters the matrix only when every part of its purpose is carrier-neutral and universally runnable. |
| Q5 — Cross-transport parity | **a, b** Shared assertions + representative normalized equality | Deepens Round-1 aggregate | Every matrix cell passes the same oracle, while selected geometries additionally prove whole-outcome equivalence. |
| Q6 — Aggregate enforcement | **b, d** Mandatory ordinary CI + machine-readable completeness registry | Disambiguates Round-1 aggregate | Focused local lanes remain available, but CI rejects any missing required scenario/transport cell. |

### §2.Q4 — Per-question interpretation

Q4 refines the Round-1 boundary into a strict admission contract. A common
scenario must express its stimulus only through carrier-neutral node or
transport contracts, observe only canonical protocol, SDK, operations, or
delivery state, run against every registered applicable transport without a
skip or capability branch, and own exactly one semantic behavior without
asserting carrier-native mechanics.

Selecting all four makes these cumulative conditions rather than optional
signals. A test naming an RFC 6455 frame, native close, URL, process boundary,
Loopback fabric gauge, or adapter-private fault mechanism remains
transport-specific even if part of its surrounding setup is reusable. This
primarily advances **Test sovereignty and maintainability** and **Semantic
coverage fidelity**, while giving **Transport extensibility** an exact
onboarding boundary.

The current fixture does not permanently determine classification. During
design, a carrier-coupled raw-peer test must first be evaluated for semantic
intent and continuing value. If its intended stimulus and oracle are genuinely
neutral, the desired activity is to redesign that stimulus over the neutral
transport contract so the scenario can enter the complete matrix. It remains
transport-specific only when the behavior being proved is itself native.

### §2.Q5 — Per-question interpretation

Q5 deepens Round 1 by choosing two complementary proof strengths. Every common
scenario executes independently against each applicable transport and must
satisfy the same semantic assertions. Representative geometries—rather than
every scenario—also produce a normalized, protocol-visible outcome for exact
cross-transport comparison.

This preserves the existing value of star and line differential witnesses
without making a large equality transcript the owner of every behavior.
Because normalized comparison necessarily excludes permitted ephemeral
identity, time, and publication data, the design must publish a closed
normalization contract even though Q5 did not select a universal
every-scenario equality rule. This primarily advances **Semantic coverage
fidelity**, with **Failure diagnosability** secondary: an independent assertion
failure identifies one carrier cell, while a representative differential
failure identifies divergence between otherwise passing implementations.

### §2.Q6 — Per-question interpretation

Q6 disambiguates Q3's focused cadence. A developer may run one transport lane
locally, and carrier-specific suites retain separate commands, but ordinary CI
must execute the full common matrix. A machine-readable registry records the
required transports and scenario cells and fails when an applicable cell is
missing, rather than inferring completeness from duplicated files or a
top-level test count.

Not selecting release-only enforcement means matrix drift should be caught on
ordinary integration, not accumulated until certification. This advances
**Failure diagnosability** and **Semantic coverage fidelity** while preserving
**Execution efficiency** for focused local work. Carrier-specific package
gates remain independently required; matrix completeness cannot certify native
adapter behavior on their behalf.

**Round-2 composite read:** Admit only wholly neutral, single-axis scenarios to
a no-skip transport matrix; run the same semantic oracle independently on
every applicable production transport; retain exact normalized differential
proof for representative geometries; and make ordinary CI enforce the complete
registry while developers retain focused lanes and carrier suites retain
sovereign commands.

**Round-2 axiom / principle anchoring:** **A8 — Gated Recursive Integrity**
requires every claimed common cell to pass before the topology gate can pass.
**No capability skips** prevents a nominally common suite from laundering
transport-specific gaps, while **Matrix completeness is explicit data**
ensures coverage is inspectable and cannot silently decay as transports or
scenarios are added.

---

## §3 Composite intent envelope

Refine AGP verification around an explicit distinction between common
protocol/topology semantics and sovereign transport mechanisms. Every
genuinely transport-agnostic behavioral axis has one self-descriptive scenario
definition and one semantic oracle. It may enter the common matrix only when
its stimulus crosses carrier-neutral contracts, its oracle reads canonical
AGP state or delivery outcomes, every registered applicable transport can run
it without skips or capability branches, and it asserts no native mechanism.
WebSocket framing, URL/publication, socket/process isolation and native close
proofs remain WebSocket-owned; Loopback fabric capacity, accounting,
operations, and process-local lifecycle remain Loopback-owned.

The matrix is configuration-driven. Developers and transport implementers can
run a focused Loopback or WebSocket lane without modifying scenario source,
while ordinary CI expands the complete registered matrix. Each cell is
reported as an exact scenario/transport pair. Definitions, assertions,
ownership rows, and maintenance are deduplicated; execution is deliberately
not deduplicated because each applicable transport must supply real evidence.
A machine-readable registry owns the set of required transports and scenario
cells and causes CI to fail if a required cell disappears.

Every common cell independently satisfies the same semantic assertions.
Representative star and line geometries additionally retain exact normalized
comparison of protocol-visible connection, RIB, export, forwarding, and
delivery outcomes. The normalization contract excludes only explicitly
permitted ephemeral identity, timing, and carrier-publication fields.
Transport-specific package suites and independent-process deployment
witnesses remain separate gates; common topology success cannot certify their
native contracts.

Classification follows the intended behavior rather than historical fixture
shape. The design phase must review current raw-peer tests individually: retain
the behavioral owner when its intent still has value, and where that intent is
neutral, replace the carrier-coupled stimulus with a neutral scripted-peer or
channel mechanism rather than accepting permanent one-transport coverage.

**Stakeholder confirmation:** Confirmed on 2026-07-31 that this composite
matches intent. The stakeholder additionally directed the design phase to
neutralize a currently transport-coupled stimulus whenever the test's semantic
intent remains valid and transport-agnostic.

**Final axiom / principle anchoring:** **A3 — Sovereign Composition** determines
the ownership split: common semantics, WebSocket mechanisms, and Loopback
mechanisms remain exact concerns joined through a small neutral harness.
**A8 — Gated Recursive Integrity** requires the registry-complete matrix and
its prerequisite adapter gates before a topology claim passes. **A4 —
Zero-Loss Knowledge** requires the matrix, classification rationale, and
normalization exclusions to be durable artifacts; **A14 — Compounding
Learning** requires a discovered coverage gap to become an owned recurrence
cell rather than another copied test.

---

## §4 Scope summary

| Axis | Bound |
|---|---|
| Title | AGP Transport-Configurable Testing Design |
| Classification | refactor |
| Location / scope | AGP test architecture, topology harnesses, verification design, traceability, and certification |
| Primary outcome | One sovereign common scenario per neutral behavior, configurably proven on every applicable production transport |
| Secondary outcomes | Native transport rigor, focused developer lanes, explicit CI completeness, and low-maintenance adapter onboarding |
| Outcome-axis (primary) | Test sovereignty and maintainability; Semantic coverage fidelity; Transport extensibility |
| Outcome-axis (secondary) | Failure diagnosability; Execution efficiency |
| Outcome-axis (Round-1) | primary: Test sovereignty and maintainability, Transport extensibility; secondary: Semantic coverage fidelity, Failure diagnosability, Execution efficiency |
| Outcome-axis (Round-2) | primary: Semantic coverage fidelity, Failure diagnosability, Test sovereignty and maintainability; secondary: Transport extensibility, Execution efficiency |
| Axiom/principle anchors | A3 — Sovereign Composition; A8 — Gated Recursive Integrity; A4 — Zero-Loss Knowledge; A14 — Compounding Learning |
| Axiom/principle anchors (Round-1) | A3 — Sovereign Composition; Common contract, sovereign carrier proof; One behavioral axis, one owner |
| Axiom/principle anchors (Round-2) | A8 — Gated Recursive Integrity; No capability skips; Matrix completeness is explicit data |

---

## §5 Anti-goals (out-of-scope; deferred)

| AG | Description | Composes-with target |
|---|---|---|
| AG-1 | Forcing carrier-native behavior into the common matrix merely to maximize apparent reuse | Sovereign WebSocket and Loopback package suites |
| AG-2 | Copying one neutral scenario or assertion body into separate transport-named files | Common scenario registry and transport profiles |
| AG-3 | Conditional skips, capability branches, or partial applicability inside a scenario classified as common | Reclassify the scenario as transport-specific or complete the neutral harness contract |
| AG-4 | Requiring the full transport matrix during every focused local development run | Selectable single-transport development lanes |
| AG-5 | Requiring complete normalized equality for every common scenario | Representative differential-parity witnesses |
| AG-6 | Treating common topology success as proof of native framing, pressure, teardown, process-isolation, or fabric-accounting behavior | Adapter conformance and deployment-specific gates |

---

## §6 Flags / open questions for the design phase

| # | Flag | Recommendation |
|---|---|---|
| F1 | The ratified verification design currently prescribes asymmetric transport witnesses and rejects a transport-parameterized aggregate. | Amend the AX7 matrix, rationale, traceability, and evidence contract before claiming the new design. |
| F2 | The topology README says every topology uses a loopback WebSocket, while the actual suite is split between production Loopback and WebSocket. | Correct ownership documentation as part of the design migration. |
| F3 | The current common helper owns one module-global Loopback fabric, which can retain cross-cell resource identity and capacity. | Require a fresh explicitly closed fabric per Loopback matrix cell. |
| F4 | The raw-peer snapshot-omission and session-close tests currently inject WebSocket-native mechanics, but their current fixture may not reflect the intended behavioral ownership. | Audit the intent and value of each test during design. If the behavior is genuinely neutral and still valuable, build a neutral scripted-peer/channel stimulus and admit it to the complete matrix; retain WebSocket ownership only for behavior that is actually carrier-native. |
| F5 | Existing star and line parity support duplicates topology construction for Loopback and independent-process WebSocket. | Reuse common scenario definitions and normalized outcomes while retaining separate process-isolation witnesses. |
| F6 | Normalized equality can hide a semantic defect if exclusions are open-ended. | Publish a closed representative-outcome schema and exact permitted ephemeral exclusions. |
| F7 | The current `test:system` command discovers root tests directly and could bypass a dedicated matrix-expansion runner. | Make every aggregate and certification entry point consume the same registry-backed expansion path. |
| F8 | Current cleanup helpers use `Promise.allSettled` and can hide node or transport release failures. | Give every cell bounded reverse-order cleanup and surface cleanup failure as test failure. |

---

## §7 Sequencing / cross-work considerations

### §7.1 Branch + review strategy

First amend and review the verification matrix and common-versus-specific
classification rule. Then add the closed transport/scenario registry and a
fresh-cell harness, converting star and line first so their existing
differential witnesses provide a comparison baseline. Convert the remaining
eligible topology scenarios one behavioral owner at a time. Audit the two
raw-peer cases by intent: where their semantic value holds, design a neutral
scripted-peer/channel stimulus and execute the resulting scenario across the
matrix; otherwise retain an exact carrier-specific owner. Only then remove
duplicated construction or wire the complete matrix into ordinary CI.

### §7.2 Composability with concurrent / pending work

This work composes with the new sovereign Loopback example and the existing
transport-neutral kernel boundary. It should reuse the production public
transport ports, node SDK, operations reader, and delivery API without
importing example configuration or adapter-private source. Independent-process
WebSocket E2E and the process-local Loopback example remain deployment
witnesses rather than common-matrix fixtures.

### §7.3 Compressed-timeline candidate?

Not a safe single-step mechanical rewrite. The harness extraction itself is
bounded, but the work changes ratified verification intent, CI expansion,
traceability, representative parity ownership, and cleanup authority. It can
progress in small independently passing migrations, with the old witnesses
removed only after their replacement cells and differential evidence pass.

---

## §calibration — Calibration data point

- **Stakeholder time-cost (minutes):** 6
- **Comparison baseline:**
  `docs/surveys/uniform-agp-node-routing-survey.md`
- **Notes:** The stakeholder completed both rounds in six minutes. Q4's four
  cumulative picks produced an unusually crisp common-matrix admission rule;
  Q6 reconciled focused local execution with mandatory complete CI evidence.
  The walkthrough added a useful classification discipline: preserve and
  neutralize a valuable semantic test rather than treating fixture coupling as
  permanent transport ownership.

---

## §8 Cross-references

- **Codex `survey` skill** — survey methodology
- **`agp-transport-configurable-testing-design`** — source work item
- **`docs/surveys/uniform-agp-node-routing-survey.md`** — prior AGP survey
- **`docs/design/agp-uniform-node/verification.md`** — verification design to
  be refined after intent capture
- **Future AGP testing-design artifact** — downstream planning input

---

— Proposer: Codex / 2026-07-31 (survey envelope; 14 option selections ratified
across 2 rounds; composite intent confirmed)
