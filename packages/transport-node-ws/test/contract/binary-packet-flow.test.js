import assert from "node:assert/strict";
import test from "node:test";
import { openPair } from "../support/topology.js";

test("Given arbitrary binary bytes and caller-buffer reuse, when a packet is sent over Node ws, then the synchronous snapshot reaches the peer unchanged without UTF-8 interpretation", async () => {
  const pair = await openPair();
  try {
    const bytes = new Uint8Array([0, 255, 193, 40, 128]);
    const sent = pair.client.send(
      { bytes },
      AbortSignal.timeout(5_000),
    );
    bytes.fill(7);
    await sent;
    const received = await pair.server.read(AbortSignal.timeout(5_000));
    assert.equal(received.kind, "packet");
    assert.deepEqual(
      [...received.packet.bytes],
      [0, 255, 193, 40, 128],
    );
  } finally {
    await pair.close();
  }
});
