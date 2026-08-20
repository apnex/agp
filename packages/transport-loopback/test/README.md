# Loopback transport test ownership

Each test file owns one primary contract:

| Area | Primary contract |
|---|---|
| `contract/schema-catalog.test.js` | Sovereign schema/catalog generation and references |
| `contract/production-surface.test.js` | Explicit fabric isolation, names, references, and capabilities |
| `contract/operations-snapshot-retention.test.js` | Bounded canonical live rows and immutable snapshots |
| `contract/operations-monotonic-exhaustion.test.js` | Exact terminalization before finite-domain wrap |
| `contract/operations-adapter-invariant-failure.test.js` | Truthful adapter-invariant terminalization, retention, and observation |
| `contract/diagnostic-sink.test.js` | Closed diagnostics and sink inertness |
| `conformance/acquisition.test.js` | Asynchronous listen/connect transfer and capacity |
| `conformance/acceptance-callback-fault.test.js` | Callback throw cleanup and first-terminal-wins |
| `conformance/packet-boundary.test.js` | Copying, byte preservation, and packet boundaries |
| `conformance/packet-order.test.js` | Independent full-duplex FIFO ordering |
| `conformance/pressure.test.js` | Atomic bounded pressure and fair wakeup |
| `conformance/cancellation.test.js` | Operation commit-versus-cancellation boundaries |
| `conformance/listener-lifecycle.test.js` | Wait cancellation, address release, and transferred-channel independence |
| `conformance/terminal-race.test.js` | Stable close/abort/terminal results and release |
| `conformance/evidence.test.js` | Exact fabric-issued peer evidence |
