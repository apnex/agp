import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execute = promisify(execFile);
export const executable = process.env.AGP_RUST_CLI
  ?? fileURLToPath(new URL("../../target/debug/agp", import.meta.url));

export async function runNative(args, environment = {}) {
  const config = mkdtempSync(join(tmpdir(), "agp-native-config-"));
  try {
    return await execute(executable, args, {
      env: { ...process.env, AGP_MANAGEMENT_URL: undefined, XDG_CONFIG_HOME: config, ...environment },
      maxBuffer: 8 * 1024 * 1024, timeout: 15_000,
    });
  } finally { rmSync(config, { recursive: true, force: true }); }
}

export function streamNative(args, input, environment = {}) {
  return new Promise((resolve, reject) => {
    const config = mkdtempSync(join(tmpdir(), "agp-native-config-"));
    const child = spawn(executable, args, {
      env: { ...process.env, AGP_MANAGEMENT_URL: undefined, XDG_CONFIG_HOME: config, ...environment },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.stdout.on("data", (bytes) => { stdout += bytes; });
    child.stderr.on("data", (bytes) => { stderr += bytes; });
    child.once("error", (error) => { clearTimeout(timer); rmSync(config, { recursive: true, force: true }); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      rmSync(config, { recursive: true, force: true });
      resolve({ code, signal, stdout, stderr });
    });
    child.stdin.end(input);
  });
}
