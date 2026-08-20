import {
  AGP_V1_LIMITS,
  encodeAgpPacket,
  parseAgpPacket,
} from "@agp/protocol";
import { createNodeWsTransport } from "@agp/transport-node-ws";
import { eventually } from "./uniform-topology.js";

export async function connectUniformRawPeer({
  nodeId,
  targetNodeId,
  url,
  routes = [],
}) {
  const transportRef = "raw.target";
  const transport = createNodeWsTransport({
    listeners: [],
    targets: [{
      transportRef,
      url,
      compression: { mode: "disabled" },
      security: { mode: "trusted-development" },
    }],
  });
  const target = transport.resolveTarget(transportRef);
  if (target === undefined) throw new Error("raw peer target did not resolve");
  const connection = await target.connect({
    channel: {
      maxPacketBytes: AGP_V1_LIMITS.defaultReceiveBytes,
      maxBufferedPackets: 64,
      maxBufferedBytes: 4_194_304,
    },
  }, new AbortController().signal);
  const inbox = [];
  let sequence = 0;
  let revision = 0;
  let terminal = false;
  let closing = false;
  const nextId = (kind) => `${kind}:${nodeId}:${++sequence}`;

  const sendProtocol = async (message) => {
    const encoded = encodeAgpPacket(
      message,
      AGP_V1_LIMITS.defaultReceiveBytes,
    );
    if (!encoded.ok) throw new Error(`cannot encode ${message.type}`);
    await connection.send(
      { bytes: encoded.bytes },
      new AbortController().signal,
    );
  };

  const pump = (async () => {
    while (!terminal) {
      const read = await connection.read(new AbortController().signal);
      if (read.kind !== "packet") {
        inbox.push(read);
        if (read.kind === "terminal") terminal = true;
        continue;
      }
      const parsed = parseAgpPacket(read.packet.bytes, {
        receiveLimitBytes: AGP_V1_LIMITS.defaultReceiveBytes,
      });
      if (!parsed.ok) throw new Error(`invalid peer input: ${parsed.reasonCode}`);
      inbox.push({ kind: "message", message: parsed.message });
      if (parsed.message.type === "route.update" && !closing) {
        try {
          await sendProtocol({
            agp: 1,
            plane: "control",
            type: "route.ack",
            id: nextId("ack"),
            body: {
              refId: parsed.message.id,
              revision: parsed.message.body.revision,
              rejected: [],
            },
          });
        } catch (error) {
          if (!closing && !terminal) throw error;
        }
      }
    }
  })();

  await sendProtocol({
    agp: 1,
    plane: "control",
    type: "open",
    id: nextId("open"),
    body: {
      nodeId,
      sessionId: "a00001",
      holdTimeMs: 0,
      receiveLimitBytes: AGP_V1_LIMITS.defaultReceiveBytes,
      maxRoutesPerSnapshot: AGP_V1_LIMITS.maxRoutesPerSnapshot,
      maxPathLength: AGP_V1_LIMITS.maxPathLength,
      maxDataHopLimit: AGP_V1_LIMITS.maxDataHopLimit,
      transit: true,
    },
  });
  await take(
    inbox,
    (item) => item.kind === "message" && item.message.type === "open",
    `${nodeId} received ${targetNodeId} OPEN`,
  );
  await sendProtocol({
    agp: 1,
    plane: "control",
    type: "keepalive",
    id: nextId("keepalive"),
    body: {},
  });
  await take(
    inbox,
    (item) => item.kind === "message" && item.message.type === "keepalive",
    `${nodeId} received ${targetNodeId} KEEPALIVE`,
  );

  const sendUpdate = async (nextRoutes) => {
    revision += 1;
    const id = nextId("update");
    await sendProtocol({
      agp: 1,
      plane: "control",
      type: "route.update",
      id,
      body: { revision, routes: nextRoutes },
    });
    return take(
      inbox,
      (item) =>
        item.kind === "message"
        && item.message.type === "route.ack"
        && item.message.body.refId === id,
      `${nodeId} route ACK ${revision}`,
    ).then((item) => item.message);
  };
  await sendUpdate(routes);

  return Object.freeze({
    sendUpdate,
    async close() {
      closing = true;
      if (!terminal) {
        try {
          await connection.close(
            { kind: "normal", code: "RAW_PEER_CLEANUP" },
            new AbortController().signal,
          );
        } catch {
          connection.abort({
            kind: "forced-stop",
            code: "RAW_PEER_CLEANUP",
          });
        }
      }
      await pump;
    },
  });
}

function take(inbox, select, description) {
  return eventually(() => {
    const index = inbox.findIndex(select);
    return index < 0 ? undefined : inbox.splice(index, 1)[0];
  }, description);
}
