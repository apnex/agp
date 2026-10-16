// Admission execution provenance is bound to a real reviewed Git object, not a self-described map.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const required = ['pack.json', 'admission-input-manifest.json', 'admission-execution-config.json', 'admission-provider-config.json',
  'run-admission-comparison.mjs', 'analyze-admission-comparison.mjs', 'account-admission-comparison.mjs', 'replay-admission-judgments.mjs', 'check-admission-execution-receipt.mjs'];

export function readAdmissionReviewedFiles(packet, revision) {
  assert.match(revision, /^[a-f0-9]{40}$/, 'Admission reviewed revision must be a full commit identity');
  const git = (...args) => execFileSync('git', args, { cwd: packet, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(git('rev-parse', '--verify', `${revision}^{commit}`).toString().trim(), revision, 'Admission reviewed commit did not resolve exactly');
  const root = git('rev-parse', '--show-toplevel').toString().trim();
  const prefix = path.relative(root, packet) + '/';
  const files = Object.fromEntries(git('ls-tree', '-r', '--name-only', revision, '--', '.').toString().trim().split('\n').map((name) => {
    assert.ok(name && !name.startsWith('/') && !name.split('/').includes('..'), 'Unexpected reviewed packet path');
    return [name, git('show', `${revision}:${prefix}${name}`)];
  }));
  for (const name of required) assert.ok(files[name], `Reviewed execution file missing: ${name}`);
  return files;
}

export function checkAdmissionExecutionReceipt(packet, receipt, config, manifest) {
  const issues = [];
  const require = (condition, message) => { if (!condition) issues.push(message); };
  try {
    require(receipt.sourceRevision === receipt.reviewedRevision, 'source and reviewed revisions differ');
    require(receipt.evaluatorRevision === manifest.evaluatorSource, 'receipt evaluator revision differs');
    require(isDeepStrictEqual(receipt.options, config), 'receipt execution settings differ');
    const reviewed = readAdmissionReviewedFiles(packet, receipt.reviewedRevision);
    require(isDeepStrictEqual(Object.keys(receipt.files ?? {}).sort(), Object.keys(reviewed).sort()), 'receipt frozen-file inventory is incomplete or different');
    for (const [name, bytes] of Object.entries(reviewed)) {
      require(receipt.files?.[name] === hash(bytes), `receipt hash differs from reviewed blob: ${name}`);
      require(fs.existsSync(path.join(packet, name)) && fs.readFileSync(path.join(packet, name)).equals(bytes), `working input differs from reviewed blob: ${name}`);
    }
    const readinessPath = path.resolve(receipt.readiness?.file ?? '');
    require(path.dirname(readinessPath) === packet, 'readiness report is outside the reviewed packet');
    if (path.dirname(readinessPath) === packet) {
      const readiness = fs.readFileSync(readinessPath, 'utf8');
      require(receipt.readiness?.sha256 === hash(readiness), 'readiness report hash differs');
      require(/^Verdict: PASS\b/m.test(readiness), 'readiness report does not pass');
      const targets = [...readiness.matchAll(/^(?:\[MEASURED\] )?(?:Review target(?: and working HEAD)?|Reviewed checkpoint|Target): ([a-f0-9]{40})\.?$/gm)];
      require(targets.length === 1 && targets[0][1] === receipt.reviewedRevision, 'readiness report does not identify exactly the reviewed checkpoint');
    }
  } catch (error) {
    issues.push(`execution receipt cannot be verified: ${String(error)}`);
  }
  return issues;
}
