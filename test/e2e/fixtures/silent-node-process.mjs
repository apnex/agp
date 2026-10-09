import { readFile } from "node:fs/promises";

// Test harness peer only: intentionally omit one lifecycle/IPC observation.
const { config } = JSON.parse(await readFile(process.argv[2], "utf8"));
const keepAlive = setInterval(() => {}, 1_000);
process.on("disconnect", () => clearInterval(keepAlive));
if (config.mode !== "no-ready") process.send({ type: "ready", nodeId: "test.silent", listener: {} });
process.on("message", (message) => {
  if (message.command === "snapshot" && config.mode === "exit-on-request") process.exit(3);
  if (message.command === "stop" && config.mode !== "ignore-stop") {
    clearInterval(keepAlive);
    process.disconnect();
  }
});
