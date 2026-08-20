import { parseArgs } from "node:util";

import { PROFILE_NAMES, resolveProfile } from "./profiles.mjs";
import { startProfileRuntime } from "./node-runtime.mjs";
import {
  safeMessage,
  waitForShutdownSignal,
} from "./runtime.mjs";

await command().catch((error) => {
  process.stderr.write(`uniform node failed: ${safeMessage(error)}\n`);
  process.exitCode = 1;
});

async function command() {
  const { values, positionals } = parseArgs({
    options: {
      "ws-host": { type: "string" },
      "ws-port": { type: "string" },
      "management-port": { type: "string" },
      "hub-url": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (values.help === true) {
    process.stdout.write(
      "usage: node node.mjs <hub|alpha|beta> "
        + "[--management-port PORT] [--ws-host HOST] [--ws-port PORT] "
        + "[--hub-url ws://HOST:PORT/agp]\n",
    );
    return;
  }
  if (positionals.length !== 1 || !PROFILE_NAMES.includes(positionals[0])) {
    throw new Error("exactly one profile is required: hub, alpha, or beta");
  }
  const profileName = positionals[0];
  if (
    profileName !== "hub" &&
    (values["ws-host"] !== undefined || values["ws-port"] !== undefined)
  ) {
    throw new Error("--ws-host and --ws-port apply only to the hub profile");
  }
  if (profileName === "hub" && values["hub-url"] !== undefined) {
    throw new Error("--hub-url applies only to alpha and beta profiles");
  }

  const profile = resolveProfile(profileName, {
    webSocketHost: values["ws-host"],
    webSocketPort: values["ws-port"],
    managementPort: values["management-port"],
    hubUrl: values["hub-url"],
  });
  const runtime = await startProfileRuntime(profile);
  process.stdout.write(`AGP_NODE_READY ${JSON.stringify(runtime.ready)}\n`);
  try {
    const signal = await waitForShutdownSignal();
    process.stdout.write(
      `AGP_NODE_STOPPING ${JSON.stringify({
        profile: profile.profile,
        nodeId: profile.nodeId,
        signal,
      })}\n`,
    );
  } finally {
    await runtime.stop();
  }
}
