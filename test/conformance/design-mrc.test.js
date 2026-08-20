import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design/agp-uniform-node");
const normativeArtifacts = [
  "README.md",
  "axioms.md",
  "bindings/websocket.md",
  "contracts.md",
  "decisions.md",
  "fsm.md",
  "mechanisms.md",
  "protocol.md",
  "routing.md",
  "sdk-operations.md",
  "transport-contract.md",
  "transport-sovereignty-authority.md",
  "transport-sovereignty-review.md",
  "transports/loopback.md",
  "verification.md",
];

test("Given the normative design allowlist, when AX0 inspects knowledge structure, then every artifact has one mechanics rationale and consequence section", async () => {
  for (const relative of normativeArtifacts) {
    const source = await readFile(path.join(designRoot, relative), "utf8");
    for (const heading of ["Mechanics", "Rationale", "Consequence"]) {
      const matches = source.match(
        new RegExp(
          heading === "Consequence"
            ? "^#{2,6} Consequence(?: of violation)?$"
            : `^#{2,6} ${heading}$`,
          "gmu",
        ),
      ) ?? [];
      assert.equal(matches.length, 1, `${relative}: ${heading}`);
    }
  }
});
