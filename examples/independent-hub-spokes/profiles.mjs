import alphaDocument from "./config/alpha.json" with { type: "json" };
import betaDocument from "./config/beta.json" with { type: "json" };
import hubDocument from "./config/hub.json" with { type: "json" };

import {
  parseBindHost,
  parseHubUrl,
  parsePort,
} from "./runtime.mjs";

export const PROFILE_NAMES = Object.freeze(["hub", "alpha", "beta"]);

export const PROFILE_DOCUMENTS = deepFreeze({
  hub: structuredClone(hubDocument),
  alpha: structuredClone(alphaDocument),
  beta: structuredClone(betaDocument),
});

for (const profileName of PROFILE_NAMES) {
  assertProfileDocument(profileName, PROFILE_DOCUMENTS[profileName]);
}

export const PROFILE_PRESETS = deepFreeze(
  Object.fromEntries(
    PROFILE_NAMES.map((profileName) => {
      const document = PROFILE_DOCUMENTS[profileName];
      const listener = document.transport.listeners[0];
      const listenerUrl = listener === undefined
        ? undefined
        : new URL(listener.url);
      return [
        profileName,
        {
          nodeId: document.config.nodeId,
          managementPort: document.managementPort,
          endpoints: document.endpoints,
          ...(listenerUrl === undefined
            ? {}
            : {
              webSocketHost: listenerUrl.hostname,
              webSocketPort: Number(listenerUrl.port || "80"),
              path: listenerUrl.pathname,
            }),
        },
      ];
    }),
  ),
);

export function defaultHubUrl() {
  const hub = PROFILE_PRESETS.hub;
  const port = parsePort(
    process.env.AGP_HUB_WS_PORT,
    hub.webSocketPort,
    "AGP_HUB_WS_PORT",
  );
  return `ws://127.0.0.1:${port}${hub.path}`;
}

export function resolveProfile(
  profileName,
  {
    webSocketHost,
    webSocketPort,
    managementPort,
    hubUrl,
  } = {},
) {
  const document = PROFILE_DOCUMENTS[profileName];
  if (document === undefined) {
    throw new Error(
      `unknown profile ${String(profileName)}; expected hub, alpha, or beta`,
    );
  }

  const resolvedManagementPort = parsePort(
    managementPort ?? managementPortEnvironment(profileName),
    document.managementPort,
    "--management-port",
  );
  const config = structuredClone(document.config);
  const transport = structuredClone(document.transport);

  if (profileName === "hub") {
    const listener = transport.listeners[0];
    const listenerUrl = new URL(listener.url);
    listenerUrl.hostname = parseBindHost(
      webSocketHost ?? process.env.AGP_HUB_WS_HOST,
      listenerUrl.hostname,
      "--ws-host",
    );
    listenerUrl.port = String(parsePort(
      webSocketPort ?? process.env.AGP_HUB_WS_PORT,
      Number(listenerUrl.port || "80"),
      "--ws-port",
    ));
    listener.url = listenerUrl.toString();
    return deepFreeze({
      profile: profileName,
      nodeId: config.nodeId,
      managementPort: resolvedManagementPort,
      endpoints: [...document.endpoints],
      config,
      transport,
    });
  }

  const resolvedHubUrl = parseHubUrl(
    hubUrl ?? process.env.AGP_HUB_URL,
    defaultHubUrl(),
  );
  transport.targets[0].url = resolvedHubUrl;
  return deepFreeze({
    profile: profileName,
    nodeId: config.nodeId,
    managementPort: resolvedManagementPort,
    endpoints: [...document.endpoints],
    hubUrl: resolvedHubUrl,
    config,
    transport,
  });
}

function assertProfileDocument(profileName, document) {
  if (
    document === null
    || typeof document !== "object"
    || document.profile !== profileName
    || !Number.isSafeInteger(document.managementPort)
    || !Array.isArray(document.endpoints)
    || document.config === null
    || typeof document.config !== "object"
    || typeof document.config.nodeId !== "string"
    || document.transport === null
    || typeof document.transport !== "object"
    || !Array.isArray(document.transport.listeners)
    || !Array.isArray(document.transport.targets)
  ) {
    throw new Error(`invalid example profile document: ${profileName}`);
  }
  if (
    profileName === "hub"
    && (
      document.config.listen === undefined
      || document.transport.listeners.length !== 1
    )
  ) {
    throw new Error("hub example profile must configure one bound listener");
  }
  if (
    profileName !== "hub"
    && (
      !Array.isArray(document.config.peers)
      || document.config.peers.length !== 1
      || document.transport.targets.length !== 1
    )
  ) {
    throw new Error(
      `${profileName} example profile must configure one peer target`,
    );
  }
}

function managementPortEnvironment(profileName) {
  const key = `AGP_${profileName.toUpperCase()}_MANAGEMENT_PORT`;
  return process.env[key];
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
