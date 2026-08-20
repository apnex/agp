import assert from "node:assert/strict";
import test from "node:test";
import { openPair } from "../support/topology.js";

test("Given cancellation before and immediately after native send dispatch, when send races are linearized, then pre-dispatch is not accepted while the uncertain tail fails and terminalizes once", async () => {
  const pair = await openPair();
  try {
    const before = new AbortController();
    before.abort();
    await assert.rejects(
      pair.client.send({ bytes: new Uint8Array([1]) }, before.signal),
      (error) =>
        error.code === "OPERATION_ABORTED"
        && error.acceptance === "not-accepted",
    );

    const after = new AbortController();
    const pending = pair.client.send(
      { bytes: new Uint8Array(32 * 1024) },
      after.signal,
    );
    after.abort();
    await assert.rejects(
      pending,
      (error) =>
        error.code === "SEND_FAILED"
        && error.acceptance === "unknown",
    );
    const terminal = await pair.client.read(AbortSignal.timeout(5_000));
    assert.deepEqual(terminal, {
      kind: "terminal",
      terminal: {
        origin: "carrier",
        kind: "io-failure",
        diagnostic: { code: "SEND_FAILED" },
      },
    });
    assert.deepEqual(
      await pair.client.read(AbortSignal.timeout(5_000)),
      terminal,
    );
  } finally {
    await pair.close();
  }
});
