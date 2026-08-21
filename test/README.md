# System test ownership

These suites own only behavior that crosses two or more public AGP package boundaries.\
Package-local validation, reducer, adapter, and serialization contracts remain in the owning package.

| Directory | Contract protected | Primary axis | Oracle |
|---|---|---|---|
| `integration/` | Public package exports compose without private imports | package composition | SDK results and public DTOs |
| `topology/` | Same-code star, line, triangle, and diamond nodes establish, converge, withdraw, and route | healthy topology behavior | handlers plus canonical RIB/FIB snapshots |
| `resilience/` | A fault or bound cannot leave stale session-owned state | failure and recovery | bounded waits plus post-fault snapshots |
| `e2e/` | SDK, HTTP, CLI tables, and independently launched example processes expose one converged state | external operations surface | returned documents and process output |

Every file owns one scenario axis and every test title states its Given, When, and Then.\
`support/` contains mechanics only; it contains no assertions.
