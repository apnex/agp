import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateOpenIdentity } from "../../dist/index.js";

const [openMessage] = JSON.parse(
  await readFile(
    new URL("../fixtures/valid-wire-messages.json", import.meta.url),
    "utf8",
  ),
);
const open = openMessage.body;

test("Given a distinct expected peer approved by identity admission, when OPEN-IDENTITY-1 evaluates it, then the identity is accepted", () => {
  assert.deepEqual(
    validateOpenIdentity(open, {
      localNodeId: "node.local",
      expectedNodeId: "node.alpha",
      identityAdmitted: true,
    }),
    { ok: true, code: "ACCEPT" },
  );
});

test("Given one invalid OPEN identity dimension, when OPEN-IDENTITY-1 evaluates it, then the exact first identity rejection reason is returned", () => {
  assert.deepEqual(
    validateOpenIdentity(open, {
      localNodeId: "node.alpha",
      expectedNodeId: "node.other",
      identityAdmitted: false,
    }),
    {
      ok: false,
      code: "IDENTITY_REJECTED",
      reason: "SAME_NODE",
    },
  );
  assert.deepEqual(
    validateOpenIdentity(open, {
      localNodeId: "node.local",
      expectedNodeId: "node.other",
      identityAdmitted: false,
    }),
    {
      ok: false,
      code: "IDENTITY_REJECTED",
      reason: "EXPECTED_NODE_MISMATCH",
    },
  );
  assert.deepEqual(
    validateOpenIdentity(open, {
      localNodeId: "node.local",
      expectedNodeId: "node.alpha",
      identityAdmitted: false,
    }),
    {
      ok: false,
      code: "IDENTITY_REJECTED",
      reason: "ADMISSION_DENIED",
    },
  );
});
