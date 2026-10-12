import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { assertAdmissionInputIdentity } from './check-admission-input.mjs';
import { projectAdmissionDesign } from './project-admission-input.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('./admission-input-manifest.json', import.meta.url), 'utf8'));
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const digest = (value) => createHash('sha256').update(value).digest('hex');

test('Admission input identities match both whole sources and their exact projections', () => {
  for (const input of manifest.inputs) assertAdmissionInputIdentity(read(input.sourceFile), read(input.readerFile), input);
});

test('Admission source mutation is rejected before its projection can be trusted', () => {
  const input = manifest.inputs[0];
  assert.throws(() => assertAdmissionInputIdentity(read(input.sourceFile) + '\n', read(input.readerFile), input), /source hash mismatch/);
});

test('Admission reader mutation is rejected at its content identity boundary', () => {
  const input = manifest.inputs[0];
  assert.throws(() => assertAdmissionInputIdentity(read(input.sourceFile), read(input.readerFile) + '\n', input), /reader hash mismatch/);
});

test('A rehashed but substantively changed reader copy still fails projection fidelity', () => {
  const input = manifest.inputs[0];
  const reader = read(input.readerFile);
  const changed = reader.replace('Only an exact current establishment success resets that history', 'Any identity result resets that history');
  assert.notEqual(changed, reader, 'Projection mutation must actually land');
  assert.throws(() => assertAdmissionInputIdentity(read(input.sourceFile), changed, { ...input, readerSha256: digest(changed) }), /projection differs/);
});

test('Admission projection fails closed when its history boundary is absent', () => {
  const source = read(manifest.inputs[0].sourceFile);
  const changed = source.replace('## Review gate and handoff', '## Omitted review boundary');
  assert.notEqual(changed, source);
  assert.throws(() => projectAdmissionDesign(changed), /section boundaries missing/);
});
