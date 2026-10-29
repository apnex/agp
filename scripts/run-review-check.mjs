import { spawn } from "node:child_process";
import { chmod, lstat, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const usage = "Review check usage: node scripts/run-review-check.mjs [--keep-work] -- COMMAND [ARG ...]";

async function removeReviewScratch(work) {
  async function makeDirectoriesWritable(directory) {
    let entry;
    try { entry = await lstat(directory); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    if (!entry.isDirectory()) return;
    // Immutable variants can have read-only directories. Never chmod files
    // (which may be hard-linked), or follow symlinks into shared dependencies.
    await chmod(directory, (entry.mode & 0o777) | 0o700);
    for (const child of await readdir(directory, { withFileTypes: true })) {
      if (child.isDirectory()) await makeDirectoriesWritable(path.join(directory, child.name));
    }
  }
  await makeDirectoriesWritable(work);
  await rm(work, { recursive: true, force: true });
}

/** Own review scratch until the command and its POSIX process group stop; retention is explicit. */
export async function runReviewCheck(command, args, { keepWork = false } = {}) {
  if (typeof command !== "string" || !command || !Array.isArray(args)
      || args.some((arg) => typeof arg !== "string") || typeof keepWork !== "boolean") {
    throw new TypeError("Review check arguments must name a command, string arguments and boolean retention");
  }
  const work = await mkdtemp(path.join(os.tmpdir(), "agp-review-check-"));
  const env = { ...process.env, TMPDIR: work, TMP: work, TEMP: work };
  // An outer node:test runner must not change the nested command's runner mode.
  delete env.NODE_TEST_CONTEXT;
  let child;
  let interrupted = null;
  let escalation;
  const signalCommand = (signal) => {
    if (!child?.pid) return;
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const interrupt = (signal) => {
    interrupted ??= signal;
    signalCommand(signal);
    escalation ??= setTimeout(() => signalCommand("SIGKILL"), 1000).unref();
  };
  const onInterrupt = () => interrupt("SIGINT");
  const onTerminate = () => interrupt("SIGTERM");
  try {
    child = spawn(command, args, { env, stdio: "inherit", detached: process.platform !== "win32" });
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    const result = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const signal = interrupted ?? result.signal;
    return signal ? 128 + (os.constants.signals[signal] ?? 1) : result.code ?? 1;
  } finally {
    clearTimeout(escalation);
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
    try {
      // A bounded review cannot leave background children using scratch after return.
      signalCommand("SIGKILL");
    } finally {
      if (!keepWork) await removeReviewScratch(work);
      process.stderr.write(`${keepWork ? "Review scratch retained:" : "Review scratch removed:"} ${work}\n`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(`${usage}\nScratch is removed on success or failure unless --keep-work is selected.\n`
      + "Only TMPDIR/TMP/TEMP output is owned; explicit output paths elsewhere are not removed.\n"
      + "POSIX command descendants are stopped before cleanup. SIGKILL or host failure cannot run cleanup.");
  } else {
    const keepWork = args[0] === "--keep-work";
    if (keepWork) args.shift();
    if (args.shift() !== "--" || !args[0]) {
      console.error(usage);
      process.exitCode = 2;
    } else {
      try {
        process.exitCode = await runReviewCheck(args[0], args.slice(1), { keepWork });
      } catch (error) {
        console.error(`Review check failed: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}
