# Zorg direct peer requirements review

Status: review complete; contract design and implementation remain unapproved.\
Assessment: AGP, 2026-10-11; recommendations and failure hypotheses below are Tier 3 analysis, not production findings.

Zorg's response is a sound basis for joint design, but not yet an implementable contract.\
Support one admission model across native and browser peers, preserving certificate-free native PSK and transport-owned proof where feasible.\
Resolve acquisition, redemption and exact-session ownership before selecting browser credential carriage or adding public APIs.

Subsequent work: the [shared lifecycle comparison](admission-lifecycle-comparison.md) makes both candidates' commit points and ownership costs explicit and distinguishes existing acquisition-contract debt from new capabilities.\
It remains a draft, not selection of either candidate.

---

## 1. Mechanics and evidence

| Input | Pinned scope |
|---|---|
| Requirements under review | Zorg [response](https://github.com/apnex/zorg/blob/56144bf56f326651f3dac89a5945fc28b66c0a9e/upstream/agp-requirements-response.md) at `56144bf56f326651f3dac89a5945fc28b66c0a9e`, explicitly sent for review |
| Consumer decisions | Zorg [D38 through D41](https://github.com/apnex/zorg/blob/56144bf56f326651f3dac89a5945fc28b66c0a9e/docs/DECISIONS.md#d38---every-connection-is-admitted-with-a-short-lived-single-use-key-which-a-sovereign-component-issues); requirements, proposals and component implementations have different authority |
| Component contracts considered | `credential-issuer` at `a5365ae`, `caller-identity` at `17fb531`, `operation-proxy` at `9143eb6`; proposed browser and credential capabilities are not built behaviour |
| AGP source | `ee99d741b6c250c0f2525a24b8dbd4ef3a14cab8`, also the response's baseline; local HEAD `1723c9d10870806f9e84630085110f35c1f8077b` changes public disposition declarations, their tests and documentation, not these runtime mechanisms |
| Existing evidence | [Initial boundary review](browser-peer-feasibility.md), [browser observations](browser-carrier-feasibility.md), [director's completed survey](../surveys/shared-transport-survey.md) |
| Independent constraints | WHATWG's browser interface, IETF's TLS and token semantics, and Node's PSK callback contract, cited at the findings they constrain |

Zorg's response and its component declarations are one source family, not independent corroboration.\
AGP source, browser standards, protocol standards and runtime documentation supply separate constraints; none is live deployment or independent security assurance.\
Drawv2 deployment and workload figures remain Zorg's source-backed or historical reports, not newly measured facts.

---

## 2. What the response settles

These are Zorg's stated requirements and proposals, not ratified AGP changes.

| Previous dependency | Current input and consequence |
|---|---|
| Receipt and D39 reconciliation | The response is sent and incorporates live-key-only reuse closure and the application revocation-record qualification; the earlier draft-intake objections are superseded |
| Connection owner | A shared worker per application, identity and target within its worker scope, or a native proxy; tabs and commands hold neither connection nor admission key |
| Admission versus live authority | Fresh short-lived credentials govern new admission only; existing sessions need no periodic renewal and may outlive their admission credential |
| Deployment | Same-origin and separate-host hubs are required; IAP/sign-in verification remains at the application and issuer, outside AGP |
| Present permissions | All admitted peers reach hub-local operations; applications authorize operations; peers advertise their own reply endpoints; transit is off |
| Browser constraints | Strict CSP and a multi-browser SharedWorker target are proposed; neither the browser support set nor numerical bounds are approved or measured by AGP |
| Typed surface | The separate disposition request is committed locally at `1723c9d`; no push, downstream pin update or consumer acceptance is implied |

The response explicitly corrects the earlier claim that the legitimate client's next fresh-key attempt necessarily ends a session admitted with stolen material.\
Keep that qualification: a short admission lifetime is not a short maximum session lifetime.

Zorg also explicitly accepts the availability cost of closing on reuse of a still-live bearer credential.\
That policy does not establish which holder is legitimate; it belongs above AGP's exact-session mechanism.

---

## 3. Source facts

| Surface | Observation at the AGP baseline | Source |
|---|---|---|
| Acquisition | Each dial receives a newly created signal that the node never aborts; no node-owned acquisition deadline brackets the call; OPEN timing begins after acquisition | [`NodeImpl.#dial` and `#createController`](../../packages/node/src/node.ts) |
| Retry | A rejected acquisition schedules another dial under enabled backoff regardless of rejection class | [`NodeImpl.#dial` and `#scheduleDial`](../../packages/node/src/node.ts) |
| PSK material | `localIdentity` is readonly and `own()` / `resolve()` are synchronous; node-keyed listener evidence uses the observed key identity as its principal | [Provider](../../packages/transport/src/types.ts), [security projection](../../packages/transport-node-ws/src/security.ts) |
| Admission | Identity policy receives OPEN identities, session identifiers and immutable channel evidence; its request exposes neither a cancellation signal nor a credential/reservation capability | [Admission call](../../packages/node/src/session-controller.ts), [port types](../../packages/core/src/types.ts) |
| Session ownership | Internal ownership includes a controller incarnation; the public node interface cannot close one exact session | [Controller](../../packages/node/src/session-controller.ts), [public interface](../../packages/node/src/node.ts), [session directory](../../packages/core/src/fsm.ts) |
| Evidence | The sole security projection is immutable before acquisition commit, closed, bounded and stripped of credentials and mutable handles | [Transport contract section 12](../design/transport-contract.md#12-peer-evidence-and-identity-admission) |
| Peer isolation | With transit disabled, export derivation suppresses learned routes and the data plane refuses session-to-session forwarding | [`derivePeerExport`](../../packages/core/src/routing.ts), [data plane](../../packages/node/src/data-plane.ts) |
| Connection collision | Selection uses a canonical node/session tuple, not recency or a judgement about which client is legitimate | [`compareConnectionCandidates`](../../packages/core/src/fsm.ts) |

These are static mechanism findings, not newly executed admission or routing acceptance cases.

---

## 4. Disposition of the five AGP requests

All dispositions are recommendations for contract work, not approval to implement the requested shape verbatim.

| Zorg request | Disposition | Boundary to preserve |
|---|---|---|
| 1. Fresh material before each dial, with deadline and cancellation | Support the capability; define one attempt owner and an atomic identity/secret snapshot before carrier creation | Start with composition through the existing connect capability; AGP still needs effective cancellation and bounded acquisition, without learning how IAP or OAuth issues a credential |
| 2. Close exactly the session that used a credential | Support an incarnation-safe host capability with stable, idempotent terminal semantics | Host policy decides when to close; AGP selects and terminates only the named incarnation, including already-closed and pending cases |
| 3. A redemption seam | Necessary contract revision; compare both proposed seams before selection | Credentials and privileged handles stay out of `peerEvidence`, diagnostics, snapshots and routed packets |
| 4. Per-attempt native PSK with principal mapping | Support the use case, retaining synchronous non-consuming resolution | Issuer/redeemer owns key lifecycle; binding owns proof; evidence distinguishes stable principal from public key selector and group membership |
| 5. Disable resumption and require fresh admission | Support fresh admission on every connection; qualify the blanket resumption rule by profile | PSK transport resumption must not bypass fresh proof; certificate transport resumption is distinct from the new application admission check |

No request justifies moving credential issuance, Zorg's TTL, its reuse response, or application permissions into AGP core.

---

## 5. Rationale and required corrections

### Proof purpose must survive profile changes

One principal model does not mean one interchangeable credential representation.\
TLS carries a PSK selector separately from proof of the secret; that selector is not bearer authority ([TLS section 4.2.11](https://www.rfc-editor.org/rfc/rfc8446.html#section-4.2.11)).

Required correction: bind allowed proof mode, principal, issuer, hub, node and redemption identity in trusted issuance/redemption state.\
A public PSK selector must never suffice for bearer admission or a reuse-triggered close.\
Any permitted cross-profile use needs an explicit proof rule and one authoritative use record; the response's unspecified profile-mismatch case does not yet establish these invariants.

Native implementation constraint: Node documents synchronous PSK callbacks and a 128-byte identity limit in its [PSK documentation](https://nodejs.org/download/release/v24.12.0/docs/api/tls.html#pre-shared-keys).\
Arrange the hub's secret lookup before the callback and specify cache readiness/expiry; do not assume an asynchronous token lookup or a full signed token fits that callback.

### The claimed admission deadline needs a clock model

The response's 60-second lifetime plus five seconds of tolerance does not alone prove a 65-second real elapsed bound.\
For an expiry computed on the issuer's clock and checked on the redeemer's clock, the upper bound is `TTL + accepted leeway + maximum relative clock error`, unless the acceptance rule explicitly budgets for that error.\
This is an analytical consequence of comparing two clocks; JWT's [expiry rule](https://www.rfc-editor.org/rfc/rfc7519.html#section-4.1.4) permits leeway but supplies no clock-accuracy guarantee.

Required correction: define bounded clock offset/drift and rollback behaviour, expiry's commit point, and whether a redeemed-but-pending session may establish after expiry.\
Distinguish a last-redemption deadline from a last-establishment deadline.\
For a separate issuer, also specify restart-generation agreement and atomic redemption across every listener/replica accepting the same audience; a process-local used-key map and a wall-clock comparison are not a complete distributed contract.

### Cancellation and retry need one owner

The acquisition and retry facts in section 3 substantiate the lifecycle gaps, but "all failures use backoff" and "refused issuer proof stops redialling" still need a single control contract.\
Choose who pauses and rearms an adjacency, which failures are temporary, and how a credential change releases the pause without creating a second retry loop.

Required correction: bound credential fetch, carrier acquisition, admission and cancellation settlement; specify ownership of late results and retained resources.\
The admission hook's absent cancellation signal matters as well as the unused dial signal.\
Apply the director's [cleanup-overlap decision](../surveys/shared-transport-survey.md): closing resources consume the budget until release is confirmed; reaching the limit pauses reconnection.

Browsers intentionally hide distinctions among network, TLS and opening-handshake failures ([WHATWG failure reporting](https://websockets.spec.whatwg.org/#feedback-from-the-protocol)).\
An issuer's explicit refusal can support a sign-in prompt; a generic failed WebSocket upgrade cannot truthfully be labelled the same refusal.\
Specify the shared externally visible failure model without inventing browser observations.

### Reservation and session lifetime are different state machines

Single use must commit atomically once proof succeeds, but an exact AGP session may not yet exist.\
Both seams need named states for issued, verified/reserved, associated, established, failed/closed and expired, with cancellation and restart outcomes.\
Specify how a policy close requested before association is retained and applied only to that attempt, how failed establishment leaves a credential spent, and when records can be released.

An opaque association or close handle is still privileged authority, even if it contains no credential.\
Scope it to one local channel/attempt incarnation; never serialize it into evidence or allow a stale handle to select a replacement session.\
Reuse reporting must represent pending or absent sessions honestly instead of requiring two established session identifiers.

### Correct the acceptance wording before using it as an oracle

| Response cell | Correction required |
|---|---|
| `X4`, closure after expiry | D39 says expired reuse is refused/reported without closing the first session; the experiment sentence must not require closure in that branch |
| `X5`, fresh reconnect leaves the first session open | Fresh material causes no reuse-triggered close, but normal AGP collision selection may still replace a connection; assert the distinction, not a guaranteed survivor |
| Ask 5 versus section 6 edge resumption | Specify fresh credential admission as the invariant and identify where disabling transport resumption is necessary to keep it |
| `X2`, 10 seconds / 64 sockets / 16 KiB | Proposed bounds need explicit resource ownership, aggregate accounting and release conditions; they are not agreed browser guarantees |
| Section 5 capacity | One hub plus 19 peers is 20 nodes, not fewer than 20; choose and name the target, then distinguish it from measured demand |

The [TLS resumption model](https://www.rfc-editor.org/rfc/rfc8446.html#section-2.2) explains why a resumed transport and a newly admitted application session are different claims.\
Retain the native no-bypass obligation without presenting certificate resumption itself as an application-authentication failure.

### Present routing needs are narrower than general endpoint authorization

Zorg's uncertainty about learned peer-route export is settled at source: transit-off suppresses those exports as well as forwarding.\
No new discovery or send hook is demonstrated as necessary for the stated hub-local policy, where every admitted peer may reach every operation endpoint and the application authorizes each operation.

The remaining qualification is "its own reply endpoint": checking that a route's origin equals the admitted peer does not establish entitlement to the endpoint name.\
Define reply-name ownership in route admission and the response/push destination-selection rule, including the existing pinned-origin selector where appropriate.\
Current authorization of server push belongs to the application; ingress identity does not establish relayed authorship.\
Keep general principal-based filtering open only where a consumer policy demonstrates that the existing ports cannot enforce it.

---

## 6. Comparing the redemption seams

Working preference: transport-owned verification/reservation with a narrowly scoped association capability, provided it can satisfy the lifecycle above without exposing transport internals.\
This follows the director's transport-first intent; it is not selection of Zorg's second candidate.

| Criterion | Credential passed to identity admission | Binding reservation then exact association |
|---|---|---|
| Useful property | Redemption sees OPEN identity and session context together | Raw credentials remain in the proof-owning binding; native and browser proofs can yield the same bounded result |
| Authority crossing the boundary | A one-shot credential, with strict access, disposal and cancellation rules | A privileged association capability, with strict incarnation, lifetime and cancellation rules |
| Principal challenge | Express completed PSK proof without treating its public selector as a bearer | Validate credential-to-OPEN binding later without stranding a reservation or permitting stale association |
| Failure challenge | Admission cancellation and late completion after channel teardown | Pre-association close requests, failed establishment, cleanup and accounting across two owners |
| Evidence requirement | Keep credentials separate from immutable transport evidence; distinguish verified admission facts from transport facts | Construct truthful evidence at its defined commit point; association must not mutate historical evidence |

Compare both against the same state transitions and authority flows; count neither API additions nor patch lines as the quality metric.\
Keep browser upgrade carriage and a bounded exchange inside the protected channel open until that comparison and ordinary compatibility evidence justify a choice.\
Cookies alone do not answer the required separate-host case, and passing the first experiment does not select the best design.

---

## 7. Next work and the response to Zorg

| Owner | Next deliverable | What it unblocks |
|---|---|---|
| AGP, with Zorg reviewing | A side-by-side acquisition/admission/session lifecycle contract for the two seams, including retry authority, cancellation, exact ownership, expiry points and immutable evidence | `B6` profile/seam decision; no production code yet |
| Zorg and credential-issuer | Proof-purpose rules, clock/restart model, redeemer deployment scope, refusal/rearm expectations and corrected acceptance wording from section 5 | Makes the shared contract specific without AGP owning issuer policy |
| AGP | Portable-runtime proposal for crypto, scheduling, precompiled validation and package exports under the supplied CSP | `B50` work that can proceed independently of credential carriage |
| Zorg | Target-browser agreement, ordinary worker lifecycle/bundle evidence, benign negotiation and deployment trust documentation | `B50` guarantees and certificate/terminator feasibility; existing Chrome observations do not certify the target set |
| Zorg, with AGP checking existing ports | Explicit reply-name ownership and pinned/unpinned reply/push rules | Narrows `B51`; new permission APIs require a demonstrated remaining gap |
| Operation-call owner | Tests of the implemented consumer against the committed public type surface and the existing five acceptance cases | `B48`; neither typing repair nor browser probes close consumer adoption |

The response to carry back is: AGP supports the capability needs, keeps issuer/application policy outside its core, and asks for the qualifications above before either project commits to an authentication design.\
The typed-surface request is separately satisfied in the local commit, with publication and downstream adoption still distinct.\
This review is prepared for that collaboration; it does not claim a new message sent to Zorg or agreement from its owners.

Security cases remain static design questions in this review; no exploit candidate, replay/impersonation input, or vulnerability reproduction was created or executed.\
Ordinary browser compatibility, resource-lifecycle observations and existing regression evidence must not be labelled a security certification.

---

## 8. Consequence of violation

- Interchangeable proof representations would discard the native PSK possession requirement at a shared boundary.
- A TTL without a clock and commit model would promise a leak window the mechanism does not establish.
- Independent retry loops or stale association handles would undermine deterministic ownership and exact-session closure.
- Treating route origin as endpoint-name entitlement would leave replies dependent on an unstated consumer policy.
- Selecting the first working browser path would skip the agreed comparison of authority, utility and quality within scope.
- Treating this review as approval would turn unresolved requirements into production promises.
