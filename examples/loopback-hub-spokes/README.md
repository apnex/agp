# Process-local Loopback uniform-node star

This sovereign example assembles one transit node and two leaves from three
instances of the same topology-neutral `@agp/node` implementation. It uses the
canonical production `@agp/transport-loopback` fabric—not a mock or a
test-only adapter. Each node owns its own FSMs, sessions, RIB/FIB, endpoints,
and management projection.

Loopback is intentionally process-local. The three nodes therefore share one
composition-root process that owns their bounded fabric. That composition
root is the only code that sees Loopback addresses or fabric configuration;
each node receives a scoped carrier-neutral transport port joined to its
`NodeConfig` by logical `transportRef` values.

Build once from the workspace root, then run the complete delivery
walkthrough:

```bash
npm run build
node examples/loopback-hub-spokes/example.mjs
```

The example starts all three nodes, waits for route convergence and ACKed
source exports, delivers a JSON request from alpha through the hub to beta,
routes the reply back, prints structured evidence, and performs bounded
cleanup.

## Persistent inspection

Keep the same topology running for asynchronous SDK and CLI inspection:

```bash
node examples/loopback-hub-spokes/example.mjs --persist
```

The default management endpoints are separately addressable even though all
three nodes share one process:

| Profile | Node ID | Management HTTP |
|---|---|---|
| `hub` | `hub` | `http://127.0.0.1:47201` |
| `alpha` | `spoke.alpha` | `http://127.0.0.1:47211` |
| `beta` | `spoke.beta` | `http://127.0.0.1:47212` |

Query any node while the topology continues running:

```bash
AGP_MANAGEMENT_URL=http://127.0.0.1:47201 \
  ./cli/agpctl connections.list
AGP_MANAGEMENT_URL=http://127.0.0.1:47201 \
  ./cli/agpctl routes.list

AGP_MANAGEMENT_URL=http://127.0.0.1:47211 \
  ./cli/agpctl routes.list
AGP_MANAGEMENT_URL=http://127.0.0.1:47212 \
  ./cli/agpctl routes.list
```

Use `Ctrl-C` to stop persistent mode. `SIGTERM` has the same bounded shutdown
path: management servers stop, endpoint bindings close, nodes stop, and the
composition root closes its fabric last.

The management ports can be overridden independently:

| Variable | Purpose |
|---|---|
| `AGP_LOOPBACK_HUB_MANAGEMENT_PORT` | hub loopback management port |
| `AGP_LOOPBACK_ALPHA_MANAGEMENT_PORT` | alpha loopback management port |
| `AGP_LOOPBACK_BETA_MANAGEMENT_PORT` | beta loopback management port |

Port `0` requests an ephemeral management port.

## Sovereign configuration

The example keeps each ownership boundary visible:

- [`config/fabric.json`](./config/fabric.json) declares the explicitly owned,
  bounded Loopback fabric;
- [`config/hub.json`](./config/hub.json),
  [`config/alpha.json`](./config/alpha.json), and
  [`config/beta.json`](./config/beta.json) keep carrier-neutral node intent
  separate from that node's Loopback adapter bindings;
- [`profiles.mjs`](./profiles.mjs) validates the configuration documents and
  their logical-reference joins;
- [`topology-runtime.mjs`](./topology-runtime.mjs) is the composition root that
  owns construction and teardown; and
- [`example.mjs`](./example.mjs) supplies the observable request/reply
  walkthrough and persistent operating mode.

There is no implicit global fabric and no transport detail in the AGP kernel.
Replacing Loopback remains a composition decision; the protocol FSM, session
ownership, route exchange, RIB/FIB decisions, and JSON data plane are
unchanged.
