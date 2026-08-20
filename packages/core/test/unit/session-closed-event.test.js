import assert from "node:assert/strict";
import test from "node:test";

import {
  operations,
} from "../fixtures/core-fixtures.js";
import { validateCoreSchema } from "../../dist/index.js";

const EVENT_SCHEMA_ID = "urn:agp:schema:v1:core:event:operational-event";

test("given authoritative admitted identity, when the attempt ends, then one pair-scoped session.closed event carries the exact local pair key and no pre-identity fields", async () => {
  const store = operations();
  const subscription = store.events();
  store.commit({
    events: [{
      kind: "session.closed",
      subjectId: "peer.a@000001",
      data: {
        remoteNodeId: "peer.a",
        localSessionId: "000001",
        reason: "TransportFailed",
        terminal: { origin: "carrier", kind: "io-failure" },
      },
    }],
  });

  const observed = await subscription.next();
  assert.equal(observed.done, false);
  assert.equal(observed.value.kind, "session.closed");
  assert.deepEqual(observed.value.data, {
    remoteNodeId: "peer.a",
    localSessionId: "000001",
    reason: "TransportFailed",
    terminal: { origin: "carrier", kind: "io-failure" },
  });
  assert.equal("direction" in observed.value.data, false);
  assert.equal(validateCoreSchema(EVENT_SCHEMA_ID, observed.value).ok, true);
  await subscription.return();
});

test("given a legacy alias or absent remote authority, when session.closed data is validated, then it cannot masquerade as an admitted pair", () => {
  for (const data of [
    {
      remoteNodeId: "peer.a",
      sessionId: "000001",
      reason: "TransportFailed",
    },
    {
      localSessionId: "000001",
      reason: "TransportFailed",
    },
  ]) {
    assert.equal(validateCoreSchema(
      "urn:agp:schema:v1:core:event:session-closed-data",
      data,
    ).ok, false);
  }
});
