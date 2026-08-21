# Examples

All examples use the topology-neutral `@agp/node` implementation.\
A node's listener, configured peers, transit policy, and locally exposed endpoints determine its place in a topology; there are no separate hub and spoke runtimes.

Build the workspace, then run the self-contained walking skeleton:
```bash
npm run build
node examples/websocket-star.mjs
```

It starts three uniform nodes using the WebSocket adapter on ephemeral literal-loopback TCP addresses, waits for selected destination routes and ACKed source exports at every hop, sends a JSON request from alpha through the hub to beta, routes the reply back, prints the hub's selected routes, and performs bounded cleanup.\
This is intentionally distinct from the process-local `@agp/transport-loopback` implementation.

Keep that topology alive for asynchronous CLI inspection with:
```bash
node examples/websocket-star.mjs --persist
```

Its `AGP_TOPOLOGY_READY` record contains the three ephemeral management URLs.\
Terminate persistent mode with `Ctrl-C` or `SIGTERM`.

## Process-local Loopback geometry

[`loopback-star/`](./loopback-star/README.md) assembles the same uniform-node star over the canonical production `@agp/transport-loopback` fabric.\
It is a real bounded transport, not a test mock.\
Because the fabric is process-local, all three nodes intentionally share one composition-root process while retaining separate RIBs, operations readers, endpoint sets, and management URLs.\
The example includes a request/reply walkthrough and a `--persist` mode for asynchronous `agpctl` inspection.

---

## Independently operated geometry

[`independent-star/`](./independent-star/README.md) runs the hub, alpha, and beta as independently startable operating-system processes.\
It provides foreground and safe PID-managed launch modes, distinct loopback management ports, multiple named endpoints per leaf, LAN listener configuration, and read-only CLI examples for every node's RIB.
