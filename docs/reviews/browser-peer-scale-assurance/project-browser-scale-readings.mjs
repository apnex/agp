const priorScale = "The target scale is small and known: fewer than twenty nodes, in star and line topologies.";

/** Projects browser scale intent readings without files, agents, scoring or network access. */
export function projectBrowserScaleReadings(vision, intent, amendment) {
  for (const [name, source] of [["vision", vision], ["intent", intent], ["amendment", amendment]]) {
    if (typeof source !== "string" || Buffer.byteLength(source) > 262_144) {
      throw new Error(`Browser scale projection invalid source: ${name}`);
    }
  }
  if (!vision.startsWith("# Agent Gateway Protocol - Vision\n")
    || !intent.startsWith("## 2. Confirmed intent\n")
    || intent.includes("## 3. Decision records\n")) {
    throw new Error("Browser scale projection unexpected source boundary");
  }
  if (intent.split(priorScale).length !== 2) {
    throw new Error("Browser scale projection requires exactly one prior scale sentence");
  }
  const start = "## Proposed direction\n";
  const end = "## Authority and scope\n";
  if (amendment.split(start).length !== 2 || amendment.split(end).length !== 2) {
    throw new Error("Browser scale projection ambiguous amendment section");
  }
  const from = amendment.indexOf(start) + start.length;
  const to = amendment.indexOf(end);
  if (to <= from) throw new Error("Browser scale projection reversed amendment section");
  const quoted = amendment.slice(from, to).split("\n").filter((line) => line.startsWith("> "));
  if (quoted.length !== 4) throw new Error("Browser scale projection expected four proposed sentences");
  const replacement = quoted.map((line) => line.slice(2)).join("\n");
  if (replacement.includes(priorScale)) throw new Error("Browser scale projection unchanged scale passage");

  const cover = [
    "# AGP intent reading",
    "",
    "Use the supplied text as the intent to interpret for this exercise.",
    "This reading is not an adoption record or evidence of current implementation.",
    "Only the text below is supplied; reference labels do not provide access to other documents.",
    "",
    "---",
    "",
  ].join("\n");
  const renderReferences = (text) => text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/gu, "$1");
  const prefix = cover + renderReferences(vision).trimEnd() + "\n\n---\n\n";
  const baseline = prefix + renderReferences(intent).trimEnd() + "\n";
  const candidate = prefix + renderReferences(intent.replace(priorScale, replacement)).trimEnd() + "\n";
  for (const reading of [baseline, candidate]) {
    if (Buffer.byteLength(reading) > 65_536) throw new Error("Browser scale projection exceeds reading limit");
  }
  return Object.freeze({ baseline, candidate });
}
