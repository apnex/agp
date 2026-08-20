import assert from "node:assert/strict";
import test from "node:test";
import { runPacketOrderCase } from "../../dist/index.js";
import { createScriptedPair } from "../support/scripted-channel.js";

test("Given a neutral channel pair, when the packet-order case runs, then opaque packet boundaries and FIFO order are preserved bidirectionally", async () => {
  const result = await runPacketOrderCase(
    { async acquirePair() { return createScriptedPair(); } },
    {
      maxPacketBytes: 1024,
      maxBufferedPackets: 16,
      maxBufferedBytes: 4096,
    },
  );

  assert.deepEqual(result.leftToRight, [[], [0, 1, 2, 255], [9, 8, 7]]);
  assert.deepEqual(result.rightToLeft, [[255, 0, 128], [4]]);
});
