import assert from "node:assert/strict";
import test from "node:test";
import {
  connectTarget,
  reservePort,
  startListener,
} from "../support/topology.js";

async function terminalAfterAcceptFault(diagnostics) {
  const port = await reservePort();
  const url = `ws://127.0.0.1:${port}/agp`;
  const thrown = new Error("private callback material");
  const { listener } = await startListener({
    url,
    diagnostics,
    callbacks: {
      accept() {
        throw thrown;
      },
      capacityRejected() {},
    },
  });
  const attempt = connectTarget({ url }).catch(() => undefined);
  const terminal = await listener.waitTerminal(AbortSignal.timeout(5_000));
  await attempt;
  return { terminal, thrown };
}

test("Given absent, observing, and throwing diagnostic sinks, when a native acceptance callback fails, then only a bounded neutral diagnostic and separate cause are observed without changing the listener terminal", async () => {
  const absent = await terminalAfterAcceptFault(undefined);
  assert.deepEqual(absent.terminal, {
    origin: "carrier",
    kind: "adapter-fault",
    diagnostic: { code: "ACCEPT_CALLBACK_FAILED" },
  });

  const calls = [];
  const observed = await terminalAfterAcceptFault({
    emit(diagnostic, cause) {
      calls.push({ diagnostic, cause });
    },
  });
  assert.deepEqual(calls[0].diagnostic, {
    code: "ACCEPT_CALLBACK_FAILED",
  });
  assert.equal(calls[0].cause, observed.thrown);
  assert.equal(
    JSON.stringify(observed.terminal).includes("private callback"),
    false,
  );

  const throwing = await terminalAfterAcceptFault({
    emit() {
      throw new Error("observer failure");
    },
  });
  assert.deepEqual(throwing.terminal, absent.terminal);
});
