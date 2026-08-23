import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AGP_V1_DELIVERY_ERROR_CODES,
  AGP_V1_FATAL_NOTIFICATION_CODES,
  AGP_V1_ROUTE_REJECTION_CODES,
  validateAgpMessage,
} from "../../dist/index.js";

const [open, , routeUpdate, , , error] = JSON.parse(
  await readFile(
    new URL("../fixtures/valid-wire-messages.json", import.meta.url),
    "utf8",
  ),
);

test("Given the ratified v1 code catalogs, when their public values are inspected, then only the exact fatal, delivery, and route-rejection domains are exposed", () => {
  assert.deepEqual([...AGP_V1_FATAL_NOTIFICATION_CODES], [
    "CEASE",
    "UNSUPPORTED_VERSION",
    "INVALID_MESSAGE",
    "UNEXPECTED_MESSAGE",
    "IDENTITY_REJECTED",
    "ADJACENCY_COLLISION",
    "HOLD_TIMEOUT",
    "ROUTE_REVISION_ERROR",
    "INTERNAL_ERROR",
  ]);
  assert.deepEqual([...AGP_V1_DELIVERY_ERROR_CODES], [
    "NO_ROUTE",
    "HOP_LIMIT_EXCEEDED",
    "SOURCE_NOT_AUTHORIZED",
    "SOURCE_NOT_ADVERTISED",
    "TRANSIT_DISABLED",
    "NEXT_HOP_UNAVAILABLE",
    "INSTANCE_UNREACHABLE",
    "MESSAGE_TOO_LARGE",
    "QUEUE_FULL",
  ]);
  assert.deepEqual([...AGP_V1_ROUTE_REJECTION_CODES], [
    "LOOP",
    "PATH_TOO_LONG",
    "POLICY",
    "CAPACITY",
  ]);
});

test("Given schema-valid JSON-like legacy or ambiguous objects, when the v1 union validates them, then role, endpoint-update, unknown fields, and mismatched error reasons are rejected", () => {
  const roleOpen = structuredClone(open);
  roleOpen.body.role = "hub";

  const endpointUpdate = {
    agp: 1,
    plane: "control",
    type: "endpoint.update",
    id: "legacy-1",
    body: { revision: 1, endpoints: ["demo/client"] },
  };

  const unknownRouteField = structuredClone(routeUpdate);
  unknownRouteField.body.routes[0].metric = 10;

  const mismatchedReason = structuredClone(error);
  mismatchedReason.body.reason = "hop limit exhausted";

  for (const value of [
    roleOpen,
    endpointUpdate,
    unknownRouteField,
    mismatchedReason,
  ]) {
    assert.deepEqual(validateAgpMessage(value), {
      ok: false,
      reasonCode: "SCHEMA",
      notificationCode: "INVALID_MESSAGE",
    });
  }
});
