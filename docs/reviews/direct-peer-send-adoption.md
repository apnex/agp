# Direct peer send adoption recommendation

Status: proposed, 2026-10-17; prepared for the director, not ratified or approved for implementation.\
Authority: the director selected preparation of the B51 adoption packet with "continue".\
Tier 3: `[MEASURED]` identifies inspected evidence, `[ARGUED]` a recommendation, `[DIRECTOR]` recorded direction and `[OPEN]` a remaining gate.

[ARGUED] Adopt the reviewed direct-peer send contract as one optional restriction over AGP's existing send mechanism.\
It preserves useful reconnects within one authorized instance binding without permitting a reply to another binding, advertiser or intermediate peer.\
The same admission and protection rules serve CLI and browser callers; credentials, issuer leases and application calls remain outside AGP.

[MEASURED] The [frozen D62 design](evidence/direct-peer-send-design-review-input.txt) has independent technical and scoped M7 PASS with [implementation guardrails](direct-peer-send-independent-review.txt).\
This packet carries that contract forward, maps its implementation obligations and identifies the remaining documentation-assurance gate; it supplies no new independent verdict.

---

## 1. Proposed ruling and limits

[ARGUED] The later ratification should adopt the following as one coordinated B51 contract, using [design sections 4 through 8](../design/direct-peer-send.md#4-proposed-public-data-contracts) as the detailed specification:

| Decision to adopt | Consequence |
|---|---|
| Explicit `AgpNode.sendDirectPeer` returning the existing `SendReceipt` | A consumer can reject an unsupported runtime; no ordinary-send fallback |
| Optional association on admission's allow branch, captured in optional `EndpointDeliveryContext.directPeer` | Existing admission providers remain valid for ordinary use; absent metadata grants no restricted-send authority |
| Closed, immutable authenticated or explicit unauthenticated associations | Authenticated equality covers issuer, principal and instance binding exactly; no normalization, implicit downgrade or physical-process exclusivity claim |
| Required target and independent minimum protection | Authentication never substitutes for channel confidentiality; host policy selects the floor |
| Direct candidate filtering before deterministic selection, with exact controller ownership | No local shortcut, relay, other advertiser or wait for a future connection; an eligible replacement can be selected before admission |
| Shared admission, derived pin and one-hop budget | Preserve source/export checks, deadlines, capacity and dispositions; no migration or replay after writer admission |
| Local `DIRECT_PEER_UNAVAILABLE` with `retryable: false` | Refuse unsatisfied eligibility before packet or reverse-binding admission; no new wire error |

[ARGUED] Keep the design's 1-to-256 Unicode-scalar bounds and plain-data requirements for authenticated identifiers.\
Validation must create owned nested values before asynchronous work; TypeScript `readonly` or an outer freeze alone cannot provide that guarantee.\
The target is trusted-host policy data, not an unforgeable capability against code holding the node API.

[ARGUED] Preserve ordinary `send()` and the ratified any/preferred/pinned semantics, including multi-hop pins.\
Do not select a credential format, browser carriage, lifecycle observation API, operations-snapshot extension, management write API, active revocation mechanism or separate CLI command here.

[OPEN] The director's later ruling must be appended to [DECISIONS.md](../DECISIONS.md), dated, attributed and bound to the reviewed artifact and the absorption obligations below.\
No decision number is reserved by this recommendation, and preparation is not ratification.\
A material semantic change must return to technical and scoped axiom review rather than inherit this draft's PASS.

---

## 2. Public-contract absorption

[MEASURED] At the inspected source revision, `AgpNode` is declared in `node.ts`, data types in `@agp/core`, and the core contract generator emits owned schemas, their catalog, schema-document exports and closed code unions.\
[ARGUED] Make the following changes together in the implementation branch; paths described as new are proposed destinations, not existing artifacts or minted schema IDs.

| Surface and owner | Required absorption |
|---|---|
| [Core data types](../../packages/core/src/types.ts) | Add `PeerAuthorizationAssociation`, `DirectPeerDeliveryContext`, `DirectPeerSendPolicy` and `DirectPeerSendOptions`; extend only the allow result and optional delivery context; preserve flat ingress IDs |
| [Core contract source](../../packages/core/scripts/generate-contracts.mjs) | Define the new closed data shapes; proposed new SDK schema filenames are `peer-authorization-association.schema.json`, `direct-peer-delivery-context.schema.json` and `direct-peer-send-policy.schema.json`; extend existing [admission result](../../packages/core/src/schemas/v1/sdk/identity-admission-result.schema.json), [delivery context](../../packages/core/src/schemas/v1/sdk/endpoint-delivery-context.schema.json) and [SDK error code](../../packages/core/src/schemas/v1/codes/sdk-error-code.schema.json) definitions |
| Generated and exported contracts | Regenerate the [core catalog](../../packages/core/src/schemas/v1/catalog.json), [schema documents](../../packages/core/src/schema-documents.generated.ts), [code union](../../packages/core/src/code-types.generated.ts) and [composed catalog](../../schemas/agp-v1.schema-catalog.json); verify discovery through [core's public exports](../../packages/core/src/index.ts) and [schema API](../../packages/core/src/schema.ts) |
| [Node API](../../packages/node/src/node.ts) and [package exports](../../packages/node/src/index.ts) | Add the required method and public option/context types; update structural implementers and test doubles; distinguish `node.sendDirectPeer` failures without changing ordinary send's failure contract |
| [SDK contract](../design/sdk.md) | Describe the method, support check, context absence, validation/eligibility failures, error-operation matrix, admission-only receipt and cancellation boundary |
| [Contract ownership](../design/contracts.md), [routing](../design/routing.md) and [FSM](../design/fsm.md) | Record the owned data shapes, exact-owner constrained query, direct capture and guarded installation; carry forward source-export and terminal ownership rules |
| [Destination selection](../design/destination-selection.md) and [mechanism map](../design/mechanisms.md) | Explain that ordinary pins remain multi-hop and the new opt-in restriction is narrower; link the new mechanism without marking unbuilt behavior as built |
| [Semantic-rule registry](../../schemas/agp-v1.semantic-rules.json) and [core-owned projection](../../packages/core/src/semantic-rules/v1/semantic-rules.catalog.json) | Bind contextual rules that JSON shape cannot establish to their owning checks; follow the existing generation path, rather than manually diverging generated projections |

[ARGUED] Keep `AbortSignal` process-local, outside the policy schema, and derive protection vocabulary from the existing neutral transport contract.\
No association or secret belongs on the data wire; the [existing data-body schema](../../packages/protocol/src/schemas/v1/wire/data-body.schema.json) already permits the required one-hop budget.

[MEASURED] Existing `send-policy` permits a zero timeout as data, while `NodeImpl.send` requires a positive safe integer.\
[ARGUED] State the new invocation's effective positive timeout domain explicitly and check schema/runtime agreement or its declared contextual predicate; do not silently change ordinary send's behavior while extracting shared normalization.

[ARGUED] New schemas must be discoverable through existing package APIs, not merely present on disk.\
The package-root compile check should follow the [existing disposition type-test pattern](../../packages/node/test/contract/disposition-types.test.js), covering supported calls, forbidden selector combinations, deny-branch metadata and structural implementations.\
The optional fields preserve older providers, not older validators or restricted-send support: update consumer schema dependencies with the implementation.

---

## 3. One shared implementation sequence

[ARGUED] Use one AGP integration owner for controller changes shared with B53.\
The rows are dependency-ordered work packages, not permission to implement or independently publish each intermediate state.

| Stage | Work and existing integration points | Exit condition |
|---|---|---|
| Adoption | Complete section 5's documentation assurance, record the director's decision and bind section 2's absorption duties | Approved contract and selected implementation scope, with current versus target behavior distinguished |
| Data boundary | Prepare the core-owned shapes, runtime value snapshotting and public declarations in the implementation branch | Closed data and compile-time conformance are established; incomplete runtime work remains unpublished, with no public stub or types-only restricted-send promise |
| Exact routing | Extend [core routing](../../packages/core/src/routing.ts), [routing composition](../../packages/node/src/routing-adapter.ts) and [data-plane ports](../../packages/node/src/data-plane.ts) to carry exact ownership and constrain candidates before selection | Node uses declared core facts, not operations snapshots or a reusable node/session pair; canonical order and ordinary routing remain unchanged |
| Guarded capture | Integrate association acceptance into [session control](../../packages/node/src/session-controller.ts) at B53's successfully guarded identity commit; copy direct delivery context before handler scheduling | Expired, terminal and collision-losing work cannot install authority; the exact ingress is admitted and its remote node equals the source origin |
| Shared sending and accounting | Implement the node entry point through [shared send orchestration](../../packages/node/src/node.ts) and the existing data-plane resolver/admission path; reuse [send guard](../../packages/node/src/send-admission.ts), [writer](../../packages/node/src/session-writer.ts) and disposition ownership | Types, schemas and implementation agree; one eligibility-to-writer commit, pin plus one-hop budget, unchanged ordinary precedence and explicit metadata charges |
| Consumer migration and verification | Coordinate caller-identity and operation-call against the verified producer surface; retain credential-issuer's separate lifecycle gate | Every reply branch uses captured authority and explicit protection, with unsupported use refused; independent implementation review and required acceptance evidence recorded |
| Publication | Select an exact coherent revision and migration notice after verification | Separate approval to commit/push or publish as needed; no claim that a dependency pin alone is consumer acceptance |

[MEASURED] Current `routeToInstance()` returns one public candidate projection, while the routing core retains private controller ownership and node lookup resolves a public node/session pair.\
[ARGUED] Calling that query once and rejecting its winner cannot implement the proposed filtering contract.\
The new declared query must preserve exact ownership without turning a diagnostic snapshot into authority or exposing a B6 lifecycle API by accident.

[MEASURED] The [handler ledger](../../packages/node/src/handler-ledger.ts) charges the supplied byte count; today's delivery path supplies payload bytes.\
[ARGUED] Inventory every AGP-retained association or target copy, name its finite reservation and release point, and include metadata in the applicable budgets before claiming bounded retention.\
Copies must not retain controllers, carrier objects or an unbounded history; application retention after AGP's handler lifetime remains application-owned.

[ARGUED] Schema/type preparation and routing work can be prepared without selecting the B6 API.\
Runtime association installation cannot be accepted on today's uncorrected callback continuation: B53's [reviewed guarded-commit repair](admission-lifetime-correction-r4.md) must complete its own adoption and implementation gates and be integrated.\
A callback returning `allow` is neither identity commit nor issuer reservation transfer.

---

## 4. Acceptance and owner boundaries

[ARGUED] Use [design section 8](../design/direct-peer-send.md#8-acceptance-obligations) as the full behavioral checklist and the independent review's seven closeout hooks as its integration cross-check.\
The table below allocates the evidence; these are obligations, not executed tests.

| Owner | Evidence required before the corresponding claim |
|---|---|
| Core contract and routing | Package-root type/schema agreement, exact-owner constrained query, deterministic order among eligible candidates and unchanged ordinary selection |
| Node admission and delivery | Owned bounded plain-data snapshots, guarded installation, correct direct-context presence/absence and explicit metadata accounting |
| Node sending | Admission to every disallowed writer is zero; expected eligible admission is observed; cancellation, timeout, size/export and capacity precedence remain intact |
| Node/wire integration | Pin and one-hop behavior use the existing wire; no post-admission migration or replay; dispositions retain exact-controller isolation and delivery uncertainty |
| Caller-identity | Explicit mode and canonical authority, proved binding-to-node association, no failed-proof downgrade; no reply-time dependency on swept session records |
| Operation-call | Startup support check and captured target/protection on answers, malformed/input refusals, descriptions, evidence/handler failures and both failed-end fallback stages |
| Credential issuer and B6 composition | Unique allocation identifiers, finite non-evicting leases, four conjunctive release conditions, continuous per-redemption reservation transfer and exact-controller lifetime evidence |
| Carrier and deployment owners | B50 establishes protected CLI/browser behavior; B54 establishes the actual peer/route/resource envelope; in-process success establishes neither |

[MEASURED] [D62](../../../zorg/upstream/agp-direct-peer-send-lifecycle-reply.md) and the [issuer contract](../../../credential-issuer/CONTRACT.md) agree that release requires no usable outstanding key, no pending use able to publish, no live admitted controller, and elapsed authoritative grace.\
Unknown observations retain the lease; older completions cannot revive a binding or release a replacement reservation.\
The binding/AGP boundary still owes per-redemption handoff or terminal invalidation under one absolute opening deadline, plus exact admitted-controller lifetime.

[OPEN] B6 must choose the declared producer API with its owners; snapshot extension versus lifecycle query/callback remains unresolved.\
This gates production issuer reclamation, not adoption of B51's already-reviewed equality and direct-send contract.\
B53 supplies guarded commit, not credential issuance or a license to infer absence from incomplete snapshots.

[ARGUED] Keep AGP's normative contract in AGP.\
The [caller-identity](../../../caller-identity/CONTRACT.md) and [operation-call](../../../operation-call/CONTRACT.md) owners should reference it and record their own migration and acceptance, not receive a copied second specification.\
No further Zorg policy question is needed for B51's agreed shapes; send the verified revision and remaining owner duties when there is an implementation to adopt.

---

## 5. Remaining documentation assurance

[OPEN] Independent technical/M7 review is complete for the frozen design, but M2 fresh-reader assurance remains before ratification.\
Neither this author inventory nor documentation lint supplies it.

[ARGUED] Prepare one bounded comparison of the adoption guidance: use the preserved reviewed D62 contract as the baseline, and the same contract plus this packet as the candidate reading set.\
Freeze the exact sets and necessary inlined context before execution, so a reader needs no repository, linked-document lookup or conversation history.\
This tests what a maintainer can decide about adoption, rather than reopening agreed identity policy or substituting the older, superseded lifecycle proposal.

Required preparation:

1. Derive questions from the maintainer's duties: identify the guarantee and excluded claims, assign owners, find contract absorption sites, sequence integration, select sufficient acceptance evidence and distinguish adoption from publication.
2. Include unchanged controls the baseline already answers, such as ordinary-pin behavior, admission versus delivery, no fallback and B6 ownership; do not build only questions about the new inventory.
3. Write the answer key and grounding rules prospectively, including when "not established by this document" is correct; separate documentary support from a technically plausible guess.
4. Freeze and commit the questions, key, exact reading sets and protocol before any scored reader, then obtain a fresh independent key audit and correct any finding prospectively.
5. Use several fresh, blinded readers per version, no history or repository, and keep the key auditor separate from scored readers; freeze sample, validity and scoring rules before execution.
6. Preserve the answers and inspect ambiguities as well as scores; if the author scores, ties go to the baseline, and regressions on controls cannot be hidden by added-detail gains.

[OPEN] This packet is not that preregistration: it selects no provider, evaluator, spending cap or reader execution.\
The stopped B53 provider/assurance work supplies neither readiness nor an assurance verdict for B51.\
Any execution setup must meet the chosen isolation and evidence requirements; inability to do so is a reported limit, not authority to substitute a cheaper check.

[ARGUED] Next prepare the prospective questions, key and reading-set definition for this bounded comparison.\
Commit and independent-agent authority must be obtained before those later steps; the prior one-reviewer authorization does not silently authorize another run.

---

## 6. Alternatives and costs

| Option | Assessment |
|---|---|
| Recommended explicit method over the shared engine | Public API, schema, runtime and consumer migration cost; preserves ordinary behavior while making unsupported use fail closed |
| Restriction as an option on ordinary send | Could work only with an equally reliable support boundary; current runtimes can ignore unknown options, so it is not a safe drop-in replacement |
| Bind replies to the original session forever | Simpler identity comparison but loses the selected reconnect utility; not the agreed instance-continuity contract |
| Duplicate CLI/browser enforcement | Adds two implementations of the same guarantee and parity burden; conflicts with the selected unified mechanism |
| Defer B51 entirely until B6 is complete | Leaves the reply requirement unmet longer without resolving a missing B51 policy choice; retain B6's production gate instead |
| Do nothing | Ordinary pinned sends remain unable to promise the requested direct-channel restriction |

[ARGUED] The cost worth accepting is coordinated implementation and explicit resource accounting, not another identity service inside AGP.\
The independent review preserves the product's [ratified A3/A4/A8/A9/A14 scope](../design/axioms.md); this adoption packet neither advances that pin nor claims a new axiom verdict.

---

## 7. Evidence and closeout

[MEASURED] Inspection pins:

| Repository or artifact | Identity |
|---|---|
| AGP | `0aa6be75ccacf4e2c3770a49c5ea39970a25a98a` |
| Zorg D62 | `56350495934b90c63a17950bafaac71e16d7568e` |
| Caller-identity | `df4778e1cd5a0c2e9628492355f2475d2709ef51` |
| Credential-issuer | `ea5e34fd08d0b4764d3af09614f1a2a3593b20e7` |
| Operation-call | `3bfff2c7f9a6dee26fb9e3897b7c41a5437ea931` |
| Frozen independently reviewed design | SHA256 `bede054da088b516f55e09aa02e111a9dfdb61b57ead5b493cc90f4f2110119a` |
| Delivery-process guidance | Mission-kit `7d49e7063ebd9da81e560cd152261800a03ff098`; product axiom authority remains `5026604d3ef695651c21b24bd78410c7fec04b58` |

[MEASURED] The [author check record](direct-peer-send-adoption-checks.json) records source identities, documentation/record checks, narrow board changes and preservation of earlier work.\
The [verification entry](../VERIFICATION.md#453-direct-peer-send-adoption-preparation) records this preparation, not implementation acceptance.\
No normative contract, runtime, consumer repository, earlier review or assurance result is changed; nothing is committed or pushed by this step.

### Mechanics rationale and consequence

[ARGUED] Carry one reviewed contract into explicit owning files, dependency-ordered implementation and independently checkable acceptance.\
That makes the review actionable without turning its PASS into runtime proof.\
Publishing only new types would invite unsupported use; coupling B51 adoption to an unselected B6 API would obscure the different obligations rather than satisfy them.
