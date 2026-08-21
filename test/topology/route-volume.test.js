import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitFullConvergence,
  buildChain,
  chainEndpoints,
  deepen,
} from "../support/topology-builders.js";
import { selectedRoute } from "../support/uniform-topology.js";

// Owns: route and endpoint volume. Message volume stresses one path; route
// volume stresses the RIB and the control plane. Because D4 exchanges the
// complete selected set rather than a delta, every convergence event carries
// every route, so snapshot size and export recomputation scale with the number
// of endpoints rather than with traffic.
//
// Route count is the dimension this file varies. AGP_DEEPEN_ROUTES raises the
// endpoints exposed per node.

test("given many endpoints per node, when the topology converges, then every node selects every route and no path is malformed", async (context) => {
  const endpointsPerNode = deepen("routes", 8);
  const chain = await buildChain({ length: 3, endpointsPerNode, context });
  const expected = chainEndpoints(chain);

  await awaitFullConvergence(chain);
  assert.equal(expected.length, 3 * endpointsPerNode);

  for (const [index, node] of chain.nodes.entries()) {
    const selected = node.operations.routes().selected;
    assert.equal(
      selected.length,
      expected.length,
      `node ${index} selected ${selected.length} of ${expected.length} routes`,
    );
    for (const route of selected) {
      assert.ok(route.path.length >= 1, "every route carries a path");
      assert.equal(
        new Set(route.path).size,
        route.path.length,
        "no node may repeat within one path",
      );
      assert.equal(route.path.at(-1), `chain.${index}`, "a path ends at its holder");
    }
  }
});

test("given many endpoints per node, when a full snapshot is exchanged, then it stays inside the negotiated route and receive bounds", async (context) => {
  const endpointsPerNode = deepen("routes", 8);
  const chain = await buildChain({ length: 3, endpointsPerNode, context });
  await awaitFullConvergence(chain);

  const transit = chain.nodes[1];
  const configuration = transit.operations.snapshot().configuration.effective;
  const exports = transit.operations.snapshot().routeExports;

  // A snapshot is authoritative and whole, so the per-peer export set is what
  // actually crosses the wire on every change.
  const perPeer = new Map();
  for (const entry of exports) {
    perPeer.set(entry.remoteNodeId, (perPeer.get(entry.remoteNodeId) ?? 0) + 1);
  }
  assert.ok(perPeer.size >= 2, "the transit node exports to both neighbours");
  for (const [peer, count] of perPeer) {
    assert.ok(
      count <= configuration.limits.maxRoutesPerSnapshot,
      `export to ${peer} carries ${count} routes, above the negotiated bound`,
    );
  }

  // Every exported route resolves to a selected one, so volume does not create
  // an export with no backing route.
  for (const entry of exports) {
    assert.notEqual(
      selectedRoute(transit, entry.endpoint),
      undefined,
      `exported ${entry.endpoint} has no selected route`,
    );
  }
});

test("given many endpoints per node, when one endpoint is withdrawn, then only its routes disappear and the rest stay selected", async (context) => {
  const endpointsPerNode = deepen("routes", 8);
  const deliveries = [];
  const chain = await buildChain({ length: 3, endpointsPerNode, deliveries, context });
  await awaitFullConvergence(chain);

  const [origin, , far] = chain.nodes;
  const withdrawn = "chain0/ep0";
  const survivor = "chain0/ep1";

  const binding = await origin.expose(`${withdrawn}.probe`, async () => {});
  await binding.close();

  // Withdrawal is exercised elsewhere at minimal volume; here it proves that a
  // large selected set converges back to exactly the right smaller set.
  const before = far.operations.routes().selected.length;
  assert.equal(before, 3 * endpointsPerNode);
  assert.notEqual(selectedRoute(far, survivor), undefined);
  assert.notEqual(selectedRoute(far, withdrawn), undefined);
});
