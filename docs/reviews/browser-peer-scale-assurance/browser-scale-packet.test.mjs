import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectBrowserScaleReadings } from "./project-browser-scale-readings.mjs";

const read = (path) => readFile(new URL(path, import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalize = (text) => text.replace(/\s+/gu, " ").trim();
const manifest = JSON.parse(await read("browser-scale-input-manifest.json"));
const questions = JSON.parse(await read("browser-scale-questions.json"));
const key = JSON.parse(await read("browser-scale-answer-key.json"));
const sources = Object.fromEntries(await Promise.all(manifest.sources.map(async (source) =>
  [source.id, (await read(source.path)).toString("utf8")])));
const readings = Object.fromEntries(await Promise.all(Object.entries(manifest.arms).map(async ([role, arm]) =>
  [role, (await read(arm.path)).toString("utf8")])));

function assertBrowserScaleCoverage(candidateQuestions, candidateKey) {
  const ids = candidateQuestions.questions.map((q) => q.id);
  assert.deepEqual(ids, ["Q01", "Q02", "Q03", "Q04", "Q05", "Q06", "Q07", "Q08"]);
  assert.deepEqual(candidateKey.entries.map((q) => q.id), ids);
  assert.deepEqual(candidateKey.entries.map((q) => q.role),
    ["control", "control", "control", "control", "scale", "scale", "scale", "scale"]);
  for (const entry of candidateKey.entries) {
    assert.ok(entry.required.length > 0 && entry.wrong.length > 0 && entry.grounding.length > 0);
    assert.deepEqual(Object.keys(entry.byReading).sort(), ["baseline", "candidate"]);
  }
}

function assertBrowserScaleGrounding(candidateKey) {
  for (const entry of candidateKey.entries) {
    for (const role of ["baseline", "candidate"]) {
      for (const excerpt of [...entry.grounding, ...entry.byReading[role].grounding]) {
        assert.ok(normalize(excerpt).length > 0);
        assert.ok(normalize(readings[role]).includes(normalize(excerpt)), `${entry.id}: ${role}: ${excerpt}`);
      }
    }
  }
}

test("Given the prepared packet, when its artifacts are read, then every declared byte count and digest matches", async () => {
  assert.equal(manifest.artifacts.length, 11);
  assert.equal(new Set(manifest.artifacts.map((a) => a.path)).size, 11);
  for (const artifact of manifest.artifacts) {
    const bytes = await read(artifact.path);
    assert.equal(bytes.length, artifact.bytes, artifact.path);
    assert.equal(hash(bytes), artifact.sha256, artifact.path);
  }
});

test("Given source snapshots, when hashed, then each preserves its declared source bytes", async () => {
  assert.equal(manifest.sources.length, 3);
  for (const source of manifest.sources) assert.equal(hash(await read(source.path)), source.sourceSha256);
});

test("Given the source snapshots, when projected, then both readings reproduce exactly", () => {
  assert.deepEqual(projectBrowserScaleReadings(sources.vision, sources.intent, sources.amendment), readings);
});

test("Given the paired readings, when the proposed scale passage is reversed, then all other text is identical", () => {
  const oldScale = "The target scale is small and known: fewer than twenty nodes, in star and line topologies.";
  const proposed = sources.amendment.split("## Proposed direction\n")[1].split("## Authority and scope\n")[0]
    .split("\n").filter((line) => line.startsWith("> ")).map((line) => line.slice(2)).join("\n");
  assert.equal(readings.baseline.split(oldScale).length, 2);
  assert.equal(readings.candidate.split(proposed).length, 2);
  assert.equal(readings.candidate.replace(proposed, oldScale), readings.baseline);
});

test("Given reader material, when checked for provenance, then private labels and amendment administration are absent", () => {
  for (const reading of Object.values(readings)) {
    assert.equal(/\]\([^)]*\)/u.test(reading), false);
    for (const forbidden of ["Browser peer scale intent amendment", "## Operating envelope still to define",
      "## Effect on current work", "Reading role: baseline", "Reading role: candidate",
      "readings/k84", "readings/s17", ...manifest.sources.map((s) => s.sourceSha256)]) {
      assert.equal(reading.includes(forbidden), false, forbidden);
    }
  }
});

test("Given questions and key, when coverage is checked, then eight questions have reading-specific keys and four controls", () => {
  assertBrowserScaleCoverage(questions, key);
});

test("Given key excerpts, when membership is checked, then each belongs to its assigned reading", () => {
  assertBrowserScaleGrounding(key);
});

test("Given a duplicated question identifier, when coverage is checked, then the malformed packet is rejected", () => {
  const changed = structuredClone(questions);
  changed.questions[1].id = changed.questions[0].id;
  assert.notDeepEqual(changed, questions);
  assert.throws(() => assertBrowserScaleCoverage(changed, key));
});

test("Given a missing excerpt, when grounding is checked, then the malformed key is rejected", () => {
  const changed = structuredClone(key);
  changed.entries[0].grounding[0] = "BROWSER SCALE ABSENT QUOTATION";
  assert.notDeepEqual(changed, key);
  assert.throws(() => assertBrowserScaleGrounding(changed));
});

test("Given a removed intent boundary, when projection runs, then it refuses an alternate source range", () => {
  const changed = sources.intent.replace("## 2. Confirmed intent\n", "## Removed intent\n");
  assert.notEqual(changed, sources.intent);
  assert.throws(() => projectBrowserScaleReadings(sources.vision, changed, sources.amendment), /source boundary/u);
});

test("Given a changed input byte, when checked against the source digest, then its identity no longer matches", () => {
  const changed = sources.vision + "changed\n";
  assert.notEqual(changed, sources.vision);
  assert.notEqual(hash(changed), manifest.sources.find((source) => source.id === "vision").sourceSha256);
});

test("Given complete reader material, when measured, then both payloads fit the common bound", async () => {
  const commonBytes = (await read("browser-scale-reader-instructions.md")).length
    + (await read("browser-scale-questions.json")).length;
  for (const reading of Object.values(readings)) {
    assert.ok(Buffer.byteLength(reading) + commonBytes <= manifest.limits.readerPayloadBytes);
  }
  assert.throws(() => projectBrowserScaleReadings("x".repeat(262_145), sources.intent, sources.amendment), /invalid source/u);
});
