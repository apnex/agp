import assert from "node:assert/strict";
import test from "node:test";
import WebSocket from "ws";
import {
  DEFAULT_CHANNEL_LIMITS,
  reservePort,
  startListener,
  withTimeout,
} from "../support/topology.js";

test("Given a legacy text peer selecting agp.v1, when it sends its first text message, then ordered malformed-input evidence precedes one remote binding terminal with no fallback packet", async () => {
  const port = await reservePort();
  const url = `ws://127.0.0.1:${port}/agp`;
  let accept;
  const accepted = new Promise((resolve) => {
    accept = resolve;
  });
  const { listener } = await startListener({
    url,
    callbacks: {
      accept({ channel }) {
        accept(channel);
      },
      capacityRejected(kind) {
        throw new Error(kind);
      },
    },
  });
  const peer = new WebSocket(url, "agp.v1");
  try {
    await new Promise((resolve, reject) => {
      peer.once("open", resolve);
      peer.once("error", reject);
    });
    const channel = await withTimeout(accepted, 5_000);
    peer.send("{}");
    assert.deepEqual(
      await channel.read(AbortSignal.timeout(5_000)),
      {
        kind: "input-rejected",
        code: "MALFORMED_CARRIER_INPUT",
      },
    );
    assert.deepEqual(
      await channel.read(AbortSignal.timeout(5_000)),
      {
        kind: "terminal",
        terminal: {
          origin: "remote",
          kind: "binding-violation",
          diagnostic: { code: "MALFORMED_CARRIER_INPUT" },
        },
      },
    );
  } finally {
    peer.terminate();
    await listener.close(AbortSignal.timeout(5_000));
  }
});

test("Given a binary message beyond the common packet bound, when ws rejects it natively, then PACKET_TOO_LARGE evidence precedes the stable binding terminal", async () => {
  const port = await reservePort();
  const url = `ws://127.0.0.1:${port}/agp`;
  const limits = {
    ...DEFAULT_CHANNEL_LIMITS,
    maxPacketBytes: 4,
  };
  let accept;
  const accepted = new Promise((resolve) => {
    accept = resolve;
  });
  const { listener } = await startListener({
    url,
    channelLimits: limits,
    callbacks: {
      accept({ channel }) {
        accept(channel);
      },
      capacityRejected(kind) {
        throw new Error(kind);
      },
    },
  });
  const peer = new WebSocket(url, "agp.v1");
  try {
    await new Promise((resolve, reject) => {
      peer.once("open", resolve);
      peer.once("error", reject);
    });
    const channel = await withTimeout(accepted, 5_000);
    peer.send(new Uint8Array(5), { binary: true });
    assert.deepEqual(
      await channel.read(AbortSignal.timeout(5_000)),
      { kind: "input-rejected", code: "PACKET_TOO_LARGE" },
    );
    const terminal = await channel.read(AbortSignal.timeout(5_000));
    assert.equal(terminal.kind, "terminal");
    assert.equal(terminal.terminal.kind, "binding-violation");
    assert.equal(terminal.terminal.diagnostic.code, "PACKET_TOO_LARGE");
  } finally {
    peer.terminate();
    await listener.close(AbortSignal.timeout(5_000));
  }
});
