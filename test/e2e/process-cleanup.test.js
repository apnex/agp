import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";

import {
  IndependentProcessTopology,
  eventuallyProcess,
  getProcessManagement,
  pidExists,
  requiredListenerAddress,
  startIndependentStar,
} from "./support/independent-processes.js";

test("given a live independent uniform-node star when each exact child is explicitly stopped then every process exits and every listener port is immediately reusable", async (context) => {
  const topology = await IndependentProcessTopology.create();
  context.after(() => topology.dispose());
  const star = await startIndependentStar(topology);

  await eventuallyProcess(async () => {
    const connections = await getProcessManagement(star.hub, "connections");
    return (
      connections.items.length === 2
      && connections.items.every(({ state }) => state === "Established")
    )
      ? true
      : undefined;
  }, "two live hub sessions before cleanup");

  const nodes = [star.beta, star.alpha, star.hub];
  const pids = nodes.map(({ pid }) => pid);
  const ports = [
    Number(new URL(requiredListenerAddress(star.hub)).port),
    ...nodes.map((node) => Number(new URL(node.ready.managementUrl).port)),
  ];
  assert.equal(nodes.every((node) => node.alive), true);
  assert.equal(pids.every((pid) => pidExists(pid)), true);

  const exits = [];
  for (const node of nodes) exits.push(await node.stop());

  assert.deepEqual(
    exits,
    nodes.map(() => ({ code: 0, signal: null })),
  );
  assert.equal(nodes.every((node) => !node.alive), true);
  assert.equal(pids.every((pid) => !pidExists(pid)), true);

  const reservations = [];
  try {
    for (const port of ports) {
      reservations.push(await reserveLoopback(port));
    }
    assert.equal(reservations.length, ports.length);
    assert.equal(new Set(ports).size, ports.length);
  } finally {
    await Promise.all(reservations.map(closeServer));
  }
});

function reserveLoopback(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}
