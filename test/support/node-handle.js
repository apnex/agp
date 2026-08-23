import { fork } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A node reached over a process boundary, shaped like a node reached directly.
//
// Geometry, traffic and assertions should not know which side of a process
// boundary a node is on, so this offers the same few things the harness
// actually uses: an id, `send`, the selected-route set, a snapshot, and
// `stop`. Everything is asynchronous, which is why `eventually` had to learn
// to await its probe before this was possible.

const RUNNER = fileURLToPath(new URL("./node-process.mjs", import.meta.url));

export class ProcessNodeHandle {
  #child;
  #pending = new Map();
  #sequence = 0;
  #directory;
  #ready;
  #exited = false;

  constructor({ child, directory, ready }) {
    this.#child = child;
    this.#directory = directory;
    this.#ready = ready;
  }

  get nodeId() {
    return this.#ready.nodeId;
  }

  get listener() {
    return this.#ready.listener;
  }

  #call(command, body = {}) {
    if (this.#exited) return Promise.reject(new Error("node process has exited"));
    this.#sequence += 1;
    const id = String(this.#sequence);
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#child.send({ command, id, ...body });
    });
  }

  accept(message) {
    if (message?.type !== "reply") return;
    const waiter = this.#pending.get(message.id);
    if (waiter === undefined) return;
    this.#pending.delete(message.id);
    if (message.ok) {
      waiter.resolve(message.value);
      return;
    }
    const error = new Error(message.error?.message ?? "remote failure");
    // The code is what callers branch on, so it must survive the boundary.
    if (message.error?.code !== undefined) error.code = message.error.code;
    waiter.reject(error);
  }

  send(source, destination, payload) {
    return this.#call("send", { source, destination, payload });
  }

  /** Offer `count` messages from inside the node's own process. */
  burst(source, destination, count) {
    return this.#call("burst", { source, destination, count });
  }

  /** What this node observed arriving, timed by its own clock. */
  arrivals(endpoint) {
    return this.#call("arrivals", { endpoint });
  }

  resetArrivals(endpoint) {
    return this.#call("reset-arrivals", { endpoint });
  }

  selectedRoutes() {
    return this.#call("selected-routes");
  }

  snapshot() {
    return this.#call("snapshot");
  }

  async stop() {
    if (this.#exited) return;
    this.#exited = true;
    for (const waiter of this.#pending.values()) {
      waiter.reject(new Error("node process stopping"));
    }
    this.#pending.clear();
    const ended = new Promise((resolve) => this.#child.once("exit", resolve));
    try {
      if (this.#child.connected) this.#child.send({ command: "stop" });
    } catch {
      // Already gone; the exit handler still settles.
    }
    const deadline = setTimeout(() => this.#child.kill("SIGKILL"), 5_000);
    await ended;
    clearTimeout(deadline);
    await rm(this.#directory, { recursive: true, force: true });
  }
}

/**
 * Start one node in its own process.
 *
 * Deliveries are pushed into the same array the in-process harness fills, so a
 * traffic driver counting arrivals cannot tell the two apart.
 */
export async function startProcessNode({
  config,
  transport,
  endpoints,
  deliveries,
  streamDeliveries = true,
}) {
  const directory = await mkdtemp(path.join(tmpdir(), "agp-node-"));
  const documentPath = path.join(directory, "node.json");
  await writeFile(
    documentPath,
    JSON.stringify({ config, transport, endpoints, streamDeliveries }),
    "utf8",
  );
  const child = fork(RUNNER, [documentPath], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  let handle;
  const ready = await new Promise((resolve, reject) => {
    const onMessage = (message) => {
      if (message?.type === "ready") {
        child.off("message", onMessage);
        resolve(message);
        return;
      }
      if (message?.type === "fatal") {
        child.off("message", onMessage);
        reject(new Error(message.error?.message ?? "node process failed"));
      }
    };
    child.on("message", onMessage);
    child.once("exit", (code) => {
      reject(new Error(`node process exited before ready with code ${code}`));
    });
  });

  handle = new ProcessNodeHandle({ child, directory, ready });
  child.on("message", (message) => {
    if (message?.type === "delivery") {
      deliveries.push({ endpoint: message.endpoint, payload: message.payload });
      return;
    }
    handle.accept(message);
  });
  return handle;
}
