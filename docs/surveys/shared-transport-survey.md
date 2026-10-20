---
survey-status: intent-captured
survey-title: Shared browser and CLI transport guarantees
work-item: B50
methodology-source: /home/apnex/.codex/skills/survey/SKILL.md
lifecycle-handoff:
  from: intent-open
  to: intent-captured
  authority-ref: 'Director in the AGP conversation; Round 1: 1) ac 2) a 3) c; Round 2: 4 abc, 5) defer to your recommendation 6) a'
  planning-input-ref: self
stakeholder-picks:
  round-1:
    Q1: ac
    Q2: a
    Q3: c
  round-2:
    Q4: abc
    Q4-rationale: 'All picks retained; drafting now versus waiting is a sequencing tension, not blanket authority.'
    Q5: a
    Q5-rationale: 'The director explicitly referred to the displayed recommendation, 5a; no broader delegation is inferred.'
    Q6: a
outcome-axis:
  primary: [Semantic consistency, Resource safety, Recovery]
  secondary: [Compatibility]
  round-1:
    primary: [Semantic consistency, Resource safety, Recovery]
    secondary: [Compatibility]
  round-2:
    primary: [Resource safety, Recovery, Semantic consistency]
    secondary: [Compatibility]
axiom-principle-anchors:
  primary: [A3 Sovereign Composition, Preserve delivery certainty]
  secondary: [A13 Director Intent Amplification]
  round-1: [A3 Sovereign Composition, A13 Director Intent Amplification, Preserve delivery certainty]
  round-2: [A3 Sovereign Composition, A13 Director Intent Amplification, Preserve delivery certainty]
calibration-data:
  stakeholder-time-cost-minutes: 6
  comparison-baseline: none
  notes: 'The director reported six minutes across both rounds in a separate calibration reply. Two rounds and six questions answered. Q1 and Q4 mixed direction with sequencing and produced multi-picks that remain explicit constraints.'
contradictory-constraints:
  - round: 1
    questions: [Q1]
    picks: [a, c]
    constraint-envelope: 'Explore runtime-specific physical limits without final browser guarantees or normative revision before Zorg requirements are evaluated.'
  - round: 2
    questions: [Q4]
    picks: [a, b, c]
    constraint-envelope: 'Prioritize portable-runtime proposals and retain drafting and waiting preferences; do not infer authority for substantive transport design before reviewing Zorg input.'
---

<!-- style-check: allow S13 (the survey validator requires literal section-sign and em-dash interpretation headings) -->

# Shared browser and CLI transport guarantees

**Status: intent captured; all six answers and the director-reported six-minute calibration recorded.**\
No production design, contract revision or implementation is ratified by this record.

**Methodology:** the survey skill, two rounds of three questions.\
**Work item:** `B50`, browser carrier and portable-runtime feasibility.\
**Lifecycle handoff:** `intent-open -> intent-captured`; this grants no implementation authority.

---

## §0 Context

The director selected continued contract reasoning after the browser feasibility report in `docs/reviews/browser-carrier-feasibility.md`.\
AGP source is at `/home/apnex/taceng/agp`.\
All six answers and the director-reported six-minute timing calibration are recorded.\
No production contract, implementation, ratification, or consumer acceptance is authorized by this survey.

Authority: the user in the current conversation, who replied "continue" to the offer to work through shared transport contract choices.\
That authorizes this discussion, not inferred answers.

Settled intent from the director's preceding messages:

- Quality, correctness and utility in scope, not the smallest implementation.
- Unified deterministic CLI/browser behaviour, with clean ownership boundaries.
- Transport-first authentication where it can satisfy both populations.
- Retain native certificate-free PSK capability; browser certificates may be appropriate.
- IAP and credential issuance remain above AGP; AGP connects directly to the hub.
- Routine successful credential rotation should preserve the connection.
- Bound the admission window for leaked credentials.

Existing AGP contract constraint, not a new stakeholder pick: no automatic operation replay that invents delivery certainty.

Outcome axes for this survey:

- Semantic consistency: shared observable AGP behaviour across carriers.
- Resource safety: enforceable limits, truthful cleanup and containment.
- Recovery: defined continuity and resumption without fabricated delivery results.
- Compatibility: deliberate impact on current native and downstream consumers.

Question pre-anchor:

| Question | Primary axis | Secondary axis | Discriminator |
|---|---|---|---|
| Q1 | Resource safety | Semantic consistency | Whether runtime-specific physical limits are acceptable, mandatory parity excludes unsupported hosts, or the choice waits for Zorg |
| Q2 | Recovery | Resource safety | Automatic recovery, application-directed reconnection, or an off-page continuity requirement |
| Q3 | Compatibility | Semantic consistency | Preserve app APIs and wire, preserve wire only, or allow justified migrations |

Round 1 option meanings; the preceding conversation carries the exact presentation:

**Q1 — Browser support bar:** May browser peers share AGP behaviour while browser-owned memory and socket-cleanup limits differ?

- (a) Yes, with explicit limits and existing native protections retained.
- (b) No; require the same physical guarantees, even if that excludes native browser WebSocket.
- (c) Defer this choice until Zorg supplies its deployment requirements; no contract revision meanwhile.

**Q2 — Suspension recovery:** What should users experience after a suspended tab returns?

- (a) Automatic reconnection and application resynchronization; no automatic replay of uncertain operations.
- (b) The application explicitly chooses when to reconnect; AGP reports the interruption.
- (c) Work must continue while the page is suspended or closed; that needs an owner outside the page.

**Q3 — Compatibility:** What must the eventual design preserve?

- (a) Current application APIs and wire compatibility; changes stay behind those boundaries.
- (b) Current wire compatibility; justified application API migrations are acceptable.
- (c) Neither is an absolute constraint; justified API or wire migrations may be proposed with an explicit migration plan.

Proposer recommendation, not stakeholder picks: Q1(a), Q2(a), Q3(c).\
The rationale is explicit ownership without reducing existing native protections, recovery rather than impossible page liveness, and freedom to propose a coherent contract without pre-authorizing breakage.\
Multiple picks and free-text corrections are accepted.\
Round 2 must refine the actual responses, not this recommendation.

---

## §1 Round 1 picks

| Q | Pick | Intent reading (1-line summary) |
|---|---|---|
| Q1 — Browser support bar | **ac** Explicit differences plus deferral | Candidate direction accepted in principle; final limits depend on Zorg |
| Q2 — Suspension recovery | **a** Automatic recovery | Reconnect automatically; application resynchronizes; do not replay uncertain operations |
| Q3 — Compatibility | **c** Justified migrations may be proposed | Quality is not subordinate to absolute compatibility; specific changes still need justification and review |

Verbatim stakeholder response: `1) ac 2) a 3) c`.

### §1.Q1 — Per-question interpretation

Hypothesis: given the resource-safety and semantic-consistency axes, Q1(a) permits exploring one common AGP contract with explicit differences in host-owned physical resources, without reducing existing native protections.\
Q1(c) qualifies that direction: Zorg's actual deployment requirements must be evaluated before the browser guarantees are finalized or the normative contract revised.\
The mixed pick is not collapsed to (a), nor treated as permission to publish an unproved bound.\
Q4 clarifies what preparatory work may proceed while that condition remains open.

### §1.Q2 — Per-question interpretation

Hypothesis: Q2(a), in the context of Q1(ac), seeks automatic restoration of connectivity rather than uninterrupted browser execution.\
AGP reconnection and application resynchronization have separate owners; neither may silently replay an operation whose earlier delivery is uncertain.\
This advances Recovery and preserves Semantic consistency, but leaves the cleanup-overlap policy and handling of fresh unsent work to Round 2.\
It does not demand background execution while a page is closed or authorize a browser-only recovery engine.

### §1.Q3 — Per-question interpretation

Hypothesis: Q3(c) makes a coherent, correct shared contract the priority, while requiring an explicit migration argument for any proposed API or wire change.\
This leaves Compatibility as a cost to account for rather than an absolute prohibition or a license to break consumers casually.\
Together with Q1(ac), it authorizes considering alternatives, not changing a normative contract before the relevant consumer requirements and review.

**Round-1 composite read:** Explore a shared, truthful CLI/browser contract with automatic reconnection and application-owned resynchronization, allowing justified migration proposals.\
Final browser limits remain conditional on Zorg's deployment evidence; Q1(ac) leaves the scope of work before that evidence as the principal clarification for Round 2.

**Round-1 axiom / principle anchoring:** A3 requires distinct ownership of AGP semantics, host resource controls and application recovery; explicit host limitations must not become divergent browser/CLI policy engines.\
A13 requires retaining the director's conditional acceptance, while the existing delivery-certainty contract prevents recovery from converting unknown delivery into a safe-retry claim.

| Question | Primary outcome axes | Secondary outcome axes |
|---|---|---|
| Q1(ac) | Resource safety, Semantic consistency | Compatibility |
| Q2(a) | Recovery | Semantic consistency, Resource safety |
| Q3(c) | Semantic consistency | Compatibility |

Compatibility remains visible as migration cost; no original axis was discarded.

---

## §2 Round 2 picks

Strategy: mix disambiguation of Q1(ac) with refinement of the recovery and resource consequences of Q2(a).\
Verbatim stakeholder response: `4 abc, 5) defer to your recommendation 6) a`.

| Question | Relation to Round 1 | Primary axis | Secondary axis | Reason for asking |
|---|---|---|---|---|
| Q4 | Disambiguates Q1(ac), constrained by Q3(c) | Semantic consistency | Compatibility | Distinguishes a conditional draft from waiting on all transport reasoning or prioritizing portability work |
| Q5 | Refines Q1(ac) and Q2(a) | Resource safety | Recovery | Establishes whether bounded overlap with unreleased native resources is acceptable during reconnection |
| Q6 | Deepens Q2(a) under A3 | Recovery | Semantic consistency | Places responsibility for fresh unsent work without changing the prohibition on replaying uncertain operations |

**Q4 — Before Zorg responds:** What should we advance now?

- (a) Draft the shared contract and alternatives; leave final limits and ratification pending Zorg's evidence.
- (b) Wait for Zorg before further transport design.
- (c) Prioritize portable-runtime work proposals; defer the transport contract draft.

**Q5 — Cleanup and reconnection:** After AGP stops using a failed connection, what if the host has not confirmed physical socket release?

- (a) Allow bounded overlap with closing sockets; cap retained resources and pause reconnection if that budget is exhausted.
- (b) Wait for confirmed release before reconnecting; avoid overlap even if recovery stalls.
- (c) Allow a bounded cleanup wait, then stop automatic recovery and report a fault if release remains unconfirmed.

**Q6 — New work while disconnected:** Who should hold fresh, never-dispatched work?

- (a) The application; AGP reports unavailability rather than adding an offline outbox.
- (b) AGP, in a bounded queue with explicit expiry and cancellation rules.
- (c) Make immediate rejection versus bounded waiting an explicit caller choice in the shared AGP API.

All Q6 options retain delivery uncertainty for prior attempts and forbid automatic replay of uncertain operations.\
The question concerns fresh work during an outage, not permission to drop existing accepted work or change existing send guarantees silently.\
Q5 concerns logical-versus-physical cleanup accounting, not reversing packets that may already have been dispatched.

Proposer recommendation, not stakeholder picks: Q4(a), Q5(a), Q6(a).\
This allows conditional design progress, makes reconnection subordinate to a resource budget, and leaves application operation policy outside AGP.\
Exact bounds, public surfaces and compatibility impacts remain design work conditional on Zorg's requirements.

| Q | Pick | Round-1 aggregate relation | Intent reading |
|---|---|---|---|
| Q4 - Before Zorg responds | **abc** Draft, wait and prioritize portability | Disambiguates Q1(ac), but retains tension | Portable-runtime proposals can proceed; do not erase the wait condition for transport design |
| Q5 - Cleanup and reconnection | **a** Recommendation accepted by reference | Refines Q1(ac) and Q2(a) | Bound overlap with closing sockets and pause acquisition at the limit |
| Q6 - Fresh unsent work | **a** Application ownership | Deepens Q2(a) | No new AGP offline outbox; applications own deferred operations |

### §2.Q4 — Per-question interpretation

Hypothesis: in the context of Q1(ac), Q4(abc) asks for preparation and portable-runtime progress without committing ahead of Zorg.\
The literal options also conflict about whether transport drafting should start now; this record retains that conflict rather than treating the entire pick as approval of Q4(a).\
Prioritizing portable-runtime proposals, reviewing incoming evidence and retaining existing contracts is the available intersection.\
A substantive transport-design step that depends on choosing one side of the conflict needs the missing consumer input reviewed or further direction.

### §2.Q5 — Per-question interpretation

The director explicitly referred to the displayed recommendation, Q5(a), so this is acceptance by reference rather than an inferred pick.\
Given automatic recovery in Q2(a), bounded overlap avoids making each reconnect depend on immediate host release, while Resource safety requires retained sockets to consume budget until release is established.\
No slot may be reclaimed merely because AGP committed a logical terminal; recovery must pause and report the condition when the budget is exhausted.\
The numeric budget, shared-worker ownership, observations and deadline semantics remain design questions.

### §2.Q6 — Per-question interpretation

Hypothesis: Q6(a) locates holding, expiring and retrying fresh offline operations in the application, consistent with A3 and Q2(a)'s application resynchronization.\
AGP exposes unavailability and preserves existing delivery certainty; it gains neither an offline outbox nor permission to replay a possibly dispatched attempt.\
This answer does not remove normal bounded in-session queues or dispose of already accepted work.\
Recovery restores connectivity while application meaning remains with its owner.

**Round-2 composite read:** Recovery may overlap a bounded number of closing native resources, and offline operation storage stays application-owned.\
Portable-runtime proposals can progress, but Q4(abc) retains preparation and waiting constraints for substantive transport design; neither becomes implementation approval.

**Round-2 axiom / principle anchoring:** A3 sharpens the Round-1 boundary by keeping offline operation policy outside AGP and native cleanup accounting with its actual owner.\
A13 requires carrying the mixed sequencing choice honestly, while delivery certainty forbids silently resubmitting unknown attempts.

| Question | Primary outcome axes | Secondary outcome axes |
|---|---|---|
| Q4(abc) | Semantic consistency | Compatibility |
| Q5(a) | Resource safety | Recovery |
| Q6(a) | Recovery, Semantic consistency | Compatibility |

---

## §3 Composite intent envelope

The intended result is one observable CLI/browser AGP model with truthful host-specific resource limits, automatic connection recovery, and no new application-operation policy inside AGP.\
Explicit runtime differences are a candidate direction, not permission to weaken native protections or call an unenforceable browser bound conforming.\
Routine credential rotation remains connection-preserving under earlier intent; reconnecting after an actual interruption is a separate recovery case.

Recovery may overlap a bounded number of resources whose physical release remains unconfirmed; applications own resynchronization and fresh offline work.\
Unknown earlier delivery remains unknown.\
API or wire migrations may be proposed when justified, with affected consumers, alternatives and migration costs visible; none is approved by these picks alone.

Q4's timing constraint travels with this intent: portable-runtime proposals and evidence review can proceed, but conditional drafting is not a ratified transport design.\
Zorg's requirements must be evaluated before final browser guarantees are chosen.\
The draft requirements discovered after these answers are an input to that evaluation, not automatic satisfaction of the design gate.

**Final axiom / principle anchoring:** A3 requires separate owners for AGP semantics, native resource accounting and application operation policy, communicating through explicit interfaces without a browser-specific policy fork.\
A13 preserves both mixed picks and the limited acceptance of Q5(a); delivery certainty constrains every recovery, migration and cleanup proposal.

---

## §4 Scope summary

| Axis | Bound |
|---|---|
| Title | Shared browser and CLI transport guarantees |
| Scope | `B50`, with `B6` authentication and `B51` endpoint-policy dependencies kept separate |
| Primary outcome | Shared semantic behaviour with honest resource bounds and recovery |
| Secondary outcome | Consumer-shaped compatibility and migration decisions |
| Outcome-axis roll-up | primary: Semantic consistency, Resource safety, Recovery; secondary: Compatibility |
| Outcome-axis Round 1 | primary: Semantic consistency, Resource safety, Recovery; secondary: Compatibility |
| Outcome-axis Round 2 | primary: Resource safety, Recovery, Semantic consistency; secondary: Compatibility |
| Principle roll-up | primary: A3 and delivery certainty; secondary: A13 |
| Principles in each round | A3, A13 and delivery certainty |

---

## §5 Anti-goals

| Out of scope | Composes with later |
|---|---|
| Production carrier or normative revision from survey answers alone | Separately reviewed design and explicit implementation selection |
| AGP offline outbox, replay or application resynchronization | Application and operation-proxy composition, preserving AGP delivery certainty |
| Selecting admission proof, token format or credential-expiry policy here | `B6` and Zorg's credential-issuer proposal |
| Treating route visibility as authorization or ingress identity as arbitrary multi-hop origin | `B51` and consumer permission requirements |
| Assuming successful routine credential rotation must tear down existing sessions | Separate admission-versus-live-authority analysis under `B6` |

---

## §6 Flags and open questions for design

These flags qualify the recorded intent; filling an envelope does not resolve them.

| Flag | Consequence for next work |
|---|---|
| Q4 selects drafting, waiting and portability together | Preserve every pick; advance compatible preparation until consumer input is reviewed or the director clarifies |
| Browser and worker deployment requirements remain unagreed | Review Zorg's browser matrix, worker lifecycle, CSP and resource budgets before fixing guarantees |
| Bounded overlap needs truthful physical-resource accounting | Define owner, scope, cap, cleanup observation and exhaustion behaviour; no budget release on logical terminal alone |
| Portability reaches IDs, fairness and schema compilation | Propose these together with native parity and public-package checks; no hidden shim or relaxed-CSP assumption |
| Q3(c) permits migration proposals, not arbitrary breakage | Identify affected consumers, public types, wire compatibility and alternatives for each change |
| Zorg's new requirements response still describes D38 without D39's qualifications | Review the amended decision record, not the response alone; do not import downstream rulings as AGP authority |

---

## §7 Sequencing and cross-work considerations

### §7.1 Branch and review strategy

No branch, commit, push or production change is selected by this survey.\
Keep research, contract proposals and implementation separately reviewable.\
Preserve the unrelated uncommitted B49 public-type correction.

### §7.2 Composability with pending work

Portable-runtime proposals under B50 can use the measured bundle/CSP and source evidence now.\
Zorg's draft requirements are available at source revision `7f7155b7847b20520b1d835f767d714018612626`; the document still says candidate comparison comes before sending.\
That is new input, not a completed AGP review, experiment agreement or implementation request.\
The [intake record](../VERIFICATION.md#416-shared-transport-intent-and-zorg-draft-intake) distinguishes the response from D39's amendments and retains the dependencies of B6, B51 and B48.

### §7.3 Compressed timeline

Do not collapse intent, consumer evidence, contract review and implementation into one phase.\
The director requested quality in scope; both mixed picks retain conditions that premature implementation would bypass.

---

## §calibration

- **Stakeholder time-cost:** 6 minutes across both rounds, reported by the director in response to the separate timing question.
- **Comparison baseline:** none.
- **Observed interaction:** Six questions across two rounds; two mixed picks; Q5 accepted by reference to the displayed recommendation.

Q1 and Q4 mixed direction and sequencing, leaving a constraint to preserve rather than eliminating ambiguity.\
Future surveys should separate these axes more cleanly.\
The calibration measures stakeholder effort, not agent wall time or design quality.

---

## §contradictory

Q1(a) accepts a candidate direction while Q1(c) postpones deciding it.\
Q4 retains drafting now, waiting and prioritizing portability together.\
These are preserved as constraints rather than silently flattened to approval.

| Round | Question | Picks | Constraint carried forward |
|---|---|---|---|
| 1 | Q1 | a, c | Explore runtime limitations without final guarantees or normative revision before evaluating Zorg requirements |
| 2 | Q4 | a, b, c | Preserve drafting, waiting and portability priorities; compatible preparation does not select the transport-drafting branch |

---

## §8 Cross-references

- Survey methodology: `/home/apnex/.codex/skills/survey/SKILL.md`, both round templates and the envelope validator.
- [B50 and related board work](../BOARD.md#build-order).
- [Browser feasibility evidence](../reviews/browser-carrier-feasibility.md).
- [Transport contract](../design/transport-contract.md) and [WebSocket binding](../design/binding-websocket.md), unchanged.
- [A3 Sovereign Composition](https://github.com/apnex/mission-kit/blob/main/axioms/A3-sovereign-composition.md) and [A13 Director Intent Amplification](https://github.com/apnex/mission-kit/blob/main/axioms/A13-director-intent-amplification.md).
- [Zorg draft intake](../VERIFICATION.md#416-shared-transport-intent-and-zorg-draft-intake); no downstream design adoption implied.
