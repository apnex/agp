# AGP loopback transport

> **Status:** Normative production-adapter design.
>
> **Common contract:** [`transport-contract.md`](../transport-contract.md)
>
> **Target package:** `@agp/transport-loopback`

## 1. Purpose

The loopback transport is the canonical production implementation of the AGP ordered packet-channel contract for nodes in one JavaScript process.\
It is appropriate for embedded deployments, plugin hosts, components sharing one trusted JavaScript realm, local composition, and deterministic topology execution.

It is not a fake network hidden inside the node package.\
It is an explicit, injectable transport with production lifecycle, capacity, backpressure, evidence, and operations contracts.\
The AGP kernel interacts with it through the same `TransportChannelPort` and neutral listener/connect capabilities used by every other transport.

`@agp/transport-loopback` depends on `@agp/transport`; it MUST NOT import `@agp/protocol`, `@agp/core`, or `@agp/node`.

Loopback production support means that the adapter has defined behavior and is eligible for the common transport certification suite.\
It does not imply process isolation, cryptographic peer authentication, inter-process reachability, durability, or fault tolerance.

---

## 2. Explicit fabric

Every listener and connect attempt belongs to one explicit `LoopbackFabric` object:
```text
application composition root
        │
        └── LoopbackFabric "primary"
               ├── transport capability "alpha"
               ├── transport capability "beta"
               └── transport capability "gamma"
```

There is no module-global listener registry, default fabric, environment-derived namespace, or implicit cross-test bus.\
Possession of the fabric capability is required to create a transport or bind an acquisition capability.

Two fabrics with the same textual `fabricId` are still isolated objects.\
Neither can connect to a listener registered in the other.\
This prevents accidental communication across application instances and makes ownership and cleanup unambiguous.

Transport creation atomically reserves a unique `transportName` for the fabric lifetime.\
A duplicate fails without replacing the incumbent, and a returned transport capability cannot rename itself.

The fabric owns:

- listener-address uniqueness;
- pending-acquisition and active-channel capacity;
- fabric-wide queued packet and byte reservations;
- asynchronous delivery scheduling;
- transport-instance identities;
- canonical operational state; and
- terminal cleanup of listeners, channels, and pending work.

---

## 3. Addressing and configuration

### 3.1 References and display addresses

The canonical sanitized display form is:
```text
loopback://<fabric-id>/<listener-name>
```

`fabric-id`, `transport-name`, and each slash-separated listener-address segment match `^[a-z0-9][a-z0-9._-]{0,62}$`.\
The complete external display form is at most 253 UTF-8 bytes.\
Comparison is exact after syntax validation.\
There is no wildcard, relative name, port, query, fragment, username, password, case folding, DNS, or path traversal.

Adapter-owned data configuration uses:
```ts
type LoopbackFabricId = string;
type LoopbackTransportName = string;
type LoopbackAddress = string;

interface LoopbackListenerConfig {
  readonly fabricId: LoopbackFabricId;
  readonly address: LoopbackAddress;
}

interface LoopbackTargetConfig {
  readonly fabricId: LoopbackFabricId;
  readonly address: LoopbackAddress;
}
```

These aliases and records are generated from the common and configuration schemas cataloged in section 10.1.\
The adapter validates that data and compiles it into listener or target capabilities already bound to the exact fabric, transport, and address.\
The embedding application assigns each binding a bounded logical `TransportRef` from core topology configuration.\
The resulting `PeerTransportPort` resolves that string synchronously to an opaque `TransportListenCapability` or `TransportConnectCapability`.\
The node captures and invokes the capability but cannot inspect, reconstruct, compare, or serialize its adapter-private fields.

Only a resolver port composed for the exact fabric object can return a capability bound to that fabric.\
Another port may use the same logical `TransportRef`, but no returned capability can resolve across fabric objects.\
The `fabricId` is useful bounded display evidence and typo detection; it is not a global discovery namespace.\
Loopback has no carrier binding token, subprotocol, or runtime protocol negotiation.

Listener registration is atomic.\
Registering an already-live address fails without replacing the incumbent.\
Closing a listener removes its address before close completion, so no new connection can enter a closing listener.\
A later listener may reuse the address but receives a new listener identity.

Listener publication contains only the sanitized `displayAddress`.\
Adapter-specific composition creates target bindings and assigns their logical references separately.\
Neither is an AGP node, session, adjacency, or route identity.

### 3.2 Fabric limits

All capacity is explicit and finite:
```ts
interface LoopbackFabricLimits {
  readonly maxTransports: number;
  readonly maxListeners: number;
  readonly maxPendingAcquisitions: number;
  readonly maxActiveChannels: number;
  readonly maxPacketBytes: number;
  readonly maxBufferedPacketsPerChannel: number;
  readonly maxBufferedBytesPerChannel: number;
  readonly maxQueuedPacketsTotal: number;
  readonly maxQueuedBytesTotal: number;
  readonly maxPendingSendBytesTotal: number;
}

interface LoopbackFabricConfig {
  readonly fabricId: LoopbackFabricId;
  readonly limits: LoopbackFabricLimits;
}

interface LoopbackTransportConfig {
  readonly transportName: LoopbackTransportName;
  readonly capabilities: {
    readonly listen: boolean;
    readonly connect: boolean;
  };
}
```

Values are positive safe integers.\
Per-channel limits may be lower than fabric limits but never higher.\
Construction rejects internally impossible combinations.\
Limits are effective resource ceilings, not advisory metrics.\
Because every conforming endpoint may have one send in flight and must snapshot before returning its promise, `maxPendingSendBytesTotal` MUST be at least `2 * maxActiveChannels * maxPacketBytes`; overflow of that safe-integer calculation rejects construction.

An application may use one fabric for many AGP nodes.\
A node may receive a transport capability that can listen, connect, or do both.\
Capability availability is fixed at construction and is validated against configured node acquisition needs before node start.

---

## 4. Production API sketch

The package exposes a fabric and adapter-owned configuration, while returning only neutral transport ports to the node:
```ts
declare function createLoopbackFabric(
  config: LoopbackFabricConfig,
  dependencies?: LoopbackFabricDependencies,
): LoopbackFabric;

interface LoopbackFabricDependencies {
  readonly diagnostics?: TransportDiagnosticSinkPort;
}

interface LoopbackFabric {
  readonly fabricId: LoopbackFabricId;

  createTransport(
    config: LoopbackTransportConfig,
  ): LoopbackTransportBuilder;

  snapshot(): LoopbackFabricSnapshot;
  close(signal: AbortSignal): Promise<void>;
}

interface LoopbackTransportBuilder {
  readonly transportName: LoopbackTransportName;

  createPort(options: {
    readonly listeners: ReadonlyMap<
      TransportRef,
      LoopbackListenerConfig
    >;
    readonly targets: ReadonlyMap<
      TransportRef,
      LoopbackTargetConfig
    >;
  }): PeerTransportPort;
}
```

`LoopbackFabricDependencies` contains process-local capabilities, not data configuration.\
Its optional diagnostic sink is the exact `TransportDiagnosticSinkPort` from `@agp/transport`; the fabric supplies only the closed generated `TransportDiagnostic` record and may supply a raw thrown value only as the separate `cause` argument.\
Absence is the defined no-op.\
A sink throw is caught and suppressed without recursive emission or any change to scheduler order, promise results, terminal selection, counters, gauges, or fabric lifecycle.

`createPort()` validates and snapshots both maps before returning.\
It rejects a fabric mismatch, duplicate logical binding, malformed adapter configuration, or a listener/target entry forbidden by the builder's declared capabilities.\
Resolver calls are synchronous, side-effect-free, and return the same exact bound capability for the port lifetime; listener registration and connection work begin only when that capability is invoked.

Representative composition is explicit:
```ts
const fabric = createLoopbackFabric({
  fabricId: "orders-runtime",
  limits,
});

const hubTransport = fabric.createTransport({
  transportName: "hub",
  capabilities: { listen: true, connect: true },
});

const workerTransport = fabric.createTransport({
  transportName: "worker-a",
  capabilities: { listen: false, connect: true },
});

const hubPort = hubTransport.createPort({
  listeners: new Map([
    ["hub.listen", {
      fabricId: "orders-runtime",
      address: "hub",
    }],
  ]),
  targets: new Map(),
});

const workerPort = workerTransport.createPort({
  listeners: new Map(),
  targets: new Map([
    ["worker-a.to-hub", {
      fabricId: "orders-runtime",
      address: "hub",
    }],
  ]),
});
```

The application supplies the corresponding scoped `PeerTransportPort` when composing each node.\
`createNode()` resolves its configured `TransportRef` strings once and retains the resulting bound capabilities.\
No node receives the fabric registry itself.

---

## 5. Connect and accept

A connect performs this ordered transaction:

1. validate the invoked bound capability and exact fabric ownership;
2. reject if the fabric, connecting transport, or target listener is closing;
3. reserve one pending-acquisition slot;
4. resolve the listener and check its acquisition/channel capacity;
5. reserve one active-channel slot;
6. construct a pair of independent channel endpoints and their bounded queues;
7. install terminal and receive handling on both endpoints;
8. enqueue accepted-channel callback delivery asynchronously;
9. if and only if `accept()` returns normally, commit transfer of the accepted
   endpoint, settle `connect()` with the outbound endpoint, and commit the
   active channel; and
10. release the pending-acquisition reservation after either disposition.

The accepted and connected endpoints are two views of one logical full-duplex channel.\
Both are completely initialized before either is exposed.\
A packet sent immediately after connect settlement cannot outrun accepted-side bounded read admission.

The adapter never invokes an acceptance callback synchronously inside `connect()`.\
Both `accept()` and `capacityRejected()` cross at least one scheduler turn and enter one serialized listener-disposition gate.\
A pending `read()` always settles through the promise job queue, so application code cannot enter another node's kernel re-entrantly through a send call.

The same gate serializes the connecting signal's cancellation disposition.\
If cancellation commits before `accept()` entry, it aborts both partial endpoints, rejects `connect()` with `OPERATION_ABORTED`, releases the acquisition, and suppresses the queued callback.\
Once `accept()` entry wins, it holds the gate: a signal aborted re-entrantly or concurrently during that callback is recorded but cannot commit first.\
Normal callback return commits both endpoint transfers and settles `connect()` before the queued cancellation is observed; a throw commits the callback-fault rejection below.\
In either case that later cancellation has no lifecycle effect.\
Thus callback-entry/cancellation ordering has one explicit winner and no live endpoint can escape a failed connect.

For capacity rejection, the fabric releases the triggering acquisition and all of its reservations before invoking `capacityRejected(kind)` exactly once.\
If that callback throws, the source `connect()` still rejects without receiving a channel.\
`connect()` never resolves before the paired `accept()` returns normally.\
If `accept()` throws, the fabric catches it, aborts both not-successfully-transferred endpoints, rejects `connect()` with `ADAPTER_FAULT`, and releases the acquisition reservation; no channel commit occurred.

Either callback throw is caught inside the listener scheduler and selects stable code `ACCEPT_CALLBACK_FAILED` or `CAPACITY_REJECTED_CALLBACK_FAILED`, respectively.\
Unless a re-entrant close, abort, or failure already committed the listener terminal, the callback fault commits `{ origin: "carrier", kind: "adapter-fault", diagnostic: { code: stableCallbackCode } }`.\
After the first-terminal disposition is stable, the fabric invokes `TransportDiagnosticSinkPort.emit({ code: stableCallbackCode }, thrownValue)` exactly once; absence uses the defined no-op.\
The thrown value remains only the separate process-local cause.\
First-terminal-wins, no exception escapes the scheduler, and no later acceptance callback begins for that listener.\
Other listeners and channels from earlier successful acquisitions remain usable and session-owned.

Acquisition direction is supplied separately to the node supervisor.\
It is not authority embedded in `TransportChannelPort`; after acquisition both endpoints have identical full-duplex packet capabilities.

Before channel commit, the fabric retains authority to reject or release the partial acquisition.\
The accept callback or successful connect transfers each committed channel endpoint to its session controller.\
After that transfer:

- the fabric retains only the private authority needed to deliver bytes,
  enforce bounds, publish transport operations, and release physical resources
  after terminal commit;
- listener close stops future acquisitions but cannot close a transferred
  endpoint; and
- fabric administrative close stops acquisition and waits for session owners;
  it cannot synthesize a session close or steal channel authority.

---

## 6. Asynchronous byte-copy delivery

Loopback models a transport boundary rather than sharing values:

1. `send(packet, signal)` checks `packet.bytes.byteLength`;
2. it synchronously captures an independent immutable byte snapshot within
   bounded pending-send capacity before returning the promise;
3. it waits until receiver-channel and fabric-wide count/byte capacity can be
   reserved atomically;
4. it transfers the private snapshot into a transport-owned packet record;
5. it enqueues that record on the peer direction in send-acceptance order;
6. a pending or later `read(signal)` resolves with one stable
   `TransportPacket`; and
7. committing that read result releases its ingress queue reservations.

The receiver never observes a sender-owned `Buffer`, `Uint8Array`, or mutable application reference.\
Sending a JSON value or string through an out-of-band shortcut is forbidden.\
The adapter treats every byte as opaque and performs no UTF-8 decode, UTF-8 encode, JSON parse, JSON clone, or AGP interpretation.

Delivery is asynchronous even when the peer is already waiting.\
Promise continuations, listener acceptance, read settlement, close observation, and failure observation never run inline on the initiating call stack.

Each direction has an independent FIFO.\
Full duplex does not impose an ordering between opposite directions, but within one direction every successfully accepted packet is returned once, without adapter duplication, and in order while the channel remains live.\
A terminal race retains the neutral contract's explicitly unknowable-delivery boundary.

`send` fulfils when the immutable byte snapshot and all queue reservations have committed at the peer's ordered acceptance point.\
It does not wait for the peer kernel to read, parse, admit, route, or process the packet.

---

## 7. Bounds and backpressure

Send first copies within the bounded pending-send budget.\
Admission to the ordered peer queue then succeeds only if all applicable reservations can commit atomically:

- maximum packet bytes;
- receiver per-channel buffered packets;
- receiver per-channel buffered bytes;
- fabric-total queued packets; and
- fabric-total queued bytes.

If the packet itself exceeds `maxPacketBytes`, the send rejects before admission.\
If temporary queue capacity is unavailable, the single in-flight send remains pending in FIFO backpressure order until capacity is released, the signal is cancelled, or the channel terminates.

A channel retains at most one pending sender per direction because overlapping sends are `CONCURRENT_OPERATION` port misuse.\
Its private snapshot is at most `maxPacketBytes`, is counted against `maxPendingSendBytesTotal`, and consumes no peer ingress reservation until it can commit.\
The adapter never reads the caller's byte view again after capturing that snapshot.

Capacity release wakes pending writers fairly in FIFO order.\
A large packet must not be starved indefinitely by later small packets on the same direction.\
Fabric-wide arbitration is deterministic by pending sequence, not by object iteration or event-loop timing.

Cancellation before admission rejects without delivering the packet.\
Cancellation after admission cannot revoke it.\
Loopback's atomic in-memory commit cannot have an uncertain acceptance tail.\
Losing that boundary is an adapter invariant failure and commits a carrier-origin `adapter-fault` terminal with diagnostic code `ADAPTER_FAULT`; it never guesses or permits a later packet to overtake.

Loopback never:

- drops a packet to relieve pressure;
- reports success before reservation and copying;
- grows an unbounded read or pending-write queue;
- bypasses backpressure because sender and receiver share a process; or
- holds an ingress queue reservation after read-result commit.

`read(signal)` is single-consumer with at most one outstanding call.\
Cancelling a read before item commit leaves the next FIFO item available; cancelling after commit cannot put it back.\
If safe bounded backpressure cannot prevent the next packet from exceeding a receive limit, the channel commits a local terminal with `kind: "resource-exhausted"` and diagnostic code `RECEIVE_OVERFLOW`.\
It never silently drops an admitted packet.

Loopback has no independently encoded remote carrier record, so a conforming fabric does not produce `input-rejected`.\
An oversized local send rejects `PACKET_TOO_LARGE` before acceptance.\
Corrupt internal record structure is an adapter invariant failure and commits a terminal with `kind: "adapter-fault"`; it is not misreported as hostile peer input.

---

## 8. Lifecycle

The fabric lifecycle is:
```text
Created -> Running -> Closing -> Closed
             └──────────────-> Failed
                       └────-> Failed
```

The listener lifecycle is:
```text
Listening -> Closing -> Terminal
    └──────────────-> Terminal
```

The channel lifecycle is:
```text
Open -> Closing -> Terminal
  └────────────-> Terminal
```

`Closed` and `Failed` are terminal.\
A failed fabric is never restarted.\
Creation commits `Running`; there is no implicit lazy global startup.

Each listener commits exactly one immutable `TransportListenerTerminal`.\
`waitTerminal(signal)` observes that record without owning the listener.\
Cancelling a wait has no lifecycle effect, and every wait after terminal commit resolves with the same record.\
A terminal already committed before invocation wins even over an already-aborted signal; otherwise signal-before-terminal rejects `OPERATION_ABORTED` and terminal-before-signal resolves.

`TransportListenerPort.close(signal)` first unregisters its address, then rejects pending acquisitions, then releases listener-owned resources and normally resolves with `{ origin: "local", kind: "graceful" }`.\
Concurrent closes join that operation, and a close after terminal commit returns the same record.\
It MUST NOT close or abort channels whose ownership was already transferred to session controllers.\
Listener closure removes its address from the fabric's live registry.\
The readonly `publication` record remains an unchanged, non-authoritative snapshot.\
Previously resolved connect capabilities remain opaque values, but a subsequent `connect()` fails because no listener owns the address.

If cancellation wins before close initiation, `close()` rejects `OPERATION_ABORTED` and the listener remains live and owned.\
Once close initiation wins, later cancellation forces a local `aborted` terminal and all joined close calls resolve with that same record.\
Explicit `abort(intent)` is synchronous, idempotent, and non-throwing with respect to committing `{ origin: "local", kind: "aborted", diagnostic: { code: intent.code } }`.\
Unexpected fabric registry, scheduling, resource, or adapter-invariant failure commits a carrier-origin `io-failure`, `resource-exhausted`, or `adapter-fault` listener terminal as applicable.\
Rejecting one acquisition through a normally returning `capacityRejected()` does not terminate an otherwise healthy listener; either thrown acceptance callback follows the exact fail-closed terminal path in section 5.

The node lifecycle continuously observes each listener's `waitTerminal()`.\
Any unexpected listener terminal while the node is `Running` fails the node lifecycle; the adapter cannot report it only through logs or fabric operations.

`TransportChannelPort.close(intent, signal)`:

1. stops new local sends;
2. preserves packets accepted before close;
3. begins orderly peer completion after every packet already accepted;
4. commits one exact immutable `TransportTerminal` per endpoint;
5. releases resources as the ordered results commit; and
6. resolves with the winning terminal after local terminal cleanup.

The first close intent owns terminal diagnostic mapping.\
A normal local completion is:
```ts
{
  origin: "local",
  kind: "graceful",
  diagnostic: { code: intent.code },
}
```

A graceful remote close may win the race with `{ origin: "remote", kind: "graceful" }`.

An existing terminal resolves `close()` even for an already-aborted signal.\
A signal that wins before close initiation rejects `OPERATION_ABORTED` and leaves the channel open.\
Once close initiation wins, later cancellation forces a local `aborted` terminal, triggers immediate peer release, and makes every joined close call resolve with the same terminal.

`abort(intent)` is synchronous with respect to committing a local terminal with `kind: "aborted"` and `diagnostic.code: intent.code`, and asynchronous with respect to peer observation.\
It is idempotent, rejects pending writes, prevents later admission, and places the terminal result after packets and rejection evidence already admitted to either read FIFO.\
It may discard only work that had not crossed send acceptance and MUST NOT throw.\
The peer observes the same physical break as `{ origin: "remote", kind: "io-failure", diagnostic: { code: "PEER_ABORTED" } }`.\
Because `intent.code` is local diagnostic evidence, it MUST NOT be copied into the peer endpoint.

Competing local close, peer close, abort, signal cancellation, and I/O failure commit one immutable `TransportTerminal`.\
After earlier FIFO items are read, every current or later `read()` returns that same endpoint terminal outcome.\
Nothing is admitted after terminal commit.\
Fabric closure does not participate in this race after channel ownership has transferred.

`LoopbackFabric.close(signal)` prevents new transports, listeners, and connections; rejects uncommitted acquisitions; begins graceful close of every listener; and waits for owners of already transferred channels to close or abort them.\
A completed fabric-initiated listener close produces the same local graceful listener terminal as `TransportListenerPort.close()`.\
The fabric uses fabric-owned listener-close operations; cancellation of one caller's fabric wait does not convert those listener terminals to `aborted`.\
The fabric MUST NOT exercise channel-close authority on behalf of a session controller.

The embedding application stops its nodes before closing the fabric.\
A fabric-initiated listener terminal while an owning node is still `Running` is unexpected and therefore fails that node lifecycle.\
If the fabric-close signal is already aborted before fabric-close initiation, the call rejects `OPERATION_ABORTED` and the fabric remains `Running`.\
Once initiation commits `Closing`, a later signal rejects only that caller's wait with `OPERATION_ABORTED`; listener cleanup continues, the fabric remains bounded in `Closing`, and no accepted channel is aborted or packet discarded to manufacture successful cleanup.\
Concurrent and later close calls join the same fabric operation.\
When all listeners are terminal and channel owners have completed teardown, the fabric commits `Closed`; every still-waiting close resolves, and every later close resolves immediately.

### 8.1 Finite monotonic domains

Fabric revision, every public counter, and the private FIFO arbitration sequence are separate unsigned 64-bit domains with maximum `18446744073709551615`.\
Public revisions and counters use canonical decimal strings matching `^(0|[1-9][0-9]{0,19})$`; exact range and arithmetic are semantic rules and never use JavaScript `Number`.\
The fabric revision reserves the maximum value as a terminal barrier, so ordinary visible mutations commit only through `18446744073709551614`.

Before an acquisition or visible mutation, the fabric preflights its revision increment, exact counter deltas, and arbitration allocation as applicable.\
If any value would exceed its domain, or an ordinary mutation would consume the reserved revision, the originating operation is not committed.\
Instead, one serialized transaction:

1. sets fabric state to `Failed` with a sovereign
   `MONOTONIC_DOMAIN_EXHAUSTED` record naming `revision`, `counter`, or
   `arbitration-sequence` and, only for `counter`, the exact closed counter key;
2. unregisters listeners, rejects pending acquisitions, and commits
   carrier-origin `adapter-fault` terminals with diagnostic code
   `MONOTONIC_DOMAIN_EXHAUSTED` for every listener/channel endpoint that does
   not already have a terminal;
3. clears packet FIFOs, rejects pending sends, and releases every logical
   reservation so the final resource gauges and row occupancies are zero;
4. advances the fabric revision exactly once and changes no counter; and
5. freezes the complete bounded public snapshot.

The failure revision is the exact successor and is the reserved maximum when revision capacity caused the failure.\
A directly triggering operation rejects `ADAPTER_FAULT`; a triggering send is known `not-accepted`.\
Already committed terminal records retain first-terminal-wins authority.\
Callback/promise settlement and physical resource cleanup continue asynchronously from the frozen logical state, but cannot cause another snapshot revision or counter change.

`close(signal)` on a failed fabric is only a waiter for that private cleanup.\
Cancellation rejects that caller's wait without changing the fabric; after cleanup, current and later callers resolve while `snapshot()` remains the same immutable `Failed` record.\
This is `LOOPBACK-MONOTONIC-EXHAUSTION-1`.

Every channel or listener diagnostic exported by loopback has exactly the closed `TransportDiagnostic` shape: a bounded stable `code` and, only when useful, a bounded sanitized `message`.\
Raw `Error` objects, packet bytes, mutable capabilities, stack traces, and adapter-private fields never cross the common port.

---

## 9. Peer evidence and trust

Each channel carries immutable `TransportPeerEvidence` issued by the fabric:
```ts
{
  locality: "process-local",
  protection: "none",
  authentication: {
    kind: "verified",
    method: "same-process-capability",
    principal: "worker-a"
  }
}
```

The verified principal means only that the remote endpoint was created by the same explicit fabric and held the scoped transport capability with that fabric-issued name.\
`protection: "none"` records that shared-address-space delivery supplies neither cryptographic protection nor process isolation.\
The evidence is not a claim of operating-system identity or resistance to other code already executing in the process.

Use of the closed `authentication.kind: "verified"` variant is intentional: the fabric authenticates possession of the named, fabric-issued transport capability by the `same-process-capability` method.\
It does not authenticate the remote AGP `nodeId`.

Fabric and transport names remain adapter-owned bounded operational evidence.\
They cannot extend or overwrite the closed common `TransportPeerEvidence` record.

AGP `nodeId` remains a protocol claim.\
Identity admission decides whether the claimed node is permitted for the fabric-attested remote transport.\
A remote transport name or listener address is never silently promoted to an AGP node identity.

---

## 10. Operational state

### 10.1 Owned schema catalog

All public Loopback configuration and operational records are schema-generated from this package-owned catalog:
```text
packages/transport-loopback/src/schemas/v1/
  common/
    fabric-id.schema.json
    loopback-address.schema.json
    transport-name.schema.json
    fabric-revision.schema.json
    counter-value.schema.json
  codes/
    fabric-failure-code.schema.json
    monotonic-domain.schema.json
    counter-key.schema.json
  configuration/
    limits.schema.json
    fabric.schema.json
    transport.schema.json
    listener.schema.json
    target.schema.json
  operations/
    fabric-snapshot.schema.json
    fabric-failure-snapshot.schema.json
    listener-snapshot.schema.json
    channel-snapshot.schema.json
    resources-snapshot.schema.json
    counters-snapshot.schema.json
  catalog.json
```

The root schema catalog references these documents; it does not redefine them.\
Live fabric, resolver, acquisition, listener, and channel capabilities remain handwritten process-local interfaces because they contain functions and authority rather than JSON data.

### 10.2 Snapshot records

The adapter exposes a read-only canonical fabric snapshot for application diagnostics.\
Aggregate fields reference named closed records rather than defining anonymous fragments:
```ts
interface LoopbackListenerSnapshot {
  readonly listenerId: string;
  readonly address: LoopbackAddress;
  readonly state: "Listening" | "Closing" | "Terminal";
  readonly terminal?: TransportListenerTerminal;
  readonly activeChannels: number;
}

interface LoopbackChannelSnapshot {
  readonly channelId: string;
  readonly leftTransport: LoopbackTransportName;
  readonly rightTransport: LoopbackTransportName;
  readonly state: "Open" | "Closing" | "Terminal";
  readonly leftTerminal?: TransportTerminal;
  readonly rightTerminal?: TransportTerminal;
  readonly queuedPacketsLeft: number;
  readonly queuedBytesLeft: number;
  readonly queuedPacketsRight: number;
  readonly queuedBytesRight: number;
}

interface LoopbackResourcesSnapshot {
  readonly pendingAcquisitions: number;
  readonly activeChannels: number;
  readonly pendingSendBytes: number;
  readonly queuedPackets: number;
  readonly queuedBytes: number;
}

interface LoopbackCountersSnapshot {
  readonly connectionsAccepted: string;
  readonly connectionsRejected: string;
  readonly packetsAcceptedLeftToRight: string;
  readonly bytesAcceptedLeftToRight: string;
  readonly packetsAcceptedRightToLeft: string;
  readonly bytesAcceptedRightToLeft: string;
  readonly backpressureActivations: string;
  readonly gracefulChannelCloses: string;
  readonly forcedChannelAborts: string;
  readonly adapterInvariantFaults: string;
}

type LoopbackFabricFailureSnapshot =
  | {
      readonly code: "ADAPTER_FAULT";
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "revision" | "arbitration-sequence";
    }
  | {
      readonly code: "MONOTONIC_DOMAIN_EXHAUSTED";
      readonly domain: "counter";
      readonly counterKey: LoopbackCounterKey;
    };

interface LoopbackFabricSnapshot {
  readonly fabricId: LoopbackFabricId;
  readonly state: "Running" | "Closing" | "Closed" | "Failed";
  readonly revision: string;
  readonly failure?: LoopbackFabricFailureSnapshot;
  readonly listeners: readonly LoopbackListenerSnapshot[];
  readonly channels: readonly LoopbackChannelSnapshot[];
  readonly resources: LoopbackResourcesSnapshot;
  readonly counters: LoopbackCountersSnapshot;
}
```

Every operations schema above is closed and rejects additional properties.\
Identifiers, arrays, counts, byte gauges, terminal records, and the total encoded snapshot size are bounded by their owning schemas.\
`failure` is required exactly when fabric state is `Failed` and is absent for `Running`, `Closing`, and `Closed`.

Listener/channel rows are live resource records, not historical tombstones.\
A listener row exists from registration through physical listener-resource release; a channel row exists from channel commit through release of both endpoint resources.\
Terminal commit and subsequent row removal are separate canonical revisions, so a query may observe `Terminal`, but no consumer may rely on polling fast enough to do so.\
After removal, counters-and AGP's separate `session.closed` event where applicable-are the retained evidence.\
The arrays therefore never accumulate historical sessions: their configured limits are the same resources counted until physical release, and their schemas also impose absolute array/encoded-size maxima.\
This is `LOOPBACK-SNAPSHOT-RETENTION-1`.

The one exception is a `Failed` fabric: it freezes the bounded set of listener/channel rows that existed at the failure transaction as terminal evidence, with zero occupancy and zero logical resources.\
Those rows do not represent live ownership and cannot grow after failure.\
Normal `Running`, `Closing`, and `Closed` retention still follows the live-resource rule above.

Lists use deterministic UTF-8 ordering by listener address then listener ID, or by channel identity.\
Revisions increase on every visible state mutation.\
Revision and every counter use the bounded canonical decimal-string domains in section 8.1.\
The counter schema is closed: adding, removing, or renaming a field requires an explicit schema revision.\
Counters begin at `"0"` with fabric creation, are monotonic for that fabric lifetime, and never wrap or silently saturate.

Channel state is `Open` while both endpoints are open, `Closing` after either begins closing or only one endpoint terminal has committed, and `Terminal` only after both endpoint terminal records have committed.\
The two terminal fields remain distinct because origin and outcome may differ by endpoint.\
`left` always names the connecting endpoint and `right` the accepted endpoint, fixed at channel commit; the directional counters use that same orientation.

Snapshots contain no packet document, application payload, credential, unbounded error object, object address, stack trace, or mutable capability.\
Queued packet/byte fields are bounded occupancy gauges, never queue contents or handles.\
AGP node operations remain the authority for sessions, routes, forwarding, and protocol timers; fabric operations describe only transport-owned state.

---

## 11. Invariants

A conforming implementation preserves all of the following:

1. Every live listener address is unique within one exact fabric object.
2. No bound acquisition capability reaches a listener in another fabric object,
   even when logical references, fabric IDs, and addresses match textually.
3. No accept callback or read-promise settlement is synchronous with its cause.
4. One send captures one independent byte copy and at most one peer packet.
5. Successfully accepted packets are never lost, duplicated, or reordered
   while the channel remains valid.
6. Count and byte reservations are atomic, bounded, and exactly released.
7. Temporary saturation applies backpressure; it never creates silent loss.
8. Each channel endpoint has one terminal outcome and no post-terminal packets.
9. Each listener has one observable terminal outcome, and cancelling a terminal
   wait has no lifecycle effect.
10. Listener terminal commit prevents later acquisitions without closing any
    transferred channel.
11. Direction is acquisition evidence only and grants no protocol authority.
12. Transport evidence comes from the actual fabric/channel, not desired node
    configuration.
13. A successfully closed fabric leaves no registered address, channel,
    pending acquisition, pending writer, queued packet, timer, or
    scheduler-owned live handle.
14. The adapter neither parses AGP JSON nor calls endpoint handlers directly.
15. Revision, counters, and arbitration sequence never wrap; exhaustion
    commits one bounded immutable failed snapshot before the originating
    mutation.

An invariant failure commits a carrier-origin terminal with `kind: "adapter-fault"` and bounded diagnostic code `ADAPTER_FAULT`; it is never repaired by mutating AGP state behind the kernel.

---

## 12. Non-goals

The canonical loopback adapter does not provide:

- communication between processes, workers without shared fabric ownership, or
  machines;
- DNS, port allocation, multicast, broadcast, service discovery, or a global
  registry;
- TLS, cryptographic principal authentication, sandboxing, or protection from
  malicious code already holding the fabric capability;
- persistence, replay, retransmission across channel replacement, durable queues,
  or exactly-once application processing;
- latency, packet loss, duplication, reordering, or corruption injection;
- JSON protocol interpretation, RPC, pub/sub, queuing, or workflow semantics;
- automatic node construction or direct endpoint dispatch; or
- a special fast path around AGP OPEN, routing, admission, timers, or errors.

Fault injection belongs in an explicit wrapper or test transport so production loopback semantics remain closed and predictable.

---

## 13. Verification

The production package proves common invariants T01-T21 through the transport-contract certification suite plus loopback-specific tests.\
Loopback uses no carrier binding token or runtime protocol negotiation.

Required contract cases include:

- isolated fabrics with identical textual IDs cannot cross-connect;
- duplicate transport-name creation is atomic and preserves the incumbent;
- duplicate listener registration is atomic and preserves the incumbent;
- malformed logical resolver input fails `REFERENCE_INVALID`; malformed or
  foreign-fabric adapter configuration fails construction; valid unmapped or
  wrong-kind logical references resolve to no capability; and a connection to
  a closing listener fails closed;
- accepted and connected channels are fully initialized before exposure;
- an immediate first packet is retained without synchronous re-entry;
- both directions preserve every byte value and independent FIFO order;
- mutating or reusing sender-side bytes immediately after `send()` returns its
  promise cannot affect delivered content;
- packet limits use `Uint8Array.byteLength`;
- per-channel and fabric-total count/byte ceilings never exceed their bounds;
- saturation stalls the one pending write and resumes it fairly on consumption;
- cancellation before and after the admission point follows the exact send
  contract;
- channel close, abort, connect-cancellation, and I/O races commit one endpoint
  terminal and release every reservation;
- fabric-close cancellation follows listener and acquisition commit races
  without closing any transferred channel;
- both capacity-rejection kinds release their acquisition before one callback;
  paired `connect()` settles only after normal `accept()` return; a throwing
  `accept()` aborts both untransferred endpoints and rejects that connect;
  `Error` and non-`Error` callback throws cannot escape or repeat, commit the
  exact listener fault unless an earlier terminal won, and leave other
  listeners and earlier transferred channels usable; absent and throwing
  diagnostic sinks preserve that exact outcome and fabric accounting;
- cancellation before callback entry suppresses accept and rejects the
  acquisition, while normal/throwing callback disposition wins over a
  cancellation fired re-entrantly while the callback holds the gate;
- cancelling `waitTerminal()` leaves the listener live and later observation
  returns the one committed listener terminal;
- ordinary listener close returns the local graceful terminal, while listener
  close/abort/failure races commit exactly one terminal;
- unexpected listener termination while a node is `Running` fails the node
  lifecycle, and no listener terminal closes a transferred channel;
- a slow or abandoned receiver cannot create unbounded memory growth;
- connection-derived fabric evidence reaches identity admission unchanged;
- snapshots are canonical, monotonically revisioned, bounded, and redacted;
- near-boundary revision, multi-delta counter, and arbitration cases commit one
  exact `Failed` snapshot, no originating mutation, no wrap/saturation, zero
  logical resources, immutable terminal rows, and successful private cleanup;
- no packet content appears in state, counters, errors, or diagnostics; and
- successful final fabric closure leaves zero listeners, channels, pending
  acquisitions, queued packets, queued bytes, scheduler work, and process
  handles.

Topology tests use this production adapter without private kernel imports.\
Chaos tests wrap or replace it through the same public packet-channel ports; they do not add fault switches to the canonical loopback implementation.

---

## 14. Mechanics, rationale, and consequence

### Mechanics

One explicit fabric owns isolated names, listener registration, paired asynchronous copied packet channels, bounded pressure, lifecycle, exact monotonic state, and neutral peer evidence.\
Every AGP node reaches it only through ordinary bound transport capabilities.

### Rationale

Process-local components need a real AGP carrier with the same protocol and resource semantics as networked nodes.\
A production contract makes that use case reusable and inspectable without turning tests into a privileged kernel path.

### Consequence of violation

A global registry, synchronous direct dispatch, mutable caller bytes, unbounded queues, wrapped revisions, or Loopback-specific kernel behavior would make local topologies prove a different system from deployed AGP and would invalidate transport-equivalence evidence.
