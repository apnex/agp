import assert from "node:assert/strict";
import test from "node:test";

import { destinationsOf, validateAgpMessage } from "../../dist/index.js";

function disposition(body) {
  return {
    agp: 1,
    plane: "control",
    type: "disposition",
    id: "disposition-1",
    body,
  };
}

test("Given a denominator of one, when a disposition tries to spell it, then the wire admits only its absence", () => {
  const absent = disposition({
    delivered: [{ from: "0000000000000001", to: "0000000000000004" }],
  });
  assert.deepEqual(validateAgpMessage(absent), { ok: true, message: absent });

  const spelled = disposition({
    delivered: [
      { from: "0000000000000001", to: "0000000000000004", destinations: 1 },
    ],
  });
  assert.equal(validateAgpMessage(spelled).ok, false);

  const spelledOnFailure = disposition({
    failed: [
      {
        code: "NO_ROUTE",
        refId: "data-1",
        returnToken: "0000000000000001",
        failedAtNodeId: "node.beta",
        reason: "no selected route",
        destinations: 1,
      },
    ],
  });
  assert.equal(validateAgpMessage(spelledOnFailure).ok, false);
});

test("Given a denominator above one, when a disposition carries it, then both the delivered and the failed arm accept it", () => {
  const message = disposition({
    delivered: [
      { from: "0000000000000001", to: "0000000000000001", destinations: 3 },
    ],
    failed: [
      {
        code: "NO_ROUTE",
        refId: "data-1",
        returnToken: "0000000000000002",
        failedAtNodeId: "node.beta",
        reason: "no selected route",
        destinations: 2,
      },
    ],
  });
  assert.deepEqual(validateAgpMessage(message), { ok: true, message });
});

test("Given an outcome that omits the denominator, when it is read through destinationsOf, then the absence reads back as one", () => {
  assert.equal(destinationsOf({}), 1);
  assert.equal(destinationsOf({ destinations: undefined }), 1);
  assert.equal(destinationsOf({ destinations: 4 }), 4);
});
