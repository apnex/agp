import assert from "node:assert/strict";
import test from "node:test";

import {
  acquirePair,
  closeFabric,
  createFixture,
  disposePair,
} from "../support/topology.js";

test("given a committed channel when peer evidence is inspected then it names the fabric-issued opposite transport only", async () => {
  const fixture = createFixture({ fabricId: "evidence" });
  const pair = await acquirePair(fixture);

  assert.deepEqual(pair.left.peerEvidence, {
    locality: "process-local",
    protection: "none",
    authentication: {
      kind: "verified",
      principal: "alpha",
      method: "same-process-capability",
    },
  });
  assert.deepEqual(pair.right.peerEvidence.authentication, {
    kind: "verified",
    principal: "beta",
    method: "same-process-capability",
  });
  assert.ok(Object.isFrozen(pair.left.peerEvidence));
  assert.ok(Object.isFrozen(pair.left.peerEvidence.authentication));

  await disposePair(pair);
  await closeFabric(fixture.fabric);
});
