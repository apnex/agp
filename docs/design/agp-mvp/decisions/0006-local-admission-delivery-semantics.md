# ADR-0006: Local admission is not remote delivery

- **Status:** Proposed
- **Date:** 2026-07-29

## Context

The hub selects the destination route. A spoke therefore cannot know at local
queue-admission time whether the hub will find a route, whether a later next hop
will remain available, or whether the destination application handler will
complete. Making `send()` imply those outcomes would require acknowledgement,
replay, and correlation behaviour outside the selected MVP.

## Decision

Resolve `send()` after validation and atomic admission to a bounded local
outbound queue. The receipt proves only that local acceptance. A router-local
send may additionally report the route and next hop chosen in its own routing
transaction; a spoke reports its established hub session and cannot report the
hub's eventual selected route.

AGP makes one ordered forwarding attempt on the current WebSocket path and does
not replay after session loss. Unknown destination and unavailable next hop at
the hub produce a correlated, nonfatal delivery-error message and operational
event. They do not retroactively reject an already resolved `send()` promise.
An unowned source endpoint is a fatal protocol violation. Successful remote
handler execution is not acknowledged by AGP.

The mandatory `endpoint.ack` is deliberately outside that delivery claim. It
confirms that one authoritative endpoint set was committed by the hub; it
neither refers to a data message nor proves remote application handling.

## Consequences

- The public API makes no exactly-once, durable, or remote-processing claim.
- Loss after local admission is observable through events and counters.
- Applications that need request/reply or business acknowledgement implement
  it using endpoint messages and correlation IDs.
- A future reliable-delivery extension requires a separate protocol and API
  decision rather than silently changing `send()` semantics.
