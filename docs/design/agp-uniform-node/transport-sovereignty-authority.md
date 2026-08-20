# AGP uniform node — transport-sovereignty authority

## 1. Status

| Field | Value |
|---|---|
| Status | Fixed stakeholder intent; approved as design authority on 2026-07-30 |
| Work item | Make the AGP v1 protocol, FSM, session, routing, and operations kernel independent of its concrete transport |
| Decision authority | Stakeholder discussion and explicit approval on 2026-07-30 |
| Lifecycle handoff | Fixed intent → ratified design |
| Compatibility | Replace the current AGP v1 transport surface in place; no compatibility facade |

This authority supplements the confirmed
[`uniform-agp-node-routing-survey.md`](../../surveys/uniform-agp-node-routing-survey.md).
It narrows a lower-layer composition boundary without changing the survey's
uniform-node, symmetric-session, RIB, forwarding, or operational outcomes.

## 2. Explicit survey bypass

The transport-sovereignty refinement does not require another intent survey.
The decision authority fixed every outcome axis that could materially change
the design:

1. AGP core protocol behavior must not know which concrete transport carries
   it.
2. Every conforming transport must drive the same FSM, OPEN exchange, session
   management, keepalives, advertisements, RIB, forwarding, teardown, and
   operations behavior.
3. WebSocket remains a canonical production transport, but its RFC 6455
   binding and Node.js implementation become separately owned.
4. Loopback is a canonical production transport for process-local AGP
   topologies; it is not a mock, shortcut, or test-only fake.
5. Loopback must traverse the complete AGP packet codec and protocol machinery.
6. No raw UDP, datagram profile, additional network transport, dynamic
   transport negotiation, or compatibility layer belongs to this refinement.
7. Public data contracts, transport state, tests, and configuration remain
   sovereign, self-descriptive, bounded, and orthogonal.

The remaining choices—byte-channel API, logical-reference resolution and bound
capabilities, backpressure, terminal taxonomy, package boundaries, and evidence
projection—are technical concretization within that fixed intent. Asking the
stakeholder to select those implementation mechanics would launder
architecture into intent. This document is the explicit bypass record required
when direction is already fully specified.

## 3. Outcome axes

| Axis | Required outcome |
|---|---|
| Protocol invariance | Transport substitution cannot change legal messages, FSM transitions, timers, routing, or data admission |
| Sovereign composition | Protocol, neutral transport contract, bindings, implementations, and operations have exact non-overlapping owners |
| Production utility | Loopback supports real component-to-component AGP systems inside one process |
| Failure determinism | Ordering, bounds, cancellation, close, abort, and terminal races have one exact contract |
| Operational truth | SDK, management, and CLI expose transport-neutral canonical state without reconstructing adapter internals |
| Extensibility | A later reliable ordered carrier can implement the same contract without changing the AGP kernel |

## 4. Authorized design consequences

The design may:

- introduce `@agp/binding-websocket` and `@agp/transport-loopback`;
- replace WebSocket-shaped public transport types with an opaque packet-channel
  contract;
- move WebSocket configuration and validation out of `@agp/core`;
- replace carrier locators in `NodeConfig` with logical transport references;
- change configuration, SDK, state, event, and management schemas in place;
- pass adapter-observed peer evidence into identity admission;
- replace push-backed unbounded receive behavior with a bounded pull contract;
- add transport-specific catalogs and a shared adapter conformance kit; and
- update all AGP v1 design, examples, tests, and certification evidence
  atomically.

It may not:

- bypass AGP encode/decode for Loopback;
- create transport-specific FSM rows, session types, routing paths, or node
  factories;
- make a fulfilled transport write claim peer receipt or application delivery;
- expose credentials or private adapter objects as canonical operations state;
- branch kernel behavior on transport kind, address, or native error code; or
- broaden this work into another network carrier or delivery-semantics profile.

## 5. Mechanics, rationale, and consequence

### Mechanics

The approved design inserts one reliable, ordered, bounded packet-channel
contract beneath the unchanged AGP protocol/session kernel. WebSocket and
Loopback independently implement that contract and are certified through the
same conformance suite.

### Rationale

Hiding a WebSocket object is not transport independence when core
configuration, close codes, subprotocols, text frames, or ordering assumptions
still name WebSocket. Fixing ownership now makes process-local production use
first-class and prevents a future carrier from forcing a protocol rewrite.

### Consequence of violation

A carrier-specific term or branch in protocol, core, node, routing, or
canonical state re-couples the kernel. A Loopback shortcut can pass tests while
skipping the real protocol. An underspecified write or terminal boundary makes
route ordering and teardown nondeterministic. Any of those invalidates this
authority and the dependent design gates.
