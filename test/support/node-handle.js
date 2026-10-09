import { fork } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForTestEvent } from "./test-waits.js";

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
  #exit;
  #stopping;
  #requestTimeoutMs;
  #stopTimeoutMs;

  constructor({ child, directory, ready, requestTimeoutMs = 60_000, stopTimeoutMs = 5_000 }) {
    this.#child = child;
    this.#directory = directory;
    this.#ready = ready;
    this.#requestTimeoutMs = requestTimeoutMs;
    this.#stopTimeoutMs = stopTimeoutMs;
    this.#exit = new Promise((resolve) => {
      child.once("close", (code, signal) => {
        this.#exited = true;
        this.#rejectPending(new Error(`Test node process exited: code=${code} signal=${signal}`));
        resolve({ code, signal });
      });
    });
    child.on("error", (error) => this.#rejectPending(error));
  }

  get pid() { return this.#child.pid; }

  get nodeId() {
    return this.#ready.nodeId;
  }

  get listener() {
    return this.#ready.listener;
  }

  #call(command, body = {}) {
    if (this.#exited || this.#stopping) return Promise.reject(new Error("node process has exited or is stopping"));
    this.#sequence += 1;
    const id = String(this.#sequence);
    const reply = new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#child.send({ command, id, ...body }, (error) => {
        if (error) reject(error);
      });
    });
    return waitForTestEvent(reply, `isolated node ${this.nodeId} ${command} reply`, {
      timeoutMs: this.#requestTimeoutMs,
    }).finally(() => this.#pending.delete(id));
  }

  #rejectPending(error) {
    for (const waiter of this.#pending.values()) waiter.reject(error);
    this.#pending.clear();
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

  stop() {
    return this.#stopping ??= this.#stopProcess();
  }

  async #stopProcess() {
    this.#rejectPending(new Error("node process stopping"));
    try {
      if (this.#child.connected) this.#child.send({ command: "stop" }, () => {});
    } catch {
      // Already gone; close observation, not an IPC callback, owns termination.
    }
    try {
      await waitForTestEvent(this.#exit, "isolated node graceful exit", { timeoutMs: this.#stopTimeoutMs });
    } catch (error) {
      if (error.code !== "TEST_EVENT_TIMEOUT") throw error;
      this.#child.kill("SIGKILL");
      await waitForTestEvent(this.#exit, "isolated node forced exit", { timeoutMs: 2_000 });
    }
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
  readyTimeoutMs = 5_000,
  requestTimeoutMs = 60_000,
  stopTimeoutMs = 5_000,
  forkProcess = fork,
}) {
  const directory = await mkdtemp(path.join(tmpdir(), "agp-node-"));
  const documentPath = path.join(directory, "node.json");
  let handle;
  try {
    await writeFile(
      documentPath,
      JSON.stringify({ config, transport, endpoints, streamDeliveries }),
      "utf8",
    );
    const child = forkProcess(RUNNER, [documentPath], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    // Install lifetime observation before waiting for readiness, and drain pipes
    // so diagnostic output cannot block the child on a full stdout/stderr buffer.
    const ready = {};
    handle = new ProcessNodeHandle({ child, directory, ready, requestTimeoutMs, stopTimeoutMs });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => { output = `${output}${chunk}`.slice(-65_536); });
    }
    let onMessage;
    let onExit;
    let onError;
    const readiness = new Promise((resolve, reject) => {
      onMessage = (message) => {
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
      onExit = (code) => {
        reject(new Error(`node process exited before ready with code ${code}`));
      };
      onError = reject;
      child.once("exit", onExit);
      child.once("error", onError);
    });
    try {
      Object.assign(ready, await waitForTestEvent(readiness, "isolated node readiness", { timeoutMs: readyTimeoutMs }));
    } catch (error) {
      error.message += `; pid=${child.pid}; output=${output}`;
      throw error;
    } finally {
      child.off("message", onMessage);
      child.off("exit", onExit);
      child.off("error", onError);
    }
    child.on("message", (message) => {
      if (message?.type === "delivery") {
        deliveries.push({ endpoint: message.endpoint, payload: message.payload });
        return;
      }
      handle.accept(message);
    });
    return handle;
  } catch (error) {
    try {
      if (handle) await handle.stop();
      else await rm(directory, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Test node acquisition and cleanup failed");
    }
    throw error;
  }
}
