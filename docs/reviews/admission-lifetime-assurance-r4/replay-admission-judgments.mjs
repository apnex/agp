// Bind admission votes to retained replies using the pinned public judge panel, without model calls.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

/** Hash the complete admission judgment evidence; this binds inputs, not their correctness. */
export function admissionJudgmentEvidenceIdentity({ pack, experiment, scenario, seed, units, judgments }) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical({ pack, experiment, scenario, seed, units, judgments }))).digest('hex');
}

/** Replay admission judgments serially; public job records define boundaries, without model calls. */
export async function replayAdmissionJudgments({ core, loaded, experiment, scenario, seed, units, judgments, originalRecordsDir }) {
  const issues = [];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-admission-judge-replay.'));
  const recordsDir = path.join(scratch, 'records');
  const judgingDir = path.join(recordsDir, 'judging');
  // Only the panel's records-directory warning changes when rendering into scratch.
  const normalizePrompt = (prompt) => prompt.replace(`Do not open any other file under ${recordsDir}.`, `Do not open any other file under ${originalRecordsDir}.`);
  const judges = experiment.judging.judges.map((id) => loaded.pack.population.find((m) => m.id === id));
  const jobs = [];
  for (const judge of judges) {
    const prefix = `${scenario.id}.answer.answers.${judge.id}.`;
    const names = Object.keys(judgments).filter((name) => name.startsWith(prefix) && /^[1-9]\d*$/.test(name.slice(prefix.length))).sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));
    names.forEach((name, i) => {
      if (name !== prefix + (i + 1)) issues.push(`retained judge job sequence is incomplete: ${name}`);
      jobs.push({ name, judge: judge.id, record: judgments[name] });
    });
  }
  if (jobs.length !== Object.keys(judgments).length) issues.push('unknown retained judge job identity');
  let cursor = 0, active = null, replayedReplies = 0;
  const refuse = (message) => { issues.push(message); throw new Error(message); };
  const replayAdapter = {
    runtime: 'retained-reply-replay', rulesFiles: [], modes: ['stdin'], filesystem: 'sandboxed', network: 'denied', continue: false,
    compaction: { onDemand: false, instructionsAfterCompaction: 'unknown' }, refuse: () => null,
    async invoke(invocation) {
      if (invocation.tools !== 'off') refuse('judge replay unexpectedly enabled tools');
      // judgeAll writes a completed job before invoking the next one when parallel is one.
      // Exhausting retained replies does not establish that the public job has completed.
      if (active !== null && fs.existsSync(path.join(judgingDir, `${active.name}.json`))) {
        if (active.reply !== active.record.replies.length) refuse(`retained replies remain after public job completion: ${active.name}`);
        active = null;
      }
      if (active === null) {
        const job = jobs[cursor++];
        if (!job) refuse('public panel requested an unretained judge job');
        const normalized = normalizePrompt(invocation.prompt);
        if (job.judge !== invocation.member.id || normalized !== job.record.prompt) refuse(`retained first prompt/member differs from public panel: ${job.name}`);
        if (!Array.isArray(job.record.replies) || job.record.replies.length > 3) refuse(`invalid retained reply count: ${job.name}`);
        active = { ...job, reply: 0 };
      }
      const job = active;
      if (job.judge !== invocation.member.id) refuse(`judge changed before retained replies were consumed: ${job.name}`);
      if (job.reply === job.record.replies.length) {
        if (typeof job.record.failure !== 'string' || !job.record.failure) refuse(`public panel requested an unretained completion: ${job.name}`);
        // The public panel records String(error); preserve that retained string exactly.
        throw job.record.failure;
      }
      const reply = job.record.replies[job.reply++];
      if (typeof reply.final !== 'string' || !Number.isInteger(reply.tools) || reply.tools < 0 || !(reply.error === null || typeof reply.error === 'string')) refuse(`invalid raw reply fields: ${job.name}`);
      replayedReplies++;
      return { final: reply.final, tools: Array.from({ length: reply.tools }, () => ({ name: 'retained-tool-count' })), error: reply.error === null ? null : { message: reply.error } };
    },
  };
  const votes = await core.judgeAll({ loaded, experiment, scenarios: new Map([[scenario.id, scenario]]), units, judges,
    adapters: Object.fromEntries([...new Set(judges.map((m) => m.runtime))].map((runtime) => [runtime, replayAdapter])),
    guessOptions: [], recordsDir, work: scratch, seed, timeLimitSeconds: 1, parallel: 1 });
  if (cursor !== jobs.length || (active !== null && active.reply !== active.record.replies.length)) issues.push('public panel did not consume exactly the retained jobs/replies');
  const replayedNames = fs.readdirSync(judgingDir).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort();
  if (!isDeepStrictEqual(replayedNames, Object.keys(judgments).sort())) issues.push('public judge job inventory differs from retained jobs');
  let reconciledJobs = 0;
  for (const name of replayedNames) {
    const record = JSON.parse(fs.readFileSync(path.join(judgingDir, `${name}.json`), 'utf8'));
    record.prompt = normalizePrompt(record.prompt);
    if (isDeepStrictEqual(record, judgments[name])) reconciledJobs++;
    else issues.push(`public judge job record differs from retained prompt/replies/failure: ${name}`);
  }
  return { evidenceSha256: admissionJudgmentEvidenceIdentity({ pack: loaded.pack, experiment, scenario, seed, units, judgments }), issues, votes, replayedReplies, retainedJobs: jobs.length, reconciledJobs, scratch, modelCalls: 0 };
}
