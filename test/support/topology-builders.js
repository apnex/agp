import {
  createLoopbackNode,
  eventually,
  expose,
  memoryPeer,
  selectedRoute,
} from "./uniform-topology.js";

// Parameterised geometry and traffic builders.
//
// The default suite calls these with small values in named files, so a failure
// still names one geometry and one axis. The same entry points accept larger
// values, which is what makes a dimension in the coverage register genuinely
// supported rather than merely declared.

/**
 * Read a deepening override for one dimension, defaulting to the value the
 * default suite uses.
 *
 * Varying one dimension at a time is the whole discipline: a run that raises
 * two at once cannot attribute what it finds.
 */
/** AGP v1 caps one authoritative snapshot at this many routes. */
export const PROTOCOL_MAX_ROUTES_PER_SNAPSHOT = 256;

export function deepen(dimension, fallback) {
  const name = `AGP_DEEPEN_${dimension.toUpperCase()}`;
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1 || String(value) !== raw.trim()) {
    throw new Error(`${name} must be a positive integer, received ${raw}`);
  }
  return value;
}

export function endpointsOf(index, count) {
  return Array.from({ length: count }, (_, slot) => `chain${index}/ep${slot}`);
}

/**
 * A chain of `length` nodes, each adjacent pair connected, every interior node
 * permitting transit.
 *
 * `length` of three is the familiar line. Four or more places two transit nodes
 * in series, which is the only way to exercise transit-to-transit ingress
 * authorisation, a path vector longer than three, and a hop limit decremented
 * more than once.
 */
export async function buildChain({
  length,
  endpointsPerNode = 1,
  deliveries = [],
  context,
}) {
  if (length < 2) throw new Error("a chain needs at least two nodes");
  const nodes = [];
  const started = [];

  // Bounds scale with the topology so route volume can be deepened. Leaving
  // them fixed made the harness, not AGP, the limit: a run past sixty-four
  // endpoints failed ENDPOINT_CAPACITY before reaching any protocol behavior.
  //
  // maxRoutesPerSnapshot cannot exceed AGP_V1_LIMITS.maxRoutesPerSnapshot,
  // which is 256 and is a protocol ceiling rather than a configuration choice.
  // That bound is the practical scale limit of D4's full-snapshot exchange, so
  // a chain cannot carry more than 256 endpoints in total.
  const totalEndpoints = length * endpointsPerNode;
  if (totalEndpoints > PROTOCOL_MAX_ROUTES_PER_SNAPSHOT) {
    throw new Error(
      `a chain of ${length} nodes with ${endpointsPerNode} endpoints each needs `
        + `${totalEndpoints} routes, above the AGP v1 snapshot ceiling of `
        + `${PROTOCOL_MAX_ROUTES_PER_SNAPSHOT}`,
    );
  }
  const limits = {
    maxLocalEndpoints: Math.max(64, endpointsPerNode * 2),
    maxRoutesPerSnapshot: PROTOCOL_MAX_ROUTES_PER_SNAPSHOT,
    maxCandidateRoutes: Math.max(1024, totalEndpoints * 4),
  };

  for (let index = 0; index < length; index += 1) {
    const isLast = index === length - 1;
    const previous = started[index - 1];
    const node = createLoopbackNode({
      nodeId: `chain.${index}`,
      // Every node but the last accepts the next one's dial.
      ...(isLast
        ? {}
        : { listen: { host: "127.0.0.1", port: 0, path: "/agp" } }),
      peers: previous === undefined ? [] : [{
        ...memoryPeer(`n${index}-n${index - 1}`, `chain.${index - 1}`, index),
        url: previous.listener.publication.displayAddress,
      }],
      transit: true,
      ...limits,
    });
    nodes.push(node);
    context?.after(() => node.stop().catch(() => undefined));
    await expose(node, endpointsOf(index, endpointsPerNode), deliveries);
    started.push(await node.start());
  }

  return { nodes, deliveries, length, endpointsPerNode };
}

/** Every endpoint the chain exposes, in node order. */
export function chainEndpoints(chain) {
  return Array.from(
    { length: chain.length },
    (_, index) => endpointsOf(index, chain.endpointsPerNode),
  ).flat();
}

/**
 * Wait until every node has selected a route for every endpoint in the chain.
 *
 * Full convergence is the precondition for any volumetric assertion: a count
 * taken mid-convergence measures timing rather than behavior.
 */
export async function awaitFullConvergence(chain, timeoutMs = 30_000) {
  const expected = chainEndpoints(chain);
  await eventually(
    () => chain.nodes.every((node) =>
      expected.every((endpoint) => selectedRoute(node, endpoint) !== undefined)
    ),
    `all ${expected.length} endpoints selected on all ${chain.length} nodes`,
    timeoutMs,
  );
  return expected;
}

/**
 * Send `count` messages along one path and wait for all of them.
 *
 * Each payload carries its ordinal so arrival order is checked against send
 * order rather than assumed from arrival count.
 */
export async function streamMessages({
  from,
  source,
  destination,
  count,
  deliveries,
  timeoutMs = 30_000,
}) {
  // Count only this destination. Concurrent streams share one delivery log, so
  // a total-length wait completes on the other direction's traffic and reads a
  // partial sequence as an ordering failure.
  const at = () => deliveries.filter((entry) => entry.endpoint === destination);
  const before = at().length;
  const receipts = [];
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    receipts.push(await from.send(source, destination, { ordinal }));
  }
  await eventually(
    () => at().length - before >= count,
    `${count} deliveries at ${destination}`,
    timeoutMs,
  );
  const arrived = at().slice(before).map((entry) => entry.payload.ordinal);
  return { receipts, arrived };
}
