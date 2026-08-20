import test from "node:test";
import assert from "node:assert/strict";
import { establish, owner, route, table } from "../fixtures/core-fixtures.js";

// Owns: mutation-order-independent total best-path selection.
test("given equal-class alternatives, when they arrive in either order, then the shorter path wins deterministically", () => {
  const run = (reverse) => {
    const rib = table();
    const direct = owner("direct", "peer.a", "000001", "000002");
    const transit = owner("transit", "peer.b", "000003", "000004");
    for (const value of reverse ? [transit, direct] : [direct, transit]) {
      establish(rib, value);
      const isDirect = value.controllerId === "direct";
      rib.importSnapshot({
        owner: value,
        updateId: `${value.controllerId}-1`,
        revision: 1,
        routes: [isDirect
          ? route("demo/service", "peer.a", ["peer.a"])
          : route("demo/service", "origin", ["origin", "peer.b"])],
      });
    }
    return rib.selectedRoute("demo/service").path;
  };
  assert.deepEqual(run(false), ["peer.a", "node.local"]);
  assert.deepEqual(run(true), ["peer.a", "node.local"]);
});
