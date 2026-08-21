import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitFullConvergence,
  buildChain,
  deepen,
} from "../support/topology-builders.js";
import { selectedRoute, waitForDelivery } from "../support/uniform-topology.js";

// Owns: transit depth beyond one. Every other live geometry places a single
// transit node between the edges, so a forwarder always receives from the
// origin. A chain of four makes an interior node forward traffic that arrived
// from another forwarder, which is the only way to exercise feasible-ingress
// authorisation against a route learned from a transit peer, a path vector
// longer than three, and a hop limit decremented more than once.
//
// Depth is the dimension this file varies. AGP_DEEPEN_CHAIN raises it.

test("given a chain deeper than one transit node, when an edge sends to the far edge, then it forwards through every interior node with one decrement per hop", async (context) => {
  const length = deepen("chain", 4);
  const deliveries = [];
  const chain = await buildChain({ length, deliveries, context });
  await awaitFullConvergence(chain);

  const first = chain.nodes[0];
  const last = chain.nodes.at(-1);
  const source = "chain0/ep0";
  const destination = `chain${length - 1}/ep0`;

  // The far edge is reachable through a path naming every node exactly once,
  // ordered from origin to receiver.
  const route = selectedRoute(first, destination);
  assert.equal(route.path.length, length, "path must name every node");
  assert.deepEqual(
    route.path,
    Array.from({ length }, (_, index) => `chain.${length - 1 - index}`),
    "path runs from origin to receiver",
  );
  assert.equal(new Set(route.path).size, length, "no node may repeat in a path");
  assert.equal(route.nextHop.nodeId, "chain.1", "first hop is the adjacent node");

  const arrival = waitForDelivery(deliveries, 1, "far-edge delivery");
  const receipt = await first.send(source, destination, { depth: length - 1 });
  await arrival;

  const delivered = deliveries.find((entry) => entry.endpoint === destination);
  assert.equal(receipt.nextHop.nodeId, "chain.1");
  assert.deepEqual(delivered.payload, { depth: length - 1 });
  assert.equal(delivered.context.delivery.source.originNodeId, "chain.0");

  // An interior node beyond the first forwarded traffic whose ingress peer is
  // itself a forwarder, not the originator.
  const interior = chain.nodes[length - 2];
  const ingressRoute = selectedRoute(interior, source);
  assert.equal(
    ingressRoute.nextHop.nodeId,
    `chain.${length - 3}`,
    "the deepest interior node learned the origin through another transit node",
  );
  assert.equal(ingressRoute.path.at(-1), `chain.${length - 2}`);
  assert.equal(ingressRoute.path[0], "chain.0");

  // The reverse direction resolves independently rather than reusing a path.
  assert.deepEqual(
    selectedRoute(last, source).path,
    Array.from({ length }, (_, index) => `chain.${index}`),
  );
});

test("given a chain deeper than one transit node, when the far edge replies, then both directions deliver over independently selected paths", async (context) => {
  const length = deepen("chain", 4);
  const deliveries = [];
  const chain = await buildChain({ length, deliveries, context });
  await awaitFullConvergence(chain);

  const first = chain.nodes[0];
  const last = chain.nodes.at(-1);
  const nearEndpoint = "chain0/ep0";
  const farEndpoint = `chain${length - 1}/ep0`;

  const outbound = waitForDelivery(deliveries, 1, "outbound delivery");
  await first.send(nearEndpoint, farEndpoint, { direction: "forward" });
  await outbound;

  const inbound = waitForDelivery(deliveries, 2, "return delivery");
  const back = await last.send(farEndpoint, nearEndpoint, { direction: "reverse" });
  await inbound;

  assert.equal(back.nextHop.nodeId, `chain.${length - 2}`);
  const returned = deliveries.find((entry) =>
    entry.endpoint === nearEndpoint && entry.payload.direction === "reverse"
  );
  assert.notEqual(returned, undefined, "the reverse direction must deliver");
  assert.equal(
    returned.context.delivery.source.originNodeId,
    `chain.${length - 1}`,
  );
});
