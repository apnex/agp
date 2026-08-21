import { createManagementHttpServer } from "@agp/management-http";
import { createNode } from "@agp/node";
import { createLoopbackFabric } from "@agp/transport-loopback";

import {
  PROFILE_NAMES,
  resolveLoopbackTopology,
} from "./profiles.mjs";

const MANAGEMENT_HOST = "127.0.0.1";
const DRAIN_TIMEOUT_MS = 1_000;

export async function startLoopbackTopology(
  configuration = resolveLoopbackTopology(),
  { endpointHandlers = {} } = {},
) {
  const fabricDiagnostics = diagnosticSink("fabric");
  const fabric = createLoopbackFabric(
    configuration.fabric,
    { diagnostics: fabricDiagnostics },
  );
  const nodes = {};
  let stopPromise;

  try {
    for (const profileName of PROFILE_NAMES) {
      const profile = configuration.profiles[profileName];
      const builder = fabric.createTransport(profile.transport.config);
      const port = builder.createPort({
        listeners: bindingMap(profile.transport.listeners),
        targets: bindingMap(profile.transport.targets),
      });
      const diagnostics = diagnosticSink(profileName);
      nodes[profileName] = {
        profile,
        node: createNode(profile.nodeConfig, {
          transport: port,
          diagnostics,
        }),
        bindings: [],
        management: undefined,
        started: undefined,
      };
    }

    for (const profileName of PROFILE_NAMES) {
      const runtime = nodes[profileName];
      for (const endpoint of runtime.profile.endpoints) {
        const configuredHandler = endpointHandlers[profileName]?.[endpoint];
        runtime.bindings.push(
          await runtime.node.expose(
            endpoint,
            configuredHandler ?? defaultEndpointHandler(profileName, endpoint),
          ),
        );
      }
    }

    nodes.hub.started = await nodes.hub.node.start();
    [nodes.alpha.started, nodes.beta.started] = await Promise.all([
      nodes.alpha.node.start(),
      nodes.beta.node.start(),
    ]);

    for (const profileName of PROFILE_NAMES) {
      const runtime = nodes[profileName];
      runtime.management = createManagementHttpServer(
        runtime.node.operations,
        {
          host: MANAGEMENT_HOST,
          port: runtime.profile.managementPort,
        },
      );
      runtime.managementAddress = await runtime.management.start();
    }

    const publicNodes = Object.fromEntries(
      PROFILE_NAMES.map((profileName) => {
        const runtime = nodes[profileName];
        return [
          profileName,
          Object.freeze({
            profile: runtime.profile,
            node: runtime.node,
            get ready() {
              return nodeReady(runtime);
            },
          }),
        ];
      }),
    );
    const topology = {
      fabric,
      nodes: Object.freeze(publicNodes),
      get ready() {
        return topologyReady(fabric, nodes);
      },
      stop() {
        stopPromise ??= stopTopology(fabric, nodes);
        return stopPromise;
      },
    };
    return Object.freeze(topology);
  } catch (error) {
    await stopTopology(fabric, nodes);
    throw error;
  }
}

function bindingMap(records) {
  return new Map(records.map(({ transportRef, binding }) => [
    transportRef,
    binding,
  ]));
}

function nodeReady(runtime) {
  return Object.freeze({
    profile: runtime.profile.profile,
    nodeId: runtime.profile.nodeConfig.nodeId,
    managementUrl: runtime.managementAddress.url,
    endpoints: runtime.profile.endpoints,
    peers: Object.freeze(
      (runtime.profile.nodeConfig.peers ?? []).map((peer) =>
        Object.freeze({
          adjacencyId: peer.adjacencyId,
          expectedNodeId: peer.expectedNodeId,
          transportRef: peer.transportRef,
        })
      ),
    ),
    ...(runtime.started.listener === undefined
      ? {}
      : { listener: runtime.started.listener }),
  });
}

function topologyReady(fabric, nodes) {
  return Object.freeze({
    topology: "loopback-star",
    processId: process.pid,
    fabric: fabric.snapshot(),
    nodes: Object.freeze(
      Object.fromEntries(
        PROFILE_NAMES.map((profileName) => [
          profileName,
          nodeReady(nodes[profileName]),
        ]),
      ),
    ),
  });
}

async function stopTopology(fabric, nodes) {
  for (const profileName of [...PROFILE_NAMES].reverse()) {
    await nodes[profileName]?.management?.stop().catch(() => undefined);
  }
  for (const profileName of [...PROFILE_NAMES].reverse()) {
    await Promise.allSettled(
      (nodes[profileName]?.bindings ?? []).map((binding) => binding.close()),
    );
  }
  for (const profileName of ["beta", "alpha", "hub"]) {
    await nodes[profileName]?.node.stop({
      drainTimeoutMs: DRAIN_TIMEOUT_MS,
    }).catch(() => undefined);
  }
  await fabric.close(AbortSignal.timeout(DRAIN_TIMEOUT_MS))
    .catch(() => undefined);
}

function diagnosticSink(scope) {
  return {
    emit(record) {
      process.stderr.write(
        `AGP_LOOPBACK_DIAGNOSTIC ${JSON.stringify({ scope, ...record })}\n`,
      );
    },
  };
}

function defaultEndpointHandler(profile, endpoint) {
  return (payload, context) => {
    process.stdout.write(
      `AGP_LOOPBACK_ENDPOINT_MESSAGE ${JSON.stringify({
        profile,
        endpoint,
        source: context.delivery.source,
        destination: context.delivery.destination,
        correlationId: context.delivery.correlationId,
        payload,
      })}\n`,
    );
  };
}
