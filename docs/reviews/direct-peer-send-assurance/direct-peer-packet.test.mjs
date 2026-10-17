import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectDirectPeerReadings } from "./project-direct-peer-readings.mjs";

const root = new URL("./", import.meta.url);
const read = (relative) => readFile(new URL(relative, root));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalize = (text) => text.replace(/\s+/gu, " ").trim();
const manifest = JSON.parse(await read("direct-peer-input-manifest.json"));
const questions = JSON.parse(await read("direct-peer-questions.json"));
const key = JSON.parse(await read("direct-peer-answer-key.json"));
const contract = (await read("sources/direct-peer-contract.txt")).toString("utf8");
const adoption = (await read("sources/direct-peer-adoption.txt")).toString("utf8");
const readings = {
  baseline: (await read(manifest.arms.baseline.path)).toString("utf8"),
  candidate: (await read(manifest.arms.candidate.path)).toString("utf8"),
};

function assertQuestionKeyCoverage(questionRecord, keyRecord) {
  const ids = questionRecord.questions.map((question) => question.id);
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(keyRecord.entries.map((entry) => entry.id), ids);
  assert.equal(keyRecord.entries.filter((entry) => entry.role === "control").length, 8);
  assert.equal(keyRecord.entries.filter((entry) => entry.role === "integration").length, 4);
  for (const entry of keyRecord.entries) {
    assert.ok(entry.required.length > 0, entry.id);
    assert.ok(entry.wrong.length > 0, entry.id);
    assert.ok(entry.grounding.shared.length > 0, entry.id);
  }
}

function assertGroundingMembership(keyRecord, assignedReadings) {
  for (const entry of keyRecord.entries) {
    for (const quote of entry.grounding.shared) {
      for (const role of ["baseline", "candidate"]) {
        assert.ok(normalize(assignedReadings[role]).includes(normalize(quote)),
          `${entry.id} shared quote missing from ${role}: ${quote}`);
      }
    }
    for (const quote of entry.grounding.integration ?? []) {
      assert.ok(normalize(assignedReadings.candidate).includes(normalize(quote)),
        `${entry.id} integration quote missing: ${quote}`);
    }
  }
}

test("Given the frozen packet, every listed artifact has its declared bytes and hash", async () => {
  assert.ok(manifest.artifacts.length >= 9);
  const paths = manifest.artifacts.map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const entry of manifest.artifacts) {
    const bytes = await read(entry.path);
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
});

test("Given full source snapshots, their measured original hashes are retained", async () => {
  assert.equal(manifest.sources.length, 2);
  for (const source of manifest.sources) {
    assert.equal(sha256(await read(source.path)), source.originalSha256);
  }
});

test("Given the sources, both generated reading sets reproduce exactly", () => {
  const projected = projectDirectPeerReadings(contract, adoption);
  assert.deepEqual(projected, readings);
  assert.deepEqual(projectDirectPeerReadings(contract, adoption), projected);
});

test("Given the candidate reading, its whole contract prefix equals the baseline", () => {
  assert.ok(readings.candidate.startsWith(readings.baseline));
  assert.ok(readings.candidate.length > readings.baseline.length);
  assert.equal(readings.candidate.slice(0, readings.baseline.length), readings.baseline);
});

test("Given reader material, experimental protocol and provenance are withheld", () => {
  for (const reading of Object.values(readings)) {
    for (const forbidden of [
      "Prepare one bounded comparison of the adoption guidance",
      "Required preparation:",
      "## 7. Evidence and closeout",
      "## 1. Authority and current state",
      "before independent key audit",
      manifest.sources[0].originalSha256,
      manifest.sources[1].originalSha256,
    ]) assert.equal(reading.includes(forbidden), false, forbidden);
    assert.equal(/\]\([^)]*\)/u.test(reading), false);
  }
  assert.ok(readings.candidate.includes("## 5. Remaining documentation assurance"));
  assert.ok(readings.candidate.includes("fresh-reader assurance remains before ratification"));
});

test("Given questions and key, every question has one prospective key and coverage role", () => {
  assertQuestionKeyCoverage(questions, key);
});

test("Given grounding excerpts, each occurs in its declared reading set", () => {
  assertGroundingMembership(key, readings);
});

test("Given a duplicate question identifier, coverage validation fails", () => {
  const changed = structuredClone(questions);
  changed.questions[1].id = changed.questions[0].id;
  assert.notDeepEqual(changed, questions);
  assert.throws(() => assertQuestionKeyCoverage(changed, key));
});

test("Given an absent grounding excerpt, the membership check fails without editing inputs", () => {
  const changed = structuredClone(key);
  changed.entries[0].grounding.shared[0] = "DIRECT PEER PACKET DELIBERATELY ABSENT QUOTATION";
  assert.notDeepEqual(changed, key);
  assert.throws(() => assertGroundingMembership(changed, readings));
});

test("Given a removed source boundary, projection refuses to silently select another range", () => {
  const changed = contract.replace("## 2. Guarantee and ownership\n", "## Removed boundary\n");
  assert.notEqual(changed, contract);
  assert.throws(() => projectDirectPeerReadings(changed, adoption), /ambiguous start/u);
});

test("Given a changed artifact byte, its frozen digest no longer matches", () => {
  const changed = contract + "changed\n";
  assert.notEqual(changed, contract);
  assert.notEqual(sha256(changed), manifest.sources[0].originalSha256);
});

test("Given the complete reader payload, both readings fit the declared common bound", async () => {
  const commonBytes = (await read("direct-peer-reader-instructions.md")).length
    + (await read("direct-peer-questions.json")).length;
  for (const reading of Object.values(readings)) {
    assert.ok(Buffer.byteLength(reading) + commonBytes <= manifest.limits.readerPayloadBytes);
  }
  assert.throws(() => projectDirectPeerReadings("x".repeat(65_537), adoption),
    /invalid source/u);
});
