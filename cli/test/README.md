# CLI test ownership

The CLI suite treats each shell layer as a public process boundary.

| Test file | Primary contract | Explicit non-goal |
|---|---|---|
| `contract/read-only-drivers.test.js` | Drivers issue exact safe GETs, validate response versions, and distinguish HTTP, transport, and usage exits | Live topology |
| `unit/cli-dispatcher.test.js` | The command allowlist, URL/options grammar, JSON/table dispatch, and dependency exits fail closed | HTTP response semantics |
| `unit/cli-renderer.test.js` | Headers, TSV fallback, non-TTY color policy, and terminal-control sanitization are deterministic | Domain row projection |
| `unit/connections-template.test.js` | Connection rows render optional fields, monotonic uptime, hold TTL, and hostile text safely | Session state computation |
| `unit/route-template.test.js` | Route rows render winner markers, local/session next hops, paths, and version failures canonically | Route selection |

Fixtures are bounded management documents, never runtime state files.\
Live SDK/HTTP/CLI agreement remains repository integration scope.

Run with `cli/test/run.sh`.
