import { readFile } from "node:fs/promises";

import { createNode } from "@agp/node";
import { createNodeWsTransport } from "@agp/transport-node-ws";

// One AGP node, alone in a process, driven over IPC.
//
// The end-to-end suite has a runner of its own. That one binds a management
// HTTP server per node and answers state over it, which suits a test about the
// management surface and costs a port and a request per probe everywhere else.
// This one answers over the same channel it already has, so a topology of any
// size needs no ports and no HTTP.
//
// The transport is selected rather than hardcoded, because the point of
// isolating a node is to compare carriers under it. Loopback is absent: its
// fabric is an in-process object today, which `F08` records as a property of
// the current implementation rather than of the transport.

const documentPath = process.argv[2];
if (documentPath === undefined) throw new Error("a configuration path is required");
const document = JSON.parse(await readFile(documentPath, "utf8"));

let node;
const bindings = [];
let shutdown;
const stopped = new Promise((resolve) => {
  shutdown = resolve;
});

function emit(value) {
  if (process.connected) process.send(value);
}

function transportFor({ kind, listeners, targets }) {
  if (kind !== "websocket") {
    throw new Error(
      `transport ${kind} cannot be isolated in a process; see F08`,
    );
  }
  const shape = (entry) => ({
    transportRef: entry.transportRef,
    url: entry.url,
    compression: { mode: "disabled" },
    security: { mode: "trusted-development" },
  });
  return createNodeWsTransport({
    listeners: listeners.map(shape),
    targets: targets.map(shape),
  });
}

async function handle(message) {
  if (message === null || typeof message !== "object") return;
  if (message.command === "stop") {
    shutdown("command");
    return;
  }
  const reply = (body) => emit({ type: "reply", id: message.id, ...body });
  try {
    if (message.command === "send") {
      const receipt = await node.send(
        message.source,
        message.destination,
        message.payload,
      );
      reply({ ok: true, value: receipt });
      return;
    }
    if (message.command === "selected-routes") {
      reply({
        ok: true,
        value: node.operations.snapshot().selectedRoutes.map(
          ({ endpoint }) => endpoint,
        ),
      });
      return;
    }
    if (message.command === "snapshot") {
      reply({ ok: true, value: node.operations.snapshot() });
      return;
    }
    reply({ ok: false, error: { message: `unknown command ${message.command}` } });
  } catch (error) {
    reply({
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        ...(typeof error?.code === "string" ? { code: error.code } : {}),
      },
    });
  }
}

try {
  node = createNode(document.config, { transport: transportFor(document.transport) });
  for (const endpoint of document.endpoints) {
    bindings.push(
      // Deliveries are streamed rather than polled, so the parent counts
      // arrivals the same way it does for a node in its own process.
      await node.expose(endpoint, (payload) => {
        emit({ type: "delivery", endpoint, payload });
      }),
    );
  }
  const started = await node.start();
  process.on("message", handle);
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("disconnect", () => shutdown("disconnect"));
  emit({
    type: "ready",
    nodeId: node.nodeId,
    listener: started.listener,
  });
  await stopped;
} catch (error) {
  emit({
    type: "fatal",
    error: { message: error instanceof Error ? error.message : String(error) },
  });
  process.exitCode = 1;
} finally {
  process.off("message", handle);
  await Promise.allSettled(bindings.map((binding) => binding.close()));
  await node?.stop({ drainTimeoutMs: 1_000 }).catch(() => undefined);
  if (process.connected) process.disconnect();
}
