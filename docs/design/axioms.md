# AGP uniform node - axiom applicability and conformance map

## 1. Status and authority

| Field | Value |
|---|---|
| Status | Ratified. Current axiom applicability map |
| Intent authority | [`DECISIONS.md` section 2](../DECISIONS.md#2-confirmed-intent) |
| Transport intent authority | [`transport-sovereignty-authority.md`](transport-sovereignty-authority.md) |
| Axiom source | [Mission Kit axioms](https://github.com/apnex/mission-kit/tree/5026604d3ef695651c21b24bd78410c7fec04b58/axioms) |
| Pinned commit | `5026604d3ef695651c21b24bd78410c7fec04b58` |
| Source committed at | `2026-07-25T11:48:00Z` |
| Applicable product axioms | A3, A4, A8, A9, A14 |
| Lineage context | A0 umbrella; retained for intent lineage, not claimed as selective AGP conformance |

The Mission Kit applicability matrix is authoritative for this mapping.\
AGP is a deterministic messaging library and runtime.\
It is not itself a persistent state backplane, runtime-generated declarative system, autonomous cognitive actor network, or LLM workload.\
The product therefore applies A3, A4, A8, A9, and A14 only at the explicit AGP evidence boundaries below.

No requirement may be imported from a non-applicable axiom.\
A product behavior that happens to resemble one of its mechanics remains grounded in the survey or an applicable axiom; resemblance is not a conformance claim.

A0 remains delivery-lineage context because it explains the intent -> decision -> contract -> test chain.\
Its umbrella claim presupposes the full constituent stack, so AGP does not claim A0 conformance by selecting only the constituents relevant to this product.\
`AX0` is an AGP-local gate name, not an A0 certificate.

---

## 2. Applicable product mechanics and evidence scope

| Axiom | Mechanics applied to AGP | AGP evidence gate | Claim boundary |
|---|---|---|---|
| A3 - Sovereign Composition | Every package/module owns one concern and interacts through exact public contracts. Neutral packet transport, WebSocket binding, Node.js carrier implementation, production Loopback, protocol, routing, operations, and management remain separated; dependencies point inward and package-private imports are forbidden. | `AX1` (`AX1-P/T/B/L/D`) | AGP package/module composition only |
| A4 - Zero-Loss Knowledge | Design records preserve mechanics, rationale, and consequence; public DTOs are independently inspectable; operational state is structured rather than reconstructed in adapters. | `AX0`, `AX1`, `AX6` | AGP design, contract, and operations artifacts only |
| A8 - Gated Recursive Integrity | Binary evidence ascends through authority -> schemas -> semantics -> FSM -> RIB -> node -> operations -> topology -> chaos. A higher gate cannot certify over an unsealed predecessor. | `AX0` through `AX8` | AGP verification graph only |
| A9 - Chaos-Validated Deployment | Deterministic injected adversity exercises the sealed AGP graph with committed seeds, barriers, cleanup, and recurrence evidence. | `AX8` | Sandbox-derived partial evidence; not full A9 deployment conformance |
| A14 - Compounding Learning | Findings are captured at discovery, assigned to an owning layer, resolved by root cause rather than workaround, and closed only with an orthogonal recurrence test or explicit authorized deferral. | `AX0`, `AX8` | AGP finding-lifecycle subset; no claim for unproved attention-ledger, tangent, or measured-payback obligations |

These are target mechanics, not claims of current conformance.\
A gate PASS certifies only the stated AGP evidence boundary.\
In particular, an AGP artifact cannot claim full A9 without deployment-owned production feedback and fidelity evidence, and it cannot claim full A14 from the finding subset alone.

---

## 3. Non-applicable axioms

| Axiom | Why its declared domain is absent from the AGP product boundary |
|---|---|
| A1 - Sovereign State Transparency | AGP owns no persistent entity or durable state backplane. Sessions, timers, queues, imported routes, the selected RIB, and forwarding state are deliberately ephemeral or derived. |
| A2 - Isomorphic Specification | AGP validates schemas and consumes configuration, but no sovereign manifest generates and reconciles the runtime FSM. Contract sovereignty alone does not activate this axiom. |
| A5 - Perceptual Parity | AGP is not an LLM-in-the-loop or multi-agent cognitive system. SDK/HTTP/CLI consistency is a survey requirement, not an A5 claim. |
| A6 - Frictionless Agentic Collaboration | Agent coordination workflow is outside the shipped runtime. |
| A7 - Resilient Agentic Operations | AGP nodes reconnect and return typed errors, but the product does not claim the axiom's autonomous-agent, durable-audit, or persisted-backlog contract. |
| A10 - Autopoietic Evolution | Self-proposed architectural remediation is a delivery-system concern, not an AGP runtime behavior. |
| A11 - Cognitive Minimalism | No LLM is on the AGP data or control path. |
| A12 - Precision Context Engineering | Prompt budgets and token telemetry are outside the AGP runtime. |
| A13 - Director Intent Amplification | The survey process is evidence for the delivery workflow; it is not a runtime capability. |

A consumer may activate additional axioms at its own system boundary-for example, by placing AGP inside a persistent or LLM-driven application.\
AGP must not claim that conformance on the consumer's behalf.

---

## 4. State-lifetime boundary

| State class | Owner | Restart contract |
|---|---|---|
| Deployment topology and node configuration | Embedding application | Re-supplied to a new node instance |
| Concrete adapter configuration and logical-reference capability maps | Embedding application and adapter | Revalidated and reconstructed; never persisted as kernel authority |
| Loopback fabric | Embedding application | May outlive one node instance, but registrations/channels are live capabilities and are never restored |
| Locally exposed endpoint intent | Embedding application through SDK bindings | Re-registered by the application |
| Session FSM, timers, queues, and correlation label bindings | AGP runtime | Discarded |
| Adj-RIB-In, candidate RIB, selected RIB, Adj-RIB-Out, and forwarding projection | AGP runtime | Reconstructed through route convergence |
| Operational snapshots, events, and counters | AGP runtime | Queryable while live; no identity across restart |
| Durable audit or message backlog | No AGP owner | Out of scope |

The restart invariant is:
```text
empty runtime state
-> reconstruct adapter resolver and bound acquisition capabilities
-> restore application configuration and endpoint intent
-> reacquire neutral channels and reconnect adjacencies
-> exchange authoritative route snapshots
-> deterministically reconstruct equivalent reachability
```

Persisting an `Established` session or learned route as live truth would create a phantom transport or stale next hop.\
Sovereign state schemas make current truth explicit and queryable; they do not convert derived state into durable authority.

---

## 5. Mechanics, rationale, and consequence

### Mechanics

1. Every requirement in the uniform-node design names confirmed survey intent,
   explicit fixed stakeholder authority, a ratified decision, or an applicable
   axiom mechanic.
2. Every applicable product mechanic maps to the exact binary gates above and
   durable evidence.
3. Every excluded axiom remains absent from product acceptance criteria.
4. The source commit remains pinned; a later Mission Kit revision requires an
   explicit applicability re-evaluation rather than silent drift.
5. A0 may appear as lineage context but never as selective AGP product
   conformance or an `AX0` certification claim.

### Rationale

Selective applicability preserves the constitutional force of an axiom.\
Claiming all axioms because some wording is attractive would simultaneously over-scope AGP and weaken the meaning of conformance.\
The pinned map lets a cold reader distinguish product obligations, delivery-process practices, and consumer responsibilities.

### Consequence of violation

- Importing A1 literally would encourage restoring stale sessions and routes.
- Importing agent/LLM axioms would add unrelated durable-audit, prompt, and
  cognition obligations to a deterministic transport library.
- Ignoring an applicable universal axiom would permit coupled modules, lossy
  rationale, ungated layers, hope-based distributed testing, or recurring
  workarounds.
- Failing to pin the source would make later conformance claims irreproducible.
