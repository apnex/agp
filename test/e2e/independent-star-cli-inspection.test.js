import assert from "node:assert/strict";
import test from "node:test";

import {
  CONNECTION_COLUMNS,
  ROUTE_COLUMNS,
  parseCliTable,
  runCliJson,
  runCliTable,
} from "./support/operations-parity.js";
import {
  IndependentProcessTopology,
  STAR_ENDPOINTS,
  eventuallyProcess,
  getProcessManagement,
  startIndependentStar,
} from "./support/independent-processes.js";

test("given a converged independent uniform-node star when separate read-only CLI processes inspect every management URL then sessions and all selected endpoint paths are visible", async (context) => {
  const topology = await IndependentProcessTopology.create();
  context.after(() => topology.dispose());
  const star = await startIndependentStar(topology);
  const descriptions = [
    ["hub", star.hub, 2],
    ["alpha", star.alpha, 1],
    ["beta", star.beta, 1],
  ];

  await Promise.all(descriptions.map(([, node, sessionCount]) =>
    eventuallyProcess(async () => {
      const [connections, routes] = await Promise.all([
        getProcessManagement(node, "connections"),
        getProcessManagement(node, "routes"),
      ]);
      return (
        connections.items.length === sessionCount
        && connections.items.every(({ state }) => state === "Established")
        && sameEndpoints(routes.selected, STAR_ENDPOINTS.all)
      )
        ? true
        : undefined;
    }, `${node.ready.nodeId} CLI-visible convergence`)
  ));

  const observations = await Promise.all(descriptions.map(
    async ([name, node, sessionCount]) => {
      const url = node.ready.managementUrl;
      const [
        connectionsJson,
        routesJson,
        connectionsTable,
        routesTable,
      ] = await Promise.all([
        runCliJson("connections.list", url),
        runCliJson("routes.list", url),
        runCliTable("connections.list", url),
        runCliTable("routes.list", url),
      ]);
      return {
        name,
        node,
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
      observation.connectionsJson.items.length,
      observation.sessionCount,
      observation.name,
    );
    assert.equal(
      observation.connectionsJson.items.every(
        ({ sessionId, state }) =>
          /^[0-9a-f]{6}$/.test(sessionId) && state === "Established",
      ),
      true,
      observation.name,
    );
    assert.equal(
      observation.connectionRows.every(
        ({ session_id, state }) =>
          /^[0-9a-f]{6}$/.test(session_id) && state === "Established",
      ),
      true,
      observation.name,
    );
    assert.deepEqual(
      observation.routesJson.selected.map(({ endpoint }) => endpoint).sort(),
      STAR_ENDPOINTS.all,
      observation.name,
    );
    assert.deepEqual(
      observation.routeRows
        .filter(({ selected }) => selected === ">")
        .map(({ endpoint }) => endpoint)
        .sort(),
      STAR_ENDPOINTS.all,
      observation.name,
    );
    assert.equal(
      observation.routeRows.every(
        ({ path }) => path.length > 0,
      ),
      true,
      observation.name,
    );
    assert.equal(observation.node.alive, true, observation.name);
  }
});

function sameEndpoints(routes, endpoints) {
  const actual = routes.map(({ endpoint }) => endpoint).sort();
  return actual.length === endpoints.length
    && actual.every((endpoint, index) => endpoint === endpoints[index]);
}
