import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design/agp-uniform-node");

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

test("Given the ratified intent graph, when AX0 validates it, then every U1-U15 and D1-D17 record has authorized and resolvable ownership", async () => {
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
    ...Array.from({ length: 17 }, (_, index) => `D${index + 1}`),
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
    assert.equal(record.owningTests.length > 0, true, record.requirementId);
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
