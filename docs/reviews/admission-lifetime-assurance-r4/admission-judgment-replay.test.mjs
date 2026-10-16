// Model-free integration checks use public prompt rendering/parsing, never AGP or model execution.
// Set AGP_ADMISSION_EVALUATOR_ROOT to the clean pinned evaluator checkout before running this file.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { replayAdmissionJudgments } from './replay-admission-judgments.mjs';

const packet = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = process.env.AGP_ADMISSION_EVALUATOR_ROOT;
assert.ok(coreRoot, 'Set AGP_ADMISSION_EVALUATOR_ROOT to run the public-panel replay tests');
const manifest = JSON.parse(fs.readFileSync(path.join(packet, 'admission-input-manifest.json'), 'utf8'));
assert.equal(execFileSync('git', ['-C', coreRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), manifest.evaluatorSource);
assert.equal(execFileSync('git', ['-C', coreRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
const core = await import(pathToFileURL(path.join(coreRoot, 'packages/core/dist/src/index.js')).href);
const checked = await core.checkPack(packet);
assert.ok(checked.ok);
const { loaded } = checked;
const { experiment, scenarios } = loaded.experiments.get('admission-clarity');
const scenario = scenarios.get('admission-clarity').scenario;

async function createAdmissionJudgmentFixture({ partial = false, failure = false } = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-admission-panel-fixture.'));
  const recordsDir = path.join(scratch, 'records');
  const units = loaded.pack.population.map((member, i) => ({ id: `u${i + 1}`, cell: `static.${member.id}`, scenario: scenario.id, arm: 'm42', member: member.id, family: member.family, properties: ['a01'], phase: 'answer', text: '--- ANSWER ---\nSTATIC REPLAY FIXTURE ONLY, NOT AN ANSWER.\n', blindedAt: '2026-10-01T00:00:00.000Z' }));
  const calls = {};
  const fixtureAdapter = {
    runtime: 'static-fixture', rulesFiles: [], modes: ['stdin'], continue: false, network: 'denied', filesystem: 'sandboxed',
    compaction: { onDemand: false, instructionsAfterCompaction: 'unknown' }, refuse: () => null,
    async invoke(invocation) {
      const count = calls[invocation.member.id] = (calls[invocation.member.id] ?? 0) + 1;
      if (failure && invocation.member.id === 'g' && count === 2) throw new Error('Recorded static panel exception, no runtime was invoked.');
      const ids = [...invocation.prompt.matchAll(/^--- answer (a\d+) ---$/gm)].map((match) => match[1]);
      const picked = partial && invocation.member.id === 'g' && count === 1 ? ids.slice(0, 1) : ids;
      return { final: picked.map((item) => JSON.stringify({ item, score: 1, reason: 'Static reply with no claim of measured comprehension.' })).join('\n'), tools: [], error: null };
    },
  };
  const votes = await core.judgeAll({ loaded, experiment, scenarios: new Map([[scenario.id, scenario]]), units, judges: loaded.pack.population,
    adapters: { opencode: fixtureAdapter, codex: fixtureAdapter }, guessOptions: [], recordsDir, work: scratch, seed: 'static-panel-replay', timeLimitSeconds: 1, parallel: 1 });
  const judgments = Object.fromEntries(fs.readdirSync(path.join(recordsDir, 'judging')).filter((name) => name.endsWith('.json')).map((name) => [name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(recordsDir, 'judging', name), 'utf8'))]));
  return { votes, args: { core, loaded, experiment, scenario, units, judgments, seed: 'static-panel-replay', originalRecordsDir: recordsDir } };
}

test('Admission public-panel replay binds first prompts, member identities, scores and reasons', async () => {
  const f = await createAdmissionJudgmentFixture();
  const replay = await replayAdmissionJudgments(f.args);
  assert.deepEqual(replay.issues, []);
  assert.deepEqual(replay.votes, f.votes);
  assert.equal(replay.replayedReplies, 3);
  assert.equal(replay.modelCalls, 0);
});

test('Admission public-panel replay preserves pending-only completion and retained failure', async () => {
  for (const failure of [false, true]) {
    const f = await createAdmissionJudgmentFixture({ partial: true, failure });
    const replay = await replayAdmissionJudgments(f.args);
    assert.deepEqual(replay.issues, []);
    assert.deepEqual(replay.votes, f.votes);
  }
});

test('Admission public-panel replay rejects changed, missing, unparseable or misassigned raw judgments', async () => {
  const original = await createAdmissionJudgmentFixture();
  const mutations = [
    (jobs, first) => { jobs[first].replies[0].final = 'Not JSON'; },
    (jobs, first) => { jobs[first].replies[0].final = jobs[first].replies[0].final.replaceAll('"score":1', '"score":2'); },
    (jobs, first) => { jobs[first].replies[0].final = jobs[first].replies[0].final.replaceAll('Static reply', 'Changed reason'); },
    (jobs, first) => { jobs[first].prompt += ' changed'; },
    (jobs, first) => { jobs[first].replies[0].tools = 1; },
    (jobs, first) => { delete jobs[first]; },
    (jobs, first) => { jobs[first].replies.push({ ...jobs[first].replies[0] }); },
    (jobs, first) => { jobs['unknown-job'] = jobs[first]; },
    (jobs, first) => { jobs[first].replies = []; },
    (jobs, first) => { jobs[first].replies[0].error = undefined; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const judgments = structuredClone(original.args.judgments);
    mutate(judgments, Object.keys(judgments)[0]);
    const replay = await replayAdmissionJudgments({ ...original.args, judgments });
    assert.ok(replay.issues.length > 0 || JSON.stringify(replay.votes) !== JSON.stringify(original.votes), `mutation ${index} produced no evidence difference`);
  }
});
