import net from "node:net";
import {
  createNodeWsTransport,
} from "../../dist/index.js";

export const DEFAULT_CHANNEL_LIMITS = Object.freeze({
  maxPacketBytes: 64 * 1024,
  maxBufferedPackets: 16,
  maxBufferedBytes: 256 * 1024,
});

export function binding(url, transportRef) {
  return {
    transportRef,
    url,
    compression: { mode: "disabled" },
    security: { mode: "trusted-development" },
  };
}

export async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function startListener({
  url,
  callbacks,
  diagnostics,
  channelLimits = DEFAULT_CHANNEL_LIMITS,
  maxPendingAcquisitions = 8,
  maxActiveChannels = 8,
}) {
  const transport = createNodeWsTransport({
    listeners: [binding(url, "listener")],
    targets: [],
  }, diagnostics === undefined ? {} : { diagnostics });
  const capability = transport.resolveListener("listener");
  const listener = await capability.listen({
    limits: {
      maxPendingAcquisitions,
      maxActiveChannels,
      channel: channelLimits,
    },
  }, callbacks, AbortSignal.timeout(5_000));
  return { listener, transport };
}

export async function connectTarget({
  url,
  diagnostics,
  channelLimits = DEFAULT_CHANNEL_LIMITS,
}) {
  const transport = createNodeWsTransport({
    listeners: [],
    targets: [binding(url, "target")],
  }, diagnostics === undefined ? {} : { diagnostics });
  const capability = transport.resolveTarget("target");
  const channel = await capability.connect(
    { channel: channelLimits },
    AbortSignal.timeout(5_000),
  );
  return { channel, transport };
}

export async function openPair(options = {}) {
  const port = await reservePort();
  const url = `ws://127.0.0.1:${port}/agp`;
  let accept;
  const accepted = new Promise((resolve) => {
    accept = resolve;
  });
  const { listener } = await startListener({
    url,
    channelLimits: options.channelLimits,
    diagnostics: options.serverDiagnostics,
    callbacks: {
      accept({ channel }) {
        accept(channel);
      },
      capacityRejected(kind) {
        throw new Error(`unexpected capacity rejection: ${kind}`);
      },
    },
  });
  const { channel: client } = await connectTarget({
    url,
    channelLimits: options.channelLimits,
    diagnostics: options.clientDiagnostics,
  });
  const server = await withTimeout(accepted, 5_000);
  return {
    url,
    listener,
    client,
    server,
    async close() {
      client.abort({ kind: "forced-stop", code: "TEST_END" });
      server.abort({ kind: "forced-stop", code: "TEST_END" });
      await listener.close(AbortSignal.timeout(5_000));
    },
  };
}

export async function withTimeout(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`test timeout after ${milliseconds}ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
