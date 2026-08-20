# ADR-0005: Node, session, and transport identity lifetimes

- **Status:** Accepted
- **Date:** 2026-07-29
- **Updated:** 2026-07-30

## Context

Routing ownership, stale reconnect callbacks, and operational queries require
identities with different lifetimes. Treating a socket address, WebSocket, or
one generic “peer ID” as all three would couple the protocol and RIB to a
transient transport.

## Decision

Use one opaque configured `nodeId` as the stable protocol identity. Each side
creates a new local `sessionId` for every AGP FSM attempt, including reconnects,
and sends that value in OPEN. The reference `CryptoIdSource` represents a
session ID as exactly six lowercase hexadecimal characters. It selects a
random initial position in a node-local 24-bit space and advances a
nonrepeating cursor, failing after the complete space has been issued rather
than wrapping and reusing an ID from that source instance.

A `sessionId` is deliberately **not** deployment-global and no non-reuse
guarantee crosses a process restart. Protocol identity and remote-session
provenance therefore use the pair `(nodeId, sessionId)`. Two different nodes
may legitimately issue the same six-character value. An injected `IdSourcePort`
may use another schema-valid opaque representation, but must preserve the
same scoping semantics. Keep the concrete WebSocket `transportId` inside the
transport adapter.

On the hub, route records distinguish:

- `owningSessionId`: the hub-local FSM/session ID used for cleanup, stale
  callback rejection, and next-hop resolution; and
- `originSessionId`: the spoke's remote OPEN `sessionId`, used with
  `originNodeId` for advertisement provenance and update-revision scope.

They describe opposite perspectives on one connection and are not
interchangeable. A hub's local ID source must not issue an
`owningSessionId` already present in that router's session registry; that local
uniqueness permits direct cleanup and next-hop lookup. An `originSessionId`
has meaning only together with `originNodeId`. Public queries expose both with
explicit names, but never `transportId`. “Peer” names the node at the other end
of a session and is not a second identifier.

This compacting decision applies only to the reference default for session
IDs. Envelope message IDs retain deployment-wide uniqueness, while
advertisement, route, and binding IDs retain their existing SDK-lifetime
collision guarantees and namespaced UUID defaults.

The MVP role carried in `OPEN` is `hub` or `spoke`. It describes this protocol
session, not a future inter-router topology.

## Consequences

- Reconnects retain recognizable node identity while isolating old callbacks,
  remote update sequences, and route ownership within the running node/router.
- Operators get compact session values without treating them as globally
  meaningful identifiers.
- Forwarding resolves through a tagged local/session next hop; a session next
  hop resolves by local `owningSessionId`, never by a socket identity.
- Socket addresses remain optional diagnostic metadata.
- Authentication can later bind credentials to `nodeId` without changing route
  keys.
- Implementations may have additional private connection-supervisor IDs, but
  those do not enter AGP contracts.
