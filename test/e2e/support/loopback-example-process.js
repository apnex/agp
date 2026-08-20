import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const exampleProgram = fileURLToPath(
  new URL("../../../examples/loopback-hub-spokes/example.mjs", import.meta.url),
);
const recordPrefixes = Object.freeze({
  ready: "AGP_LOOPBACK_TOPOLOGY_READY",
  delivered: "AGP_LOOPBACK_DEMO_DELIVERED",
});

export class LoopbackExampleProcess {
  #child;
  #exit;
  #records = new Map();
  #recordErrors = new Map();
  #waiters = new Set();
  #stdout = "";
  #stderr = "";
  #lineBuffer = "";

  get alive() {
    return (
      this.#child !== undefined
      && this.#child.exitCode === null
      && this.#child.signalCode === null
    );
  }

  async start() {
    if (this.#child !== undefined) {
      throw new Error("Loopback example process is already started");
    }
    const child = spawn(process.execPath, [exampleProgram, "--persist"], {
      cwd: workspace,
      env: {
        ...process.env,
        AGP_LOOPBACK_HUB_MANAGEMENT_PORT: "0",
        AGP_LOOPBACK_ALPHA_MANAGEMENT_PORT: "0",
        AGP_LOOPBACK_BETA_MANAGEMENT_PORT: "0",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.#child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.#consumeStdout(chunk));
    child.stderr.on("data", (chunk) => {
      this.#stderr = boundedAppend(this.#stderr, chunk);
    });
    child.once("error", (error) => {
      this.#stderr = boundedAppend(
        this.#stderr,
        error.stack ?? error.message,
      );
    });
    child.once("exit", (code, signal) => {
      this.#consumeStdout("\n");
      this.#exit = { code, signal };
      for (const waiter of [...this.#waiters]) waiter.onExit();
    });
    return this.waitForRecord("ready", "topology readiness");
  }

  waitForDelivery() {
    return this.waitForRecord("delivered", "demonstration delivery");
  }

  waitForRecord(name, description, timeoutMs = 15_000) {
    if (!(name in recordPrefixes)) {
      throw new Error(`unknown Loopback example record: ${name}`);
    }
    if (this.#records.has(name)) {
      return Promise.resolve(this.#records.get(name));
    }
    if (this.#recordErrors.has(name)) {
      return Promise.reject(this.#failure(
        `${description} was not valid JSON`,
        this.#recordErrors.get(name),
      ));
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
        onRecord: (recordName, value, error) => {
          if (recordName !== name) return;
          if (error === undefined) finish(undefined, value);
          else finish(this.#failure(
            `${description} was not valid JSON`,
            error,
          ));
        },
        onExit: () => finish(this.#failure(
          `${description} ended at process exit`,
        )),
      };
      const timer = setTimeout(() => {
        finish(this.#failure(
          `${description} timed out after ${timeoutMs}ms`,
        ));
      }, timeoutMs);
      timer.unref?.();
      this.#waiters.add(waiter);
    });
  }

  async stop(timeoutMs = 5_000) {
    if (this.#child === undefined) return { code: 0, signal: null };
    if (!this.alive) return this.#exit;
    this.#child.kill("SIGTERM");
    try {
      return await this.#waitForExit(timeoutMs);
    } catch (error) {
      if (this.alive) this.#child.kill("SIGKILL");
      await this.#waitForExit(2_000).catch(() => undefined);
      throw error;
    }
  }

  #consumeStdout(chunk) {
    this.#stdout = boundedAppend(this.#stdout, chunk);
    this.#lineBuffer += chunk;
    const lines = this.#lineBuffer.split(/\r?\n/);
    this.#lineBuffer = lines.pop() ?? "";
    for (const line of lines) this.#consumeLine(line);
  }

  #consumeLine(line) {
    for (const [name, prefix] of Object.entries(recordPrefixes)) {
      const marker = `${prefix} `;
      if (!line.startsWith(marker)) continue;
      try {
        const value = JSON.parse(line.slice(marker.length));
        this.#records.set(name, value);
        this.#publish(name, value);
      } catch (error) {
        this.#recordErrors.set(name, error);
        this.#publish(name, undefined, error);
      }
    }
  }

  #publish(name, value, error) {
    for (const waiter of [...this.#waiters]) {
      waiter.onRecord(name, value, error);
    }
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

  #failure(message, cause) {
    return new Error(
      `${message}; exit=${JSON.stringify(this.#exit)}`
        + `; stderr=${this.#stderr}; stdout=${this.#stdout}`,
      cause === undefined ? undefined : { cause },
    );
  }
}

function boundedAppend(current, chunk) {
  return `${current}${chunk}`.slice(-65_536);
}
