# Uniform-node topology test map

Every node vertex is created through public `createNode()` and every topology uses a real loopback WebSocket.\
Raw peers appear only where the primary contract is an exact authoritative snapshot or physical-session close.

| File | Sole primary axis | Explicit non-goal |
|---|---|---|
| `chain-transit-depth.test.js` | Two transit nodes in series: transit-to-transit ingress, a path naming every node, and both directions | Volume and injected faults |
| `burst-admission.test.js` | Concurrent sends each settle definitely, excess rejects QUEUE_FULL, and routing survives data saturation | Sequential ordering |
| `stream-ordering.test.js` | Sustained traffic across one transit hop preserves order and returns handler capacity | Geometry beyond a line |
| `route-volume.test.js` | Many endpoints converge, export within the negotiated snapshot bound, and stay individually resolvable | Message volume |
| `star-convergence.test.js` | Multi-endpoint leaf reachability through one center | Alternative-path policy |
| `line-transit.test.js` | Symmetric two-hop JSON transit | Cyclic control plane |
| `triangle-loop-prevention.test.js` | Path-vector loop exclusion | Branch failover |
| `diamond-selection.test.js` | Healthy deterministic single-branch forwarding with an observable alternate | Branch failure and promotion |
| `restart-reconvergence.test.js` | Empty replacement state and reconvergence | Durable live-state restore |
| `withdrawal-binding-close.test.js` | One local binding close removes only its route | Whole-session loss |
| `withdrawal-snapshot-omission.test.js` | A successor authoritative set replaces omitted peer state | Policy rejection |
| `withdrawal-route-rejection.test.js` | A later per-route policy denial removes only its route | Transport loss |
| `withdrawal-session-loss.test.js` | One session closure purges all and only session-owned routes | Whole-node lifecycle |
| `withdrawal-node-stop.test.js` | Orderly node stop leaves no phantom next hop | Replacement restart |
