// Verify admission packet delivery using context-lab's public API without invoking a model.
// Usage: node verify-admission-packet.mjs /path/to/pinned/context-lab
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertAdmissionInputIdentity } from './check-admission-input.mjs';

const packDir = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(packDir, file), 'utf8'));
const manifest = readJson('admission-input-manifest.json');
const coverage = readJson('admission-assurance-coverage.json');
const coreRoot = path.resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], 'Admission packet check requires the pinned context-lab repository');
assert.equal(execFileSync('git', ['-C', coreRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), manifest.evaluatorSource);
assert.equal(execFileSync('git', ['-C', coreRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Evaluator source is not clean');
const { checkPack, judgeAll, promptFor } = await import(pathToFileURL(path.join(coreRoot, 'packages/core/dist/src/index.js')).href);
const checked = await checkPack(packDir);
assert.ok(checked.ok, JSON.stringify(checked.defects));
const { loaded } = checked;
const { experiment, scenarios: entries } = loaded.experiments.get('admission-clarity');
const scenarios = new Map([...entries].map(([id, entry]) => [id, entry.scenario]));
const scenario = scenarios.get('admission-clarity');
const headings = scenario.properties.map((p) => p.answerHeading);
assert.equal(headings.length, 24);
assert.equal(new Set(headings).size, 24);
assert.deepEqual(coverage.controls, manifest.controls);
assert.deepEqual(coverage.clarifications, manifest.clarifications);
assert.equal(coverage.controls.length, 15);
assert.equal(coverage.clarifications.length, 9);
assert.deepEqual([...coverage.controls, ...coverage.clarifications].sort(), [...headings].sort());
assert.deepEqual(scenario.properties.map((p) => p.id), headings.map((h) => h.toLowerCase()));
for (const property of scenario.properties) {
  assert.ok(scenario.task.includes('### ' + property.answerHeading + '\n' + property.question + '\n'));
  assert.ok(property.key.startsWith('Required decisions: R1.'));
  assert.ok(property.key.includes('R2.'));
  assert.deepEqual(property.scale, [0, 2]);
}
for (const input of manifest.inputs) {
  const source = fs.readFileSync(path.join(packDir, input.sourceFile), 'utf8');
  const reader = fs.readFileSync(path.join(packDir, input.readerFile), 'utf8');
  assertAdmissionInputIdentity(source, reader, input);
  assert.doesNotMatch(reader, /\b(?:m42|x19|revision [34]|fresh-reader assurance FAIL|technical PASS)\b|https?:\/\/|[a-f0-9]{40}/i);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-admission-clarity-preview.'));
const readerPrompts = [];
for (const arm of loaded.pack.arms) {
  assert.equal(arm.deliver.length, 1, 'Admission reader must receive exactly one design');
  assert.deepEqual(arm.deliver[0], { variant: arm.id, file: 'DESIGN.md', as: 'instruction' });
  const variant = loaded.pack.variants.find((entry) => entry.id === arm.id);
  const source = loaded.pack.sources.find((entry) => entry.id === variant.source);
  assert.equal(source.path, 'inputs/' + arm.id);
  assert.deepEqual(fs.readdirSync(path.join(packDir, source.path)), ['DESIGN.md']);
  const prompt = promptFor(experiment, scenario, { onRequest: [] }, '/preview-answer-workspace');
  for (const property of scenario.properties) {
    assert.ok(prompt.includes(property.question));
    assert.ok(!prompt.includes(property.key) && !prompt.includes(property.notes));
  }
  assert.doesNotMatch(prompt, /linen-orbit-7263|\b(?:m42|x19|candidate|predecessor)\b|revision [34]/i);
  assert.ok(!prompt.includes('{WORKSPACE}'));
  fs.writeFileSync(path.join(work, 'reader-prompt-' + arm.id + '.txt'), prompt);
  readerPrompts.push(prompt);
}
assert.equal(readerPrompts.length, 2);
assert.equal(readerPrompts[0], readerPrompts[1], 'Reader questions/instructions must be identical');
const units = [];
for (const arm of experiment.factors.arms) {
  for (const member of loaded.pack.population) {
    for (const property of scenario.properties) {
      units.push({
        id: 'preview-' + (units.length + 1), cell: 'preview-' + arm + '-' + member.id,
        scenario: scenario.id, arm, member: member.id, family: member.family,
        properties: [property.id], phase: 'answer',
        text: '--- ANSWER ---\nDELIVERY PREVIEW ONLY; not a reader answer.\n',
        blindedAt: new Date().toISOString(),
      });
    }
  }
}
const prompts = [];
const captureAdapter = {
  runtime: 'capture-only', rulesFiles: [], modes: ['stdin'],
  network: 'denied', filesystem: 'sandboxed', continue: false,
  compaction: { onDemand: false, instructionsAfterCompaction: 'unknown' },
  refuse: () => null,
  async invoke(invocation) {
    assert.equal(invocation.tools, 'off');
    prompts.push(invocation.prompt);
    throw new Error('Admission prompt captured; no model invocation or vote');
  },
};
const votes = await judgeAll({
  loaded, experiment, scenarios, units, judges: loaded.pack.population,
  adapters: { codex: captureAdapter, opencode: captureAdapter },
  guessOptions: [], recordsDir: path.join(work, 'preview-records'), work,
  seed: 'admission-clarity-preview-01', timeLimitSeconds: 1, parallel: 1,
});
assert.equal(units.length, manifest.expected.readerProbeOutcomes);
assert.equal(votes.length, manifest.expected.crossFamilyVoteSlots);
assert.ok(votes.every((vote) => vote.value === null));
assert.equal(prompts.length, 48);
const disclosures = /\b(?:m42|x19|sheetA|sheetB|candidate|predecessor)\b|revision [34]|linen-orbit-7263|822c1f92287b|605dc6181909|6ccf9ba0e7d9|082b2c704dfd/i;
for (const prompt of prompts) assert.doesNotMatch(prompt, disclosures);
for (const property of scenario.properties) {
  const delivered = prompts.filter((prompt) => prompt.includes('PROBE ' + property.answerHeading + '\n'));
  assert.ok(delivered.length > 0, 'Admission prompt missing ' + property.id);
  assert.ok(delivered.every((prompt) => prompt.includes(property.question) && prompt.includes(property.key) && prompt.includes(property.rubric)));
  assert.ok(delivered.every((prompt) => !prompt.includes(property.notes)), 'Auditor-only notes leaked');
}
console.log(JSON.stringify({
  status: 'PASS: author packet and prompt checks only; no reader or judge model invoked',
  evaluatorRevision: manifest.evaluatorSource, evaluatorCheckout: coreRoot,
  previewRecords: work, prompts: prompts.length, probes: headings.length,
  controls: coverage.controls.length, readerPromptCopies: readerPrompts.length,
  fixtureUnits: units.length, nullFixtureVoteSlots: votes.length,
}, null, 2));
