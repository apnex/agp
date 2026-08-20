import assert from "node:assert/strict";
import test from "node:test";

import {
  validateCanonicalRouteSnapshot,
  validateRoutePathOwnership,
} from "../../dist/index.js";

const valid = {
  endpoint: "demo/service",
  originNodeId: "node.origin",
  path: ["node.origin", "node.peer"],
};

test("Given an origin-owned path ending at the admitted sender, when ROUTE-PATH-OWNERSHIP-1 evaluates it, then it is accepted", () => {
  assert.deepEqual(validateRoutePathOwnership(valid, "node.peer"), {
    ok: true,
    code: "ACCEPT",
  });
});

test("Given multiple invalid path facts, when ROUTE-PATH-OWNERSHIP-1 evaluates them, then forged origin precedes forged sender and repetition", () => {
  assert.deepEqual(
    validateRoutePathOwnership(
      {
        ...valid,
        originNodeId: "node.forged",
        path: ["node.origin", "node.origin"],
      },
      "node.peer",
    ),
    {
      ok: false,
      code: "INVALID_MESSAGE",
      reason: "ORIGIN_MISMATCH",
    },
  );
  assert.deepEqual(
    validateRoutePathOwnership(
      {
        ...valid,
        path: ["node.origin", "node.origin"],
      },
      "node.peer",
    ),
    {
      ok: false,
      code: "INVALID_MESSAGE",
      reason: "ADVERTISING_PEER_MISMATCH",
    },
  );
  assert.deepEqual(
    validateRoutePathOwnership(
      {
        ...valid,
        path: ["node.origin", "node.peer", "node.peer"],
      },
      "node.peer",
    ),
    {
      ok: false,
      code: "INVALID_MESSAGE",
      reason: "REPEATED_NODE",
    },
  );
});

test("Given a full snapshot, when canonical endpoint ordering and uniqueness are checked, then only a strictly ordered one-route-per-endpoint set is accepted", () => {
  const first = {
    endpoint: "demo/client",
    originNodeId: "node.origin",
    path: ["node.origin", "node.peer"],
  };
  assert.deepEqual(validateCanonicalRouteSnapshot([first, valid]), {
    ok: true,
    code: "ACCEPT",
  });
  assert.deepEqual(validateCanonicalRouteSnapshot([valid, first]), {
    ok: false,
    code: "INVALID_MESSAGE",
    reason: "NONCANONICAL_ORDER",
  });
  assert.deepEqual(
    validateCanonicalRouteSnapshot([
      valid,
      { ...valid, originNodeId: "node.other", path: ["node.other"] },
    ]),
    {
      ok: false,
      code: "INVALID_MESSAGE",
      reason: "DUPLICATE_ENDPOINT",
    },
  );
});
