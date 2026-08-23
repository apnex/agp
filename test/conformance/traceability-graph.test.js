import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design");

function headingSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/gu, "")
    .replace(/[`*_~]/gu, "")
    .replace(/[–—]/gu, "")
    .replace(/[.,:;!?()[\]{}'"\\/|<>@#$%^&+=]/gu, "")
    .replace(/\s/gu, "-");
}

async function headingAnchors(file) {
  const anchors = new Set();
  const occurrences = new Map();
  for (const line of (await readFile(file, "utf8")).split(/\r?\n/gu)) {
    const match = /^#{1,6}\s+(.+?)\s*$/u.exec(line);
    if (!match) continue;
    const base = headingSlug(match[1]);
    const ordinal = occurrences.get(base) ?? 0;
    occurrences.set(base, ordinal + 1);
    anchors.add(ordinal === 0 ? base : `${base}-${ordinal}`);
  }
  return anchors;
}

/**
 * The decisions the record actually carries, read from the record.
 *
 * This set used to be a literal. It was written when there were seventeen
 * decisions, and by the time anyone looked there were nineteen: `D18` and
 * `D19` were ratified, built and gated while remaining absent from the graph
 * this gate seals. A constant cannot detect drift away from itself, so a gate
 * whose expected set is a constant is a gate against nothing.
 */
async function ratifiedDecisionIds(file) {
  const source = await readFile(file, "utf8");
  const ids = [...source.matchAll(/^###\s+(D\d+)\s+-\s+/gmu)]
    .map((match) => match[1]);
  assert.ok(ids.length > 0, "the decision record must declare decisions");
  assert.equal(new Set(ids).size, ids.length, "decision ids must be unique");
  return ids;
}

test("Given the ratified intent graph, when AX0 validates it, then every U record and every decision the record declares has authorized and resolvable ownership", async () => {
  const trace = JSON.parse(
    await readFile(path.join(designRoot, "traceability.json"), "utf8"),
  );
  const schema = JSON.parse(
    await readFile(path.join(designRoot, "traceability.schema.json"), "utf8"),
  );
  const rules = JSON.parse(
    await readFile(path.join(root, "schemas/agp-v1.semantic-rules.json"), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });

  assert.equal(
    ajv.validate(schema, trace),
    true,
    ajv.errorsText(ajv.errors),
  );
  const expected = [
    ...Array.from({ length: 15 }, (_, index) => `U${index + 1}`),
    ...await ratifiedDecisionIds(path.join(root, "docs/DECISIONS.md")),
  ];
  const actual = trace.records.map(({ requirementId }) => requirementId);
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual([...actual].sort(), [...expected].sort());
  assert.ok(
    trace.records.every(({ ratificationStatus }) =>
      ratificationStatus === "required" || ratificationStatus === "ratified"),
  );

  const knownRules = new Set(rules.rules.map(({ id }) => id));
  const referencedRules = new Set();
  const anchorCache = new Map();
  for (const record of trace.records) {
    // A decision may be ratified before it is built, and the corpus treats
    // that as a legitimate state: `B12` is triggered by exactly it. Requiring
    // an owning test of every decision conflated deciding with building, and
    // made a ratified but unbuilt decision impossible to write down. Build
    // state is its own axis, and a built record still owes its tests.
    if (record.implementation === "built") {
      assert.equal(record.owningTests.length > 0, true, record.requirementId);
    } else {
      assert.equal(
        record.designReferences.length > 0,
        true,
        `${record.requirementId}: a planned decision must name its design`,
      );
    }
    assert.match(record.owningGate, /^AX[0-8]$/u);
    for (const ruleId of record.semanticRuleIds) {
      assert.equal(knownRules.has(ruleId), true, `${record.requirementId}:${ruleId}`);
      referencedRules.add(ruleId);
    }
    for (const reference of record.designReferences) {
      const [relative, anchor] = reference.split("#");
      const target = path.join(designRoot, relative);
      assert.equal(existsSync(target), true, `${record.requirementId}:${reference}`);
      if (!anchor) continue;
      let anchors = anchorCache.get(target);
      if (!anchors) {
        anchors = await headingAnchors(target);
        anchorCache.set(target, anchors);
      }
      assert.equal(anchors.has(anchor), true, `${record.requirementId}:${reference}`);
    }
    for (const relative of [
      ...record.owningTests,
      ...record.integrationWitnesses,
    ]) {
      assert.equal(
        existsSync(path.join(root, relative)),
        true,
        `${record.requirementId}:${relative}`,
      );
    }
  }
  assert.deepEqual(
    [...referencedRules].sort(),
    [...knownRules].sort(),
    "every registered semantic rule must be trace-owned",
  );
});
