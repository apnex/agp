# Management HTTP test ownership

Tests exercise the public adapter with a deterministic, topology-neutral
`OperationsReader`. The shared fixture arranges immutable data and contains no
assertions.

| Test file | Primary contract | Explicit non-goal |
|---|---|---|
| `contract/operations-projection.test.js` | Every stable resource makes one matching SDK read and preserves exact schema-valid canonical data | Routing or session inference |
| `contract/safe-methods.test.js` | GET/HEAD/OPTIONS and the closed mutation/query/body/path failure catalog remain read-only | Listener configuration and byte overflow |
| `contract/schema-catalog.test.js` | Twelve sovereign response contracts have exact identities, owners, digests, types, and external references | HTTP lifecycle and SDK behavior |
| `unit/bounds-and-failures.test.js` | Request/response bounds and redacted reader/schema failures use exact query counts | Header-parser internals |
| `unit/configuration.test.js` | Construction is inert and validates complete readers, literal loopback hosts, ports, and response bounds | Socket lifecycle races |
| `unit/lifecycle.test.js` | Start/stop are idempotent, restart rebinds, and lifecycle never queries operations | Resource projection |

Run with `npm test --workspace @agp/management-http`.
