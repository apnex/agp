# AX8 resilience suite map

This directory owns deterministic adversity against the public uniform
`@agp/node` runtime. Tests use named barriers and the local chaos transport's
positive call ledger; a bounded poll only waits for a stated positive
operations, delivery, or fault-injection fact.

| File | Owned injection and invariant | Explicit non-overlap |
|---|---|---|
| `selected-branch-loss.test.js` | C1 selected transit death promotes the observable diamond alternate with one data path | No outstanding export |
| `route-update-ack-loss.test.js` | C1 one dropped update or ACK reaches finite teardown, reconnect, and full-snapshot recovery | No write rejection |
| `write-close-failure.test.js` | C1 one rejected write or close releases reservations and completes bounded teardown | No frame loss |
| `jitter-reorder.test.js` | C1 a delivered old route revision after a newer revision is rejected exactly | No cross-dial |
| `cross-dial-race.test.js` | C1 simultaneous reciprocal dials retain the higher-node-initiated physical session | No reconnect |
| `receiver-peer-loop.test.js` | C1 receiver-in-path is nonfatal `LOOP`; peer-in-path is per-peer `PEER_IN_PATH` suppression | No malformed schema input |
| `hop-exhaustion.test.js` | C1 last usable hop emits one correlated error and zero onward data writes | No route miss |
| `queue-saturation.test.js` | C1 exact handler saturation rejects promptly while route-control readiness survives | No withdrawal |
| `malformed-oversized-peer.test.js` | C1 invalid JSON and transport size rejection isolate only the offending session | No reconnect |
| `cascading-withdrawal.test.js` | C1 origin loss cascades through a line while an unrelated route remains deliverable | No blocked successor export |
| `handler-drain-race.test.js` | C1 stop revokes a held handler generation; late settlement cannot advance terminal state | No writer drain |
| `observer-pressure.test.js` | C1 a one-event subscriber overflow reports `observer.gap` without corrupting canonical state | No protocol pressure |
| `c2-branch-outstanding-export.test.js` | C2 selected-branch death overlaps a blocked alternate successor export | No reconnect |
| `c2-reconnect-cross-dial.test.js` | C2 link loss overlaps two simultaneous reconnect dials | No route withdrawal |
| `c2-saturation-withdrawal.test.js` | C2 exact handler saturation overlaps an ACKed binding withdrawal | No node death |

Support ownership:

- `support/chaos-network.js` supplies the deterministic transport, exact fault
  rules, dial barriers, raw injection, and immutable positive ledger.
- `support/fixture.js` supplies uniform-node configuration, deterministic IDs,
  named barriers, and positive operations/delivery waiters.
- `support/raw-peer.js` supplies a schema-valid protocol peer used only to
  inject input that a conforming uniform node would never originate.

Run this gate with `npm run test:resilience`. The global architecture checker
enforces one self-descriptive Given/When/Then title per test and the 300-line
ceiling for every test file.
