import assert from "node:assert/strict";
import test from "node:test";

import { runPacketOrderCase } from "@agp/transport/conformance";

import {
  acquirePair,
  closeFabric,
  createFixture,
  disposePair,
} from "../support/topology.js";

const ORDER_LIMITS = Object.freeze({
  maxPacketBytes: 16,
  maxBufferedPackets: 4,
  maxBufferedBytes: 64,
});

test("given the neutral packet-order case when it runs over production Loopback then both directions preserve independent FIFO order", async () => {
  const fabrics = [];
  const result = await runPacketOrderCase(
    {
      async acquirePair() {
        const fixture = createFixture({
          fabricId: `order-${fabrics.length}`,
        });
        fabrics.push(fixture.fabric);
        const pair = await acquirePair(fixture, {
          listenerChannel: ORDER_LIMITS,
          connectorChannel: ORDER_LIMITS,
        });
        return {
          left: pair.left,
          right: pair.right,
          async close() {
            await disposePair(pair);
          },
        };
      },
    },
    ORDER_LIMITS,
  );

  assert.deepEqual(result.leftToRight, [
    [],
    [0, 1, 2, 255],
    [9, 8, 7],
  ]);
  assert.deepEqual(result.rightToLeft, [[255, 0, 128], [4]]);
  await Promise.all(fabrics.map(closeFabric));
});
