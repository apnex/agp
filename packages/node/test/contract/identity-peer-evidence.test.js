import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

test("given immutable channel peer evidence, when OPEN identity admission runs, then the exact observed object crosses unchanged and configuration cannot forge it", async (context) => {
  const evidence = Object.freeze({
    locality: "network",
    protection: "confidentiality-and-integrity",
    authentication: Object.freeze({
      kind: "verified",
      principal: "spiffe://example.test/peer",
      method: "test-attestation",
    }),
  });
  const network = new MemoryPeerNetwork({ peerEvidence: evidence });
  let admissionRequest;
  const listener = createNode({
    nodeId: "evidence.listener",
    listen: { transportRef: "evidence.listener" },
    identityAdmission: { mode: "port" },
  }, {
    transport: network.transport({ listeners: ["evidence.listener"] }),
    identityAdmission: {
      async evaluate(request) {
        admissionRequest = request;
        return { decision: "allow" };
      },
    },
  });
  const dialer = createNode({
    nodeId: "evidence.dialer",
    peers: [{
      adjacencyId: "listener",
      expectedNodeId: "evidence.listener",
      transportRef: "evidence.listener",
    }],
  }, {
    transport: network.transport({ targets: ["evidence.listener"] }),
  });
  context.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });

  await listener.start();
  await dialer.start();
  await eventually(
    () => admissionRequest,
    "identity admission request",
  );

  assert.strictEqual(admissionRequest.peerEvidence, evidence);
  assert.equal(Object.isFrozen(admissionRequest.peerEvidence), true);
  assert.equal(
    Object.isFrozen(admissionRequest.peerEvidence.authentication),
    true,
  );
  assert.throws(
    () => createNode({
      nodeId: "evidence.forgery",
      peers: [{
        adjacencyId: "peer",
        expectedNodeId: "evidence.peer",
        transportRef: "evidence.peer",
        peerEvidence: evidence,
      }],
    }),
    { code: "CONFIG_INVALID" },
  );
});
