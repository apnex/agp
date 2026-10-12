// Admission assurance accounting: derive the predeclared lower-vote and exact-quote checks.
// This reads retained evidence; it does not invoke models, repair answers, or issue the independent gate verdict.
// Usage: node analyze-admission-assurance.mjs /path/to/run-record
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();

// Check quote syntax and exact membership only; semantic support still belongs to the judges/reviewer.
function checkAdmissionQuotes(answer, source) {
	const lines = answer.split('\n').filter((line) => line.startsWith('QUOTE:'));
	const quotes = lines.map((line) => {
		try {
			const quote = JSON.parse(line.slice(6).trim());
			const valid = typeof quote === 'string' && normalizeWhitespace(quote).length > 0;
			return { line, valid, matches: valid && normalizeWhitespace(source).includes(normalizeWhitespace(quote)) };
		} catch {
			return { line, valid: false, matches: false };
		}
	});
	return { count: quotes.length, cap: quotes.length > 0 && quotes.every((quote) => quote.matches) ? 2 : 1, defects: quotes.filter((quote) => !quote.matches) };
}

assert.equal(checkAdmissionQuotes('QUOTE: "alpha beta"', 'alpha\nbeta').cap, 2);
assert.equal(checkAdmissionQuotes('QUOTE: "alpha ... beta"', 'alpha\nbeta').cap, 1);
assert.equal(checkAdmissionQuotes('QUOTE: broken', 'alpha').cap, 1);
assert.equal(checkAdmissionQuotes('QUOTE: ""', 'alpha').cap, 1);
assert.equal(checkAdmissionQuotes('No quote', 'alpha').cap, 1);

const runDir = path.resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], 'Admission assurance analysis requires a retained run directory');
const packet = path.dirname(fileURLToPath(import.meta.url));
const manifest = read(path.join(packet, 'admission-input-manifest.json'));
const record = read(path.join(runDir, 'run.json'));
assert.equal(record.end, 'completed', 'Admission assurance run has not completed');
assert.equal(record.status, 'result', 'Admission assurance run is exploratory');
assert.equal(record.method.revision, manifest.evaluatorSource);
assert.equal(record.runsPerCell, 1);
assert.equal(record.snapshot.scenarios.length, 1);
const [scenario] = record.snapshot.scenarios;
const sources = new Map(manifest.inputs.map((input) => {
	const source = fs.readFileSync(path.join(packet, input.readerFile), 'utf8');
	assert.equal(createHash('sha256').update(source).digest('hex'), input.readerSha256);
	return [input.arm, source];
}));
const cells = new Map(record.cells.map((id) => [id, read(path.join(runDir, 'cells', `${id}.json`))]));
const blinded = read(path.join(runDir, 'sealed', 'units.json'));
const votes = read(path.join(runDir, 'judging', 'votes.json'));
const population = record.snapshot.population.filter((member) => record.population.includes(member.id));
const rows = [];
const observations = [];
for (const arm of record.snapshot.arms) for (const member of population) {
	const cellId = `${scenario.id}.${arm}.${member.id}.1`;
	const cell = cells.get(cellId);
	const validity = cell?.attempts.at(-1)?.validity;
	const usable = validity?.valid === true || validity?.cause === 'behaviour';
	const judges = population.filter((judge) => judge.family !== member.family);
	assert.equal(judges.length, 2);
	observations.push({ cell: cellId, text: cell?.scoredFile?.content?.split('### OBSERVATIONS')[1]?.trim() ?? null });
	for (const property of scenario.properties) {
		const answer = cell?.answers[property.id];
		const state = cell?.propertyPhases?.[property.id]?.state;
		const row = { cell: cellId, arm, member: member.id, property: property.id, validity, state, score: null, disposition: 'no measurement', quoteCheck: null, slots: [] };
		const matchingUnits = blinded.units.filter((unit) => unit.cell === cellId && unit.properties.includes(property.id));
		assert.ok(matchingUnits.length <= 1);
		if (usable && (state === 'ended' || (state === 'valid' && !answer?.trim()))) {
			assert.equal(matchingUnits.length, 0);
			row.score = 0;
			row.disposition = state === 'ended' ? 'deterministic zero: behaviour-ended property' : 'deterministic zero: missing answer';
			row.slots = judges.map((judge) => ({ judge: judge.id, value: null, status: 'not cast', reason: row.disposition }));
		} else if (usable && state === 'valid' && answer?.trim()) {
			assert.equal(matchingUnits.length, 1);
			row.quoteCheck = checkAdmissionQuotes(answer, sources.get(arm));
			row.slots = judges.map((judge) => {
				const found = votes.filter((vote) => vote.unit === matchingUnits[0].id && vote.property === property.id && vote.judge === judge.id);
				assert.ok(found.length <= 1);
				const vote = found[0];
				if (vote) assert.equal(vote.family, judge.family);
				return { judge: judge.id, value: vote?.value ?? null, status: vote?.value == null ? 'missing valid vote' : 'cast', reason: vote?.reason ?? 'no vote record' };
			});
			if (row.slots.every((slot) => slot.status === 'cast')) {
				assert.ok(row.slots.every((slot) => [0, 1, 2].includes(slot.value)));
				row.score = Math.min(row.quoteCheck.cap, ...row.slots.map((slot) => slot.value));
				row.disposition = 'lower cross-family vote with exact-quote cap';
			}
		} else row.slots = judges.map((judge) => ({ judge: judge.id, value: null, status: 'not measurable', reason: validity?.detail ?? 'missing cell or incomplete property' }));
		rows.push(row);
	}
}
assert.equal(rows.length, 72);
assert.equal(rows.flatMap((row) => row.slots).length, 144);
assert.equal(votes.filter((vote) => vote.value !== null).length, rows.flatMap((row) => row.slots).filter((slot) => slot.status === 'cast').length);
const predecessor = manifest.inputs.find((input) => input.role === 'predecessor').arm;
const candidate = manifest.inputs.find((input) => input.role === 'candidate').arm;
const table = scenario.properties.map((property) => {
	const scores = (arm) => rows.filter((row) => row.arm === arm && row.property === property.id).map((row) => row.score);
	const old = scores(predecessor), next = scores(candidate);
	return { property: property.id, predecessor: old, candidate: next, control: manifest.controlProbes.includes(property.answerHeading), predecessorSum: old.includes(null) ? null : old.reduce((a, b) => a + b, 0), candidateSum: next.includes(null) ? null : next.reduce((a, b) => a + b, 0) };
});
const complete = rows.every((row) => row.score !== null) && record.probes.length === 6 && record.probes.every((probe) => probe.pass) && record.judgeProbes.length === 3 && record.judgeProbes.every((probe) => probe.pass);
const thresholds = table.every((row) => !row.candidate.includes(null) && row.candidate.filter((score) => score === 2).length >= 2 && !row.candidate.includes(0));
const noControlRegression = table.filter((row) => row.control).every((row) => row.candidateSum !== null && row.predecessorSum !== null && row.candidateSum >= row.predecessorSum);
console.log(JSON.stringify({
	scope: 'Mechanical accounting only; semantic grounds, observations and the independent gate review remain necessary',
	run: record.run, populationOrder: population.map((member) => member.id), outcomes: rows.length, voteSlots: 144,
	castVotes: rows.flatMap((row) => row.slots).filter((slot) => slot.status === 'cast').length,
	missingAnswers: rows.filter((row) => row.disposition === 'deterministic zero: missing answer').length,
	quoteCaps: rows.filter((row) => row.quoteCheck?.cap === 1).length,
	complete, candidateThresholdsMet: thresholds, noControlRegression,
	strictImprovement: table.some((row) => row.candidateSum !== null && row.predecessorSum !== null && row.candidateSum > row.predecessorSum),
	table, observations, rows,
}, null, 2));
