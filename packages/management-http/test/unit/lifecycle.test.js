import assert from "node:assert/strict";
import test from "node:test";

import { createManagementHttpServer } from "../../dist/index.js";
import { createOperationsFixture } from "../fixtures/operations-fixture.js";

test("Given one adapter instance, when start and stop are repeated, then starts are idempotent, stops are idempotent, restart rebinds, and lifecycle operations never query node state", async (t) => {
  const fixture = createOperationsFixture();
  const server = createManagementHttpServer(fixture.operations);
  t.after(() => server.stop());

  const first = await server.start();
  assert.deepEqual(await server.start(), first);
  await Promise.all([server.stop(), server.stop()]);
  const second = await server.start();
  assert.match(second.url, /^http:\/\/127[.]0[.]0[.]1:/);
  assert.equal(
    Object.values(fixture.calls).reduce((sum, count) => sum + count, 0),
    0,
  );
});
