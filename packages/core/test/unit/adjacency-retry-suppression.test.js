import test from "node:test";
import assert from "node:assert/strict";
import { AdjacencySupervisor } from "../../dist/index.js";

// Owns: winning-session suppression and bounded retry resumption.
test("given a satisfied adjacency, when its winner is live then lost, then dial is suppressed before bounded retry resumes", () => {
  const supervisor = new AdjacencySupervisor({
    adjacencyId: "adj",
    expectedNodeId: "peer",
    policy: { initialDelayMs: 100, maximumDelayMs: 400 },
  });
  supervisor.satisfied("winner");
  assert.equal(supervisor.beginDial().state, "satisfied");
  const retry = supervisor.winnerLost("winner");
  assert.equal(retry.state, "retry-wait");
  assert.equal(retry.retryDelayMs, 100);
});
