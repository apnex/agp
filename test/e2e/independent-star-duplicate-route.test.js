import assert from "node:assert/strict";
import test from "node:test";

import {
  IndependentProcessTopology,
  STAR_DUPLICATE_ENDPOINT,
  eventuallyProcess,
  getProcessManagement,
  startIndependentStar,
} from "./support/independent-processes.js";

test("given both independent spokes advertise one endpoint when the star converges then the hub retains both candidates and deterministically selects the Alpha origin", async (context) => {
  const topology = await IndependentProcessTopology.create();
  context.after(() => topology.dispose());
  const star = await startIndependentStar(topology);

  const [hubSnapshot, alphaSnapshot, betaSnapshot] = await Promise.all([
    waitForSnapshot(
      star.hub,
      (snapshot) => {
        const candidates = duplicateCandidates(snapshot);
        const selected = duplicateSelection(snapshot);
        return candidates.length === 2
          && selected?.originNodeId === "spoke.alpha";
      },
      "two hub candidates and the deterministic Alpha selection",
    ),
    waitForSnapshot(
      star.alpha,
      (snapshot) => {
        const candidates = duplicateCandidates(snapshot);
        const selected = duplicateSelection(snapshot);
        return candidates.length === 1
          && selected?.routeClass === "local";
      },
      "Alpha local duplicate route",
    ),
    waitForSnapshot(
      star.beta,
      (snapshot) => {
        const candidates = duplicateCandidates(snapshot);
        const selected = duplicateSelection(snapshot);
        return candidates.length === 2
          && selected?.routeClass === "local";
      },
      "Beta local route and learned alternate",
    ),
  ]);

  const hubCandidates = duplicateCandidates(hubSnapshot);
  assert.deepEqual(
    hubCandidates.map(({ originNodeId }) => originNodeId),
    ["spoke.alpha", "spoke.beta"],
  );
  assert.deepEqual(
    hubCandidates.map(({ path }) => path),
    [
      ["spoke.alpha", "hub"],
      ["spoke.beta", "hub"],
    ],
  );
  assert.equal(
    hubCandidates.every(
      ({ eligible, learnedKind, routeClass, selectionReason }) =>
        eligible
        && learnedKind === "direct"
        && routeClass === "learned"
        && selectionReason === "LOWEST_ORIGIN_NODE_ID",
    ),
    true,
  );
  assert.deepEqual(
    hubCandidates.map(({ selectionStatus }) => selectionStatus),
    ["selected", "not-selected"],
  );
  const hubSelection = duplicateSelection(hubSnapshot);
  assert.equal(hubSelection.originNodeId, "spoke.alpha");
  assert.equal(hubSelection.routeClass, "learned");
  assert.equal(hubSelection.learnedKind, "direct");
  assert.equal(hubSelection.selectionReason, "LOWEST_ORIGIN_NODE_ID");
  assert.deepEqual(
    hubSelection.path,
    ["spoke.alpha", "hub"],
  );
  assert.equal(hubSelection.nextHop.kind, "session");
  assert.equal(hubSelection.nextHop.nodeId, "spoke.alpha");

  assert.deepEqual(
    duplicateCandidates(alphaSnapshot).map(
      ({ originNodeId, routeClass, selectionStatus }) => ({
        originNodeId,
        routeClass,
        selectionStatus,
      }),
    ),
    [{
      originNodeId: "spoke.alpha",
      routeClass: "local",
      selectionStatus: "selected",
    }],
  );
  assert.deepEqual(
    duplicateCandidates(betaSnapshot).map(
      ({
        originNodeId,
        routeClass,
        selectionReason,
        selectionStatus,
      }) => ({
        originNodeId,
        routeClass,
        selectionReason,
        selectionStatus,
      }),
    ),
    [
      {
        originNodeId: "spoke.beta",
        routeClass: "local",
        selectionReason: "PREFER_LOCAL",
        selectionStatus: "selected",
      },
      {
        originNodeId: "spoke.alpha",
        routeClass: "learned",
        selectionReason: "PREFER_LOCAL",
        selectionStatus: "not-selected",
      },
    ],
  );
  assert.equal(topology.nodes.every((node) => node.alive), true);
});

async function waitForSnapshot(node, predicate, description) {
  return eventuallyProcess(async () => {
    const response = await getProcessManagement(node, "snapshot");
    return predicate(response.data) ? response.data : undefined;
  }, description);
}

function duplicateCandidates(snapshot) {
  return snapshot.candidateRoutes.filter(
    ({ endpoint }) => endpoint === STAR_DUPLICATE_ENDPOINT,
  );
}

function duplicateSelection(snapshot) {
  return snapshot.selectedRoutes.find(
    ({ endpoint }) => endpoint === STAR_DUPLICATE_ENDPOINT,
  );
}
