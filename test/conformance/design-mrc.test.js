import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design");

// Repository-relative artifacts that are normative but live outside the design
// set. A document that states rules a script enforces owes the same
// mechanics/rationale/consequence triad as a protocol contract.
const normativeElsewhere = [
  "docs/TESTING.md",
  "docs/DECISIONS.md",
  "docs/VERIFICATION.md",
  "docs/GATES.md",
  "docs/BOARD.md",
  "VISION.md",
];

const normativeArtifacts = [
  "README.md",
  "axioms.md",
  "binding-websocket.md",
  "contracts.md",
  "fsm.md",
  "mechanisms.md",
  "protocol.md",
  "routing.md",
  "sdk.md",
  "operations.md",
  "transport-contract.md",
  "transport-sovereignty-authority.md",
  "transport-loopback.md",
];

function triadCount(source, heading) {
  return (source.match(
    new RegExp(
      heading === "Consequence"
        ? "^#{2,6} Consequence(?: of violation)?$"
        : `^#{2,6} ${heading}$`,
      "gmu",
    ),
  ) ?? []).length;
}

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

test("Given normative documents outside the design set, when AX0 inspects knowledge structure, then each one carries the same mechanics rationale and consequence triad", async () => {
  for (const relative of normativeElsewhere) {
    const source = await readFile(path.join(root, relative), "utf8");
    for (const heading of ["Mechanics", "Rationale", "Consequence"]) {
      assert.equal(triadCount(source, heading), 1, `${relative}: ${heading}`);
    }
  }
});
