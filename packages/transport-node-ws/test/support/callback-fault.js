import net from "node:net";

import {
  connectTarget,
  reservePort,
  startListener,
  withTimeout,
} from "./topology.js";

export async function exerciseActualCallbackFault({ kind, thrown }) {
  const port = await reservePort();
  const url = `ws://127.0.0.1:${port}/agp`;
  const diagnostics = [];
  let firstAccept;
  const firstAccepted = new Promise((resolve) => {
    firstAccept = resolve;
  });
  let acceptCount = 0;
  let laterCallbackCount = 0;
  let diagnosticCommitted = false;
  const additionallyAccepted = [];
  let firstClient;
  let firstServer;
  let synchronizedUpgrades;
  let listener;
  ({ listener } = await startListener({
    url,
    maxPendingAcquisitions: 1,
    maxActiveChannels: kind === "active-channel" ? 1 : 16,
    diagnostics: {
      emit(diagnostic, cause) {
        diagnostics.push({ diagnostic, cause });
        diagnosticCommitted = true;
      },
    },
    callbacks: {
      accept({ channel }) {
        if (diagnosticCommitted) laterCallbackCount += 1;
        acceptCount += 1;
        if (acceptCount === 1) {
          firstAccept(channel);
          return;
        }
        additionallyAccepted.push(channel);
        if (kind === "accept") throw thrown;
      },
      capacityRejected(rejectedKind) {
        if (diagnosticCommitted) laterCallbackCount += 1;
        if (rejectedKind === kind) throw thrown;
      },
    },
  }));
  try {
    ({ channel: firstClient } = await connectTarget({ url }));
    firstServer = await withTimeout(firstAccepted, 5_000);

    let triggerResults = [];
    let pendingRejectionObserved = false;
    if (kind === "pending-acquisition") {
      synchronizedUpgrades = await beginSynchronizedUpgrades(url, 8);
    } else {
      triggerResults = await Promise.all([
        connectTarget({ url }).catch((error) => error),
      ]);
    }
    const terminal = await listener.waitTerminal(
      AbortSignal.timeout(5_000),
    );
    if (synchronizedUpgrades !== undefined) {
      pendingRejectionObserved = await synchronizedUpgrades.waitRejected();
    }
    for (const result of triggerResults) {
      result.channel?.abort({
        kind: "forced-stop",
        code: "TRIGGER_CLEANUP",
      });
    }

    await firstClient.send(
      { bytes: new Uint8Array([41]) },
      AbortSignal.timeout(5_000),
    );
    const survivingRead = await firstServer.read(
      AbortSignal.timeout(5_000),
    );
    const callbacksBeforeProbe = acceptCount + laterCallbackCount;
    await connectTarget({ url }).catch(() => undefined);
    const callbacksAfterProbe = acceptCount + laterCallbackCount;

    const emitted = diagnostics[0];
    return {
      callbackEscaped: false,
      triggeringAuthorityReleasedBeforeDiagnostic:
        pendingRejectionObserved
        || triggerResults.every(
          (value) => value instanceof Error || value.channel,
        ),
      laterCallbackCount:
        laterCallbackCount + callbacksAfterProbe - callbacksBeforeProbe,
      transferredChannelSurvived:
        survivingRead.kind === "packet"
        && survivingRead.packet.bytes[0] === 41,
      terminal,
      diagnostic: emitted?.diagnostic,
      diagnosticCause: emitted?.cause,
    };
  } finally {
    for (const channel of additionallyAccepted) {
      channel.abort({ kind: "forced-stop", code: "TEST_END" });
    }
    await synchronizedUpgrades?.release();
    firstClient?.abort({ kind: "forced-stop", code: "TEST_END" });
    firstServer?.abort({ kind: "forced-stop", code: "TEST_END" });
    listener.abort({ kind: "forced-stop", code: "TEST_END" });
  }
}

async function beginSynchronizedUpgrades(urlText, count) {
  const url = new URL(urlText);
  const sockets = Array.from({ length: count }, () => {
    const socket = net.createConnection({
      host: url.hostname,
      port: Number(url.port),
    });
    socket.on("error", () => undefined);
    return socket;
  });
  try {
    await Promise.all(sockets.map(waitConnected));
  } catch (cause) {
    for (const socket of sockets) socket.destroy();
    throw cause;
  }

  let rejectionResolve;
  const rejection = new Promise((resolve) => {
    rejectionResolve = resolve;
  });
  for (const [index, socket] of sockets.entries()) {
    let response = "";
    socket.on("data", (chunk) => {
      response += chunk.toString("latin1");
      if (response.startsWith("HTTP/1.1 503 ")) rejectionResolve(true);
    });
    const key = Buffer.alloc(16, index + 1).toString("base64");
    socket.write(
      `GET ${url.pathname}${url.search} HTTP/1.1\r\n`
      + `Host: ${url.host}\r\n`
      + "Upgrade: websocket\r\n"
      + "Connection: Upgrade\r\n"
      + `Sec-WebSocket-Key: ${key}\r\n`
      + "Sec-WebSocket-Version: 13\r\n"
      + "Sec-WebSocket-Protocol: agp.v1\r\n\r\n",
    );
  }

  return {
    waitRejected() {
      return withTimeout(rejection, 5_000);
    },
    async release() {
      const closed = sockets.map(waitClosed);
      for (const socket of sockets) socket.destroy();
      await Promise.all(closed);
    },
  };
}

function waitConnected(socket) {
  if (socket.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("error", onError);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (cause) => {
      cleanup();
      reject(cause);
    };
    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

function waitClosed(socket) {
  if (socket.destroyed) return Promise.resolve();
  return new Promise((resolve) => socket.once("close", resolve));
}
