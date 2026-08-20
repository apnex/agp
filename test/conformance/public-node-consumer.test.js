import assert from "node:assert/strict";
import test from "node:test";
import * as nodePackage from "@agp/node";
import { createManagementHttpServer } from "@agp/management-http";

test("Given an application importing only package roots, when it creates a local uniform node and management projection, then the public surface composes without a role-specific runtime factory", async (context) => {
  assert.equal(typeof nodePackage.createNode, "function");
  assert.equal("createRouter" in nodePackage, false);
  assert.equal("createSpoke" in nodePackage, false);

  const node = nodePackage.createNode({
    nodeId: "consumer.local",
    transit: { enabled: false },
  });
  const management = createManagementHttpServer(node.operations, { port: 0 });
  context.after(async () => {
    await management.stop();
    await node.stop();
  });

  const binding = await node.expose("consumer/service", async () => {});
  const started = await node.start();
  const address = await management.start();
  const response = await fetch(`${address.url}/v1/routes`);
  const routes = await response.json();

  assert.equal(started.nodeId, "consumer.local");
  assert.equal(binding.info.endpoint, "consumer/service");
  assert.equal(response.status, 200);
  assert.equal(routes.kind, "RouteTable");
  assert.equal(routes.selected[0].endpoint, "consumer/service");
  assert.equal("role" in routes.meta, false);
});
