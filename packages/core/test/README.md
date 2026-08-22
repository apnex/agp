# Core semantic test ownership

These tests use the public `@agp/core` package with injected clocks and identifiers.\
Shared fixtures arrange state only; they contain no assertions.

| Test file | Primary contract | Explicit non-goal |
|---|---|---|
| `unit/adjacency-retry-suppression.test.js` | A satisfied adjacency suppresses dialing and loss resumes its bounded retry | Transport dialing and collision choice |
| `unit/credit-grant.test.js` | Per-hop credit is two-dimensional, absolute rather than incremental, and unlimited when unnegotiated | Session wiring and wire carriage |
| `unit/latency-recorder.test.js` | The one primitive every measured duration reports through keeps count, last and high water, and reports nothing until something is measured | What is timed, and where a sample is projected |
| `unit/canonical-ordering.test.js` | Canonical ordering is UTF-8 byte order on every input, including where code-unit order would disagree | Which collections are ordered |
| `unit/write-path-cost.test.js` | A commit reports a revision rather than state, unchanged canonical state is shared rather than re-cloned, and write cost does not follow held state | Which callers commit, and what they commit |
| `unit/bounded-capacity.test.js` | Count/byte reservations are atomic and release is idempotent | Routing- or handler-specific policy |
| `unit/connection-preidentity-closed-event.test.js` | A pre-admission ended attempt emits one remote-free event and cannot invent peer authority | Admitted-session teardown |
| `unit/diagnostic-record-schema.test.js` | The sole core diagnostic record closes domain, severity, code, text, and extension boundaries | Sink scheduling and adapter diagnostics |
| `unit/export-epoch-closure.test.js` | Binding withdrawal closes its ACKed source epoch before the successor export | Writer I/O and peer acknowledgement |
| `unit/monotonic-domain-exhaustion.test.js` | Revision, event-sequence, and multi-delta counter exhaustion atomically become terminal failure without wrap | Node-native teardown side effects |
| `unit/operational-event-schema.test.js` | The generated closed event vocabulary accepts every canonical data variant and rejects legacy shapes | Live node event emission |
| `unit/operations-reader.test.js` | One immutable operations capture is revision-consistent and canonically ordered | HTTP/CLI projection and live duration changes |
| `unit/operations-time-materialization.test.js` | Uptime and hold TTL materialize from monotonic time without revising canonical state | Protocol timer scheduling |
| `unit/peer-fsm-cross-dial.test.js` | Both candidate arrival orders choose the higher-node initiator | Physical transport acquisition and retry |
| `unit/peer-fsm-established-matrix.test.js` | The Established wire-family matrix rejects only the illegal OPEN family | Payload semantics and RIB mutation |
| `unit/peer-fsm-establishment.test.js` | Dialed and accepted controllers establish only after symmetric OPEN/KEEPALIVE | Identity policy, collision, and timers |
| `unit/peer-fsm-revisions.test.js` | Inbound revision validation accepts only the exact safe successor | ACK content and route installation |
| `unit/peer-fsm-route-ack.test.js` | ACK validation requires exact message, revision, and unique rejection results | Rejection retry scheduling |
| `unit/peer-fsm-route-admission.test.js` | Current, stale, expired, and faulted admission continuations have exact dispositions | Route-policy meaning and transport I/O |
| `unit/peer-fsm-route-exchange.test.js` | Both acquisition directions schedule initial export and consume an exact ACK | Encoding, writer behavior, and propagation |
| `unit/peer-fsm-teardown.test.js` | Fatal input gates forwarding before purge and release | Adapter close behavior and reconnect |
| `unit/transport-loss-disposition.test.js` | Every transport loss cause resolves to one closed teardown and retry decision | Which carrier produced the loss |
| `unit/peer-fsm-timers.test.js` | Each protocol timer produces its exact self-transition or teardown action | Wall-clock implementation |
| `unit/rib-atomic-revision.test.js` | One route transaction exposes only a complete before/after revision | Operations transport surfaces |
| `unit/rib-remote-rejection-memory.test.js` | An unchanged nonretryable rejected tuple remains filtered without resend | Retry timer behavior |
| `unit/route-alternative-promotion.test.js` | Removing the selected session atomically promotes the remaining eligible route | Live withdrawal propagation |
| `unit/route-binding-withdrawal.test.js` | Local binding close removes candidate, Loc-RIB, and FIB in one revision | Session-owned withdrawal |
| `unit/route-capacity.test.js` | Candidate overflow admits one canonical bounded prefix atomically | Writer and handler capacity |
| `unit/route-export-eligibility.test.js` | Local/transit/capacity export decisions and reasons are exact | Update encoding and ACK state |
| `unit/route-import.test.js` | A full snapshot replaces only its owning session's Adj-RIB-In set | Best-path tie breaking and export |
| `unit/route-peer-loop.test.js` | A learned path is suppressed only when the target export peer is already present | Receiver-loop import rejection |
| `unit/route-receiver-loop.test.js` | A receiver-containing import is nonfatally rejected as `LOOP` and never installed | Per-peer export suppression |
| `unit/route-remote-rejection-retry.test.js` | An unchanged retryable rejection schedules exactly one saturated-backoff retry | Real timers and network resend |
| `unit/route-selection.test.js` | Equal-class alternatives select deterministically independent of arrival order | Alternative promotion after loss |
| `unit/route-session-withdrawal.test.js` | Session loss removes all and only that controller's advertisements | Local binding removal |
| `unit/session-pair-scope.test.js` | A six-hex local ID may coexist across remote peers but not duplicate one exact pair | Random ID allocation and cross-dial direction |
| `unit/session-closed-event.test.js` | An admitted ended attempt emits one exact `(remoteNodeId, localSessionId)` event | Pre-identity teardown |
| `unit/session-terminal-retention.test.js` | A retrying dial retains one terminal only until its fresh pending attempt replaces it | Reconnect scheduling |
| `unit/session-transition-schema.test.js` | A canonical transition remains schema-valid when optional `reasonCode` is absent | Full operational-event vocabulary |

Run with `npm test --workspace @agp/core`.
