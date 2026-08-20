import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

// Owns the CLI's bounded read-only HTTP driver boundary.
import {
  cliRoot,
  createJsonServer,
  readJsonFixture,
  runBash,
} from "../fixtures/process-fixture.js";

const connectionsDriver = path.join(
  cliRoot,
  "drv/drv.connections.list.sh",
);
const routesDriver = path.join(cliRoot, "drv/drv.routes.list.sh");

test("given valid management documents when each driver runs then it performs one exact read-only GET and emits one JSON document", async (t) => {
  const connections = await readJsonFixture("connections-empty.json");
  const routes = await readJsonFixture("routes-cases.json");
  const server = await createJsonServer((request) => ({
    body: request.url === "/v1/routes" ? routes : connections,
  }));
  t.after(() => server.close());

  const connectionResult = await runBash(connectionsDriver, [server.url]);
  const routeResult = await runBash(routesDriver, [server.url]);

  assert.equal(connectionResult.code, 0, connectionResult.stderr);
  assert.equal(routeResult.code, 0, routeResult.stderr);
  assert.deepEqual(JSON.parse(connectionResult.stdout), connections);
  assert.deepEqual(JSON.parse(routeResult.stdout), routes);
  assert.deepEqual(
    server.requests.map(({ method, url }) => [method, url]),
    [
      ["GET", "/v1/connections"],
      ["GET", "/v1/routes"],
    ],
  );
  assert.ok(
    server.requests.every(
      ({ headers }) => headers.accept === "application/json",
    ),
  );
});

test("given HTTP and response-contract failures when a driver runs then stdout stays clean and exits distinguish failures", async (t) => {
  const responses = [
    { status: 503, body: { kind: "Error" } },
    { status: 200, body: "not-json" },
    {
      status: 200,
      body: {
        apiVersion: "agp.management/v2",
        kind: "ConnectionList",
        meta: {},
        items: [],
      },
    },
  ];
  const server = await createJsonServer((_request, ordinal) =>
    responses[ordinal - 1],
  );
  t.after(() => server.close());

  const unavailable = await runBash(connectionsDriver, [server.url]);
  const invalidJson = await runBash(connectionsDriver, [server.url]);
  const wrongVersion = await runBash(connectionsDriver, [server.url]);

  assert.equal(unavailable.code, 5);
  assert.equal(invalidJson.code, 6);
  assert.equal(wrongVersion.code, 6);
  for (const result of [unavailable, invalidJson, wrongVersion]) {
    assert.equal(result.stdout, "");
    assert.notEqual(result.stderr, "");
  }
});

test("given an unavailable endpoint or non-loopback URL when a driver runs then transport and usage exits remain distinct", async () => {
  const probe = await createJsonServer(() => ({ body: {} }));
  const unusedUrl = probe.url;
  await probe.close();

  const unavailable = await runBash(connectionsDriver, [unusedUrl]);
  const remote = await runBash(connectionsDriver, [
    "http://192.0.2.1:9000",
  ]);
  const injected = await runBash(connectionsDriver, [
    "http://127.0.0.1:9;echo owned",
  ]);

  assert.equal(unavailable.code, 4);
  assert.equal(remote.code, 2);
  assert.equal(injected.code, 2);
  assert.equal(unavailable.stdout, "");
  assert.doesNotMatch(injected.stdout, /owned/);
});
