import assert from "node:assert/strict";
import test from "node:test";
import {
  createNodeWsTransport,
} from "../../dist/index.js";
import { binding } from "../support/topology.js";

test("Given a listener configured on ephemeral port zero, when acquisition commits, then publication reports the sanitized actual bound URL without granting kernel authority", async () => {
  const transport = createNodeWsTransport({
    listeners: [binding("ws://127.0.0.1:0/agp", "listener")],
    targets: [],
  });
  const listener = await transport.resolveListener("listener").listen({
    limits: {
      maxPendingAcquisitions: 2,
      maxActiveChannels: 2,
      channel: {
        maxPacketBytes: 1024,
        maxBufferedPackets: 4,
        maxBufferedBytes: 4096,
      },
    },
  }, {
    accept() {},
    capacityRejected() {},
  }, AbortSignal.timeout(5_000));
  try {
    const published = new URL(listener.publication.displayAddress);
    assert.equal(published.protocol, "ws:");
    assert.equal(published.hostname, "127.0.0.1");
    assert.notEqual(published.port, "0");
    assert.equal(published.pathname, "/agp");
  } finally {
    await listener.close(AbortSignal.timeout(5_000));
  }
});
