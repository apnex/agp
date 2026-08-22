# Agent Gateway Protocol

AGP is an embeddable control plane and JSON data plane that routes messages between named application endpoints.\
Every vertex runs the same `createNode()` implementation; topology position is configuration, not a protocol role.

**Status:** ratified v1, feature complete, and fully tested.\
Requires Node.js 24.\
The WebSocket transport can encrypt and mutually authenticate its channels with pre-shared keys, so no certificate infrastructure is required; see [Security posture](#security-posture).

---

## Quick start

```bash
npm install
npm run build
node examples/websocket-star.mjs
```

That example builds a three-node star from three instances of the same node implementation.\
It exercises the WebSocket adapter over ephemeral literal-loopback TCP addresses, so it is distinct from the process-local Loopback transport.\
Pass `--persist` to keep it available for asynchronous inspection.

Run the production Loopback star and delivery walkthrough with:
```bash
node examples/loopback-star/example.mjs
```

Pass `--persist` to keep its three separately managed node projections available at ports `47201`, `47211`, and `47212`.\
Those nodes intentionally share one composition-root process because the owned Loopback fabric is process-local.\
Configuration, inspection commands, and lifecycle details are in [examples/loopback-star/](./examples/loopback-star/README.md).

For three independently managed processes with multiple endpoints per leaf, use [examples/independent-star/](./examples/independent-star/README.md).

| I want to | Go to |
|---|---|
| Run more topologies | [Examples](./examples/README.md) |
| Embed AGP in an application | [WebSocket composition](#websocket-composition) or [Loopback composition](#loopback-composition) |
| Inspect a running node | [Operations and CLI](#operations-and-cli) |
| Build and test the workspace | [Development and verification](#development-and-verification) |
| Understand the protocol | [Design set](./docs/design/README.md) and [mechanisms.md](./docs/design/mechanisms.md) |
| Know why AGP exists, and what it will never be | [VISION.md](./VISION.md) |

---

## Overview

AGP is BGP-inspired, not BGP wire-compatible.\
Sessions follow the familiar `Idle`, `Connect`, `Active`, `OpenSent`, `OpenConfirm`, and `Established` lifecycle.\
Nodes exchange authoritative route snapshots, maintain Adj-RIB-In, a deterministic selected Loc-RIB/FIB, and Adj-RIB-Out, carry an ordered node path, suppress loops, and withdraw session-owned state.\
The NLRI equivalent is a named endpoint and the data plane is a closed, versioned JSON envelope.

Configuration determines whether a node listens, dials peers, exposes endpoints, forwards in transit, or combines those capabilities.\
The AGP kernel is carrier-neutral: production WebSocket and process-local Loopback transports implement the same reliable, ordered, bounded byte-packet contract without changing protocol behavior.

---

## Transport-sovereign v1

The approved design was implemented as an atomic v1 replacement.\
Its load- bearing boundaries are:

- one reliable, ordered, bounded, message-preserving byte-channel contract;
- logical `transportRef` topology names resolved once to adapter-bound
  acquisition capabilities;
- a sovereign RFC 6455 binary-message binding and separate Node.js `ws`
  implementation;
- a canonical production, process-local Loopback fabric using the identical
  codec, FSM, session, RIB/FIB, and data path;
- observable listener/channel terminal records, exact cancellation and
  backpressure semantics, and one controller-level terminal-disposition latch;
- exact finite revision/counter domains that fail and freeze before wrap, plus
  sovereign bounded diagnostics whose raw causes remain process-local; and
- shared adapter conformance plus independent Loopback/WebSocket topology
  equivalence gates.

The normative specifications are [transport-contract.md](./docs/design/transport-contract.md), [binding-websocket.md](./docs/design/binding-websocket.md), and [transport-loopback.md](./docs/design/transport-loopback.md).

Under that target, a peer declares only logical adjacency intent:
```json
{
  "adjacencyId": "hub-primary",
  "expectedNodeId": "hub",
  "transportRef": "peer.hub.primary"
}
```

The WebSocket URL or Loopback address is bound to `peer.hub.primary` in the injected transport configuration, not stored in `NodeConfig`.

---

## Implemented scope

- one topology-neutral `createNode()` SDK;
- one carrier-neutral `PeerTransportPort` with logical reference resolution,
  ordered bounded byte packets, terminal records, cancellation, backpressure,
  peer evidence, and diagnostics;
- a sovereign WebSocket binding using subprotocol `agp.v1`, plus the Node.js
  `ws` adapter;
- a canonical production Loopback fabric with explicit ownership and bounded
  resources;
- symmetric sessions over either implemented transport;
- OPEN, KEEPALIVE, route update/acknowledgement, notification, delivery error,
  and data messages;
- local, direct, and multi-hop endpoint routes with deterministic selection;
- path-vector loop prevention and feasible-ingress source authorization;
- RIB-gated local delivery and transit forwarding;
- ACKed source-export barriers and reverse-hop error breadcrumbs;
- six-character lowercase hexadecimal, pair-scoped session identifiers;
- sovereign JSON Schemas for wire, configuration, SDK, state, event, and
  management objects;
- immutable revisioned SDK queries, read-only management HTTP, and `agpctl`;
- independently runnable star nodes plus live star, line, triangle, and diamond
  verification geometries.

---

## Packages

| Boundary | Responsibility |
|---|---|
| `@agp/protocol` | Sovereign wire schemas, generated DTOs, codec, preflight checks, and contextual semantics |
| `@agp/core` | Node configuration/state schemas, peer FSM, RIB/FIB, bounded resources, clocks, and canonical operations |
| `@agp/transport` | Carrier-neutral listener, acquisition, channel, terminal, evidence, diagnostics, and conformance contracts |
| `@agp/binding-websocket` | Sovereign RFC 6455 configuration, subprotocol, validation, and close/rejection mappings |
| `@agp/transport-node-ws` | Node.js `ws` implementation of the neutral transport port |
| `@agp/transport-loopback` | Canonical process-local production fabric implementing the same neutral port |
| `@agp/node` | Uniform lifecycle, endpoints, sessions, routing composition, data admission, and reverse errors |
| `@agp/management-http` | Optional loopback-only read projection over an `OperationsReader` |
| `cli/` | Read-only HTTP drivers, decoupled `jq` projections, and deterministic table rendering |

Applications import package roots only.\
`@agp/router` and `@agp/spoke` are not part of AGP v1.

---

## WebSocket composition

```js
import { createNode } from "@agp/node";
import { createNodeWsTransport } from "@agp/transport-node-ws";

const config = {
  nodeId: "component.alpha",
  listen: { transportRef: "ws.listen" },
  peers: [{
    adjacencyId: "upstream",
    expectedNodeId: "component.transit",
    transportRef: "ws.upstream",
    reconnect: {
      enabled: true,
      initialDelayMs: 250,
      maximumDelayMs: 5_000,
      multiplier: 2,
      jitterRatio: 0,
    },
  }],
  transit: { enabled: true },
};

const transport = createNodeWsTransport({
  listeners: [{
    transportRef: "ws.listen",
    url: "ws://0.0.0.0:47100/agp",
    compression: { mode: "disabled" },
    security: { mode: "trusted-development" },
  }],
  targets: [{
    transportRef: "ws.upstream",
    url: "ws://192.0.2.20:47100/agp",
    compression: { mode: "disabled" },
    security: { mode: "trusted-development" },
  }],
});

const node = createNode(config, { transport });

await node.expose("alpha/events", async (payload, context) => {
  console.log(payload, context.delivery.source);
});
await node.start();

const receipt = await node.send(
  "alpha/events",
  "beta/service",
  { operation: "example" },
);
```

Only the composition root sees WebSocket configuration.\
The node resolves `ws.listen` and `ws.upstream` to already-bound neutral capabilities and never receives a URL, socket, WebSocket close code, or subprotocol.

---

## Loopback composition

Loopback uses the same `createNode()` call and logical references.\
The composition root owns an explicit bounded fabric and gives each node only its scoped neutral port:
```js
import { createNode } from "@agp/node";
import { createLoopbackFabric } from "@agp/transport-loopback";

const fabric = createLoopbackFabric({
  fabricId: "application",
  limits: {
    maxTransports: 2,
    maxListeners: 1,
    maxPendingAcquisitions: 2,
    maxActiveChannels: 1,
    maxPacketBytes: 1_048_576,
    maxBufferedPacketsPerChannel: 64,
    maxBufferedBytesPerChannel: 4_194_304,
    maxQueuedPacketsTotal: 128,
    maxQueuedBytesTotal: 8_388_608,
    maxPendingSendBytesTotal: 2_097_152,
  },
});

const serviceTransport = fabric.createTransport({
  transportName: "service",
  capabilities: { listen: true, connect: false },
}).createPort({
  listeners: new Map([
    ["loop.listen", { fabricId: "application", address: "service" }],
  ]),
  targets: new Map(),
});
const clientTransport = fabric.createTransport({
  transportName: "client",
  capabilities: { listen: false, connect: true },
}).createPort({
  listeners: new Map(),
  targets: new Map([
    ["loop.service", { fabricId: "application", address: "service" }],
  ]),
});

const service = createNode(
  { nodeId: "service", listen: { transportRef: "loop.listen" } },
  { transport: serviceTransport },
);
const client = createNode({
  nodeId: "client",
  peers: [{
    adjacencyId: "service-primary",
    expectedNodeId: "service",
    transportRef: "loop.service",
  }],
}, { transport: clientTransport });
```

The fabric is an owned production resource, not a global registry or test mock.\
Stop its node owners before closing it.\
Its immutable bounded operations state is available through `fabric.snapshot()`.

`send()` consults the local selected RIB.\
A missing or unusable route rejects with a typed error before any onward data write.\
A successful receipt records the selected route and operations revision used for admission; it does not claim end-to-end application handling.

---

## Operations and CLI

Every node exposes the same canonical reader:
```js
const connections = node.operations.connections();
const routes = node.operations.routes();
const snapshot = node.operations.snapshot();
```

Connection snapshots materialize monotonic `establishedDurationMs` and hold timer `remainingMs` at query time without changing the state revision.\
The CLI renders those fields as unbounded-hour `UPTIME` and whole-second `TTL`.

An application may expose the reader locally:
```js
import { createManagementHttpServer } from "@agp/management-http";

const management = createManagementHttpServer(node.operations, { port: 47111 });
await management.start();
```

The Bash/`curl`/`jq` CLI is read-only:
```bash
export AGP_MANAGEMENT_URL=http://127.0.0.1:47111
./cli/agpctl connections.list
./cli/agpctl routes.list
./cli/agpctl routes.list --json
```

---

## Security posture

The WebSocket binding offers two profiles.

`preshared-key` uses TLS 1.3 with pre-shared keys: confidentiality and integrity on every channel, with no certificate authority, expiry, or revocation to operate.\
`keying: "network"` shares one secret across the topology and protects traffic without identifying peers.\
`keying: "node"` gives each node its own secret, so a listener can prove which peer connected and pass that principal to `IdentityAdmissionPort`.

`trusted-development` is cleartext `ws:` with self-asserted identity, for a network you already trust.

The transport reports evidence; it does not decide whether a principal may claim a `nodeId`.\
That is deployment policy.\
Read [docs/SECURITY.md](./docs/SECURITY.md) before exposing a node, including the stated limits on mesh topologies and forward secrecy.

The management server remains literal-loopback-only by design.\
`agpctl` is an inspection surface, not a remote administration API.

---

## Development and verification

```bash
npm run build
npm test
npm run test:architecture
npm run test:packages
npm run test:cli
npm run test:integration
npm run test:topology
npm run test:resilience
npm run test:e2e
npm run schemas:check
```

Tests are package-owned, self-descriptive, and orthogonal.\
The ownership model and anti-rot checks are documented in [docs/TESTING.md](./docs/TESTING.md).\
The layered gate definitions, and which gate owns which proof, are in [verification.md](./docs/VERIFICATION.md).
