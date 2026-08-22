import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Every tracked markdown file, not one directory of them.
//
// design-link-integrity scans the design set only, so moving VERIFICATION.md
// and GATES.md up to docs/ broke eighteen links and no gate noticed. A link
// checker scoped to a subtree stops being a link checker the moment a document
// leaves that subtree.
function trackedMarkdown() {
  return execFileSync("git", ["ls-files", "*.md"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((line) => line.length > 0)
    .filter((file) => existsSync(path.join(root, file)));
}

function slug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/gu, "")
    .replace(/[`*_~]/gu, "")
    .replace(/[.,:;!?()[\]{}'"\\/|<>@#$%^&+=]/gu, "")
    .replace(/\s/gu, "-");
}

function anchors(source) {
  const found = new Set();
  const seen = new Map();
  for (const line of source.split(/\r?\n/u)) {
    const heading = /^#{1,6}\s+(.+?)\s*$/u.exec(line);
    if (heading === null) continue;
    const base = slug(heading[1]);
    const ordinal = seen.get(base) ?? 0;
    seen.set(base, ordinal + 1);
    found.add(ordinal === 0 ? base : `${base}-${ordinal}`);
  }
  return found;
}

test("Given every tracked markdown file, when its local links are resolved, then each target file exists", async () => {
  const broken = [];
  for (const file of trackedMarkdown()) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const match of source.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/gu)) {
      const reference = match[1];
      if (/^(?:https?:|mailto:)/u.test(reference)) continue;
      const target = path.normalize(
        path.join(path.dirname(path.join(root, file)), reference),
      );
      if (!existsSync(target)) broken.push(`${file} -> ${reference}`);
    }
  }
  assert.deepEqual(broken, [], `these links resolve to nothing:\n${broken.join("\n")}`);
});

test("Given every tracked markdown file, when a link names an anchor, then the target heading exists", async () => {
  const cache = new Map();
  const broken = [];
  for (const file of trackedMarkdown()) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const match of source.matchAll(/\]\(([^)\s#]*)(#[^)\s]+)\)/gu)) {
      const [, reference, fragment] = match;
      if (/^(?:https?:|mailto:)/u.test(reference)) continue;
      const target = reference.length === 0
        ? path.join(root, file)
        : path.normalize(path.join(path.dirname(path.join(root, file)), reference));
      if (!target.endsWith(".md") || !existsSync(target)) continue;
      if (!cache.has(target)) {
        cache.set(target, anchors(await readFile(target, "utf8")));
      }
      if (!cache.get(target).has(fragment.slice(1))) {
        broken.push(`${file} -> ${reference}${fragment}`);
      }
    }
  }
  assert.deepEqual(broken, [], `these anchors do not exist:\n${broken.join("\n")}`);
});
