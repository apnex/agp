import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design");

// A contract states what must be true. Its consequence section states the fault
// that becomes possible when it is not, which is the part a later reader needs
// in order to reject a plausible-looking shortcut. An empty or purely
// self-referential consequence is a triad that satisfies its own shape check
// and carries no knowledge.
const MINIMUM_FAULTS = 3;
const MINIMUM_WORDS = 20;

// Index and authority documents describe one concern, so one stated fault is
// the honest count rather than a padded list.
const SINGLE_FAULT_ARTIFACTS = new Set([
  "axioms.md",
  "mechanisms.md",
  "transport-sovereignty-authority.md",
  "transport-sovereignty-review.md",
]);

async function designDocuments(directory = designRoot, found = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await designDocuments(candidate, found);
    else if (entry.isFile() && entry.name.endsWith(".md")) found.push(candidate);
  }
  return found;
}

// The document-level triad is the last one in the file, so a per-decision
// consequence inside a register cannot be mistaken for it.
function consequenceSection(source) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findLastIndex((line) =>
    /^#{2,6} Consequence(?: of violation)?$/u.test(line)
  );
  if (start === -1) return undefined;
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/u.test(line)) break;
    body.push(line);
  }
  return body.join("\n").trim();
}

test("Given every design contract, when AX0 reads its consequence section, then the section names concrete faults rather than restating the rule", async () => {
  const documents = (await designDocuments()).sort();
  assert.ok(documents.length > 0, "no design documents found");

  const failures = [];
  for (const file of documents) {
    const relative = path.relative(designRoot, file);
    const body = consequenceSection(await readFile(file, "utf8"));

    if (body === undefined || body.length === 0) {
      failures.push(`${relative}: no consequence section`);
      continue;
    }
    const words = body.split(/\s+/u).filter(Boolean).length;
    if (words < MINIMUM_WORDS) {
      failures.push(`${relative}: consequence is ${words} words, needs ${MINIMUM_WORDS}`);
    }
    if (SINGLE_FAULT_ARTIFACTS.has(relative)) continue;

    const faults = body.split(/\r?\n/u).filter((line) => /^-\s+\S/u.test(line));
    if (faults.length < MINIMUM_FAULTS) {
      failures.push(
        `${relative}: ${faults.length} enumerated fault(s), needs ${MINIMUM_FAULTS}`,
      );
    }
  }

  assert.deepEqual(
    failures,
    [],
    `consequence sections must carry knowledge:\n${failures.join("\n")}`,
  );
});
