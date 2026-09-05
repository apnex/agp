import assert from "node:assert/strict";
import test from "node:test";
import {
  runReceiveBoundsCase,
} from "@agp/transport";
import {
  DEFAULT_CHANNEL_LIMITS,
  openPair,
} from "../support/topology.js";

test("Given a real Node WebSocket channel pair, when the neutral receive-bounds case runs, then a reader that stops draining does not cause unbounded retention", async () => {
  const result = await runReceiveBoundsCase({
    async acquirePair() {
      const pair = await openPair();
      return {
        left: pair.client,
        right: pair.server,
        close: pair.close,
      };
    },
  }, DEFAULT_CHANNEL_LIMITS);

  assert.equal(result.id, "receive-bounds");
  assert.equal(result.drainedBeforeStall, 3);
  assert.ok(result.retained <= 32, `retained ${result.retained}, beyond twice the budget of 16`);
  // Either outcome is contract-legal. A carrier that can pause its socket
  // absorbs within budget; one that cannot commits a terminal. Recording which
  // one this carrier chose is the point -- the case asserts boundedness, not
  // a particular strategy.
  assert.ok(
    result.outcome === "absorbed-within-budget"
      || result.outcome === "terminal-on-breach",
    `unexpected outcome ${result.outcome}`,
  );
});
