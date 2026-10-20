# Admission lifetime adoption recommendation

Status: proposed, 2026-10-11; prepared by AGP for the director.\
Authority: the director selected preparation of the B53 adoption decision; no public-contract adoption or implementation approval is recorded.\
Tier 3 assessment; `[MEASURED]` identifies source/check results, `[ARGUED]` recommendations and `[OPEN]` unresolved approval or assurance.

[ARGUED] Take the reviewed admission-lifetime design forward with optional cancellation, separate finite work budgets and truthful terminal accounting.\
The repair must end expired sessions independently of provider settlement without pretending unfinished work has been released.\
It must serve identity and route admission through one mechanism, without selecting an authentication protocol.

---

## Selected assurance direction

[DIRECTOR] The director selected "continue as recommended" for the complete contract, then resumed the assurance step with "continue".\
[MEASURED] Recorded on 2026-10-12 in the [fresh-reader preregistration](admission-lifetime-assurance/admission-assurance-preregistration.md#selection-and-authority).\
[OPEN] This selects the direction for assurance; it does not record final public-contract ratification or implementation approval.

[ARGUED] Proceed with optional shared cancellation, separate finite work budgets, truthful local capacity reporting and terminal accounting.\
The costs and alternatives below remain the decision basis, including the risk that indefinitely unfinished providers exhaust their pool.\
[MEASURED] The independently audited comparison has completed with a [fresh-reader assurance FAIL](admission-lifetime-assurance/admission-assurance-result.md); the selected direction is not ratified.\
[MEASURED] The [completed triage](admission-lifetime-assurance/admission-assurance-findings-triage.md) led to the director-selected [revision 4 clarification](admission-lifetime-correction-r4.md), which now has its own [independent technical PASS and scoped M7 PASS](admission-lifetime-independent-review-r4.txt).\
[MEASURED] The [fresh preregistration](admission-lifetime-assurance-r4/admission-assurance-preregistration.md) is committed; its [independent key/readiness audit](admission-lifetime-assurance-r4/admission-key-audit-01.txt) is FAIL on one failure-accounting mismatch with the pinned evaluator.\
[OPEN] Correct that rule prospectively and obtain a bounded independent recheck before any new reader execution; later ratification must record checkable contract-absorption obligations, including the proposed whole-teardown meaning of the close-timeout setting.\
The original assurance FAIL and its complete evidence remain unchanged.

---

## Selected public-contract direction

[DIRECTOR] The direction below is selected for assurance, not final adoption; do not treat selection as a fresh-reader PASS, runtime verification or closure of B53.\
The complete [revision 4 design](admission-lifetime-correction-r4.md) is the current technically reviewed mechanism reference, with its own [technical and scoped M7 verdicts](admission-lifetime-independent-review-r4.txt).\
It carries [revision 3](admission-lifetime-correction-r3.md) forward with expiry and teardown clarifications; its PASS is not inherited from the [earlier review](admission-lifetime-independent-review-r3.md) and does not change the selected direction into ratification.

| Contract choice | Recommendation | Cost and rejected alternative |
|---|---|---|
| Cancellation | [ARGUED] Add shared `AdmissionEvaluationOptions`, carrying `signal`, as an optional second argument to both admission ports; AGP always supplies it | Public type/export and compatibility work. Keeping one argument gives providers no AGP cancellation signal; requiring cancellation support forces migration without proving that provider work stops |
| Work accounting | [ARGUED] Separate identity and route evaluation pools; retain a reservation until the evaluation and retained result are disposed | A provider that never settles can exhaust its pool for the node instance's lifetime. Refunding on timeout would allow unfinished work to escape the bound; identity pressure must not consume route-policy capacity |
| Capacity reporting | [ARGUED] Adopt the proposed local `AdmissionCapacityExceeded` and `ContinuationQueueOverflow` events and capacity-wait reasons in the existing adjacency projection | Update closed event types/schemas and operational meanings together. A policy-denial label would falsely attribute a local resource refusal to the provider; a new retry owner would duplicate supervision |
| Terminal accounting | [ARGUED] Keep ordinary stopped-node cleanup counts live; on numeric-domain exhaustion freeze the actual retained counts, revision and capture time together | The final capture is last-known, not live cleanup telemetry. Zeroing unfinished work is false; post-failure live updates would require a separately designed revision authority |

[ARGUED] Retain revision 4's required internal commit/terminal integration, FIFO continuation barrier and establishment-only retry reset.\
These are not optional shortcuts: the proposed public accounting must describe the same authority and work that the runtime actually owns.

[ARGUED] Cancellation options remain process-local capabilities, outside request/result DTOs and their schemas; there is no wire change.\
The signal concerns one pending evaluation, not an established-session close handle, credential lifetime or proof that resources were freed.

---

## Proposed baseline defaults

[ARGUED] Retain revision 4's finite configurable defaults as baseline policy, not as measured tuning for hundreds of peers.

| Setting | Proposed default |
|---|---|
| `timers.identityAdmissionTimeoutMs` | 10000 milliseconds |
| `timers.routeAdmissionTimeoutMs` | 10000 milliseconds |
| `capacity.continuationQueueMessages` | Resolved `transportReceivePackets` |
| `capacity.continuationQueueBytes` | Resolved `transportReceiveBytes`; enough for one maximum packet |
| `capacity.maxIdentityAdmissionEvaluations` | Resolved `maxPendingHandshakes` |
| `capacity.maxRouteAdmissionEvaluations` | Resolved `maxSessions` |

[MEASURED] The current defaults supplying those counts are 64 receive packets, at least 4 MiB receive bytes, 64 pending handshakes and 64 sessions; see [configuration resolution](../../packages/node/src/node.ts).\
[ARGUED] The two work limits resolve independently after defaulting and count current work, revoked-but-unsettled work and settled results awaiting disposal; they are not heap-byte limits.\
An earlier OPEN deadline still wins, and the route-policy timeout does not promise that another peer's route-ACK deadline will tolerate that delay.

[OPEN] The [peer-scale amendment](browser-peer-scale-amendment.md) still needs its own decision and operating envelope.\
Do not increase session limits or endorse these budgets for hundreds of peers through this adoption decision.\
The cost of retaining the baseline is explicit deployment configuration and later workload verification, not a second browser contract.

---

## Compatibility evidence

[MEASURED] At AGP `f16266aaafa66f6301d7afbf09c55e3a1f990274`, both public admission ports accept one request argument.\
The in-repo inventory found the built-in zero-argument identity provider, one-argument route provider and injected identity providers in the peer-evidence and secure-WebSocket tests.\
Zorg's caller-identity at `4f365cfd9cb200bc4220bb44be741422e3db856c` exposes a one-argument wrapper and calls its host ruling with one argument.

[MEASURED] A strict, no-emit TypeScript check passed for a candidate optional-options surface using the packages' declared public type entry points: existing identity/route port assignments, the actual `CallerIdentity.admission` type, zero/one-argument providers, cancellation-aware providers and composition with the current node dependency type.\
No provider was executed and no public package was modified.\
This establishes candidate type compatibility, not cancellation behavior, browser conformance or consumer acceptance.

[ARGUED] Keep Zorg's wrapper and evidence-retention policy until an explicit verified migration.\
Its [current timeout wrapper](../../../caller-identity/src/caller-identity.ts) may settle while the host ruling remains unfinished; AGP can account for its port evaluation, not hidden work behind an already-settled wrapper.\
The wrapper's owner must retain responsibility for that underlying work; adopting B53 does not certify the consumer's private resource budget.

---

## Zorg handoff assessment

[MEASURED] The [sent Zorg reply](../../../zorg/upstream/agp-review-response-reply.md#2-the-whole-establishment-interval), at `1b7f4a3cc5029ddeb2c1b2d79a4b7d897a3c7e74`, proposes post-proof atomic redemption, one absolute deadline through OPEN and finite accounting for unreleased resources.

| Concern | Assessment |
|---|---|
| Logical expiry versus unfinished work | [ARGUED] Compatible with B53's separate authority, cleanup and reservation lifetimes; authentication slots and retained work must not be treated as the same counter |
| Deadline from redemption through establishment | [MEASURED] The current [accepted-channel interface](../../packages/transport/src/types.ts) carries a channel, not an inherited opening deadline; B53 proposes a local opening/admission bound, not this cross-boundary handoff |
| Future deadline composition | [ARGUED] B6 must settle ownership, clock domain, handoff failure and the point the bound ends; an inherited bound must not restart or lengthen at handoff. Do not add a raw deadline field or claim the whole interval is solved here |
| Redemption, reply isolation and relayed identity | [OPEN] Remain separate B6/B51 design choices; none is authorized by adopting the admission repair |

[ARGUED] No conflict found in the lifetime principles requires changing the frozen reviewed draft.\
That is a compatibility assessment, not approval of Zorg's proposed mechanism or a full adversarial review of its reply.

---

## Costs and adoption gates

[ARGUED] The coordinated change must reach the core/node public types and exports, configuration and closed-event schemas/catalog, SDK/FSM/routing/operations contracts and their tests.\
The runtime commit/terminal integration reaches all operations publications, not only admission callbacks.\
An implementation plan must inventory those publication sites and operations readers; this packet does not claim that inventory is complete.

[MEASURED] The independent review found no material design blocker, but retained three explicit adoption/implementation duties: reconcile the schema-representable timeout domain with effective positive safe-integer configuration, enforce both per-send and total teardown deadlines, and complete the publication-site inventory.\
[ARGUED] Preserve the existing prohibition on concurrent send and close, timer progress during bounded drain, exact-generation authority and truthful resource accounting when integrating that repair.\
These are required acceptance obligations, not behavior established by the static PASS.

[ARGUED] The alternative of implementing only the already-owed lifetime correction remains viable but leaves cooperative cancellation unavailable.\
Doing nothing retains the defect and the consumer workaround.\
Mandatory provider migration and a new post-failure telemetry domain add cost without being necessary for the reviewed guarantee.

[OPEN] Remaining sequence:

1. Correct the new packet's behavior-failure accounting to distinguish retained raw text from judge-eligible answers, then commit and independently recheck that prospective change. Retain the frozen packet, readiness FAIL, revision 4 design review and original assurance record; no retrospective regrade or selective rerun can turn the earlier failed gate into a PASS.
2. Execute and judge only that separately reviewed comparison; keep its verdict distinct from the design review and the original FAIL.
3. Record director ratification as a numbered decision with checkable absorption obligations, then implement and verify the complete repair.
4. Give Zorg the exact verified revision and migration duties; keep B53 open until its runtime obligations are established.

[MEASURED] The original [preparation checkpoint](../VERIFICATION.md#428-admission-lifetime-adoption-preparation) records source pins and compatibility checks; the [subsequent checkpoint](../VERIFICATION.md#431-admission-assurance-preparation-and-consumer-pin-publication) records assurance and the separately approved consumer-pin publication.\
The [new preparation and audit record](../VERIFICATION.md#434-admission-clarification-assurance-preparation) preserves the separate readiness finding; no new scored comparison has run.\
[OPEN] None of these steps authorizes final adoption, runtime implementation or B53 closure.
