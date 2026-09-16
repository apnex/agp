import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { ManualClock } from "@agp/core";
import { createManagementHttpServer } from "@agp/management-http";
import { createLoopbackNode, expose, hasAckedExport, memoryPeer, stopAll, waitForSnapshot } from "../../test/support/uniform-topology.js";
import { CONNECTION_COLUMNS, ROUTE_COLUMNS, ParityIdSource, connectionTableRows, routeTableRows, parseCliTable } from "../../test/e2e/support/operations-parity.js";
import { runNative } from "./support/native-process.js";

test("given a frozen live node pair, when every native management verb and view executes, then SDK HTTP JSON and independent table cells agree without shell helpers", async (context) => {
  const clock = new ManualClock({ monotonicMs: 75000, wallTime: "2026-09-16T00:00:00.000Z" });
  const node = createLoopbackNode({ nodeId: "node.native.listener", listen: { host: "loopback", port: 12901, path: "/agp" }, holdTimeMs: 30000, dependencies: { clock, ids: new ParityIdSource("native-listener") } });
  let peer;
  let management;
  context.after(async () => { await management?.stop(); await stopAll(peer, node); });
  await expose(node, ["native/local"]);
  const started = await node.start();
  peer = createLoopbackNode({ nodeId: "node.native.peer", holdTimeMs: 30000, peers: [{ ...memoryPeer("native-peer", "node.native.listener", 12901), url: started.listener.publication.displayAddress }], dependencies: { clock, ids: new ParityIdSource("native-peer") } });
  await expose(peer, ["native/remote"]);
  await peer.start();
  await waitForSnapshot(node, (snapshot) => snapshot.connections[0]?.state === "Established" && snapshot.selectedRoutes.length === 2 && hasAckedExport(node, "native/local", "node.native.peer"), "native consumer convergence");
  management = createManagementHttpServer(node.operations, { host: "127.0.0.1", port: 0 });
  const address = await management.start();
  const kinds = { health: "Health", snapshot: "OperationsSnapshot", configuration: "Configuration", endpoints: "LocalEndpointList", connections: "ConnectionList", advertisements: "AdvertisementList", routes: "RouteTable", forwarding: "ForwardingList", resources: "Resources", counters: "Counters" };
  const definition = JSON.parse(await readFile(new URL("../spec/definition.json", import.meta.url)));
  const resources = Object.keys(kinds).sort();
  assert.deepEqual(Object.keys(definition.views).sort(), resources);
  assert.deepEqual(Object.keys(definition.contexts).filter((name) => name !== "root").sort(), resources);
  assert.equal(Object.values(definition.contexts).reduce((sum, value) => sum + Object.keys(value.commands).length, 0), 30);

  for (const name of resources) {
    const sdk = name === "health" ? node.operations.lifecycle() : node.operations[name]();
    const { schemaVersion, nodeId, instanceId, capturedAt, revision, ...data } = sdk;
    assert.equal(schemaVersion, "agp.operations/v1");
    const expected = { apiVersion: "agp.management/v1", kind: kinds[name], meta: { nodeId, instanceId, capturedAt, revision } };
    if (name === "health") expected.data = { lifecycle: data, healthy: data.state !== "Failed", ready: data.state === "Running" };
    else if (name === "routes") Object.assign(expected, { candidates: data.candidates, selected: data.selected });
    else if (["endpoints", "connections", "advertisements", "forwarding"].includes(name)) expected.items = data.items;
    else expected.data = data;
    const response = await fetch(`${address.url}/v1/${name}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected, `${name}: SDK/HTTP`);
    for (const words of [[`${name}.list`], [name, "show"], [name, "ls"]]) {
      const json = await runNative([...words, "--json", "--url", address.url], { PATH: "" });
      assert.deepEqual(JSON.parse(json.stdout), expected, `${words.join(" ")}: raw response`);
      assert.equal(json.stderr, "");
      const result = await runNative(["--url", address.url, "--events", ...words], { PATH: "" });
      const event = JSON.parse(result.stdout);
      assert.equal(event.status, "ok");
      assert.equal(event.result.invocation.observation.provider, "json-http-get-v1");
      assert.deepEqual(JSON.parse(event.result.invocation.output_json_text), expected);
      assert.equal(event.result.presentation.status, "ok", `${name}: presentation`);
      assert.deepEqual(event.result.presentation.display_rows, expectedCells(name, sdk), `${words.join(" ")}: display cells`);
    }
    const table = await runNative([name, "show", "--url", address.url], { PATH: "" });
    const columns = name === "connections" ? CONNECTION_COLUMNS : name === "routes" ? ROUTE_COLUMNS : definition.views[name].columns.map((column) => column.id);
    assert.deepEqual(parseCliTable(table.stdout, columns), expectedObjects(columns, expectedCells(name, sdk)), `${name}: printed table`);
  }
});

function expectedObjects(columns, rows) {
  return rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

test("given populated resource gauges at the HTTP boundary, when the native resource view renders them, then every current maximum and high-water value is preserved in sorted rows", async (context) => {
  const envelope = {
    apiVersion: "agp.management/v1", kind: "Resources",
    meta: { nodeId: "node.gauges", instanceId: "instance.gauges", capturedAt: "2026-09-16T00:00:00Z", revision: "0" },
    data: { gauges: { zeta: { current: "9007199254740993", maximum: "18446744073709551615", highWater: "9007199254740994" }, alpha: { current: "0", maximum: "8", highWater: "3" } } },
  };
  const server = createServer((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/v1/resources");
    response.end(JSON.stringify(envelope));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const result = await runNative(["resources", "show", "--url", `http://127.0.0.1:${server.address().port}`], { PATH: "" });
  assert.deepEqual(parseCliTable(result.stdout, ["resource", "current", "maximum", "high_water"]), [
    { resource: "alpha", current: "0", maximum: "8", high_water: "3" },
    { resource: "zeta", current: "9007199254740993", maximum: "18446744073709551615", high_water: "9007199254740994" },
  ]);
});
function text(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(sort(value));
  return String(value);
}
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
  return value;
}
function hop(value) { return value.kind === "local" ? "local" : `${value.nodeId}@${value.owningSessionId}`; }
function expectedCells(name, value) {
  const entries = (map) => Object.entries(map).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  switch (name) {
    case "connections": return connectionTableRows(value.items).map((row) => CONNECTION_COLUMNS.map((column) => row[column]));
    case "routes": return routeTableRows(value).map((row) => ROUTE_COLUMNS.map((column) => row[column]));
    case "health": return [[value.nodeId, value.state, String(value.state !== "Failed"), String(value.state === "Running"), value.stateSince]];
    case "snapshot": return [[value.nodeId, value.revision, value.lifecycle.state, value.listener.state, value.localEndpoints.length, value.connections.length, value.selectedRoutes.length, value.forwarding.length].map(text)];
    case "configuration": return entries(value.effective).map(([key, value]) => [key, text(value)]);
    case "endpoints": return value.items.map((item) => [item.endpoint, item.bindingId, String(item.active), item.registeredAt]);
    case "advertisements": return value.items.map((item) => [item.endpoint, item.originNodeId, item.advertisingNodeId, item.owningSessionId, item.receivedPath.join(" -> "), String(item.receivedRevision)]);
    case "forwarding": return value.items.map((item) => [item.endpoint, hop(item.nextHop), item.originNodeId, item.selectedRouteId, item.resolvedAtRevision]);
    case "resources": return entries(value.gauges).map(([key, value]) => [key, value.current, value.maximum, value.highWater]);
    case "counters": return entries(value.values).map(([key, value]) => [key, value]);
    default: throw new Error(`Missing independent oracle: ${name}`);
  }
}
