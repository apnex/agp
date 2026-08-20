import assert from "node:assert/strict";
import test from "node:test";

import { protocolSemanticRulesCatalogV1 } from "../../dist/index.js";

test("Given the package semantic-rule catalog, when its entries are inspected, then the three protocol-owned registry rules point to exact implementations and orthogonal tests", () => {
  assert.equal(Object.isFrozen(protocolSemanticRulesCatalogV1), true);
  assert.equal(protocolSemanticRulesCatalogV1.owner, "@agp/protocol");
  assert.deepEqual(
    protocolSemanticRulesCatalogV1.rules.map((rule) => ({
      id: rule.id,
      implementation: rule.implementation,
      owningTest: rule.owningTest,
    })),
    [
      {
        id: "OPEN-IDENTITY-1",
        implementation:
          "packages/protocol/src/semantic.ts#validateOpenIdentity",
        owningTest: "packages/protocol/test/unit/open-identity.test.js",
      },
      {
        id: "ROUTE-PATH-OWNERSHIP-1",
        implementation:
          "packages/protocol/src/semantic.ts#validateRoutePathOwnership",
        owningTest:
          "packages/protocol/test/unit/route-path-semantics.test.js",
      },
      {
        id: "ROUTE-PATH-LIMIT-1",
        implementation:
          "packages/protocol/src/semantic.ts#validateImportedPathLength",
        owningTest: "packages/protocol/test/unit/route-path-limit.test.js",
      },
    ],
  );
});
