import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";

test("given duplicate peer adjacency identities, when a node is constructed, then configuration fails before any transport authority resolves", () => {
  let resolutions = 0;
  const transport = {
    resolveListener() {
      resolutions += 1;
      return undefined;
    },
    resolveTarget() {
      resolutions += 1;
      return { connect: async () => assert.fail("construction cannot dial") };
    },
  };

  assert.throws(
    () => createNode({
      nodeId: "adjacency.local",
      peers: [
        {
          adjacencyId: "duplicate",
          expectedNodeId: "peer.one",
          transportRef: "peer.one",
        },
        {
          adjacencyId: "duplicate",
          expectedNodeId: "peer.two",
          transportRef: "peer.two",
        },
      ],
    }, { transport }),
    { code: "CONFIG_INVALID" },
  );
  assert.equal(resolutions, 0);
});
