/** Reject noncanonical admission responses without producing replacement answers. */
export function checkAdmissionShape(raw, headings) {
  if (!raw.trim()) return { kind: 'whole-empty', findings: [] };
  const found = [...raw.matchAll(/^\s*#{1,6}\s+.*$/gm)].map(m => m[0].trim());
  const expected = [...headings, 'OBSERVATIONS'].map(h => `### ${h}`);
  const findings = [];
  if (JSON.stringify(found) !== JSON.stringify(expected)) findings.push('heading-sequence');
  if (!raw.startsWith(expected[0] + '\n')) findings.push('leading-material');
  if (/^\s*(```|~~~)/m.test(raw)) findings.push('fenced-block');
  let section = null, content = false, labels = [];
  const finish = () => {
    if (section && section !== 'OBSERVATIONS' && content && labels.join('|') !== 'Decision|Document support|Inference or gap') findings.push(`answer-labels:${section}`);
  };
  for (const line of raw.split('\n')) {
    if (line.startsWith('### ')) { finish(); section = line.slice(4); content = false; labels = []; }
    else if (section) {
      if (line.trim()) content = true;
      const label = /^(Decision|Document support|Inference or gap):/.exec(line);
      if (label) labels.push(label[1]);
    }
  }
  finish();
  // A shape check does not infer omitted content or repair/extract answer text.
  for (const line of raw.split('\n').filter(line => line.startsWith('QUOTE:'))) {
    try {
      const quote = JSON.parse(line.slice(6).trim());
      if (typeof quote !== 'string' || !quote.length) findings.push('invalid-quote');
    } catch { findings.push('invalid-quote'); }
  }
  return { kind: findings.length ? 'noncanonical' : 'canonical-candidate', findings };
}

/** Check exact quotations in a public-extracted answer; never infer entailment. */
export function checkAdmissionQuotes(publicAnswer, assignedReading) {
  const lines = publicAnswer.split('\n').filter(line => line.startsWith('QUOTE:'));
  if (!lines.length) return false;
  return lines.every(line => {
    try {
      const quote = JSON.parse(line.slice(6).trim());
      return typeof quote === 'string' && quote.length > 0 && assignedReading.includes(quote);
    } catch { return false; }
  });
}

/** Evaluate admission totals from an independently reconciled public-record ledger. */
export function evaluateAdmissionGate(key, ledger) {
  const roles = ['old', 'candidate', 'none'];
  const members = ['c', 'g', 'o'];
  const expected = new Set(key.probes.flatMap(q => roles.flatMap(arm => members.map(member => `${q.id}/${arm}/${member}`))));
  const findings = [];
  if (ledger.interrupted === true) findings.push('interrupted-comparison');
  const rows = new Map();
  let cast = 0, uncast = 0;
  for (const row of ledger.rows ?? []) {
    const id = `${row.probe}/${row.arm}/${row.member}`;
    if (!expected.has(id) || rows.has(id)) { findings.push(`unexpected-or-duplicate:${id}`); continue; }
    const value = { d: null, g: null, present: row.status === 'present', faithful: row.faithful === true && row.eligible === true };
    rows.set(id, value);
    if (!row.evidence || !value.faithful) findings.push(`unreconciled:${id}`);
    const judges = members.filter(m => m !== row.member);
    const scores = {};
    for (const axis of ['d', 'g']) {
      const votes = row.votes?.[axis];
      const validPanel = Array.isArray(votes) && votes.length === 2 && new Set(votes.map(v => v.judge)).size === 2 && votes.every(v => judges.includes(v.judge));
      if (!validPanel) { findings.push(`vote-identities:${id}/${axis}`); continue; }
      if (row.status === 'absent') {
        const proved = ['whole-response', 'empty-section'].includes(row.absence) && value.faithful && row.evidence;
        if (!proved || votes.some(v => v.value !== null || v.attempt !== null)) findings.push(`unproved-absence:${id}/${axis}`);
        else { scores[axis] = 0; uncast += 2; }
      } else if (row.status === 'present') {
        const accepted = votes.every(v => Number.isInteger(v.value) && v.value >= 0 && v.value <= (axis === 'd' ? 1 : 2) && [1, 2, 3].includes(v.attempt) && v.reason && v.evidence && v.eligible === true);
        if (!accepted) findings.push(`missing-or-invalid-vote:${id}/${axis}`);
        else { scores[axis] = Math.min(...votes.map(v => v.value)); cast += 2; }
      } else findings.push(`unknown-answer:${id}`);
    }
    if (scores.g === 2 && scores.d === 0) findings.push(`axis-contradiction:${id}`);
    if (row.status === 'present' && typeof row.quoteValid !== 'boolean') findings.push(`unverified-quotes:${id}`);
    value.d = scores.d ?? null;
    value.g = scores.g === undefined ? null : row.status === 'absent' || row.quoteValid === true ? scores.g : Math.min(scores.g, 1);
  }
  for (const id of expected) if (!rows.has(id)) findings.push(`missing-answer:${id}`);
  const dimensions = ['delivery', 'isolation', 'extraction', 'records', 'scoring', 'observations', 'ambiguity'];
  if (ledger.review?.status !== 'PASS' || !ledger.review?.report || dimensions.some(d => ledger.review[d] !== true)) findings.push('independent-validity-review-incomplete');
  const perProbe = key.probes.map(q => {
    const byArm = Object.fromEntries(roles.map(arm => [arm, members.map(member => rows.get(`${q.id}/${arm}/${member}`))]));
    const total = (arm, axis) => byArm[arm].every(r => r && r[axis] !== null) ? byArm[arm].reduce((n, r) => n + r[axis], 0) : null;
    const totals = Object.fromEntries(roles.map(arm => [arm, { d: total(arm, 'd'), g: total(arm, 'g') }]));
    const difference = axis => totals.candidate[axis] === null || totals.old[axis] === null ? null : totals.candidate[axis] - totals.old[axis];
    const allNine = Object.values(byArm).flat().every(r => r?.present && r.faithful && r.d !== null && r.g !== null);
    const separating = allNine && (Math.abs(totals.old.d - totals.none.d) >= 1 || Math.abs(totals.candidate.d - totals.none.d) >= 1);
    const floor = byArm.candidate.every(r => r && r.g !== null && r.g !== 0) && byArm.candidate.filter(r => r?.g === 2).length >= 2;
    return { probe: q.id, class: q.class, duties: q.duties, totals, difference: { d: difference('d'), g: difference('g') }, separating, floor };
  });
  const covered = new Set(perProbe.filter(q => q.separating).flatMap(q => q.duties));
  const failures = [];
  for (const q of perProbe) {
    if (!q.floor) failures.push(`candidate-floor:${q.probe}`);
    for (const axis of ['d', 'g']) if (q.difference[axis] !== null && q.difference[axis] < 0) failures.push(`regression:${q.probe}/${axis}`);
  }
  for (const duty of key.duties) if (!covered.has(duty)) failures.push(`uncovered:${duty}`);
  if (!perProbe.some(q => q.separating && q.difference.g > 0)) failures.push('no-separating-grounded-improvement');
  return { verdict: findings.length ? 'NO VERDICT' : failures.length ? 'FAIL' : 'PASS', findings, failures, perProbe,
    accounting: { expectedAnswers: expected.size, receivedAnswers: rows.size, expectedAxes: expected.size * 2, expectedVoteSlots: expected.size * 4, cast, uncast, unresolvedSlots: expected.size * 4 - cast - uncast } };
}
