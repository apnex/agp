# Browser and CLI peer feasibility review

**Status: source-backed feasibility assessment, not a selected design or browser conformance result.**\
**Assessment: AGP, 2026-10-10; analytical interpretation is labelled Tier 3.**

AGP can advance contract feasibility without waiting for Zorg, but cannot yet promise that native browser WebSocket satisfies its existing carrier contract.\
Credential rotation, live authorization and endpoint permissions require separate decisions even if their implementation ultimately composes through one transport boundary.\
The independent public typing defect identified at this baseline is now [corrected in the working tree](../VERIFICATION.md#414-public-disposition-typing-restored).

Subsequent [browser carrier observations](browser-carrier-feasibility.md) map all 26 registry cases and measure public-package CSP failures and ordinary native API behaviour.\
That evidence advances the investigation without changing this baseline review into a browser-conformance claim.

Scope: Zorg's browser feedback `A1` through `A6`, the director's transport-first and unified-behaviour constraints, and the existing AGP transport/node seams.\
No authentication format, renewal protocol, production API or new security profile is approved here.

---

## 1. Inputs and baseline

| Input | Inspected evidence |
|---|---|
| AGP source and contracts | `ee99d741b6c250c0f2525a24b8dbd4ef3a14cab8`; paths below refer to that baseline |
| Consumer requirements | Zorg `c34671941aefcf8bf7d9db0ddaf68c6809e2eea4`, `upstream/agp-browser-feedback.md`; the director's later clarification makes the AGP connection direct, outside IAP |
| Design history | `d6cc9d35f00b0e05e9b4c18e6be90a7a509f3524` deliberately made the key provider synchronous; `7abca457ee7ade00eb38c2f8245432943c676687` corrected TLS evidence rather than inventing an unobserved server principal |
| External constraints | [Browser WebSocket standard](https://websockets.spec.whatwg.org/#the-websocket-interface), [TLS traffic-key update](https://www.rfc-editor.org/rfc/rfc8446.html#section-7.2), [browser lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), [Ajv standalone validation](https://ajv.js.org/standalone.html) |
| Actual operation-call readiness | `16d3ccdc35ceb0b9def466ca8c1a24e5883756b1`; `src/index.ts` still exports no implementation |
| Collaboration handoff | Workspace draft `zorg/upstream/agp-browser-collaboration.md`; uncommitted at this review, not evidence of Zorg acceptance |

These inputs expose different constraints; source/history agreement is not independent security assurance.\
The review establishes the questions and source mismatches below, not a production-design seal.

---

## 2. AGP mechanisms observed

| Surface | Current mechanism | Source |
|---|---|---|
| Protection and proof | The TLS PSK callbacks obtain material from the injected provider during acquisition | [Security implementation](../../packages/transport-node-ws/src/security.ts), [provider interface](../../packages/transport/src/types.ts) |
| Key selection | `resolve(identity)` returns one key, not a list; `localIdentity` is readonly; node-keyed listener evidence reports the presented identity directly as principal | Same source files; [secure profile](../design/binding-websocket.md#10-secure-profile) |
| Identity admission | Application policy receives transport evidence together with remote OPEN identity and exact session identifiers; the default is allow | [Admission call](../../packages/node/src/session-controller.ts), [node composition](../../packages/node/src/node.ts), [identity port](../../packages/core/src/types.ts) |
| Lifetime evidence | `peerEvidence` is immutable and constructed before channel acquisition commits; the channel port has no renewal operation or authorization-update event | [Evidence contract](../design/transport-contract.md#12-peer-evidence-and-identity-admission), [channel interface](../../packages/transport/src/types.ts) |
| Packet acceptance | The WebSocket binding uses write-callback completion, preserves uncertain post-dispatch outcomes, and requires bounded input and physical resource release | [Binding sections 5 and 8](../design/binding-websocket.md#5-ordering-writes-and-backpressure), [neutral limits](../design/transport-contract.md#11-limits-and-deadlines) |
| Advertising | Route admission evaluates imported advertisements; export derivation suppresses by topology, path, rejection and capacity, without an injected per-principal export policy | [Route admission](../../packages/node/src/session-controller.ts), [export derivation](../../packages/core/src/routing.ts) |
| Sending and replies | Forwarding checks feasible source then resolves the destination; egress requires an acknowledged source export | [Data plane](../../packages/node/src/data-plane.ts) |
| Handler identity | Delivery context carries source and ingress/session identifiers, not authenticated evidence or a live authorization record | [Delivery context](../../packages/core/src/types.ts) |
| Browser runtime | Node crypto, `setImmediate`, runtime Ajv schema compilation, Node-oriented packaging and compiler libraries remain in the dependency path | [Node runtime](../../packages/node/src/node.ts), [schema initialization](../../packages/protocol/src/schema.ts), [package exports](../../packages/node/package.json), [compiler configuration](../../tsconfig.base.json) |
| Capacity | Session and candidate-route defaults are configurable; `maxRoutesPerSnapshot` has a protocol ceiling of 256 | [Node configuration](../../packages/node/src/node.ts), [wire limits](../../packages/protocol/src/constants.ts) |

The [conformance registry](../../packages/transport/src/conformance/cases.ts) enumerates 26 cases; [reusable executable helpers](../../packages/transport/src/conformance/index.ts) do not implement that entire registry.\
Existing [PSK tests](../../packages/transport-node-ws/test/contract/preshared-key-profile.test.js) cover acquisition and evidence, not a credential-rotation lifecycle.

---

## 3. External constraints observed

The [browser WebSocket API](https://websockets.spec.whatwg.org/#the-websocket-interface) accepts a URL and subprotocols, with no application-selected TLS PSK or arbitrary upgrade headers.\
It exposes no Node-style write-completion callback, receive pause, configurable pre-materialization receive limit or force-abort method.\
Script-selected close codes are limited to `1000` or `3000` through `4999`; `close()` preserves already-queued sends.\
`bufferedAmount` is not a remote receipt.

[TLS `KeyUpdate`](https://www.rfc-editor.org/rfc/rfc8446.html#section-7.2) derives the next traffic secret from the current one; it does not introduce a newly issued external PSK.

[Frozen pages](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) may stop executing timers and callbacks.

[Ajv standalone validation](https://ajv.js.org/standalone.html) generates code ahead of runtime for environments that restrict dynamic code generation.

---

## 4. Boundary assessment (Tier 3)

| Question | Assessment | What must be settled |
|---|---|---|
| Can PSK rotation stay in the transport? | Changing provider results addresses later handshakes without itself renewing existing sessions | Verify successful native rotation and resumption behaviour; specify overlap and retirement |
| Does the current port already provide current/previous overlap? | No such guarantee is defined; distinct generation selectors would also change today's reported principal unless mapping is designed | Separate credential generation, stable principal, node instance and session; do not treat a keyring as merely two values behind one lookup |
| Can that exact TLS PSK mechanism serve browser JavaScript? | No, under the native API above; a shared semantic model is still possible across protection profiles | Select a browser-supported proof path only after issuer, origin and deployment requirements arrive |
| Is certificate-backed TLS sufficient peer identity? | Server-channel authentication and the connecting user's identity are different duties | Require explicit client proof and identity admission; IAP and `Origin` must not substitute for either |
| Can live authorization change without reconnect? | A proposed security binding could retain the connection, but existing immutable evidence and admission interfaces do not establish the lifecycle | Decide whether live renewal is required; define observation, commit, failure and cancellation semantics without rewriting historical evidence |
| Is a browser carrier only an implementation exercise? | Not against every current obligation; native write, close/abort and memory-control differences require contract reconciliation | Distinguish adapter-owned resources from browser-owned resources; retain precise uncertainty and boundedness claims |
| Does route filtering enforce endpoint permissions? | No; hiding a destination does not authorize or forbid sending to it | Treat advertise, discover and send separately; preserve reply-source ACK requirements and account for disclosed paths |
| Can the handler trust ingress evidence as the original author? | Only the directly authenticated peer is established by that evidence | Define direct versus relayed provenance, lookup lifetime and authorization-at-admission versus authorization-at-use |

The security result needs three distinct policies: the last new admission permitted by leaked material, the lifetime of an already-admitted peer's authority, and the deadline for enforcing revocation.\
Routine rotation preserving the connection does not settle the latter two.\
Renewal must not let possession of the compromised credential bootstrap unlimited successive credentials.

The likely reusable boundary is shared authentication/authorization lifecycle semantics with profile-specific proof and I/O, not one browser policy engine and another CLI policy engine.\
That is a direction to test, not a commitment to a new public authentication interface.\
Do not weaken a transport guarantee merely because a browser adapter cannot demonstrate it.

---

## 5. Work that can proceed independently

These are ordinary functional investigations and source reviews, not production implementation approval.

| Work | Owner and dependency | Required observation or result |
|---|---|---|
| Repair documented public disposition typing | AGP; no Zorg dependency | A consumer compiling through the public package/factory can use all three methods without casting; existing runtime semantics and tests remain unchanged |
| Native credential-change continuity | AGP; existing PSK provider | Established peers continue ordered bidirectional traffic while legitimate new peers use updated material; record callback timing, identity mapping and session IDs; do not label this live reauthentication |
| Resumption and overlap accounting | AGP source/API review, then agreed functional fixtures | State whether session tickets or cached verification affect retirement; expose missing guarantees rather than assuming every acquisition consults the provider |
| Browser carrier feasibility | AGP contract owner with Zorg's target-browser evidence | Map every conformance obligation to an observable, a justified non-applicable case or a contract mismatch; separate logical terminal from physical release |
| Portable runtime proof | AGP owns package semantics; Zorg supplies required CSP and environments | Real bundle and schema validation, true event-loop fairness, binary packet order and native parity; no Node-shim or relaxed-CSP assumption hidden in the result |
| Endpoint-policy seam analysis | AGP source analysis now; Zorg permission matrix before selection | Advertise/discover/send enforcement sites, permission-change effects, reply/push viability and bounded session-evidence lifetime |

Use server-owned deadlines for security enforcement; specify recovery after suspension rather than promising execution while the browser is frozen.\
Keep unknown delivery outcomes unknown, and leave retries/idempotency above AGP.\
For capacity, obtain the consumer topology before reviving a wire-limit change: many hub-local tabs and many routes through one backend adjacency are not the same load.

---

## 6. Decisions and dependencies

| Decision or evidence needed | Blocks | Does not block |
|---|---|---|
| Zorg's issuer/refresh authority, deployment origins and client population | Selecting the authentication profile and credential acquisition path | Native source review, carrier-obligation mapping, typing correction |
| Director choice of live authorization, revocation and outage policy | Renewal state machine and its enforcement contract | Admission-key continuity investigation |
| Agreed browser resource and terminal guarantees | Claiming full browser carrier conformance or changing the neutral contract | Measuring exposed native behaviour and reporting mismatches |
| Zorg's endpoint permissions and topology | Selecting export/send policy APIs, evidence access and capacity changes | Identifying current enforcement sites |
| Implemented operation-call composition | Consumer acceptance under the existing handoff | All browser/transport feasibility work above |

The prior small-topology and certificate-free deployment intent remains the baseline until an explicit design decision changes it.\
Fresh browser intent reopens investigation; it does not ratify a certificate profile, require IAP in AGP or approve weakening existing transport contracts.

---

## 7. Measured typing finding

**Resolution:** `B49` subsequently restores the public declarations and adds a public-package compile regression.\
The [correction evidence](../VERIFICATION.md#414-public-disposition-typing-restored) records the failing-before/passing-after result; the original baseline finding below is retained.

The [documented public API](../design/sdk.md#41-factory-and-composition) includes `disposition()`, `settled()` and `dispositions()`.\
The [implementing class](../../packages/node/src/node.ts) has those methods, but its exported `AgpNode` interface and factory return type omit them.\
The current JavaScript [runtime tests](../../packages/node/test/contract/disposition-surface.test.js) do not compile a TypeScript consumer.

An in-memory TypeScript program inspected the factory return type without writing or emitting files:
```ts
import { createNode } from "./packages/node/src/node.js";
declare const peer: ReturnType<typeof createNode>;
void peer.disposition;
void peer.settled;
void peer.dispositions;
```

| Environment | Observed result |
|---|---|
| Node `v24.12.0`, TypeScript `5.9.3`; `NodeNext`, strict, no emit | Exactly three `TS2339` diagnostics, one for each method: property does not exist on `AgpNode` |

This is a public type/contract defect, not evidence that the runtime lacks dispositions.\
The fix needs a public-package compile regression, not a cast or a change to delivery semantics.
