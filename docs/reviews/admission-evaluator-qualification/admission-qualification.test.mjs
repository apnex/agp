// Static/capture qualification only: no provider, sandbox, probe or conductor invocation.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { assertAdmissionRawShape, assertAdmissionResolvedShape, assertAdmissionComposedShape } from './admission-qualification-shape.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const agpRoot = path.resolve(here, '../../..');
const packet = path.resolve(here, '../admission-lifetime-assurance-r4');
const preparation = path.resolve(here, '../admission-evaluation-preparation');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const profilePath = path.join(here, 'admission-qualification-profile.json');
const profile = read(profilePath);
const sourceRepo = process.env.AGP_PREPARATION_SOURCE_REPO;
assert.ok(sourceRepo, 'Set AGP_PREPARATION_SOURCE_REPO to the read-only context-lab cache');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-evaluator-static-qualification.'));
const evidence = { synthetic: true, modelCalls: 0, scope: 'bounded static/capture qualification; no live readiness', profile, commands: [], checks: {} };
const gitBytes = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 32 << 20 });
const frozen = (relative) => JSON.parse(gitBytes(agpRoot, 'show', `${profile.frozenPacketRevision}:docs/reviews/admission-lifetime-assurance-r4/${relative}`));
const baseline = { pack: frozen('pack.json'), experiment: frozen('admission-clarity-experiment.json'), limits: frozen('admission-execution-config.json') };
const pack = read(path.join(packet, 'pack.json'));
// This precedes checkPack/buildVariant: even validation can execute a declared hook.
assertAdmissionRawShape(pack);
for (const key of ['liveCallsMaximum', 'liveCostMaximum']) assert.equal(profile[key], 0);
for (const key of ['liveReplyCap', 'clientRequestObservation', 'backendBudgetObservation']) assert.equal(profile[key], null);
assert.equal(profile.evaluatorAdoptedForLiveUse, false);
assert.equal(profile.evaluatorRevision, 'e705b3d749400d0a79efe98e5338e9c84a1695b8');
assert.equal(profile.comparisonEvaluatorRevision, baseline.limits.evaluatorRevision);
assert.deepEqual(profile.restrictions, { delivery: 'instruction-only', onRequest: false, folderFiles: false,
  hooks: false, transforms: false, phases: [{ id: 'answer', session: 'new' }], resume: false, restrictedTally: false });

function runAdmissionCommand(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 << 20, ...options });
  const entry = { command, args, cwd: options.cwd ?? agpRoot, status: result.status, signal: result.signal,
    error: result.error ? String(result.error) : null, stdout: result.stdout, stderr: result.stderr };
  evidence.commands.push(entry);
  fs.writeFileSync(path.join(scratch, 'command-record.json'), JSON.stringify(evidence.commands, null, 2) + '\n');
  assert.equal(result.status, 0, `Admission qualification command failed; complete output: ${path.join(scratch, 'command-record.json')}`);
  return result.stdout;
}

function exportAdmissionEvaluator(revision, label) {
  const dir = path.join(scratch, label);
  fs.mkdirSync(dir);
  const archive = gitBytes(sourceRepo, 'archive', '--format=tar', revision);
  execFileSync('tar', ['-x', '-C', dir], { input: archive });
  const files = gitBytes(sourceRepo, 'ls-tree', '-r', '--name-only', revision).toString().trim().split('\n');
  const hashes = {};
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(dir, file));
    assert.deepEqual(bytes, gitBytes(sourceRepo, 'show', `${revision}:${file}`), `Admission qualification export changed: ${file}`);
    hashes[file] = sha256(bytes);
  }
  assert.equal(fs.existsSync(path.join(dir, '.git')), false);
  fs.symlinkSync(path.join(fs.realpathSync(sourceRepo), 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  evidence.checks[label] = { revision, export: dir, verifiedFiles: hashes };
  return dir;
}

function captureAdmissionProfile(coreRoot, selectedProfile) {
  const env = { ...process.env, AGP_PREPARATION_CORE_ROOT: coreRoot, AGP_PREPARATION_SOURCE_REPO: sourceRepo };
  // A separate test runner must not inherit Node's recursive-runner marker.
  delete env.NODE_TEST_CONTEXT;
  delete env.AGP_PREPARATION_PROFILE;
  if (selectedProfile) env.AGP_PREPARATION_PROFILE = selectedProfile;
  const stdout = runAdmissionCommand(process.execPath, ['--test', '--test-reporter=tap', path.join(preparation, 'admission-public-interface.test.mjs')], { env });
  const line = stdout.split('\n').find((s) => s.startsWith('# {"evidence":'));
  assert.ok(line, 'Admission qualification: full panel capture was not retained');
  const record = read(JSON.parse(line.slice(2)).evidence);
  evidence.commands.at(-1).environment = { AGP_PREPARATION_CORE_ROOT: coreRoot, AGP_PREPARATION_SOURCE_REPO: sourceRepo, AGP_PREPARATION_PROFILE: selectedProfile ?? null };
  return record;
}

function normalizeAdmissionCapture(record) {
  const copy = structuredClone(record);
  // Only the two panel records-directory prefixes in actual prompt fields may vary.
  for (const [i, run] of copy.runs.entries()) {
    const normalize = (prompt) => prompt.replace(/\/tmp\/agp-evaluation-static-checks\.[A-Za-z0-9]+\/panel-[A-Za-z0-9]+\/records/g, `<panel-${i}-records>`);
    for (const capture of run.captures) capture.prompt = normalize(capture.prompt);
    for (const job of Object.values(run.judgments)) job.prompt = normalize(job.prompt);
  }
  return copy;
}

const candidateRoot = exportAdmissionEvaluator(profile.evaluatorRevision, 'candidate');
const historicalProfile = read(path.join(preparation, 'preparation-profile.json'));
const historicalRoot = exportAdmissionEvaluator(historicalProfile.evaluatorRevision, 'historical-default');
const originalRoot = exportAdmissionEvaluator(profile.comparisonEvaluatorRevision, 'original-evaluator');
const candidateCapture = captureAdmissionProfile(candidateRoot, profilePath);
const historicalCapture = captureAdmissionProfile(historicalRoot);
runAdmissionCommand('npm', ['run', 'build', '--', '--force'], { cwd: originalRoot });
const core = await import(pathToFileURL(path.join(candidateRoot, 'packages/core/dist/src/index.js')));
const originalCore = await import(pathToFileURL(path.join(originalRoot, 'packages/core/dist/src/index.js')));
const checked = await core.checkPack(packet);
assert.equal(checked.ok, true, JSON.stringify(checked.defects));
const loaded = checked.loaded;
const experiment = loaded.experiments.get(baseline.experiment.id).experiment;
const scenarios = [...loaded.experiments.get(experiment.id).scenarios.values()].map((s) => s.scenario);
const shapeInput = { core, pack: loaded.pack, experiment, scenarios, limits: read(path.join(packet, 'admission-execution-config.json')), baseline };
assertAdmissionResolvedShape(shapeInput);

test('Admission qualification preserves the whole historical default capture and candidate panel payload', () => {
  const retainedBytes = gunzipSync(Buffer.from(fs.readFileSync(path.join(preparation, 'capture-only-evidence-02.json.gz.base64'), 'utf8'), 'base64'));
  assert.equal(sha256(retainedBytes), '2945c82c888e6f486bd4bc466dd09081c515dcbed882076d2ef4081f203e7435');
  assert.deepEqual(normalizeAdmissionCapture(historicalCapture), normalizeAdmissionCapture(JSON.parse(retainedBytes)));
  const next = normalizeAdmissionCapture(candidateCapture), previous = normalizeAdmissionCapture(historicalCapture);
  assert.equal(next.evaluatorRevision, profile.evaluatorRevision);
  assert.equal(previous.evaluatorRevision, historicalProfile.evaluatorRevision);
  previous.evaluatorRevision = next.evaluatorRevision;
  assert.deepEqual(next, previous, 'Only the evaluator pin and enumerated temporary prompt paths may differ');
  evidence.checks.panel = { candidateCapture, historicalCapture, historicalPayloadSha256: sha256(retainedBytes),
    normalization: 'two records-directory prefixes in capture/job prompt fields only; candidate comparison additionally changes the expected evaluatorRevision' };
});

test('Admission qualification refuses unsupported declarations and effective overrides as inert data', () => {
  const cases = [
    ['hooks', (x) => x.pack.hooks.push({ id: 'not-executed' })],
    ['transform', (x) => { x.pack.variants[0].transform = 'not-executed'; }],
    ['variant-revision', (x) => { x.pack.variants[0].revision = 'not-selected'; }],
    ['folder-file', (x) => { x.pack.arms[0].deliver[0].as = 'folder-file'; }],
    ['on-request', (x) => { x.pack.arms[0].deliver[0].as = 'on-request'; }],
    ['member', (x) => x.pack.population.pop()],
    ['model', (x) => { x.pack.population[0].model = 'not-selected'; }],
    ['family', (x) => { x.pack.population[0].family = 'not-selected'; }],
    ['settings', (x) => { x.pack.population[1].settings = { outputTokenMax: 4096 }; }],
    ['factors', (x) => x.experiment.factors.population.pop()],
    ['judges', (x) => x.experiment.judging.judges.pop()],
    ['batch', (x) => { x.experiment.judging.outcomesPerPrompt = 3; }],
    ['runs', (x) => { x.experiment.runsPerCell = 2; }],
    ['wall-limit', (x) => { x.limits.timeLimitSeconds = 1; }],
    ['fixture', (x) => { x.scenarios[0].fixture = { files: {} }; }],
    ['held-out', (x) => { x.scenarios[0].heldOut = true; }],
    ['trap', (x) => { x.scenarios[0].trapPairs = [{ id: 'inert' }]; }],
    ['second-phase', (x) => { x.scenarios[0].phases = [{ id: 'answer', session: 'new' }, { id: 'extra', session: 'new' }]; }],
    ...['after', 'note', 'task', 'withhold'].map((field) => [`phase-${field}`, (x) => { x.scenarios[0].phases = [{ id: 'answer', session: 'new', [field]: 'inert' }]; }]),
    ['continuation', (x) => { x.scenarios[0].phases = [{ id: 'answer', session: 'continue' }]; }],
    ['property-phase', (x) => { x.scenarios[0].properties[0].phase = 'other'; }],
    ['judge-note', (x) => { x.scenarios[0].properties[0].judgedWith = ['note']; }],
    ['measurement-hook', (x) => { x.scenarios[0].properties[0].measure = 'not-executed'; }],
    ['denominator', (x) => x.scenarios[0].properties.pop()],
  ];
  evidence.checks.rejectedDeclarations = [];
  for (const [name, mutate] of cases) {
    const input = structuredClone({ pack: shapeInput.pack, experiment, scenarios, limits: shapeInput.limits });
    const before = structuredClone(input);
    mutate(input);
    assert.notDeepEqual(input, before, `Mutation did not land: ${name}`);
    assert.throws(() => assertAdmissionResolvedShape({ core, baseline, ...input }), { name: 'AssertionError' }, name);
    evidence.checks.rejectedDeclarations.push({ name, input, rejected: true });
  }
});

test('Admission qualification checks publicly composed instruction bytes and both reader and judge arms', async () => {
  const built = new Map();
  for (const variant of pack.variants) {
    const result = await core.buildVariant(loaded, variant.id, profile.frozenPacketRevision, path.join(scratch, 'variants', variant.id));
    assert.equal(result.ok, true, JSON.stringify(result));
    built.set(variant.id, result);
  }
  const readerArms = pack.arms.map((decl) => {
    const result = core.composeArm(loaded, decl.id, built);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.arm;
  });
  const input = { core, pack, readerArms, judgeArm: core.EMPTY_ARM, revision: profile.frozenPacketRevision };
  assertAdmissionComposedShape(input);
  const instructions = [];
  for (const arm of readerArms) for (const instruction of arm.instructions) {
    const bytes = fs.readFileSync(instruction.path);
    const expected = instruction.file === core.CANARY_FILE
      ? Buffer.from(pack.variants.find((v) => v.id === instruction.variant).canaries.map((c) => `${c}\n`).join(''))
      : gitBytes(agpRoot, 'show', `${profile.frozenPacketRevision}:docs/reviews/admission-lifetime-assurance-r4/inputs/${instruction.variant}/${instruction.file}`);
    assert.deepEqual(bytes, expected);
    instructions.push({ ...instruction, content: bytes.toString(), sha256: sha256(bytes) });
  }
  const mutations = [
    ['reader-on-request', (x) => x.readerArms[0].onRequest.push({ path: '/not-invoked', variant: 'inert' })],
    ['reader-folder', (x) => x.readerArms[0].folderFiles.push({ path: '/not-invoked', variant: 'inert', file: 'inert' })],
    ['reader-missing', (x) => x.readerArms.pop()],
    ['reader-revision', (x) => { x.readerArms[0].revisions = {}; }],
    ['reader-instructions', (x) => x.readerArms[0].instructions.pop()],
    ['judge-on-request', (x) => x.judgeArm.onRequest.push({ path: '/not-invoked', variant: 'inert' })],
    ['judge-instruction', (x) => x.judgeArm.instructions.push({ path: '/not-invoked', variant: 'inert', file: 'inert' })],
  ];
  for (const [name, mutate] of mutations) {
    const changed = structuredClone({ readerArms, judgeArm: core.EMPTY_ARM });
    mutate(changed);
    assert.notDeepEqual(changed, { readerArms, judgeArm: core.EMPTY_ARM }, name);
    assert.throws(() => assertAdmissionComposedShape({ ...input, ...changed }), { name: 'AssertionError' }, name);
  }
  evidence.checks.composition = { readerArms, judgeArm: core.EMPTY_ARM, instructions, rejectedCases: mutations.map(([name]) => name) };
});

test('Admission qualification records one ordinary synthetic answer phase and its ledger relation', async () => {
  const run = candidateCapture.runs[0];
  const scenario = { ...run.scenario, scoredFile: 'answers.md' };
  const experiment = { ...run.experiment, instructions: 'Synthetic library record check only; no model is called.' };
  const answerBytes = Buffer.from('### Q1\nReserve books are loaned for seven days without renewal.\n');
  const outcome = { final: 'The synthetic answer file is ready.', exit: 0, signal: null,
    stop: { reason: 'completed', inFlight: 'none' }, cost: { seconds: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, toolCalls: 0 },
    tools: [], filtered: false, error: null, session: 'synthetic-only', trace: [], events: '' };
  const invocations = [];
  const adapter = { runtime: 'static-capture', modes: ['inline'], rulesFiles: [], filesystem: 'unknown', network: 'denied', continue: false,
    compaction: { onDemand: false, instructionsAfterCompaction: 'unknown' }, refuse: () => null,
    async invoke(invocation) {
      assert.equal(invocation.continueFrom, undefined);
      assert.equal(invocation.tools, 'on');
      assert.deepEqual(invocation.arm, core.EMPTY_ARM);
      invocations.push(structuredClone(invocation));
      fs.writeFileSync(path.join(invocation.workspace, scenario.scoredFile), answerBytes);
      return structuredClone(outcome);
    } };
  const result = await core.runEpisode({ loaded, experiment, scenario, arm: core.EMPTY_ARM, member: pack.population[0], memberIndex: 0,
    run: 1, adapter, work: path.join(scratch, 'ordinary-episode'), key: 'library-only', timeLimitSeconds: 1, timeouts: 0,
    classify: (actual) => { assert.deepEqual(actual, outcome); return { valid: true }; } });
  assert.equal(invocations.length, 1);
  assert.deepEqual(result.validity, { valid: true });
  assert.equal(result.endedAt, undefined);
  assert.equal(result.timeouts, 0);
  assert.equal(result.phases.length, 1);
  const phase = result.phases[0];
  assert.equal(phase.phase, 'answer');
  assert.equal(phase.session, 'new');
  assert.equal(phase.after, null);
  assert.equal(phase.status, 'run');
  assert.equal(phase.copiedTree, null);
  assert.equal(phase.note, null);
  assert.equal(phase.noteSource, null);
  assert.deepEqual(phase.traps, []);
  assert.deepEqual(phase.outcome, outcome);
  assert.equal(phase.prompt, invocations[0].prompt);
  assert.equal(phase.startTree, result.init);
  assert.equal(phase.startDiff, '');
  assert.deepEqual(fs.readFileSync(path.join(phase.workspace, 'answers.md')), answerBytes);
  assert.deepEqual(fs.readFileSync(path.join(phase.snapshot, 'answers.md')), answerBytes);
  assert.deepEqual(gitBytes(result.ledger, 'show', `${phase.endTree}:answers.md`), answerBytes);
  assert.equal(gitBytes(result.ledger, 'ls-tree', '--name-only', phase.startTree).toString(), '');
  assert.equal(gitBytes(result.ledger, 'ls-tree', '--name-only', phase.endTree).toString(), 'answers.md\n');
  const ledgerDiff = gitBytes(result.ledger, 'diff', phase.startTree, phase.endTree).toString();
  assert.equal(phase.diff, ledgerDiff);
  assert.equal(phase.endDiff, ledgerDiff);
  assert.match(ledgerDiff, /^\+Reserve books are loaned for seven days without renewal\.$/m);
  evidence.checks.episode = { synthetic: true, classification: 'injected valid fixture, not a classifier test', invocations, outcome, result,
    answer: answerBytes.toString(), answerSha256: sha256(answerBytes), ledgerDiff };
});

test('Admission qualification preserves every legacy tally field and failure disposition without executing failures', () => {
  const cases = candidateCapture.runs.map((run, i) => ({ name: i ? 'missing-reader' : 'complete', run: structuredClone(run) }));
  for (const state of ['ended', 'incomplete', 'excluded']) {
    const run = structuredClone(candidateCapture.runs[0]);
    const cell = run.cells[0];
    cell.propertyPhases = Object.fromEntries(run.scenario.properties.map((p) => [p.id, { phase: 'answer', state: state === 'ended' ? 'ended' : 'incomplete' }]));
    if (state !== 'incomplete') {
      cell.valid = false;
      cell.attempts[0].validity = { valid: false, cause: state === 'ended' ? 'behaviour' : 'infrastructure', detail: 'Inert disposition record; no failure executed.' };
    }
    const removed = new Set(run.blinded.units.filter((u) => u.cell === cell.cell).map((u) => u.id));
    run.blinded.units = run.blinded.units.filter((u) => !removed.has(u.id));
    run.votes = run.votes.filter((v) => !removed.has(v.unit));
    cases.push({ name: state, run });
  }
  evidence.checks.tally = [];
  const addedFields = ['exposed', 'heldOut', 'heldOutAbsent', 'heldOutCellValues', 'heldOutGuesses', 'link', 'restated', 'variation'];
  for (const { name, run } of cases) {
    const input = { run: name, status: 'synthetic', arms: ['left', 'right'], members: pack.population.map((m) => m.id),
      scenarios: new Map([[run.scenario.id, run.scenario]]), cells: run.cells, units: run.blinded.units, absent: run.blinded.absent, votes: run.votes,
      assigned: (unit) => core.assignJudges(unit, pack.population).map((j) => j.id), guessGroups: {} };
    const beforeVotes = structuredClone(run.votes);
    const original = originalCore.tally(input), candidate = core.tally(input);
    assert.deepEqual(Object.fromEntries(Object.keys(original).map((key) => [key, candidate[key]])), original);
    assert.deepEqual(Object.keys(candidate).filter((key) => !(key in original)).sort(), addedFields);
    assert.deepEqual(run.votes, beforeVotes);
    const first = run.cells[0].cell;
    if (name === 'ended') assert.ok(Object.values(candidate.cellValues[first]).every((value) => value === 0));
    if (name === 'incomplete') assert.ok(Object.values(candidate.cellValues[first]).every((value) => value === 'incomplete'));
    if (name === 'excluded') assert.deepEqual(candidate.excluded, [{ cell: first, cause: 'infrastructure' }]);
    if (name === 'missing-reader') {
      assert.equal(candidate.absent.length, 24);
      const missing = run.blinded.absent[0].cell;
      assert.ok(Object.values(candidate.cellValues[missing]).every((value) => value === 0));
    }
    evidence.checks.tally.push({ name, input: { ...input, scenarios: [...input.scenarios], assigned: Object.fromEntries(input.units.map((u) => [u.id, input.assigned(u)])) }, original, candidate });
  }
});

test('Admission qualification retains complete development evidence without changing frozen source', () => {
  for (const directory of ['admission-lifetime-assurance', 'admission-lifetime-assurance-r4']) {
    assert.equal(gitBytes(agpRoot, 'diff', profile.frozenPacketRevision, '--', `docs/reviews/${directory}`).toString(), '');
  }
  assert.equal(gitBytes(agpRoot, 'diff', profile.frozenPacketRevision, '--', 'packages', 'cli', 'docs/reviews/admission-lifetime-correction-r4.md').toString(), '');
  for (const file of ['preparation-profile.json', 'admission-scoring-policy.mjs', 'admission-scoring-policy.test.mjs', 'admission-scoring-cases.json', 'readiness-review-02.txt']) {
    assert.deepEqual(fs.readFileSync(path.join(preparation, file)), gitBytes(agpRoot, 'show', `${profile.frozenPacketRevision}:docs/reviews/admission-evaluation-preparation/${file}`));
  }
  const file = path.join(scratch, 'admission-qualification-evidence.json');
  fs.writeFileSync(file, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ evidence: file, synthetic: true, modelCalls: 0, candidate: profile.evaluatorRevision,
    checks: Object.keys(evidence.checks), bytes: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)) }));
});
