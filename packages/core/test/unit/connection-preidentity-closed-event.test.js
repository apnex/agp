import assert from "node:assert/strict";
import test from "node:test";

import {
  operations,
} from "../fixtures/core-fixtures.js";
import { validateCoreSchema } from "../../dist/index.js";

const DATA_SCHEMA_ID =
  "urn:agp:schema:v1:core:event:connection-preidentity-closed-data";

test("given an attempt without identity authority, when it ends, then one remote-free preidentity event exposes only its reserved local ID, derived direction, reason, and neutral terminal", async () => {
  const store = operations();
  const subscription = store.events();
  store.commit({
    events: [{
      kind: "connection.preidentity-closed",
      subjectId: "000002",
      data: {
        localSessionId: "000002",
        direction: "inbound",
        reason: "TransportClosed",
        terminal: { origin: "remote", kind: "graceful" },
      },
    }],
  });

  const observed = await subscription.next();
  assert.equal(observed.done, false);
  assert.equal(observed.value.kind, "connection.preidentity-closed");
  assert.deepEqual(observed.value.data, {
    localSessionId: "000002",
    direction: "inbound",
    reason: "TransportClosed",
    terminal: { origin: "remote", kind: "graceful" },
  });
  assert.equal("remoteNodeId" in observed.value.data, false);
  assert.equal(validateCoreSchema(DATA_SCHEMA_ID, observed.value.data).ok, true);
  await subscription.return();
});

test("given claimed or expected remote identity before admission, when preidentity event data is validated, then the closed schema rejects that invented authority", () => {
  for (const forbidden of ["remoteNodeId", "remoteSessionId", "expectedNodeId"]) {
    assert.equal(validateCoreSchema(DATA_SCHEMA_ID, {
      localSessionId: "000002",
      direction: "inbound",
      reason: "TransportClosed",
      [forbidden]: "peer.untrusted",
    }).ok, false, forbidden);
  }
});
