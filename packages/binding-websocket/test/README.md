# WebSocket binding test ownership

| Test file | Primary contract | Explicit non-goal |
|---|---|---|
| `contract/packet-mapping.test.js` | Binary-message packet mapping, text rejection, and size precedence | Native library callbacks |
| `contract/reference-uniqueness.test.js` | Per-kind logical reference uniqueness | Resolver construction |
| `contract/schema-catalog.test.js` | Sovereign generated binding catalog and closed configuration | Common transport schemas |
| `contract/terminal-mapping.test.js` | Exact empty-reason native close and failure mappings | Physical close completion |
| `unit/configuration-profile.test.js` | Exact token and trusted-development URL/profile validation | TLS or authentication |

Run with `npm test --workspace @agp/binding-websocket`.
