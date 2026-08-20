export function fakeConnection(options = {}) {
  const writes = [];
  const pending = [];
  let terminal;
  const connection = {
    peerEvidence: Object.freeze({
      locality: "process-local",
      protection: "none",
      authentication: Object.freeze({ kind: "none" }),
    }),
    writes,
    async send(packet, signal) {
      if (signal.aborted) throw signal.reason;
      if (options.manual === true) {
        await new Promise((resolve, reject) => {
          pending.push({ resolve, reject, signal });
        });
      }
      if (options.failWith !== undefined) throw options.failWith;
      writes.push(decode(packet.bytes));
    },
    read(signal) {
      if (signal.aborted) return Promise.reject(signal.reason);
      return new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(signal.reason),
          { once: true },
        );
      });
    },
    async close(_intent, signal) {
      if (signal.aborted) throw signal.reason;
      terminal ??= Object.freeze({ origin: "local", kind: "graceful" });
      return terminal;
    },
    abort() {
      terminal ??= Object.freeze({ origin: "local", kind: "aborted" });
    },
  };
  return {
    connection,
    writes,
    releaseOne() {
      pending.shift()?.resolve();
    },
  };
}

export function fakeController(overrides = {}) {
  const controlWrites = [];
  let live = true;
  let terminationReason;
  return {
    remoteNodeId: overrides.remoteNodeId ?? "peer.example",
    owningSessionId: overrides.owningSessionId ?? "000001",
    identity: overrides.identity ?? {},
    controlWrites,
    isLive: () => live,
    async writeControl(packet) {
      controlWrites.push(decode(packet));
    },
    terminate(reason) {
      terminationReason = reason;
      live = false;
    },
    terminationReason: () => terminationReason,
  };
}

function decode(bytes) {
  return new TextDecoder().decode(bytes);
}

export function breadcrumb(overrides = {}) {
  const egress = overrides.egress ?? fakeController();
  return {
    messageId: overrides.messageId ?? "message-1",
    outboundReturnToken: overrides.outboundReturnToken ?? "0000000000000000",
    sourceEndpoint: "demo/source",
    sourceOriginNodeId: "origin.example",
    destination: "demo/destination",
    ingress: overrides.ingress ?? { kind: "local" },
    egress,
    admittedAtRevision: "4",
    expiresAt: "2026-07-30T00:00:30.000Z",
    expiresAtMonotonicMs: overrides.expiresAtMonotonicMs ?? 30_000,
  };
}

export function selectedLocal(endpoint, bindingId, originNodeId = "local.example") {
  return {
    endpoint,
    routeId: `route:${endpoint}:local`,
    originNodeId,
    routeClass: "local",
    sourceKind: "local",
    path: [originNodeId],
    nextHop: { kind: "local", bindingId },
    selectionReason: "ONLY_ELIGIBLE",
    selectedAt: "2026-07-30T00:00:00.000Z",
  };
}

export function selectedSession(
  endpoint,
  nodeId,
  owningSessionId,
  originNodeId = nodeId,
) {
  return {
    endpoint,
    routeId: `route:${endpoint}:session`,
    originNodeId,
    routeClass: "learned",
    learnedKind: "direct",
    sourceKind: "session",
    path: [originNodeId, "local.example"],
    nextHop: { kind: "session", nodeId, owningSessionId },
    selectionReason: "ONLY_ELIGIBLE",
    selectedAt: "2026-07-30T00:00:00.000Z",
  };
}
