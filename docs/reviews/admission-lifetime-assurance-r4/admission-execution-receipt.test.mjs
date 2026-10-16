// Static temporary Git fixtures test receipt identity; no launch or model call is made.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkAdmissionExecutionReceipt, readAdmissionReviewedFiles } from './check-admission-execution-receipt.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function admissionReceiptFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-admission-receipt-fixture.'));
  const packet = path.join(root, 'packet');
  fs.mkdirSync(packet);
  const names = ['pack.json', 'admission-input-manifest.json', 'admission-execution-config.json', 'admission-provider-config.json',
    'run-admission-comparison.mjs', 'analyze-admission-comparison.mjs', 'account-admission-comparison.mjs', 'replay-admission-judgments.mjs', 'check-admission-execution-receipt.mjs'];
  for (const name of names) fs.writeFileSync(path.join(packet, name), 'Static Git identity fixture only.\n');
  const git = (...args) => execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init'); git('add', '--', 'packet'); git('commit', '-m', 'Record static identity fixture');
  const revision = git('rev-parse', 'HEAD').trim();
  const config = { suite: 'static-identity-fixture' }, manifest = { evaluatorSource: 'e'.repeat(40) };
  const readinessPath = path.join(packet, 'static-readiness.txt');
  fs.writeFileSync(readinessPath, `Verdict: PASS -- STATIC TEST FIXTURE, NOT A REVIEW.\nReviewed checkpoint: ${revision}\n`);
  const receipt = { reviewedRevision: revision, sourceRevision: revision, evaluatorRevision: manifest.evaluatorSource, options: config,
    readiness: { file: readinessPath, sha256: hash(fs.readFileSync(readinessPath)) }, files: Object.fromEntries(Object.entries(readAdmissionReviewedFiles(packet, revision)).map(([name, bytes]) => [name, hash(bytes)])) };
  return { packet, receipt, config, manifest };
}

test('Admission execution receipt binds complete reviewed Git inventory and readiness identity', () => {
  const f = admissionReceiptFixture();
  assert.deepEqual(checkAdmissionExecutionReceipt(f.packet, f.receipt, f.config, f.manifest), []);
});

test('Admission receipt rejects omitted coverage, wrong identities and unreviewed file/config changes', () => {
  const mutations = [
    (f) => { f.receipt.files = {}; },
    (f) => { delete f.receipt.files['admission-provider-config.json']; },
    (f) => { f.receipt.files['unreviewed.json'] = 'a'.repeat(64); },
    (f) => { f.receipt.files['admission-execution-config.json'] = 'a'.repeat(64); },
    (f) => { f.receipt.reviewedRevision = 'f'.repeat(40); f.receipt.sourceRevision = f.receipt.reviewedRevision; },
    (f) => { f.receipt.sourceRevision = 'a'.repeat(40); },
    (f) => { f.receipt.readiness.sha256 = 'a'.repeat(64); },
    (f) => { fs.writeFileSync(path.join(f.packet, 'admission-provider-config.json'), 'Changed route fixture.'); },
    (f) => { fs.writeFileSync(f.receipt.readiness.file, 'Verdict: FAIL -- STATIC FIXTURE.\n'); f.receipt.readiness.sha256 = hash(fs.readFileSync(f.receipt.readiness.file)); },
    (f) => { fs.writeFileSync(f.receipt.readiness.file, `Verdict: PASS -- STATIC FIXTURE.\nReviewed checkpoint: ${'a'.repeat(40)}\n`); f.receipt.readiness.sha256 = hash(fs.readFileSync(f.receipt.readiness.file)); },
    (f) => { f.receipt.readiness.file = path.join(path.dirname(f.packet), 'outside.txt'); },
    (f) => { delete f.receipt.readiness; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const f = admissionReceiptFixture(); mutate(f);
    assert.ok(checkAdmissionExecutionReceipt(f.packet, f.receipt, f.config, f.manifest).length > 0, `mutation ${index}`);
  }
});
