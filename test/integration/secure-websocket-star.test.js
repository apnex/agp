import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { createNode } from "@agp/node";
import { createNodeWsTransport } from "@agp/transport-node-ws";

// Owns: the pre-shared-key profile under real topology convergence. The channel
// tests prove one handshake; this proves a converged star routes transit
// traffic over it, and that a listener's admission policy can act on the
// principal the transport observed.

const SECURITY = { mode: "preshared-key", keying: "node" };
// Each test binds its own port so a listener still releasing cannot collide
// with the next one under load.
let nextPort = 47_610;
function endpointUrl() {
  nextPort += 1;
  return `wss://127.0.0.1:${nextPort}/agp`;
}

function keyPort(localIdentity, secrets) {
  return {
    localIdentity,
    own: () => secrets.get(localIdentity),
    resolve: (identity) => secrets.get(identity),
  };
}

function listenTransport(secrets, url) {
  return createNodeWsTransport({
    listeners: [{
      transportRef: "ws.listen",
      url,
      compression: { mode: "disabled" },
      security: SECURITY,
    }],
    targets: [],
  }, { presharedKeys: keyPort("hub", secrets) });
}

function dialTransport(identity, secrets, url) {
  return createNodeWsTransport({
    listeners: [],
    targets: [{
      transportRef: "ws.hub",
      url,
      compression: { mode: "disabled" },
      security: SECURITY,
    }],
  }, { presharedKeys: keyPort(identity, secrets) });
}

function leaf(nodeId, secrets, url) {
  return createNode({
    nodeId,
    peers: [{
      adjacencyId: "to-hub",
      expectedNodeId: "hub",
      transportRef: "ws.hub",
      reconnect: {
        enabled: true,
        initialDelayMs: 25,
        maximumDelayMs: 200,
        multiplier: 2,
        jitterRatio: 0,
      },
    }],
  }, { transport: dialTransport(nodeId, secrets, url) });
}

async function until(probe, description, attempts = 200) {
  for (let index = 0; index < attempts; index += 1) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`did not observe ${description}`);
}

function selected(node, endpoint) {
  return node.operations.routes().selected
    .find((route) => route.endpoint === endpoint);
}

test("given a three-node star whose channels are protected by per-node pre-shared keys, when routes converge, then leaf JSON transits the centre and the centre admitted each peer on observed evidence", async (context) => {
  const secrets = new Map([
    ["hub", randomBytes(32)],
    ["leaf.alpha", randomBytes(32)],
    ["leaf.beta", randomBytes(32)],
  ]);
  const observed = [];
  const url = endpointUrl();

  const hub = createNode({
    nodeId: "hub",
    listen: { transportRef: "ws.listen" },
    transit: { enabled: true, defaultHopLimit: 8 },
    identityAdmission: { mode: "port" },
  }, {
    transport: listenTransport(secrets, url),
    identityAdmission: {
      // The transport reports; policy decides. A peer may claim only the node
      // identity whose secret completed its handshake.
      evaluate: async (request) => {
        observed.push({
          claimed: request.remoteNodeId,
          evidence: request.peerEvidence,
        });
        const { authentication, protection } = request.peerEvidence;
        if (protection !== "confidentiality-and-integrity") {
          return { decision: "deny", reasonCode: "SECURITY_EVIDENCE" };
        }
        if (
          authentication.kind !== "verified"
          || authentication.principal !== request.remoteNodeId
        ) {
          return { decision: "deny", reasonCode: "SECURITY_EVIDENCE" };
        }
        return { decision: "allow" };
      },
    },
  });

  const alpha = leaf("leaf.alpha", secrets, url);
  const beta = leaf("leaf.beta", secrets, url);
  context.after(async () => {
    for (const node of [alpha, beta, hub]) {
      await node.stop().catch(() => undefined);
    }
  });

  let delivered;
  await hub.expose("hub/service", async () => {});
  await hub.start();
  await alpha.expose("alpha/ping", async () => {});
  await alpha.start();
  await beta.expose("beta/pong", async (payload) => { delivered = payload; });
  await beta.start();

  await until(
    () => hub.operations.connections().items
      .filter(({ state }) => state === "Established").length === 2,
    "both leaves established over TLS",
  );
  // Transit forwarding needs the centre's export of the source identity ACKed
  // at the egress peer, so both directions must converge before data is sent.
  await until(
    () => selected(alpha, "beta/pong") !== undefined
      && selected(beta, "alpha/ping") !== undefined,
    "both leaves learned the transit route to each other",
  );

  // Every admission saw a verified principal matching the claimed node.
  assert.equal(observed.length, 2);
  for (const { claimed, evidence } of observed) {
    assert.equal(evidence.locality, "network");
    assert.equal(evidence.protection, "confidentiality-and-integrity");
    assert.equal(evidence.authentication.kind, "verified");
    assert.equal(evidence.authentication.method, "tls-psk");
    assert.equal(evidence.authentication.principal, claimed);
  }
  assert.deepEqual(
    observed.map(({ claimed }) => claimed).sort(),
    ["leaf.alpha", "leaf.beta"],
  );

  const receipt = await alpha.send(
    "alpha/ping",
    "beta/pong",
    { over: "tls-psk", hops: 2 },
  );
  await until(() => delivered !== undefined, "transit delivery at beta");

  assert.equal(receipt.nextHop.nodeId, "hub");
  assert.deepEqual(delivered, { over: "tls-psk", hops: 2 });
  assert.deepEqual(
    selected(alpha, "beta/pong").path,
    ["leaf.beta", "hub", "leaf.alpha"],
  );
});

test("given a listener whose policy requires a matching principal, when a peer holds a valid secret but claims another node, then admission denies it on security evidence", async (context) => {
  const secrets = new Map([
    ["hub", randomBytes(32)],
    ["leaf.alpha", randomBytes(32)],
  ]);
  const denials = [];
  const url = endpointUrl();

  const hub = createNode({
    nodeId: "hub",
    listen: { transportRef: "ws.listen" },
    identityAdmission: { mode: "port" },
  }, {
    transport: listenTransport(secrets, url),
    identityAdmission: {
      evaluate: async (request) => {
        const { authentication } = request.peerEvidence;
        if (
          authentication.kind !== "verified"
          || authentication.principal !== request.remoteNodeId
        ) {
          denials.push(request.remoteNodeId);
          return { decision: "deny", reasonCode: "SECURITY_EVIDENCE" };
        }
        return { decision: "allow" };
      },
    },
  });

  // The transport identity stays leaf.alpha, so the handshake succeeds, but the
  // node claims a different AGP identity in OPEN.
  const impostor = createNode({
    nodeId: "leaf.gamma",
    peers: [{
      adjacencyId: "to-hub",
      expectedNodeId: "hub",
      transportRef: "ws.hub",
      reconnect: { enabled: false, initialDelayMs: 25, maximumDelayMs: 25, multiplier: 1, jitterRatio: 0 },
    }],
  }, { transport: dialTransport("leaf.alpha", secrets, url) });

  context.after(async () => {
    for (const node of [impostor, hub]) await node.stop().catch(() => undefined);
  });

  await hub.start();
  await impostor.start();

  await until(() => denials.includes("leaf.gamma"), "denial of the mismatched claim");
  assert.equal(
    hub.operations.connections().items
      .some(({ state }) => state === "Established"),
    false,
    "a denied peer must not reach an established session",
  );
});
