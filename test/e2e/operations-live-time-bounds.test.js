import assert from "node:assert/strict";
import test from "node:test";
import { createManagementHttpServer } from "@agp/management-http";
import {
  createWebSocketNode,
  expose,
  hasAckedExport,
  memoryPeer,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";
import {
  CONNECTION_COLUMNS,
  asManagementConnections,
  connectionTableRows,
  establishedDuration,
  eventuallyAsync,
  getManagementJson,
  holdRemaining,
  parseCliTable,
  parseTtl,
  parseUptime,
  runCliJson,
  runCliTable,
  withoutLiveConnectionTime,
} from "./support/operations-parity.js";

test("given two public nodes with a live finite-hold WebSocket session, when SDK HTTP and CLI sample it separately, then non-time state is identical and monotonic uptime and TTL remain bounded with one-second display steps", async (context) => {
  const listener = createWebSocketNode({
    nodeId: "node.live.listener",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    holdTimeMs: 120_000,
  });
  let dialer;
  let management;
  context.after(async () => {
    await management?.stop();
    await stopAll(dialer, listener);
  });
  await expose(listener, ["live/listener"]);
  const started = await listener.start();
  dialer = createWebSocketNode({
    nodeId: "node.live.dialer",
    holdTimeMs: 120_000,
    peers: [{
      ...memoryPeer("dialer-listener", "node.live.listener", 1),
      url: started.listener.publication.displayAddress,
    }],
  });
  await expose(dialer, ["live/dialer"]);
  await dialer.start();
  await waitForSnapshot(
    listener,
    (snapshot) =>
      snapshot.connections[0]?.state === "Established"
      && snapshot.selectedRoutes.length === 2
      && hasAckedExport(
        listener,
        "live/listener",
        "node.live.dialer",
      ),
    "live convergence and ACKed source export",
  );
  management = createManagementHttpServer(
    listener.operations,
    { host: "127.0.0.1", port: 0 },
  );
  const address = await management.start();

  const sdk = asManagementConnections(listener.operations.connections());
  const http = await bracketJson(
    listener,
    () => getManagementJson(address.url, "connections"),
    "revision-stable HTTP connection sample",
  );
  const cliJson = await bracketJson(
    listener,
    () => runCliJson("connections.list", address.url),
    "revision-stable CLI JSON connection sample",
  );
  const cliTable = await bracketTable(
    listener,
    () => runCliTable("connections.list", address.url),
    "revision-stable CLI table connection sample",
  );

  assert.equal(sdk.items.length, 1);
  assert.equal(sdk.items[0].state, "Established");
  assertBoundedJsonSample(http, sdk);
  assertBoundedJsonSample(cliJson, sdk);
  assertBoundedTableSample(cliTable, sdk);

  await eventuallyAsync(() => {
    const current = asManagementConnections(
      listener.operations.connections(),
    );
    const phase = establishedDuration(current) % 1_000;
    return current.meta.revision === sdk.meta.revision
        && phase >= 50
        && phase <= 150
      ? current
      : undefined;
  }, "an early phase of a live uptime display second");
  const initial = await bracketTable(
    listener,
    () => runCliTable("connections.list", address.url),
    "initial aligned CLI display sample",
  );
  assertBoundedTableSample(initial, sdk);
  const initialRow = tableRow(initial);
  const initialUptime = parseUptime(initialRow.uptime);
  const initialTtl = parseTtl(initialRow.ttl);

  const next = await eventuallyAsync(async () => {
    const sample = await bracketTable(
      listener,
      () => runCliTable("connections.list", address.url),
      "next revision-stable CLI display sample",
    );
    const row = tableRow(sample);
    return parseUptime(row.uptime) === initialUptime + 1
        && parseTtl(row.ttl) === initialTtl - 1
      ? sample
      : undefined;
  }, "the immediately next one-second uptime and hold-TTL display state");
  assertBoundedTableSample(next, sdk);
  assert.equal(parseUptime(tableRow(next).uptime), initialUptime + 1);
  assert.equal(parseTtl(tableRow(next).ttl), initialTtl - 1);
});

async function bracketJson(node, action, description) {
  return eventuallyAsync(async () => {
    const before = asManagementConnections(node.operations.connections());
    const value = await action();
    const after = asManagementConnections(node.operations.connections());
    return sameCapture(before, value, after)
      ? { before, value, after }
      : undefined;
  }, description);
}

async function bracketTable(node, action, description) {
  return eventuallyAsync(async () => {
    const before = asManagementConnections(node.operations.connections());
    const value = await action();
    const after = asManagementConnections(node.operations.connections());
    return sameCapture(before, after)
      ? { before, value, after }
      : undefined;
  }, description);
}

function assertBoundedJsonSample(sample, sdk) {
  assert.deepEqual(
    withoutLiveConnectionTime(sample.value),
    withoutLiveConnectionTime(sdk),
  );
  assert.ok(
    establishedDuration(sample.value) >= establishedDuration(sample.before),
  );
  assert.ok(
    establishedDuration(sample.value) <= establishedDuration(sample.after),
  );
  assert.ok(holdRemaining(sample.value) <= holdRemaining(sample.before));
  assert.ok(holdRemaining(sample.value) >= holdRemaining(sample.after));
  assert.ok(
    Date.parse(sample.value.meta.capturedAt)
      >= Date.parse(sample.before.meta.capturedAt),
  );
  assert.ok(
    Date.parse(sample.value.meta.capturedAt)
      <= Date.parse(sample.after.meta.capturedAt),
  );
}

function assertBoundedTableSample(sample, sdk) {
  const row = tableRow(sample);
  const expected = connectionTableRows(sdk.items)[0];
  assert.deepEqual(withoutDisplayTime(row), withoutDisplayTime(expected));
  const uptime = parseUptime(row.uptime);
  assert.ok(
    uptime >= Math.floor(establishedDuration(sample.before) / 1_000),
  );
  assert.ok(
    uptime <= Math.floor(establishedDuration(sample.after) / 1_000),
  );
  const ttl = parseTtl(row.ttl);
  assert.ok(ttl <= Math.ceil(holdRemaining(sample.before) / 1_000));
  assert.ok(ttl >= Math.ceil(holdRemaining(sample.after) / 1_000));
  assert.equal(sample.before.meta.instanceId, sdk.meta.instanceId);
  assert.equal(sample.before.meta.revision, sdk.meta.revision);
}

function tableRow(sample) {
  const rows = parseCliTable(sample.value, CONNECTION_COLUMNS);
  if (rows.length !== 1) throw new Error("expected one CLI connection row");
  return rows[0];
}

function sameCapture(...values) {
  const [first, ...rest] = values;
  return rest.every((value) =>
    value?.meta?.nodeId === first.meta.nodeId
    && value.meta.instanceId === first.meta.instanceId
    && value.meta.revision === first.meta.revision
  );
}

function withoutDisplayTime(row) {
  const value = { ...row };
  delete value.uptime;
  delete value.ttl;
  return value;
}
