import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { createNodeWsTransport } from "../../dist/index.js";

// Owns: the TLS pre-shared-key profile over a real socket. Evidence must state
// what the handshake actually proved, and a peer without the secret must never
// become a channel.

const LIMITS = {
  maxPacketBytes: 65_536,
  maxBufferedPackets: 16,
  maxBufferedBytes: 65_536,
};
const LISTEN = {
  limits: { maxPendingAcquisitions: 4, maxActiveChannels: 4, channel: LIMITS },
};

function keyPort(localIdentity, own, table) {
  return {
    localIdentity,
    own: () => own,
    resolve: (identity) => table?.get(identity),
  };
}

function transport(role, url, keying, keys) {
  const security = { mode: "preshared-key", keying };
  const listeners = role === "listen"
    ? [{ transportRef: "l", url, compression: { mode: "disabled" }, security }]
    : [];
  const targets = role === "dial"
    ? [{ transportRef: "t", url, compression: { mode: "disabled" }, security }]
    : [];
  return createNodeWsTransport({ listeners, targets }, { presharedKeys: keys });
}

async function pair(context, keying, dialerKey, dialerIdentity) {
  const port = 47_500 + Math.floor(Math.random() * 400);
  const url = `wss://127.0.0.1:${port}/agp`;
  const alpha = randomBytes(32);
  const hub = randomBytes(32);
  const table = keying === "network"
    ? { get: () => hub }
    : new Map([["leaf.alpha", alpha], ["hub", hub]]);

  const listenerTransport = transport(
    "listen", url, keying, keyPort("hub", hub, table),
  );
  let accepted;
  const listener = await listenerTransport.resolveListener("l").listen(
    LISTEN,
    { accept: ({ channel }) => { accepted = channel; }, capacityRejected: () => {} },
    new AbortController().signal,
  );
  context.after(async () => {
    await listener.close(new AbortController().signal).catch(() => undefined);
  });

  const dialerTransport = transport(
    "dial", url, keying,
    keyPort(dialerIdentity, dialerKey ?? (keying === "network" ? hub : alpha), table),
  );
  const channel = await dialerTransport.resolveTarget("t").connect(
    { channel: LIMITS },
    new AbortController().signal,
  );
  for (let i = 0; i < 50 && accepted === undefined; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  context.after(() => channel.abort({ kind: "local-fault" }));
  return { accepted, channel, secrets: [alpha, hub] };
}

test("given node keying over a real TLS socket, when a peer presents a registered identity, then only the listener reports a verified principal", async (context) => {
  const { accepted, channel } = await pair(context, "node", undefined, "leaf.alpha");

  assert.deepEqual(accepted.peerEvidence, {
    locality: "network",
    protection: "confidentiality-and-integrity",
    authentication: {
      kind: "verified",
      principal: "leaf.alpha",
      method: "tls-psk",
    },
  });

  // TLS 1.3 carries no pre-shared-key identity hint, so a dialer observes no
  // peer label and must not invent one from configuration.
  assert.deepEqual(channel.peerEvidence, {
    locality: "network",
    protection: "confidentiality-and-integrity",
    authentication: { kind: "none" },
  });
});

test("given network keying, when any holder of the single secret connects, then both sides report protection without a principal", async (context) => {
  const { accepted, channel } = await pair(context, "network", undefined, "leaf.alpha");

  for (const evidence of [accepted.peerEvidence, channel.peerEvidence]) {
    assert.equal(evidence.protection, "confidentiality-and-integrity");
    assert.deepEqual(
      evidence.authentication,
      { kind: "none" },
      "one shared secret proves group membership, never which peer connected",
    );
  }
});

test("given node keying, when a peer presents a wrong secret or an unregistered identity, then acquisition fails and no channel is created", async (context) => {
  await assert.rejects(
    () => pair(context, "node", randomBytes(32), "leaf.alpha"),
    (error) => error.code === "CONNECT_FAILED",
    "a wrong secret must not yield a channel",
  );
  await assert.rejects(
    () => pair(context, "node", randomBytes(32), "mallory"),
    (error) => error.code === "CONNECT_FAILED",
    "an unregistered identity must not yield a channel",
  );
});

test("given a preshared-key configuration, when no key port is injected or the locator is cleartext, then the factory refuses to construct", async () => {
  const security = { mode: "preshared-key", keying: "node" };
  assert.throws(
    () => createNodeWsTransport({
      listeners: [],
      targets: [{
        transportRef: "t",
        url: "wss://127.0.0.1:47999/agp",
        compression: { mode: "disabled" },
        security,
      }],
    }, {}),
    /preshared key port/u,
  );
  assert.throws(
    () => createNodeWsTransport({
      listeners: [],
      targets: [{
        transportRef: "t",
        url: "ws://127.0.0.1:47999/agp",
        compression: { mode: "disabled" },
        security,
      }],
    }, { presharedKeys: keyPort("x", randomBytes(32), new Map()) }),
    /wss:/u,
  );
});

test("given emitted records for a secure channel, when they are serialised, then neither secret appears in any encoding", async (context) => {
  const { accepted, channel, secrets } = await pair(context, "node", undefined, "leaf.alpha");
  const serialised = JSON.stringify([accepted.peerEvidence, channel.peerEvidence]);

  for (const secret of secrets) {
    for (const encoding of ["hex", "base64", "latin1"]) {
      assert.equal(
        serialised.includes(Buffer.from(secret).toString(encoding)),
        false,
        `a secret must not be reachable through ${encoding}`,
      );
    }
  }
  // The method name is deliberate metadata; the value behind it is not.
  assert.match(serialised, /"method":"tls-psk"/u);
});
