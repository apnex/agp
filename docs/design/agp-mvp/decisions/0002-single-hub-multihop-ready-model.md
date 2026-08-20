# ADR-0002: Single-hub runtime with a multi-hop-ready route model

- **Status:** Proposed
- **Date:** 2026-07-29

## Context

The north star is multi-hop named-endpoint routing, but survey Q4 selected only
generic next-hop resolution and an extensible RIB for the MVP. It did not select
inter-router control contracts or runnable multi-hop behaviour.

## Decision

Implement one hub router with directly connected spokes. Model every selected
route as resolving to a `NextHop` abstraction and model candidate routes with an
origin class that distinguishes locally originated and learned reachability.
Permit optional path attributes in the in-memory/query model, but do not define
inter-router propagation semantics or use those attributes in MVP selection.

## Consequences

- Direct routes are a constrained instance of the future model.
- Forwarding code does not assume an endpoint maps directly to a WebSocket.
- The MVP remains small and testable.
- Future multi-hop design must still specify router peering, propagation,
  path-vector attributes, loop prevention, and policy.
- Unused future fields must not appear as misleading operational behaviour.
