# Browser carrier and runtime feasibility

**Status: bounded observations and contract analysis; no browser carrier or contract revision is approved.**

Native browser WebSocket carried the required binary message shape in the measured cases, but cannot implement the current WebSocket binding unchanged.\
The outstanding issues are send acceptance, native memory limits, forced release, failure reporting, and runtime portability under Content Security Policy (CSP).\
This advances `B50`; it does not close it.

---

## 1. Baseline and evidence

| Input | Measured baseline |
|---|---|
| AGP | `ee99d741b6c250c0f2525a24b8dbd4ef3a14cab8`, with the local `B49` declaration/test correction and research edits; no new runtime implementation |
| Zorg | `64eb1fcb9b5390c185bd0aa8a0c06738d1cae099`; `upstream/agp-browser-feedback.md` and the workspace collaboration draft |
| Runtime and tools | Node `v24.12.0`, esbuild `0.28.2`, Playwright package at the path captured in each observation |
| Browser observations | Chrome `136.0.7103.113` and Chrome headless shell `151.0.7922.47`, each in an isolated temporary context with the browser sandbox enabled |
| Instrument | [Browser feasibility script](../../scripts/browser-feasibility.mjs), public package bundles after `npm run build`, loopback HTTP/WebSocket only |
| Durable outputs | [Chrome 136 observation](evidence/browser-feasibility-chrome136.json), [Chrome 151 observation](evidence/browser-feasibility-chrome151.json); both completed with exit zero |

These are two versions of one browser family, not independent browser-engine coverage or Zorg's deployment acceptance.\
No AGP session, TLS authentication, credential renewal, resource-exhaustion experiment, malformed input, or suspension/recovery scenario was exercised.

The first run stopped because Playwright's evaluation-based observer itself failed under CSP.\
It is incomplete, not a result for the remaining package imports.\
The corrected instrument receives results through ordinary same-origin page networking, without automation-side evaluation or CSP bypass; both complete reruns are retained above.\
The incomplete output remains at `/tmp/agp-b50.Hv0YAx/browser-probe.log`.

---

## 2. Measured browser behaviour

Both complete runs produced the same substantive outcomes.

| Check | Observation | Limit of the result |
|---|---|---|
| Public `@agp/node` browser bundle | Build blocked on the eager `node:crypto` import | No runtime import or node startup reached |
| Public `@agp/protocol`, `@agp/core`, `@agp/transport` bundles | All built without warnings | Bundling alone does not prove browser execution |
| Import those three bundles under `script-src 'self'` | Each failed with `EvalError` prohibiting dynamic evaluation | This is a specific CSP policy, not Zorg's still-required deployment policy |
| Same imports with only `'unsafe-eval'` added | All loaded | Diagnostic control only; relaxing CSP is not the proposed fix |
| Binary traffic and early server input | Initial server packet `[9]`, then ordered echoes `[1,2,3]`, `[4,5]`, `[6]` | Four inbound packets, not a full ordering or concurrency proof |
| Caller mutates its sent buffer to `99` | Server still received `[1,2,3]` | Supports native snapshot feasibility, not the AGP acceptance race contract |
| Subprotocol and extensions | Selected `agp.v1`; empty extension string when the server disabled compression | No incompatible-handshake or compression-bound claim |
| Native controls | `send()` returned `undefined`; `pause`, `terminate`, and `setImmediate` were absent | No substitute completion, hard-abort, or scheduling semantics established |
| Locally requested failure close codes | `1002`, `1003`, `1007`, `1009`, `1011` each threw `InvalidAccessError` | Local API calls only; no invalid frames were sent |
| Normal close | Code `1000`, `wasClean: true` | No cancellation, stalled-handshake, or physical-release deadline proof |
| Randomness | Secure context with `crypto.randomUUID` and `crypto.getRandomValues` | Loopback is a secure context; deployment origins still matter |

The [WebSocket standard](https://websockets.spec.whatwg.org/) exposes neither application-selected TLS PSK nor arbitrary upgrade headers, native write callbacks, receive pause, configurable native input ceilings, or force-abort.\
It restricts script-selected close codes to `1000` or `3000` through `4999`; closing preserves queued sends.\
`bufferedAmount` describes local buffering, not remote receipt or receiver capacity.

---

## 3. Runtime mechanisms and implications

| Source-observed mechanism | Tier 3 interpretation and required follow-through |
|---|---|
| [Node runtime](../../packages/node/src/node.ts) eagerly imports Node crypto; its private `CryptoIdSource` generates session IDs from three random bytes | Injection alone cannot remove the eager bundle dependency; choose a portable default without silently changing identity/collision semantics |
| [Core ID source](../../packages/core/src/deterministic.ts) already uses WebCrypto, but session allocation uses a randomized cursor with explicit exhaustion | This is a reuse candidate, not an identical replacement; compare session scope, restart and exhaustion behaviour before choosing it |
| The node's `#yieldIfLoopStarved()` uses `setImmediate` after a bounded send streak | Preserve genuine event-loop yielding and hold-timer fairness; a resolved promise is not an equivalent replacement |
| [Protocol](../../packages/protocol/src/schema.ts), [core](../../packages/core/src/schema.ts), and [transport](../../packages/transport/src/schema.ts) initialize Ajv validators through `getSchema()` during module loading | The measured CSP failure has a source mechanism; portability includes validator generation and loading, not only removing Node imports |
| Public package exports point to built ESM modules | Validate real package consumers and declarations, not private-source imports or a shimmed demonstration |

[Ajv standalone generation](https://ajv.js.org/standalone.html) is a candidate for moving validator compilation to build time.\
Any selected implementation must preserve schema ownership, validation errors and native/browser parity; the diagnostic control does not authorize `'unsafe-eval'` in production.

[Browser lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) documents that frozen pages suspend freezable tasks and discarded pages execute no JavaScript.\
Tier 3 implication: distinguish active execution fairness from suspension recovery; browser timers cannot own a hub's security-enforcement deadline.\
This probe did not measure either recovery or fairness.

---

## 4. Contract obligation map

**Tier 3: feasibility classification, not test verdicts.**\
The [registry](../../packages/transport/src/conformance/cases.ts) has 26 entries, mapped below against the [neutral contract](../design/transport-contract.md) and [WebSocket binding](../design/binding-websocket.md).\
Its [exported helpers](../../packages/transport/src/conformance/index.ts) implement packet-order, terminal-once and acceptance-callback-fault exercises, not the whole registry.

`Bridge` means a wrapper or shared node mechanism is plausible but unproved.\
`Gap` means current obligations require unavailable controls, evidence, or an unsettled semantic choice.\
`Scoped out` applies only to a declared dial-only capability and does not excuse unresolved outbound cleanup.

| Registry case | Classification | Required implementation evidence or decision |
|---|---|---|
| `acquisition-cancellation` | Gap | Cancellation must prevent late channel commit and account for the connecting native handle until release |
| `early-input-retention` | Bridge | Install handlers before acquisition commit; bound retained packets and bytes, including immediate server traffic |
| `packet-byte-boundaries` | Bridge | Preserve one binary message per packet and exact bytes through the actual common port; bounded native example observed |
| `packet-order` | Bridge | Run the shared port exercise in both directions, not only this native echo |
| `packet-duplicate-freedom` | Bridge | Demonstrate no duplicate dispatch across wrapper state transitions; keep retries above transport |
| `send-acceptance-races` | Gap | Binding section 5 explicitly selects successful write-callback completion; native `send()` return supplies no such callback |
| `outbound-backpressure` | Gap | Define an observable acceptance threshold and bounds on wrapper/native buffering without calling buffer drain remote acceptance |
| `pull-read-cancellation` | Bridge | Cancellation consumes no queued packet and does not itself terminalize the channel |
| `receive-bounds` | Gap | A bounded post-message FIFO is not the required pre-materialization native bound; name the owner and protection of each allocation |
| `input-rejection-order` | Gap | Preserve admitted FIFO items before rejection/terminal without inventing framing causes hidden by the browser or unsupported failure close codes |
| `channel-close-races` | Gap | Logical cancellation/first terminal can be serialized; immediate non-graceful native release is a separate unproved obligation |
| `terminal-once` | Bridge | One immutable logical terminal across error, close and local cancellation; this alone does not prove native release |
| `terminal-read-stability` | Bridge | Drain earlier admitted items then return the same terminal on every later read |
| `listener-capacity-callbacks` | Scoped out | No listener capability in a dial-only port; server implementation still owes all listener obligations |
| `listener-lifecycle` | Scoped out | No browser listener; prove unsupported listener references cannot acquire a capability |
| `peer-evidence` | Gap | Bounded immutable acquisition evidence is feasible, but the selected protection and peer-proof profile remains `B6` work |
| `binding-before-commit` | Bridge | Require exact selected subprotocol and acceptable extensions before publishing the channel; handlers must already retain early input |
| `deadline-response` | Gap | Separate deadlines while scheduled, suspension recovery, logical cancellation and bounded physical cleanup |
| `diagnostic-containment` | Bridge | Sanitize stable diagnostics; never forward raw close reasons, URLs, credentials or native error objects |
| `carrier-sovereignty` | Bridge | Keep OPEN, routes, credit, retries and notifications in their existing owners |
| `send-snapshot` | Bridge | Snapshot synchronously before returning the common promise; observed native copying does not prove the wrapper's timing |
| `terminal-products` | Gap | Prove neutral origin/kind combinations using observable evidence; opaque native failure cannot become a guessed cause |
| `operation-error-matrix` | Gap | Shared errors remain exact, particularly non-acceptance versus unknown and close cancellation after initiation |
| `reference-resolution` | Bridge | Synchronous, deterministic opaque target resolution; valid unmapped/wrong-kind references return `undefined`, invalid references fail as specified |
| `acquisition-provenance` | Bridge | Exercise the shared node/controller with declared direction and reference provenance, not only a standalone socket |
| `controller-disposition` | Bridge | Show the one logical terminal reaches the session controller once, with no duplicate teardown or fabricated graceful outcome |

The native probe establishes no complete row as conforming.\
Its packet, snapshot and normal-close observations narrow implementation questions; the unavailable controls require design reasoning, not repeated measurements of the same API.

---

## 5. Design consequences and next work

**Tier 3 recommendation: settle the shared contract before asking Zorg to build a conforming carrier.**

Keep one definition of packet acceptance, cancellation, ordering, terminal outcomes, identity and authorization across CLI and browser peers.\
Platform-specific I/O does not require platform-specific policy, but shared method names do not prove shared guarantees.

| Boundary question | Candidate to evaluate | What would make it unacceptable |
|---|---|---|
| Send acceptance | A shared ordered-queue acceptance definition with separately proven native commit points | Treating enqueue as remote delivery, silently deleting current callback requirements, or claiming non-acceptance after possible dispatch |
| Abort and cleanup | Explicitly distinguish immediate logical revocation from observable native release, including resource accounting and retry admission | Calling graceful `close()` forced release, hiding retained handles, or allowing unlimited reacquisition while old resources remain |
| Input bounds | State which allocations AGP controls and which the host runtime controls; assess whether the intended browser deployment can satisfy the required protection | Calling a post-allocation size check a pre-allocation bound, or treating compliant-peer credit as protection against every input |
| Binding failures | Common honest outcomes with host-supported native actions and explicit limits on diagnostic precision | Guessing a hidden cause or changing native failure mapping without a reviewed binding revision |
| Portable runtime | Shared validator artifacts, deliberate ID-source semantics and a real scheduling primitive | A separate browser policy engine, relaxed CSP requirement, or unmeasured timer fairness |

If the required physical guarantees remain mandatory and no browser facility can establish them, the honest outcome is that native browser WebSocket is unsupported under that contract.\
Changing those guarantees is a design decision, not an implementation detail or a conformance exception.

The next contract discussion needs Zorg's required browser/embedded-runtime matrix, production CSP, suspension/reconnect expectations and resource budgets.\
The existing collaboration draft already asks for these; this report is AGP-side evidence, not a new outbound request or a claimed agreement.\
AGP can independently continue `B6` source and ordinary continuity investigation while those consumer inputs are pending; none of these results selects a credential profile or endpoint-permission API.

---

## 6. Reproduce the observations

Run from the AGP repository with workspace dependencies already installed.\
The probe imports separately installed esbuild and Playwright modules and uses an installed Chromium-family executable; it adds no production dependencies.\
The paths below are the measured local environment, not portable installation instructions.

Build the public packages and retain the output:
```bash
npm run build > /tmp/agp-b50.Hv0YAx/build.log 2>&1
```

Run the bounded observation with the installed Chrome executable:
```bash
AGP_ESBUILD_MODULE=/home/apnex/.npm/_npx/fd45a72a545557e9/node_modules/esbuild/lib/main.js AGP_PLAYWRIGHT_MODULE=/home/apnex/.cache/ms-playwright-go/1.50.1/package/index.mjs AGP_BROWSER_EXECUTABLE=/usr/bin/google-chrome node scripts/browser-feasibility.mjs > /tmp/agp-b50.Hv0YAx/browser-probe-v2.log 2>&1
```

For another workspace, choose existing module/executable paths and an existing output directory.\
Keep browser sandboxing and the page CSP enabled.\
Exit zero with `complete: true` means the instrument completed its observations and bounded assertions, not that browser AGP passed conformance.\
Inspect the individual bundle/CSP outcomes and browser version in the JSON output.
