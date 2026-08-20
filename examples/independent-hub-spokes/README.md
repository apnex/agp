# Independently operated uniform-node star

This example assembles a one-hub/two-leaf star from one executable:
[`node.mjs`](./node.mjs). `hub`, `alpha`, and `beta` select the literal
configuration documents under [`config/`](./config/); they do not select
different implementations. Every process owns a RIB, consults it for data
forwarding, and exposes the same SDK operations through a literal-loopback HTTP
management API. This geometry deliberately composes the Node.js WebSocket
adapter; WebSocket configuration remains outside the carrier-neutral
`NodeConfig`.

Build once from the workspace root:

```bash
npm run build
```

## Start and stop managed background processes

Start the entire geometry, inspect its exact processes, and stop it:

```bash
./examples/independent-hub-spokes/run.sh all
./examples/independent-hub-spokes/status.sh all
./examples/independent-hub-spokes/stop.sh all
```

The processes can instead be operated independently and in any order:

```bash
./examples/independent-hub-spokes/run.sh alpha
./examples/independent-hub-spokes/run.sh hub
./examples/independent-hub-spokes/run.sh beta

./examples/independent-hub-spokes/stop.sh alpha
./examples/independent-hub-spokes/stop.sh beta
./examples/independent-hub-spokes/stop.sh hub
```

Leaves start their management API immediately and keep reconnecting while the
hub is absent. After a hub restart, they establish new sessions and advertise
their endpoint sets again.

The scripts keep one PID file and one current log per profile under
`examples/independent-hub-spokes/.run/`. Existing logs and stale PID records
are archived with a timestamp. Stop and status operations validate the exact
entrypoint and profile recorded in `/proc` before acting; they never use a
name-wide process kill. Set `AGP_EXAMPLE_STATE_DIR` to use another state
directory.

## Foreground operation

The shared program runs in the foreground by default:

```bash
node examples/independent-hub-spokes/node.mjs hub
node examples/independent-hub-spokes/node.mjs alpha
node examples/independent-hub-spokes/node.mjs beta
```

The launcher also provides an explicit foreground form for one profile:

```bash
./examples/independent-hub-spokes/run.sh alpha --foreground
```

`Ctrl-C` and `SIGTERM` trigger bounded node and management-server cleanup.
The convenience `hub.mjs` and `spoke.mjs alpha|beta` commands are thin wrappers
around this same entrypoint.

## Defaults

| Profile | Node ID | WebSocket adapter | Management HTTP |
|---|---|---|---|
| `hub` | `hub` | `ws://127.0.0.1:47100/agp` | `http://127.0.0.1:47101` |
| `alpha` | `spoke.alpha` | dials hub | `http://127.0.0.1:47111` |
| `beta` | `spoke.beta` | dials hub | `http://127.0.0.1:47112` |

The hub exposes one named endpoint:

```text
hub/service
```

Alpha exposes four named endpoints:

```text
catalog/products.get
inventory/reserve
orders/create
shared/service
```

Beta exposes four named endpoints:

```text
billing/charge
notifications/send
shipping/quote
shared/service
```

`shared/service` is deliberately advertised by both spokes. The hub retains
both eligible direct candidates and deterministically selects the
`spoke.alpha` origin because equal route classes and path lengths are resolved
by the lowest origin node ID. Each spoke selects its own local binding for the
same endpoint. Since only the selected path is exported and a path is not
advertised back toward a node already in that path, both alternatives are not
expected to appear at every spoke.

The shared program accepts `--management-port PORT` for every profile,
`--ws-host HOST` and `--ws-port PORT` for the hub, and
`--hub-url ws://HOST:PORT/agp` for either leaf. Port `0` requests an ephemeral
port.

Equivalent environment overrides are:

| Variable | Purpose |
|---|---|
| `AGP_HUB_WS_HOST` | hub WebSocket bind host |
| `AGP_HUB_WS_PORT` | hub WebSocket bind port |
| `AGP_HUB_URL` | WebSocket URL dialled by alpha and beta |
| `AGP_HUB_MANAGEMENT_PORT` | hub loopback management port |
| `AGP_ALPHA_MANAGEMENT_PORT` | alpha loopback management port |
| `AGP_BETA_MANAGEMENT_PORT` | beta loopback management port |
| `AGP_EXAMPLE_STATE_DIR` | launcher PID and log directory |

Command-line options take precedence over environment variables.
The overrides are deployment overlays. Each JSON profile keeps carrier-neutral
`NodeConfig` under `config`, WebSocket adapter bindings under `transport`, and
the endpoint and management intent alongside them. Matching `transportRef`
values are the only join between the two sovereign configurations.

For example, alpha's peer intent and carrier binding are separate:

```json
{
  "config": {
    "nodeId": "spoke.alpha",
    "peers": [{
      "adjacencyId": "to-hub",
      "expectedNodeId": "hub",
      "transportRef": "ws.hub"
    }]
  },
  "transport": {
    "listeners": [],
    "targets": [{
      "transportRef": "ws.hub",
      "url": "ws://127.0.0.1:47100/agp",
      "compression": { "mode": "disabled" },
      "security": { "mode": "trusted-development" }
    }]
  }
}
```

## Inspect each RIB asynchronously

The CLI can query the management API while the node continues running:

```bash
AGP_MANAGEMENT_URL=http://127.0.0.1:47101 ./cli/agpctl connections.list
AGP_MANAGEMENT_URL=http://127.0.0.1:47101 ./cli/agpctl routes.list

AGP_MANAGEMENT_URL=http://127.0.0.1:47111 ./cli/agpctl routes.list
AGP_MANAGEMENT_URL=http://127.0.0.1:47112 ./cli/agpctl routes.list
```

For a one-second live view:

```bash
watch -n 1 env AGP_MANAGEMENT_URL=http://127.0.0.1:47101 \
  ./cli/agpctl connections.list
```

## Use the WebSocket listener over a LAN

Bind the hub listener to its LAN interfaces:

```bash
AGP_HUB_WS_HOST=0.0.0.0 \
  ./examples/independent-hub-spokes/run.sh hub
```

On each leaf host, provide a URL containing the hub's reachable LAN address:

```bash
AGP_HUB_URL=ws://192.0.2.10:47100/agp \
  ./examples/independent-hub-spokes/run.sh alpha
```

The example deliberately leaves management HTTP on loopback. Its WebSocket
security declaration and admission policies are development-only
(`trusted-development`/`allow`): deploying it on an untrusted network requires
a separately reviewed authenticated and encrypted binding, authorization, and
identity-admission posture.
