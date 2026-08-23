import {
  resolveProfile,
} from "./independent-star/profiles.mjs";
import {
  startProfileRuntime,
} from "./independent-star/node-runtime.mjs";
import {
  waitForShutdownSignal,
} from "./independent-star/runtime.mjs";

const CONVERGENCE_TIMEOUT_MS = 10_000;
const DELIVERY_TIMEOUT_MS = 5_000;
const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => argument !== "--persist")) {
  throw new Error("usage: node examples/websocket-star.mjs [--persist]");
}
const persistent = arguments_.includes("--persist");

let hub;
let alpha;
let beta;
const request = deferred();
const reply = deferred();

try {
  hub = await startProfileRuntime(resolveProfile("hub", {
    webSocketHost: "127.0.0.1",
    webSocketPort: "0",
    managementPort: "0",
  }));
  const hubUrl = hub.ready.listener?.publication?.displayAddress;
  if (hubUrl === undefined) {
    throw new Error("hub did not publish a WebSocket listener address");
  }

  alpha = await startProfileRuntime(
    resolveProfile("alpha", {
      hubUrl,
      managementPort: "0",
    }),
    {
      endpointHandlers: {
        "catalog/products.get": (payload, context) => {
          reply.resolve({ payload, delivery: context.delivery });
        },
      },
    },
  );
  beta = await startProfileRuntime(
    resolveProfile("beta", {
      hubUrl,
      managementPort: "0",
    }),
    {
      endpointHandlers: {
        "billing/charge": async (payload, context) => {
          request.resolve({ payload, delivery: context.delivery });
          try {
            await beta.node.send(
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
  );

  await Promise.all([
    waitForSelectedRoute(alpha.node.operations, "billing/charge"),
    waitForSelectedRoute(beta.node.operations, "catalog/products.get"),
    waitForAckedExport(
      alpha.node.operations,
      "catalog/products.get",
      "hub",
    ),
    waitForAckedExport(
      hub.node.operations,
      "catalog/products.get",
      "leaf.beta",
    ),
    waitForAckedExport(
      beta.node.operations,
      "billing/charge",
      "hub",
    ),
    waitForAckedExport(
      hub.node.operations,
      "billing/charge",
      "leaf.alpha",
    ),
  ]);

  process.stdout.write(
    `AGP_TOPOLOGY_READY ${JSON.stringify({
      hub: hub.ready,
      alpha: alpha.ready,
      beta: beta.ready,
    })}\n`,
  );
  process.stdout.write("Selected hub routes:\n");
  for (const route of hub.node.operations.routes().selected) {
    process.stdout.write(
      `${JSON.stringify({
        endpoint: route.endpoint,
        routeClass: route.routeClass,
        learnedKind: route.learnedKind,
        originNodeId: route.originNodeId,
        nextHop: route.nextHop,
      })}\n`,
    );
  }

  const correlationId = "demo-request-1";
  const receipt = await alpha.node.send(
    "catalog/products.get",
    "billing/charge",
    {
      kind: "demo.request",
      text: "hello through a uniform AGP node",
    },
    {
      correlationId,
      timeoutMs: DELIVERY_TIMEOUT_MS,
    },
  );
  await withDeadline(
    request.promise,
    DELIVERY_TIMEOUT_MS,
    "request delivery",
  );
  const received = await withDeadline(
    reply.promise,
    DELIVERY_TIMEOUT_MS,
    "reply delivery",
  );
  process.stdout.write(
    `AGP_DEMO_DELIVERED ${JSON.stringify({
      receipt,
      reply: {
        correlationId: received.delivery.correlationId,
        source: received.delivery.source,
        destination: received.delivery.destination,
        payload: received.payload,
      },
    })}\n`,
  );

  if (persistent) {
    process.stdout.write(
      "Persistent mode: running until SIGINT or SIGTERM\n",
    );
    await waitForShutdownSignal();
  }
} catch (error) {
  for (const [profile, runtime] of [
    ["hub", hub],
    ["alpha", alpha],
    ["beta", beta],
  ]) {
    if (runtime === undefined) continue;
    process.stderr.write(
      `AGP_DEMO_FAILURE_STATE ${JSON.stringify({
        profile,
        counters: runtime.node.operations.counters(),
        connections: runtime.node.operations.connections(),
        labelBindings: runtime.node.operations.labelBindings(),
      })}\n`,
    );
  }
  throw error;
} finally {
  await beta?.stop().catch(() => undefined);
  await alpha?.stop().catch(() => undefined);
  await hub?.stop().catch(() => undefined);
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
  throw new Error(`selected route ${endpoint} did not converge in ${timeoutMs}ms`);
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
    `ACKed export ${endpoint} to ${remoteNodeId} did not converge in ${timeoutMs}ms`,
  );
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
