import assert from "node:assert/strict";
import test from "node:test";

import {
  MANAGEMENT_HTTP_LIMITS,
  MANAGEMENT_SCHEMA_IDS,
  createManagementHttpServer,
  validateManagementSchema,
} from "../../dist/index.js";
import {
  createOperationsFixture,
  requestManagement,
} from "../fixtures/operations-fixture.js";

test("Given a schema-valid response larger than the configured byte bound, when serialization measures it, then one SDK query is replaced by a bounded schema-valid RESPONSE_TOO_LARGE error", async (t) => {
  const fixture = createOperationsFixture({
    snapshot() {
      return {
        ...fixture.snapshots.aggregate,
        candidateRoutes: Array.from(
          { length: 16 },
          () => structuredClone(
            fixture.snapshots.aggregate.candidateRoutes[0],
          ),
        ),
      };
    },
  });
  const server = createManagementHttpServer(fixture.operations, {
    maxResponseBytes: MANAGEMENT_HTTP_LIMITS.minimumResponseBytes,
  });
  const { url } = await server.start();
  t.after(() => server.stop());
  fixture.resetCalls();

  const response = await requestManagement(url, { path: "/v1/snapshot" });
  assert.equal(response.status, 507);
  assert.equal(response.json.code, "RESPONSE_TOO_LARGE");
  assert.equal(response.text.length < 512, true);
  assert.equal(fixture.calls.snapshot, 1);
  assert.equal(
    validateManagementSchema(
      MANAGEMENT_SCHEMA_IDS.errorResponse,
      response.json,
    ).ok,
    true,
  );
});

test("Given a reader exception or invalid cyclic projection, when a resource is queried, then the adapter emits one redacted INTERNAL error and does not leak exception or object content", async (t) => {
  const cyclic = {};
  cyclic.self = cyclic;
  const fixture = createOperationsFixture({
    connections() {
      throw new Error("credential=do-not-leak");
    },
    counters() {
      return {
        ...fixture.snapshots.countersQuery,
        values: cyclic,
      };
    },
  });
  const server = createManagementHttpServer(fixture.operations);
  const { url } = await server.start();
  t.after(() => server.stop());

  const thrown = await requestManagement(url, { path: "/v1/connections" });
  const invalid = await requestManagement(url, { path: "/v1/counters" });
  for (const response of [thrown, invalid]) {
    assert.equal(response.status, 500);
    assert.equal(response.json.code, "INTERNAL");
    assert.doesNotMatch(response.text, /credential|do-not-leak|circular/i);
    assert.equal(
      validateManagementSchema(
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        response.json,
      ).ok,
      true,
    );
  }
  assert.equal(fixture.calls.connections, 1);
  assert.equal(fixture.calls.counters, 1);
});

test("Given a request target beyond the fixed UTF-8 byte bound, when admission checks it, then 414 is returned before any SDK query", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  const { url } = await server.start();
  t.after(() => server.stop());
  fixture.resetCalls();

  const response = await requestManagement(url, {
    path: `/${"a".repeat(MANAGEMENT_HTTP_LIMITS.maxRequestTargetBytes)}`,
  });
  assert.equal(response.status, 414);
  assert.equal(response.json.code, "BAD_REQUEST");
  assert.equal(
    Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
    0,
  );
});
