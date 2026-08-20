import assert from "node:assert/strict";
import test from "node:test";

import {
  MANAGEMENT_SCHEMA_IDS,
  createManagementHttpServer,
  validateManagementSchema,
} from "../../dist/index.js";
import {
  createOperationsFixture,
  requestManagement,
} from "../fixtures/operations-fixture.js";

test("Given unsupported mutation, body, query, malformed, and unknown requests, when handled, then the closed safe status/error catalog responds without OperationsReader access", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  const { url } = await server.start();
  t.after(() => server.stop());
  fixture.resetCalls();

  const cases = [
    [{ path: "/v1/routes", method: "POST" }, 405, "METHOD_NOT_ALLOWED"],
    [
      {
        path: "/v1/routes",
        headers: { "content-length": "2" },
        body: "{}",
      },
      400,
      "BAD_REQUEST",
    ],
    [{ path: "/v1/routes?selected=true" }, 400, "BAD_REQUEST"],
    [{ path: "/v1/%zz" }, 400, "BAD_REQUEST"],
    [{ path: "/v1/unknown" }, 404, "NOT_FOUND"],
  ];
  for (const [request, status, code] of cases) {
    const response = await requestManagement(url, request);
    assert.equal(response.status, status);
    assert.equal(response.json.code, code);
    assert.equal(
      validateManagementSchema(
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        response.json,
      ).ok,
      true,
    );
  }
  assert.equal(
    Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
    0,
  );
});

test("Given a resource GET, when HEAD requests the same representation, then status and representation headers match while each request performs one query and HEAD emits no body", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  const { url } = await server.start();
  t.after(() => server.stop());
  fixture.resetCalls();

  const get = await requestManagement(url, { path: "/v1/routes" });
  const head = await requestManagement(url, {
    path: "/v1/routes",
    method: "HEAD",
  });
  assert.equal(head.status, get.status);
  assert.equal(head.headers["content-type"], get.headers["content-type"]);
  assert.equal(head.headers["content-length"], get.headers["content-length"]);
  assert.equal(head.headers["cache-control"], "no-store");
  assert.equal(head.text, "");
  assert.equal(fixture.calls.routes, 2);
});

test("Given any management path, when OPTIONS is requested, then safe discovery is bodyless and performs no SDK query or CORS grant", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  const { url } = await server.start();
  t.after(() => server.stop());
  fixture.resetCalls();

  const response = await requestManagement(url, {
    path: "/v1/routes",
    method: "OPTIONS",
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.allow, "GET, HEAD, OPTIONS");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["content-length"], "0");
  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal(response.text, "");
  assert.equal(
    Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
    0,
  );
});
