import test from "node:test";
import assert from "node:assert/strict";
import {
  createPeerSessionState,
  reducePeerSession,
} from "../../dist/index.js";

// Owns: symmetric OPEN/KEEPALIVE establishment. Excludes route/data effects.
test("given dialed and accepted acquisitions, when OPEN completes, then each establishes only after peer KEEPALIVE", () => {
  for (const acquisition of [
    { kind: "dial", adjacencyId: "adj" },
    { kind: "accept", listenerId: "listener" },
  ]) {
    let state = createPeerSessionState({
      controllerId: acquisition.kind,
      localNodeId: "node.local",
      acquisition,
    });
    const step = (input) => {
      state = reducePeerSession(state, input).state;
    };
    step({
      type: acquisition.kind === "dial" ? "StartDial" : "StartAccept",
      localSessionId: "000001",
    });
    step({
      type: acquisition.kind === "dial"
        ? "TransportOpened"
        : "TransportAccepted",
    });
    step({ type: "OpenReceived", continuationToken: "identity" });
    step({
      type: "IdentityAdmissionResolved",
      continuationToken: "identity",
      admissionAllowed: true,
      admissionResultValid: true,
      collisionWinner: true,
      remoteNodeId: "peer.a",
      remoteSessionId: "000002",
      negotiated: {
        holdTimeMs: 30_000,
        keepaliveTimeMs: 10_000,
        peerReceiveLimitBytes: 65536,
        maxRoutesPerSnapshot: 64,
        maxPathLength: 16,
        maxHopCount: 16,
        transit: true,
      },
    });
    assert.equal(state.state, "OpenConfirm");
    step({ type: "KeepaliveReceived" });
    assert.equal(state.state, "Established");
    assert.equal(state.forwardable, true);
  }
});
