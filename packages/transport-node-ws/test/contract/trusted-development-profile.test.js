import assert from "node:assert/strict";
import test from "node:test";
import {
  createNodeWsTransport,
} from "../../dist/index.js";
import { binding, openPair } from "../support/topology.js";

test("Given the certified Node ws factory, when configuration, resolution, and acquisition are evaluated, then only trusted-development ws yields exact unauthenticated network evidence", async () => {
  assert.throws(
    () => createNodeWsTransport({
      listeners: [],
      targets: [binding("wss://localhost/agp", "secure")],
    }),
    (error) => error.code === "PROFILE_UNSUPPORTED",
  );
  assert.throws(
    () => createNodeWsTransport({
      listeners: [],
      targets: [{
        ...binding("ws://localhost/agp", "compressed"),
        compression: {
          mode: "permessage-deflate",
          maxCompressedBytes: 1024,
          noContextTakeover: true,
        },
      }],
    }),
    (error) => error.code === "COMPRESSION_UNSUPPORTED",
  );
  assert.throws(
    () => createNodeWsTransport(
      { listeners: [], targets: [] },
      { authentication: {} },
    ),
    (error) => error.code === "CAPABILITIES_INVALID",
  );

  const resolver = createNodeWsTransport({
    listeners: [],
    targets: [binding("ws://localhost/agp", "peer")],
  });
  assert.equal(resolver.resolveTarget("missing"), undefined);
  assert.throws(
    () => resolver.resolveTarget("ws://peer"),
    (error) =>
      error.code === "REFERENCE_INVALID"
      && error.phase === "resolve-target",
  );

  const pair = await openPair();
  try {
    const expected = {
      locality: "network",
      protection: "none",
      authentication: { kind: "none" },
    };
    assert.deepEqual(pair.client.peerEvidence, expected);
    assert.deepEqual(pair.server.peerEvidence, expected);
    assert.equal(Object.isFrozen(pair.client.peerEvidence), true);
  } finally {
    await pair.close();
  }
});
