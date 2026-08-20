import assert from "node:assert/strict";
import test from "node:test";

// Owns the exact canonical OperationsReader-to-HTTP projection boundary.
import {
  MANAGEMENT_SCHEMA_IDS,
  createManagementHttpServer,
  validateManagementSchema,
} from "../../dist/index.js";
import {
  createOperationsFixture,
  requestManagement,
} from "../fixtures/operations-fixture.js";

const resources = [
  ["/v1/health", "lifecycle", MANAGEMENT_SCHEMA_IDS.healthResponse],
  ["/v1/snapshot", "snapshot", MANAGEMENT_SCHEMA_IDS.operationsResponse],
  [
    "/v1/configuration",
    "configuration",
    MANAGEMENT_SCHEMA_IDS.configurationResponse,
  ],
  [
    "/v1/endpoints",
    "endpoints",
    MANAGEMENT_SCHEMA_IDS.localEndpointsResponse,
  ],
  [
    "/v1/connections",
    "connections",
    MANAGEMENT_SCHEMA_IDS.connectionsResponse,
  ],
  [
    "/v1/advertisements",
    "advertisements",
    MANAGEMENT_SCHEMA_IDS.advertisementsResponse,
  ],
  ["/v1/routes", "routes", MANAGEMENT_SCHEMA_IDS.routesResponse],
  [
    "/v1/forwarding",
    "forwarding",
    MANAGEMENT_SCHEMA_IDS.forwardingResponse,
  ],
  ["/v1/resources", "resources", MANAGEMENT_SCHEMA_IDS.resourcesResponse],
  ["/v1/counters", "counters", MANAGEMENT_SCHEMA_IDS.countersResponse],
];

test("Given every stable management resource, when each GET is handled, then exactly one matching OperationsReader call produces one schema-valid no-store response", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  const { url } = await server.start();
  t.after(() => server.stop());

  for (const [path, query, schemaId] of resources) {
    fixture.resetCalls();
    const response = await requestManagement(url, { path });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers["cache-control"], "no-store", path);
    assert.equal(response.headers["x-content-type-options"], "nosniff", path);
    assert.equal(fixture.calls[query], 1, path);
    assert.equal(
      Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
      1,
      path,
    );
    const validation = validateManagementSchema(schemaId, response.json);
    assert.equal(
      validation.ok,
      true,
      `${path}: ${JSON.stringify(validation)}`,
    );
    assert.deepEqual(response.json.meta, {
      nodeId: "node.management",
      instanceId: "instance-1",
      capturedAt: "2026-07-30T06:00:00.000Z",
      revision: "7",
    });
  }
});

test("Given representative canonical SDK snapshots, when management projects them, then payload fields are preserved exactly without route, session, counter, or topology inference", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  const { url } = await server.start();
  t.after(() => server.stop());

  const health = await requestManagement(url, { path: "/v1/health" });
  const snapshot = await requestManagement(url, { path: "/v1/snapshot" });
  const endpoints = await requestManagement(url, { path: "/v1/endpoints" });
  const routes = await requestManagement(url, { path: "/v1/routes" });
  const counters = await requestManagement(url, { path: "/v1/counters" });
  const {
    schemaVersion: _schemaVersion,
    nodeId: _nodeId,
    instanceId: _instanceId,
    capturedAt: _capturedAt,
    revision: _revision,
    ...aggregateData
  } = fixture.snapshots.aggregate;

  assert.deepEqual(health.json.data, {
    lifecycle: fixture.snapshots.lifecycle,
    healthy: true,
    ready: true,
  });
  assert.deepEqual(snapshot.json.data, aggregateData);
  assert.deepEqual(endpoints.json.items, fixture.snapshots.endpoints.items);
  assert.deepEqual(routes.json.candidates, fixture.snapshots.routes.candidates);
  assert.deepEqual(routes.json.selected, fixture.snapshots.routes.selected);
  assert.deepEqual(counters.json.data, fixture.snapshots.counters);
  assert.doesNotMatch(JSON.stringify(snapshot.json), /"role"/);
});
