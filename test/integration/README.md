# Integration suite map

| File | Contract protected | Explicit non-overlap |
|---|---|---|
| `public-consumer.test.js` | Applications can compose a uniform node and management adapter from package-root exports only | No sockets, protocol behavior, or CLI rendering |
| `two-node-live-websocket.test.js` | Two public nodes establish over a real loopback WebSocket and route JSON in both directions | No multi-hop policy, failover, or management HTTP |
