import assert from "node:assert/strict";
import test from "node:test";
import {
  runPacketOrderCase,
} from "@agp/transport";
import {
  DEFAULT_CHANNEL_LIMITS,
  openPair,
} from "../support/topology.js";

test("Given a real Node WebSocket channel pair, when the neutral packet-order case runs, then binary packets preserve bytes, boundaries, and bidirectional FIFO order", async () => {
  const result = await runPacketOrderCase({
    async acquirePair() {
      const pair = await openPair();
      return {
        left: pair.client,
        right: pair.server,
        close: pair.close,
      };
    },
  }, DEFAULT_CHANNEL_LIMITS);

  assert.deepEqual(result.leftToRight[1], [0, 1, 2, 255]);
  assert.deepEqual(result.rightToLeft[0], [255, 0, 128]);
});
