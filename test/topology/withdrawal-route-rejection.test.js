import assert from "node:assert/strict";
import test from "node:test";
import {
  createLoopbackNode,
  expose,
  memoryPeer,
  stopAll,
  waitForSnapshot,
} from "../support/uniform-topology.js";

test("given a route admitted from one established peer alongside a sibling, when a later full snapshot denies only that exact route, then the rejected route withdraws while the sibling remains selected", async (context) => {
  let rejectTarget = false;
  const routeAdmission = {
    async evaluate(request) {
      return {
        decisions: request.routes.map((route) =>
          route.endpoint === "rejection/target" && rejectTarget
            ? {
                ...route,
                decision: "deny",
                reason: "test policy changed",
              }
            : { ...route, decision: "allow" }
        ),
      };
    },
  };
  const receiver = createLoopbackNode({
    nodeId: "rejection.receiver",
    listen: { host: "127.0.0.1", port: 0, path: "/agp" },
    routeAdmissionMode: "port",
    dependencies: { routeAdmission },
  });
  let origin;
  context.after(() => stopAll(origin, receiver));
  const startedReceiver = await receiver.start();
  origin = createLoopbackNode({
    nodeId: "rejection.origin",
    peers: [{
      ...memoryPeer("origin-receiver", "rejection.receiver", 1),
      url: startedReceiver.listener.publication.displayAddress,
    }],
  });
  await expose(origin, ["rejection/target", "rejection/sibling"]);
  await origin.start();
  await waitForSnapshot(
    receiver,
    (snapshot) =>
      ["rejection/target", "rejection/sibling"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "initially allowed route set",
  );

  rejectTarget = true;
  await expose(origin, ["rejection/revision-trigger"]);
  const after = await waitForSnapshot(
    receiver,
    (snapshot) =>
      !snapshot.selectedRoutes.some(
        (route) => route.endpoint === "rejection/target",
      )
      && ["rejection/sibling", "rejection/revision-trigger"].every((endpoint) =>
        snapshot.selectedRoutes.some((route) => route.endpoint === endpoint)
      ),
    "later route policy rejection",
  );
  const atOrigin = await waitForSnapshot(
    origin,
    (snapshot) => snapshot.routeExports.some(
      (route) =>
        route.endpoint === "rejection/target"
        && route.state === "rejected"
        && route.remoteRejectionCode === "POLICY",
    ),
    "origin records the remote policy rejection",
  );

  assert.equal(
    atOrigin.routeExports.some(
      (route) =>
        route.endpoint === "rejection/target"
        && route.state === "rejected"
        && route.remoteRejectionCode === "POLICY",
    ),
    true,
  );
  assert.equal(
    after.advertisements.some(
      (route) => route.endpoint === "rejection/target",
    ),
    false,
  );
  assert.equal(
    after.forwarding.some(
      (entry) => entry.endpoint === "rejection/target",
    ),
    false,
  );
});
