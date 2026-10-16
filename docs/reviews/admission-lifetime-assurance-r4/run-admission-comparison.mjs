// Execute the selected admission comparison through context-lab's pinned public API, without a fork.
// Usage: node run-admission-comparison.mjs /path/to/context-lab REVIEWED_REVISION /path/to/readiness-report --execute
// Only invoke after independent readiness PASS. No AGP runtime, traffic or fault reproduction is involved.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { admissionComparisonProbeIssues } from './account-admission-comparison.mjs';
import { analyzeAdmissionComparison } from './analyze-admission-comparison.mjs';

const packet = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: packet, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
assert.equal(process.argv.length, 6, 'Provide evaluator root, reviewed revision, readiness report and --execute');
assert.equal(process.argv[5], '--execute', 'Explicit execution selection required');
const coreRoot = path.resolve(process.argv[2]), revision = process.argv[3], readinessPath = path.resolve(process.argv[4]);
assert.match(revision, /^[a-f0-9]{40}$/, 'Use a measured full reviewed commit identity');
const config = read(path.join(packet, 'admission-execution-config.json'));
const manifest = read(path.join(packet, 'admission-input-manifest.json'));
assert.equal(config.evaluatorRevision, manifest.evaluatorSource);
assert.equal(execFileSync('git', ['-C', coreRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), config.evaluatorRevision);
assert.equal(execFileSync('git', ['-C', coreRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Pinned evaluator must be clean');
const root = git('rev-parse', '--show-toplevel').trim();
const prefix = path.relative(root, packet) + '/';
const frozenPaths = git('ls-tree', '-r', '--name-only', revision, '--', '.').trim().split('\n');
const files = {};
for (const name of frozenPaths) {
  const full = name.startsWith(prefix) ? name : prefix + name;
  const relative = full.slice(prefix.length);
  const expected = execFileSync('git', ['show', `${revision}:${full}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  const actual = fs.readFileSync(path.join(packet, relative));
  assert.ok(actual.equals(expected), `Reviewed file changed: ${relative}`);
  files[relative] = hash(actual);
}
for (const name of ['pack.json', 'admission-execution-config.json', config.providerConfig, 'run-admission-comparison.mjs', 'account-admission-comparison.mjs', 'analyze-admission-comparison.mjs']) assert.ok(files[name], `Execution file not frozen: ${name}`);
const readiness = fs.readFileSync(readinessPath, 'utf8');
assert.match(readiness, /^Verdict: PASS\b/m, 'Independent readiness report must say PASS');
assert.ok(readiness.includes(revision), 'Readiness report must identify the exact reviewed checkpoint');
assert.ok(process.env.LITELLM_NETBIRD_API_KEY, 'Selected provider credential is absent');
const core = await import(pathToFileURL(path.join(coreRoot, 'packages/core/dist/src/index.js')).href);
const checked = await core.checkPack(packet);
assert.ok(checked.ok, JSON.stringify(checked.defects));
const { loaded } = checked;
const experiment = loaded.experiments.get(config.suite).experiment;
const adapters = { opencode: core.opencodeAdapter({ operatorConfig: path.join(packet, config.providerConfig) }), codex: core.codexAdapter() };
const versions = { opencode: adapters.opencode.version(), codex: adapters.codex.version(), bubblewrap: execFileSync('bwrap', ['--version'], { encoding: 'utf8' }).trim() };
assert.deepEqual(versions, config.expectedRuntimeVersions, 'Runtime versions changed after preparation');
for (const member of loaded.pack.population) {
  const adapter = adapters[member.runtime];
  assert.equal(adapter.filesystem, 'sandboxed', `Unsandboxed runtime: ${member.id}`);
  assert.equal(adapter.refuse({ member, arm: core.EMPTY_ARM, workspace: '/unused', work: '/unused', prompt: '', mode: adapter.modes[0], tools: 'off', timeLimitSeconds: config.timeLimitSeconds }), null, `Runtime refuses selected settings: ${member.id}`);
}
const recordsRoot = path.join(packet, loaded.pack.records.path);
assert.ok(!fs.existsSync(recordsRoot), 'A retained execution already exists; do not rerun or overwrite it');
assert.equal(core.recordHistory(loaded, experiment.id).length, 0, 'An experiment registration already exists; inspect it before proceeding');
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-admission-r4-execution.'));
const register = core.recordExperiment(loaded, experiment.id);
fs.mkdirSync(recordsRoot);
const receipt = { schema: 'agp.admission-clarity-execution-receipt/1', recordedAt: new Date().toISOString(), reviewedRevision: revision, sourceRevision: revision, evaluatorRevision: config.evaluatorRevision, coreRoot, workRoot, options: config, versions, node: process.version, readiness: { file: readinessPath, sha256: hash(readiness) }, register, files };
fs.writeFileSync(path.join(recordsRoot, 'admission-execution-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ event: 'registered', register, workRoot, reviewedRevision: revision, frozenFiles: Object.keys(files).length }));

// The generic runner permits reduced populations. This public invocation boundary forbids any
// scored reader/judge model call until all nine recorded profile probes have passed for this run.
const guarded = Object.fromEntries(Object.entries(adapters).map(([runtime, adapter]) => [runtime, {
  ...adapter,
  async invoke(invocation) {
    const scored = invocation.tools === 'on' || invocation.work.includes(`${path.sep}judging${path.sep}`);
    if (scored) {
      const runs = fs.readdirSync(recordsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      assert.equal(runs.length, 1, 'Exactly one registered run must exist');
      const record = read(path.join(recordsRoot, runs[0].name, 'run.json'));
      const issues = admissionComparisonProbeIssues(record, loaded.pack, experiment);
      assert.ok(record.states.some((s) => s.state === 'probed') && issues.length === 0, `Full-population probe gate refused scored invocation: ${issues.join('; ')}`);
    }
    return adapter.invoke(invocation);
  },
}]));
try {
  const result = await core.conductRun(packet, { suite: config.suite, adapters: guarded, work: workRoot, records: recordsRoot, revision, runsPerCell: config.runsPerCell, timeLimitSeconds: config.timeLimitSeconds, judgeTimeLimitSeconds: config.judgeTimeLimitSeconds, parallel: config.parallel });
  const tallyBefore = ['RESULT.json', 'RESULT.md'].map((name) => hash(fs.readFileSync(path.join(result.dir, name))));
  core.tallyRun(result.dir);
  assert.deepEqual(['RESULT.json', 'RESULT.md'].map((name) => hash(fs.readFileSync(path.join(result.dir, name)))), tallyBefore, 'Public tally replay changed its results');
  const report = await analyzeAdmissionComparison(coreRoot, result.dir);
  fs.writeFileSync(path.join(result.dir, 'admission-replay.json'), JSON.stringify({ replayedAt: new Date().toISOString(), tallyHashes: tallyBefore, identical: true }, null, 2) + '\n');
  console.log(JSON.stringify({ event: 'accounted', directory: result.dir, complete: report.complete, issues: report.issues, mechanicalDisposition: report.mechanicalDisposition, numericConditions: report.numericConditions }));
} catch (error) {
  let accounting = 'No run record was created.';
  const runs = fs.readdirSync(recordsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (runs.length === 1) {
    try {
      const report = await analyzeAdmissionComparison(coreRoot, path.join(recordsRoot, runs[0].name));
      accounting = { complete: report.complete, issues: report.issues, mechanicalDisposition: report.mechanicalDisposition };
    } catch (failure) {
      accounting = `Accounting unavailable; NO VERDICT: ${String(failure)}`;
    }
  }
  fs.writeFileSync(path.join(recordsRoot, 'admission-execution-stop.json'), JSON.stringify({ stoppedAt: new Date().toISOString(), error: String(error), accounting, scope: 'Retained stop; no favorable rerun or project verdict.' }, null, 2) + '\n');
  throw error;
}
