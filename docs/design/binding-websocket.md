# AGP v1 WebSocket binding

> **Status:** Normative binding design.
>
> **Common contract:** [`transport-contract.md`](transport-contract.md)
>
> **Binding standard:** [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455)
>
> **Target package:** `@agp/binding-websocket`
>
> **Reference Node adapter:** `@agp/transport-node-ws`

## 1. Scope and ownership

This document defines how a WebSocket adapter realizes one AGP ordered packet channel.\
It binds one `TransportChannelPort` to one established RFC 6455 connection.\
It does not change the AGP envelope language, session FSM, routing semantics, identity admission, or application JSON protocols.

The boundary is deliberately one-way:
```text
AGP kernel ── TransportChannelPort ── WebSocket adapter ── RFC 6455 connection
```

The kernel depends on `TransportChannelPort` and neutral acquisition capabilities.\
It does not import a WebSocket library, inspect HTTP upgrade objects, select a WebSocket subprotocol, interpret WebSocket close codes, or construct `ws:` URLs.\
The adapter depends on the packet-channel contract and owns every RFC 6455 mechanism.

`@agp/binding-websocket` depends only on `@agp/transport`; it MUST NOT import `@agp/protocol`, `@agp/core`, `@agp/node`, or a native WebSocket library.\
The `agp.v1` binding-token constant and native-neutral mapping rules are owned here and do not authorize protocol parsing.\
A concrete package such as `@agp/transport-node-ws` depends on this binding, `@agp/transport`, and its selected WebSocket library.

The certified v1 Node.js adapter profile is deliberately narrow: it supports only explicit trusted-development `ws:` listeners and targets.\
It provides no TLS, HTTP-upgrade authentication, client-certificate, bearer-token, cookie, or proxy-authentication capability.\
`wss:` and every authenticated WebSocket profile are deferred; they require a separately ratified sovereign configuration/capability/evidence contract and their own conformance evidence.\
No undefined security capability is part of this target.

Normative words such as MUST, MUST NOT, SHOULD, and MAY have their ordinary requirements meaning.

---

## 2. Binding negotiation

### 2.1 Subprotocol

The WebSocket client MUST offer the exact `Sec-WebSocket-Protocol` token `agp.v1`.\
The server MUST select exactly `agp.v1`; it MUST NOT select an alias, a case variant, or a fallback token.\
The token is the RFC 6455 binding negotiation value, not the `agp` field inside an AGP JSON envelope.

If the client did not offer `agp.v1`, the server MUST reject the HTTP upgrade.\
If the server does not select `agp.v1`, the client MUST fail acquisition without exposing a `TransportChannelPort` to the kernel.\
No AGP packet may be sent before successful selection.

The adapter returns a channel only after:

1. the HTTP upgrade has completed;
2. `agp.v1` has been selected;
3. the configured trusted-development `ws:` profile has been enforced;
4. receive limits and negotiated WebSocket extensions have been fixed; and
5. all event handlers needed to retain an immediately arriving message are
   installed.

`agp.v1` exists only inside this RFC 6455 binding.\
It is not a runtime `protocolId` exposed through the neutral node/transport port.\
A WebSocket adapter instance configured for this binding completes subprotocol negotiation before channel acquisition commits.

Retired AGP WebSocket implementations that used text messages also offered `agp.v1`, so subprotocol negotiation cannot detect them before channel commit.\
Mixed deployment with that legacy binding is unsupported.\
The first legacy text message follows section 4 exactly: `MALFORMED_CARRIER_INPUT`, then a remote-origin `binding-violation` terminal and Close `1003`.\
The adapter MUST NOT fall back to text, reinterpret it as bytes, retry under another binding, or expose it to the AGP codec.

An outbound subprotocol mismatch rejects `connect()` with `BINDING_UNAVAILABLE`.\
If a listener cannot be created with mandatory `agp.v1` enforcement, `listen()` rejects with `BINDING_UNAVAILABLE` and releases partial resources.\
An individual inbound upgrade without the required offer is rejected below common acquisition and produces neither `accept()` nor `capacityRejected()`.\
None of these cases is represented as a briefly open AGP session.

Closing the WebSocket listener stops new upgrade commits but MUST NOT close channels already transferred to session controllers.

### 2.2 Acquisition references

The certified Node.js WebSocket adapter factory validates adapter-owned configuration containing a `ws:` URL and binds it to a logical `TransportRef`.\
Its `PeerTransportPort.resolveListener()` or `resolveTarget()` returns an opaque `TransportListenCapability` or `TransportConnectCapability` already bound to that URL and adapter authority.\
The URL is retained only inside the adapter closure; it never becomes the common reference or capability shape.

The URL is between one and 2,048 Unicode code points.\
Factory validation uses the WHATWG URL parser and requires scheme exactly `ws:`, a nonempty hostname, no userinfo, no fragment, and no C0/DEL control character.\
Its path and query are adapter deployment configuration; AGP assigns them no meaning.\
The URL cannot contain a credential or other secret state.\
`wss:`, `http:`, `https:`, relative locators, and every other scheme fail factory construction before a resolver port exists.

This profile is suitable only for an explicitly trusted development network.\
It makes no confidentiality, integrity, or peer-authentication claim and MUST NOT be represented as safe across an untrusted boundary.\
Secure WebSocket deployment is deferred rather than simulated through unchecked options.

The listener publication may expose only a sanitized `displayAddress`.\
Adapter-specific composition creates target bindings and assigns their logical references separately.\
Neither a logical reference nor its opaque resolved capability gives the kernel authority to parse a URL.\
Wildcard bind addresses are not publishable peer destinations; an application must supply or derive a concrete advertised host without involving the AGP kernel.

### 2.3 Listener lifecycle

The WebSocket server, HTTP upgrade handler, and bound socket together realize one `TransportListenerPort`.

- `waitTerminal(signal)` observes the one immutable
  `TransportListenerTerminal`; cancelling the wait does not change the listener,
  and every later wait resolves with the same committed record. An existing
  terminal wins even over an already-aborted signal; otherwise the first of
  terminal commit or signal cancellation determines resolve or
  `OPERATION_ABORTED`.
- `close(signal)` stops new upgrade commits, releases listener-owned resources,
  and normally resolves with `{ origin: "local", kind: "graceful" }`.
- A signal cancelled before close initiation makes `close()` reject
  `OPERATION_ABORTED` while the listener remains live. Once close initiation
  wins, later cancellation forces a local `aborted` listener terminal and
  `close()` resolves with that record. An existing or concurrently committed
  terminal wins unchanged.
- Explicit `abort(intent)` synchronously commits a local `aborted` listener
  terminal with diagnostic code `intent.code` unless a terminal already won.
- Unexpected failure of an already committed HTTP server, bound socket, or
  accept loop commits a carrier-origin `io-failure`, `resource-exhausted`, or
  `adapter-fault` terminal as applicable.

Initial bind, HTTP-server setup, and upgrade-handler installation occur before listener acquisition commit.\
Their failure rejects `listen()` and releases partial resources; it does not manufacture a briefly live listener terminal.

An inbound upgrade denied by a supplied pending-acquisition or active-channel limit creates no common channel and invokes `capacityRejected(kind)` exactly once.\
When an HTTP response is still safe, the adapter rejects that upgrade with `503 Service Unavailable` and an empty bounded body; otherwise it destroys only the uncommitted native connection.

Before callback entry, the adapter has released every common acquisition reservation, detached the upgrade from all accept/channel-commit handlers, and irrevocably selected response-and-close or destroy.\
The detached native handle is counted in a bounded adapter-cleanup set until physical closure, cannot become a channel or invoke another acceptance callback, and is proven to release eventually.\
Thus "release before callback" means loss of all acquisition authority and common capacity, not a false claim that an asynchronous TCP close has already completed.

If `capacityRejected` throws, the adapter catches the value after releasing the triggering attempt.\
If `accept` throws, it catches the value and aborts the upgraded but not successfully transferred channel.\
Either callback fault selects stable code `ACCEPT_CALLBACK_FAILED` or `CAPACITY_REJECTED_CALLBACK_FAILED`.\
Unless a re-entrant close, abort, or carrier failure already committed the listener terminal, the adapter commits `{ origin: "carrier", kind: "adapter-fault", diagnostic: { code: stableCallbackCode } }`.\
After that first-terminal disposition is stable, it invokes the injected `TransportDiagnosticSinkPort.emit({ code: stableCallbackCode }, thrownValue)` exactly once; absence uses the defined no-op.\
The thrown value remains only the separate process-local cause.

First-terminal-wins, and no later upgrade or acceptance callback begins for that listener: specifically, no later upgrade commits and neither `accept` nor `capacityRejected` begins.\
The adapter sends no thrown value, message, stack, request data, or diagnostic text in an HTTP body or WebSocket Close reason.\
Other listeners and channels already transferred to session controllers remain unaffected.

Listener close or failure never closes channels already transferred to session controllers.\
The node lifecycle continuously observes `waitTerminal()`.\
A non-graceful or otherwise unexpected listener terminal while the node is `Running` fails the node lifecycle; reporting it only to an adapter log is forbidden.

---

## 3. Packet mapping

The common transport packet is an opaque `Readonly<Uint8Array>`.\
This binding maps those bytes exactly:

- every outbound packet becomes the payload of exactly one WebSocket
  **binary message**;
- every accepted inbound WebSocket binary message becomes exactly one
  `TransportPacket`;
- multiple AGP packets MUST NOT be concatenated into one WebSocket message;
- one AGP packet MUST NOT be divided across multiple WebSocket messages; and
- WebSocket text messages MUST NOT be exposed as AGP packets.

RFC 6455 fragmentation is below this boundary.\
A WebSocket implementation may split one binary message into frames, but the adapter MUST reassemble the complete message before exposing a packet.\
Control frames interleaved with fragmented data do not create packet boundaries.

The adapter preserves every byte value exactly.\
It performs no UTF-8 decode, UTF-8 encode, JSON parse, canonicalization, normalization, interpretation, or application-payload inspection.\
The AGP codec above the common transport boundary owns conversion between these opaque packet bytes and one UTF-8 JSON document.

The reassembled, post-decompression payload byte length is the packet byte length.\
Limits are measured in bytes, not WebSocket frame count or compressed size.

---

## 4. Input rejection

Binding-invalid input is rejected before it reaches the AGP codec:

| WebSocket condition | Common read results | RFC 6455 action |
|---|---|---|
| Text data message | `input-rejected: MALFORMED_CARRIER_INPUT`, then terminal `binding-violation` | Close `1003` |
| Invalid UTF-8 encountered by the WebSocket stack before text-kind rejection | `input-rejected: MALFORMED_CARRIER_INPUT`, then terminal `binding-violation` | Close `1007` |
| Reassembled/decompressed message exceeds the receive limit | `input-rejected: PACKET_TOO_LARGE`, then terminal `binding-violation` | Close `1009` |
| Invalid WebSocket framing or extension use that can be classified safely | `input-rejected: MALFORMED_CARRIER_INPUT`, then terminal `binding-violation` | Close `1002` when safe |
| Carrier read fails before safe rejection evidence can be materialized | terminal `io-failure` | Fail connection |
| Supplied common receive bounds cannot retain the next message | local terminal `resource-exhausted` with code `RECEIVE_OVERFLOW` | Close `1011` or abort if a safe close cannot be queued |

Overlapping conditions use the earliest safe binding classification: RFC 6455 framing/UTF-8 validity, then reassembled/decompressed size, then data kind.\
Thus an over-limit text message may be rejected as `PACKET_TOO_LARGE` before the adapter can classify it as unsupported text.

For every `input-rejected` row, the adapter MUST commit that read result before the exact terminal `{ origin: "remote", kind: "binding-violation", diagnostic: { code: inputRejection.code } }`.\
It returns each item at most once in its FIFO position and admits no later packet.\
A later native close callback cannot replace that committed terminal outcome.\
The adapter MUST NOT construct an AGP notification from bytes that were unsafe to accept.

The adapter never decodes accepted binary packet bytes.\
A binary message may contain any byte sequence, including bytes that are not valid UTF-8, and still passes unchanged to the protocol codec.\
The only invalid-UTF-8 classification owned by this binding arises while the WebSocket stack validates a rejected text message, possibly before the adapter observes its data kind; that rejection remains `MALFORMED_CARRIER_INPUT`.

Invalid JSON, duplicate JSON members, schema failure, an unsupported AGP envelope version, and contextually illegal AGP messages are not WebSocket binding failures.\
The adapter delivers the opaque packet bytes and the kernel applies UTF-8, JSON, and protocol validation.

---

## 5. Ordering, writes, and backpressure

RFC 6455 message order realizes the packet channel's per-direction ordering.\
The adapter MUST preserve the kernel writer's invocation order and MUST use no second queue that can reorder control and data packets.

`send(packet, signal)` fulfils when an immutable snapshot of the complete packet has crossed the adapter's bounded ordered-acceptance point as one binary message and the underlying WebSocket write completion has made the next write safe.\
The adapter captures that independent snapshot synchronously before returning the promise and never retains, detaches, or rereads the caller's byte view.\
Fulfilment:

- permits the kernel to release that packet's adapter-write reservation;
- does not prove peer receipt, parsing, or AGP processing; and
- must not occur merely because the bytes were appended to an unbounded
  application-side queue.

Only one packet write is in flight per channel.\
Cancellation that wins before the adapter invokes `ws.send()` rejects `OPERATION_ABORTED` with `acceptance: "not-accepted"` and the packet cannot later appear.\
Invoking `ws.send()` is the native dispatch point but is not common send acceptance; the callback's successful completion is the acceptance point.\
If cancellation, write error, or carrier failure wins after dispatch and before that callback, the packet outcome is unknowable.\
The adapter rejects `SEND_FAILED` with `acceptance: "unknown"`, commits exactly one carrier-origin `TransportTerminal` with `kind: "io-failure"` and diagnostic code `SEND_FAILED`, aborts the WebSocket, and never continues that channel.\
A later write, error, or close callback cannot replace the committed outcome.

Inbound buffering is bounded by both packet count and packet bytes.\
`read(signal)` is a single-consumer pull operation with at most one outstanding call.\
Where the WebSocket library exposes pause/resume or stream flow control, the adapter uses it.\
If it cannot pause before exhausting the configured bound, it commits a local terminal with `kind: "resource-exhausted"` and diagnostic code `RECEIVE_OVERFLOW` rather than dropping a message.\
It never creates an unbounded push-backed shadow queue.

The WebSocket implementation MUST be able to carry every packet permitted by the supplied common channel limits.\
Its native encoded-payload, extension, and buffering ceilings MUST simultaneously be at least as restrictive as the binding's configured safety ceilings.\
An incompatible smaller carrier maximum fails acquisition rather than silently reducing the common packet limit.

---

## 6. Compression

Compression is disabled by default.

An adapter MAY explicitly enable RFC 7692 `permessage-deflate`.\
If enabled:

1. the adapter validates the negotiated extension and parameters and retains
   only the bounded private state required to enforce them;
2. compressed input and post-decompression output each have explicit byte
   bounds;
3. the post-decompression bound is no greater than the AGP receive limit;
4. the adapter rejects an over-limit message before allocating an unbounded
   reassembled value;
5. context takeover SHOULD be disabled in both directions to bound retained
   state; and
6. decompression remains transparent to the kernel and cannot change packet
   boundaries.

Authentication credentials MUST NOT be copied into compressible AGP packets.\
Enabling compression is a deployment security decision, not an AGP capability.

---

## 7. Ping, Pong, and liveness

WebSocket Ping/Pong belongs entirely to the adapter.\
It MAY be used to detect a broken carrier and commit a carrier-origin `io-failure` terminal.\
It MUST NOT:

- emit an AGP packet;
- synthesize an AGP `keepalive`;
- advance the AGP session FSM;
- confirm receipt of an AGP packet; or
- reset the AGP hold timer.

AGP keepalive and hold semantics remain mandatory even when Ping/Pong is enabled.\
Ping interval, Pong deadline, and outstanding-Ping capacity are finite adapter configuration.

---

## 8. Close mapping

The common `close(intent, signal)` operation carries a bounded neutral intent, not an AGP wire notification or carrier-native reason.\
Fatal AGP detail belongs in a safely encoded `notification` packet sent before `close`; the transport close is not a second protocol channel.

The first close intent owns native mapping:

| `TransportCloseIntent.kind` | WebSocket action |
|---|---|
| `normal` | Close `1000`, empty reason |
| `node-stop` | Close `1000`, empty reason |
| `session-replaced` | Close `1000`, empty reason |
| `protocol-fatal` | Close `1000`, empty reason |

The adapter places that Close frame after every previously accepted packet.\
Later close intents join the same operation and cannot replace the first mapping.\
A successful local close normally resolves with `{ origin: "local", kind: "graceful", diagnostic: { code: intent.code } }`; a graceful peer close may win with remote origin.

Close `1002` is reserved for a WebSocket binding/framing violation detected below the common channel.\
A neutral `protocol-fatal` intent remains an orderly carrier release because its AGP meaning was already carried by the preceding notification packet; exporting that meaning through the native close would create a second protocol channel.

Binding-owned failures use this exact mapping:

| Binding condition | WebSocket action | Common outcome |
|---|---|---|
| Local common `close()` | Mapping above | local `graceful` terminal after proven handshake completion |
| Invalid RFC 6455 framing/extension | Close `1002` when safe | rejection followed by remote `binding-violation`, or carrier `io-failure` if no safe rejection can be materialized |
| Text data message | Close `1003` | rejection followed by remote `binding-violation` |
| Invalid UTF-8 text input detected before kind rejection | Close `1007` | rejection followed by remote `binding-violation` |
| Packet exceeds the enforced bound | Close `1009` | rejection followed by remote `binding-violation` |
| Receive overflow | Close `1011` when safe, otherwise abort | local `resource-exhausted` with code `RECEIVE_OVERFLOW` |
| Unsafe adapter failure | Close `1011` when safe, otherwise abort | carrier `adapter-fault` |

AGP notification codes, including `HOLD_TIMEOUT` and `ADJACENCY_COLLISION`, do not receive private WebSocket close codes.\
The binding cannot see them through the common port, and a peer must use the preceding JSON notification when one was safe to send.

Binding-initiated Close reasons are empty.\
An adapter MUST NOT place a diagnostic message, URL query, header, credential, certificate, stack trace, application payload, or peer-supplied free text in a Close frame.

A received valid Close frame and completed handshake yields a remote `TransportTerminal` with `kind: "graceful"`.\
Its native code and reason remain adapter-private and never enter that terminal.\
A stable adapter-owned diagnostic code such as `PEER_CLOSED` MAY be attached, but it is not the native status or peer-supplied reason.\
EOF, TCP reset, invalid Close framing, or library error without a proven graceful handshake yields a carrier-origin terminal with `kind: "io-failure"`.\
Status code `1006` is observation-only and MUST NOT be placed in a Close frame.

`close()` is idempotent.\
An existing terminal resolves immediately even for an already-aborted signal.\
A signal that wins before close initiation rejects `OPERATION_ABORTED` and leaves the channel open.\
Once close initiation wins, new sends fail; later signal cancellation forces a local `aborted` terminal and all joined close calls resolve with that record.\
Competing close, error, cancellation, and explicit `abort(intent)` callbacks commit exactly one terminal outcome.\
Packets and rejection evidence admitted before terminal commit remain ahead of it in pull-read FIFO order.

Every channel or listener diagnostic exported by this binding has exactly the closed `TransportDiagnostic` shape: a bounded stable `code` and, only when useful, a bounded sanitized `message`.\
Raw `Error` objects, HTTP headers, WebSocket reason strings, TLS objects, socket addresses, credentials, stack traces, and adapter-private fields never cross the common port.

---

## 9. Adapter configuration and evidence

### 9.1 Owned data catalog

Public serializable binding records are generated from this package-owned catalog:
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

These schemas may reference neutral transport schemas; no core, protocol, or node schema references them in reverse.\
The root schema catalog assembles these documents without redefining them.

### 9.2 Data and live capabilities

Schema-backed WebSocket configuration is passed to the adapter at the application composition edge.\
It is not part of the AGP kernel configuration model.\
The listener and target schemas own these exact generated records:
```ts
type WebSocketCompressionConfig =
  | { readonly mode: "disabled" }
  | {
      readonly mode: "permessage-deflate";
      readonly maxCompressedBytes: number;
      readonly noContextTakeover: true;
    };

interface WebSocketSecurityConfigData {
  readonly mode: "trusted-development";
}

interface WebSocketLivenessConfigData {
  readonly pingIntervalMs: number;
  readonly pongTimeoutMs: number;
}

interface WebSocketListenerConfigData {
  readonly transportRef: TransportRef;
  readonly url: string;
  readonly displayAddress?: string;
  readonly compression: WebSocketCompressionConfig;
  readonly liveness?: WebSocketLivenessConfigData;
  readonly security: WebSocketSecurityConfigData;
}

interface WebSocketTargetConfigData {
  readonly transportRef: TransportRef;
  readonly url: string;
  readonly compression: WebSocketCompressionConfig;
  readonly liveness?: WebSocketLivenessConfigData;
  readonly security: WebSocketSecurityConfigData;
}
```

Numeric liveness fields are positive safe integers.\
`displayAddress`, when present, satisfies the neutral listener-publication bound and is returned unchanged as sanitized operator evidence.\
It need not equal the bind URL and grants no connect authority.\
The generated `transport` record contains `listeners` and `targets` arrays, each bounded to 4,096 entries, and requires each `transportRef` to be unique within its acquisition kind.\
One reference MAY exist once in each kind because resolver kind remains explicit.\
The contextual uniqueness invariant is `WEBSOCKET-REFERENCE-UNIQUENESS-1`, owned by the binding semantic-rule catalog; JSON object equality is not used as a substitute for key uniqueness.

The sole optional live capability is neutral diagnostic observation:
```ts
interface WebSocketTransportCapabilities {
  readonly diagnostics?: TransportDiagnosticSinkPort;
}

interface WebSocketTransportConfigData {
  readonly listeners: readonly WebSocketListenerConfigData[];
  readonly targets: readonly WebSocketTargetConfigData[];
}

declare function createNodeWsTransport(
  config: WebSocketTransportConfigData,
  capabilities?: WebSocketTransportCapabilities,
): PeerTransportPort;
```

The capability object is neither schema-backed data nor a member of a listener or target configuration record.\
Each bound acquisition receives its exact authoritative `TransportChannelLimits` through the neutral listen/connect options and enforces them directly.\
WebSocket configuration contains no second receive-limit triple, cannot infer another value from native defaults, and cannot silently replace or renegotiate the common limits.

`TransportDiagnosticSinkPort` is imported only from `@agp/transport`.\
The WebSocket adapter calls it with the closed neutral `TransportDiagnostic`; a native `Error` or other thrown value may accompany that record only as the separate process-local `cause` argument.\
If the capability is absent, emission is a no-op.\
If it throws, the adapter contains the throw without recursively emitting or changing acquisition, terminal, callback, or resource-accounting behavior.\
Neither the sink nor its cause becomes WebSocket configuration, common transport data, or AGP kernel state.

The concrete factory validates every data record before returning its resolver port.\
The generated configuration records and binding constants are owned by `@agp/binding-websocket`; the factory and optional diagnostic-capability interface are exported by `@agp/transport-node-ws`.\
Unknown capabilities, `wss:` locators, a security mode other than `trusted-development`, or a credential-bearing locator fail construction rather than weakening the declared profile.

HTTP `Origin`, cookies, authorization headers, proxy-forwarding headers, TLS objects, and socket addresses are ignored as identity evidence in this target.\
They never enter a logical `TransportRef`, listener `displayAddress`, common read result, operations snapshot, or diagnostic record.\
Browser-origin policy, trusted proxy policy, TLS, and upgrade authentication belong to the deferred secure profile.

### 9.3 Peer evidence

For every accepted or connected channel in the certified profile, peer evidence is exactly:
```ts
{
  locality: "network",
  protection: "none",
  authentication: { kind: "none" }
}
```

It is derived from actual acquisition under the trusted-development profile, not copied from desired identity configuration.\
A remote socket address may be retained only as bounded adapter-private operational diagnostics; it cannot enter the closed `TransportPeerEvidence` record or become identity evidence.\
AGP `nodeId` remains an OPEN claim until the identity-admission port evaluates it with this explicitly unauthenticated evidence.

Subprotocol and compression facts are adapter-private diagnostics in v1, not a public serializable record or query surface and not members of the closed `TransportPeerEvidence` record.\
Adding a public adapter-operations surface would require sovereign schemas and separate design authority.

---

## 10. Secure profile

The binding realises the neutral `preshared-key` profile from [`transport-contract.md` section 16](transport-contract.md#16-channel-security) as TLS 1.3 with pre-shared keys.\
It adds no security concept of its own; it maps one that already exists onto RFC 6455 over TLS.

### 10.1 Profile and scheme

`security.mode` and the URL scheme are bound, and a mismatch fails factory construction before any resolver port exists:

| `mode` | Required scheme | Rejected |
|---|---|---|
| `trusted-development` | `ws:` | `wss:`, and every other scheme |
| `preshared-key` | `wss:` | `ws:`, credential-bearing locators |

A `preshared-key` listener or target without an injected `PresharedKeyPort` fails construction.\
Configuration declares which profile applies; it never carries a secret.

### 10.2 Handshake

TLS 1.3 only, pre-shared-key cipher suites only, no certificate, no certificate authority, and no client-certificate request.

Early data is disabled on both sides.\
A handshake that negotiated early data is a binding violation, because replaying captured early data across connections that share a secret is possible and the neutral contract promises no such replay.

A negotiated version below TLS 1.3 is a binding violation.

The dialer presents `PresharedKeyPort.localIdentity`.\
The listener answers with `PresharedKeyPort.resolve(identity)` and refuses by returning `undefined`.

Identity flows one way.\
TLS 1.3 removed `psk_identity_hint`, which existed only in TLS 1.2 and earlier, so a listener cannot advertise a label and a dialer observes none.\
The dialer therefore has no principal to report.\
What it does know is that its peer possessed the secret registered for the dialer's own identity, which `protection` records.\
Substituting the configured `expectedNodeId` would restate desired identity as observation, and downgrading to TLS 1.2 to recover a label would trade real security for reportable detail.

### 10.3 Authentication is not certificate verification

`socket.authorized` reports certificate-chain verification, which a pre-shared-key handshake never performs.\
It is `false` for every correctly authenticated peer.

No implementation may read `authorized`, `authorizationError`, or `getPeerCertificate()` to decide whether a peer is authenticated.\
Authentication is proven by the handshake completing at all, because it cannot complete without the secret.

### 10.4 Evidence

| Profile | `protection` | `authentication` |
|---|---|---|
| `trusted-development` | `none` | `{ kind: "none" }` |
| `preshared-key`, `network` keying | `confidentiality-and-integrity` | `{ kind: "none" }` |
| `preshared-key`, `node` keying, accept | `confidentiality-and-integrity` | `{ kind: "verified", principal: <observed identity>, method: "tls-psk" }` |
| `preshared-key`, `node` keying, connect | `confidentiality-and-integrity` | `{ kind: "none" }` |

`locality` is `network` throughout.

Under `network` keying every holder can present any identity, so the presented label proves nothing about which peer connected and never enters evidence.

Only a listener reports a verified principal, because only a listener observes one.

### 10.5 Failure mapping

A peer that fails the handshake never becomes a channel, so no terminal record reaches the node and the outcome is visible only as a bounded adapter diagnostic.\
On the dialing side the acquisition rejects:

| Cause | Adapter result | Redial |
|---|---|---|
| Unknown identity, `resolve` returned `undefined` | `CONNECT_FAILED` | Yes, bounded backoff |
| Wrong secret | `CONNECT_FAILED` | Yes, bounded backoff |
| No shared cipher suite | `CONNECT_FAILED` or `LISTEN_FAILED` | Yes, bounded backoff |
| Negotiated version below TLS 1.3 | `CONNECT_FAILED` | Yes, bounded backoff |
| Early data negotiated | `CONNECT_FAILED` | Yes, bounded backoff |

Every secure-profile failure is retryable under the node's existing bounded dial backoff, and none introduces a session FSM event.\
A secret mismatch resolves itself when the deployment rotates and the port returns the new value, so making it terminal would turn a routine rotation into an outage requiring node replacement.

### 10.6 Forward secrecy

The handshake negotiates `psk_dhe_ke`: an ephemeral X25519 key share accompanies the pre-shared secret, so session keys are not derivable from the secret alone.\
A secret disclosed later does not decrypt traffic captured earlier.

This is a property of the negotiated mode rather than of pre-shared keys in general.\
`psk_ke` would omit the key share and lose it, so a binding must not configure a profile that permits `psk_ke`.

---

### 10.7 Redaction

Key bytes never enter a diagnostic, an evidence record, canonical operational state, a terminal record, or an error message.\
A `TransportDiagnostic` may carry a closed failure code and, under `node` keying, the identity; it never carries the secret.\
Native TLS error objects remain process-local raw causes under the existing diagnostic rule.

---

## 11. Responsibility matrix

| Concern | WebSocket adapter | AGP kernel |
|---|---:|---:|
| URL, HTTP upgrade, proxy integration | owns | invisible |
| TLS and upgrade authentication | deferred; absent from certified target | receives explicit unauthenticated evidence |
| `agp.v1` subprotocol selection | owns before commit | invisible |
| RFC 6455 frames, fragmentation, control frames | owns | invisible |
| One binary message to one packet | owns | consumes packet |
| Text-message/reassembled-size rejection | owns | consumes rejection evidence |
| Acceptance-callback throw isolation | catches, cleans, terminalizes listener | observes listener terminal |
| JSON parse, schema, duplicate-member safety | opaque | owns |
| AGP OPEN, identity, timers, routing | opaque | owns |
| Bounded carrier buffering | owns | supplies requirements |
| Bounded AGP work queues | opaque | owns |
| Close-frame mapping | owns | invokes neutral close/abort |

---

## 12. Binding conformance

A conforming WebSocket adapter passes common invariants T01-T21 and is tested with actual RFC 6455 peers to prove:

1. exact `agp.v1` offer/selection and fail-closed mismatch handling;
2. a legacy text peer that also selects `agp.v1` fails on its first text message
   with no fallback or packet exposure;
3. pre-commit bind/setup failure releases all partial resources and exposes no
   listener terminal;
4. immediate post-upgrade input cannot outrun handler installation;
5. one fragmented or unfragmented binary message produces one identical packet;
6. bidirectional packets retain byte content and order;
7. text-message, invalid-text-UTF-8, compressed-over-limit, and
   decompressed-over-limit input have the exact rejection/close mapping;
8. bounded slow-consumer behavior never creates an unbounded receive buffer;
9. cancellation before `ws.send()` dispatch proves `not-accepted`, while
   cancellation after dispatch and before its callback rejects `SEND_FAILED`
   with unknown acceptance, commits one carrier `io-failure`, and cannot be
   overwritten by the later callback;
10. Ping/Pong has no AGP timer or FSM effect;
11. close codes and reasons are sanitized and bounded;
12. every channel reports exactly network/none/unauthenticated peer evidence,
    unchanged at identity admission, and `wss:`/TLS/authentication
    configuration fails before a resolver port exists;
13. listener wait cancellation has no lifecycle effect, ordinary listener close
    returns the local graceful terminal, and listener close/abort/failure races
    commit exactly one observable terminal;
14. both capacity-rejection kinds invoke their callback once; `Error` and
    non-`Error` throws from `accept` or either capacity callback are caught
    after exact acquisition/channel cleanup, emit only the bounded diagnostic,
    obey first-terminal-wins, and stop the listener without affecting other
    listeners or transferred channels; absent and throwing diagnostic sinks
    have the exact neutral no-op/containment behavior;
15. an unexpected listener terminal while the node is `Running` fails the node
    lifecycle without closing transferred channels; and
16. credential and peer-supplied data do not leak through diagnostics or
    operational state.

---

## 13. Mechanics, rationale, and consequence

### Mechanics

The binding negotiates `agp.v1`, maps one complete RFC 6455 binary message to one neutral packet, enforces carrier framing/size and the explicit trusted-development profile, and maps native termination to the common closed transport records.\
The kernel receives only opaque bytes, neutral limits, terminal evidence, and bounded observed peer evidence.

### Rationale

WebSocket is the first network carrier, not AGP's protocol identity.\
Keeping its negotiation, framing, Ping/Pong, compression, security-profile boundary, and close codes in one sovereign binding permits the unchanged kernel to run over any future carrier that proves the same packet-channel contract.\
Deferring TLS/authentication rather than inventing incomplete live capabilities keeps the certified evidence claim exact.

### Consequence of violation

- WebSocket facts entering core configuration, protocol parsing, FSM
  decisions, RIB state, or SDK records make carrier replacement a kernel
  rewrite, and Loopback can no longer prove transport-equivalent behavior.
- A text-message mapping cannot carry the neutral channel's arbitrary-byte
  `send` domain. Reintroducing one silently narrows the packet contract to
  whatever survives UTF-8, and the narrowing is invisible until a payload
  fails.
- Reusing the `agp.v1` token proves only that both ends selected the named
  binding. Treating successful negotiation as proof that a peer implements
  this binary mapping admits a legacy text peer into a session that cannot
  decode it.
- Truncating a native close reason by code unit rather than UTF-8 byte splits
  a multi-byte character and emits a malformed carrier frame. Binding-initiated
  reasons are empty precisely so no truncation path exists.
- Cancelling a send after carrier dispatch but before its callback cannot
  honestly claim non-acceptance. Reporting it as not accepted invents a
  guarantee the carrier never made.
- Naming a TLS or authentication capability without defining its authority,
  results, evidence derivation, and failure mapping produces a security claim
  with no mechanism behind it, which is worse than the documented absence.
