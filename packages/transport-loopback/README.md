# `@agp/transport-loopback`

Canonical process-local production implementation of the neutral AGP ordered
packet-channel contract.

The package owns an explicit isolated fabric, bound listener/target
capabilities, copied asynchronous byte delivery, finite pressure, terminal
semantics, peer evidence, diagnostics, and schema-backed operational state. It
imports only the public `@agp/transport` boundary and has no protocol, core,
node, JSON, or module-global routing path.

## Construction

One composition root creates the fabric, reserves named transports, and gives
each AGP node only its scoped `PeerTransportPort`:

```js
import { createLoopbackFabric } from "@agp/transport-loopback";

const fabric = createLoopbackFabric({
  fabricId: "application",
  limits: {
    maxTransports: 3,
    maxListeners: 3,
    maxPendingAcquisitions: 3,
    maxActiveChannels: 3,
    maxPacketBytes: 65_536,
    maxBufferedPacketsPerChannel: 32,
    maxBufferedBytesPerChannel: 2_097_152,
    maxQueuedPacketsTotal: 96,
    maxQueuedBytesTotal: 6_291_456,
    maxPendingSendBytesTotal: 393_216,
  },
});

const hubTransport = fabric.createTransport({
  transportName: "hub",
  capabilities: { listen: true, connect: false },
});
const spokeTransport = fabric.createTransport({
  transportName: "spoke-a",
  capabilities: { listen: false, connect: true },
});

const hubPort = hubTransport.createPort({
  listeners: new Map([
    ["hub.listen", {
      fabricId: "application",
      address: "hub",
    }],
  ]),
  targets: new Map(),
});
const spokePort = spokeTransport.createPort({
  listeners: new Map(),
  targets: new Map([
    ["hub.connect", {
      fabricId: "application",
      address: "hub",
    }],
  ]),
});
```

The two ports are ordinary neutral `PeerTransportPort` values. The node sees
logical references and transport capabilities; it never receives the fabric
registry, addresses, queues, or administrative authority.

Call `snapshot()` for immutable bounded operational state. Stop node/session
owners before `fabric.close(signal)`: fabric closure stops listeners and waits
for already-transferred channels, but never steals their close authority.

## Owned contracts

Production configuration and operations records are published beneath
`@agp/transport-loopback/schemas/v1/*`; finite-domain and retention rules are
published beneath `@agp/transport-loopback/semantic-rules/v1/*`.

Fabric failure records deliberately distinguish exhausted unsigned monotonic
domains (`MONOTONIC_DOMAIN_EXHAUSTED`) from internal adapter invariant failures
(`ADAPTER_FAULT`). Either transition freezes one stable terminal operations
snapshot; invariant causes are emitted only to the inert diagnostic sink and
never enter public state.
