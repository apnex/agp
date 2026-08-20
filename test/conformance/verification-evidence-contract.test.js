import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const designRoot = path.join(root, "docs/design/agp-uniform-node");
const sha = "0".repeat(64);
const subgateIds = ["AX1-P", "AX1-T", "AX1-B", "AX1-L", "AX1-D"];

function evidence(gate = "AX0") {
  return {
    schemaVersion: "agp.verification/v1",
    gate,
    status: "PASS",
    claimScope: "agp-artifact",
    axiomEvidence: [{ reference: "A8", scope: "agp-scoped-mechanics" }],
    sourceRevision: "fixture",
    lowerGateDigests: gate === "AX0" ? [] : [sha],
    schemaCatalogDigest: sha,
    commands: ["node --test"],
    testFiles: [{ path: "test/example.test.js", sha256: sha, cases: 1 }],
    deterministicSeeds: [],
    environment: { node: "v24.0.0", platform: "linux", architecture: "x64" },
    startedAt: "2026-07-30T00:00:00.000Z",
    completedAt: "2026-07-30T00:00:01.000Z",
    cleanup: "PASS",
    findings: [],
    subgates: gate === "AX1"
      ? subgateIds.map((id) => ({ id, status: "PASS" }))
      : [],
  };
}

test("Given the verification evidence schemas, when AX0 compiles and probes their closed invariants, then subgates aggregate status and test-path keys are exact", async () => {
  const evidenceSchema = JSON.parse(
    await readFile(path.join(designRoot, "verification-evidence.schema.json"), "utf8"),
  );
  const certificateSchema = JSON.parse(
    await readFile(path.join(designRoot, "artifact-certificate.schema.json"), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(evidenceSchema);
  assert.doesNotThrow(() => ajv.compile(certificateSchema));

  const ax0 = evidence();
  const ax1 = evidence("AX1");
  assert.equal(validate(ax0), true, ajv.errorsText(validate.errors));
  assert.equal(validate(ax1), true, ajv.errorsText(validate.errors));
  assert.deepEqual(ax1.subgates.map(({ id }) => id).sort(), [...subgateIds].sort());

  const failedSubgate = structuredClone(ax1);
  failedSubgate.subgates[0].status = "FAIL";
  assert.equal(validate(failedSubgate), false);

  const illegalSubgate = structuredClone(ax0);
  illegalSubgate.subgates = [{ id: "AX1-P", status: "PASS" }];
  assert.equal(validate(illegalSubgate), false);

  const duplicatePath = structuredClone(ax0);
  duplicatePath.testFiles.push({
    path: duplicatePath.testFiles[0].path,
    sha256: "1".repeat(64),
    cases: 2,
  });
  assert.equal(validate(duplicatePath), true, ajv.errorsText(validate.errors));
  const paths = duplicatePath.testFiles.map(({ path: filePath }) => filePath);
  assert.notEqual(
    new Set(paths).size,
    paths.length,
    "AX0 path-key oracle rejects schema-distinct duplicate paths",
  );
});
