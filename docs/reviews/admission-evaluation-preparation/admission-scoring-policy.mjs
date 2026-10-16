// Prospective project policy, not an evaluator fork or an AGP runtime dependency.

/** The single scoring policy delivered to every admission-comprehension judge. */
export const ADMISSION_JUDGE_INSTRUCTIONS = `COMMON CONTEXT
Both supplied source documents are proposals, not implemented or adopted contracts.
Judge only the supplied question, numbered required decisions, rubric and answer; do not infer reader identity, document version or order.

SCORING
2: Every required decision is correct, complete and supported by decisive supplied-document excerpts, with no required decision withheld or left uncertain.
1: No wrong/unsafe required decision, but a required decision is omitted, explicitly uncertain, materially conflicting or lacks decisive source support.
0: A wrong/unsafe required decision or no answer; a safe refusal to invent missing authority is 1, not 0.
Several short excerpts may jointly entail a decision; do not require preferred wording, one quotation per clause or unasked detail.
Never supply a missing rule from outside knowledge or infer unquoted document contents.
A faithful quotation of an unsafe instruction is document inadequacy, not reader invention; the required-decision score still applies.
Exact-source quotation matching is a separate project check that caps safe outcomes at 1 and never raises a 0; do not claim to have checked unseen source text.

REQUIRED-DECISION UNCERTAINTY
A hedge is uncertainty about an explicitly asked required decision, not an accurate statement of proposal/adoption/implementation status or an intended scope exclusion.
An answer may correctly specify proposed behavior and also say it is not yet adopted: that status statement alone is no penalty.
Conversely, merely mentioning proposal status does not excuse withholding, omitting, contradicting or failing to support an asked decision.

REASON CONTRACT
In the reason string use this exact prefix order, then a concrete one-sentence explanation:
DECISION=correct|wrong|withheld|missing; COVERAGE=complete|incomplete; SUPPORT=supported|partial|none; HEDGE=yes|no; REQUIRED=none|all|R1,R2; ISSUE=none|wrong-decision,no-answer,omission,uncertainty,support,conflict; WHY=<explanation>
Choose one value per diagnostic field, and only applicable comma-separated entries for REQUIRED and ISSUE, without duplicates or spaces within a list.
REQUIRED lists the actual numbered decisions affected by a penalty; use none for full credit and all only for a wholly absent answer.
ISSUE lists actual deficiencies, never proposal status; use none for full credit.
DECISION=missing means a wholly absent answer, not an omitted part of a present answer.
An omission has COVERAGE=incomplete; inadequate support has SUPPORT=partial or none; required uncertainty has HEDGE=yes.
Any wrong required decision takes aggregate DECISION=wrong precedence and scores 0, even when another required decision is withheld or conflicting.
A material unresolved conflict has HEDGE=yes and DECISION=withheld unless a wrong decision takes that precedence; retain every affected decision and issue.
A withheld decision needs uncertainty or conflict.
No-answer uses DECISION=missing, COVERAGE=incomplete, SUPPORT=none, HEDGE=no, REQUIRED=all and ISSUE=no-answer.
Full credit uses correct, complete, supported, no, none and none respectively.
Each penalty must name its affected required decisions and explain the concrete deficiency against the question and key.
These tags describe your reasoning; they are not a second score or proof that the explanation is true.
`;

/** Properties refer to the common policy rather than carrying a competing rubric. */
export const ADMISSION_PROPERTY_RUBRIC = 'Apply the common SCORING, REQUIRED-DECISION UNCERTAINTY and REASON CONTRACT above to every numbered required decision; no additional scoring rule applies.';

const REASON_PREFIX = /^DECISION=(correct|wrong|withheld|missing); COVERAGE=(complete|incomplete); SUPPORT=(supported|partial|none); HEDGE=(yes|no); REQUIRED=(none|all|R[1-9]\d*(?:,R[1-9]\d*)*); ISSUE=(none|(?:wrong-decision|no-answer|omission|uncertainty|support|conflict)(?:,(?:wrong-decision|no-answer|omission|uncertainty|support|conflict))*); WHY=(\S[\s\S]*)$/;

/** Flag decidable contradictions in a RAW judge vote, before quote caps; never repair its score. */
export function checkAdmissionJudgment({ score, reason, requiredDecisionIds }) {
  const issues = [];
  const original = { score, reason };
  if (!Number.isInteger(score) || score < 0 || score > 2) issues.push('score must be an integer from 0 to 2');
  if (!Array.isArray(requiredDecisionIds) || !requiredDecisionIds.length ||
      requiredDecisionIds.some((id) => typeof id !== 'string' || !/^R[1-9]\d*$/.test(id)) ||
      new Set(requiredDecisionIds).size !== requiredDecisionIds.length) {
    issues.push('required-decision inventory must contain distinct numbered IDs');
    return { original, issues };
  }
  const match = typeof reason === 'string' ? REASON_PREFIX.exec(reason) : null;
  if (!match) return { original, issues: [...issues, 'reason does not match the diagnostic contract'] };
  const [, decision, coverage, support, hedge, required, issue, why] = match;
  const affected = required === 'none' || required === 'all' ? [] : required.split(',');
  const defects = issue === 'none' ? [] : issue.split(',');
  const has = (name) => defects.includes(name);
  const flag = (condition, message) => { if (condition) issues.push(message); };
  flag(new Set(affected).size !== affected.length, 'duplicate affected decision');
  flag(affected.some((id) => !requiredDecisionIds.includes(id)), 'affected decision is not in the key');
  flag(new Set(defects).size !== defects.length, 'duplicate issue');
  flag((required === 'none') !== (defects.length === 0), 'affected decisions and issues disagree');
  const full = decision === 'correct' && coverage === 'complete' && support === 'supported' && hedge === 'no' && required === 'none' && defects.length === 0;
  flag(score === 2 && !full, 'full credit contradicts the diagnostic fields');
  flag(score !== 2 && full, 'penalty contradicts wholly correct, complete, grounded and settled diagnostics');
  flag(score < 2 && (required === 'none' || defects.length === 0), 'penalty lacks affected decisions or an issue');
  flag((decision === 'wrong') !== has('wrong-decision'), 'wrong-decision issue and decision tag disagree');
  flag((decision === 'missing') !== has('no-answer'), 'no-answer issue and decision tag disagree');
  flag((has('wrong-decision') || has('no-answer')) && score !== 0, 'wrong decision or no answer requires zero');
  flag(score === 0 && !has('wrong-decision') && !has('no-answer'), 'zero is not justified by a wrong decision or no answer');
  if (has('no-answer')) {
    flag(required !== 'all' || defects.length !== 1 || coverage !== 'incomplete' || support !== 'none' || hedge !== 'no', 'no-answer diagnostics disagree');
  } else {
    flag(required === 'all', 'all is reserved for a wholly absent answer');
    flag((coverage === 'incomplete') !== has('omission'), 'omission issue and coverage tag disagree');
    flag((support !== 'supported') !== has('support'), 'support issue and support tag disagree');
    flag((hedge === 'yes') !== (has('uncertainty') || has('conflict')), 'uncertainty/conflict issue and hedge tag disagree');
    flag(has('conflict') && decision !== 'withheld' && decision !== 'wrong', 'unresolved conflict needs withholding unless a wrong decision takes precedence');
    flag(decision === 'withheld' && !has('uncertainty') && !has('conflict'), 'withheld decision lacks uncertainty or conflict');
  }
  return { original, issues, diagnostics: { decision, coverage, support, hedge, required, issue, why } };
}
