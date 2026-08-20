# Node ws transport test ownership

| Test file | Primary contract | Explicit non-goal |
|---|---|---|
| `conformance/acceptance-callback-fault.test.js` | Real callback containment invokes the reusable neutral case for all callback kinds | Application callback policy |
| `conformance/packet-order.test.js` | Real binary carrier invokes the reusable bidirectional packet-order case | Protocol decoding |
| `conformance/send-dispatch-cancellation.test.js` | Pre-dispatch non-acceptance and post-dispatch uncertain-tail terminalization | Remote application receipt |
| `contract/binary-packet-flow.test.js` | Synchronous byte snapshot and opaque non-UTF-8 binary flow | JSON validity |
| `contract/diagnostic-sink.test.js` | Optional neutral sink injection, separate cause, and throwing-sink containment | Logging backend |
| `contract/input-rejection.test.js` | Ordered text and over-limit rejection before one binding terminal | AGP parse failures |
| `contract/listener-lifecycle.test.js` | Stable listener terminal independent of transferred channel lifetime | Node lifecycle policy |
| `contract/listener-publication.test.js` | Ephemeral bind publishes its sanitized actual bound URL | Connect authority distribution |
| `contract/trusted-development-profile.test.js` | Exact ws-only profile, resolver behavior, and network/none/unauthenticated evidence | TLS and authentication |

Run with `npm test --workspace @agp/transport-node-ws`.
