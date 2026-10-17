import path from "node:path";

/** Projects direct peer reading sets; no files, agents or network are accessed. */
export function projectDirectPeerReadings(design, adoption) {
  const limit = 65_536;
  for (const [name, text] of [["design", design], ["adoption", adoption]]) {
    if (typeof text !== "string" || Buffer.byteLength(text) > limit) {
      throw new Error(`Direct peer projection invalid source: ${name}`);
    }
  }
  const common = [
    "# Direct peer send reading",
    "",
    "This reading describes proposed AGP behavior, not implemented behavior.",
    "For this exercise, technical and scoped axiom review of the contract is complete; ratification, implementation and fresh-reader documentation assurance are not.",
    "Statements requesting that completed technical review are historical; all other adoption and implementation obligations remain proposals.",
    "Use only this reading: visible file locations identify integration sites, not permission or a requirement to open files.",
    "Where present, [MEASURED] marks a source observation, [ARGUED] a recommendation and [OPEN] an unresolved obligation.",
    "",
    "---",
    "",
  ].join("\n");
  let contract = sliceBetween(design, "## 2. Guarantee and ownership\n", null);
  contract = replaceOnce(contract,
    "Zorg agrees to these names and shapes under `D61`; they remain proposals pending AGP design review.\\",
    "Zorg agrees to these names and shapes under `D61`; they remain proposals.\\");
  const gateStart = "Before implementation selection:\n";
  const gateEnd = "The product's [ratified applicability map]";
  const gates = sliceBetween(contract, gateStart, gateEnd);
  const preservedGate = gates.split("\n").find((line) => line.startsWith("4. Record the AGP decision,"));
  if (preservedGate === undefined) throw new Error("Direct peer projection missing implementation gate");
  contract = replaceOnce(contract, gates, "Before implementation selection:\n\n" + preservedGate.slice(3) + "\n\n");
  const nextMove = "The present next move is AGP design and axiom review of the reconciled `B51` contract; Zorg's public-shape and lifecycle-obligation agreements are recorded.\\\n";
  contract = replaceOnce(contract, nextMove, "");
  contract = renderReferences(contract, "agp/docs/design/direct-peer-send.md");

  let integration = sliceBetween(adoption, "## 1. Proposed ruling and limits\n", "## 7. Evidence and closeout\n");
  const assuranceStart = "## 5. Remaining documentation assurance\n";
  const assuranceEnd = "## 6. Alternatives and costs\n";
  const assurance = sliceBetween(integration, assuranceStart, assuranceEnd);
  const retainedAssurance = assurance.slice(0, assurance.indexOf("\n\n[ARGUED] Prepare one bounded comparison"));
  if (!retainedAssurance.includes("before ratification")) {
    throw new Error("Direct peer projection missing assurance prerequisite");
  }
  integration = replaceOnce(integration, assurance, retainedAssurance + "\n\n---\n\n");
  const consequence = sliceBetween(adoption, "### Mechanics rationale and consequence\n", null);
  integration += consequence;
  integration = renderReferences(integration, "agp/docs/reviews/direct-peer-send-adoption.md");

  const baseline = common + contract;
  const candidate = baseline + "\n---\n\n# Integration guidance\n\n" + integration;
  for (const text of [baseline, candidate]) {
    if (Buffer.byteLength(text) > limit) throw new Error("Direct peer projection exceeds reading limit");
  }
  return Object.freeze({ baseline, candidate });
}

function sliceBetween(text, start, end) {
  const from = text.indexOf(start);
  if (from < 0 || text.indexOf(start, from + start.length) !== -1) {
    throw new Error(`Direct peer projection ambiguous start: ${start.trim()}`);
  }
  if (end === null) return text.slice(from);
  const to = text.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`Direct peer projection missing end: ${end.trim()}`);
  return text.slice(from, to);
}

function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) {
    throw new Error("Direct peer projection replacement is not unique");
  }
  return text.replace(before, after);
}

function renderReferences(text, sourcePath) {
  return text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/gu, (_match, label, target) => {
    const [file, fragment] = target.split("#");
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), file));
    const display = resolved.startsWith("agp/") ? resolved.slice(4) : resolved;
    return label + " (reference: `" + display + (fragment ? "#" + fragment : "") + "`)";
  });
}
