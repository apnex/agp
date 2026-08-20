import assert from "node:assert/strict";
import test from "node:test";
import { SessionWriter } from "../../dist/index.js";
import { fakeConnection } from "../support/fakes.js";

test("Given data admitted in an export epoch, when that epoch closes, then data writes before its withdrawing snapshot", async () => {
  const transport = fakeConnection({ manual: true });
  const encoder = new TextEncoder();
  const writer = new SessionWriter(transport.connection, {
    maximumQueuedDataMessages: 4,
    maximumQueuedDataBytes: 1_024,
    maximumQueuedControlMessages: 4,
  });

  assert.deepEqual(
    writer.admitData({
      packet: encoder.encode("data-before-withdrawal"),
      encodedBytes: 24,
      epoch: "source@7",
    }),
    { accepted: true },
  );
  const withdrawal = writer.enqueueRouteSnapshot(
    encoder.encode("withdrawing-snapshot"),
    20,
    ["source@7"],
  );
  assert.deepEqual(
    writer.admitData({
      packet: encoder.encode("data-after-closure"),
      encodedBytes: 18,
      epoch: "source@7",
    }),
    { accepted: false, reason: "epoch-closed" },
  );

  transport.releaseOne();
  await new Promise((resolve) => setImmediate(resolve));
  transport.releaseOne();
  await withdrawal;

  assert.deepEqual(transport.writes, [
    "data-before-withdrawal",
    "withdrawing-snapshot",
  ]);
});
