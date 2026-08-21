import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design");

function slug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/gu, "")
    .replace(/[`*_~]/gu, "")
    .replace(/[–—]/gu, "")
    .replace(/[.,:;!?()[\]{}'"\\/|<>@#$%^&+=]/gu, "")
    .replace(/\s/gu, "-");
}

function anchors(source) {
  const result = new Set();
  const occurrences = new Map();
  for (const line of source.split(/\r?\n/gu)) {
    const match = /^#{1,6}\s+(.+?)\s*$/u.exec(line);
    if (!match) continue;
    const base = slug(match[1]);
    const ordinal = occurrences.get(base) ?? 0;
    occurrences.set(base, ordinal + 1);
    result.add(ordinal === 0 ? base : `${base}-${ordinal}`);
  }
  return result;
}

async function markdownFiles(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) await markdownFiles(candidate, output);
    else if (entry.isFile() && entry.name.endsWith(".md")) output.push(candidate);
  }
  return output;
}

test("Given normative Markdown and trace references, when AX0 resolves local targets, then every file and named anchor exists exactly", async () => {
  const files = (await markdownFiles(designRoot)).sort();
  const documents = new Map();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    documents.set(file, { source, anchors: anchors(source) });
  }

  for (const file of files) {
    const { source } = documents.get(file);
    for (const match of source.matchAll(/\[[^\n]*?\]\(([^)\n]+)\)/gu)) {
      const reference = match[1].trim().replace(/^<|>$/gu, "");
      if (/^(?:https?:|mailto:|#)/u.test(reference)) continue;
      const [relative, anchor] = reference.split("#");
      const target = path.normalize(path.join(path.dirname(file), relative));
      assert.equal(existsSync(target), true, `${file}: ${reference}`);
      // A design document may cite a project-level document outside the design
      // set, so resolve those on demand rather than only from the preloaded map.
      if (anchor && target.endsWith(".md")) {
        if (!documents.has(target)) {
          const source = await readFile(target, "utf8");
          documents.set(target, { source, anchors: anchors(source) });
        }
        assert.equal(
          documents.get(target)?.anchors.has(anchor),
          true,
          `${file}: ${reference}`,
        );
      }
    }
  }

  const trace = JSON.parse(
    await readFile(path.join(designRoot, "traceability.json"), "utf8"),
  );
  for (const record of trace.records) {
    for (const reference of record.designReferences) {
      const [relative, anchor] = reference.split("#");
      const target = path.join(designRoot, relative);
      assert.equal(existsSync(target), true, `${record.requirementId}:${reference}`);
      if (anchor) {
        assert.equal(
          documents.get(target)?.anchors.has(anchor),
          true,
          `${record.requirementId}:${reference}`,
        );
      }
    }
  }
});
