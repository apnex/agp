import assert from "node:assert/strict";
import test from "node:test";

import {
  MANAGEMENT_HTTP_LIMITS,
  ManagementHttpServerError,
  createManagementHttpServer,
} from "../../dist/index.js";
import { createOperationsFixture } from "../fixtures/operations-fixture.js";

test("Given valid defaults, when the management adapter is constructed and started, then construction is inert and the listener binds only a literal loopback address", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  assert.equal(
    Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
    0,
  );
  const started = await server.start();
  t.after(() => server.stop());
  assert.match(started.url, /^http:\/\/127[.]0[.]0[.]1:[1-9][0-9]*$/);
  assert.equal(
    Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
    0,
  );
});

test("Given a non-loopback host, invalid port, invalid response bound, or incomplete reader, when construction validates it, then CONFIG_INVALID is raised before binding or SDK access", () => {
  const fixture = createOperationsFixture();
  const invalidConfigs = [
    { host: "0.0.0.0" },
    { host: "localhost" },
    { port: -1 },
    { port: 65_536 },
    { port: 1.5 },
    { maxResponseBytes: MANAGEMENT_HTTP_LIMITS.minimumResponseBytes - 1 },
    { maxResponseBytes: MANAGEMENT_HTTP_LIMITS.maximumResponseBytes + 1 },
  ];
  for (const config of invalidConfigs) {
    assert.throws(
      () => createManagementHttpServer(fixture.operations, config),
      (error) =>
        error instanceof ManagementHttpServerError &&
        error.code === "CONFIG_INVALID",
    );
  }
  assert.throws(
    () => createManagementHttpServer({ snapshot() {} }),
    (error) =>
      error instanceof ManagementHttpServerError &&
      error.code === "CONFIG_INVALID",
  );
  assert.equal(
    Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
    0,
  );
});
