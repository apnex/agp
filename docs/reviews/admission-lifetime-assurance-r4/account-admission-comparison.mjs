// Admission comparison accounting: preserve the declared 144 outcomes and 288 intended vote slots.
// This derives mechanical scores from retained records, never model answers or an independent verdict.
import { isDeepStrictEqual } from 'node:util';
import { admissionJudgmentEvidenceIdentity } from './replay-admission-judgments.mjs';

const normalizeAdmissionWhitespace = (text) => text.replace(/\s+/g, ' ').trim();

// Exact-source fidelity is separate from whether the quoted premises entail the reader's decision.
export function checkAdmissionComparisonQuotes(answer, source) {
  const excerpts = answer.split('\n').filter((line) => /QUOTE\s*:/i.test(line)).map((line) => {
    try {
      const quote = line.startsWith('QUOTE:') ? JSON.parse(line.slice(6).trim()) : null;
      const valid = typeof quote === 'string' && normalizeAdmissionWhitespace(quote).length > 0;
      return { line, valid, matches: valid && normalizeAdmissionWhitespace(source).includes(normalizeAdmissionWhitespace(quote)) };
    } catch {
      return { line, valid: false, matches: false };
    }
  });
  return { absent: excerpts.length === 0, excerpts, cap: excerpts.length > 0 && excerpts.every((e) => e.matches) ? 2 : 1 };
}

// Invalid diagnostic tags remain unknown. They do not invalidate an otherwise accepted numeric vote.
export function readAdmissionComparisonDiagnostics(reason) {
  const fields = { DECISION: ['correct', 'wrong', 'withheld', 'missing'], COVERAGE: ['complete', 'incomplete'], SUPPORT: ['supported', 'partial', 'none'], HEDGE: ['yes', 'no'] };
  return Object.fromEntries(Object.entries(fields).map(([key, values]) => {
    const matches = [...String(reason).matchAll(new RegExp(`\\b${key}=([^;\\s]+)`, 'g'))];
    return [key, matches.length === 1 && values.includes(matches[0][1]) ? matches[0][1] : null];
  }));
}

// Require the full declared reader/judge probe identities, not merely nine favorable booleans.
export function admissionComparisonProbeIssues(record, pack, experiment, canaryQuestion) {
  const issues = [];
  if (typeof canaryQuestion !== 'string' || !canaryQuestion) issues.push('pinned public canary question is unavailable');
  const expectedReaders = experiment.factors.arms.flatMap((arm) => experiment.factors.population.map((member) => `${arm}.${member}`));
  const expectedJudges = experiment.judging.judges.map((member) => `judges.${member}`);
  for (const [kind, probes, expected] of [['reader', record.probes ?? [], expectedReaders], ['judge', record.judgeProbes ?? [], expectedJudges]]) {
    if (!isDeepStrictEqual(probes.map((p) => `${p.arm}.${p.member}`).sort(), [...expected].sort())) issues.push(`${kind} probe identities are incomplete, duplicated or unexpected`);
    for (const probe of probes) {
      if (probe.pass !== true || probe.reasons?.length !== 0) issues.push(`${kind} probe ${probe.arm}.${probe.member} did not pass`);
      const leaks = pack.isolation.leakProbes.filter((p) => kind === 'judge' || p.arms.includes(probe.arm));
      const expectedAnswers = ['canary:canary', ...leaks.map((p) => `leak:${p.id}`)].sort();
      if (!isDeepStrictEqual((probe.answers ?? []).map((a) => `${a.kind}:${a.probe}`).sort(), expectedAnswers)) issues.push(`${kind} probe ${probe.arm}.${probe.member} lacks its recorded questions`);
      if (!(probe.answers ?? []).some((a) => a.answered) || (probe.answers ?? []).some((a) => a.toolCalls !== 0 || !['ok', 'unanswered'].includes(a.finding))) issues.push(`${kind} probe ${probe.arm}.${probe.member} has invalid delivery/isolation evidence`);
      if (kind === 'reader' && !probe.answers?.some((a) => a.kind === 'canary' && a.answered && a.finding === 'ok')) issues.push(`${kind} probe ${probe.arm}.${probe.member} lacks canary delivery`);
      const delivered = new Set(pack.arms.find((a) => a.id === probe.arm)?.deliver.map((d) => d.variant) ?? []);
      const canaries = kind === 'reader' ? pack.variants.filter((v) => delivered.has(v.id)).flatMap((v) => v.canaries) : [];
      const foreign = kind === 'reader' ? pack.variants.filter((v) => !delivered.has(v.id)).flatMap((v) => v.canaries) : [];
      for (const answer of probe.answers ?? []) {
        const leak = leaks.find((p) => p.id === answer.probe);
        const expectedQuestion = answer.kind === 'canary' ? canaryQuestion : leak ? `Do not use any tools. Answer in one line. ${leak.question}` : null;
        if (typeof answer.final !== 'string' || typeof answer.answered !== 'boolean' || !Number.isInteger(answer.toolCalls) || answer.question !== expectedQuestion) issues.push(`${kind} probe ${probe.arm}.${probe.member}: raw question/response provenance missing or different`);
        const final = typeof answer.final === 'string' ? answer.final : '';
        if (answer.answered && (!final.trim() || answer.toolCalls !== 0)) issues.push(`${kind} probe ${probe.arm}.${probe.member}: answered flag contradicts raw response`);
        let finding = answer.answered ? 'ok' : 'unanswered';
        if (answer.answered && answer.kind === 'canary') {
          if (!canaries.every((c) => final.includes(c))) finding = 'missing-canary';
          else if (foreign.some((c) => final.includes(c))) finding = 'foreign-canary';
        }
        if (answer.answered && answer.kind === 'leak' && leak && new RegExp(leak.leak, 'i').test(final)) finding = 'leak';
        if (answer.finding !== finding) issues.push(`${kind} probe ${probe.arm}.${probe.member}: finding contradicts its raw response`);
      }
    }
  }
  return issues;
}

// Input records may be incomplete. Missing evidence leaves unresolved identities; it is never a zero.
export function accountAdmissionComparison({ pack, experiment, scenario, manifest, config, record, cells, blinded, votes, judgments, judgeReplay, canaryQuestion, sources, provenanceIssues = [] }) {
  const issues = [...provenanceIssues];
  const require = (condition, message) => { if (!condition) issues.push(message); };
  const same = (actual, expected, message) => require(isDeepStrictEqual(actual, expected), message);
  const population = experiment.factors.population.map((id) => pack.population.find((member) => member.id === id));
  const intendedCells = experiment.factors.arms.flatMap((arm) => population.map((member) => ({ id: `${scenario.id}.${arm}.${member.id}.1`, arm, member })));
  const propertyIds = scenario.properties.map((p) => p.id);
  require(intendedCells.length === 6 && propertyIds.length === 24 && new Set(propertyIds).size === 24, 'frozen comparison shape is not six by twenty-four');
  same(record.snapshot?.population, pack.population, 'run population snapshot differs from frozen pack');
  same(record.snapshot?.scenarios, [scenario], 'run scenario snapshot differs from frozen questions and keys');
  same(record.snapshot?.arms, experiment.factors.arms, 'run arm snapshot differs');
  same(record.population, experiment.factors.population, 'run reader population differs');
  same(record.judges, experiment.judging.judges, 'run judge population differs');
  same(record.scenarios, [scenario.id], 'run scenario selection differs');
  require(record.pack === pack.id && record.experiment === experiment.id && record.suite === config.suite, 'run selection identity differs');
  require(record.method?.revision === manifest.evaluatorSource, 'evaluator revision differs');
  require(record.end === 'completed' && record.status === 'result', 'run is incomplete, failed or exploratory');
  require(record.runsPerCell === 1 && record.timeLimitSeconds === config.timeLimitSeconds, 'run count or time limit differs');
  require(record.seed === record.run && blinded?.seed === record.seed, 'run/blinding seed identity differs');
  const stages = ['validated', 'recorded', 'built', 'probed', 'executed', 'measured', 'blinded', 'judged', 'tallied'];
  same(record.states?.map((s) => s.state), stages, 'run lifecycle is incomplete or out of order');
  const times = (record.states ?? []).map((s) => Date.parse(s.at));
  require(times.length > 0 && times.every((t, i) => Number.isFinite(t) && (i === 0 || t >= times[i - 1])), 'run lifecycle timestamps are invalid');
  require(record.register?.experiment === experiment.id && record.register?.declaredStatus === 'result' && /^[a-f0-9]{64}$/.test(record.register?.hash ?? '') && Date.parse(record.register?.recordedAt) < times[0], 'prior experiment registration is absent or invalid');
  issues.push(...admissionComparisonProbeIssues(record, pack, experiment, canaryQuestion));
  same([...(record.cells ?? [])].sort(), intendedCells.map((c) => c.id).sort(), 'declared run cells are missing, duplicated or unexpected');
  same(cells.map((c) => c.cell).sort(), intendedCells.map((c) => c.id).sort(), 'retained cell records are missing, duplicated or unexpected');
  const units = blinded?.units ?? [];
  const absent = blinded?.absent ?? [];
  require(judgeReplay?.evidenceSha256 === admissionJudgmentEvidenceIdentity({ pack, experiment, scenario, seed: record.seed, units, judgments }), 'public judge replay is absent or bound to different raw evidence');
  require(Array.isArray(judgeReplay?.issues) && judgeReplay.issues.length === 0, 'public judge replay has unresolved evidence gaps');
  same(judgeReplay?.votes, votes, 'accepted votes differ from public replay of retained replies');
  require(new Set(units.map((u) => u.id)).size === units.length, 'duplicate blinded unit identity');
  require(new Set(absent.map((a) => `${a.cell}.${a.property}`)).size === absent.length, 'duplicate absent-answer identity');
  const usedUnits = new Set(), usedVotes = new Set(), usedAbsent = new Set();
  const rows = [], observations = [];
  for (const intended of intendedCells) {
    const found = cells.filter((cell) => cell.cell === intended.id);
    const cell = found.length === 1 ? found[0] : null;
    const cellIssues = [];
    const cellRequire = (condition, message) => { if (!condition) cellIssues.push(`${intended.id}: ${message}`); };
    const attempts = cell?.attempts ?? [];
    const last = attempts.at(-1);
    const validity = last?.validity ?? null;
    const usable = validity?.valid === true || (validity?.valid === false && validity.cause === 'behaviour');
    cellRequire(cell?.scenario === scenario.id && cell?.arm === intended.arm && cell?.member === intended.member.id && cell?.run === 1, 'cell identity missing or inconsistent');
    cellRequire(attempts.length >= 1 && attempts.length <= 2 && attempts.every((a, i) => a.attempt === i + 1), 'attempt accounting invalid');
    cellRequire(attempts.slice(0, -1).every((a) => a.validity?.valid === false && ['infrastructure', 'isolation'].includes(a.validity.cause)), 'retry after non-retryable outcome');
    for (const attempt of attempts) {
      const raw = attempt.outcome;
      cellRequire(raw && typeof raw.final === 'string' && (Number.isInteger(raw.exit) || raw.exit === null) && (typeof raw.signal === 'string' || raw.signal === null) && ['completed', 'timeout', 'error'].includes(raw.stop?.reason) && ['model', 'tool', 'none', 'unknown'].includes(raw.stop?.inFlight) && Array.isArray(raw.tools) && Array.isArray(raw.trace) && typeof raw.events === 'string' && typeof raw.filtered === 'boolean' && raw.cost && Object.hasOwn(raw, 'error') && Object.hasOwn(raw, 'session'), `attempt ${attempt.attempt} lacks its raw outcome`);
      if (attempt.failure === undefined) {
        const retained = attempt.phases?.length === 1 ? attempt.phases[0] : null;
        cellRequire(retained?.phase === 'answer' && typeof retained?.prompt === 'string' && retained.prompt.length > 0 && retained.outcome && isDeepStrictEqual(retained.outcome, raw), `attempt ${attempt.attempt} lacks linked raw phase outcome/prompt`);
      } else cellRequire(attempt.validity?.valid === false && attempt.validity.cause === 'infrastructure' && typeof attempt.failure === 'string' && attempt.failure.length > 0, `attempt ${attempt.attempt} has inconsistent core-failure provenance`);
    }
    cellRequire(cell?.valid === validity?.valid, 'cell validity differs from final attempt');
    cellRequire(usable, 'unresolved infrastructure, isolation or missing attempt');
    const phase = last?.phases?.length === 1 ? last.phases[0] : null;
    cellRequire(phase?.phase === 'answer' && phase?.session === 'new' && phase?.status === 'run', 'sole new-session answer phase missing or incomplete');
    cellRequire(isDeepStrictEqual(phase?.validity, validity), 'phase classification differs from final attempt');
    const expectedState = validity?.valid === true ? 'valid' : validity?.cause === 'behaviour' ? 'ended' : 'incomplete';
    if (expectedState === 'ended') cellRequire(last?.endedAt === 'answer', 'behavior failure lacks ended phase identity');
    if (expectedState === 'valid') {
      cellRequire(typeof cell?.phaseOutcomes?.answer?.scored === 'string' || cell?.phaseOutcomes?.answer?.scored === null, 'valid phase lacks retained scored-file provenance');
      cellRequire(cell?.scoredFile?.path === scenario.scoredFile && cell.scoredFile.content === cell?.phaseOutcomes?.answer?.scored, 'raw scored file is missing or differs from eligible phase material');
      cellRequire(cell?.scoredFile?.matchesFinal === (typeof cell?.scoredFile?.content === 'string' && cell.scoredFile.content.trim() === (phase?.outcome?.final ?? '').trim()), 'raw scored-file final-message comparison differs');
    }
    same(Object.keys(cell?.propertyPhases ?? {}).sort(), [...propertyIds].sort(), `${intended.id}: property phase identities differ`);
    observations.push({ cell: intended.id, state: expectedState, exploratory: expectedState !== 'valid', text: cell?.scoredFile?.content?.split('### OBSERVATIONS')[1]?.trim() ?? null });
    issues.push(...cellIssues);
    const judges = population.filter((judge) => judge.family !== intended.member.family);
    require(judges.length === 2, `${intended.id}: expected two other-family judges`);
    for (const property of scenario.properties) {
      const answer = cell?.answers?.[property.id];
      const pp = cell?.propertyPhases?.[property.id];
      const present = typeof answer === 'string' && answer.trim().length > 0;
      const matched = units.filter((unit) => unit.cell === intended.id && unit.properties?.includes(property.id));
      const missing = absent.filter((entry) => entry.cell === intended.id && entry.property === property.id);
      const row = { cell: intended.id, arm: intended.arm, member: intended.member.id, property: property.id, heading: property.answerHeading, validity, phase: pp ?? null, score: null, disposition: 'unresolved', answer: answer ?? null, quoteCheck: null, slots: [] };
      const phaseConsistent = pp?.phase === 'answer' && pp?.state === expectedState;
      require(phaseConsistent, `${intended.id}.${property.id}: inconsistent property phase`);
      const measurable = usable && cellIssues.length === 0 && phaseConsistent;
      const deterministic = measurable && (expectedState === 'ended' || (expectedState === 'valid' && !present));
      if (deterministic) {
        row.disposition = expectedState === 'ended' ? 'not cast: ended phase' : 'not cast: missing answer';
        row.score = 0;
        require(matched.length === 0, `${intended.id}.${property.id}: deterministic zero has a judge unit`);
        require(missing.length === (expectedState === 'ended' ? 0 : 1), `${intended.id}.${property.id}: absent-answer record differs from phase disposition`);
        if (expectedState === 'ended') require(answer == null && cell?.phaseOutcomes?.answer === undefined, `${intended.id}.${property.id}: ended phase salvaged answers`);
      } else if (measurable && expectedState === 'valid' && present) {
        row.disposition = 'eligible answer';
        row.quoteCheck = checkAdmissionComparisonQuotes(answer, sources[intended.arm]);
        require(matched.length === 1 && missing.length === 0, `${intended.id}.${property.id}: eligible answer lacks exactly one unit`);
      }
      for (const entry of missing) usedAbsent.add(entry);
      for (const unit of matched) {
        usedUnits.add(unit);
        require(unit.arm === intended.arm && unit.member === intended.member.id && unit.family === intended.member.family && unit.scenario === scenario.id && unit.phase === 'answer' && isDeepStrictEqual(unit.properties, [property.id]), `${intended.id}.${property.id}: blinded unit provenance differs`);
      }
      for (const judge of judges) {
        const matches = votes.filter((vote) => matched.some((unit) => unit.id === vote.unit) && vote.property === property.id && vote.judge === judge.id);
        for (const vote of matches) usedVotes.add(vote);
        const vote = matches.length === 1 ? matches[0] : null;
        const eligible = row.disposition === 'eligible answer';
        let accepted = eligible && matched.length === 1 && matches.length === 1 && vote?.family === judge.family && [0, 1, 2].includes(vote?.value) && typeof vote?.reason === 'string';
        if (eligible) {
          require(matches.length <= 1, `${intended.id}.${property.id}.${judge.id}: duplicate votes`);
          const judgment = vote ? judgments[vote.prompt] : null;
          accepted = accepted && typeof judgment?.prompt === 'string' && judgment.prompt.length > 0 && judgment.replies?.length >= 1 && judgment.replies.length <= 3 && judgment.replies.some((reply) => reply.tools === 0 && typeof reply.final === 'string' && reply.final.length > 0);
          require(accepted, `${intended.id}.${property.id}.${judge.id}: missing valid vote or retained judge replies`);
        } else require(matches.length === 0, `${intended.id}.${property.id}.${judge.id}: vote on an ineligible outcome`);
        row.slots.push({ judge: judge.id, family: judge.family, status: accepted ? 'cast' : deterministic ? row.disposition : eligible ? 'missing valid vote' : 'unresolved', value: accepted ? vote.value : null, reason: vote?.reason ?? null, prompt: vote?.prompt ?? null, diagnostics: accepted ? readAdmissionComparisonDiagnostics(vote.reason) : null, rawVotes: matches });
      }
      if (row.disposition === 'eligible answer' && row.slots.every((slot) => slot.status === 'cast')) row.score = Math.min(row.quoteCheck.cap, ...row.slots.map((slot) => slot.value));
      rows.push(row);
    }
  }
  require(usedUnits.size === units.length, 'orphan or unexpected blinded units');
  require(usedAbsent.size === absent.length, 'orphan or unexpected absent-answer records');
  require(usedVotes.size === votes.length, 'orphan, same-family or unexpected votes');
  require(rows.length === manifest.expected.readerProbeOutcomes && rows.flatMap((r) => r.slots).length === manifest.expected.crossFamilyVoteSlots, 'full accounting denominator differs');
  const candidate = manifest.inputs.find((input) => input.role === 'candidate').arm;
  const predecessor = manifest.inputs.find((input) => input.role === 'predecessor').arm;
  const table = scenario.properties.map((property) => {
    const scores = (arm) => rows.filter((row) => row.arm === arm && row.property === property.id).map((row) => row.score);
    const next = scores(candidate), old = scores(predecessor);
    const sum = (values) => values.includes(null) ? null : values.reduce((a, b) => a + b, 0);
    return { property: property.id, heading: property.answerHeading, control: manifest.controls.includes(property.answerHeading), candidate: next, predecessor: old, candidateSum: sum(next), predecessorSum: sum(old) };
  });
  const complete = issues.length === 0 && rows.every((row) => row.score !== null);
  const numericConditions = {
    candidateThresholdsMet: table.every((row) => !row.candidate.includes(null) && row.candidate.filter((s) => s === 2).length >= 2 && !row.candidate.includes(0)),
    noControlRegression: table.filter((row) => row.control).every((row) => row.candidateSum !== null && row.predecessorSum !== null && row.candidateSum >= row.predecessorSum),
    strictImprovement: table.some((row) => row.candidateSum !== null && row.predecessorSum !== null && row.candidateSum > row.predecessorSum),
  };
  return {
    schema: 'agp.admission-clarity-accounting/1', run: record.run, complete, issues,
    outcomeCount: rows.length, intendedVoteSlots: rows.flatMap((row) => row.slots).length,
    castVotes: rows.flatMap((row) => row.slots).filter((slot) => slot.status === 'cast').length,
    numericConditions, mechanicalDisposition: !complete ? 'NO VERDICT' : Object.values(numericConditions).every(Boolean) ? 'NUMERIC CONDITIONS MET; INDEPENDENT REVIEW REQUIRED' : 'NUMERIC CONDITIONS NOT MET; INDEPENDENT REVIEW REQUIRED',
    limit: 'Mechanical accounting only. Non-author inspection of raw answers, semantic support, all accepted reasons, observations, hedges and measurement defects is required; this is not the project gate verdict.',
    populationOrder: population.map((member) => member.id), table, observations, rows,
  };
}
