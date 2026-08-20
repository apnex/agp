# Transport test ownership

| Test file | Primary contract | Explicit non-goal |
|---|---|---|
| `contract/acceptance-callback-fault.test.js` | Reusable callback containment, cleanup order, diagnostics, and transferred-channel survival | Carrier-specific resource handles |
| `contract/channel-order-rule.test.js` | Reusable bidirectional opaque-packet boundary and FIFO-order case | Carrier framing |
| `contract/conformance-case-coverage.test.js` | T01–T21 and obligations 1–24 have independently named reusable cases | Adapter-specific invocation evidence |
| `contract/diagnostic-sink.test.js` | Closed diagnostic shape, separate raw cause, and inert absent/throwing sinks | Logging policy |
| `contract/public-capabilities.test.js` | Isolated public surface contains neutral contracts only | TypeScript compile-consumer coverage |
| `contract/schema-catalog.test.js` | Sovereign generated schema catalog and closed terminal products | Concrete carrier terminal mapping |
| `contract/terminal-once-rule.test.js` | Reusable first-terminal-wins and stable-read case | Native callback races |
| `unit/operation-errors.test.js` | Closed phase/code and send-acceptance legality | Adapter side effects |

This package owns runtime-neutral ports rather than a fake network. Concrete
adapter behavior belongs to `@agp/transport-node-ws`.

Run with `npm test --workspace @agp/transport`.
