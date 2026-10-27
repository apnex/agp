import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { checkAdmissionShape } from './check-admission-evidence.mjs';

// Consumer qualification only: invokes the public model-free preview command.
// It never supplies reconstructed answer text to a judge or invokes a runtime.
const [cli, output, packetDirectory] = process.argv.slice(2);
if (!cli || !output) throw new Error('Usage: node qualify-admission-preview.mjs PINNED_PUBLIC_CLI NEW_OUTPUT_DIRECTORY [PACK_DIRECTORY]');
const packet = path.resolve(packetDirectory ?? path.dirname(fileURLToPath(import.meta.url)));
fs.mkdirSync(output); // Refuse to overwrite a previous qualification.
const read = name => fs.readFileSync(path.join(packet, name), 'utf8');
const scenario = JSON.parse(read('scenario.json'));
const key = JSON.parse(read('admission-key.json'));
const experiment = JSON.parse(read('experiment.json'));
const pack = JSON.parse(read('pack.json'));
const readArm = arm => {
  const delivery = pack.arms.find(a => a.id === arm).deliver[0];
  const variant = pack.variants.find(v => v.id === delivery.variant);
  const source = pack.sources.find(s => s.id === variant.source);
  return read(path.join(source.path, delivery.file));
};
const headings = key.probes.map(q => q.id);
const answers = Object.fromEntries(headings.map(id => [id, `Decision: synthetic binding marker ${id}; not an AGP answer.\nDocument support: no substantive claim.\nQUOTE: "# Admission lifetime design"\nInference or gap: synthetic ${id} end marker.`]));
const response = headings.map(id => `### ${id}\n${answers[id]}`).join('\n\n') + '\n\n### OBSERVATIONS\nOBSERVATION-ONLY-RETAIN-NOT-SCORE\n';
const fixtures = [
  ['canonical', response],
  ['volume', response.replace('synthetic binding marker Q01', 'synthetic binding marker Q01 ' + 'volume '.repeat(7000))],
  ['nested', response.replace('Decision: synthetic binding marker Q01', '#### Inner\nDecision: synthetic binding marker Q01')],
  ['duplicate', response.replace('### Q02', '### Q01\nDuplicate substantive decision.\n\n### Q02')],
  ['fenced', response.replace('### Q02', '```text\n### Q02\n```\n### Q02')],
  ['missing', response.replace('### Q02\n', '')],
  ['empty-section', response.replace(answers.Q02, '')],
  ['whole-empty', ''],
  ['utf8-bound', response.replace(answers.Q01, answers.Q01 + ' euro: ' + '\u20ac'.repeat(40000))]
];
const reports = [];
for (const [name, raw] of fixtures) {
  const responseFile = path.join(output, `${name}.txt`);
  fs.writeFileSync(responseFile, raw, { flag: 'wx' });
  const dir = path.join(output, name);
  const args = [cli, 'preview', packet, 'admission-decisions', '--out', dir, '--response', responseFile];
  if (!['canonical', 'volume', 'utf8-bound'].includes(name)) args.push('--members', 'c');
  const log = execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  fs.writeFileSync(path.join(output, `${name}.log`), log, { flag: 'wx' });
  const data = fs.readFileSync(path.join(dir, 'PREVIEW.json'));
  const preview = JSON.parse(data);
  assert.deepEqual(preview.unsupported, []);
  const shape = checkAdmissionShape(raw, headings);
  let firstAssignments = 0;
  let retryAssignments = 0;
  if (['nested', 'duplicate', 'fenced', 'missing'].includes(name)) assert.equal(shape.kind, 'noncanonical');
  if (['canonical', 'volume'].includes(name)) {
    assert.equal(preview.readers.length, 9);
    assert.equal(preview.answers.length, 432);
    assert.equal(new Set(preview.readers.map(r => r.prompt)).size, 1);
    for (const r of preview.readers) {
      const delivered = JSON.stringify(r.prepared);
      assert.ok(r.prompt.includes(scenario.task), `${r.cell}: exact common reader task`);
      assert.ok(!delivered.includes(key.sealedMarker));
      assert.ok(!r.prompt.includes(key.probes[0].decisions[0]));
      if (r.arm === key.roles.none) {
        assert.ok(!delivered.includes('# Admission lifetime design'));
        assert.ok(!delivered.includes('The amber tern') && !delivered.includes('The violet tern'));
      } else {
        const reading = readArm(r.arm);
        // Configuration escapes some instruction text; compare via JSON encoding.
        const rendered = (r.prepared.files ?? []).map(f => f.text ?? '').join('\n');
        assert.ok(rendered.includes(reading) || rendered.includes(JSON.stringify(reading).slice(1, -1)));
      }
    }
    for (const a of preview.answers) {
      const property = scenario.properties.find(p => p.id === a.property);
      const expected = name === 'volume' && property.answerHeading === 'Q01'
        ? answers.Q01.replace('synthetic binding marker Q01', 'synthetic binding marker Q01 ' + 'volume '.repeat(7000))
        : answers[property.answerHeading];
      assert.equal(a.bytes.answer, Buffer.byteLength(expected));
      assert.equal(a.extraction.bounded, false);
      assert.equal(a.extraction.selected, 1);
      const arm = preview.readers.find(r => r.cell === a.cell).arm;
      const reading = arm === key.roles.none ? '' : readArm(arm).trimEnd();
      if (reading) assert.equal(a.reading.original, Buffer.byteLength(reading));
      else assert.equal(a.reading, null);
      const jobs = preview.judges.filter(j => j.units.some(u => u.id === a.unit));
      assert.equal(jobs.length, 2);
      for (const j of jobs) {
        assert.notEqual(j.judge, preview.readers.find(r => r.cell === a.cell).member);
        for (const [kind, invocation] of [['first', j.first], ['retry', j.retry]]) {
          const label = Object.entries(invocation.local).find(([, unit]) => unit === a.unit)?.[0];
          if (kind === 'retry' && !label) continue;
          assert.ok(label, `${a.cell}/${a.property}: ${kind} assignment`);
          const marker = `--- answer ${label} ---\n`;
          assert.equal(invocation.prompt.split(marker).length, 2);
          const block = marker + (reading ? `--- ASSIGNED READING ---\n${reading}\n--- ANSWER ---\n` : '') + expected + '\n';
          assert.ok(invocation.prompt.includes(block), `${a.cell}/${a.property}: ${kind} complete selected-to-judged text`);
          // Check the governing probe header, not merely that the right rubric
          // occurs somewhere in a mixed-axis prompt.
          const beforeAnswer = invocation.prompt.slice(0, invocation.prompt.indexOf(marker));
          const headerStart = beforeAnswer.lastIndexOf('\nPROBE ');
          assert.ok(headerStart >= 0);
          const header = `PROBE ${property.answerHeading}\n\nQuestion:\n${property.question}\n\nKey:\n${property.key}\n\nRubric:\n${property.rubric}\n\n`;
          assert.ok(beforeAnswer.slice(headerStart + 1).startsWith(header), `${a.cell}/${a.property}: ${kind} own question/key/rubric`);
          assert.ok(!invocation.prompt.includes('OBSERVATION-ONLY-RETAIN-NOT-SCORE'));
          if (kind === 'first') firstAssignments++;
          else retryAssignments++;
        }
      }
    }
    assert.equal(preview.judges.length, 432);
    assert.equal(firstAssignments, 864);
    assert.equal(retryAssignments, 432);
  }
  if (name === 'volume') {
    assert.equal(shape.kind, 'canonical-candidate');
    assert.ok(Buffer.byteLength(raw) < experiment.maxResponseBytes);
    for (const a of preview.answers) assert.equal(a.extraction.bounded, false);
  }
  if (name === 'empty-section') for (const a of preview.answers.filter(a => a.property.startsWith('q02-'))) {
    assert.equal(a.extraction.selected, null);
    assert.equal(a.extraction.emptyMatched, 1);
  }
  if (name === 'whole-empty') for (const a of preview.answers) assert.equal(a.extraction.selected, null);
  if (name === 'utf8-bound') {
    assert.ok(preview.judges.length > 0, 'UTF-8 judgment check must not be vacuous');
    assert.ok(preview.answers.some(a => a.extraction.bounded));
    assert.ok(preview.answers.every(a => a.bytes.bounded <= experiment.maxResponseBytes));
    assert.ok(preview.judges.every(j => !j.first.prompt.includes('\ufffd')));
  }
  reports.push({ name, rawBytes: Buffer.byteLength(raw), shape, readers: preview.readers.length, answers: preview.answers.length, judgeJobs: preview.judges.length, firstAssignments, retryAssignments,
    maxJudgePromptBytes: Math.max(0, ...preview.judges.map(j => j.first.bytes)), preview: path.join(dir, 'PREVIEW.json'), sha256: createHash('sha256').update(data).digest('hex'),
    disposition: ['canonical', 'volume'].includes(name) ? 'model-free checks passed, not live qualification' : ['empty-section', 'whole-empty'].includes(name) ? 'synthetic proved absence only; real absence still needs complete evidence' : 'reject or NO VERDICT; never reconstruct answers or credit absence' });
  console.log(JSON.stringify(reports.at(-1)));
}
fs.writeFileSync(path.join(output, 'qualification.json'), JSON.stringify({ schema: 'agp.admission-preview-checks/1', evaluator: '9b4641b05d50c1ce54ab6b9efa1b06820ae16a68', experimentalCalls: 0, reports }, null, 2) + '\n', { flag: 'wx' });
