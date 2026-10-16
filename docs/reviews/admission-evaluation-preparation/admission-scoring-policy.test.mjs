// Development checks of diagnostics, NOT observations of model comprehension.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ADMISSION_JUDGE_INSTRUCTIONS, ADMISSION_PROPERTY_RUBRIC, checkAdmissionJudgment } from './admission-scoring-policy.mjs';

const good = 'DECISION=correct; COVERAGE=complete; SUPPORT=supported; HEDGE=no; REQUIRED=none; ISSUE=none; WHY=Both required decisions are correct and grounded.';
const check = (score, reason, requiredDecisionIds = ['R1', 'R2']) => checkAdmissionJudgment({ score, reason, requiredDecisionIds });

test('Admission policy explicitly separates proposed status from required-decision uncertainty', () => {
  assert.match(ADMISSION_JUDGE_INSTRUCTIONS, /proposals, not implemented or adopted contracts/);
  assert.match(ADMISSION_JUDGE_INSTRUCTIONS, /that status statement alone is no penalty/);
  assert.match(ADMISSION_JUDGE_INSTRUCTIONS, /does not excuse withholding, omitting/);
  assert.match(ADMISSION_PROPERTY_RUBRIC, /no additional scoring rule/);
});

test('Admission diagnostic fixtures cover full credit, status, omission, support, uncertainty, conflict, wrong and absent', () => {
  const cases = [
    [2, good],
    [2, good.replace('Both required decisions are correct and grounded.', 'Both decisions are grounded; the proposal is not adopted yet.')],
    [1, 'DECISION=correct; COVERAGE=incomplete; SUPPORT=supported; HEDGE=no; REQUIRED=R2; ISSUE=omission; WHY=R2 is omitted.'],
    [1, 'DECISION=correct; COVERAGE=complete; SUPPORT=none; HEDGE=no; REQUIRED=R1,R2; ISSUE=support; WHY=Neither decision has quoted support.'],
    [1, 'DECISION=withheld; COVERAGE=complete; SUPPORT=supported; HEDGE=yes; REQUIRED=R2; ISSUE=uncertainty; WHY=The answer leaves R2 unsettled.'],
    [1, 'DECISION=withheld; COVERAGE=complete; SUPPORT=supported; HEDGE=yes; REQUIRED=R2; ISSUE=conflict; WHY=The answer reports incompatible rules for R2.'],
    [0, 'DECISION=wrong; COVERAGE=complete; SUPPORT=supported; HEDGE=no; REQUIRED=R1; ISSUE=wrong-decision; WHY=R1 gives thirty days when the key requires seven.'],
    // Checker-only absence diagnostic: a real missing answer is never submitted for a judge vote.
    [0, 'DECISION=missing; COVERAGE=incomplete; SUPPORT=none; HEDGE=no; REQUIRED=all; ISSUE=no-answer; WHY=The entire answer is absent.'],
  ];
  for (const [score, reason] of cases) {
    const result = check(score, reason);
    assert.deepEqual(result.issues, [], reason);
    assert.deepEqual(result.original, { score, reason });
  }
});

test('Admission checker detects score/reason contradictions in both favorable and unfavorable directions', () => {
  assert.match(check(1, good).issues.join('\n'), /penalty contradicts/);
  assert.match(check(0, good).issues.join('\n'), /zero is not justified/);
  const unsure = 'DECISION=withheld; COVERAGE=complete; SUPPORT=supported; HEDGE=yes; REQUIRED=R2; ISSUE=uncertainty; WHY=R2 remains unsettled.';
  assert.deepEqual(check(1, unsure).issues, []);
  assert.match(check(2, unsure).issues.join('\n'), /full credit contradicts/);
  assert.match(check(0, unsure).issues.join('\n'), /zero is not justified/);
  const wrong = 'DECISION=wrong; COVERAGE=complete; SUPPORT=supported; HEDGE=no; REQUIRED=R1; ISSUE=wrong-decision; WHY=R1 is wrong.';
  assert.deepEqual(check(0, wrong).issues, []);
  assert.match(check(1, wrong).issues.join('\n'), /requires zero/);
  assert.match(check(2, wrong).issues.join('\n'), /requires zero/);
});

test('Admission checker refuses malformed diagnostics without dropping or rewriting the original', () => {
  const reasons = [null, '', good.replace('COVERAGE=complete;', 'COVERAGE=complete; COVERAGE=incomplete;'), good.replace('WHY=Both required decisions are correct and grounded.', 'WHY=')];
  for (const reason of reasons) {
    const result = check(2, reason);
    assert.ok(result.issues.length);
    assert.deepEqual(result.original, { score: 2, reason });
  }
  for (const score of [-1, 3, 1.5, '2', null]) assert.ok(check(score, good).issues.length);
  for (const ids of [[], ['R1', 'R1'], ['X1'], null]) assert.ok(check(2, good, ids).issues.length);
});

test('Admission negative fixtures prove required-ID and issue-tag checks discriminate', () => {
  const omission = 'DECISION=correct; COVERAGE=incomplete; SUPPORT=supported; HEDGE=no; REQUIRED=R2; ISSUE=omission; WHY=R2 is omitted.';
  assert.deepEqual(check(1, omission).issues, []);
  for (const reason of [
    omission.replace('REQUIRED=R2;', 'REQUIRED=R3;'),
    omission.replace('REQUIRED=R2;', 'REQUIRED=R2,R2;'),
    omission.replace('REQUIRED=R2;', 'REQUIRED=all;'),
    omission.replace('REQUIRED=R2;', 'REQUIRED=none;'),
    omission.replace('ISSUE=omission;', 'ISSUE=none;'),
    omission.replace('ISSUE=omission;', 'ISSUE=omission,omission;'),
    omission.replace('ISSUE=omission;', 'ISSUE=uncertainty;'),
    omission.replace('COVERAGE=incomplete;', 'COVERAGE=complete;'),
    omission.replace('SUPPORT=supported;', 'SUPPORT=partial;'),
    omission.replace('HEDGE=no;', 'HEDGE=yes;'),
  ]) {
    assert.notEqual(reason, omission, 'mutation must actually apply');
    assert.ok(check(1, reason).issues.length, reason);
  }
});

test('Admission clean diagnostics do not establish semantic validity or approve a vote', () => {
  const falseHedge = 'DECISION=withheld; COVERAGE=complete; SUPPORT=supported; HEDGE=yes; REQUIRED=R2; ISSUE=uncertainty; WHY=The answer calls the complete proposed rule a recommendation rather than adopted behavior.';
  assert.deepEqual(check(1, falseHedge).issues, [], 'meaning requires non-author review, not a keyword repair');
  assert.equal('verdict' in check(1, falseHedge), false);
  assert.equal('repairedScore' in check(1, falseHedge), false);
});

test('Admission wrong-decision precedence retains a different required conflict without raising zero', () => {
  const reason = 'DECISION=wrong; COVERAGE=complete; SUPPORT=partial; HEDGE=yes; REQUIRED=R1,R2; ISSUE=wrong-decision,support,conflict; WHY=R1 contradicts its source while R2 is withheld because of conflicting source rules.';
  const result = check(0, reason);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.original, { score: 0, reason });
  for (const score of [1, 2]) assert.match(check(score, reason).issues.join('\n'), /requires zero/);
  assert.match(check(0, reason.replace('DECISION=wrong;', 'DECISION=withheld;')).issues.join('\n'), /wrong-decision issue and decision tag disagree/);
});

test('Admission unrelated semantic cases preserve literal expected distinctions for independent review', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('./admission-scoring-cases.json', import.meta.url), 'utf8'));
  assert.deepEqual(fixture.cases.map((c) => [c.id, c.expectedRawScore]), [
    ['complete', 2], ['accurate-status', 2], ['status-with-required-uncertainty', 1],
    ['omitted-decision', 1], ['unsupported-decision', 1], ['wrong-decision', 0], ['wrong-with-separate-conflict', 0], ['absent-answer', null],
  ]);
  for (const example of fixture.cases) {
    if (example.answer === null) {
      assert.equal(example.expectedOutcomeScore, 0);
      assert.equal(example.expectedVoteStatus, 'not cast: missing answer');
      assert.equal('reason' in example, false, 'absent answer has no invented judge vote');
      continue;
    }
    // These are declared expectations. Independent review, not this structural test,
    // decides whether each expected score is semantically warranted by the case.
    assert.deepEqual(check(example.expectedRawScore, example.reason, fixture.requiredDecisionIds).issues, [], example.id);
    for (const match of example.answer.matchAll(/^QUOTE: (.+)$/gm)) {
      assert.ok((example.document ?? fixture.document).includes(JSON.parse(match[1])), 'development excerpt must match the source');
    }
  }
});
