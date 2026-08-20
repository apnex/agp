import assert from "node:assert/strict";
import test from "node:test";

import { validateImportedPathLength } from "../../dist/index.js";

const route = {
  endpoint: "demo/service",
  originNodeId: "node.origin",
  path: ["node.origin", "node.peer"],
};

test("Given a wire path whose receiver append equals the negotiated maximum, when ROUTE-PATH-LIMIT-1 evaluates it, then equality is accepted", () => {
  assert.deepEqual(validateImportedPathLength(route, 3), {
    ok: true,
    code: "ACCEPT",
  });
});

test("Given a wire path whose receiver append exceeds the negotiated maximum by one, when ROUTE-PATH-LIMIT-1 evaluates it, then PATH_TOO_LONG is returned", () => {
  assert.deepEqual(validateImportedPathLength(route, 2), {
    ok: false,
    code: "PATH_TOO_LONG",
  });
});
