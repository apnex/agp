import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";

test("given opaque listener and peer references, when a node is constructed, then each resolves once by kind and no capability enters kernel state", () => {
  const listenerAuthority = {
    authorityMarker: "listener-secret",
    listen: async () => assert.fail("construction cannot listen"),
  };
  const targetAuthorities = new Map([
    ["peer.alpha", {
      authorityMarker: "alpha-secret",
      connect: async () => assert.fail("construction cannot connect"),
    }],
    ["peer.beta", {
      authorityMarker: "beta-secret",
      connect: async () => assert.fail("construction cannot connect"),
    }],
  ]);
  const resolutions = [];
  const transport = {
    resolveListener(reference) {
      resolutions.push(["listener", reference]);
      return reference === "service.listener"
        ? listenerAuthority
        : undefined;
    },
    resolveTarget(reference) {
      resolutions.push(["target", reference]);
      return targetAuthorities.get(reference);
    },
  };

  const node = createNode({
    nodeId: "composition.local",
    listen: { transportRef: "service.listener" },
    peers: [
      {
        adjacencyId: "alpha",
        expectedNodeId: "peer.alpha",
        transportRef: "peer.alpha",
      },
      {
        adjacencyId: "beta",
        expectedNodeId: "peer.beta",
        transportRef: "peer.beta",
      },
    ],
  }, { transport });

  assert.deepEqual(resolutions, [
    ["listener", "service.listener"],
    ["target", "peer.alpha"],
    ["target", "peer.beta"],
  ]);
  const serialized = JSON.stringify(node.operations.configuration());
  assert.match(serialized, /"transportRef":"service\.listener"/u);
  assert.match(serialized, /"transportRef":"peer\.alpha"/u);
  assert.match(serialized, /"transportRef":"peer\.beta"/u);
  assert.equal(serialized.includes("listener-secret"), false);
  assert.equal(serialized.includes("alpha-secret"), false);
  assert.equal(serialized.includes("beta-secret"), false);

  assert.throws(
    () => createNode({
      nodeId: "composition.unmapped",
      peers: [{
        adjacencyId: "missing",
        expectedNodeId: "peer.missing",
        transportRef: "peer.missing",
      }],
    }, { transport }),
    { code: "CONFIG_INVALID" },
  );
});
