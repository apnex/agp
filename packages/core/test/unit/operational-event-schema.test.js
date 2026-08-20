import assert from "node:assert/strict";
import test from "node:test";
import {
  OPERATIONAL_EVENT_KINDS,
  validateCoreSchema,
} from "../../dist/index.js";

const OPERATIONAL_EVENT_SCHEMA_ID =
  "urn:agp:schema:v1:core:event:operational-event";

test("given the generated closed event vocabulary, when every valid data variant and invalid legacy shape is checked, then the sovereign runtime union accepts exactly the published contracts", () => {
  const events = OPERATIONAL_EVENT_KINDS.map((kind, index) =>
    event(kind, dataFor(kind), index + 1)
  );

  for (const value of events) {
    const result = validateCoreSchema(
      OPERATIONAL_EVENT_SCHEMA_ID,
      value,
    );
    assert.equal(
      result.ok,
      true,
      `${value.kind}: ${result.ok ? "" : JSON.stringify(result.issues)}`,
    );
  }
  assert.equal(
    validateCoreSchema(
      OPERATIONAL_EVENT_SCHEMA_ID,
      event("message.failed", {}, 19),
    ).ok,
    true,
  );
  assert.equal(
    validateCoreSchema(
      OPERATIONAL_EVENT_SCHEMA_ID,
      event("lifecycle.changed", {}, 20),
    ).ok,
    false,
  );
  assert.equal(
    validateCoreSchema(
      OPERATIONAL_EVENT_SCHEMA_ID,
      event("lifecycle.starting", { unexpected: true }, 21),
    ).ok,
    false,
  );
  assert.equal(
    validateCoreSchema(
      OPERATIONAL_EVENT_SCHEMA_ID,
      event("observer.gap", {}, 22),
    ).ok,
    false,
  );
  assert.equal(
    validateCoreSchema(
      OPERATIONAL_EVENT_SCHEMA_ID,
      event("message.failed", { code: "UNKNOWN" }, 23),
    ).ok,
    false,
  );
});

function event(kind, data, sequence) {
  return {
    schemaVersion: "agp.event/v1",
    sequence: String(sequence),
    revision: String(sequence),
    nodeId: "node.events",
    instanceId: "instance-events",
    occurredAt: "2026-07-30T00:00:00.000Z",
    kind,
    subjectId: "event-subject",
    data,
  };
}

function dataFor(kind) {
  if (kind === "message.failed") return { code: "NO_ROUTE" };
  if (kind === "observer.gap") {
    return { droppedFrom: "1", droppedTo: "2" };
  }
  if (kind === "session.closed") {
    return {
      remoteNodeId: "peer.events",
      localSessionId: "000001",
      reason: "TransportFailed",
    };
  }
  if (kind === "connection.preidentity-closed") {
    return {
      localSessionId: "000002",
      direction: "inbound",
      reason: "TransportClosed",
    };
  }
  return {};
}
