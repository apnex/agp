import { createManagementHttpServer } from "@agp/management-http";
import { createNode } from "@agp/node";
import { createNodeWsTransport } from "@agp/transport-node-ws";

export async function startProfileRuntime(
  profile,
  { endpointHandlers = {} } = {},
) {
  const diagnostics = {
    emit(record) {
      process.stderr.write(
        `AGP_DIAGNOSTIC ${JSON.stringify({
          profile: profile.profile,
          ...record,
        })}\n`,
      );
    },
  };
  const node = createNode(profile.config, {
    transport: createNodeWsTransport(profile.transport, { diagnostics }),
    diagnostics,
  });
  const bindings = [];
  let management;
  let stopped = false;

  try {
    for (const endpoint of profile.endpoints) {
      const configuredHandler = endpointHandlers[endpoint];
      bindings.push(
        await node.expose(
          endpoint,
          configuredHandler
            ?? ((payload, context) => {
              process.stdout.write(
                `AGP_ENDPOINT_MESSAGE ${JSON.stringify({
                  profile: profile.profile,
                  nodeId: profile.nodeId,
                  endpoint,
                  source: context.delivery.source,
                  destination: context.delivery.destination,
                  correlationId: context.delivery.correlationId,
                  payload,
                })}\n`,
              );
            }),
        ),
      );
    }

    const started = await node.start();
    management = createManagementHttpServer(node.operations, {
      host: "127.0.0.1",
      port: profile.managementPort,
    });
    const managementAddress = await management.start();

    const ready = Object.freeze({
      profile: profile.profile,
      nodeId: profile.nodeId,
      processId: process.pid,
      ...(started.listener === undefined
        ? {}
        : { listener: started.listener }),
      ...(profile.hubUrl === undefined ? {} : { hubUrl: profile.hubUrl }),
      managementUrl: managementAddress.url,
      endpoints: profile.endpoints,
      peers: profile.config.peers?.map((peer) => ({
        adjacencyId: peer.adjacencyId,
        expectedNodeId: peer.expectedNodeId,
        transportRef: peer.transportRef,
      })) ?? [],
    });

    return Object.freeze({
      node,
      ready,
      async stop() {
        if (stopped) return;
        stopped = true;
        await management?.stop().catch(() => undefined);
        await Promise.allSettled(bindings.map((binding) => binding.close()));
        await node.stop({ drainTimeoutMs: 1_000 }).catch(() => undefined);
      },
    });
  } catch (error) {
    await management?.stop().catch(() => undefined);
    await Promise.allSettled(bindings.map((binding) => binding.close()));
    await node.stop({ drainTimeoutMs: 1_000 }).catch(() => undefined);
    throw error;
  }
}
