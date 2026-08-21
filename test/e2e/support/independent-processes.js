import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROFILE_DOCUMENTS,
  PROFILE_PRESETS,
} from "../../../examples/independent-star/profiles.mjs";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const childProgram = fileURLToPath(
  new URL("./uniform-node-process.mjs", import.meta.url),
);

const hubStarEndpoints = PROFILE_PRESETS.hub.endpoints;
const alphaStarEndpoints = PROFILE_PRESETS.alpha.endpoints;
const betaStarEndpoints = PROFILE_PRESETS.beta.endpoints;
if (
  hubStarEndpoints.length !== 1
  || hubStarEndpoints[0] !== "hub/service"
) {
  throw new Error(
    "independent star fixture must advertise exactly hub/service",
  );
}
const duplicateStarEndpoints = alphaStarEndpoints.filter((endpoint) =>
  betaStarEndpoints.includes(endpoint)
);
if (duplicateStarEndpoints.length !== 1) {
  throw new Error(
    "independent star fixture must advertise exactly one duplicate endpoint",
  );
}

export const STAR_HUB_ENDPOINT = hubStarEndpoints[0];
export const STAR_DUPLICATE_ENDPOINT = duplicateStarEndpoints[0];

export const STAR_ENDPOINTS = Object.freeze({
  hub: hubStarEndpoints,
  alpha: alphaStarEndpoints,
  beta: betaStarEndpoints,
  alphaExclusive: Object.freeze(
    alphaStarEndpoints.filter(
      (endpoint) => endpoint !== STAR_DUPLICATE_ENDPOINT,
    ),
  ),
  betaExclusive: Object.freeze(
    betaStarEndpoints.filter(
      (endpoint) => endpoint !== STAR_DUPLICATE_ENDPOINT,
    ),
  ),
  all: Object.freeze([
    ...new Set([
      ...hubStarEndpoints,
      ...alphaStarEndpoints,
      ...betaStarEndpoints,
    ]),
  ].sort()),
  advertisements: Object.freeze([
    ...hubStarEndpoints,
    ...alphaStarEndpoints,
    ...betaStarEndpoints,
  ].sort()),
});

export const LINE_ENDPOINTS = Object.freeze({
  a: "line/a",
  c: "line/c",
});

export class IndependentProcessTopology {
  #directory;
  #nodes = [];

  static async create() {
    const directory = await mkdtemp(path.join(tmpdir(), "agp-process-e2e-"));
    return new IndependentProcessTopology(directory);
  }

  constructor(directory) {
    this.#directory = directory;
  }

  get nodes() {
    return Object.freeze([...this.#nodes]);
  }

  async start(name, document) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      throw new Error(`invalid process fixture name: ${name}`);
    }
    const configPath = path.join(this.#directory, `${name}.json`);
    await writeFile(configPath, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    const node = new IndependentNodeProcess(name, configPath);
    this.#nodes.push(node);
    await node.start();
    return node;
  }

  async dispose() {
    await Promise.allSettled(
      [...this.#nodes].reverse().map((node) => node.stop()),
    );
    await rm(this.#directory, { recursive: true, force: true });
  }
}

export class IndependentNodeProcess {
  #name;
  #configPath;
  #child;
  #messages = [];
  #waiters = new Set();
  #stderr = "";
  #stdout = "";
  #requestSequence = 0;
  #exit;
  #ready;

  constructor(name, configPath) {
    this.#name = name;
    this.#configPath = configPath;
  }

  get pid() {
    return this.#child?.pid;
  }

  get ready() {
    return this.#ready;
  }

  get alive() {
    return (
      this.#child !== undefined
      && this.#child.exitCode === null
      && this.#child.signalCode === null
    );
  }

  async start() {
    if (this.#child !== undefined) throw new Error(`${this.#name} already started`);
    const child = spawn(process.execPath, [childProgram, this.#configPath], {
      cwd: workspace,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    this.#child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      this.#stdout = boundedAppend(this.#stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      this.#stderr = boundedAppend(this.#stderr, chunk);
    });
    child.on("message", (message) => this.#publish(message));
    child.once("exit", (code, signal) => {
      this.#exit = { code, signal };
      for (const waiter of [...this.#waiters]) waiter.onExit();
    });
    child.once("error", (error) => {
      this.#stderr = boundedAppend(this.#stderr, error.stack ?? error.message);
    });

    const message = await this.waitForMessage(
      (candidate) => candidate?.type === "ready" ? candidate : undefined,
      `${this.#name} readiness`,
    );
    this.#ready = message.ready;
    return this.#ready;
  }

  waitForMessage(predicate, description, timeoutMs = 10_000) {
    for (const message of this.#messages) {
      const value = predicate(message);
      if (value !== undefined && value !== false) return Promise.resolve(value);
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.#waiters.delete(waiter);
        if (error === undefined) resolve(value);
        else reject(error);
      };
      const waiter = {
        onMessage: (message) => {
          const value = predicate(message);
          if (value !== undefined && value !== false) finish(undefined, value);
        },
        onExit: () => finish(this.#failure(
          `${description} ended at process exit`,
        )),
      };
      const timer = setTimeout(() => {
        finish(this.#failure(`${description} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref?.();
      this.#waiters.add(waiter);
    });
  }

  async send(source, destination, payload, options = {}) {
    const requestId = `${this.#name}-${++this.#requestSequence}`;
    const response = this.waitForMessage(
      (message) =>
        message?.type === "response" && message.requestId === requestId
          ? message
          : undefined,
      `${this.#name} send ${requestId}`,
    );
    await this.#sendIpc({
      command: "send",
      requestId,
      source,
      destination,
      payload,
      options,
    });
    const result = await response;
    if (!result.ok) {
      const error = new Error(result.error?.message ?? "child send failed");
      error.code = result.error?.code;
      throw error;
    }
    return result.receipt;
  }

  waitForDelivery(endpoint, correlationId, timeoutMs = 10_000) {
    return this.waitForMessage(
      (message) =>
        message?.type === "delivery"
        && message.endpoint === endpoint
        && message.delivery?.correlationId === correlationId
          ? message
          : undefined,
      `${this.#name} delivery ${correlationId}`,
      timeoutMs,
    );
  }

  async stop(timeoutMs = 5_000) {
    if (this.#child === undefined) return { code: 0, signal: null };
    if (!this.alive) return this.#exit;
    await this.#sendIpc({ command: "stop" }).catch(() => undefined);
    try {
      return await this.#waitForExit(timeoutMs);
    } catch {
      if (this.alive) this.#child.kill("SIGTERM");
      try {
        return await this.#waitForExit(2_000);
      } catch {
        if (this.alive) this.#child.kill("SIGKILL");
        return this.#waitForExit(2_000);
      }
    }
  }

  #publish(message) {
    this.#messages.push(message);
    if (this.#messages.length > 2_048) this.#messages.shift();
    for (const waiter of [...this.#waiters]) waiter.onMessage(message);
  }

  #sendIpc(message) {
    return new Promise((resolve, reject) => {
      if (!this.alive || !this.#child.connected) {
        reject(this.#failure("IPC channel is unavailable"));
        return;
      }
      this.#child.send(message, (error) => {
        if (error === null) resolve();
        else reject(error);
      });
    });
  }

  #waitForExit(timeoutMs) {
    if (this.#exit !== undefined) return Promise.resolve(this.#exit);
    return new Promise((resolve, reject) => {
      const onExit = (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      };
      const timer = setTimeout(() => {
        this.#child.off("exit", onExit);
        reject(this.#failure(`exit timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref?.();
      this.#child.once("exit", onExit);
    });
  }

  #failure(message) {
    return new Error(
      `${this.#name}: ${message}; exit=${JSON.stringify(this.#exit)}`
        + `; stderr=${this.#stderr}; stdout=${this.#stdout}`,
    );
  }
}

export async function startIndependentStar(topology) {
  const hubDocument = cloneProfile("hub");
  hubDocument.managementPort = 0;
  hubDocument.transport.listeners[0].url = "ws://127.0.0.1:0/agp";
  const hub = await topology.start("hub", hubDocument);
  const hubAddress = requiredListenerAddress(hub);

  const alphaDocument = cloneProfile("alpha");
  alphaDocument.managementPort = 0;
  alphaDocument.transport.targets[0].url = hubAddress;
  const betaDocument = cloneProfile("beta");
  betaDocument.managementPort = 0;
  betaDocument.transport.targets[0].url = hubAddress;
  const alpha = await topology.start("alpha", alphaDocument);
  const beta = await topology.start("beta", betaDocument);
  return Object.freeze({ hub, alpha, beta });
}

export async function startIndependentLine(topology) {
  const a = await topology.start(
    "line-a",
    processDocument({
      nodeId: "line.a",
      listen: { host: "127.0.0.1", port: 0, path: "/agp" },
      endpoints: [LINE_ENDPOINTS.a],
    }),
  );
  const b = await topology.start(
    "line-b",
    processDocument({
      nodeId: "line.b",
      listen: { host: "127.0.0.1", port: 0, path: "/agp" },
      peers: [peer("b-a", "line.a", requiredListenerAddress(a))],
      transit: true,
      endpoints: [],
    }),
  );
  const c = await topology.start(
    "line-c",
    processDocument({
      nodeId: "line.c",
      peers: [peer("c-b", "line.b", requiredListenerAddress(b))],
      endpoints: [LINE_ENDPOINTS.c],
    }),
  );
  return Object.freeze({ a, b, c });
}

export function processDocument({
  nodeId,
  listen,
  peers = [],
  transit = false,
  endpoints,
}) {
  const listenerRef = "ws.listen";
  const listenerUrl = listen === undefined
    ? undefined
    : `ws://${listen.host}:${listen.port}${listen.path ?? "/"}`;
  const corePeers = peers.map(({ url: _url, ...configuredPeer }) =>
    configuredPeer
  );
  return {
    managementPort: 0,
    endpoints,
    transport: {
      listeners: listenerUrl === undefined
        ? []
        : [webSocketBinding(listenerRef, listenerUrl)],
      targets: peers.map(({ transportRef, url }) =>
        webSocketBinding(transportRef, url)
      ),
    },
    config: {
      nodeId,
      ...(listen === undefined
        ? {}
        : { listen: { transportRef: listenerRef } }),
      ...(corePeers.length === 0 ? {} : { peers: corePeers }),
      transit: { enabled: transit, defaultHopLimit: 16 },
      identityAdmission: { mode: "allow" },
      routeAdmission: { mode: "allow" },
      timers: {
        holdTimeMs: 30_000,
        openTimeoutMs: 5_000,
        routeAckTimeoutMs: 5_000
      },
      limits: {
        maxLocalEndpoints: 32,
        maxRoutesPerSnapshot: 256,
        maxPathLength: 64,
        maxHopCount: 16,
      },
      capacity: {
        maxSessions: 16,
        maxPendingHandshakes: 16,
        maxEventSubscribers: 16,
        eventSubscriberBuffer: 256,
      },
    },
  };
}

export function peer(adjacencyId, expectedNodeId, url) {
  return {
    adjacencyId,
    expectedNodeId,
    transportRef: `ws.${adjacencyId}`,
    url,
    reconnect: {
      enabled: true,
      initialDelayMs: 25,
      maximumDelayMs: 250,
      multiplier: 2,
      jitterRatio: 0,
    },
  };
}

function webSocketBinding(transportRef, url) {
  return {
    transportRef,
    url,
    compression: { mode: "disabled" },
    security: { mode: "trusted-development" },
  };
}

export function requiredListenerAddress(node) {
  const address = node.ready?.listener?.publication?.displayAddress;
  if (typeof address !== "string") {
    throw new Error(`${node.ready?.nodeId ?? "node"} published no listener address`);
  }
  return address;
}

export async function getProcessManagement(node, resource) {
  const response = await fetch(`${node.ready.managementUrl}/v1/${resource}`);
  if (!response.ok) {
    throw new Error(
      `${node.ready.nodeId} management ${resource} returned ${response.status}`,
    );
  }
  return response.json();
}

export async function eventuallyProcess(
  probe,
  description,
  timeoutMs = 10_000,
) {
  const deadline = performance.now() + timeoutMs;
  let lastError;
  while (performance.now() < deadline) {
    try {
      const value = await probe();
      if (value !== undefined && value !== false) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `did not observe ${description}`
      + (lastError instanceof Error ? `: ${lastError.message}` : ""),
  );
}

export function pidExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function cloneProfile(profile) {
  return structuredClone(PROFILE_DOCUMENTS[profile]);
}

function boundedAppend(current, chunk) {
  return `${current}${chunk}`.slice(-65_536);
}
