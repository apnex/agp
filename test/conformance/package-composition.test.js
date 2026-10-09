import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  collectPackageComposition, replacePackageCompositionBlock, updatePackageComposition,
} from "../../scripts/generate-package-composition.mjs";

async function fixture(context) {
  const root = await mkdtemp(path.join(tmpdir(), "agp-package-composition-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const save = async (file, value) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value));
  };
  await save("package.json", { workspaces: ["packages/b", "packages/a"] });
  await save("packages/a/package.json", { name: "@agp/a", description: "First responsibility" });
  await save("packages/b/package.json", {
    name: "@agp/b", description: "Second responsibility", dependencies: { "@agp/a": "*" },
  });
  await save("docs/ARCHITECTURE.md", "Authored before\n"
    + "<!-- BEGIN GENERATED: workspace-packages -->\n<!-- END GENERATED: workspace-packages -->\n"
    + "Authored between\n"
    + "<!-- BEGIN GENERATED: package-dependencies -->\n<!-- END GENERATED: package-dependencies -->\n"
    + "Authored after\n");
  return { root, save, read: () => readFile(path.join(root, "docs/ARCHITECTURE.md"), "utf8") };
}

test("Given the real workspace manifests, when generated architecture views are checked, then their complete contents are current", async () => {
  await updatePackageComposition({ check: true });
});

test("Given generated package views, when a manifest or the view drifts, then the read-only check fails until regeneration", async (context) => {
  const { root, save, read } = await fixture(context);
  await assert.rejects(updatePackageComposition({ root, check: true }), /stale/u);
  await updatePackageComposition({ root });
  await updatePackageComposition({ root, check: true });
  await save("packages/b/package.json", {
    name: "@agp/b", description: "New | responsibility",
    dependencies: { "@agp/a": "*", ws: "*" },
    devDependencies: { typescript: "*" }, optionalDependencies: { ajv: "*" }, peerDependencies: { peer: "*" },
  });
  const before = await read();
  await assert.rejects(updatePackageComposition({ root, check: true }), /stale/u);
  assert.equal(await read(), before, "checking must not repair its own evidence");
  await updatePackageComposition({ root });
  const after = await read();
  assert.match(after, /New &#124; responsibility/u);
  for (const kind of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    assert.ok(after.includes(`\`${kind}\``));
  }
  assert.match(after, /`@agp\/b` \| `ws` \| `dependencies` \| External/u);
  assert.match(after, /^Authored before[\s\S]*Authored between[\s\S]*Authored after\n$/u);
  await save("docs/ARCHITECTURE.md", after.replace("New &#124; responsibility", "hand edited"));
  await assert.rejects(updatePackageComposition({ root, check: true }), /stale/u);
  await updatePackageComposition({ root });
  assert.equal(await read(), after);
});

test("Given ambiguous generation boundaries, when replacement is attempted, then missing duplicate or reversed markers fail", () => {
  const begin = "<!-- BEGIN GENERATED: sample -->";
  const end = "<!-- END GENERATED: sample -->";
  for (const source of ["", begin, end, begin + begin + end, begin + end + end, end + begin]) {
    assert.throws(() => replacePackageCompositionBlock(source, "sample", "new"), /markers?|marker pair/u);
  }
});

test("Given a workspace graph, when a declaration loses its owner or duplicates a name, then collection fails explicitly", async (context) => {
  const { root, save } = await fixture(context);
  await save("packages/b/package.json", {
    name: "@agp/b", description: "consumer", dependencies: { "@agp/missing": "*" },
  });
  await assert.rejects(collectPackageComposition(root), /absent workspace/u);
  await save("packages/b/package.json", { name: "@agp/a", description: "duplicate" });
  await assert.rejects(collectPackageComposition(root), /duplicate workspace/u);
});
