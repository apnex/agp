# `@agp/node` test ownership

Contract tests exercise public runtime capabilities or exact-controller boundaries.\
The unit test owns one sovereign allocator.\
Fixtures provide deterministic identities, clocks, and write ledgers only.

| Test file | Primary contract | Explicit non-goal |
|---|---|---|
| `contract/acceptance-callback-fault-lifecycle.test.js` | A listener-reported acceptance-callback adapter fault fails the running node once while transferred channel ownership closes once | Adapter callback isolation internals |
| `contract/data-failure-precedence.test.js` | Multi-failure transit admission commits only the first normative failure | Topology convergence |
| `contract/direct-delivery-error.test.js` | A current-hop data failure reaches ingress as one exact disposition, and only once its batch is sent | Breadcrumb relay |
| `contract/hop-exhaustion.test.js` | The last usable hop returns `HOP_LIMIT_EXCEEDED` with zero onward data | Route-miss precedence |
| `contract/handler-settlement-operations.test.js` | Successful and failed handler settlements each commit one exact event and closed counter | Handler scheduling and payload semantics |
| `contract/ingress-egress-inequality.test.js` | Exact ingress can never be reused as selected egress | Route selection |
| `contract/identity-peer-evidence.test.js` | Identity admission receives the exact immutable evidence observed by its channel and configuration cannot forge it | Transport authentication mechanics |
| `contract/late-handler-settlement.test.js` | A handler settling after terminal revocation cannot advance operations | Cooperative handler draining |
| `contract/lifecycle-one-shot.test.js` | Stopped and Failed runtimes are terminal while repeated stop is stable | Peer reconnect |
| `contract/local-data-admission.test.js` | Local delivery uses one selected route revision and exact binding | Remote or transit delivery |
| `contract/local-route-miss.test.js` | Local `NO_ROUTE` creates no reservation or data write | Transit reverse error |
| `contract/operational-event-schema.test.js` | Every live emitted node event validates against the closed sovereign event union | Generated vocabulary completeness |
| `contract/peer-adjacency-uniqueness.test.js` | Duplicate adjacency identities fail construction before transport resolution | Remote identity collision |
| `contract/reverse-error-consume-once.test.js` | An exact controller/token/refId breadcrumb is consumable only once | Relay translation |
| `contract/reverse-error-no-rib.test.js` | Reverse lookup uses exact retained controller identity and performs no RIB lookup | Destination forwarding |
| `contract/reverse-error-refid.test.js` | Wrong-refId error input cannot consume a matching token | Successful consumption |
| `contract/disposition-relay.test.js` | Transit relay uses recorded ingress, translates only hop-local identity, compresses deliveries to runs, and measures an arriving batch before applying any of it | Direct current-hop failures, release under load |
| `contract/session-hold-ttl.test.js` | Public inbound hold TTL decreases with monotonic time without a revision | Outbound keepalive suppression |
| `contract/session-id-pair-scope.test.js` | Equal six-hex IDs coexist for different peers, including accepted pre-identity controllers | Cross-dial winner selection |
| `contract/breadcrumb-expiry.test.js` | Expiry is a working backstop when nothing reports back, so capacity is a bound on what is outstanding rather than a lifetime total | Release by disposition, relay |
| `contract/disposition-surface.test.js` | What an application is told about a message it sent, including an unknown denominator distinguished from a known one, the per-endpoint stream, and a next hop lost mid-flight | Wire shape, batching, relay |
| `contract/disposition-release.test.js` | A binding is released by a delivery and not only by a failure or expiry, and a full table evicts rather than refusing | Wire shape, batch composition |
| `contract/inbound-dispatch-failure.test.js` | An inbound dispatch failure is diagnosed and terminates only its own session | Which failures reach the inbound path |
| `contract/session-transition-emission.test.js` | The snapshot records every self-transition while the stream announces only those no other event reports | Keepalive suppression and hold timing |
| `contract/session-keepalive-traffic.test.js` | Successful outbound traffic postpones keepalive emission while hold remains peer-driven | Hold-expiry teardown |
| `contract/source-export-barrier.test.js` | Data fails closed until its exact source export is ACKed, with no hidden queue | Route-update exchange |
| `contract/stop-drain.test.js` | Stop gates new work and cooperatively drains admitted handler work once | Deadline-expired late settlement |
| `contract/transit-disabled.test.js` | Disabled transit returns one ingress error and writes zero onward data | Hop exhaustion |
| `contract/transit-feasible-source.test.js` | Exact-ingress source feasibility authorizes asymmetric reverse selection | Strict selected-route RPF |
| `contract/transit-route-miss.test.js` | Feasible transit with no destination returns one direct `NO_ROUTE` | Local route miss |
| `contract/transport-disposition-latch.test.js` | Competing terminal causes release once, while accepted packets drain after protocol revocation | Carrier buffering implementation |
| `contract/diagnostic-sink.test.js` | Diagnostics are frozen closed captures with the raw cause kept separate, and a hostile sink cannot alter canonical state | Adapter-owned diagnostic content |
| `contract/listener-terminal-lifecycle.test.js` | Unexpected listener loss reaches node lifecycle exactly once and never leaves a listening node behind a dead listener | Carrier reason for the terminal |
| `contract/transport-reference-composition.test.js` | Opaque listener and target references resolve once by kind without leaking capability authority into kernel state | Binding-specific address syntax |
| `contract/uniform-capabilities.test.js` | The same `NodeImpl` composes listener, dialer, routing, and delivery capabilities | Multi-hop geometry |
| `contract/withdrawal-writer-order.test.js` | Admitted epoch data writes before the snapshot that withdraws that epoch | Remote convergence |
| `contract/credit-writer-precedence.test.js` | The writer stops at the peer's grant, resumes in order, and lets only control overtake data the peer cannot hold | Grant computation and the wire field |
| `unit/return-token-allocator.test.js` | Unsigned-64 tokens remain fixed-width and unique until terminal exhaustion | Breadcrumb storage and session replacement |

Tests use positive executor/write/capacity barriers rather than sleep-based negative evidence.\
Run with `npm test --workspace @agp/node`.
