# AGP transport sovereignty review

> **Status:** Internal design review and change checklist. This document is not
> itself a protocol contract or implementation authority. Ratified authority
> remains in the fixed-intent record and D14-D17; unresolved implementation
> findings below are release-certification blockers.
>
> **Scope:** Split the transport-independent AGP JSON packet protocol and kernel
> from its first concrete WebSocket binding and Node.js adapter. Preserve AGP v1
> JSON packet meaning while applying the ratified in-place transport-surface
> replacement.
>
> **Superseded in part:** this record is frozen at authorship and is not
> rewritten when later policy changes. Two of its requirements no longer hold.
> The per-gate evidence manifest and sandbox artifact certificate it specifies,
> including `verification-evidence.schema.json` and
> `artifact-certificate.schema.json`, were removed because nothing consumed
> them; see [`verification.md`](verification.md) section 2.3. The superseded MVP
> design set it asks to annotate was retired instead. Every transport-sovereignty
> finding below remains in force.

## 1. Review disposition

The implementation's existing package dependency arrows are mostly directionally correct, but the contract carried across those arrows is not transport-sovereign.\
WebSocket framing, negotiation, compression, URL, close-code, and handshake concepts appear in `@agp/protocol`, `@agp/transport`, `@agp/core`, and `@agp/node`.\
Consequently, a non-WebSocket adapter cannot be substituted without either fabricating WebSocket facts or changing the kernel.

**Disposition: approve the complete sovereign target design.\
Public-contract implementation may proceed atomically, but no implementation or release is certified until every legacy implementation finding and its required evidence is closed.**

The required correction is a four-part separation:

1. `@agp/protocol` owns the AGP JSON packet language.
2. `@agp/transport` owns the runtime-neutral AGP ordered packet-channel port.
3. `@agp/binding-websocket` owns the language-neutral WebSocket mapping.
4. `@agp/transport-node-ws` implements that mapping with Node.js and `ws`.

The common design term is **reliable ordered packet channel** (M30), and the normative SDK capability is the byte-oriented `TransportChannelPort` defined by `transport-contract.md`.\
It has no runtime profile string or negotiation field.\
The WebSocket binding continues to negotiate `agp.v1`.\
These identifiers name different layers and must not be treated as aliases:

| Identifier | Owner | Meaning |
|---|---|---|
| `agp: 1` | `@agp/protocol` | JSON packet-language revision |
| M30 / AX1-T | design and verification only | Common transport conformance requirement; not a runtime value |
| `agp.v1` | `@agp/binding-websocket` | WebSocket subprotocol token |

At the transport boundary an AGP packet is one finite immutable byte sequence.\
The protocol layer decodes those bytes as exactly one UTF-8 JSON document and validates it as one member of the AGP message union.\
A binding maps opaque byte packet boundaries onto its carrier and never parses JSON.\
D16 deliberately maps one packet to one WebSocket binary message so the binding preserves arbitrary bytes.\
Structured application messaging remains above the AGP packet language and is outside this review.

---

## 2. Authority and explicit survey bypass

### 2.1 Direct decision authority

This direction is grounded in the stakeholder's direct statements in the active design thread and is captured by `transport-sovereignty-authority.md`:

- JSON "packets" are what AGP delivers; structured JSON messaging protocols are
  layered above them.
- WebSockets specifically must be invisible to AGP.
- Transports may later be replaced by gRPC, UDP, QUIC, or another protocol.
- WebSocket and Loopback are canonical production transports; Loopback must
  traverse the same codec, protocol, FSM, routing, and operations path.

Those statements settle the outcome axis under review: WebSocket is a binding, not an AGP kernel primitive.\
They are more specific and later than the original MVP choice of WebSocket as the reference carrier.

### 2.2 Why no new survey is required

The `survey` skill is deliberately bypassed for this review because the decision authority supplied the desired boundary directly and left no open choice between a WebSocket-shaped kernel and a transport-neutral kernel.\
This review resolves consequences of that direction; it does not infer a new product objective.

The decision register now carries the authority through four ratified records:

- D14 - reliable ordered packet channel;
- D15 - logical transport references and observed peer evidence;
- D16 - sovereign binary-message WebSocket binding; and
- D17 - canonical production Loopback.

Their trace records must cite the fixed-intent authority directly or through the corresponding decision.\
The authority record and ratified decisions-not a fabricated survey response-are the traceability lineage.

### 2.3 Limits of the bypass

The direct authority does **not** decide any of the following:

- whether a future UDP binding provides reliability itself or changes AGP
  session semantics;
- whether AGP should support unordered delivery, duplicate delivery,
  multi-stream ordering, or partial reliability;
- whether multiple concrete transports may be active in one node at once;
- whether adapter-specific credentials belong in files, secret stores, or
  injected capabilities;
- whether future additional carrier packages retain any adapter-specific
  configuration continuity.

The present in-place cutover has already rejected a legacy compatibility facade under D2.\
Any proposal that changes the reliable ordered packet-channel requirement or adds one of the remaining product capabilities requires fresh intent authority.\
A plain UDP or QUIC-datagram adapter is not conforming merely because it implements the TypeScript method names.

---

## 3. Non-negotiable invariants

The split and ratified in-place replacement must enforce these invariants:

1. Every legal AGP JSON document and semantic outcome remains unchanged.
2. The ratified WebSocket binding uses exactly one binary message per opaque
   packet and still negotiates `agp.v1`.
3. WebSocket text messages are binding violations mapped to `1003`; invalid
   UTF-8 remains a protocol failure when carried inside an accepted binary
   packet. Binding-level malformed text and oversize mappings remain owned by
   the binding (`1007` and `1009` where applicable).
4. WebSocket fragmentation remains invisible above the binding.
5. WebSocket Ping/Pong remains binding liveness and never replaces AGP
   KEEPALIVE.
6. One channel preserves packet order, packet boundaries, reliability, and no
   duplicate delivery while live.
7. Transport acquisition never implies protocol `Established`; OPEN,
   admission, KEEPALIVE, and the existing FSM remain authoritative.
8. Route ownership, teardown ordering, ACK barriers, reverse breadcrumbs,
   queue bounds, and one-shot node lifecycle do not change.
9. No concrete connection, adapter ID, credential, or transport-specific
   address becomes routing authority or public RIB state.
10. The root schema catalog remains an assembly manifest, never a second
    contract owner.
11. Transport send acceptance never means remote receipt, application handling,
    persistence, replay, acknowledgement, or exactly-once delivery. Pub/sub,
    queues, RPC, and durable messaging remain application protocols above AGP.

"Preserve packet meaning" does not imply preserving the old text-message peer binding or retaining a dual SDK.\
D2 and D16 authorize one atomic binary-binding, configuration, and API cutover.\
Intermediate development commits may use private bridges, but no certified release may expose both contracts.

---

## 4. Findings and their disposition

The 57 `TSR` findings this review raised have been excavated rather than retained.\
Twenty described the pre-replacement implementation surface, whose subject matter no longer exists and whose absence is enforced by `no-legacy-surface.test.js` and `transport-sovereignty.test.js`.\
The remaining thirty-seven were design-resolved, and their invariants now live in the contracts that own them, with each fault mode stated in that document's consequence section.

A finding table is a point-in-time record of what one review believed.\
Keeping it beside the contracts it produced creates a second authority that no gate can check: a closure ledger can only prove that its own cells are non-empty, never that the fault it names is still prevented.\
`consequence-of-violation.test.js` replaces it by proving that every design contract states the faults it averts.

---

## 5. Target contract and package ownership

### 5.1 Runtime-neutral channel

`transport-contract.md` is the normative type owner.\
This review must not create a competing string/event-stream API.\
Its essential boundary is:
```ts
interface TransportPacket {
  readonly bytes: Readonly<Uint8Array>;
}

interface TransportDiagnostic {
  readonly code: string; // ^[A-Z][A-Z0-9_]{0,63}$
  readonly message?: string;
}

type TransportTerminal =
  | {
      readonly origin: "local";
      readonly kind: "graceful" | "aborted" | "resource-exhausted";
      readonly diagnostic?: TransportDiagnostic;
    }
  | {
      readonly origin: "remote";
      readonly kind: "graceful" | "io-failure" | "binding-violation";
      readonly diagnostic?: TransportDiagnostic;
    }
  | {
      readonly origin: "carrier";
      readonly kind:
        | "io-failure"
        | "resource-exhausted"
        | "binding-violation"
        | "adapter-fault";
      readonly diagnostic?: TransportDiagnostic;
    };

type TransportListenerTerminal =
  | {
      readonly origin: "local";
      readonly kind: "graceful" | "aborted";
      readonly diagnostic?: TransportDiagnostic;
    }
  | {
      readonly origin: "carrier";
      readonly kind: "io-failure" | "resource-exhausted" | "adapter-fault";
      readonly diagnostic?: TransportDiagnostic;
    };

type TransportRead =
  | { readonly kind: "packet"; readonly packet: TransportPacket }
  | { readonly kind: "input-rejected"; readonly code:
      "PACKET_TOO_LARGE" | "MALFORMED_CARRIER_INPUT" }
  | { readonly kind: "terminal"; readonly terminal: TransportTerminal };

interface TransportCloseIntent {
  readonly kind:
    | "normal"
    | "node-stop"
    | "session-replaced"
    | "protocol-fatal";
  readonly code: string;
}

interface TransportAbortIntent {
  readonly kind: "deadline" | "capacity" | "invariant" | "forced-stop";
  readonly code: string;
}

interface TransportChannelPort {
  readonly peerEvidence: TransportPeerEvidence;
  send(packet: TransportPacket, signal: AbortSignal): Promise<void>;
  read(signal: AbortSignal): Promise<TransportRead>;
  close(
    intent: TransportCloseIntent,
    signal: AbortSignal,
  ): Promise<TransportTerminal>;
  abort(intent: TransportAbortIntent): void;
}

interface TransportListenerPort {
  readonly publication: TransportListenerPublication;
  waitTerminal(signal: AbortSignal): Promise<TransportListenerTerminal>;
  close(signal: AbortSignal): Promise<TransportListenerTerminal>;
  abort(intent: TransportAbortIntent): void;
}
```

The semantic surface is fixed:

- opaque immutable bytes, not decoded text;
- `send`, not `sendText` or `sendPacket(document)`;
- one cancellable pull-style `read`, not an adapter-selected push stream;
- one discriminated immutable channel-terminal record, never carrier status
  codes or impossible origin/kind pairs;
- typed bounded local close/abort intents, never native teardown arguments;
- one observable immutable listener terminal; unexpected loss cannot disappear
  into an adapter log;
- acquired closed `peerEvidence`, not a handshake or extension bag;
- resolver-returned acquisition capabilities are already adapter-bound; no
  detachable reference/port pair crosses the boundary;
- no direction, profile, selected subprotocol, compression mode, socket
  address, or concrete connection object on the channel.

The acquisition-provenance record distinguishes connect from accept and controls reconnect ownership only.\
An adapter may retain native diagnostics privately, but the FSM consumes only the closed common terminal vocabulary.\
The adapter returns a channel only after its configured local AGP binding is complete.\
Binding negotiation failure is acquisition failure; the node does not inspect a native negotiation result.\
Under retained `agp.v1`, that local commit cannot prove that an unsupported legacy peer implements the binary mapping; TSR-37 requires this limitation to remain explicit.

### 5.2 Configuration boundary

Core/node configuration should use bounded logical `TransportRef` values:

- a listener configuration names a `transportRef`;
- `PeerConfig.transportRef` replaces `url`;
- `NodeDependencies.transport` is one injected `PeerTransportPort`;
- `resolveListener(transportRef)` returns a bound
  `TransportListenCapability`;
- `resolveTarget(transportRef)` returns a bound
  `TransportConnectCapability`;
- successful listener acquisition returns
  `TransportListenerPublication.displayAddress?`, replacing `listenerUrl`;
- adapter security/compression/TLS/credential configuration is supplied when
  the concrete transport builds its resolver and bound capabilities, not
  embedded in core topology intent.

`TransportRef` is one to 64 lowercase ASCII characters matching `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`; schemes, slashes, colons, whitespace, and credentials cannot fit.\
Optional `displayAddress` is sanitized operator evidence only, bounded to 256 Unicode code points with no C0/DEL control, and never becomes connect authority.

The exact process-local shape is:
```ts
interface TransportListenCapability {
  listen(
    options: TransportListenOptions,
    callbacks: TransportAcceptCallbacks,
    signal: AbortSignal,
  ): Promise<TransportListenerPort>;
}

interface TransportConnectCapability {
  connect(
    options: TransportAcquisitionOptions,
    signal: AbortSignal,
  ): Promise<TransportChannelPort>;
}

interface PeerTransportPort {
  resolveListener(
    reference: TransportRef,
  ): TransportListenCapability | undefined;
  resolveTarget(
    reference: TransportRef,
  ): TransportConnectCapability | undefined;
}
```

`createNode()` resolves every configured reference synchronously exactly once, captures the returned already-bound capability, and normalizes missing or wrong-kind resolution to `CONFIG_INVALID`.\
It never rereads resolver state during start or reconnect, and there is no separate port/reference pair that can be mismatched.\
Resolver calls are side-effect-free; external I/O begins only when the captured capability is invoked.

Core stores and compares only `TransportRef`.\
The node passes that logical name to the resolver but cannot inspect, serialize, log, compare, or derive policy from the returned capability.\
The adapter owns URL, address, path, service, port, credential, concrete validation, and capability binding.\
If the product later permits several adapters within one node, that multiplexing remains adapter/composition work; do not pre-empt it with scheme dispatch in the kernel.

### 5.3 Package matrix

| Package/module | Sole concern | Public contract | Forbidden knowledge |
|---|---|---|---|
| `@agp/protocol` | AGP JSON packet language and contextual packet semantics | Message schemas, generated DTOs, packet parse/encode, `agp: 1` | WebSocket, gRPC, UDP, QUIC, carrier close codes |
| `@agp/transport` | AGP ordered packet-channel capabilities | Resolver, bound acquisition, channel/listener ports, neutral terminal/error records, limits, evidence, conformance kit | Concrete carrier libraries and routing/FSM behavior |
| `@agp/binding-websocket` | RFC 6455 mapping for AGP packets | `agp.v1`, text/binary rules, close mapping, Ping/Pong and compression rules | Node.js and node/session/routing state |
| `@agp/transport-node-ws` | Node.js WebSocket adapter | Factory implementing transport ports | Protocol validation, identity policy, RIB, FSM |
| `@agp/core` | Deterministic FSM/RIB/operations and transport-neutral config DTOs | Pure reducers, state, schemas, policies, imported bounded `TransportRef` | Resolver/acquisition capabilities, locators, and binding behavior |
| `@agp/node` | Runtime composition of core behavior and packet channels | `createNode`, endpoint API, operations | `ws`, binding constants, close codes, adapter internals |
| `@agp/transport-loopback` | Canonical process-local production adapter and deterministic non-WebSocket witness | Same conformance target as every production adapter | Special kernel hooks and codec bypasses |

The loopback adapter is both a supported production capability and required substitution evidence, not a privileged test transport.\
It must use the same public ports and complete AGP codec/session path as every other implementation.

### 5.4 Future carrier admission

The common port makes future adapters possible; it does not declare every carrier conforming by name:

| Candidate | Minimum adapter obligation before it can satisfy M30 |
|---|---|
| gRPC bidirectional streaming | Preserve one message per packet, enforce bounded flow/cancellation, and map stream status only into common terminals |
| QUIC reliable ordered stream | Add bounded packet framing when needed, choose one unambiguous per-channel ordering domain, and hide stream/application error codes |
| UDP or QUIC datagrams | Not conforming raw; requires an explicitly authorized reliability, order, duplicate suppression, packetization, congestion/backpressure, and teardown shim |
| Durable broker or queue | May be an adapter only if durability/replay remain below the same live-channel semantics; broker acknowledgement must not silently strengthen AGP `send()` or application delivery claims |

Carrier discovery, multi-carrier selection, migration, fallback, and weaker delivery profiles remain F06 work.\
Adding a package is insufficient evidence; the same conformance suite and topology semantics must pass without a kernel branch.

---

## 6. Dependency graph

The target graph is:
```text
@agp/core ───────────────-> @agp/protocol
    └────────────────────-> @agp/transport

@agp/node ───────────────-> @agp/core
    ├────────────────────-> @agp/protocol
    └────────────────────-> @agp/transport

@agp/binding-websocket ──-> @agp/transport

@agp/transport-node-ws ──-> @agp/transport
          ├──────────────-> @agp/binding-websocket
          └──────────────-> ws

@agp/transport-loopback ─-> @agp/transport

@agp/management-http ────-> @agp/core
agpctl ───── read-only HTTP ─────-> @agp/management-http
```

`@agp/transport` has no AGP package or carrier dependency.\
It carries opaque bytes and therefore does not import or redefine protocol `JsonObject`, message, or packet-document types.\
It must not depend on `@agp/protocol`, `@agp/core`, `@agp/node`, any binding, Node built-ins, or `ws`.

`@agp/core` consumes only the neutral schema-generated `TransportRef` data type from `@agp/transport`; it never consumes a resolver, bound acquisition capability, or runtime port.\
`@agp/binding-websocket` consumes only neutral transport types; it does not need protocol DTOs to preserve opaque packet bytes.

Required graph checks:

1. package-manifest dependency graph is acyclic and equals the allowlist;
2. source imports resolve only through public package exports;
3. `@agp/core`, `@agp/node`, and `@agp/transport` contain no import from a
   concrete binding/adapter;
4. WebSocket terms and numeric close constants are confined by an explicit
   path allowlist;
5. every package builds, packs, installs, imports, and typechecks in isolation;
6. generated declarations do not acquire undeclared `@types/node` or
   `@types/ws` dependencies.

---

## 7. Schema and generated-contract ownership

### 7.1 `@agp/protocol`

Retain ownership of:

- envelope and message/body schemas;
- node/session/message/correlation/return-token/endpoint scalars;
- route advertisement/rejection records;
- JSON object/value contracts;
- packet-language error and notification codes.

Remove from protocol results and generated types:

- `closeCode`;
- `AGP_V1_SUBPROTOCOL`;
- "frame" mechanics that mean an RFC 6455 frame/message;
- WebSocket-specific binary-input classification.

Protocol parsing may report `INVALID_UTF8`, `MESSAGE_TOO_LARGE`, or `INVALID_JSON`.\
The node maps that result into the existing semantic notification/FSM path and a neutral close intent; the binding never imports or branches on the parse result.\
The protocol byte limit remains the maximum AGP packet size.

### 7.2 `@agp/transport`

Create a package schema catalog for JSON-compatible, named boundary records:
```text
packages/transport/src/schemas/v1/
  common/
    transport-ref.schema.json
  codes/
    transport-terminal-origin.schema.json
    transport-terminal-kind.schema.json
    transport-listener-terminal-kind.schema.json
    transport-input-rejection-code.schema.json
    transport-operation-error-code.schema.json
    transport-operation-phase.schema.json
  contracts/
    transport-channel-limits.schema.json
    transport-listener-limits.schema.json
    transport-listen-options.schema.json
    transport-acquisition-options.schema.json
    transport-input-rejected.schema.json
    transport-peer-evidence.schema.json
    transport-diagnostic.schema.json
    transport-terminal.schema.json
    transport-listener-terminal.schema.json
    transport-close-intent.schema.json
    transport-abort-intent.schema.json
    transport-listener-publication.schema.json
  catalog.json
```

`TransportPacket` contains `Uint8Array` and remains a language-level immutable byte record rather than pretending to be JSON.\
`TransportOperationError` extends `Error` and may carry a process-local `unknown` cause, so it also remains a language contract rather than a serializable DTO.\
Likewise, do not create JSON Schemas for `AbortSignal`, callbacks, `read`, functions, exceptions, resolver-returned acquisition capabilities, or live channel/listener capabilities.\
Generate JSON-compatible DTOs, validators where runtime data is admitted, schema-document bindings, and catalog constants from one owner.

### 7.3 `@agp/binding-websocket`

Own any public, serializable WebSocket binding configuration:
```text
packages/binding-websocket/src/schemas/v1/
  common/
    subprotocol-token.schema.json
  configuration/
    transport.schema.json
    listener.schema.json
    target.schema.json
    security.schema.json
    compression.schema.json
    liveness.schema.json
  codes/
    binding-rejection-code.schema.json
  contracts/
    close-mapping.schema.json
  catalog.json
```

Binding schemas may reference transport URNs but must not define a second AGP message or peer-evidence schema.\
Node-only injected HTTP/TLS/socket capabilities and concrete bound-capability construction remain TypeScript capabilities in `@agp/transport-node-ws`.

### 7.4 `@agp/transport-loopback`

Own the production adapter's serializable configuration and operational state:
```text
packages/transport-loopback/src/schemas/v1/
  common/
    fabric-id.schema.json
    loopback-address.schema.json
    transport-name.schema.json
  configuration/
    limits.schema.json
    fabric.schema.json
    transport.schema.json
    listener.schema.json
    target.schema.json
  operations/
    fabric-snapshot.schema.json
    listener-snapshot.schema.json
    channel-snapshot.schema.json
    resources-snapshot.schema.json
    counters-snapshot.schema.json
  catalog.json
```

These records may expose bounded address/capacity/lifecycle evidence but never packet content, private queues, mutable node objects, or reusable channel authority.\
Live fabric/listener/channel capabilities remain handwritten.

### 7.5 `@agp/core`

Delete binding ownership:

- `configuration/websocket.schema.json`;
- WebSocket-only URL patterns;
- WebSocket path fields;
- static security evidence represented as authenticated transport truth.

Reference the `@agp/transport`-owned bounded `TransportRef` scalar from `NodeConfig`; do not define a core copy.\
Replace affected fields with transport references and sanitized listener-publication records, update every operations/SDK schema using `url` or `listenerUrl`, regenerate TypeScript from the revised catalogs, and update management projections and CLI only where those public field names change.

### 7.6 Root catalog

Update schema- and semantic-rule-catalog generators plus `test/conformance/schema-catalog-composition.test.js` to discover protocol, transport, WebSocket binding, Loopback, core, and management package catalogs.\
The tests must prove that a package catalog owns each entry, every referenced implementation/test exists under that owner, and the root contains no copied definition.

---

## 8. Exact cross-document change ledger

### 8.1 Uniform-node design set

- **`transport-sovereignty-authority.md`**
  - Retain as the direct fixed-intent and survey-bypass authority.
  - Make D14-D17 and U12-U15 trace lineage cite this document where applicable.
  - Keep implementation mechanics in the contract/binding documents; the
    authority record fixes outcomes and must not become a competing type owner.

- **`transport-contract.md`**
  - Retain arbitrary bounded byte packets in both directions; D16's binary
    WebSocket mapping now satisfies that domain without interpreting UTF-8.
  - Keep adapters JSON-opaque and keep the common transport package independent
    of protocol DTOs.
  - Name `TransportTerminal`, `TransportListenerTerminal`,
    `TransportCloseIntent`, and `TransportAbortIntent` as the only common
    transport lifecycle records, then require adapter documents to import
    rather than restate them.
  - Make `PeerTransportPort.resolveListener/resolveTarget` the only reference
    boundary. Each returns an already-bound capability; `createNode()` resolves
    each configured name once and captures it.
  - Preserve the synchronous send snapshot, discriminated terminal unions,
    exact close-cancellation races, closed operation phase/code matrix, and
    controller-disposition mapping as conformance requirements rather than
    explanatory prose.
  - Do not introduce a common runtime profile identifier. M30 and AX1-T name the
    design/conformance requirement; only a concrete binding owns an on-carrier
    negotiation token.

- **`README.md`**
  - Change the mandate from WebSocket sessions to AGP transport channels.
  - Add `@agp/binding-websocket` and the production Loopback adapter to the
    package and module tables.
  - Change `protocol/codec` from "bounded WebSocket text" to UTF-8 decode/encode
    of opaque transport packet bytes.
  - Replace the dependency diagram with the graph in this review.
  - Remove `@agp/binding-websocket -> @agp/protocol`; add the neutral
    `@agp/core -> @agp/transport` data/type edge required by `TransportRef`.
  - Show one injected `PeerTransportPort` resolving logical names to bound
    listen/connect capabilities; do not show caller-supplied capability maps.
  - State that WebSocket is a certified binding, not the protocol substrate,
    and Loopback is a separate production adapter.

- **`protocol.md`**
  - Define AGP packets and the required M30 ordered packet-channel contract.
  - Replace WebSocket ordering claims with common-channel ordering claims.
  - Remove subprotocol, binary-message, close-code, Ping/Pong, fragmentation,
    and compression rules; link them to `bindings/websocket.md`.
  - Preserve all JSON schemas, OPEN negotiation, routing, data, error, and
    notification semantics.

- **`bindings/websocket.md`** (new normative binding document)
  - Import and use the exact `TransportChannelPort`, `TransportPacket`,
    `TransportRead`, listener terminal/port, resolver/bound-acquisition,
    listener-publication, peer-evidence, and common error names from
    `transport-contract.md`.
  - Own the exact one-packet/one-binary-message mapping, `agp.v1`,
    fragmentation, text-message/size rejection, native close mappings,
    Ping/Pong, compression, HTTP upgrade/path, listener capacity response, and
    security posture.
  - Map text/malformed-framing carrier input into the authorized common
    rejection vocabulary followed by the applicable `TransportTerminal`; pass
    arbitrary accepted binary bytes upward for protocol UTF-8 validation and do
    not add binding-only read variants.
  - Implement exact `close(intent, signal)` and `abort(intent)` signatures. Map
    a locally graceful close to normal binding close, keep AGP semantic detail
    in the prior JSON notification, and return the common terminal record.
  - Apply D16's exact outbound close code table and empty reason bytes, closing
    TSR-30 without retaining the code-unit truncation path.
  - State that reuse of `agp.v1` does not distinguish the retired text mapping;
    under D2 a mixed peer may pass the handshake and fail on its first data
    message. Do not call that pair binding-compatible.
  - Restrict `TransportListenerPublication` to optional `displayAddress`;
    connect/listen reference creation and distribution remain composition-owned.
  - State that adapter success returns an already binding-qualified channel.

- **`transports/loopback.md`** (new production-adapter document)
  - Define a deterministic process-local production implementation that
    exercises only public transport ports and the complete AGP codec/session
    path.
  - Copy immutable packet bytes without string encode/decode or JSON
    interpretation; use pull `read(signal)`, logical-ref resolvers returning
    bound acquisition capabilities, the common closed peer-evidence shape,
    exact channel/listener terminals and intents, and the exact listener
    publication.
  - Implement cancelable/repeatable listener terminal observation and propagate
    unexpected listener loss into the ordinary node lifecycle.
  - Project the intentional closed evidence
    `process-local`/`none`/verified-`same-process-capability`; state that the
    fabric-issued transport principal proves scoped capability possession only,
    not OPEN `nodeId`, process isolation, or cryptography.
  - Ensure listener close never closes already transferred channels.
  - State that it is verification evidence and has no alternate kernel path.

- **`fsm.md`**
  - Replace WebSocket-open/accepted language with qualified channel
    acquisition/adoption.
  - Rename binding-specific input descriptions to neutral channel read
    outcomes.
  - Move Ping/Pong commentary to the WebSocket binding.
  - Define write completion against the ordered packet-channel send sequence.
  - Add the one-shot transport-disposition latch per exact controller
    incarnation so racing terminal causes cannot re-enter teardown.
  - Retain every state, transition, route-purge order, and reconnect rule.

- **`contracts.md`**
  - Add transport and WebSocket-binding package schema trees and ownership.
  - Remove WebSocket schemas from core.
  - Clarify that JSON-compatible records crossing a capability are schema-owned
    while the capability itself is not JSON.
  - State that core's external `TransportRef` schema/type reference creates the
    documented neutral dependency, while the WebSocket binding imports no
    protocol schema or DTO.
  - Expand S1/generation checks to every new package catalog.
  - Compose transport/binding/Loopback semantic-rule catalogs with exact
    owner/implementation/test resolution as well as their schema catalogs.
  - Encode terminal origin/kind discrimination; keep operation code/phase
    scalars sovereign and make the language type/constructor plus negative tests
    enforce every legal phase/code pair.

- **`sdk-operations.md`**
  - Adopt `TransportChannelPort` and the exact neutral listen/connect,
    resolve-once bound-capability, pull-read, and acquired peer-evidence
    contracts from `transport-contract.md`; do not restate competing
    pseudotypes or maps.
  - Replace WebSocket-shaped configuration and result field names.
  - State exact adapter-construction ownership for TLS, credentials,
    compression, and binding configuration.
  - State deadline enforcement, typed close/abort intent ownership,
    channel/listener terminal mapping, and listener/channel ownership transfer.
  - Specify missing/wrong-kind resolver results as construction-time
    `CONFIG_INVALID`, with no partially live node.

- **`routing.md`**
  - Replace remaining "private WebSocket" wording with private transport-channel
    capability.
  - Keep `NextHopRef` and all routing state free of channel handles, acquisition
    capabilities, resolver state, and display addresses.

- **`decisions.md`**
  - Retain D14-D17 as the four non-overlapping transport decisions and cite the
    fixed-intent/survey-bypass authority.
  - Keep D2 explicit that the old text-message peer binding, old SDK, and old
    configuration surface are replaced together without a compatibility layer.
  - Replace D14's ambiguous "exactly once" phrase with duplicate-free
    live-channel semantics and no remote-delivery/durability promise.
  - Retain D16's explicit `agp.v1` legacy-text limitation and deterministic
    first-message failure, closing TSR-37 without a compatibility mode.
  - State D15's final resolver consequence: logical refs resolve synchronously
    once to already-bound capabilities; no independent map/reference pair is a
    public composition surface.
  - Clarify D3: transport and binding boundary data are included in sovereign
    schema generation.

- **`axioms.md`**
  - Add D14-D17/direct-authority lineage to the status table.
  - Refine A3 mechanics to name protocol, packet-channel port, binding, and
    adapter as separate concerns.
  - Do not broaden the claimed A3 scope beyond AGP package composition.

- **`mechanisms.md`**
  - Keep M02 as the AGP JSON packet language.
  - Keep M30 as the reliable ordered packet-channel contract, M31 as the
    sovereign binary-message WebSocket binding, M32 as canonical production
    Loopback, and M33 as logical references, bound resolver capabilities, and
    observed evidence.
  - Revise remaining M20/M21/M23 "frame" or "connection" wording to
    packet/channel where the mechanism is carrier-neutral.
  - Keep F06 as the deferred additional-carrier/selection entry. Its re-entry
    condition must require a demonstrated conforming carrier and fresh intent
    for any weaker reliability/order or dynamic-selection semantics.

- **`verification.md`**
  - Add the fixed-intent authority plus U12-U15 and D14-D17 to
    authority/traceability sections.
  - Extend AX1 with protocol/transport/binding/package isolation subproofs.
  - Extend test ownership layout for binding and conformance-kit tests.
  - Make AX3 use neutral channel acquisition and read outcomes.
  - Require deadline proofs for actual transport writes and closes.
  - Require AX7 success through both real WebSockets and a non-WebSocket
    loopback channel.
  - Keep AX8 WebSocket-specific faults in the adapter suite and carrier-neutral
    loss/stall/reorder faults in the shared channel/chaos suite.
  - Keep the explicit mixed legacy-text/new-binary witness: retained `agp.v1`
    may complete the handshake, but the first text message deterministically
    produces a binding violation without fallback.
  - Add immediate post-`send()` caller-buffer mutation, invalid terminal
    origin/kind, full invalid phase/code cross-product, joined-close
    cancellation, and competing terminal-cause latch tests.

- **`verification-evidence.schema.json` and
  `artifact-certificate.schema.json`**
  - No new top-level gate or certificate sequence is required; their existing
    AX0-AX8, test-file, finding, digest, and recursive lower-gate fields can
    carry the new evidence.
  - AX1 subproof identity is now first-class structured `subgates` data. D2
    authorizes this as an in-place `agp.verification/v1` amendment for the new
    target source revision: AX1 has exactly AX1-P/T/B/L/D, every other gate has
    none, and aggregate PASS requires all five PASS. Historical certificates
    remain immutable evidence only for their recorded source revision and do
    not certify this target.
  - Do not encode WebSocket or Loopback as certificate-wide special cases.

- **`traceability.schema.json`**
  - Permit exactly U1-U15 and D1-D17, with exactly 32 records.
  - Add `maxItems: 32`, `uniqueItems: true`, and an executable exact-ID-set
    oracle because JSON Schema cardinality alone cannot ensure key uniqueness.
  - Keep fixed transport intent represented as stakeholder/decision authority;
    do not invent survey responses or broaden applicable axiom enums.

- **`traceability.json`**
  - Retain separate U12-U15 and D14-D17 records, and add
    `transport-sovereignty-authority.md` to their lineage where applicable.
  - Add transport/binding/Loopback schema IDs and tests to U11 and D3 where
    their existing sovereignty claim expands.
  - Update D2 references/witnesses to prove the deliberate atomic binary-binding
    cutover and absence of a legacy SDK/peer facade.

### 8.2 Repository-level and historical documents

- **root `README.md`**
  - Describe AGP as a JSON packet network with a WebSocket reference binding.
  - Show explicit node plus adapter composition.
  - Describe Loopback as a supported process-local production composition, not
    a kernel test fake.
  - Move security limitations under the Node WebSocket adapter.

- **`docs/testing.md` and package test READMEs**
  - Add the shared adapter conformance category and binding-versus-adapter test
    ownership.

- **superseded MVP design set**
  - The original hub/spoke MVP design record was retired rather than annotated.
    It described a role-split runtime and a WebSocket-shaped transport SPI that
    D1, D2, and D14 replace in full, so preserving it in the active
    documentation surface would have published a contradictory second
    authority. Its contents remain recoverable from version control.

- **examples and operational docs**
  - Continue to use the WebSocket adapter, but label it as one composition.
  - Update generic configuration/result names atomically.

---

## 9. Architecture and certification gates

Do not add a parallel top-level certification sequence.\
Refine the existing AX0-AX8 graph so recursive evidence remains comparable.

### 9.1 AX0 - authority and lineage

Required additions:

- D14-D17 exist and cite `transport-sovereignty-authority.md`, the applicable
  direct stakeholder authority, and the survey bypass.
- Traceability accepts and requires exactly U1-U15 plus D1-D17.
- Every new normative document anchor resolves.
- TSR-01-TSR-11, TSR-13-TSR-17, and TSR-19-TSR-22 remain implementation
  findings; all design-resolved findings TSR-12, TSR-18, and TSR-23-TSR-54
  retain owning regression evidence.

### 9.2 AX1 - sovereign contracts and boundaries

Treat these as required AX1 subproofs:

| Subproof | Required evidence |
|---|---|
| AX1-P contracts | Protocol/core/management/SDK schemas and generated types pass; protocol output contains neutral causes and no carrier close codes or subprotocol token |
| AX1-T transport | Transport catalog/types pass; `@agp/transport` isolated pack/install/typecheck passes; resolver/bound-capability signatures, discriminated terminals, closed phase/code matrix, intents, and generic conformance-kit API are public |
| AX1-B binding | WebSocket binding constants/mapping/config schemas pass with only neutral transport dependencies, without protocol, Node.js, or `ws` |
| AX1-L Loopback | Production package surface, schemas, full common conformance suite, closed evidence, and absence of a kernel/codec bypass pass |
| AX1-D dependencies | Whole-workspace AST/manifest graph equals the allowlist; the Node WS adapter consumes only public binding/transport contracts plus `ws`; forbidden carrier terms are absent from kernel packages; the root catalog composes every owner without copies |

Required new primary tests:
```text
test/conformance/transport-sovereignty.test.js
test/conformance/schema-catalog-composition.test.js
test/conformance/public-node-consumer.test.js
packages/transport/test/contract/public-capabilities.test.js
packages/transport/test/contract/conformance-case-coverage.test.js
packages/binding-websocket/test/contract/packet-mapping.test.js
packages/binding-websocket/test/contract/terminal-mapping.test.js
packages/transport-loopback/test/contract/production-surface.test.js
```

The existing architecture checker must inspect production source, manifests, exports, generated declarations, and tests.\
A regex limited to private imports inside tests is insufficient A3 evidence.

### 9.3 AX2 - packet semantics

- Protocol tests assert neutral parse/validation reasons.
- WebSocket close mapping tests move to the binding package.
- No AX2 semantic rule may name a concrete carrier unless the rule is
  explicitly binding-owned.

### 9.4 AX3 - FSM and deadlines

- Every FSM test uses qualified-channel events, never WebSocket-open as its
  premise.
- Transport write and close deadlines are driven by the deterministic clock
  and demonstrably abort a stalled channel with the authorized intent.
- Binding-specific liveness does not satisfy AGP KEEPALIVE.
- Competing rejection/read/send/timeout/release results pass through one
  per-controller disposition latch and dispatch at most one semantic teardown.

### 9.5 AX4 and AX6 - unchanged semantic owners

- AX4 reruns unchanged RIB/FIB/export oracles over carrier-neutral session
  inputs; no transport reference, display address, native diagnostic, or channel
  capability may enter routing authority.
- AX6 validates canonical state/SDK/HTTP/CLI projections after the schema
  migration. Adapter-private state stays in adapter-owned operations, and any
  node-visible listener publication remains bounded display evidence only.

### 9.6 AX5 - node composition

- The node compiles and operates without importing a binding.
- Node construction resolves each logical transport name once, captures a bound
  capability, and fails before lifecycle creation for a missing/wrong-kind
  result.
- Static configured evidence cannot pass as authenticated channel evidence.
- All local/transit forwarding proofs use the transport-channel call ledger.

### 9.7 AX7 - live composition

Both witnesses are mandatory:

1. a real Node WebSocket topology proving the ratified `agp.v1` binary-message
   binding and its explicit mixed-legacy failure behavior; and
2. the same two-node session/routing/data behavior through a non-WebSocket
   Loopback adapter using logical refs resolved once to bound Loopback
   capabilities.

Passing only the Loopback witness does not certify the WebSocket binding.\
Passing only WebSockets does not prove kernel transport sovereignty or Loopback's production path.

### 9.8 AX8 - adversity and regression

- Run the generic adapter conformance kit against every adapter.
- Keep WebSocket upgrade, text-message, malformed framing, compressed size, and
  close-handshake faults binding-owned; invalid UTF-8 inside an accepted binary
  packet remains protocol-owned.
- Keep stalled write, terminal-event duplication, early packet, channel loss,
  caller-buffer mutation after send returns, joined-close cancellation, reorder
  injection before adapter linearization, queue saturation, and cleanup as
  carrier-neutral chaos contracts.
- The final certificate recursively binds the new AX1 evidence before later
  gates may pass.

---

## 10. Staged migration with no behavior gap

### Stage 0 - authorize and characterize

- Accept the fixed-intent authority, D14-D17, and the survey bypass.
- Capture every legacy implementation finding, including TSR-05-TSR-07, and
  retain regression ownership for every design-resolved finding.
- Characterize the outgoing text-message mapping, then freeze target
  binary-message, early-input, rejection, topology, management, and resilience
  oracles so D2's intentional break is distinguishable from accidental drift.

**Exit:** AX0 passes; no runtime change.

### Stage 1 - split normative specifications

- Define packet language and ordered packet-channel profile.
- Add `bindings/websocket.md`, `transports/loopback.md`, and M30-M33 ownership
  rows.
- Move no runtime behavior yet.

**Exit:** cold review can identify one owner for every base and binding rule.

### Stage 2 - establish sovereign contracts

- Add transport and binding catalogs/generated types.
- Remove WebSocket outcomes from protocol contracts.
- Add the shared conformance kit and package-isolation gates.

**Exit:** AX1-P/T/B/L/D pass in isolation.

### Stage 3 - adapt the existing WebSocket implementation

- Implement `TransportChannelPort` in `@agp/transport-node-ws`.
- Map arbitrary packet bytes, common rejection/terminal, and typed close/abort
  outcomes through
  `@agp/binding-websocket`.
- Enforce the ratified binary-message WebSocket mapping, limits, and
  negotiation token.

This may use a private development bridge, but no certified package export may publish both old and new transport contracts.

**Exit:** all existing adapter contract tests plus the generic kit pass.

### Stage 4 - migrate node and core atomically

- Remove WebSocket parsing/checks/codes from node.
- Replace URL/map acquisition with construction-time
  `PeerTransportPort.resolveListener/resolveTarget` and captured bound
  capabilities.
- Pass acquired peer evidence into admission.
- Enforce write/close deadlines.
- Replace core WebSocket configuration and URL/result fields with
  `TransportRef`, an injected `PeerTransportPort`, captured bound capabilities,
  and listener publication.
- Regenerate core, management, CLI, fixtures, and examples together.

**Exit:** AX1 through AX6 pass; forbidden-token scan finds no binding knowledge in kernel packages.

### Stage 5 - prove two transport compositions

- Add the production Loopback adapter through public ports and the full AGP
  codec/session path.
- Run the same healthy two-node behavior over loopback and real WebSockets.
- Run binding-specific and carrier-neutral adversity in their owning suites.

**Exit:** AX7 and AX8 pass recursively with no process/resource leak.

### Stage 6 - remove migration scaffolding

- Remove private bridges and stale WebSocket-shaped generated artifacts.
- Verify clean generation from an empty temporary output tree.
- Verify isolated package consumers.

**Exit:** one public SDK/config surface, one owner per rule, unchanged AGP JSON meaning, and the single ratified binary-message WebSocket behavior.

---

## 11. Review checklist

### Authority

- [ ] D14-D17 cite the authority record and applicable direct directive,
      A3/A4 support, and explicit survey bypass.
- [ ] The bypass is limited to transport sovereignty and does not authorize
      unordered/datagram semantics or multi-transport composition.
- [ ] D2 is reconciled with the atomic binary binding, SDK, configuration, and
      old-peer cutover.

### Protocol and binding

- [ ] `@agp/protocol` contains no WebSocket token, close code, frame rule,
      compression, Ping/Pong, or URL validation.
- [ ] `@agp/binding-websocket` owns every RFC 6455 mapping exactly once.
- [ ] `agp: 1`, the M30/AX1-T common requirement, and `agp.v1` are not
      conflated; no common runtime profile token exists.
- [ ] Existing legal JSON meaning is preserved and old text-message WebSocket
      peers are explicitly unsupported rather than accidentally half-compatible.
- [ ] Reused `agp.v1` is not claimed to prove binary-versus-text implementation
      compatibility; the mixed-peer failure mode is explicit and tested.
- [ ] Loopback is a production adapter through the ordinary codec/session path,
      not a private kernel fake or packet-decoding shortcut.

### Kernel and transport

- [ ] Core stores only `TransportRef`; the node resolves each name once and
      treats the returned listen/connect capability as opaque and already bound.
- [ ] Resolvers are synchronous, side-effect-free, deterministic, and missing
      or wrong-kind results fail node construction as `CONFIG_INVALID`.
- [ ] Node receives only binding-qualified `TransportChannelPort` instances.
- [ ] The required channel ordering/reliability/boundary guarantees are
      normative.
- [ ] No send receipt or channel guarantee claims remote delivery, persistence,
      replay, application acknowledgement, or exactly-once handling.
- [ ] Channel/listener terminal vocabularies and typed close/abort intents are
      closed and generated where data-only.
- [ ] Per-channel peer evidence reaches identity admission unchanged.
- [ ] Write and close deadlines are executed, not merely configured.
- [ ] Unexpected listener terminal evidence reaches node lifecycle exactly once.
- [ ] A raw datagram or durable broker cannot claim conformance by method shape;
      it proves M30 semantics without changing AGP receipts or FSM behavior.

### Sovereign contracts

- [ ] Transport and binding data records have unique package-owned schemas.
- [ ] Public DTOs are generated from schemas rather than restated by hand.
- [ ] Root catalog composes all package catalogs without copies.
- [ ] Schema descriptions use packet-neutral terminology except in binding
      owners.

### Dependency integrity

- [ ] Package and source graphs equal the documented allowlist.
- [ ] Kernel packages import no concrete binding or adapter.
- [ ] Every package builds and typechecks in an isolated consumer.
- [ ] Generated declarations have no accidental Node/`ws` ambient dependency.

### Verification

- [ ] Shared adapter conformance covers arbitrary bounded packet bytes, exact
      byte preservation, order, early packets, one pull reader,
      channel/listener terminality, cancellation, limits, typed close/abort,
      callback fault, and cleanup.
- [ ] `send()` snapshots before returning its promise; immediate caller-buffer
      mutation cannot alter accepted bytes.
- [ ] Terminal schemas reject invalid origin/kind combinations, and operation
      error types/constructors reject every phase/code pair outside the closed
      matrix.
- [ ] Joined close cancellation yields one terminal for every waiter, and the
      controller-disposition latch suppresses every duplicate teardown effect.
- [ ] Loopback serializes paired-connect cancellation with accept disposition:
      pre-entry cancellation suppresses the callback, while normal return or
      throw wins over cancellation fired while the callback holds the gate.
- [ ] Binding harnesses separately cover hostile text/framing/compression input,
      while protocol tests cover invalid UTF-8/JSON in accepted binary packets.
- [ ] WebSocket mapping tests are binding-owned.
- [ ] Node contract tests use logical refs, resolver-returned bound
      capabilities, and byte-channel fakes.
- [ ] AX7 proves both real WebSocket and loopback composition.
- [ ] AX8 separates binding faults from generic channel faults.
- [ ] Certification includes the updated trace and finding records.

---

## 12. Final acceptance condition

The review is satisfied only when a cold reviewer can remove `@agp/transport-node-ws`, `@agp/binding-websocket`, and `ws` from an isolated node composition, substitute the conforming loopback adapter, and observe the same AGP session, routing, and JSON packet behavior without changing or branching `@agp/protocol`, `@agp/core`, or `@agp/node`.

Conversely, the same reviewer must be able to test the WebSocket mapping without constructing a node, FSM, or RIB.\
That two-way independence is the operative A3 proof.

---

## 13. Mechanics, rationale, and consequence

### Mechanics

The review records each discovered ambiguity as a durable finding with severity, required disposition, resolution state, contract owner, and downstream regression evidence.\
Its checklists then test the complete design from both kernel and binding directions.

### Rationale

A transport split can look clean in a type diagram while configuration, failure, lifecycle, diagnostics, or tests still preserve carrier authority.\
Durable findings prevent those cross-boundary defects from disappearing into review conversation.

### Consequence of violation

An unrecorded or prose-only ambiguity can recur without an owner, let adapters diverge behind the same interface, and falsely certify a kernel that still depends on WebSocket or privileged Loopback behavior.
