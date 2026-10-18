import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectBrowserScaleReadings } from "./project-browser-scale-readings.mjs";
import { projectScaleJudgeKey } from "./project-browser-scale-judge-key.mjs";

const read = (path) => readFile(new URL(path, import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalize = (text) => text.replace(/\s+/gu, " ").trim();
const manifest = JSON.parse(await read("browser-scale-input-manifest.json"));
const questions = JSON.parse(await read("browser-scale-questions.json"));
const key = JSON.parse(await read("browser-scale-answer-key.json"));
const numericRule = JSON.parse(await read("browser-scale-comparison-rule.json"));
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
  assert.equal(manifest.artifacts.length, 17);
  assert.equal(new Set(manifest.artifacts.map((a) => a.path)).size, 17);
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

function assertScaleJudgeLabels(projected) {
  assert.doesNotMatch(JSON.stringify(projected), /\bbaseline\b|\bcandidate\b|old-scope|new-scope|proposed policy|preferred direction|readings\/(?:k84|s17)/iu);
}

// Checks only invented score fixtures against the declared numeric conditions, not reader outcomes.
function acceptsBrowserScaleScores(baseline, candidate, rule = numericRule) {
  for (const matrix of [baseline, candidate]) {
    assert.deepEqual(Object.keys(matrix).sort(), rule.questionIds);
    for (const id of rule.questionIds) {
      assert.equal(matrix[id].length, rule.readersPerReading);
      for (const score of matrix[id]) assert.ok(rule.scoreDomain.includes(score));
    }
  }
  const sum = (scores) => scores.reduce((total, score) => total + score, 0);
  return rule.questionIds.every((id) =>
    candidate[id].filter((score) => score === rule.candidate.fullScore).length >= rule.candidate.minimumFullScoresPerQuestion
      && candidate[id].every((score) => !rule.candidate.forbiddenScores.includes(score)))
    && rule.nonRegressionQuestions.every((id) => sum(candidate[id]) >= sum(baseline[id]))
    && rule.questionIds.filter((id) => sum(candidate[id]) > sum(baseline[id])).length >= rule.minimumStrictQuestionGains;
}

const scaleScoreFixture = (scores = [2, 2, 2]) =>
  Object.fromEntries(questions.questions.map(({ id }) => [id, [...scores]]));

test("Given the corrected author key, when projected, then both retained judge keys reproduce exactly", async () => {
  for (const role of ["baseline", "candidate"]) {
    assert.deepEqual(projectScaleJudgeKey(key, role), JSON.parse(await read(manifest.judgeKeys[role].path)));
  }
});

test("Given either judge projection, when its fields are compared, then all applicable grading content is retained without private metadata", () => {
  for (const role of ["baseline", "candidate"]) {
    const projected = projectScaleJudgeKey(key, role);
    assert.deepEqual(Object.keys(projected), ["scoring", "rules", "entries"]);
    assert.deepEqual(projected.scoring, key.scoring);
    assert.deepEqual(projected.rules, key.rules);
    assert.equal(projected.entries.length, key.entries.length);
    for (let i = 0; i < key.entries.length; i++) {
      const source = key.entries[i], entry = projected.entries[i];
      assert.deepEqual(Object.keys(entry), ["id", "required", "wrong", "grounding"]);
      assert.equal(entry.id, source.id);
      assert.deepEqual(entry.required, [...source.required, ...source.byReading[role].required]);
      assert.deepEqual(entry.wrong, source.wrong);
      assert.deepEqual(entry.grounding, [...source.grounding, ...source.byReading[role].grounding]);
    }
    assertScaleJudgeLabels(projected);
  }
});

test("Given additional private author metadata, when projecting, then it is omitted and neither source nor projected arrays share mutation", () => {
  const input = structuredClone(key);
  input.privateAuditNote = "baseline candidate PRIVATE AUDIT NOTE";
  input.entries[0].privateAuditNote = input.privateAuditNote;
  const before = structuredClone(input);
  const projected = projectScaleJudgeKey(input, "baseline");
  assert.deepEqual(input, before);
  assert.deepEqual(projected, projectScaleJudgeKey(key, "baseline"));
  projected.rules[0] = "changed projection";
  projected.entries[0].required[0] = "changed requirement";
  assert.deepEqual(input, before);
});

test("Given reintroduced treatment wording, when checking judge text, then each known disclosure is detected", () => {
  const mutations = [
    (input) => { input.rules[0] = "A faithful old-scope answer is not wrong."; },
    (input) => { input.entries[4].wrong[0] = "Grade the baseline's faithful small-scope answer as incorrect because the preferred direction is larger."; },
    (input) => { input.entries[4].wrong[1] = "Treat the candidate target as verified support for every runtime/workload or all large topologies."; },
  ];
  for (const mutate of mutations) {
    const input = structuredClone(key);
    mutate(input);
    assert.notDeepEqual(input, key);
    for (const role of ["baseline", "candidate"]) {
      assert.throws(() => assertScaleJudgeLabels(projectScaleJudgeKey(input, role)));
    }
  }
});

test("Given invalid judge-key inputs, when projecting, then unknown roles, missing branches and duplicated identifiers are refused", () => {
  assert.throws(() => projectScaleJudgeKey(key, "other"), /unknown reading role/u);
  const missing = structuredClone(key);
  delete missing.entries[0].byReading.baseline;
  assert.throws(() => projectScaleJudgeKey(missing, "baseline"), /missing assigned requirements/u);
  const duplicate = structuredClone(key);
  duplicate.entries[1].id = duplicate.entries[0].id;
  assert.throws(() => projectScaleJudgeKey(duplicate, "candidate"), /invalid question identifier/u);
});

test("Given the numeric rule, when compared with the questions, then every duty is protected and the original floor and strict-gain requirements remain", () => {
  const ids = questions.questions.map(({ id }) => id);
  assert.deepEqual(numericRule.questionIds, ids);
  assert.deepEqual(numericRule.nonRegressionQuestions, ids);
  assert.equal(numericRule.readersPerReading, manifest.population.familiesPerReading);
  assert.deepEqual(numericRule.scoreDomain, [0, 1, 2]);
  assert.deepEqual(numericRule.candidate, { fullScore: 2, minimumFullScoresPerQuestion: 2, forbiddenScores: [0] });
  assert.equal(numericRule.minimumStrictQuestionGains, 1);
  assert.equal(numericRule.remainingConditions.length, 2);
});

test("Given the audit's four-regression example, when applying the corrected rule, then it fails while restoring the former control-only scope admits it", () => {
  const baseline = scaleScoreFixture(), candidate = scaleScoreFixture();
  baseline.Q01 = [2, 2, 1];
  for (const id of ["Q05", "Q06", "Q07", "Q08"]) candidate[id] = [2, 2, 1];
  assert.equal(acceptsBrowserScaleScores(baseline, candidate), false);
  const formerScope = structuredClone(numericRule);
  formerScope.nonRegressionQuestions = ["Q01", "Q02", "Q03", "Q04"];
  assert.notDeepEqual(formerScope, numericRule);
  assert.equal(acceptsBrowserScaleScores(baseline, candidate, formerScope), true);
});

test("Given a regression on any one question, when another question gains more, then the aggregate improvement cannot hide the regression", () => {
  for (let i = 0; i < numericRule.questionIds.length; i++) {
    const regressing = numericRule.questionIds[i];
    const improving = numericRule.questionIds[(i + 1) % numericRule.questionIds.length];
    const baseline = scaleScoreFixture(), candidate = scaleScoreFixture();
    candidate[regressing] = [2, 2, 1];
    baseline[improving] = [2, 1, 1];
    assert.equal(acceptsBrowserScaleScores(baseline, candidate), false, regressing);
  }
});

test("Given equal complete scores, when applying the numeric rule, then a tie is not an improvement", () => {
  assert.equal(acceptsBrowserScaleScores(scaleScoreFixture(), scaleScoreFixture()), false);
});

test("Given one strict gain with no regression, when all candidate floors hold, then the numeric conditions can pass", () => {
  const baseline = scaleScoreFixture();
  baseline.Q05 = [2, 2, 1];
  assert.equal(acceptsBrowserScaleScores(baseline, scaleScoreFixture()), true);
});

test("Given improvement elsewhere, when a candidate answer set misses the full-score floor or contains zero, then the numeric conditions fail", () => {
  for (const scores of [[2, 1, 1], [2, 2, 0]]) {
    const baseline = scaleScoreFixture(), candidate = scaleScoreFixture();
    baseline.Q01 = [1, 1, 1];
    baseline.Q02 = [0, 0, 0];
    candidate.Q02 = scores;
    assert.equal(acceptsBrowserScaleScores(baseline, candidate), false);
  }
});

test("Given incomplete or invalid score fixtures, when checking numeric conditions, then they are rejected rather than treated as reader failures", () => {
  const missing = scaleScoreFixture();
  delete missing.Q01;
  assert.throws(() => acceptsBrowserScaleScores(missing, scaleScoreFixture()));
  for (const scores of [[2, 2], [2, 2, 3], [2, 2, NaN], [2, 2, "2"]]) {
    const invalid = scaleScoreFixture();
    invalid.Q01 = scores;
    assert.throws(() => acceptsBrowserScaleScores(scaleScoreFixture(), invalid));
  }
});
