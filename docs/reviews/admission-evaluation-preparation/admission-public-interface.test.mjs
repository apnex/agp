// All invocation results below are synthetic, with no model or AGP runtime calls.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ADMISSION_JUDGE_INSTRUCTIONS, ADMISSION_PROPERTY_RUBRIC, checkAdmissionJudgment } from './admission-scoring-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => JSON.parse(fs.readFileSync(path.resolve(here, relative), 'utf8'));
const profile = read('preparation-profile.json');
const coreRoot = process.env.AGP_PREPARATION_CORE_ROOT;
const sourceRepo = process.env.AGP_PREPARATION_SOURCE_REPO;
assert.ok(coreRoot && sourceRepo, 'Set AGP_PREPARATION_CORE_ROOT to an isolated export and AGP_PREPARATION_SOURCE_REPO to the source repository');
assert.notEqual(fs.realpathSync(coreRoot), fs.realpathSync(sourceRepo), 'Never build in the shared source checkout');
assert.equal(fs.existsSync(path.join(coreRoot, '.git')), false, 'Use a disposable source export, not a checkout');
const git = (...args) => execFileSync('git', ['-C', sourceRepo, ...args], { encoding: 'utf8' });
assert.equal(git('rev-parse', profile.evaluatorRevision).trim(), profile.evaluatorRevision);
// Verify every exported tracked source byte before compiling, not only a version label.
const sourceFiles = git('ls-tree', '-r', '--name-only', profile.evaluatorRevision).trim().split('\n');
for (const relative of sourceFiles) {
  const expected = execFileSync('git', ['-C', sourceRepo, 'show', `${profile.evaluatorRevision}:${relative}`]);
  assert.deepEqual(fs.readFileSync(path.join(coreRoot, relative)), expected, `export changed: ${relative}`);
}
const build = execFileSync('npm', ['run', 'build', '--', '--force'], { cwd: coreRoot, encoding: 'utf8' });
const core = await import(pathToFileURL(path.join(coreRoot, 'packages/core/dist/src/index.js')).href);
const frozenPack = read(profile.frozenPopulationSource);
const frozenLimits = read(profile.frozenWallLimitsSource);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-evaluation-static-checks.'));
const capturedRuns = [];
const rawReason = 'DECISION=correct; COVERAGE=complete; SUPPORT=supported; HEDGE=no; REQUIRED=none; ISSUE=none; WHY=The answer gives the seven-day loan and no renewal with both exact excerpts; its proposal-status caveat is not a required-decision hedge.';
const document = 'Draft policy, not adopted or implemented.\nA book on the reserve shelf is loaned for seven days.\nRenewals are not allowed for reserve books.\n';
const answer = 'Reserve books are loaned for seven days and cannot be renewed; this is proposed behavior, not an adopted service rule.\nQUOTE: "A book on the reserve shelf is loaned for seven days."\nQUOTE: "Renewals are not allowed for reserve books."';
const question = 'For a reserve book, what is the loan period and may it be renewed?';
const key = 'Required decisions: R1. The loan period is seven days. R2. Renewal is not allowed.';

async function captureAdmissionPanel({ absentCell = false } = {}) {
  const work = fs.mkdtempSync(path.join(scratch, 'panel-'));
  const recordsDir = path.join(work, 'records');
  const population = structuredClone(frozenPack.population);
  // Twenty-four repeated unrelated headings exercise volume/identity accounting ONLY.
  // They are not twenty-four independent comprehension questions or calibration evidence.
  const scenario = { id: 'library-format-only', tags: [], fixture: null,
    task: question, properties: Array.from({ length: 24 }, (_, i) => ({
      id: `p${i + 1}`, type: 'comprehension', decidedBy: 'judge', answerHeading: `Q${i + 1}`,
      question, key, scale: [0, 2], rubric: ADMISSION_PROPERTY_RUBRIC,
    })) };
  const loaded = { dir: here, pack: { population, masks: { identifiers: [] }, isolation: frozenPack.isolation } };
  const cells = ['left', 'right'].flatMap((arm) => population.map((member) => ({
    cell: `synthetic.${arm}.${member.id}`, scenario: scenario.id, arm, member: member.id, valid: true,
    attempts: [{ workspace: '' }], codeScores: [],
    answers: Object.fromEntries(scenario.properties.map((p) => [p.id, absentCell && arm === 'left' && member.id === 'g' ? null : answer])),
  })));
  const scenarios = new Map([[scenario.id, scenario]]);
  const blinded = core.blind(loaded, scenarios, cells, new Map(population.map((m) => [m.id, m.family])), 'preparation-only', () => new Date('2026-10-01T00:00:00Z'));
  const experiment = { id: 'synthetic-preparation', phases: [{ id: 'answer', session: 'new' }],
    judgeInstructions: ADMISSION_JUDGE_INSTRUCTIONS, judging: { outcomesPerPrompt: 6 } };
  const captures = [];
  const captureAdapter = (runtime, modes) => ({
    runtime, modes, rulesFiles: [], filesystem: 'sandboxed', network: 'denied', continue: false,
    compaction: { onDemand: false, instructionsAfterCompaction: 'unknown' }, refuse: () => null,
    async invoke(invocation) {
      assert.equal(invocation.tools, 'off');
      assert.equal(invocation.mode, runtime === 'opencode' ? 'attachment' : 'stdin');
      assert.ok(invocation.prompt.includes(ADMISSION_JUDGE_INSTRUCTIONS));
      assert.ok(invocation.prompt.includes(ADMISSION_PROPERTY_RUBRIC));
      assert.ok(invocation.prompt.includes(question) && invocation.prompt.includes(key));
      assert.ok(invocation.prompt.includes(answer));
      assert.doesNotMatch(invocation.prompt, /synthetic\.(left|right)|litellm-nexus|claude-opus|gemini-3|gpt-6/);
      const ids = [...invocation.prompt.matchAll(/^--- answer (a\d+) ---$/gm)].map((match) => match[1]);
      assert.ok(ids.length > 0 && ids.length <= 6);
      const final = ids.map((item) => JSON.stringify({ item, score: 2, reason: rawReason })).join('\n');
      captures.push({ member: invocation.member.id, mode: invocation.mode, tools: invocation.tools, prompt: invocation.prompt, final });
      return { final, tools: [], error: null };
    },
  });
  const votes = await core.judgeAll({ loaded, experiment, scenarios, units: blinded.units, judges: population,
    adapters: { opencode: captureAdapter('opencode', ['inline', 'attachment']), codex: captureAdapter('codex', ['inline', 'stdin']) },
    guessOptions: [], recordsDir, work, seed: 'preparation-only', timeLimitSeconds: 1, parallel: 1 });
  const expectedPresent = absentCell ? 120 : 144;
  assert.equal(blinded.units.length, expectedPresent);
  assert.equal(blinded.absent.length, absentCell ? 24 : 0);
  assert.equal(votes.length, expectedPresent * 2);
  assert.equal(new Set(votes.map((v) => `${v.unit}/${v.judge}`)).size, votes.length);
  for (const unit of blinded.units) {
    const mine = votes.filter((v) => v.unit === unit.id);
    assert.deepEqual(mine.map((v) => v.judge).sort(), population.filter((m) => m.family !== unit.family).map((m) => m.id).sort());
    for (const vote of mine) {
      assert.equal(vote.value, 2);
      assert.equal(vote.reason, rawReason);
      const checked = checkAdmissionJudgment({ score: vote.value, reason: vote.reason, requiredDecisionIds: ['R1', 'R2'] });
      assert.deepEqual(checked.issues, []);
      assert.deepEqual(checked.original, { score: vote.value, reason: vote.reason });
    }
  }
  // Make uncast identities explicit; none is represented by an invented vote.
  const uncast = blinded.absent.flatMap((a) => {
    const cell = cells.find((c) => c.cell === a.cell);
    const family = population.find((m) => m.id === cell.member).family;
    return population.filter((m) => m.family !== family).map((m) => ({ ...a, judge: m.id, value: null, status: 'not cast: missing answer' }));
  });
  assert.equal(uncast.length, absentCell ? 48 : 0);
  assert.equal(votes.length + uncast.length, 288);
  const judgments = Object.fromEntries(fs.readdirSync(path.join(recordsDir, 'judging')).sort().map((name) => [name, JSON.parse(fs.readFileSync(path.join(recordsDir, 'judging', name), 'utf8'))]));
  assert.equal(captures.length, expectedPresent * 2 / 6);
  assert.equal(Object.keys(judgments).length, captures.length);
  for (const job of Object.values(judgments)) {
    assert.equal(job.replies.length, 1, 'well-formed fixture must not require a completion retry');
    assert.equal(job.failure, undefined);
    assert.equal(job.replies[0].tools, 0);
    assert.equal(job.replies[0].error, null);
    assert.equal(captures.filter((c) => c.prompt === job.prompt && c.final === job.replies[0].final).length, 1);
  }
  capturedRuns.push({ synthetic: true, modelCalls: 0, scope: 'public blinding/panel only; not conductor/isolation/provider qualification',
    document, scenario, experiment, cells, blinded, captures, judgments, votes, uncast });
}

test('Admission public panel preserves all 144 synthetic outcomes and 288 cross-family vote identities', async () => {
  await captureAdmissionPanel();
});

test('Admission public blinder leaves missing answers uncast with complete 288-slot accounting', async () => {
  await captureAdmissionPanel({ absentCell: true });
});

test('Admission runtime preparation inspects only public setting refusal and sanitized declared routes', () => {
  assert.equal(profile.liveCallsMaximum, 0);
  assert.equal(profile.liveCostMaximum, 0);
  assert.equal(profile.liveReplyCap, null);
  assert.equal(profile.evaluatorAdoptedForLiveUse, false);
  assert.equal(frozenLimits.timeLimitSeconds, 1200);
  assert.equal(frozenLimits.judgeTimeLimitSeconds, 900);
  const runtime = core.opencodeAdapter({ operatorConfig: path.resolve(here, profile.sanitizedProviderSource), env: {}, binary: '/not-invoked/opencode' });
  const member = frozenPack.population.find((m) => m.id === 'g');
  const invocation = { mode: 'attachment', tools: 'off', member, workspace: scratch, work: path.join(scratch, 'never-invoked'), arm: core.EMPTY_ARM, prompt: '', timeLimitSeconds: 1 };
  for (const value of [0, -1, 1.5, '4096', null, true]) {
    assert.match(runtime.refuse({ ...invocation, member: { ...member, settings: { outputTokenMax: value } } }), /outputTokenMax/);
  }
  const testMember = { ...member, settings: { outputTokenMax: 4096 } };
  assert.equal(runtime.refuse({ ...invocation, member: testMember }), null);
  const route = runtime.route(testMember);
  assert.equal(route.npm, '@ai-sdk/openai-compatible');
  assert.equal(route.memberSettings.outputTokenMax, 4096);
  assert.equal(route.settings.limit.output, 65536);
  assert.equal('apiKey' in route.endpoint, false);
  assert.equal('headers' in route.endpoint, false);
  assert.doesNotMatch(JSON.stringify(route), /LITELLM_NETBIRD_API_KEY/);
  const codex = core.codexAdapter({ env: {}, vendor: '/not-invoked/codex', models: '/not-read/models', auth: '/not-read/auth' });
  assert.match(codex.refuse({ ...invocation, mode: 'stdin', member: { ...frozenPack.population.find((m) => m.id === 'o'), settings: { outputTokenMax: 4096 } } }), /outputTokenMax.*not one Codex can apply/);
  // 4096 is a non-invoked interface-test value, NOT a proposed live reply cap.
});

test('Admission preparation retains complete synthetic capture records with explicit provenance', () => {
  assert.equal(capturedRuns.length, 2);
  const file = path.join(scratch, 'capture-only-evidence.json');
  const policySha256 = createHash('sha256').update(ADMISSION_JUDGE_INSTRUCTIONS).digest('hex');
  fs.writeFileSync(file, JSON.stringify({ synthetic: true, modelCalls: 0, evaluatorRevision: profile.evaluatorRevision,
    verifiedExportFiles: sourceFiles.length, buildCommand: 'npm run build -- --force', buildOutput: build,
    policySha256, runs: capturedRuns }, null, 2) + '\n');
  console.log(JSON.stringify({ evidence: file, synthetic: true, modelCalls: 0, evaluatorRevision: profile.evaluatorRevision,
    publicPanelJobs: capturedRuns.map((r) => Object.keys(r.judgments).length), castVotes: capturedRuns.map((r) => r.votes.length),
    uncastSlots: capturedRuns.map((r) => r.uncast.length) }));
});
