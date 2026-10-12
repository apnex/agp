// Admission input identity checks are independent of the reader/model runtime.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { projectAdmissionDesign } from './project-admission-input.mjs';

/** Check exact admission source/input bytes and the declared neutral projection. */
export function assertAdmissionInputIdentity(source, reader, input) {
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(digest(source), input.sourceSha256, 'Admission source hash mismatch');
  assert.equal(digest(reader), input.readerSha256, 'Admission reader hash mismatch');
  assert.equal(reader, projectAdmissionDesign(source), 'Admission projection differs from its source');
}
