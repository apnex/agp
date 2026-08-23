import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Owns: that a design document listing a schema directory lists what is
// actually there.
//
// These listings are how a reader learns what contracts exist, and they are
// maintained by hand. Nothing else checks them: the catalog gate proves every
// schema is registered and digested, the trace graph proves every schema a
// requirement cites resolves, and both pass while a prose listing names a file
// that was deleted three commits ago.
//
// It happened. `contracts.md` listed `error-message.schema.json` after the
// error message was retired, and omitted the four schemas that replaced it,
// through a full green suite. A listing that is wrong is worse than absent,
// because a reader has no reason to doubt it.

const LISTINGS = [
  {
    document: "docs/design/contracts.md",
    directory: "packages/protocol/src/schemas/v1/wire",
    heading: "wire/",
  },
  {
    document: "docs/design/contracts.md",
    directory: "packages/core/src/schemas/v1/configuration",
    heading: "configuration/",
  },
  {
    document: "docs/design/sdk.md",
    directory: "packages/core/src/schemas/v1/sdk",
    heading: "packages/core/src/schemas/v1/sdk/",
  },
];

/**
 * The schema filenames a fenced listing names under one heading.
 *
 * Anchored on the fence, because a bare directory name also appears nested
 * inside other packages' listings and matching the first one found reads the
 * wrong block.
 */
function listedUnder(text, heading) {
  const anchor = `\`\`\`text\n${heading}\n`;
  const start = text.indexOf(anchor);
  if (start === -1) return undefined;
  const names = [];
  for (const line of text.slice(start + anchor.length).split("\n")) {
    const match = /^\s{2,}(\S+\.schema\.json)\s*$/u.exec(line);
    if (match === null) break;
    names.push(match[1]);
  }
  return names;
}

test("Given a design document that lists a schema directory, when the directory is read, then the listing names exactly what is there", async () => {
  for (const { document, directory, heading } of LISTINGS) {
    const text = await readFile(path.join(root, document), "utf8");
    const listed = listedUnder(text, heading);
    assert.notEqual(
      listed,
      undefined,
      `${document} has no listing under ${heading}`,
    );
    assert.ok(
      listed.length > 0,
      `${document} lists nothing under ${heading}`,
    );

    const present = (await readdir(path.join(root, directory)))
      .filter((name) => name.endsWith(".schema.json"));

    const missing = present.filter((name) => !listed.includes(name)).sort();
    const stale = listed.filter((name) => !present.includes(name)).sort();

    assert.deepEqual(
      { missing, stale },
      { missing: [], stale: [] },
      `${document} under ${heading} disagrees with ${directory}`,
    );
  }
});
