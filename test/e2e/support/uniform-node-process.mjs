import { readFile } from "node:fs/promises";

import { createManagementHttpServer } from "@agp/management-http";
import { createNode } from "@agp/node";
import { createNodeWsTransport } from "@agp/transport-node-ws";

const documentPath = process.argv[2];
if (documentPath === undefined) {
  throw new Error("one process configuration document is required");
}
const document = JSON.parse(await readFile(documentPath, "utf8"));
validateDocument(document);

let node;
let management;
const bindings = [];
let shutdown;
const shutdownRequested = new Promise((resolve) => {
  shutdown = resolve;
});

try {
  node = createNode(document.config, {
    transport: createNodeWsTransport(document.transport),
  });
  for (const endpoint of document.endpoints) {
    bindings.push(
      await node.expose(endpoint, (payload, context) => {
        emit({
          type: "delivery",
          endpoint,
          payload,
          delivery: context.delivery,
        });
      }),
    );
  }

  const started = await node.start();
  management = createManagementHttpServer(node.operations, {
    host: "127.0.0.1",
    port: document.managementPort,
  });
  const managementAddress = await management.start();

  process.on("message", receiveCommand);
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("disconnect", () => shutdown("disconnect"));
  emit({
    type: "ready",
    ready: {
      nodeId: node.nodeId,
      processId: process.pid,
      listener: started.listener,
      managementUrl: managementAddress.url,
      endpoints: document.endpoints,
      peers: document.config.peers ?? [],
    },
  });

  await shutdownRequested;
} catch (error) {
  emit({
    type: "fatal",
    error: errorValue(error),
  });
  process.stderr.write(
    `uniform test node failed: ${errorMessage(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  process.off("message", receiveCommand);
  await management?.stop().catch(() => undefined);
  await Promise.allSettled(bindings.map((binding) => binding.close()));
  await node?.stop({ drainTimeoutMs: 1_000 }).catch(() => undefined);
  if (process.connected) process.disconnect();
}

async function receiveCommand(message) {
  if (message === null || typeof message !== "object") return;
  if (message.command === "stop") {
    shutdown("command");
    return;
  }
  if (message.command !== "send" || typeof message.requestId !== "string") {
    return;
  }
  try {
    const receipt = await node.send(
      message.source,
      message.destination,
      message.payload,
      message.options ?? {},
    );
    emit({
      type: "response",
      requestId: message.requestId,
      ok: true,
      receipt,
    });
  } catch (error) {
    emit({
      type: "response",
      requestId: message.requestId,
      ok: false,
      error: errorValue(error),
    });
  }
}

function emit(value) {
  if (process.connected && typeof process.send === "function") {
    process.send(value);
    return;
  }
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function validateDocument(value) {
  if (
    value === null
    || typeof value !== "object"
    || value.config === null
    || typeof value.config !== "object"
    || typeof value.config.nodeId !== "string"
    || value.transport === null
    || typeof value.transport !== "object"
    || !Array.isArray(value.transport.listeners)
    || !Array.isArray(value.transport.targets)
    || !Array.isArray(value.endpoints)
    || !Number.isSafeInteger(value.managementPort)
  ) {
    throw new Error("invalid process configuration document");
  }
}

function errorValue(error) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: errorMessage(error),
    ...(typeof error?.code === "string" ? { code: error.code } : {}),
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "unknown error";
}
