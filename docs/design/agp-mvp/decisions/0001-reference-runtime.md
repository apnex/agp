# ADR-0001: TypeScript/Node reference runtime

- **Status:** Proposed
- **Date:** 2026-07-29
- **Decision scope:** MVP reference implementation only

## Context

AGP's wire protocol must remain language-neutral, while the MVP needs one
concrete runtime for its router, spoke, local HTTP adapter, examples, and tests.
The relevant local prototypes are JavaScript/Node applications using WebSockets,
and the intended SDK needs explicit public contracts and query DTOs.

## Decision

Use TypeScript on Node.js for the MVP reference implementation. Publish the wire
contract as JSON Schema independently from generated or handwritten TypeScript
types. Keep WebSocket access behind a small adapter so browser or other runtime
support does not enter the protocol and routing cores.

Exact supported runtime and dependency versions are selected during
implementation planning, not fixed by this architecture decision.

## Consequences

- The team can reuse its local JavaScript/Node operational experience without
  copying prototype implementations.
- Public types and discriminated protocol messages are reviewable before code.
- A Node-hosted hub and local HTTP adapter fit one process naturally.
- Other language implementations remain possible but are not MVP deliverables.
- Browser support requires a separate transport adapter and compatibility review.

## Reversal condition

Replace the reference runtime before implementation scaffolding if deployment,
embedding, or team constraints require another platform. The language-neutral
wire, FSM, RIB, and query contracts remain authoritative.
