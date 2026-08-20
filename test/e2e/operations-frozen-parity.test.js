import assert from "node:assert/strict";
import test from "node:test";
import { ManualClock } from "@agp/core";
import { createManagementHttpServer } from "@agp/management-http";
import {
  createLoopbackNode,
  expose,
  hasAckedExport,
  memoryPeer,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";
import {
  CONNECTION_COLUMNS,
  ParityIdSource,
  ROUTE_COLUMNS,
  asManagementConnections,
  asManagementRoutes,
  connectionTableRows,
  getManagementJson,
  parseCliTable,
  routeTableRows,
  runCliJson,
  runCliTable,
} from "./support/operations-parity.js";

test("given one converged topology under a frozen clock, when SDK HTTP CLI JSON and static tables sample it, then every surface represents the exact same capture", async (context) => {
  const frozenAt = "2026-07-30T12:34:56.789Z";
  const clock = new ManualClock({
    monotonicMs: 75_000,
    wallTime: frozenAt,
  });
  const listener = createLoopbackNode({
    nodeId: "node.frozen.listener",
    listen: { host: "loopback", port: 12501, path: "/agp" },
    holdTimeMs: 30_000,
    dependencies: {
      clock,
      ids: new ParityIdSource("frozen-listener"),
    },
  });
  const started = await listener.start();
  const dialer = createLoopbackNode({
    nodeId: "node.frozen.dialer",
    peers: [{
      ...memoryPeer(
        "dialer-listener",
        "node.frozen.listener",
        12501,
      ),
      url: started.listener.publication.displayAddress,
    }],
    holdTimeMs: 30_000,
    dependencies: {
      clock,
      ids: new ParityIdSource("frozen-dialer"),
    },
  });
  const management = createManagementHttpServer(
    listener.operations,
    { host: "127.0.0.1", port: 0 },
  );
  context.after(async () => {
    await management.stop();
    await stopAll(dialer, listener);
  });

  await expose(listener, ["frozen/listener"]);
  await expose(dialer, ["frozen/dialer"]);
  await dialer.start();
  await waitForSnapshot(
    listener,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.selectedRoutes.length === 2
      && hasAckedExport(
        listener,
        "frozen/listener",
        "node.frozen.dialer",
      ),
    "frozen topology convergence and ACKed source export",
  );
  const address = await management.start();

  const sdkConnections = listener.operations.connections();
  const sdkRoutes = listener.operations.routes();
  const expectedConnections = asManagementConnections(sdkConnections);
  const expectedRoutes = asManagementRoutes(sdkRoutes);
  const httpConnections = await getManagementJson(
    address.url,
    "connections",
  );
  const httpRoutes = await getManagementJson(address.url, "routes");
  const cliConnections = await runCliJson(
    "connections.list",
    address.url,
  );
  const cliRoutes = await runCliJson("routes.list", address.url);
  const connectionTable = await runCliTable(
    "connections.list",
    address.url,
  );
  const routeTable = await runCliTable("routes.list", address.url);

  assert.equal(sdkConnections.capturedAt, frozenAt);
  assert.equal(sdkRoutes.capturedAt, frozenAt);
  assert.deepEqual(httpConnections, expectedConnections);
  assert.deepEqual(cliConnections, expectedConnections);
  assert.deepEqual(httpRoutes, expectedRoutes);
  assert.deepEqual(cliRoutes, expectedRoutes);
  assert.deepEqual(
    parseCliTable(connectionTable, CONNECTION_COLUMNS),
    connectionTableRows(sdkConnections.items),
  );
  assert.deepEqual(
    parseCliTable(routeTable, ROUTE_COLUMNS),
    routeTableRows(sdkRoutes),
  );
});
