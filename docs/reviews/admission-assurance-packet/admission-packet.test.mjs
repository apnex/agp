import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { projectAdmissionReading } from './project-admission-reading.mjs';
import { checkAdmissionShape, checkAdmissionQuotes, evaluateAdmissionGate } from './check-admission-evidence.mjs';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const key = JSON.parse(read('admission-key.json'));
const scenario = JSON.parse(read('scenario.json'));
const pack = JSON.parse(read('pack.json'));
const experiment = JSON.parse(read('experiment.json'));
const members = ['c', 'g', 'o'];
const headings = key.probes.map(q => q.id);
const sample = headings.map(q => `### ${q}\nDecision: synthetic ${q}\nDocument support: none\nInference or gap: synthetic fixture\n`).join('\n') + '\n### OBSERVATIONS\nSynthetic observation.\n';

function admissionLedgerFixture() {
  return { interrupted: false, review: { status: 'PASS', report: 'SYNTHETIC-NOT-A-REVIEW', delivery: true, isolation: true, extraction: true, records: true, scoring: true, observations: true, ambiguity: true },
    rows: key.probes.flatMap(q => ['old', 'candidate', 'none'].flatMap(arm => members.map(member => {
      const d = arm === 'none' ? 0 : 1;
      const g = arm === 'candidate' ? 2 : arm === 'old' && member !== 'o' ? 2 : 1;
      return { probe: q.id, arm, member, status: 'present', eligible: true, faithful: true, evidence: 'synthetic-cell', quoteValid: arm !== 'none',
        votes: Object.fromEntries(['d', 'g'].map(axis => [axis, members.filter(j => j !== member).map(judge => ({ judge, value: axis === 'd' ? d : g, eligible: true, attempt: 1, reason: 'synthetic', evidence: 'synthetic-job' }))])) };
    }))) };
}
function admissionSetScore(ledger, probe, arm, member, axis, value) {
  ledger.rows.find(r => r.probe === probe && r.arm === arm && r.member === member).votes[axis].forEach(v => { v.value = value; });
}

test('fresh packet has 15 controls, 9 clarifications and two common-key axes per heading', () => {
  assert.equal(key.probes.length, 24);
  assert.equal(key.probes.filter(q => q.class === 'control').length, 15);
  assert.equal(key.probes.filter(q => q.class === 'clarification').length, 9);
  assert.equal(scenario.properties.length, 48);
  for (const q of key.probes) {
    const axes = scenario.properties.filter(p => p.answerHeading === q.id);
    assert.deepEqual(axes.map(p => p.scale), [[0, 1], [0, 2]]);
    assert.equal(axes[0].key, axes[1].key);
    assert.ok(q.decisions.every((d, i) => axes[0].key.includes(`${i + 1}. ${d}`)));
    assert.equal(axes[0].question, q.question);
    assert.ok(scenario.task.includes(q.question));
    for (const arm of ['r3', 'r4']) for (const heading of q.support[arm].sections) assert.ok(read(`../admission-lifetime-correction-${arm}.md`).includes(` ${heading}\n`), `${q.id}/${arm}/${heading}`);
  }
  assert.deepEqual([...new Set(key.probes.flatMap(q => q.duties))].sort(), [...key.duties].sort());
});

test('frozen originals and neutral projections retain measured identity', () => {
  for (const [rev, arm, hash] of [[3, 'v17', '6ccf9ba0e7d94b83897fade8f865fe3fb1328db292d92cce4d5cc85bc28fc2f2'], [4, 'k83', '082b2c704dfdc3338283f3733732388a15fbffec5d1f28bf78313bad884b97b4']]) {
    const original = read(`../admission-lifetime-correction-r${rev}.md`);
    assert.equal(createHash('sha256').update(original).digest('hex'), hash);
    assert.equal(read(`inputs/${arm}/DESIGN.md`), projectAdmissionReading(original));
    assert.doesNotMatch(read(`inputs/${arm}/DESIGN.md`), /https?:|revision [234]|source checkpoint/i);
  }
});

test('declared empty arm, fresh sessions, reader retry cap and finite response bound', () => {
  assert.deepEqual(pack.arms.find(a => a.id === key.roles.none).deliver, []);
  assert.equal(new Set(pack.population.map(p => p.family)).size, 3);
  assert.deepEqual(experiment.phases, [{ id: 'answer', session: 'new' }]);
  assert.equal(experiment.maxAttemptsPerCell, 1);
  assert.equal(experiment.maxResponseBytes, 98304);
  assert.equal(scenario.answerSource, 'final');
  assert.ok(!scenario.task.includes(key.sealedMarker));
});

test('shape rejects nested/fenced/duplicate/missing sections and labels without repairing text', () => {
  assert.equal(checkAdmissionShape(sample, headings).kind, 'canonical-candidate');
  for (const bad of [sample.replace('Decision: synthetic Q01', '#### Inner\nDecision: synthetic Q01'), sample + '\n### Q01\nlate', sample.replace('### Q02\n', ''), sample.replace('Decision: synthetic Q01', '```\nDecision: synthetic Q01\n```'), sample.replace('Decision: synthetic Q01', 'Unlabelled decision')]) assert.equal(checkAdmissionShape(bad, headings).kind, 'noncanonical');
  assert.equal(checkAdmissionShape('', headings).kind, 'whole-empty');
  assert.equal(checkAdmissionShape(sample.replace('Document support: none', 'Document support: quoted\nQUOTE: "### Literal heading"'), headings).kind, 'canonical-candidate');
});

test('quote check permits exact multi-premise quotes and rejects invented, malformed and absent support', () => {
  assert.equal(checkAdmissionQuotes('QUOTE: "first"\nQUOTE: "second"', 'first premise; second premise'), true);
  for (const s of ['QUOTE: "invented"', 'QUOTE: not-json', 'no quotes', 'QUOTE: ""']) assert.equal(checkAdmissionQuotes(s, 'first premise'), false);
});

test('complete synthetic gate reconciles 216 answers, 432 axes, 864 vote slots', () => {
  const result = evaluateAdmissionGate(key, admissionLedgerFixture());
  assert.equal(result.verdict, 'PASS');
  assert.deepEqual(result.accounting, { expectedAnswers: 216, receivedAnswers: 216, expectedAxes: 432, expectedVoteSlots: 864, cast: 864, uncast: 0, unresolvedSlots: 0 });
});

test('separating clarification regression fails despite floor and other gains', () => {
  const l = admissionLedgerFixture();
  admissionSetScore(l, 'Q16', 'old', 'o', 'g', 2);
  admissionSetScore(l, 'Q16', 'candidate', 'o', 'd', 0);
  admissionSetScore(l, 'Q16', 'candidate', 'o', 'g', 1);
  const r = evaluateAdmissionGate(key, l);
  assert.equal(r.verdict, 'FAIL');
  assert.ok(r.perProbe[15].separating && r.perProbe[15].floor);
  assert.ok(r.failures.includes('regression:Q16/d') && r.failures.includes('regression:Q16/g'));
});

test('decision loss cannot be compensated by grounding gain', () => {
  const l = admissionLedgerFixture();
  admissionSetScore(l, 'Q01', 'old', 'g', 'g', 1);
  admissionSetScore(l, 'Q01', 'candidate', 'o', 'd', 0);
  admissionSetScore(l, 'Q01', 'candidate', 'o', 'g', 1);
  const r = evaluateAdmissionGate(key, l);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.perProbe[0].difference.g, 1);
  assert.ok(r.failures.includes('regression:Q01/d'));
});

test('grounding loss alone fails, including a nonseparating control', () => {
  const l = admissionLedgerFixture();
  for (const m of members) admissionSetScore(l, 'Q01', 'none', m, 'd', 1);
  admissionSetScore(l, 'Q01', 'old', 'o', 'g', 2);
  admissionSetScore(l, 'Q01', 'candidate', 'o', 'g', 1);
  const r = evaluateAdmissionGate(key, l);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.perProbe[0].separating, false);
  assert.ok(r.failures.includes('regression:Q01/g'));
});

test('all ties lack strict improvement; redistribution is not a family-wise regression gate', () => {
  const l = admissionLedgerFixture();
  for (const q of key.probes) admissionSetScore(l, q.id, 'old', 'o', 'g', 2);
  const tied = evaluateAdmissionGate(key, l);
  assert.equal(tied.verdict, 'FAIL');
  assert.deepEqual(tied.failures, ['no-separating-grounded-improvement']);
  admissionSetScore(l, 'Q01', 'old', 'o', 'g', 1);
  admissionSetScore(l, 'Q01', 'candidate', 'c', 'g', 1);
  const redistributed = evaluateAdmissionGate(key, l);
  assert.deepEqual(redistributed.perProbe[0].difference, { d: 0, g: 0 });
});

test('missing votes yield NO VERDICT while adverse computable differences survive', () => {
  const l = admissionLedgerFixture();
  l.rows[0].votes.d[0].value = null;
  admissionSetScore(l, 'Q16', 'candidate', 'o', 'd', 0);
  admissionSetScore(l, 'Q16', 'candidate', 'o', 'g', 1);
  const r = evaluateAdmissionGate(key, l);
  assert.equal(r.verdict, 'NO VERDICT');
  assert.ok(r.failures.includes('regression:Q16/d'));
  assert.equal(r.perProbe[0].totals.old.d, null);
});

test('proved absence retains two zero axes and four uncast slots, never positive separation', () => {
  const l = admissionLedgerFixture();
  const row = l.rows.find(r => r.probe === 'Q01' && r.arm === 'none');
  row.status = 'absent'; row.absence = 'empty-section';
  Object.values(row.votes).flat().forEach(v => { v.value = null; v.attempt = null; });
  const r = evaluateAdmissionGate(key, l);
  assert.equal(r.accounting.uncast, 4);
  assert.equal(r.accounting.unresolvedSlots, 0);
  assert.equal(r.perProbe[0].separating, false);
  row.absence = 'ambiguous';
  assert.equal(evaluateAdmissionGate(key, l).verdict, 'NO VERDICT');
});

test('whole empty reader retains 48 zero axes and 96 uncast slots', () => {
  const l = admissionLedgerFixture();
  l.rows.filter(r => r.arm === 'candidate' && r.member === 'c').forEach(r => {
    r.status = 'absent'; r.absence = 'whole-response';
    Object.values(r.votes).flat().forEach(v => { v.value = null; v.attempt = null; });
  });
  const r = evaluateAdmissionGate(key, l);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.accounting.uncast, 96);
  assert.equal(r.perProbe.every(q => !q.separating), true);
});

test('quote failure caps grounding only, never raises zero or changes decisions', () => {
  const l = admissionLedgerFixture();
  const row = l.rows.find(r => r.arm === 'candidate'); row.quoteValid = false;
  let r = evaluateAdmissionGate(key, l);
  assert.equal(r.perProbe[0].totals.candidate.d, 3);
  assert.equal(r.perProbe[0].totals.candidate.g, 5);
  row.votes.g.forEach(v => { v.value = 0; });
  r = evaluateAdmissionGate(key, l);
  assert.equal(r.perProbe[0].totals.candidate.g, 4);
});

test('invalidity, duplicate/missing rows and cross-axis contradiction cannot pass', () => {
  for (const mutate of [l => { l.interrupted = true; }, l => { l.review.scoring = false; }, l => { l.review.observations = false; }, l => l.rows.pop(), l => l.rows.push(l.rows[0]), l => { l.rows[0].faithful = false; }, l => admissionSetScore(l, 'Q01', 'candidate', 'c', 'd', 0)]) {
    const l = admissionLedgerFixture(); mutate(l);
    assert.equal(evaluateAdmissionGate(key, l).verdict, 'NO VERDICT');
  }
});
