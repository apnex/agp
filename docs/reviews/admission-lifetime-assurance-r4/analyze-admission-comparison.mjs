// Admission evidence analysis uses the pinned public parser/blinder and project-specific accounting.
// Usage: node analyze-admission-comparison.mjs /path/to/context-lab /path/to/run-record
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { accountAdmissionComparison } from './account-admission-comparison.mjs';

const packet = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function analyzeAdmissionComparison(coreRoot, runDir) {
  const manifest = read(path.join(packet, 'admission-input-manifest.json'));
  assert.equal(execFileSync('git', ['-C', coreRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), manifest.evaluatorSource);
  assert.equal(execFileSync('git', ['-C', coreRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  const core = await import(pathToFileURL(path.join(coreRoot, 'packages/core/dist/src/index.js')).href);
  const checked = await core.checkPack(packet);
  assert.ok(checked.ok, JSON.stringify(checked.defects));
  const { loaded } = checked;
  const experiment = loaded.experiments.get('admission-clarity').experiment;
  const scenario = loaded.experiments.get('admission-clarity').scenarios.get('admission-clarity').scenario;
  const config = read(path.join(packet, 'admission-execution-config.json'));
  const record = read(path.join(runDir, 'run.json'));
  const receipt = read(path.join(runDir, '..', 'admission-execution-receipt.json'));
  const provenanceIssues = [];
  const require = (condition, message) => { if (!condition) provenanceIssues.push(message); };
  require(receipt.evaluatorRevision === manifest.evaluatorSource, 'execution receipt evaluator differs');
  require(isDeepStrictEqual(receipt.options, config), 'execution receipt settings differ');
  require(receipt.sourceRevision === receipt.reviewedRevision, 'execution source differs from reviewed checkpoint');
  require(Date.parse(receipt.recordedAt) <= Date.parse(record.states?.[0]?.at), 'execution receipt does not predate the run');
  require(isDeepStrictEqual(receipt.register, record.register) && record.register?.hash === core.contentHash(loaded, experiment.id), 'registration is not the current frozen experiment');
  for (const [name, hash] of Object.entries(receipt.files)) require(sha256(fs.readFileSync(path.join(packet, name))) === hash, `execution input changed: ${name}`);
  for (const [arm, variant] of Object.entries(record.variants ?? {})) require(variant.revision === receipt.sourceRevision && variant.variant === arm && variant.rewritten === 0 && isDeepStrictEqual(variant.canaries, loaded.pack.variants.find((v) => v.id === arm)?.canaries), `variant provenance differs: ${arm}`);
  require(isDeepStrictEqual(Object.keys(record.variants ?? {}).sort(), [...experiment.factors.arms].sort()) && experiment.factors.arms.every((arm) => record.arms?.[arm]?.composed === true), 'required variants or composed arms missing');
  require(isDeepStrictEqual(record.runtimes, { opencode: config.expectedRuntimeVersions.opencode, codex: config.expectedRuntimeVersions.codex }), 'recorded runtime versions differ');
  const sources = Object.fromEntries(manifest.inputs.map((input) => {
    const source = fs.readFileSync(path.join(packet, input.readerFile), 'utf8');
    require(sha256(source) === input.readerSha256, `reader input changed: ${input.arm}`);
    require(sha256(fs.readFileSync(path.join(packet, input.sourceFile))) === input.sourceSha256, `source input changed: ${input.arm}`);
    return [input.arm, source];
  }));
  const filesIn = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : [];
  const cells = filesIn(path.join(runDir, 'cells')).map((name) => read(path.join(runDir, 'cells', name)));
  const optional = (name, fallback) => fs.existsSync(path.join(runDir, name)) ? read(path.join(runDir, name)) : fallback;
  const blinded = optional('sealed/units.json', { seed: null, units: [], absent: [] });
  const votes = optional('judging/votes.json', []);
  const judgments = Object.fromEntries(filesIn(path.join(runDir, 'judging')).filter((name) => name !== 'votes.json').map((name) => [name.slice(0, -5), read(path.join(runDir, 'judging', name))]));
  // Reuse the evaluator's extraction; do not reinterpret a failed phase's saved file.
  for (const cell of cells) for (const property of scenario.properties) {
    if (cell.propertyPhases?.[property.id]?.state !== 'valid') continue;
    const extracted = core.splitAnswers(cell.phaseOutcomes?.answer?.scored ?? '', [property.answerHeading], loaded.pack.masks.selfExplanationMarker).get(property.answerHeading) ?? null;
    require(extracted === cell.answers?.[property.id], `${cell.cell}.${property.id}: retained answer differs from public extraction`);
  }
  try {
    const replay = core.blind(loaded, new Map([[scenario.id, scenario]]), cells, new Map(loaded.pack.population.map((m) => [m.id, m.family])), record.seed, () => new Date(0), { paths: [receipt.workRoot, path.dirname(runDir), packet], literals: loaded.pack.variants.flatMap((v) => v.canaries) });
    const withoutTimes = (units) => units.map(({ blindedAt, ...unit }) => unit);
    require(isDeepStrictEqual(withoutTimes(replay.units), withoutTimes(blinded.units)) && isDeepStrictEqual(replay.absent, blinded.absent), 'retained blinded units differ from public blinder replay');
  } catch (error) {
    provenanceIssues.push(`public blinder replay unavailable: ${String(error)}`);
  }
  const report = accountAdmissionComparison({ pack: loaded.pack, experiment, scenario, manifest, config, record, cells, blinded, votes, judgments, sources, provenanceIssues });
  fs.writeFileSync(path.join(runDir, 'ADMISSION-ACCOUNTING.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv[2] && process.argv[3], 'Provide the pinned evaluator and retained run directory');
  const report = await analyzeAdmissionComparison(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
  console.log(JSON.stringify({ run: report.run, complete: report.complete, issues: report.issues, outcomes: report.outcomeCount, intendedVoteSlots: report.intendedVoteSlots, castVotes: report.castVotes, numericConditions: report.numericConditions, mechanicalDisposition: report.mechanicalDisposition }, null, 2));
}
