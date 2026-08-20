# AGP uniform node — carrier-neutral packet transport contract

> **Status:** Ratified implementation design with transport-sovereignty
> amendment (2026-07-30). Release
> certification remains governed by `verification.md`.

## 1. Mandate and authority

This document defines the complete capability boundary between the AGP node
runtime and an injected packet-transport adapter. It is normative for
`@agp/transport`, every concrete transport adapter, and every node/session call
site that consumes those ports.

AGP requires one **reliable, ordered, message-bounded byte channel** per peer
session. The adapter acquires that channel from a concrete carrier. The AGP
protocol package owns UTF-8 decoding, JSON parsing, schema validation, and AGP
message semantics above the channel. The adapter owns carrier acquisition,
carrier framing, native flow control, native liveness, and native teardown below
the channel.

Existing design prose that names one concrete carrier describes a binding of
this contract. It does not grant that carrier's concepts ownership in
`@agp/protocol`, `@agp/core`, `@agp/transport`, or `@agp/node`.

Normative terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` have their ordinary
requirements meaning.

## 2. Boundary and terminology

| Term | Meaning |
|---|---|
| Carrier | A concrete reliable transport mechanism hidden behind an adapter |
| Adapter | The component implementing this contract for one carrier family |
| Transport reference | Bounded logical identifier stored in core topology configuration |
| Listen capability | Opaque adapter-bound authority resolved from a configured transport reference |
| Connect capability | Opaque adapter-bound authority resolved from a configured transport reference |
| Listener | A live capability that may yield accepted channels |
| Channel | One reliable, ordered, message-bounded bidirectional byte path |
| Packet | One finite byte sequence whose boundary and order are preserved by the channel |
| Acquisition commit | The instant ownership of a usable channel transfers to the node |
| Send acceptance | The instant one immutable packet enters the channel's ordered outbound sequence |
| Terminal commit | The one irreversible transition of a channel to one immutable `TransportTerminal` record |
| Peer evidence | Bounded immutable security facts established by the adapter during acquisition |

The word “packet” in this contract is an application-record boundary. It does
not imply a network datagram, maximum transmission unit, routable network
packet, or unreliable delivery.

The ownership split is:

```text
embedding application
  └─ configures transportRef → adapter-owned bound acquisition capabilities
       └─ AGP invokes one capability to acquire a packet channel
            └─ AGP session parses packet bytes as one AGP JSON document
                 └─ AGP protocol/FSM/routing/application semantics
```

## 3. Package sovereignty

The dependency direction remains:

```text
@agp/core ───────────────→ @agp/protocol
    └────────────────────→ @agp/transport

@agp/node ───────────────→ @agp/core
    ├────────────────────→ @agp/protocol
    └────────────────────→ @agp/transport

@agp/binding-websocket ──────────────────→ @agp/transport
@agp/transport-node-ws ──────────────────→ @agp/binding-websocket + @agp/transport + ws
@agp/transport-loopback ─────────────────→ @agp/transport
embedding application ────────────────────→ @agp/node + adapter
```

`@agp/transport` owns the handwritten capability types and the sovereign
JSON-compatible records named in this document. It has no dependency on AGP
wire DTOs, node configuration DTOs, a carrier library, or a concrete adapter.
A concrete adapter imports the public transport contract; the node never
imports a concrete adapter.

`@agp/core` depends on `@agp/transport` only for schema-generated neutral data
types used by configuration and operations. It does not import a concrete
adapter or any capability implementation.

An adapter may expose its own strongly typed configuration and reference
builders from its own package. Those types do not become part of the common
transport contract merely because the embedding application composes them.

## 4. Logical references and bound acquisition capabilities

### 4.1 Nominal shape

The following pseudotypes describe process-local authority, not JSON records:

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

`TransportRef` is the schema-generated bounded string stored in `NodeConfig`.
It is one to 64 lowercase ASCII characters and matches
`^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`; schemes, slashes, colons, whitespace,
and credentials cannot fit. It is an application-local composition name, not a
globally meaningful address.

The embedding application supplies one `PeerTransportPort`. `createNode()`
resolves every configured reference synchronously, captures the exact returned
capability, and fails `CONFIG_INVALID` for a missing or wrong-kind reference.
It resolves each configured reference once and never rereads adapter state
during start or reconnect.

For this v1 certification target, every capability resolved for one node comes
from one concrete adapter composition. The generic resolver shape does not
authorize a composite port that mixes WebSocket and Loopback capabilities
inside one node. Mixed-adapter lifecycle, failure, operations, and selection
semantics remain F06 work requiring fresh intent; applications may still run
different ordinary nodes over different canonical transports.

The returned capability is already bound to its concrete adapter and
authority; there is no separately supplied port with which it can be
mismatched. AGP may invoke and retain that capability but MUST NOT:

- parse its fields;
- compare it to infer peer or listener identity;
- serialize it into the AGP wire protocol;
- derive security, protocol, routing, or retry policy from it;
- log it without an adapter-provided safe projection; or
- assume that it is a URL, address tuple, path, service name, or JSON value.

Logical references name composition slots, and resolved capabilities carry
acquisition authority; neither is stable peer identity. `adjacencyId`,
`nodeId`, `sessionId`, controller identity, and route next-hop identity remain
owned by their existing AGP layers.

### 4.2 Reference creation and validation

Port and capability construction is adapter-specific and occurs at the
embedding composition boundary. An adapter factory validates all concrete
configuration before returning its port. Resolver methods are synchronous,
side-effect-free, and deterministic for the lifetime of that port. An invalid
logical reference supplied directly to a resolver fails with
`REFERENCE_INVALID`; a valid but unmapped or wrong-kind reference returns
`undefined`, which `createNode()` normalizes to `CONFIG_INVALID`.

Configuration systems store the core `transportRef` separately from
adapter-owned configuration. The adapter factory validates its own
configuration, compiles it into bound capabilities, and returns the resolver
port before `createNode()`. No unchecked adapter object is embedded in core
configuration.

### 4.3 Bound listener publication

A successful listen operation returns a sanitized data-only publication:

```ts
interface TransportListenerPublication {
  readonly displayAddress?: string;
}
```

`displayAddress` is bounded, sanitized operator evidence only. It is not
connect authority, need not be dialable, and cannot influence kernel behavior.
When present it contains one to 256 Unicode code points and no C0 or DEL
control character.
The adapter-specific composition API owns creation and distribution of target
configuration. AGP does not advertise transport references through route
exchange.

## 5. Common pseudotypes

### 5.1 Limits

```ts
interface TransportChannelLimits {
  readonly maxPacketBytes: number;
  readonly maxBufferedPackets: number;
  readonly maxBufferedBytes: number;
}

interface TransportListenerLimits {
  readonly maxPendingAcquisitions: number;
  readonly maxActiveChannels: number;
  readonly channel: TransportChannelLimits;
}

interface TransportListenOptions {
  readonly limits: TransportListenerLimits;
}

interface TransportAcquisitionOptions {
  readonly channel: TransportChannelLimits;
}
```

The injected implementation is an AGP transport, not a generic runtime
protocol multiplexer. It MUST complete its configured AGP binding before
channel commit. The neutral port exposes no selected protocol, binding token,
or runtime capability negotiation. A concrete binding may require a fixed
carrier token; another transport may require none. Neither fact enters this
interface.

Every numeric limit MUST be a positive safe integer.
`maxBufferedBytes` MUST be at least `maxPacketBytes`, so one maximum-size packet
can be admitted. These are decoded packet-channel limits; native encoded,
compressed, framed, or handshake limits are additional adapter-owned bounds.

### 5.2 Packets and reads

```ts
interface TransportPacket {
  readonly bytes: Readonly<Uint8Array>;
}

type TransportInputRejectionCode =
  | "PACKET_TOO_LARGE"
  | "MALFORMED_CARRIER_INPUT";

interface TransportInputRejected {
  readonly kind: "input-rejected";
  readonly code: TransportInputRejectionCode;
}

interface TransportDiagnostic {
  readonly code: string; // ^[A-Z][A-Z0-9_]{0,63}$
  readonly message?: string;
}

interface TransportDiagnosticSinkPort {
  emit(diagnostic: TransportDiagnostic, cause?: unknown): void;
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
  | TransportInputRejected
  | { readonly kind: "terminal"; readonly terminal: TransportTerminal };
```

Packet bytes are opaque to the transport. Every byte value, including a
zero-length sequence, is valid at this layer if it is within the configured
limit. The AGP codec, not the adapter, decides whether those bytes form valid
UTF-8, JSON, or an AGP message.

`MALFORMED_CARRIER_INPUT` means the remote carrier participant violated the
adapter's ability to materialize one packet boundary. It MUST NOT be used for an
AGP JSON, schema, version, or semantic failure.

`TransportDiagnostic.code` is one to 64 uppercase ASCII letters, digits, and
underscores, beginning with a letter. `message`, when present, is at most 256
Unicode code points after sanitization. Neither value may contain a credential,
native error dump, stack, or unbounded remote text. The terminal schemas encode
the discriminated unions above, so invalid origin/kind cross-products are
rejected structurally.

`TransportDiagnosticSinkPort` is the exact optional adapter-observation
capability exported by `@agp/transport`. It accepts only the sovereign
`TransportDiagnostic` record. Its optional `cause` argument is process-local
raw material, is not part of that record, and MUST NOT be serialized into a
terminal, operation error, operations snapshot, management response, protocol
packet, or another sink call. A production adapter construction API may accept
this capability as a dependency; it is not a channel/listener method and does
not grant the kernel access to native carrier state.

Emission occurs only after the adapter's owning disposition or terminal commit
is stable. Absence is an exact no-op. If the sink throws, the adapter catches
and suppresses the value, does not recursively emit, and preserves the original
operation result, terminal, resource accounting, and callback order. Adapters
MUST NOT use sink presence, return, failure, or side effects as protocol,
acquisition, liveness, retry, or resource-policy input.

### 5.3 Peer evidence

```ts
interface TransportPeerEvidence {
  readonly locality: "process-local" | "network";
  readonly protection:
    | "none"
    | "integrity"
    | "confidentiality-and-integrity";
  readonly authentication:
    | { readonly kind: "none" }
    | {
        readonly kind: "verified";
        readonly principal: string;
        readonly method: string;
      };
}
```

This is a closed sovereign record, not an extension dictionary. A later
evidence field or variant requires an explicit schema revision and admission
review. A verified `principal` is one to 256 Unicode code points with no C0/DEL
control, and `method` matches `^[a-z][a-z0-9._-]{0,63}$`. The canonical JSON
encoding of the complete evidence record is at most 1,024 UTF-8 bytes. The
semantic restrictions in §12 are mandatory.

### 5.4 Close and abort intents

```ts
interface TransportCloseIntent {
  readonly kind: "normal" | "node-stop" | "session-replaced" | "protocol-fatal";
  readonly code: string;
}

interface TransportAbortIntent {
  readonly kind: "deadline" | "capacity" | "invariant" | "forced-stop";
  readonly code: string;
}
```

`code` follows the same 64-character pattern as
`TransportDiagnostic.code`. It is bounded local diagnostic evidence. It is not
a carrier-native code and is never interpreted as an AGP wire notification.
The adapter owns any mapping to native termination.

### 5.5 Channel and listener capabilities

```ts
interface TransportChannelPort {
  readonly peerEvidence: TransportPeerEvidence;

  send(
    packet: TransportPacket,
    signal: AbortSignal,
  ): Promise<void>;

  read(signal: AbortSignal): Promise<TransportRead>;

  close(
    intent: TransportCloseIntent,
    signal: AbortSignal,
  ): Promise<TransportTerminal>;

  abort(intent: TransportAbortIntent): void;
}

interface TransportAcceptedChannel {
  readonly channel: TransportChannelPort;
}

interface TransportAcceptCallbacks {
  accept(value: TransportAcceptedChannel): void;
  capacityRejected(
    kind: "pending-acquisition" | "active-channel",
  ): void;
}

interface TransportListenerPort {
  readonly publication: TransportListenerPublication;
  waitTerminal(signal: AbortSignal): Promise<TransportListenerTerminal>;
  close(signal: AbortSignal): Promise<TransportListenerTerminal>;
  abort(intent: TransportAbortIntent): void;
}

```

These interfaces plus the resolver and bound acquisition capabilities in §4
are process-local capabilities. They are not JSON DTOs and do not acquire JSON
Schema documents. `TransportDiagnosticSinkPort` is likewise handwritten, but
every data value it accepts is the generated `TransportDiagnostic`.

## 6. Acquisition semantics

### 6.1 Listener acquisition

`listen()` has one commit point: successful creation of a listener capable of
enforcing its configured AGP binding and the supplied capacity bounds.

1. Before commit, cancellation rejects `listen()` with `OPERATION_ABORTED` and
   the adapter releases every partial resource.
2. After commit, `listen()` resolves exactly once with the listener. Later
   cancellation of the original signal has no effect on the listener.
3. The returned listener, not the original signal, owns the live listener
   lifetime.
4. A failed `listen()` MUST NOT later invoke `accept`.
5. The adapter MUST begin bounded packet admission for an accepted channel
   before invoking `accept`, so an early peer packet cannot be lost between
   carrier acquisition and node-controller construction.
6. One acquired channel is supplied to `accept` at most once.
7. `accept` is a synchronous ownership transfer. After it returns, the session
   controller owns the channel; closing the listener MUST NOT implicitly close
   already transferred channels.
8. If `accept` throws, ownership did not transfer. The adapter MUST catch the
   thrown value, abort that untransferred channel, and terminalize the listener
   under the callback-fault rule below. It MUST NOT invoke `accept` again for
   that channel.

Callback entry, acquisition disposition, and listener close/abort/terminal
commit are serialized by one per-listener gate. No second acquisition or
callback disposition may linearize while an acceptance callback is in flight.
The adapter MUST catch every callback throw at the invocation boundary; no
callback exception may escape into a native carrier callback, become an
unhandled promise rejection, or skip adapter cleanup.

Pending acquisition capacity is counted from the first carrier resource
reservation until rejection or channel commit. Active-channel capacity is
counted from channel commit until the adapter has released the channel's
physical resources after terminal commit. A capacity rejection:

- creates no channel;
- invokes `capacityRejected` exactly once;
- reveals no raw peer input; and
- when the callback returns normally, does not by itself fail the listener.

Before invoking `capacityRejected`, the adapter commits rejection of the
triggering acquisition, releases that attempt's common pending/active
reservations, and irreversibly detaches any remaining native cleanup from
acquisition authority. Detached cleanup is adapter-bounded, cannot produce a
channel or another callback, and must eventually release the native handle;
physical carrier closure need not complete before callback entry. Capacity
decision plus callback invocation is one gated disposition, so a later
rejection cannot commit while the callback is in flight.

Both acceptance callbacks have one closed callback-fault rule. If either
throws, the adapter MUST:

1. catch any thrown value synchronously and never retry or rethrow the callback;
2. for `accept`, abort the not-successfully-transferred channel and release its
   acquisition reservations while retaining active-channel accounting until
   physical terminal cleanup; for `capacityRejected`, preserve the
   already-committed no-channel rejection;
3. select stable code `ACCEPT_CALLBACK_FAILED` for `accept` or
   `CAPACITY_REJECTED_CALLBACK_FAILED` for `capacityRejected`;
4. while still holding the listener-disposition gate, prevent every later
   acquisition or callback commit, reject or release all remaining uncommitted
   acquisitions without capacity callbacks, and release listener-owned
   acquisition resources;
5. if no listener terminal has already committed, commit exactly
   `{ origin: "carrier", kind: "adapter-fault",
   diagnostic: { code: stableCallbackCode } }`; and
6. after the listener disposition is stable, invoke the configured
   `TransportDiagnosticSinkPort.emit({ code: stableCallbackCode },
   thrownValue)` exactly once; when no sink was injected, perform the defined
   no-op instead.

First-terminal-wins applies when the callback re-entrantly caused close, abort,
or another terminal before throwing: the existing terminal remains immutable,
the private callback diagnostic is still emitted once, and no replacement
terminal is invented. If callback fault wins, no later close or carrier outcome
can replace it. No callback message, stack, peer input, thrown object, or native
object enters the stable terminal.

`waitTerminal()` exposes the winning terminal to node lifecycle control, so an
acceptance callback fault while the node is `Running` fails the node rather than
existing only in logs. Channels transferred before the callback fault remain
owned by their session controllers and MUST NOT be closed by listener
terminalization.

### 6.2 Outbound acquisition

`connect()` has one commit point: transfer of a live channel that already
satisfies its configured AGP binding, packet limits, and peer-evidence
construction rules.

```text
bound capability invocation
→ carrier acquisition
→ configured AGP-binding compatibility
→ immutable peer evidence
→ bounded read admission active
→ channel commit
→ resolve connect()
```

Before channel commit, cancellation or failure that wins the adapter's
serialized acquisition-disposition race rejects `connect()` and no channel may
later escape with live authority through a callback or promise. A cancellation
notification does not win merely by occurring during a disposition callback
that already holds that gate; the adapter linearizes the callback's normal
return or throw before servicing the re-entrant notification. After channel
commit, the promise resolves with the channel; later cancellation of the
acquisition signal has no effect on that channel.

The adapter MUST NOT resolve early and ask the AGP node to inspect a
carrier-negotiation result. Binding compatibility is an acquisition
postcondition. `TransportOpened` and `TransportAccepted` therefore mean “a
conforming channel was committed,” not merely “a native connection exists.”
This postcondition covers every compatibility fact observable during
acquisition; it cannot prove that a peer will obey the binding on future input.
A later peer binding violation follows the ordered input-rejection and terminal
path in §9.4 and never enables a fallback mode.

### 6.3 Acquisition provenance

The node records acquisition separately:

```ts
type Acquisition =
  | { readonly kind: "dial"; readonly adjacencyId: string }
  | { readonly kind: "accept"; readonly listenerId: string };
```

The node maps a successful outbound `connect()` capability call to `dial`
provenance. That record controls reconnect ownership only. The channel does
not expose a direction property, and direction cannot grant protocol
authority.

The connect capability does not establish the remote AGP `nodeId`. Remote node
identity remains self-declared by OPEN and accepted only through the identity
admission contract using peer evidence.

## 7. Packet contract

### 7.1 Boundary preservation

For each channel:

1. one successful `send(P)` represents exactly one outbound packet;
2. one peer packet produces exactly one `read()` result with `kind: "packet"`;
3. bytes within a packet retain their exact value and order;
4. packet boundaries are never concatenated, split, or inferred by the node;
5. packet order is identical to send-acceptance order; and
6. the adapter never duplicates a packet.

A byte-stream carrier must add and validate its own bounded record framing. A
message-oriented carrier must map exactly one carrier record to one transport
packet. Those mechanics remain private to the adapter.

The adapter MUST provide the reader a stable byte snapshot. It may transfer an
exclusive buffer or copy bytes, but it MUST NOT mutate, reuse, detach, or
overwrite the buffer after returning it. The node treats received bytes as
immutable.

### 7.2 AGP mapping

The session layer applies this mapping:

```text
one packet
→ bounded UTF-8 decode
→ one complete JSON document
→ duplicate-member and structural preflight
→ AGP schema and semantic validation
→ one serialized FSM input
```

The reverse path is:

```text
one validated AGP message
→ canonical JSON serialization
→ one UTF-8 byte sequence
→ one send(packet)
```

No carrier adapter parses or constructs AGP envelopes.

## 8. Send acceptance and outbound backpressure

### 8.1 Exact acceptance point

`send(packet, signal)` resolves only when all of the following are true:

1. the packet passed the common byte limit;
2. the adapter captured an immutable snapshot of all bytes synchronously before
   returning the promise to the caller;
3. the complete packet entered the carrier's reliable ordered outbound
   sequence; and
4. a later send cannot overtake it.

Resolution means **transport send acceptance only**. It does not mean:

- the remote adapter received the packet;
- the remote AGP node read, parsed, admitted, routed, or handled it;
- a route update was acknowledged;
- an application handler completed;
- the packet is durable; or
- delivery remains possible after a later channel failure.

AGP's public `send()` receipt retains its separate local-admission meaning. The
session writer may admit work into its own bounded queue before the adapter
accepts that packet.

### 8.2 Ordering and concurrency

The AGP session writer owns outbound queueing and invokes at most one
`send()` at a time per channel. An adapter MUST NOT require an unbounded
secondary queue.

Overlapping `send()` calls are port misuse and fail with
`CONCURRENT_OPERATION`; an adapter need not invent an order from concurrent
JavaScript invocation. A close call and a send call also MUST NOT be initiated
concurrently by a conforming node.

If `send(A)` and then `send(B)` resolve, and both packets reach the remote
channel, the remote reads exactly `A` before `B`. A carrier may retransmit
internally to provide reliability, but that MUST NOT produce duplicate packet
records.

### 8.3 Cancellation race

Send cancellation has one linearized outcome:

| Race winner | Promise outcome | Packet outcome |
|---|---|---|
| Signal before send acceptance | Reject `OPERATION_ABORTED`, acceptance `not-accepted` | Packet MUST NOT later appear |
| Send acceptance before signal | Resolve | Packet remains accepted and cannot be retracted |
| Carrier fails before acceptance is knowable | Reject terminal send failure, acceptance `unknown`; channel fails | Node MUST NOT retry on that channel |

Some carrier libraries have a dispatch point after which bytes may become
visible but before their completion callback proves common send acceptance.
Cancellation before that dispatch may win as `OPERATION_ABORTED` with
`not-accepted`. Cancellation after dispatch but before the completion callback
MUST NOT claim non-acceptance: the adapter rejects `SEND_FAILED` with
`acceptance: "unknown"`, commits exactly
`{ origin: "carrier", kind: "io-failure",
diagnostic: { code: "SEND_FAILED" } }`, and makes the channel unusable. A later
native success, error, or close callback is cleanup evidence only and cannot
replace that terminal. The WebSocket binding applies this rule specifically to
the interval after `ws.send()` dispatch and before its callback.

The caller retains ownership of its input buffer and may mutate or reuse it as
soon as `send()` returns its promise. The adapter MUST therefore take its
complete immutable snapshot before returning control and MUST NOT later read,
retain, detach, or transfer the caller's buffer. A future explicit ownership
transfer API would be a separate contract.

### 8.4 Backpressure

`send()` MAY remain pending while bounded native capacity is unavailable. That
pending promise is the adapter's backpressure signal. The adapter MUST NOT
convert pressure into:

- an unbounded hidden queue;
- packet loss;
- packet reordering;
- a false successful acceptance; or
- an automatic AGP-level retry.

Every send is externally bounded by its signal. When the node's transport-write
deadline expires, the node classifies the operation as a timeout, aborts the
channel to eliminate an uncertain tail, and dispatches the existing
`TransportFailed` FSM event.

## 9. Pull reads and inbound backpressure

### 9.1 Single-consumer pull

`read(signal)` is a single-consumer pull operation. Exactly one read may be
outstanding per channel. A second overlapping read fails with
`CONCURRENT_OPERATION` and does not consume an item.

A successful read returns exactly one item. The adapter does not call an
unbounded push callback and does not run protocol code from a carrier callback.
The node places each returned item into its serialized session executor before
requesting or dispatching later semantic work.

### 9.2 Buffering

Carrier input may arrive while no read is pending. The adapter may buffer only
within both `maxBufferedPackets` and `maxBufferedBytes`.

The adapter MUST:

1. account a complete packet before exposing it;
2. preserve FIFO order;
3. pause or withhold native receive credit where the carrier permits;
4. reserve independent capacity for rejection and terminal evidence;
5. commit exactly
   `{ origin: "local", kind: "resource-exhausted",
   diagnostic: { code: "RECEIVE_OVERFLOW" } }` if safe bounded backpressure
   cannot prevent the next packet from exceeding a common limit; and
6. never drop an admitted packet to make space for another packet.

Bytes leave the ingress budget when ownership of the packet is committed to a
successful read result. Protocol processing and handler budgets are separate
AGP resources.

### 9.3 Read cancellation

Read cancellation cancels only that wait; it does not terminate the channel.
The race is:

| Race winner | Result |
|---|---|
| Signal before item commit | Reject `OPERATION_ABORTED`; the item remains available to the next read |
| Item commit before signal | Resolve with that item; cancellation cannot put it back |

The node may separately abort the channel during session teardown. A read
unblocked by that abort returns the channel's terminal record rather than
remaining pending.

### 9.4 Rejected input

An `input-rejected` result is ordered evidence that the adapter could not admit
one remote carrier record as a legal common packet. It is not terminal by
itself, so the existing FSM can distinguish remote invalid input from an
unprompted carrier failure. The adapter MUST nevertheless terminalize the
channel immediately:

```text
all earlier admitted packets
→ input-rejected
→ `{ origin: "remote", kind: "binding-violation",
     diagnostic: { code: inputRejection.code } }`
```

No packet may be admitted after `input-rejected`. The adapter may perform any
native rejection/teardown required by its binding, but native codes do not cross
this interface.

## 10. Lifecycle and terminal races

### 10.1 Listener lifecycle

```text
acquiring → listening → closing → closed
    └───────────────→ failed
```

`TransportListenerPort.waitTerminal(signal)` waits for the one immutable
listener-terminal record without owning the listener. Canceling that wait does
not close or alter the listener. Repeated waits after terminal commit resolve
with the same record. A terminal already committed before invocation wins over
an already-aborted signal; otherwise signal-before-terminal rejects
`OPERATION_ABORTED` and terminal-before-signal resolves.

`TransportListenerPort.close(signal)` first prevents new acquisition commits,
then cancels or rejects pending acquisitions, then releases listener resources
and resolves with the listener terminal. It is idempotent:

- closing an already terminal listener resolves with that same record;
- concurrent closes join one close operation;
- no `accept` callback begins after the close commit;
- a callback already transferring ownership may complete; and
- accepted channels remain owned by their session controllers.

Listener close has an exact cancellation race:

| Race winner | Result |
|---|---|
| Existing terminal before invocation | Resolve with that terminal; the signal is irrelevant |
| Signal before close-initiation commit | Reject `OPERATION_ABORTED`; listener remains live and owned |
| Close initiation before signal | Signal forces local abort; resolve with the resulting `aborted` terminal |
| Graceful or abnormal terminal before signal | Resolve with that terminal |

Concurrent close calls join the same close process. Once any call commits close
initiation, an abort from any joined call has listener-wide authority and every
waiter resolves with the same terminal. Listener `abort(intent)` is also
synchronous, idempotent, never throws, prevents later acquisition commits, and
commits `{ origin: "local", kind: "aborted" }` when no terminal already exists.
If an already-aborted signal wins before close initiation, the node immediately
calls `abort({ kind: "deadline", ... })`. The adapter cannot leave an unowned
half-closed listener.

An ordinary node-owned close commits
`{ origin: "local", kind: "graceful" }`. An unexpected carrier loss commits
the applicable non-graceful listener terminal and releases `waitTerminal()`.
No listener terminal can be reported only to a log: the node lifecycle
controller must observe it.

### 10.2 Channel lifecycle

```text
open ───────────────→ closing ───────────────→ terminal
  └──────────────────────────────────────────→ terminal
```

Exactly one immutable `TransportTerminal` outcome commits. Its `kind` tells the
session boundary whether completion was graceful or abnormal without exporting
a carrier-native close taxonomy.

`close(intent, signal)` begins graceful local release:

1. reject later sends with `CHANNEL_TERMINAL`;
2. place native graceful termination after every previously accepted packet;
3. wait for the carrier's bounded close completion; and
4. resolve with the one committed terminal record.

`close()` is idempotent. Concurrent closes join the same operation. A graceful
local close normally commits `{ origin: "local", kind: "graceful" }`. A
graceful remote close racing local close may instead commit
`{ origin: "remote", kind: "graceful" }`. If the adapter cannot prove graceful
completion, it commits a non-graceful terminal kind. The first close intent
that begins closing owns any native close mapping; later intents cannot replace
it.

Channel close has the same exact waiter race:

| Race winner | Result |
|---|---|
| Existing terminal before invocation | Resolve with that terminal; the signal is irrelevant |
| Signal before close-initiation commit | Reject `OPERATION_ABORTED`; channel remains open |
| Close initiation before signal | Signal forces local abort; resolve with the resulting `aborted` terminal |
| Graceful or abnormal terminal before signal | Resolve with that terminal |

Concurrent close calls join the one close process. Any joined signal that
aborts after close initiation has channel-wide abort authority; every waiter
resolves with the same immutable terminal. Thus a node-owned close deadline
produces an `aborted` terminal and `TransportFailed` without retaining the
channel indefinitely. If an already-aborted signal wins before close
initiation, the node immediately calls `abort({ kind: "deadline", ... })`.

### 10.3 Abort

`abort(intent)` is synchronous, idempotent local authority to make the channel
unusable and begin immediate carrier release. The intent is bounded local
diagnostic evidence, not a value placed on the AGP wire.

If no terminal outcome has committed, abort commits:

```ts
{
  origin: "local",
  kind: "aborted",
  diagnostic: { code: intent.code },
}
```

It:

- rejects pending and future sends;
- unblocks a pending read;
- prevents later packet admission;
- may discard native work not already accepted; and
- starts immediate release without waiting for graceful peer coordination.

If a terminal outcome already committed, abort has no semantic effect.
`abort()` MUST NOT throw. If the adapter later discovers that native release
failed after the `aborted` terminal committed, it reports a conformance fault
to the diagnostic sink; first-terminal-wins forbids replacing the committed
terminal with `adapter-fault`.

### 10.4 Terminal linearization

Native carriers commonly report overlapping error, end, close, cancellation,
and callback outcomes. The adapter MUST serialize them into one common terminal
commit.

Rules:

1. The first terminal transition linearized by the adapter wins.
2. A positively established graceful completion may commit `kind: "graceful"`.
3. An abnormal end, uncertain send tail, receive overflow, adapter fault, or
   local abort commits the applicable non-graceful terminal kind.
4. A later native close callback cannot replace an earlier non-graceful
   terminal outcome.
5. A later native error cannot replace an already proven graceful outcome.
6. Packets and rejection evidence admitted before terminal commit remain ahead
   of the terminal result in FIFO read order.
7. Nothing is admitted after terminal commit.
8. A pending read is always released.
9. After earlier FIFO items are consumed, every later `read()` returns the same
   immutable terminal outcome. It never hangs and never invents a second
   terminal event.
10. `send()` after terminal commit rejects `CHANNEL_TERMINAL`.

The session controller consumes the first terminal result and stops reading.
Stable repeated terminal reads exist to make the port total and race-safe, not
to dispatch repeated FSM events.

## 11. Limits and deadlines

### 11.1 Common resource bounds

| Resource | Owner | Required behavior |
|---|---|---|
| Decoded packet bytes | Transport options | Reject before common packet admission when `maxPacketBytes` would be exceeded |
| Buffered inbound packet count | Adapter under common limit | Pause/withhold credit or fail boundedly; never drop |
| Buffered inbound packet bytes | Adapter under common limit | Account exact byte lengths; never exceed |
| Pending inbound acquisitions | Listener under common limit | Reject before channel commit and report capacity once |
| Active accepted channels | Listener under common limit | Count through physical resource release |
| Outbound AGP work queue | Node session writer | Bounded by message count and bytes; adapter does not duplicate it |
| In-flight send snapshot | Adapter under `maxPacketBytes` | At most one per channel; capture synchronously before returning the promise and retain only until acceptance/rejection |
| Native encoded/framed input | Adapter | Apply a carrier-appropriate pre-materialization bound |
| Peer evidence | Adapter and identity boundary | Project a bounded sanitized immutable record |

An adapter MUST enforce common limits even when its carrier advertises a larger
native maximum. A smaller carrier maximum makes capability acquisition
incompatible and fails closed; the adapter cannot silently negotiate an AGP
packet limit different from the value later offered in OPEN.

### 11.2 Deadline ownership

Every potentially waiting capability call is externally cancellable:

| Operation | Deadline owner | Timeout consequence |
|---|---|---|
| `listen()` acquisition | Node start lifecycle | Start fails and partial listener resources are released |
| `connect()` acquisition | Adjacency supervisor | Current attempt fails; existing reconnect policy decides later action |
| `send()` | Session writer | Channel abort; `TransportFailed` |
| `read()` wait | Session/controller lifecycle | Wait cancellation only, unless session teardown separately aborts |
| Listener `waitTerminal()` | Node lifecycle | Wait cancellation only; listener lifetime is unchanged |
| Listener `close()` | Node stop lifecycle | Listener abort; stop records failure if cleanup cannot be proven |
| Channel `close()` | Session teardown | Channel abort; `TransportFailed` |

The node owns deadline values and supplies `AbortSignal`; the adapter does not
invent hidden AGP retry or session timers. An adapter may maintain stricter
native safety timers, but expiration maps to the same common failure taxonomy.

Unless `close()` or `waitTerminal()` can return an already committed terminal,
a signal already aborted at invocation rejects before side effects. For a
later signal, the operation-specific commit-point tables decide whether
acquisition, item/send acceptance, close initiation, terminal, or cancellation
wins.

Native carrier liveness cannot refresh the AGP hold timer or satisfy an AGP
keepalive obligation. It may only help the adapter detect a failed channel.

## 12. Peer evidence and identity admission

Peer evidence is the sole transport-to-identity-admission security projection.
It MUST be:

- constructed before channel acquisition commit;
- immutable for the channel lifetime;
- one valid instance of the closed neutral evidence schema;
- bounded in principal/method strings and encoded size;
- stripped of credentials, bearer material, private keys, raw native request
  objects, live certificate objects, socket handles, and mutable references;
- truthfully projected by the concrete adapter; and
- safe to pass to application-owned identity policy and sanitized diagnostics.

`authentication.kind: "none"` supplies no authenticated peer fact.
Process-local Loopback truthfully reports `locality: "process-local"` and
`protection: "none"`. Its explicit fabric may report a verified bounded
transport principal only when that principal is the name bound to a
fabric-issued capability actually used for acquisition. Such evidence does not
authenticate the remote OPEN `nodeId`, imply process isolation, or provide
cryptographic protection.
`authentication.kind: "verified"` is legal only when the adapter established
the bounded principal by the named method. Untrusted peer assertions never
enter the verified variant.

Peer evidence does not itself commit an AGP identity. Identity admission
receives:

```text
local node identity
+ remote OPEN node/session identity
+ configured expected remote node, when any
+ acquisition provenance
+ exact channel peer evidence
```

The identity-admission port owns the allow/deny decision. Static node
configuration MUST NOT replace, forge, or overwrite channel evidence.

Native peer addresses are diagnostic hints at most. They are not AGP identity,
session identity, adjacency identity, route identity, or authorization.

## 13. Error taxonomy

### 13.1 Stable operation errors

```ts
type TransportOperationErrorCode =
  | "REFERENCE_INVALID"
  | "BINDING_UNAVAILABLE"
  | "LISTEN_FAILED"
  | "CONNECT_FAILED"
  | "CAPACITY_EXCEEDED"
  | "PACKET_TOO_LARGE"
  | "CONCURRENT_OPERATION"
  | "CHANNEL_TERMINAL"
  | "OPERATION_ABORTED"
  | "SEND_FAILED"
  | "ADAPTER_FAULT";

interface TransportOperationError extends Error {
  readonly code: TransportOperationErrorCode;
  readonly phase:
    | "resolve-listener"
    | "resolve-target"
    | "listen"
    | "connect"
    | "send"
    | "read"
    | "close"
    | "wait-terminal";
  readonly acceptance?: "not-accepted" | "unknown";
  readonly cause?: unknown;
}
```

`acceptance` is present only when a failed send needs to distinguish a packet
known not to have entered the outbound sequence from an uncertain native
failure. The closed phase/code matrix is:

| Code | Permitted phase | Exact port-level consequence |
|---|---|---|
| `REFERENCE_INVALID` | resolve-listener, resolve-target | Synchronous failure; no capability or I/O |
| `BINDING_UNAVAILABLE` | listen, connect | Required configured binding could not be established; no listener/channel commit |
| `LISTEN_FAILED` | listen | No listener commit and every partial resource released |
| `CONNECT_FAILED` | connect | No channel commit and every partial resource released |
| `CAPACITY_EXCEEDED` | listen, connect | Local acquisition capacity denied before commit; inbound per-peer rejection instead uses `capacityRejected` |
| `PACKET_TOO_LARGE` | send | Rejected with `acceptance: "not-accepted"`; channel remains open |
| `CONCURRENT_OPERATION` | send, read, close | A second overlapping send/read of its own kind, or a close invoked while a send is in flight, is rejected; send carries `acceptance: "not-accepted"` and no packet/read item is consumed. Concurrent closes join, and send after close initiation is `CHANNEL_TERMINAL` |
| `CHANNEL_TERMINAL` | send | Rejected with `acceptance: "not-accepted"`; the channel is closing or terminal |
| `OPERATION_ABORTED` | listen, connect, send, read, close, wait-terminal | Cancellation won the operation-specific pre-commit race; send carries `acceptance: "not-accepted"` |
| `SEND_FAILED` | send | Carries acceptance `not-accepted` or `unknown` and commits `{ origin: "carrier", kind: "io-failure", diagnostic: { code: "SEND_FAILED" } }` |
| `ADAPTER_FAULT` | resolve-listener, resolve-target, listen, connect, send, read | No acquisition commit, or an acquired channel commits `carrier/adapter-fault` before rejection. In phase `send`, `acceptance` is required as `not-accepted` or `unknown`; every non-send phase omits it |

No other phase/code pairing is legal. `close()` after close-initiation commit
resolves with the terminal record even when native close fails; it does not
reject an invented close-failure code. `waitTerminal()` rejects only when its
signal wins. Resolver errors are synchronous; all other operation errors are
promise rejections.

AGP does not retry any failed packet on the same channel. A `SEND_FAILED`
terminalizes the channel whether acceptance is known false or unknown;
`acceptance` exists to make the packet outcome truthful, not to authorize
transport retry.

### 13.2 Stable terminal records

`TransportTerminal` from §5.2 is the sole channel-terminal data record.

| Kind | Meaning |
|---|---|
| `graceful` | The adapter positively established an orderly local or remote completion |
| `aborted` | The local owner exercised immediate abort authority |
| `io-failure` | Reliable input/output or its send-acceptance tail failed |
| `resource-exhausted` | A required bounded carrier/adapter resource could not be preserved |
| `binding-violation` | Carrier input or binding behavior could not form a legal common packet channel |
| `adapter-fault` | The adapter violated or could not continue its own invariant |

`origin` records where the adapter observed terminal authority:
`local`, `remote`, or `carrier`. It does not identify an AGP node and does not
authorize reconnect or routing policy. `diagnostic.code` is bounded,
adapter-projected evidence only; common protocol, FSM, and routing code MUST NOT
branch on it.

Native library errors may be retained privately for local diagnostics, but
their objects, classes, numeric codes, messages, or retry hints are not stable
common semantics and never enter `TransportTerminal`. Public operations and
logs MUST redact secrets and unbounded remote text. The process-local
`TransportOperationError.cause` is diagnostic-sink material and MUST NOT be
serialized into SDK, operations, management, or protocol records.

Timeout classification belongs to the caller that armed the deadline. The
adapter reports the aborted operation; the node records that its own deadline
expired and maps the result into the existing transport failure/FSM path.

No adapter error decides AGP reconnect policy. The existing adjacency
supervisor and FSM disposition table remain authoritative.

## 14. Mapping into the session FSM

The transport contract changes acquisition and I/O mechanics, not session
meaning. Acquisition maps as follows:

| Transport outcome | Existing semantic input |
|---|---|
| Resolver is missing/wrong-kind before node construction | Synchronous SDK `CONFIG_INVALID`; no FSM exists |
| Listener acquisition rejects before `Running` | SDK `TRANSPORT_FAILURE`; node start commits `Failed` after cleanup |
| Current outbound `connect()` attempt rejects or expires | `TransportFailed` in `Connect`; the adjacency supervisor applies its existing retry disposition |
| Outbound acquisition completion after stop/replacement invalidated its token | Discard as stale; no FSM input |
| Outbound channel acquisition commits | `TransportOpened` |
| Inbound channel ownership transfers | `TransportAccepted` |
| Listener reaches any terminal while `Running` outside node-owned stop | Node lifecycle `Failed`, then bounded node teardown |
| Listener terminal during node-owned stop | Teardown completion only; no new lifecycle transition |

Channel input maps as follows:

| Transport outcome | Existing semantic input |
|---|---|
| `read()` returns a packet that parses and validates | Corresponding AGP wire event |
| `read()` returns a packet whose UTF-8, JSON, schema, or protocol validation fails | `InvalidMessage`; protocol owns any safe notification before teardown |
| `read()` returns `input-rejected` | `TransportInputRejected` |
| `read()` returns terminal `kind: "graceful"` and no local release owns teardown | `TransportClosed` |
| `read()` returns any other terminal kind and no earlier cause owns teardown | `TransportFailed` |
| `read()` rejects `OPERATION_ABORTED` during controller teardown | Wait completion only |
| `read()` rejects `CONCURRENT_OPERATION` or `ADAPTER_FAULT` | Claim invariant failure, abort, and dispatch `TransportFailed` once |

Channel output maps by exact result:

| `send()` result | Session-controller action |
|---|---|
| Resolve | Emit the writer event associated with that exact packet; for a route snapshot this is `RouteUpdateWritten` |
| `SEND_FAILED` or `ADAPTER_FAULT` | Claim channel failure and dispatch `TransportFailed`; the required terminal/read completion is later evidence only |
| `CHANNEL_TERMINAL` | If no local release/earlier failure owns teardown, claim and dispatch `TransportFailed`; otherwise suppress |
| `OPERATION_ABORTED` because the node's transport-write deadline expired | Abort with `kind: "deadline"`, claim, and dispatch `TransportFailed` |
| `OPERATION_ABORTED` because established teardown canceled the writer | Completion only; the existing teardown cause remains authoritative |
| `PACKET_TOO_LARGE` or `CONCURRENT_OPERATION` | Node/adapter contract invariant failed; abort with `kind: "invariant"` and dispatch `TransportFailed` once |

Each exact session-controller incarnation owns a one-shot
**transport-disposition latch**. A retry allocates a fresh incarnation and
latch. The
first causal acquisition failure, input rejection, read terminal, terminalizing
send outcome, transport-write deadline, or administrative release claims it
before dispatching an FSM input or beginning `ReleaseTransport`. Every later
read terminal, close result, send rejection, native callback, or abort
completion may update bounded diagnostics/resource cleanup only; it cannot send
a second notification, purge routes twice, schedule retry twice, or dispatch a
second terminal FSM input.

`TransportInputRejected` claims the latch before it is dispatched and is fatal
under the existing FSM. Its required following binding-violation terminal
therefore completes channel mechanics without another semantic action. A
node-owned `ReleaseTransport` similarly claims an administrative disposition
before calling close/abort, so its local terminal never re-enters the FSM.

FSM state names, OPEN exchange, negotiated protocol limits, collision
resolution, route ownership, Adj-RIB lifecycle, keepalive/hold behavior,
forwarding, reverse errors, and reconnect disposition do not change.

One transport channel belongs to one exact session-controller incarnation.
Replacing a failed channel requires a fresh controller attempt and fresh local
session ID under the existing pair-scoped rules.

## 15. Forbidden carrier ownership

Concrete adapter packages may implement and expose native carrier options.
Common AGP packages MUST NOT expose, store as semantic state, or branch on:

- native URL schemes or address syntax;
- HTTP upgrade requests or headers;
- WebSocket subprotocol headers, text/binary frame tags, fragmentation,
  compression extensions, Ping/Pong, close codes, or close-reason byte limits;
- gRPC services, metadata, status codes, or message classes;
- QUIC connection IDs, stream IDs, application error codes, or migration
  handles;
- socket objects, native request/response objects, or carrier library classes;
- native TLS session/certificate objects or credentials;
- carrier-specific retry, discovery, congestion, or flow-control knobs; or
- a carrier's encoded/compressed byte count as the AGP decoded packet limit.

An adapter maps those private mechanics into bound capabilities, packet bytes,
peer evidence, capacity evidence, and the stable error taxonomy. Adding a new
adapter MUST NOT require changes to the AGP protocol schemas, session FSM,
routing engine, endpoint API, or common transport types.

## 16. Invariants

| ID | Invariant |
|---|---|
| T01 | One committed channel is reliable, ordered, bidirectional, and message-bounded. |
| T02 | The transport treats packet bytes as opaque; UTF-8, JSON, schema, and AGP semantics are owned above it. |
| T03 | One successful send is one packet in one total per-channel acceptance order. |
| T04 | Send acceptance is not remote delivery, handling, acknowledgement, or durability. |
| T05 | No admitted packet is split, concatenated, reordered, duplicated, or silently dropped. |
| T06 | Outbound and inbound buffering are bounded; pressure becomes waiting, native flow control, rejection, or a non-graceful terminal. |
| T07 | Exactly one read consumer and at most one send operation are active per channel. |
| T08 | Every asynchronous operation has one linearized commit-versus-cancellation outcome. |
| T09 | Exactly one immutable terminal outcome commits, releases pending reads, and dominates all later native callbacks. |
| T10 | Input-rejection evidence is ordered before its required non-graceful terminal record and admits no later packet. |
| T11 | Listener close stops acquisition but never steals already transferred channel ownership. |
| T12 | Acquisition resolves or accepts only after configured binding compatibility, peer evidence, limits, and bounded early-read admission are ready. |
| T13 | Logical transport references and bound acquisition capabilities cannot become AGP identity, routing state, or wire data. |
| T14 | Peer evidence is immutable, bounded, sanitized, and passed unchanged to identity admission. |
| T15 | Native carrier errors and teardown codes never become AGP protocol or FSM taxonomies. |
| T16 | Internal `Acquisition.kind` alone owns reconnect behavior; public `direction` is its fixed read-only projection and is never read back as channel or retry authority. |
| T17 | Native liveness cannot substitute for AGP keepalive or hold semantics. |
| T18 | A new reliable ordered carrier adapter composes without changing protocol, FSM, routing, or application messaging contracts. |
| T19 | Resolver calls are synchronous, deterministic, side-effect-free, and return capabilities already bound to their owning adapter authority. |
| T20 | Every committed listener has one observable terminal; an `accept` or `capacityRejected` callback throw is caught, cleaned up, and—unless an earlier terminal won—commits one observable `carrier/adapter-fault` terminal rather than escaping or existing only in a log. |
| T21 | One controller-incarnation disposition latch prevents duplicate FSM termination, purge, release, or retry from overlapping transport outcomes. |

Violation of any invariant fails the transport conformance gate. A topology test
cannot compensate for a transport adapter that loses, duplicates, reorders,
leaks native semantics, or leaves a terminal race ambiguous.

## 17. Non-goals

This contract deliberately does not define:

- unreliable, unordered, or datagram transport;
- multicast, broadcast, or pub/sub fan-out;
- durable queues, persistence, replay, offsets, or delivery acknowledgements;
- exactly-once application handling;
- cross-channel ordering or a node-wide total order;
- transparent session resumption after channel loss;
- automatic reconnect inside an accepted or connected channel;
- transport-layer retry of an AGP packet after an uncertain send;
- endpoint discovery, target-configuration distribution, or deployment topology;
- application authentication policy or authorization decisions;
- AGP JSON schema or structured application messaging protocols;
- multipath forwarding or parallel channels for one exact session;
- a zero-copy buffer-lifetime API;
- carrier selection or negotiation among multiple injected adapters; or
- public exposure of native carrier diagnostics.

Higher-level structured JSON protocols—RPC, pub/sub, queues, workflows,
persistence, or application acknowledgements—remain layered above AGP endpoint
delivery. They do not enter this carrier boundary.

## 18. Conformance obligations

A transport adapter is conforming only when executable tests prove at least:

1. listen and connect cancellation on both sides of acquisition commit;
2. early inbound packet retention before accepted-channel consumption begins;
3. exact packet byte/boundary preservation in both directions;
4. FIFO ordering across sustained bidirectional traffic;
5. no duplicate packet under native retransmission or callback recurrence;
6. send acceptance, abort-before-acceptance, and uncertain-failure outcomes;
7. bounded outbound backpressure with no hidden unbounded queue;
8. pull-read single-consumer enforcement and canceled-read retention;
9. count/byte receive bounds, native flow control, and deterministic overflow;
10. ordered input-rejection evidence followed by one non-graceful terminal;
11. channel graceful close, remote-close, error-close, abort, and simultaneous races;
12. exactly one terminal outcome despite repeated native callbacks;
13. prompt pending-read release and stable post-terminal reads;
14. listener capacity accounting, exactly-once rejection callbacks, and the
    exact cleanup/diagnostic/first-terminal-wins outcome for `Error` and
    non-`Error` throws from `accept` or either rejection-callback kind;
15. listener terminal observation, close/abort races, and independence from accepted channel lifetime;
16. immutable sanitized peer evidence reaching identity admission unchanged;
17. configured binding incompatibility failing before channel commit;
18. write, connect, listener-close, and channel-close deadline response;
19. native errors remaining private to adapter diagnostics, with an injected
    diagnostic sink receiving only the closed `TransportDiagnostic` plus its
    separate process-local cause and a throwing sink having no semantic,
    terminal, or accounting effect;
20. absence of carrier-specific imports or types in common AGP packages;
21. synchronous packet snapshot before caller-buffer mutation;
22. discriminated terminal origin/kind schemas rejecting impossible pairs;
23. exact operation phase/code legality and side effects; and
24. synchronous, deterministic, side-effect-free resolution to adapter-bound
    capabilities.

The node integration additionally proves that configured references are
resolved and captured once, listener terminals reach lifecycle control, exact
peer evidence reaches identity admission unchanged, and the
transport-disposition latch suppresses every duplicate send/read/close/abort
terminal race.

Real-carrier integration proves the binding. Deterministic in-memory channels
prove the common state/race contract. Both are required; one cannot substitute
for the other.

## 19. Mechanics, rationale, and consequence

### Mechanics

1. The embedding application supplies an adapter-owned resolver whose logical
   references yield bound acquisition capabilities.
2. The adapter commits only compatible, bounded channels with immutable peer
   evidence.
3. The node sends and pulls complete opaque byte packets under explicit
   deadlines.
4. The adapter linearizes native concurrency into ordered packet results and one
   terminal result.
5. The protocol/session layer converts packet bytes into AGP semantic events.
6. The existing FSM, routing, and application APIs operate without carrier
   knowledge.

### Rationale

A library dependency hidden behind an interface is not sufficient decoupling
when the interface still exposes that library's framing, addresses,
negotiation, compression, or close language. Bound capabilities plus a byte
packet channel define the smallest capability AGP actually requires. Explicit
commit points make backpressure, cancellation, and terminal races independently
testable across adapters.

### Consequence of violation

- Carrier-shaped common types force every future adapter to impersonate the
  first carrier.
- Ambiguous send resolution makes route-update ordering and failure handling
  unprovable.
- Push-only receive callbacks permit unbounded memory or hidden packet loss.
- Mutable or synthetic peer evidence can authorize the wrong remote identity.
- Multiple terminal outcomes can purge, retry, or release one session twice.
- Listener ownership of transferred channels makes node stop and session
  teardown race unpredictably.
- Native liveness substituted for AGP keepalive can preserve a carrier while
  protocol state is dead.
- Transport retry or persistence would silently change AGP's local-admission,
  ordering, and non-durable delivery contract.
