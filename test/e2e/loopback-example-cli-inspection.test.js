import assert from "node:assert/strict";
import test from "node:test";

import {
  CONNECTION_COLUMNS,
  ROUTE_COLUMNS,
  eventuallyAsync,
  getManagementJson,
  parseCliTable,
  runCliJson,
  runCliTable,
} from "./support/operations-parity.js";
import {
  LoopbackExampleProcess,
} from "./support/loopback-example-process.js";

const expectedEndpoints = Object.freeze([
  "billing/charge",
  "catalog/products.get",
  "hub/service",
  "inventory/reserve",
  "notifications/send",
  "orders/create",
  "shared/service",
  "shipping/quote",
]);

test("given the sovereign persistent Loopback example when its three management APIs and read-only CLI are inspected then the live star is converged routable and gracefully stoppable", async (context) => {
  const example = new LoopbackExampleProcess();
  context.after(() => example.stop());

  const ready = await example.start();
  const delivered = await example.waitForDelivery();
  assert.equal(ready.topology, "loopback-hub-spokes");
  assert.equal(typeof delivered, "object");
  assert.notEqual(delivered, null);
  assert.equal(example.alive, true);

  const descriptions = [
    ["hub", ready.nodes?.hub, 2],
    ["alpha", ready.nodes?.alpha, 1],
    ["beta", ready.nodes?.beta, 1],
  ];
  for (const [name, node] of descriptions) {
    assert.equal(
      validManagementUrl(node?.managementUrl),
      true,
      `${name} management URL`,
    );
  }

  await Promise.all(descriptions.map(([name, node, sessionCount]) =>
    eventuallyAsync(async () => {
      const [connections, routes] = await Promise.all([
        getManagementJson(node.managementUrl, "connections"),
        getManagementJson(node.managementUrl, "routes"),
      ]);
      return (
        hasEstablishedSessions(connections, sessionCount)
        && sameEndpoints(routes.selected, expectedEndpoints)
      )
        ? true
        : undefined;
    }, `${name} management convergence`, 10_000)
  ));

  const observations = await Promise.all(descriptions.map(
    async ([name, node, sessionCount]) => {
      const [
        connectionsJson,
        routesJson,
        connectionsTable,
        routesTable,
      ] = await Promise.all([
        runCliJson("connections.list", node.managementUrl),
        runCliJson("routes.list", node.managementUrl),
        runCliTable("connections.list", node.managementUrl),
        runCliTable("routes.list", node.managementUrl),
      ]);
      return {
        name,
        sessionCount,
        connectionsJson,
        routesJson,
        connectionRows: parseCliTable(
          connectionsTable,
          CONNECTION_COLUMNS,
        ),
        routeRows: parseCliTable(routesTable, ROUTE_COLUMNS),
      };
    },
  ));

  for (const observation of observations) {
    assert.equal(
      hasEstablishedSessions(
        observation.connectionsJson,
        observation.sessionCount,
      ),
      true,
      `${observation.name} JSON connections`,
    );
    assert.equal(
      observation.connectionRows.length,
      observation.sessionCount,
      `${observation.name} table connection count`,
    );
    assert.equal(
      observation.connectionRows.every(
        ({ session_id, state }) =>
          /^[0-9a-f]{6}$/.test(session_id) && state === "Established",
      ),
      true,
      `${observation.name} table connections`,
    );
    assert.equal(
      sameEndpoints(
        observation.routesJson.selected,
        expectedEndpoints,
      ),
      true,
      `${observation.name} JSON routes`,
    );
    assert.deepEqual(
      observation.routeRows
        .filter(({ selected }) => selected === ">")
        .map(({ endpoint }) => endpoint)
        .sort(),
      expectedEndpoints,
      `${observation.name} table routes`,
    );
    assert.equal(
      observation.routeRows
        .filter(({ selected }) => selected === ">")
        .every(({ path }) => path.length > 0),
      true,
      `${observation.name} selected paths`,
    );
  }

  assert.equal(example.alive, true);
  assert.deepEqual(
    await example.stop(),
    { code: 0, signal: null },
  );
  assert.equal(example.alive, false);
});

function hasEstablishedSessions(connections, count) {
  return (
    connections.items.length === count
    && connections.items.every(
      ({ sessionId, state }) =>
        /^[0-9a-f]{6}$/.test(sessionId) && state === "Established",
    )
  );
}

function sameEndpoints(routes, expected) {
  const actual = routes.map(({ endpoint }) => endpoint).sort();
  return actual.length === expected.length
    && actual.every((endpoint, index) => endpoint === expected[index]);
}

function validManagementUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:"
      && url.hostname === "127.0.0.1"
      && Number(url.port) > 0
    );
  } catch {
    return false;
  }
}
