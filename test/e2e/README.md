# End-to-end suite ownership

These files own only behavior crossing SDK, management HTTP, CLI, or independently started operating-system process boundaries.

| File | Contract protected | Primary oracle | Explicit non-overlap |
|---|---|---|---|
| `operations-frozen-parity.test.js` | One frozen capture is identical through SDK, HTTP, CLI JSON, and deterministic tables | exact response and row equality | No live time progression or process topology |
| `operations-live-time-bounds.test.js` | Live uptime and hold TTL remain bounded across independently sampled surfaces and advance in one-second display steps | bracketed monotonic bounds | No frozen exact-time equality or multi-node routing |
| `independent-star-multi-endpoint.test.js` | Three copies of one uniform child executable populate every RIB and deliver every uniquely owned leaf endpoint in both directions | selected paths, ACKed source exports, and handler deliveries | No hub-local delivery, duplicate-route policy, CLI presentation, or teardown fault |
| `independent-star-hub-endpoint.test.js` | A listener/transit node may also advertise and terminate its own named endpoint while both leaves route JSON to it | exact local/direct paths, ACKed exports, receipts, and center handler deliveries | No leaf-to-leaf delivery, duplicate-route policy, or failure |
| `independent-star-duplicate-route.test.js` | Two independent leaves may advertise one endpoint name while the center retains both candidates and selects one deterministically | exact candidate set, winner, path, and leaf-local preference | No failure reconvergence, ECMP, or unique-endpoint delivery |
| `independent-star-cli-inspection.test.js` | Separate read-only CLI processes inspect every live star management URL | six-hex Established rows and every selected endpoint/path | No SDK send or process shutdown |
| `loopback-example-cli-inspection.test.js` | The shipped process-local production Loopback example is externally runnable, inspectable through every management URL and CLI, and signal-stoppable | emitted readiness/delivery records, live session and selected-route tables, and clean exit | No adapter internals, transport-equivalence comparison, or route-policy mechanism |
| `independent-line.test.js` | Three independent uniform processes propagate and use symmetric two-hop routes | ordered paths and edge handler deliveries | No alternate path or injected failure |
| `independent-restart-reconvergence.test.js` | A replaced process rebuilds equivalent reachability under fresh instance and session authority | endpoint path equality across incarnations | No multi-hop geometry or injected fault |
| `transport-equivalence-star.test.js` | Production Loopback and independent-process WebSocket stars preserve the same protocol semantics | exact normalized admitted connections, RIB candidates, selected routes, exports, next hops, and delivery | No adapter-internal state, failure injection, or line transit |
| `transport-equivalence-line.test.js` | Production Loopback and independent-process WebSocket lines preserve symmetric multi-hop behavior | exact normalized protocol state and deliveries in both edge directions | No adapter-internal state, alternate paths, or star fan-out |
| `process-cleanup.test.js` | Explicit exact-child stop closes processes and sockets | clean exits, absent PIDs, and immediate port rebinding | No route-withdrawal semantics or forced kill |

`support/` contains process, IPC, management polling, and presentation mechanics only.\
Assertions remain in the owning test.

## Finding AX7-ACK-BARRIER-1

A selected destination route can become visible before the transit node's source route export reaches `acked`.\
Sending in that window correctly fails closed with `SOURCE_NOT_ADVERTISED`; it is not transport loss.\
The independent star and line tests therefore use positive per-hop Adj-RIB-Out ACK evidence before their first data frame.\
This is a readiness regression guard.\
The package-local source-export contract test remains the owner of the rejection mechanism itself.
