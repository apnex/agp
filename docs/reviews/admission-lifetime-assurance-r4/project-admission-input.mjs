// Project the admission mechanism text identically while withholding review/version history.
import assert from 'node:assert/strict';

const NEUTRAL_INTRODUCTION = "# Admission lifetime design\n\nStatus: proposed behavior, not adopted or implemented.\\\nPurpose: let an implementer decide admission authority, retained work, ordering, cleanup, recovery and migration from this document.\\\nThe source-baseline table describes existing implementation observations; the remaining design mechanics are proposed requirements.\n\nAGP should end an admission attempt without waiting for the provider to finish, while continuing to account for unfinished provider work.\\\nUse one admission-lifetime mechanism for identity and route policy, with a reader that never awaits a provider and a bounded queue for subsequent wire commands.\\\nNeither a browser-specific controller nor a change to credential policy is required.\n\n---\n\n## Authority and scope\n\nThe fixed outcome is bounded session admission and teardown, not a new authentication scheme.\\\nRecommendations are technical proposals and do not authorize new public surfaces or runtime implementation.\n\n";

/** Produce a neutral admission design, retaining all mechanism text and link labels. */
export function projectAdmissionDesign(source) {
  const start = source.indexOf('| Included | Excluded |\n');
  const end = source.indexOf('\n---\n\n## Review gate and handoff\n');
  assert.ok(start >= 0 && end > start, 'Admission projection section boundaries missing');
  let body = source.slice(start, end);
  const checkpoint = body.indexOf('Source checkpoint: ');
  const baseline = body.indexOf('| Boundary | Observed implementation | Design consequence |');
  assert.ok(checkpoint >= 0 && baseline > checkpoint, 'Admission projection baseline boundaries missing');
  body = body.slice(0, checkpoint) + body.slice(baseline);
  return NEUTRAL_INTRODUCTION + body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trimEnd() + '\n';
}
