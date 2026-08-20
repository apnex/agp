import assert from "node:assert/strict";
import test from "node:test";
import { openPair } from "../support/topology.js";

test("Given a transferred WebSocket channel, when its listener closes, then listener terminal observation is stable while the channel remains independently usable", async () => {
  const pair = await openPair();
  try {
    const terminal = await pair.listener.close(
      AbortSignal.timeout(5_000),
    );
    assert.deepEqual(terminal, { origin: "local", kind: "graceful" });
    assert.deepEqual(
      await pair.listener.waitTerminal(AbortSignal.abort()),
      terminal,
    );

    await pair.client.send(
      { bytes: new Uint8Array([11, 12]) },
      AbortSignal.timeout(5_000),
    );
    const read = await pair.server.read(AbortSignal.timeout(5_000));
    assert.deepEqual([...read.packet.bytes], [11, 12]);
  } finally {
    pair.client.abort({ kind: "forced-stop", code: "TEST_END" });
    pair.server.abort({ kind: "forced-stop", code: "TEST_END" });
  }
});
