import assert from "node:assert/strict";
import test from "node:test";

import { createManagementHttpServer } from "@agp/management-http";
import { createNode } from "@agp/node";

test("given public package-root factories, when a consumer composes a uniform node and management adapter, then no private import or role-specific package is required", () => {
  const node = createNode({
    nodeId: "node.public-consumer",
    transit: { enabled: true },
  });
  const management = createManagementHttpServer(
    node.operations,
    { host: "127.0.0.1", port: 0 },
  );

  assert.equal(node.nodeId, "node.public-consumer");
  assert.equal(node.operations.lifecycle().state, "Created");
  assert.equal(typeof node.start, "function");
  assert.equal(typeof node.stop, "function");
  assert.equal(typeof node.expose, "function");
  assert.equal(typeof node.send, "function");
  assert.equal(typeof management.start, "function");
  assert.equal(typeof management.stop, "function");
});
