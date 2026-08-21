import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
export const cliRoot = path.resolve(testRoot, "../..");

export function runProcess(executable, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd ?? cliRoot,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`process timed out: ${path.basename(executable)}`));
    }, options.timeoutMs ?? 10_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    // A renderer may reject its arguments and exit before reading stdin. That
    // is a valid outcome the exit code already proves, so a broken pipe here is
    // the child winning the race rather than a fixture failure.
    child.stdin.on("error", (error) => {
      if (error?.code !== "EPIPE") reject(error);
    });
    child.stdin.end(options.input);
  });
}

export function runBash(script, args = [], options = {}) {
  return runProcess("/bin/bash", [script, ...args], options);
}

export async function readJsonFixture(name) {
  return JSON.parse(
    await readFile(path.join(testRoot, name), "utf8"),
  );
}

export async function createJsonServer(handler) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
    });
    try {
      const result = await handler(request, requests.length);
      const status = result.status ?? 200;
      const body =
        typeof result.body === "string"
          ? result.body
          : JSON.stringify(result.body);
      response.writeHead(status, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      });
      response.end(body);
    } catch {
      response.destroy();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    requests,
    url: `http://127.0.0.1:${address.port}`,
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
