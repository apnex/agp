import assert from "node:assert/strict";
import net from "node:net";

import { WebSocket, WebSocketServer } from "ws";

import { sampleLoopLag, summarise } from "../test/support/loop-lag.js";
import {
  createWebSocketNode,
  eventually,
  expose,
  memoryPeer,
  selectedRoute,
} from "../test/support/uniform-topology.js";

// A latency ladder, not a benchmark.
//
// Each rung adds exactly one layer to the rung below it, so the rung where the
// milliseconds first appear names the layer that owns them. A single
// end-to-end number cannot do that, which is why chasing one produces
// hypotheses instead of causes.
//
// The loop-lag sampler runs underneath every rung. Without it a slow code path
// and a starved one are indistinguishable, and in a single-process topology
// both are plausible.
//
// Usage:
//   node scripts/latency-ladder.mjs               every rung
//   node scripts/latency-ladder.mjs --rung=L4     one rung
//   node scripts/latency-ladder.mjs --count=500   more samples

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const found = argv.find((value) => value.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};
const COUNT = Number.parseInt(flag("count", "200"), 10);
const ONLY = flag("rung", "all");
const PAYLOAD = Buffer.alloc(258, 0x61);

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** L0: the carrier floor. Nothing below this is AGP's to answer for. */
async function rawTcp() {
  const port = await freePort();
  const server = net.createServer((socket) => {
    socket.setNoDelay(true);
    socket.on("data", (chunk) => socket.write(chunk));
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const client = net.connect({ port, host: "127.0.0.1" });
  client.setNoDelay(true);
  await new Promise((resolve) => client.once("connect", resolve));

  const samples = [];
  for (let index = 0; index < COUNT; index += 1) {
    const started = process.hrtime.bigint();
    await new Promise((resolve) => {
      client.once("data", resolve);
      client.write(PAYLOAD);
    });
    samples.push(Number(process.hrtime.bigint() - started) / 1000);
  }
  client.destroy();
  await new Promise((resolve) => server.close(resolve));
  return samples;
}

/** L1: adds WebSocket framing over the same carrier. */
async function rawWebSocket() {
  const port = await freePort();
  const server = new WebSocketServer({ host: "127.0.0.1", port });
  server.on("connection", (socket) => {
    socket.on("message", (data) => socket.send(data));
  });
  await new Promise((resolve) => server.once("listening", resolve));
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((resolve) => client.once("open", resolve));

  const samples = [];
  for (let index = 0; index < COUNT; index += 1) {
    const started = process.hrtime.bigint();
    await new Promise((resolve) => {
      client.once("message", resolve);
      client.send(PAYLOAD);
    });
    samples.push(Number(process.hrtime.bigint() - started) / 1000);
  }
  client.close();
  await new Promise((resolve) => server.close(resolve));
  return samples;
}

async function nodePair({ transportReceivePackets, deliveries }) {
  const receiver = createWebSocketNode({
    nodeId: "ladder.receiver",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    transit: false,
    ...(transportReceivePackets === undefined ? {} : { transportReceivePackets }),
  });
  await expose(receiver, ["ladder.receiver/ep0"], deliveries);
  const started = await receiver.start();
  const sender = createWebSocketNode({
    nodeId: "ladder.sender",
    transit: false,
    peers: [{
      ...memoryPeer("ladder", "ladder.receiver", 1),
      url: started.listener.publication.displayAddress,
    }],
  });
  await expose(sender, ["ladder.sender/ep0"], deliveries);
  await sender.start();
  await eventually(
    () => selectedRoute(sender, "ladder.receiver/ep0") !== undefined,
    "ladder route",
    20_000,
  );
  return { sender, receiver, stop: async () => {
    await sender.stop().catch(() => undefined);
    await receiver.stop().catch(() => undefined);
  } };
}

/**
 * Stream through a node pair and time each message from admission to arrival.
 *
 * A large ring leaves credit unable to bind, so this rung reports what the
 * node costs without pacing. A small ring makes credit bind, and the
 * difference between the two rungs is the price of pacing.
 */
async function nodeStream({ transportReceivePackets }) {
  const deliveries = [];
  const pair = await nodePair({ transportReceivePackets, deliveries });
  const at = () =>
    deliveries.filter((entry) => entry.endpoint === "ladder.receiver/ep0").length;
  try {
    // Measured from the first send to the last arrival. Timing only the tail
    // after the send loop overlaps the two phases and reports whichever
    // happened to finish last, which is how an earlier reading of this number
    // came out lower for more messages.
    const started = process.hrtime.bigint();
    for (let ordinal = 0; ordinal < COUNT; ordinal += 1) {
      try {
        await pair.sender.send("ladder.sender/ep0", "ladder.receiver/ep0", { ordinal });
      } catch {
        ordinal -= 1;
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }
    await eventually(() => at() >= COUNT, "ladder drain", 60_000);
    const drainUs = Number(process.hrtime.bigint() - started) / 1000;
    const connection = pair.sender.operations.snapshot().connections[0];
    return {
      drainUs,
      credit: connection.credit?.outbound,
      replenishment: connection.latency?.creditReplenishment,
      routeAck: connection.latency?.routeAck,
    };
  } finally {
    await pair.stop();
  }
}

const RUNGS = {
  L0: { label: "raw TCP loopback ping-pong", run: rawTcp, kind: "rtt" },
  L1: { label: "raw ws ping-pong", run: rawWebSocket, kind: "rtt" },
  L3: {
    label: `AGP pair, ring above the stream (${COUNT})`,
    run: () => nodeStream({ transportReceivePackets: Math.max(64, COUNT * 2) }),
    kind: "stream",
  },
  L4: {
    label: `AGP pair, ring below the stream (${COUNT})`,
    run: () => nodeStream({ transportReceivePackets: 16 }),
    kind: "stream",
  },
};

process.stdout.write(`latency ladder | ${COUNT} samples per rung\n\n`);
for (const [id, rung] of Object.entries(RUNGS)) {
  if (ONLY !== "all" && ONLY !== id) continue;
  const lag = sampleLoopLag();
  const result = await rung.run();
  const loop = lag.stop();
  process.stdout.write(`${id}  ${rung.label}\n`);
  if (rung.kind === "rtt") {
    const stats = summarise(result);
    process.stdout.write(
      `    rtt      p50 ${stats.p50Us}us  p99 ${stats.p99Us}us  max ${stats.maxUs}us\n`,
    );
  } else {
    process.stdout.write(
      `    end-to-end ${Math.round(result.drainUs)}us total`
        + `  ${Math.round(result.drainUs / COUNT)}us per message\n`,
    );
    process.stdout.write(
      `    stalls   ${result.credit?.stalls ?? "n/a"}`
        + `  stalled ${result.credit?.stalledUs ?? 0}us\n`,
    );
    if (result.replenishment !== undefined) {
      process.stdout.write(
        `    replenish count ${result.replenishment.count}`
          + `  last ${result.replenishment.lastUs}us`
          + `  high ${result.replenishment.highWaterUs}us\n`,
      );
    }
    if (result.routeAck !== undefined) {
      process.stdout.write(`    routeAck high ${result.routeAck.highWaterUs}us\n`);
    }
  }
  process.stdout.write(
    `    loop lag mean ${loop.meanUs}us  max ${loop.maxUs}us`
      + ` over ${loop.samples} samples\n\n`,
  );
}

assert.ok(true);
