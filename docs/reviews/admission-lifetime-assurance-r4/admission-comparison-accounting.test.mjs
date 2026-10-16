// Static record fixtures exercise admission accounting, not AGP traffic or runtime failures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { accountAdmissionComparison, checkAdmissionComparisonQuotes, readAdmissionComparisonDiagnostics } from './account-admission-comparison.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const reason = 'DECISION=correct; COVERAGE=complete; SUPPORT=supported; HEDGE=no; Static fixture.';

function admissionAccountingFixture() {
  const pack = read('pack.json'), experiment = read('admission-clarity-experiment.json'), scenario = read('admission-clarity-probes.json');
  const manifest = read('admission-input-manifest.json'), config = read('admission-execution-config.json');
  const sources = { m42: 'Fixture source.', x19: 'Fixture source.' };
  const cells = [], units = [], votes = [], judgments = {};
  const probe = (arm, member) => ({ arm, member, pass: true, reasons: [], answers: ['canary', 'leak'].map((kind) => ({ kind, probe: kind === 'canary' ? 'canary' : 'sealed-key', answered: true, finding: 'ok', toolCalls: 0 })) });
  const record = {
    run: 'static-fixture', seed: 'static-fixture', pack: pack.id, experiment: experiment.id, suite: config.suite,
    scenarios: [scenario.id], method: { revision: manifest.evaluatorSource }, status: 'result', end: 'completed', runsPerCell: 1, timeLimitSeconds: config.timeLimitSeconds,
    population: ['c', 'g', 'o'], judges: ['c', 'g', 'o'], snapshot: { arms: ['m42', 'x19'], population: pack.population, scenarios: [scenario] },
    register: { experiment: experiment.id, declaredStatus: 'result', hash: 'a'.repeat(64), recordedAt: '2026-10-01T00:00:00.000Z' },
    states: ['validated', 'recorded', 'built', 'probed', 'executed', 'measured', 'blinded', 'judged', 'tallied'].map((state, i) => ({ state, at: `2026-10-02T00:00:0${i}.000Z` })),
    probes: ['m42', 'x19'].flatMap((arm) => pack.population.map((m) => probe(arm, m.id))), judgeProbes: pack.population.map((m) => probe('judges', m.id)),
  };
  for (const arm of ['m42', 'x19']) for (const member of pack.population) {
    const id = `${scenario.id}.${arm}.${member.id}.1`;
    const answer = 'Decision: fixture.\nQUOTE: "Fixture source."';
    const cell = { cell: id, scenario: scenario.id, arm, member: member.id, run: 1, valid: true,
      attempts: [{ attempt: 1, validity: { valid: true }, phases: [{ phase: 'answer', status: 'run', session: 'new', validity: { valid: true } }] }],
      answers: {}, propertyPhases: {}, phaseOutcomes: { answer: { scored: answer } }, scoredFile: { content: `${answer}\n### OBSERVATIONS\nFixture observation.` } };
    for (const property of scenario.properties) {
      cell.answers[property.id] = answer;
      cell.propertyPhases[property.id] = { phase: 'answer', state: 'valid' };
      const unit = { id: `u${units.length + 1}`, cell: id, scenario: scenario.id, arm, member: member.id, family: member.family, properties: [property.id], phase: 'answer' };
      units.push(unit);
      for (const judge of pack.population.filter((j) => j.family !== member.family)) {
        const prompt = `${unit.id}.${judge.id}`;
        votes.push({ unit: unit.id, property: property.id, judge: judge.id, family: judge.family, value: arm === 'x19' && property.id === 'a04' ? 1 : 2, reason, prompt });
        judgments[prompt] = { prompt: 'Static prompt fixture.', replies: [{ final: 'Static reply fixture.', tools: 0 }] };
      }
    }
    cells.push(cell);
  }
  record.cells = cells.map((c) => c.cell);
  return { pack, experiment, scenario, manifest, config, record, cells, blinded: { seed: record.seed, units, absent: [] }, votes, judgments, sources };
}

function discardAdmissionCellJudging(fixture, cell, property) {
  const removed = fixture.blinded.units.filter((u) => u.cell === cell.cell && (property === undefined || u.properties.includes(property))).map((u) => u.id);
  fixture.blinded.units = fixture.blinded.units.filter((u) => !removed.includes(u.id));
  fixture.votes = fixture.votes.filter((v) => !removed.includes(v.unit));
}

function endAdmissionFixtureCell(fixture, cell) {
  const validity = { valid: false, cause: 'behaviour', detail: 'Static disposition fixture; no failure was executed.' };
  cell.valid = false;
  Object.assign(cell.attempts[0], { validity, endedAt: 'answer' });
  cell.attempts[0].phases[0].validity = validity;
  cell.answers = {};
  cell.phaseOutcomes = {};
  for (const pp of Object.values(cell.propertyPhases)) pp.state = 'ended';
  discardAdmissionCellJudging(fixture, cell);
}

test('Admission accounting preserves all identities and does not issue its own gate verdict', () => {
  const report = accountAdmissionComparison(admissionAccountingFixture());
  assert.deepEqual(report.issues, []);
  assert.equal(report.complete, true);
  assert.equal(report.outcomeCount, 144);
  assert.equal(report.intendedVoteSlots, 288);
  assert.equal(report.castVotes, 288);
  assert.equal(new Set(report.rows.map((r) => `${r.cell}.${r.property}`)).size, 144);
  assert.equal(new Set(report.rows.flatMap((r) => r.slots.map((s) => `${r.cell}.${r.property}.${s.judge}`))).size, 288);
  assert.match(report.mechanicalDisposition, /INDEPENDENT REVIEW REQUIRED/);
});

test('Admission missing null, undefined and blank answers become explicit uncast zeroes', () => {
  for (const missing of [null, undefined, '', '  \n ']) {
    const f = admissionAccountingFixture(), cell = f.cells[0];
    cell.answers.a01 = missing;
    discardAdmissionCellJudging(f, cell, 'a01');
    f.blinded.absent.push({ cell: cell.cell, property: 'a01' });
    const report = accountAdmissionComparison(f), row = report.rows[0];
    assert.equal(report.complete, true);
    assert.equal(row.score, 0);
    assert.ok(row.slots.every((s) => s.status === 'not cast: missing answer' && s.value === null));
    assert.equal(report.castVotes, 286);
  }
});

test('Admission valid phase with no answer file accounts for all twenty-four missing answers', () => {
  const f = admissionAccountingFixture(), cell = f.cells[0];
  cell.phaseOutcomes.answer.scored = null;
  cell.scoredFile.content = null;
  for (const property of f.scenario.properties) {
    cell.answers[property.id] = null;
    f.blinded.absent.push({ cell: cell.cell, property: property.id });
  }
  discardAdmissionCellJudging(f, cell);
  const report = accountAdmissionComparison(f);
  assert.equal(report.complete, true);
  assert.equal(report.castVotes, 240);
  assert.ok(report.rows.filter((r) => r.cell === cell.cell).every((r) => r.score === 0 && r.slots.every((s) => s.status === 'not cast: missing answer')));
});

test('Admission ended sole phase ignores retained partial or complete raw answers', () => {
  for (const text of ['partial text', 'complete raw text under every heading']) {
    const f = admissionAccountingFixture(), cell = f.cells[0];
    endAdmissionFixtureCell(f, cell);
    cell.scoredFile.content = text;
    const report = accountAdmissionComparison(f), rows = report.rows.filter((r) => r.cell === cell.cell);
    assert.equal(report.complete, true);
    assert.equal(rows.length, 24);
    assert.ok(rows.every((r) => r.score === 0 && r.slots.every((s) => s.status === 'not cast: ended phase')));
    assert.equal(report.castVotes, 240);
    assert.equal(report.numericConditions.candidateThresholdsMet, false);
  }
});

test('Admission predecessor behavior failure does not automatically fail candidate thresholds', () => {
  const f = admissionAccountingFixture();
  endAdmissionFixtureCell(f, f.cells.find((c) => c.arm === 'x19'));
  const report = accountAdmissionComparison(f);
  assert.equal(report.complete, true);
  assert.ok(Object.values(report.numericConditions).every(Boolean));
});

test('Admission invalid required evidence takes precedence over numerical failure', () => {
  const f = admissionAccountingFixture();
  endAdmissionFixtureCell(f, f.cells[0]);
  f.cells[1].propertyPhases.a01.state = 'incomplete';
  const report = accountAdmissionComparison(f);
  assert.equal(report.numericConditions.candidateThresholdsMet, false);
  assert.equal(report.complete, false);
  assert.equal(report.mechanicalDisposition, 'NO VERDICT');
});

test('Admission accounting rejects missing or duplicate cells, probes, votes and invalid provenance', () => {
  const mutations = [
    (f) => f.cells.pop(),
    (f) => { f.cells[0] = f.cells[1]; },
    (f) => f.record.population.pop(),
    (f) => { f.record.probes[0] = f.record.probes[1]; },
    (f) => f.record.judgeProbes.pop(),
    (f) => { f.record.probes[0].answers[0].toolCalls = 1; },
    (f) => { f.record.probes[0].pass = false; },
    (f) => f.votes.pop(),
    (f) => f.votes.push({ ...f.votes[0] }),
    (f) => { f.votes[0].value = 3; },
    (f) => { f.votes[0].value = null; },
    (f) => { f.votes[0].judge = 'c'; },
    (f) => { f.votes[0].family = 'wrong'; },
    (f) => { delete f.judgments[f.votes[0].prompt]; },
    (f) => { f.judgments[f.votes[0].prompt].replies[0].tools = 1; },
    (f) => f.blinded.units.push({ ...f.blinded.units[0] }),
    (f) => { f.blinded.units[0].member = 'g'; },
    (f) => { f.record.method.revision = 'wrong'; },
    (f) => { f.record.register.recordedAt = f.record.states[0].at; },
    (f) => { f.record.snapshot = structuredClone(f.record.snapshot); f.record.snapshot.scenarios[0].task += ' changed'; },
    (f) => { f.cells[0].attempts.push({ ...f.cells[0].attempts[0], attempt: 2 }); },
    (f) => { f.provenanceIssues = ['static input mismatch']; },
  ];
  for (const [i, mutate] of mutations.entries()) {
    const f = admissionAccountingFixture(); mutate(f);
    const report = accountAdmissionComparison(f);
    assert.equal(report.complete, false, `mutation ${i}`);
    assert.equal(report.mechanicalDisposition, 'NO VERDICT', `mutation ${i}`);
    assert.equal(report.outcomeCount, 144, `mutation ${i}`);
    assert.equal(report.intendedVoteSlots, 288, `mutation ${i}`);
  }
});

test('Admission unresolved infrastructure/isolation or incomplete phase never becomes a reader zero', () => {
  for (const cause of ['infrastructure', 'isolation']) {
    const f = admissionAccountingFixture(), cell = f.cells[0];
    const validity = { valid: false, cause, detail: 'Static unresolved fixture.' };
    cell.valid = false;
    cell.attempts[0].validity = validity;
    cell.attempts[0].phases[0].validity = validity;
    for (const pp of Object.values(cell.propertyPhases)) pp.state = 'incomplete';
    discardAdmissionCellJudging(f, cell);
    const report = accountAdmissionComparison(f);
    assert.equal(report.complete, false);
    assert.ok(report.rows.filter((r) => r.cell === cell.cell).every((r) => r.score === null));
  }
});

test('Admission accounting accepts one infrastructure retry but not a behavior retry', () => {
  const f = admissionAccountingFixture(), cell = f.cells[0];
  const first = structuredClone(cell.attempts[0]);
  first.validity = { valid: false, cause: 'infrastructure', detail: 'Static retry fixture.' };
  first.phases[0].validity = first.validity;
  cell.attempts[0].attempt = 2;
  cell.attempts.unshift(first);
  assert.equal(accountAdmissionComparison(f).complete, true);
  first.validity.cause = 'behaviour';
  assert.equal(accountAdmissionComparison(f).complete, false);
});

test('Admission minimum-vote and quote caps are downward-only and inspect every excerpt', () => {
  const f = admissionAccountingFixture();
  f.votes[0].value = 0;
  f.cells[0].answers.a01 += '\nQUOTE: "not in source"';
  let row = accountAdmissionComparison(f).rows[0];
  assert.equal(row.score, 0);
  assert.equal(row.quoteCheck.cap, 1);
  f.votes[0].value = 2;
  row = accountAdmissionComparison(f).rows[0];
  assert.equal(row.score, 1);
  for (const answer of ['No excerpt', 'QUOTE: broken', 'QUOTE: ""', 'QUOTE: "Fixture ... source."', '- QUOTE: "Fixture source."', 'Quote: "Fixture source."']) assert.equal(checkAdmissionComparisonQuotes(answer, 'Fixture source.').cap, 1);
  assert.equal(checkAdmissionComparisonQuotes('QUOTE: "Fixture source."', 'Fixture\nsource.').cap, 2);
});

test('Admission diagnostic formatting cannot invalidate or improve an accepted score', () => {
  const f = admissionAccountingFixture();
  f.votes[0].reason = 'No structured tags; retain this reason.';
  const report = accountAdmissionComparison(f);
  assert.equal(report.complete, true);
  assert.equal(report.rows[0].score, 2);
  assert.deepEqual(report.rows[0].slots[0].diagnostics, { DECISION: null, COVERAGE: null, SUPPORT: null, HEDGE: null });
  assert.equal(readAdmissionComparisonDiagnostics('HEDGE=yes; HEDGE=no').HEDGE, null);
});

test('Admission ties and each individual control regression are not averaged away', () => {
  const f = admissionAccountingFixture();
  for (const vote of f.votes) vote.value = 2;
  assert.equal(accountAdmissionComparison(f).numericConditions.strictImprovement, false);
  f.votes[0].value = 1;
  const report = accountAdmissionComparison(f);
  assert.equal(report.complete, true);
  assert.equal(report.numericConditions.candidateThresholdsMet, true);
  assert.equal(report.numericConditions.noControlRegression, false);
});
