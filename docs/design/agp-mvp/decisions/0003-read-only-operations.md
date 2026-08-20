# ADR-0003: Canonical SDK state with a local read-only HTTP projection

- **Status:** Proposed
- **Date:** 2026-07-29

## Context

Application developers and operators are the direct MVP audiences. The project
requires SDK-level state queries and a minimal decoupled CLI. Survey Q6 selected
a local read-only HTTP adapter as the CLI attachment mechanism.

## Decision

The SDK owns canonical immutable snapshots and structured change events. An
optional adapter hosted with the router projects selected snapshots as
read-only JSON over a locally bound HTTP interface. Bash CLI drivers call that
interface and delegate field projection to `jq` templates and presentation to a
shared renderer.

No HTTP or CLI mutation is included in the MVP.

## Consequences

- SDK, HTTP, CLI, and tests share one state model.
- The CLI can remain process-independent and operationally simple.
- The adapter needs explicit lifecycle, bind-address, payload, and access policy.
- Read-only access still exposes operational metadata and must be threat-modelled.
- A future production management plane is a separate design.
