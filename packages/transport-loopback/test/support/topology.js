import { createLoopbackFabric } from "../../dist/index.js";

export const CHANNEL_LIMITS = Object.freeze({
  maxPacketBytes: 16,
  maxBufferedPackets: 2,
  maxBufferedBytes: 24,
});

export const FABRIC_LIMITS = Object.freeze({
  maxTransports: 8,
  maxListeners: 8,
  maxPendingAcquisitions: 8,
  maxActiveChannels: 8,
  maxPacketBytes: 16,
  maxBufferedPacketsPerChannel: 4,
  maxBufferedBytesPerChannel: 64,
  maxQueuedPacketsTotal: 16,
  maxQueuedBytesTotal: 256,
  maxPendingSendBytesTotal: 256,
});

export function liveSignal() {
  return new AbortController().signal;
}

export function createFixture(options = {}) {
  const fabricId = options.fabricId ?? "test-fabric";
  const fabric = createLoopbackFabric(
    {
      fabricId,
      limits: {
        ...FABRIC_LIMITS,
        ...options.fabricLimits,
      },
    },
    options.dependencies,
  );
  const listenerBuilder = fabric.createTransport({
    transportName: options.listenerTransport ?? "alpha",
    capabilities: { listen: true, connect: false },
  });
  const connectorBuilder = fabric.createTransport({
    transportName: options.connectorTransport ?? "beta",
    capabilities: { listen: false, connect: true },
  });
  const address = options.address ?? "service";
  const listenerPort = listenerBuilder.createPort({
    listeners: new Map([
      ["service.listen", { fabricId, address }],
    ]),
    targets: new Map(),
  });
  const connectorPort = connectorBuilder.createPort({
    listeners: new Map(),
    targets: new Map([
      ["service.connect", { fabricId, address }],
    ]),
  });
  const listenCapability =
    listenerPort.resolveListener("service.listen");
  const connectCapability =
    connectorPort.resolveTarget("service.connect");
  if (listenCapability === undefined || connectCapability === undefined) {
    throw new Error("Fixture capabilities did not resolve");
  }
  return {
    fabric,
    address,
    listenerPort,
    connectorPort,
    listenCapability,
    connectCapability,
  };
}

export async function acquirePair(fixture, options = {}) {
  let accepted;
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions:
          options.maxPendingAcquisitions ?? 4,
        maxActiveChannels: options.maxActiveChannels ?? 4,
        channel: options.listenerChannel ?? CHANNEL_LIMITS,
      },
    },
    options.callbacks ?? {
      accept(value) {
        accepted = value.channel;
      },
      capacityRejected() {},
    },
    liveSignal(),
  );
  const left = await fixture.connectCapability.connect(
    { channel: options.connectorChannel ?? CHANNEL_LIMITS },
    liveSignal(),
  );
  const right = options.acceptedChannel?.() ?? accepted;
  if (right === undefined) {
    throw new Error("Fixture accept callback did not retain a channel");
  }
  return { left, right, listener };
}

export async function drainToTerminal(channel) {
  for (;;) {
    const result = await channel.read(liveSignal());
    if (result.kind === "terminal") return result.terminal;
  }
}

export async function disposePair(pair) {
  pair.left.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await Promise.all([
    drainToTerminal(pair.left),
    drainToTerminal(pair.right),
  ]);
  pair.listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await pair.listener.waitTerminal(liveSignal());
}

export async function closeFabric(fabric) {
  await new Promise((resolve) => setImmediate(resolve));
  await fabric.close(liveSignal());
}
