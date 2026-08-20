# ADR-0004: Contract-first layers with continuous integration gates

- **Status:** Proposed
- **Date:** 2026-07-29

## Context

Survey Q3 selected contract-first, layered development. Q5 additionally selected
an early hub-and-two-spoke skeleton and explicit integration gates to prevent
late composition failures.

## Decision

Approve schemas, FSM transitions, RIB invariants, public SDK types, and
operational resources before their implementations. Maintain a runnable
hub-and-two-spoke skeleton throughout and add capability at explicit gates:
transport, `Established` session, installed route, forwarded data, and
operational visibility.

## Consequences

- Layer contracts are reviewable and independently testable.
- Integration feedback begins before every layer is complete.
- Test doubles need deterministic clocks, transports, and identifiers.
- A demonstration cannot substitute for contract conformance, and isolated unit
  conformance cannot substitute for the walking skeleton.
