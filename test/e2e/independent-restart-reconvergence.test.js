import assert from "node:assert/strict";
import test from "node:test";

import {
  IndependentProcessTopology,
  eventuallyProcess,
  getProcessManagement,
  peer,
  processDocument,
  requiredListenerAddress,
} from "./support/independent-processes.js";

// Owns: D9/D13 restart semantics proved across real processes over WebSocket.
// A replaced process starts from empty derived state and rebuilds equivalent
// reachability under fresh adapter, instance, and session authority.

const LISTENER_ENDPOINT = "restart/listener";
const DIALER_ENDPOINT = "restart/dialer";

test("given a converged independent WebSocket pair when the dialing process is replaced then equivalent reachability is rebuilt under fresh adapter and session authority", async (context) => {
  const topology = await IndependentProcessTopology.create();
  context.after(() => topology.dispose());

  const listener = await topology.start("restart-listener", processDocument({
    nodeId: "restart.listener",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    endpoints: [LISTENER_ENDPOINT],
  }));
  const listenerAddress = requiredListenerAddress(listener);

  const dialerDocument = () => processDocument({
    nodeId: "restart.dialer",
    peers: [peer("to-listener", "restart.listener", listenerAddress)],
    endpoints: [DIALER_ENDPOINT],
  });

  const first = await topology.start("restart-dialer-first", dialerDocument());
  const beforeDialer = await converged(first, "restart.listener", "first dialer convergence");
  const beforeListener = await converged(listener, "restart.dialer", "first listener convergence");

  // Prove the first incarnation actually carried traffic, so the comparison
  // after replacement is between two working topologies.
  await proveDelivery(first, listener, "before-restart");

  const beforeSession = sessionOf(beforeListener, "restart.dialer");
  const beforeInstance = beforeDialer.instanceId;

  await first.stop();
  await eventuallyProcess(
    async () => {
      const response = await getProcessManagement(listener, "connections");
      return response.items.length === 0 ? true : undefined;
    },
    "listener withdraws the lost peer",
  );

  // The listener must not retain a phantom next hop for the endpoint the
  // departed process owned.
  const between = (await getProcessManagement(listener, "routes")).selected;
  assert.equal(
    between.some((route) => route.endpoint === DIALER_ENDPOINT),
    false,
    "a stopped process leaves no learned route behind",
  );

  const second = await topology.start("restart-dialer-second", dialerDocument());
  const afterDialer = await converged(second, "restart.listener", "replacement dialer convergence");
  const afterListener = await converged(listener, "restart.dialer", "listener reconvergence");

  // Equivalent reachability: the same endpoints resolve over the same paths.
  assert.deepEqual(
    endpointPaths(afterDialer),
    endpointPaths(beforeDialer),
    "the replacement rebuilds the same reachability",
  );
  assert.deepEqual(
    endpointPaths(afterListener),
    endpointPaths(beforeListener),
    "the surviving node sees the same reachability",
  );

  // Fresh authority: identity is reused, derived runtime state is not.
  const afterSession = sessionOf(afterListener, "restart.dialer");
  assert.equal(afterDialer.nodeId, beforeDialer.nodeId);
  assert.notEqual(afterDialer.instanceId, beforeInstance);
  assert.notEqual(afterSession.sessionId, beforeSession.sessionId);
  assert.equal(afterSession.state, "Established");

  // The replacement starts from empty derived state, so its revision counter
  // cannot continue the retired instance's sequence.
  assert.ok(
    Number(afterDialer.revision) < Number(beforeDialer.revision)
      || afterDialer.instanceId !== beforeInstance,
    "derived state is rebuilt rather than resumed",
  );

  await proveDelivery(second, listener, "after-restart");
  assert.equal(listener.alive, true);
  assert.equal(second.alive, true);
});

async function converged(node, remoteNodeId, description) {
  return eventuallyProcess(async () => {
    const response = await getProcessManagement(node, "snapshot");
    // Identity and revision are management metadata, not snapshot body.
    const snapshot = { ...response.data, ...response.meta };
    const reachable = [LISTENER_ENDPOINT, DIALER_ENDPOINT].every((endpoint) =>
      snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
    );
    const established = snapshot.connections.some((connection) =>
      connection.remoteNodeId === remoteNodeId
      && connection.state === "Established"
    );
    const exported = snapshot.routeExports.some(({ state }) => state === "acked");
    return reachable && established && exported ? snapshot : undefined;
  }, description);
}

async function proveDelivery(dialer, listener, correlationId) {
  const atListener = listener.waitForDelivery(LISTENER_ENDPOINT, correlationId);
  await dialer.send(
    DIALER_ENDPOINT,
    LISTENER_ENDPOINT,
    { phase: correlationId },
    { correlationId, timeoutMs: 5_000 },
  );
  const delivered = await atListener;
  assert.deepEqual(delivered.payload, { phase: correlationId });
  assert.equal(delivered.delivery.source.originNodeId, "restart.dialer");
}

function endpointPaths(snapshot) {
  return snapshot.selectedRoutes
    .map((route) => [route.endpoint, (route.path ?? []).join(">")])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function sessionOf(snapshot, remoteNodeId) {
  const found = snapshot.connections.find((connection) =>
    connection.remoteNodeId === remoteNodeId
  );
  assert.notEqual(found, undefined, `no connection to ${remoteNodeId}`);
  return found;
}
