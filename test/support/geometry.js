import { randomBytes } from "node:crypto";

import { createNode } from "@agp/node";
import { createNodeWsTransport } from "@agp/transport-node-ws";

import { startProcessNode } from "./node-handle.js";
import {
  createLoopbackNode,
  createWebSocketNode,
  eventually,
  expose,
  memoryPeer,
  selectedRoute,
  uniformConfig,
} from "./uniform-topology.js";

// A geometry is a declared set of nodes and the adjacencies between them. A
// transport is how those adjacencies are carried. Keeping them separate is what
// lets one geometry run over any carrier, and one carrier serve any geometry.
//
// Named tests still build their own topologies. Their oracles are specific to
// one shape, and rewriting a passing test to share a builder is a common way to
// weaken an assertion without noticing. These builders serve the matrix, which
// checks the invariants every geometry must satisfy.

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

// ---------------------------------------------------------------------------
// Transports

const LISTEN = { host: "127.0.0.1", port: 0, path: "/agp" };

/**
 * A pre-shared-key factory owns one secret table for the whole topology, so
 * every node it creates can authenticate every other. Under node keying each
 * node holds its own secret and the listener resolves by presented identity.
 */
function securePresharedKeyFactory() {
  const secrets = new Map();
  const secretFor = (nodeId) => {
    if (!secrets.has(nodeId)) secrets.set(nodeId, randomBytes(32));
    return secrets.get(nodeId);
  };
  let sequence = 0;

  return function createSecureNode(description) {
    sequence += 1;
    const listenerRef = `psk.listen.${sequence}`;
    const security = { mode: "preshared-key", keying: "node" };
    const peers = (description.peers ?? []).map((peer, index) => ({
      adjacencyId: peer.adjacencyId ?? `psk-${sequence}-${index}`,
      expectedNodeId: peer.expectedNodeId,
      transportRef: `psk.target.${sequence}.${index}`,
      reconnect: {
        enabled: true,
        initialDelayMs: 10,
        maximumDelayMs: 100,
        multiplier: 2,
        jitterRatio: 0,
      },
      url: peer.url,
    }));
    const transport = createNodeWsTransport({
      listeners: description.listen === undefined ? [] : [{
        transportRef: listenerRef,
        url: `wss://127.0.0.1:0/agp`,
        compression: { mode: "disabled" },
        security,
      }],
      targets: peers.map(({ transportRef, url }) => ({
        transportRef,
        url: url.replace(/^ws:/u, "wss:"),
        compression: { mode: "disabled" },
        security,
      })),
    }, {
      presharedKeys: {
        localIdentity: description.nodeId,
        own: () => secretFor(description.nodeId),
        resolve: (identity) => secrets.get(identity),
      },
    });
    // Every peer identity must exist before a listener can resolve it.
    secretFor(description.nodeId);
    for (const peer of peers) secretFor(peer.expectedNodeId);

    return createNode(
      uniformConfig({
        ...description,
        ...(description.listen === undefined
          ? {}
          : { listen: { transportRef: listenerRef } }),
        peers: peers.map(({ url: _url, ...rest }) => rest),
      }),
      { transport },
    );
  };
}

export const TRANSPORTS = Object.freeze({
  loopback: { name: "loopback", create: createLoopbackNode },
  websocket: { name: "websocket", create: createWebSocketNode },
  "websocket-psk": { name: "websocket-psk", create: securePresharedKeyFactory },
});

export function transportFactory(name) {
  const entry = TRANSPORTS[name];
  if (entry === undefined) throw new Error(`unknown transport ${name}`);
  // The secure factory is stateful per topology, so it is constructed per run.
  return typeof entry.create === "function" && entry.create.length === 0
    ? entry.create()
    : entry.create;
}

// ---------------------------------------------------------------------------
// Geometry declarations

/**
 * A geometry names its nodes and, for each, which earlier nodes it dials.
 *
 * Declaring adjacency as "dials an earlier node" makes start order derivable:
 * a node can only dial one already listening, so nodes start in index order.
 */
export const GEOMETRIES = Object.freeze({
  star: (size = 3) => ({
    name: "star",
    nodes: Array.from({ length: size }, (_, index) => ({
      listens: index === 0,
      dials: index === 0 ? [] : [0],
    })),
  }),
  line: () => GEOMETRIES.chain(3),
  chain: (length = 3) => ({
    name: length === 3 ? "line" : `chain(${length})`,
    nodes: Array.from({ length }, (_, index) => ({
      listens: index < length - 1,
      dials: index === 0 ? [] : [index - 1],
    })),
  }),
  triangle: () => ({
    name: "triangle",
    nodes: [
      { listens: true, dials: [] },
      { listens: true, dials: [0] },
      { listens: false, dials: [0, 1] },
    ],
  }),
  diamond: () => ({
    name: "diamond",
    nodes: [
      { listens: true, dials: [] },
      { listens: true, dials: [] },
      { listens: false, dials: [0, 1] },
      { listens: false, dials: [0, 1] },
    ],
  }),
});

export function endpointsOf(index, count) {
  return Array.from({ length: count }, (_, slot) => `n${index}/ep${slot}`);
}

/**
 * Build and start a geometry over a transport.
 *
 * Nodes start in index order because a node only dials earlier ones, so every
 * dial target is already listening and publishing an address.
 */
export async function buildGeometry({
  geometry,
  transport = "loopback",
  endpointsPerNode = 1,
  deliveries = [],
  capacity = {},
  disposition,
  context,
  isolation = "in-process",
  streamDeliveries,
}) {
  if (isolation === "process") {
    return buildIsolatedGeometry({
      geometry, transport, endpointsPerNode, deliveries, capacity, context,
      ...(streamDeliveries === undefined ? {} : { streamDeliveries }),
    });
  }
  const create = transportFactory(transport);
  const shape = geometry.nodes;
  const totalEndpoints = shape.length * endpointsPerNode;
  if (totalEndpoints > PROTOCOL_MAX_ROUTES_PER_SNAPSHOT) {
    throw new Error(
      `${geometry.name} with ${endpointsPerNode} endpoints each needs `
        + `${totalEndpoints} routes, above the AGP v1 snapshot ceiling of `
        + `${PROTOCOL_MAX_ROUTES_PER_SNAPSHOT}`,
    );
  }
  const limits = {
    maxLocalEndpoints: Math.max(64, endpointsPerNode * 2),
    maxRoutesPerSnapshot: PROTOCOL_MAX_ROUTES_PER_SNAPSHOT,
    maxCandidateRoutes: Math.max(1024, totalEndpoints * 4),
    ...capacity,
  };

  const nodes = [];
  const started = [];
  for (const [index, spec] of shape.entries()) {
    const node = create({
      nodeId: `n${index}`,
      ...(spec.listens ? { listen: LISTEN } : {}),
      peers: spec.dials.map((target, slot) => ({
        ...memoryPeer(`a${index}-${target}-${slot}`, `n${target}`, index + 1),
        url: started[target].listener.publication.displayAddress,
      })),
      transit: true,
      ...limits,
      ...(disposition === undefined ? {} : { disposition }),
    });
    nodes.push(node);
    context?.after(() => node.stop().catch(() => undefined));
    await expose(node, endpointsOf(index, endpointsPerNode), deliveries);
    started.push(await node.start());
  }

  return {
    name: geometry.name,
    transport,
    nodes,
    deliveries,
    endpointsPerNode,
    endpoints: shape.flatMap((_, index) => endpointsOf(index, endpointsPerNode)),
  };
}

/**
 * The same geometry, with every node in a process of its own.
 *
 * Isolation is an axis rather than a separate harness: the shape, the
 * endpoints, the traffic drivers and the delivery log are the ones the
 * in-process path uses. Only node construction differs, which is the only
 * thing that should.
 *
 * Nodes sharing a process share an event loop, a heap and a compilation state,
 * so a measurement taken across them compares the harness as much as the
 * subject. That is why this exists; see `VERIFICATION.md` section 4.9.
 */
async function buildIsolatedGeometry({
  geometry, transport, endpointsPerNode, deliveries, capacity, context,
  streamDeliveries = true,
}) {
  if (transport !== "websocket" && transport !== "websocket-psk") {
    throw new Error(
      `transport ${transport} has no cross-process carrier; see F08`,
    );
  }
  const shape = geometry.nodes;
  const secure = transport === "websocket-psk";
  // Generated here rather than in the children, because every node must be
  // able to authenticate every other and a closure does not cross a process
  // boundary. One table per topology, per run.
  const secrets = secure
    ? Object.fromEntries(
        shape.map((_, index) => [`n${index}`, randomBytes(32).toString("hex")]),
      )
    : undefined;
  const scheme = secure ? "wss" : "ws";
  const limits = {
    maxLocalEndpoints: Math.max(64, endpointsPerNode * 2),
    maxRoutesPerSnapshot: PROTOCOL_MAX_ROUTES_PER_SNAPSHOT,
    maxCandidateRoutes: Math.max(1024, endpointsPerNode * shape.length * 4),
    ...capacity,
  };
  const nodes = [];
  for (const [index, spec] of shape.entries()) {
    const listenerRef = `listen.${index}`;
    const targets = spec.dials.map((target, slot) => ({
      transportRef: `target.${index}.${slot}`,
      url: nodes[target].listener.publication.displayAddress,
    }));
    const config = uniformConfig({
      nodeId: `n${index}`,
      ...(spec.listens ? { listen: { transportRef: listenerRef } } : {}),
      peers: spec.dials.map((target, slot) => ({
        adjacencyId: `a${index}-${target}-${slot}`,
        expectedNodeId: `n${target}`,
        transportRef: `target.${index}.${slot}`,
      })),
      transit: true,
      ...limits,
    });
    const handle = await startProcessNode({
      config,
      transport: {
        kind: transport,
        listeners: spec.listens
          ? [{ transportRef: listenerRef, url: `${scheme}://127.0.0.1:0/agp` }]
          : [],
        targets,
        ...(secure
          ? { presharedKeys: { localIdentity: `n${index}`, secrets } }
          : {}),
      },
      endpoints: endpointsOf(index, endpointsPerNode),
      deliveries,
      streamDeliveries,
    });
    nodes.push(handle);
    context?.after(() => handle.stop().catch(() => undefined));
  }
  return {
    name: geometry.name,
    transport,
    isolation: "process",
    nodes,
    deliveries,
    endpointsPerNode,
    endpoints: shape.flatMap((_, index) => endpointsOf(index, endpointsPerNode)),
  };
}

export async function awaitConvergence(topology, timeoutMs = 40_000) {
  await eventually(
    async () => {
      if (topology.isolation === "process") {
        for (const node of topology.nodes) {
          const selected = new Set(await node.selectedRoutes());
          if (!topology.endpoints.every((endpoint) => selected.has(endpoint))) {
            return false;
          }
        }
        return true;
      }
      return topology.nodes.every((node) =>
        topology.endpoints.every((endpoint) =>
          selectedRoute(node, endpoint) !== undefined
        )
      );
    },
    `${topology.endpoints.length} endpoints selected on `
      + `${topology.nodes.length} ${topology.name} nodes over ${topology.transport}`,
    timeoutMs,
  );
  return topology;
}
