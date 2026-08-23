import { resolveLoopbackTopology } from "./profiles.mjs";
import { startLoopbackTopology } from "./topology-runtime.mjs";

const CONVERGENCE_TIMEOUT_MS = 10_000;
const DELIVERY_TIMEOUT_MS = 5_000;
const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => argument !== "--persist")) {
  throw new Error(
    "usage: node examples/loopback-star/example.mjs [--persist]",
  );
}
const persistent = arguments_.includes("--persist");
const configuration = resolveLoopbackTopology();
const allEndpoints = [
  ...new Set(
    Object.values(configuration.profiles)
      .flatMap(({ endpoints }) => endpoints),
  ),
];
const request = deferred();
const reply = deferred();
let topology;

try {
  topology = await startLoopbackTopology(configuration, {
    endpointHandlers: {
      alpha: {
        "catalog/products.get": (payload, context) => {
          reply.resolve({ payload, delivery: context.delivery });
        },
      },
      beta: {
        "billing/charge": async (payload, context) => {
          request.resolve({ payload, delivery: context.delivery });
          try {
            await topology.nodes.beta.node.send(
              "billing/charge",
              context.delivery.source.endpoint,
              {
                kind: "demo.reply",
                echoed: payload,
              },
              {
                correlationId: context.delivery.correlationId,
                timeoutMs: DELIVERY_TIMEOUT_MS,
              },
            );
          } catch (error) {
            reply.reject(error);
            throw error;
          }
        },
      },
    },
  });

  await Promise.all([
    ...Object.values(topology.nodes).flatMap(({ node }) =>
      allEndpoints.map((endpoint) =>
        waitForSelectedRoute(node.operations, endpoint)
      )
    ),
    waitForAckedExport(
      topology.nodes.alpha.node.operations,
      "catalog/products.get",
      "hub",
    ),
    waitForAckedExport(
      topology.nodes.hub.node.operations,
      "catalog/products.get",
      "leaf.beta",
    ),
    waitForAckedExport(
      topology.nodes.beta.node.operations,
      "billing/charge",
      "hub",
    ),
    waitForAckedExport(
      topology.nodes.hub.node.operations,
      "billing/charge",
      "leaf.alpha",
    ),
  ]);

  process.stdout.write(
    `AGP_LOOPBACK_TOPOLOGY_READY ${JSON.stringify(topology.ready)}\n`,
  );

  const correlationId = "loopback-demo-request-1";
  const receipt = await topology.nodes.alpha.node.send(
    "catalog/products.get",
    "billing/charge",
    {
      kind: "demo.request",
      text: "hello through the production Loopback transport",
    },
    {
      correlationId,
      timeoutMs: DELIVERY_TIMEOUT_MS,
    },
  );
  const receivedRequest = await withDeadline(
    request.promise,
    DELIVERY_TIMEOUT_MS,
    "request delivery",
  );
  const receivedReply = await withDeadline(
    reply.promise,
    DELIVERY_TIMEOUT_MS,
    "reply delivery",
  );

  process.stdout.write(
    `AGP_LOOPBACK_DEMO_DELIVERED ${JSON.stringify({
      receipt,
      request: {
        correlationId: receivedRequest.delivery.correlationId,
        source: receivedRequest.delivery.source,
        destination: receivedRequest.delivery.destination,
        payload: receivedRequest.payload,
      },
      reply: {
        correlationId: receivedReply.delivery.correlationId,
        source: receivedReply.delivery.source,
        destination: receivedReply.delivery.destination,
        payload: receivedReply.payload,
      },
      fabric: topology.fabric.snapshot(),
    })}\n`,
  );

  if (persistent) {
    process.stdout.write(
      "Persistent mode: running until SIGINT or SIGTERM\n",
    );
    await waitForShutdownSignal();
  }
} catch (error) {
  for (const [profile, runtime] of Object.entries(topology?.nodes ?? {})) {
    process.stderr.write(
      `AGP_LOOPBACK_FAILURE_STATE ${JSON.stringify({
        profile,
        counters: runtime.node.operations.counters(),
        connections: runtime.node.operations.connections(),
        labelBindings: runtime.node.operations.labelBindings(),
      })}\n`,
    );
  }
  throw error;
} finally {
  await topology?.stop().catch(() => undefined);
}

async function waitForSelectedRoute(
  operations,
  endpoint,
  timeoutMs = CONVERGENCE_TIMEOUT_MS,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const route = operations.routes().selected.find(
      (candidate) => candidate.endpoint === endpoint,
    );
    if (route !== undefined) return route;
    await delay(25);
  }
  throw new Error(
    `selected route ${endpoint} did not converge in ${timeoutMs}ms`,
  );
}

async function waitForAckedExport(
  operations,
  endpoint,
  remoteNodeId,
  timeoutMs = CONVERGENCE_TIMEOUT_MS,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const route = operations.routeExports().items.find(
      (candidate) =>
        candidate.endpoint === endpoint
        && candidate.remoteNodeId === remoteNodeId
        && candidate.state === "acked",
    );
    if (route !== undefined) return route;
    await delay(25);
  }
  throw new Error(
    `ACKed export ${endpoint} to ${remoteNodeId} did not converge `
      + `in ${timeoutMs}ms`,
  );
}

function waitForShutdownSignal() {
  return new Promise((resolve) => {
    const finish = (signal) => {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      resolve(signal);
    };
    const onInterrupt = () => finish("SIGINT");
    const onTerminate = () => finish("SIGTERM");
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function withDeadline(promise, timeoutMs, description) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${description} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
