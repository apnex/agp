# Native CLI test ownership

The component tests execute the configured Rust application against live public AGP nodes and HTTP boundaries.\
The existing system suite also runs against this executable through `AGP_TEST_CLI`.

| File | Contract protected | Primary oracle | Explicit non-overlap |
|---|---|---|---|
| `management-surface.test.js` | All ten resources and thirty configured verbs preserve responses and produce useful native tables | Frozen public SDK and HTTP responses, independent expected cells | Existing connection and route parity stays owned by the system suite |
| `operator-shell.test.js` | Context navigation, exported continuation, endpoint options, and native failure statuses | Real process events and controlled local HTTP responses | No routing or timer mechanism assertions |

`support/` contains process and topology mechanics only.\
Assertions belong in the owning test.
