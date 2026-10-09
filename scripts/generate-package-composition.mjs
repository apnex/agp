import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dependencyKinds = ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"];
const cellText = (value) => String(value).replaceAll("|", "&#124;").replace(/\s+/gu, " ").trim();

/** Read package composition from workspace manifests, never from the documentation view. */
export async function collectPackageComposition(root = repositoryRoot) {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  if (!Array.isArray(manifest.workspaces) || manifest.workspaces.length === 0) {
    throw new Error("Package composition: root workspaces must be a nonempty list");
  }
  const packages = [];
  for (const directory of manifest.workspaces) {
    const source = JSON.parse(await readFile(path.join(root, directory, "package.json"), "utf8"));
    if (!source.name || !source.description) {
      throw new Error(`Package composition: missing name or description in ${directory}`);
    }
    packages.push({
      name: source.name,
      directory,
      description: source.description,
      dependencies: dependencyKinds.flatMap((kind) => Object.keys(source[kind] ?? {})
        .sort().map((name) => ({ name, kind }))),
    });
  }
  packages.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const names = new Set(packages.map(({ name }) => name));
  if (names.size !== packages.length) throw new Error("Package composition: duplicate workspace name");
  for (const entry of packages) {
    for (const dependency of entry.dependencies) {
      if (dependency.name.startsWith("@agp/") && !names.has(dependency.name)) {
        throw new Error(`Package composition: ${entry.name} names absent workspace ${dependency.name}`);
      }
    }
  }
  return packages;
}

/** Generate package responsibility and exact declared dependency tables, including external dependencies. */
export function renderPackageComposition(packages) {
  const names = new Set(packages.map(({ name }) => name));
  const inventory = ["| Workspace package | Manifest responsibility | Internal consumers |", "|---|---|---|"];
  const dependencies = ["| Consumer | Dependency | Declaration | Boundary |", "|---|---|---|---|"];
  for (const entry of packages) {
    const consumers = packages.filter((candidate) => candidate.dependencies.some(({ name }) => name === entry.name));
    inventory.push(`| [\`${entry.name}\`](../${entry.directory}/package.json) | ${cellText(entry.description)} | ${consumers.map(({ name }) => `\`${name}\``).join(", ") || "No workspace consumer"} |`);
    for (const dependency of entry.dependencies) {
      dependencies.push(`| \`${entry.name}\` | \`${dependency.name}\` | \`${dependency.kind}\` | ${names.has(dependency.name) ? "Workspace" : "External"} |`);
    }
  }
  return { inventory: inventory.join("\n"), dependencies: dependencies.join("\n") };
}

/** Replace exactly one bounded generated block; a missing or duplicate marker is an error. */
export function replacePackageCompositionBlock(source, name, body) {
  const begin = `<!-- BEGIN GENERATED: ${name} -->`;
  const end = `<!-- END GENERATED: ${name} -->`;
  if (source.split(begin).length !== 2 || source.split(end).length !== 2) {
    throw new Error(`Package composition: expected exactly one marker pair for ${name}`);
  }
  const start = source.indexOf(begin) + begin.length;
  const finish = source.indexOf(end);
  if (finish < start) throw new Error(`Package composition: reversed markers for ${name}`);
  return `${source.slice(0, start)}\n${body}\n${source.slice(finish)}`;
}

/** Regenerate the architecture's package views, or fail read-only when either view has drifted. */
export async function updatePackageComposition({ root = repositoryRoot, check = false } = {}) {
  const file = path.join(root, "docs/ARCHITECTURE.md");
  const source = await readFile(file, "utf8");
  const rendered = renderPackageComposition(await collectPackageComposition(root));
  const inventory = replacePackageCompositionBlock(source, "workspace-packages", rendered.inventory);
  const next = replacePackageCompositionBlock(inventory, "package-dependencies", rendered.dependencies);
  if (source === next) return;
  if (check) throw new Error("Package composition: architecture is stale; run npm run architecture:generate");
  await writeFile(file, next);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await updatePackageComposition({ check: process.argv.includes("--check") });
}
