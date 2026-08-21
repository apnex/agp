import fabricDocument from "./config/fabric.json" with { type: "json" };
import alphaDocument from "./config/alpha.json" with { type: "json" };
import betaDocument from "./config/beta.json" with { type: "json" };
import hubDocument from "./config/hub.json" with { type: "json" };

export const PROFILE_NAMES = Object.freeze(["hub", "alpha", "beta"]);

export const FABRIC_DOCUMENT = deepFreeze(structuredClone(fabricDocument));

export const PROFILE_DOCUMENTS = deepFreeze({
  hub: structuredClone(hubDocument),
  alpha: structuredClone(alphaDocument),
  beta: structuredClone(betaDocument),
});

assertTopologyDocuments(FABRIC_DOCUMENT, PROFILE_DOCUMENTS);

export function resolveLoopbackTopology({
  managementPorts = {},
} = {}) {
  assertExactKeys(
    managementPorts,
    Object.keys(managementPorts),
    "management-port overrides",
  );
  for (const profileName of Object.keys(managementPorts)) {
    if (!PROFILE_NAMES.includes(profileName)) {
      throw new Error(`unknown management-port profile: ${profileName}`);
    }
  }

  const profiles = Object.fromEntries(
    PROFILE_NAMES.map((profileName) => {
      const profile = structuredClone(PROFILE_DOCUMENTS[profileName]);
      const environmentName =
        `AGP_LOOPBACK_${profileName.toUpperCase()}_MANAGEMENT_PORT`;
      profile.managementPort = parsePort(
        managementPorts[profileName] ?? process.env[environmentName],
        profile.managementPort,
        environmentName,
      );
      return [profileName, profile];
    }),
  );
  const topology = {
    fabric: structuredClone(FABRIC_DOCUMENT),
    profiles,
  };
  assertTopologyDocuments(topology.fabric, topology.profiles);
  return deepFreeze(topology);
}

function assertTopologyDocuments(fabric, profiles) {
  assertExactKeys(fabric, ["fabricId", "limits"], "fabric document");
  if (
    typeof fabric.fabricId !== "string"
    || fabric.fabricId.length === 0
    || fabric.limits === null
    || typeof fabric.limits !== "object"
  ) {
    throw new Error("invalid Loopback fabric document");
  }
  assertExactKeys(profiles, PROFILE_NAMES, "profile collection");

  const nodeIds = new Set();
  const transportNames = new Set();
  const occupiedManagementPorts = new Set();
  const listenersByAddress = new Map();

  for (const profileName of PROFILE_NAMES) {
    const profile = profiles[profileName];
    assertProfile(profileName, profile, fabric.fabricId);
    addUnique(nodeIds, profile.nodeConfig.nodeId, "node ID");
    addUnique(
      transportNames,
      profile.transport.config.transportName,
      "transport name",
    );
    if (profile.managementPort !== 0) {
      addUnique(
        occupiedManagementPorts,
        profile.managementPort,
        "management port",
      );
    }

    for (const { binding } of profile.transport.listeners) {
      const addressKey = boundAddressKey(binding);
      if (listenersByAddress.has(addressKey)) {
        throw new Error(
          `Loopback address has more than one listener: ${binding.address}`,
        );
      }
      listenersByAddress.set(addressKey, profile);
    }
  }

  for (const profileName of PROFILE_NAMES) {
    const profile = profiles[profileName];
    for (const target of profile.transport.targets) {
      const listenerOwner = listenersByAddress.get(
        boundAddressKey(target.binding),
      );
      if (listenerOwner === undefined) {
        throw new Error(
          `${profileName} target has no listener: ${target.binding.address}`,
        );
      }
      const peer = profile.nodeConfig.peers.find(
        (candidate) => candidate.transportRef === target.transportRef,
      );
      if (peer.expectedNodeId !== listenerOwner.nodeConfig.nodeId) {
        throw new Error(
          `${profileName} expectedNodeId does not own target `
            + target.binding.address,
        );
      }
    }
  }
}

function assertProfile(profileName, profile, fabricId) {
  assertExactKeys(
    profile,
    [
      "profile",
      "managementPort",
      "endpoints",
      "nodeConfig",
      "transport",
    ],
    `${profileName} profile`,
  );
  if (
    profile.profile !== profileName
    || !Number.isSafeInteger(profile.managementPort)
    || profile.managementPort < 0
    || profile.managementPort > 65_535
    || !Array.isArray(profile.endpoints)
    || profile.nodeConfig === null
    || typeof profile.nodeConfig !== "object"
    || typeof profile.nodeConfig.nodeId !== "string"
  ) {
    throw new Error(`invalid Loopback example profile: ${profileName}`);
  }
  assertUniqueStrings(profile.endpoints, `${profileName} endpoints`);
  assertTransport(profileName, profile.transport, fabricId);

  const listenerReferences = profile.transport.listeners.map(
    ({ transportRef }) => transportRef,
  );
  const targetReferences = profile.transport.targets.map(
    ({ transportRef }) => transportRef,
  );
  const nodeListenerReference = profile.nodeConfig.listen?.transportRef;
  const peerReferences = (profile.nodeConfig.peers ?? []).map(
    ({ transportRef }) => transportRef,
  );

  assertSameMembers(
    nodeListenerReference === undefined ? [] : [nodeListenerReference],
    listenerReferences,
    `${profileName} listener references`,
  );
  assertSameMembers(
    peerReferences,
    targetReferences,
    `${profileName} target references`,
  );

  const { capabilities } = profile.transport.config;
  if (
    capabilities.listen !== (listenerReferences.length > 0)
    || capabilities.connect !== (targetReferences.length > 0)
  ) {
    throw new Error(
      `${profileName} transport capabilities do not match its bindings`,
    );
  }
}

function assertTransport(profileName, transport, fabricId) {
  assertExactKeys(
    transport,
    ["config", "listeners", "targets"],
    `${profileName} transport`,
  );
  if (
    transport.config === null
    || typeof transport.config !== "object"
    || !Array.isArray(transport.listeners)
    || !Array.isArray(transport.targets)
  ) {
    throw new Error(`invalid ${profileName} transport document`);
  }
  assertExactKeys(
    transport.config,
    ["transportName", "capabilities"],
    `${profileName} transport config`,
  );
  assertExactKeys(
    transport.config.capabilities,
    ["listen", "connect"],
    `${profileName} transport capabilities`,
  );
  if (
    typeof transport.config.transportName !== "string"
    || typeof transport.config.capabilities.listen !== "boolean"
    || typeof transport.config.capabilities.connect !== "boolean"
  ) {
    throw new Error(`invalid ${profileName} transport config`);
  }

  for (const [kind, bindings] of [
    ["listener", transport.listeners],
    ["target", transport.targets],
  ]) {
    const references = new Set();
    for (const record of bindings) {
      assertExactKeys(
        record,
        ["transportRef", "binding"],
        `${profileName} ${kind} binding`,
      );
      assertExactKeys(
        record.binding,
        ["fabricId", "address"],
        `${profileName} ${kind} value`,
      );
      if (
        typeof record.transportRef !== "string"
        || record.binding.fabricId !== fabricId
        || typeof record.binding.address !== "string"
      ) {
        throw new Error(`invalid ${profileName} ${kind} binding`);
      }
      addUnique(
        references,
        record.transportRef,
        `${profileName} ${kind} transportRef`,
      );
    }
  }
}

function parsePort(value, fallback, label) {
  const text = value ?? String(fallback);
  if (!/^(?:0|[1-9][0-9]{0,4})$/u.test(String(text))) {
    throw new Error(`${label} must be an integer from 0 to 65535`);
  }
  const port = Number(text);
  if (port > 65_535) {
    throw new Error(`${label} must be an integer from 0 to 65535`);
  }
  return port;
}

function assertSameMembers(left, right, label) {
  assertUniqueStrings(left, label);
  assertUniqueStrings(right, label);
  if (
    left.length !== right.length
    || left.some((value) => !right.includes(value))
  ) {
    throw new Error(`${label} do not form an exact composition join`);
  }
}

function assertUniqueStrings(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${label} must contain non-empty strings`);
    }
    addUnique(seen, value, label);
  }
}

function addUnique(set, value, label) {
  if (set.has(value)) {
    throw new Error(`duplicate ${label}: ${String(value)}`);
  }
  set.add(value);
}

function boundAddressKey(binding) {
  return `${binding.fabricId}\0${binding.address}`;
}

function assertExactKeys(value, expected, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw new Error(`${label} must be an object record`);
  }
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== expected.length
    || actual.some((key) => !expected.includes(key))
  ) {
    throw new Error(`${label} must contain only: ${expected.join(", ")}`);
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
