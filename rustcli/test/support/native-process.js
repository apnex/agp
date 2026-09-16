import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
export const executable = process.env.AGP_RUST_CLI
  ?? fileURLToPath(new URL("../../target/debug/agp", import.meta.url));

export function runNative(args, environment = {}) {
  return execute(executable, args, {
    env: { ...process.env, AGP_MANAGEMENT_URL: undefined, ...environment },
    maxBuffer: 8 * 1024 * 1024, timeout: 15_000,
  });
}

export function streamNative(args, input, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env: { ...process.env, AGP_MANAGEMENT_URL: undefined, ...environment },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.stdout.on("data", (bytes) => { stdout += bytes; });
    child.stderr.on("data", (bytes) => { stderr += bytes; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}
