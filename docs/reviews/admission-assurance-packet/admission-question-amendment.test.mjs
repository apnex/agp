import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const packet = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(packet, name), 'utf8');
const json = name => JSON.parse(read(name));
const amendment = json('question-amendment-01.json');
const originalKey = json('admission-key.json');
const correctedKey = json('questions-02/admission-key.json');
const originalScenario = json('scenario.json');
const correctedScenario = json('questions-02/scenario.json');

test('question amendment retains the exact failed declarations and full report', () => {
  for (const [name, hash] of [
    ['admission-key.json', 'efa4a95ba9a937b81f127e20d079d9144d8de8b7418c17377e99c5445fe4d337'],
    ['scenario.json', '9a2fa4f8a86ed4a200551dd36025bd8c46e7e85cda867821c375e5a3320d2251'],
    ['key-readiness-audit-01.txt', '50c620b3b1ab6a4747689befb458f20f1a03d785825ef3c86e0cffca6e688f67'],
  ]) assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash, name);
});

test('only the six authorized question strings change in the common key', () => {
  assert.deepEqual(amendment.changes.map(c => c.id), ['Q05', 'Q10', 'Q11', 'Q16', 'Q19', 'Q21']);
  const expected = structuredClone(originalKey);
  for (const change of amendment.changes) {
    const probe = expected.probes.find(q => q.id === change.id);
    assert.equal(probe.question, change.before);
    assert.notEqual(change.before, change.after);
    probe.question = change.after;
  }
  assert.deepEqual(correctedKey, expected);
});

test('reader task and both axis questions have exactly the declared correction', () => {
  const expected = structuredClone(originalScenario);
  for (const change of amendment.changes) {
    assert.equal(expected.task.split(change.before).length, 2);
    expected.task = expected.task.replace(change.before, change.after);
    const axes = expected.properties.filter(p => p.answerHeading === change.id);
    assert.equal(axes.length, 2);
    for (const axis of axes) {
      assert.equal(axis.question, change.before);
      axis.question = change.after;
    }
  }
  assert.deepEqual(correctedScenario, expected);
  for (const probe of correctedKey.probes) {
    assert.equal(correctedScenario.task.split(probe.question).length, 2);
    const axes = correctedScenario.properties.filter(p => p.answerHeading === probe.id);
    assert.equal(axes.length, 2);
    for (const axis of axes) {
      assert.equal(axis.question, probe.question);
      assert.equal(axis.key, probe.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n'));
    }
  }
});

test('pack relocation preserves source paths, pins, arms, settings and the experiment', () => {
  const original = json('pack.json');
  const expected = structuredClone(original);
  for (const source of expected.sources) source.path = '../' + source.path;
  const corrected = json('questions-02/pack.json');
  assert.deepEqual(corrected, expected);
  for (const source of corrected.sources) {
    const prior = original.sources.find(s => s.id === source.id);
    assert.equal(path.resolve(packet, 'questions-02', source.path), path.resolve(packet, prior.path));
  }
  assert.equal(read('questions-02/experiment.json'), read('experiment.json'));
  assert.equal(fs.existsSync(path.join(packet, 'questions-02/register')), false);
});

test('question correction retains classification, complete duties and no-document task boundary', () => {
  assert.equal(correctedKey.probes.length, 24);
  assert.equal(correctedScenario.properties.length, 48);
  assert.equal(correctedKey.probes.filter(q => q.class === 'control').length, 15);
  assert.equal(correctedKey.probes.filter(q => q.class === 'clarification').length, 9);
  assert.deepEqual([...new Set(correctedKey.probes.flatMap(q => q.duties))].sort(), [...correctedKey.duties].sort());
  assert.ok(!correctedScenario.task.includes(correctedKey.sealedMarker));
  for (const probe of correctedKey.probes) for (const decision of probe.decisions) {
    assert.ok(!correctedScenario.task.includes(decision), `${probe.id}: full key sentence leaked`);
  }
  assert.deepEqual(json('questions-02/pack.json').arms.find(a => a.id === correctedKey.roles.none).deliver, []);
});
