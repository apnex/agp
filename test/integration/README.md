# Integration suite map

| File | Contract protected | Explicit non-overlap |
|---|---|---|
| `public-consumer.test.js` | Applications can compose a uniform node and management adapter from package-root exports only | No sockets, protocol behavior, or CLI rendering |
| `two-node-live-websocket.test.js` | Two public nodes establish over a real loopback WebSocket and route JSON in both directions | No multi-hop policy, failover, or management HTTP |
| `secure-websocket-star.test.js` | A star whose channels are protected by per-node pre-shared keys converges, transits JSON, and lets admission act on the observed principal | No mesh keying, rotation, or certificate profiles |
