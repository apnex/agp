// Admission judge prompt delivery check: the public renderer runs, but no model is invoked.
// Usage: node verify-admission-judge-prompts.mjs /path/to/context-lab/packages/core/dist/src/index.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const corePath = process.argv[2];
assert.ok(corePath, 'Admission prompt check requires the pinned context-lab public entry point');
const { checkPack, judgeAll } = await import(pathToFileURL(path.resolve(corePath)).href);
const packDir = path.dirname(fileURLToPath(import.meta.url));
const checked = await checkPack(packDir);
assert.ok(checked.ok, JSON.stringify(checked.defects));
const { loaded } = checked;
const { experiment, scenarios: entries } = loaded.experiments.get('admission-lifetime');
const scenarios = new Map([...entries].map(([id, entry]) => [id, entry.scenario]));
const scenario = scenarios.get('admission-lifetime');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'agp-admission-prompt-preview.'));
const units = [];
for (const arm of experiment.factors.arms) {
	for (const member of loaded.pack.population) {
		for (const property of scenario.properties) {
			units.push({
				id: `preview-${units.length + 1}`, cell: `preview-${arm}-${member.id}`,
				scenario: scenario.id, arm, member: member.id, family: member.family,
				properties: [property.id], phase: 'answer',
				text: '--- ANSWER ---\nDELIVERY PREVIEW ONLY; this is not reader evidence.\n',
				blindedAt: new Date().toISOString(),
			});
		}
	}
}
const prompts = [];
const captureAdapter = {
	runtime: 'capture-only', rulesFiles: [], modes: ['stdin'],
	network: 'denied', filesystem: 'sandboxed', continue: false,
	compaction: { onDemand: false, instructionsAfterCompaction: 'unknown' },
	refuse: () => null,
	async invoke(invocation) {
		assert.equal(invocation.tools, 'off');
		prompts.push(invocation.prompt);
		throw new Error('Admission prompt preview captured; no model invocation or vote');
	},
};
const votes = await judgeAll({
	loaded, experiment, scenarios, units, judges: loaded.pack.population,
	adapters: { codex: captureAdapter, opencode: captureAdapter },
	guessOptions: [], recordsDir: path.join(work, 'preview-records'), work,
	seed: 'admission-prompt-preview-01', timeLimitSeconds: 1, parallel: 1,
});
assert.equal(units.length, 72);
assert.equal(votes.length, 144);
assert.ok(votes.every((vote) => vote.value === null));
assert.ok(prompts.length > 0);
const disclosures = /\b(?:d41|p87|sheetA|sheetB|candidate|predecessor)\b|revision [23]|unchanged control|changed decision|quartz-tulip-4189|3396fc788a69|c8c86304e408/i;
for (const prompt of prompts) assert.doesNotMatch(prompt, disclosures);
for (const property of scenario.properties) {
	const delivered = prompts.filter((prompt) => prompt.includes(`PROBE ${property.answerHeading}\n`));
	assert.ok(delivered.length > 0, `Admission prompt missing ${property.id}`);
	assert.ok(delivered.every((prompt) => prompt.includes(property.question) && prompt.includes(property.key) && prompt.includes(property.rubric)));
	assert.ok(property.key.startsWith('Required decisions: R1.'));
	assert.ok(scenario.task.includes(`### ${property.answerHeading}\n${property.question}\n`));
}
console.log(JSON.stringify({
	status: 'PASS: prompt delivery only; no reader or judge was invoked',
	contextLabEntry: path.resolve(corePath), previewRecords: work,
	prompts: prompts.length, probes: scenario.properties.length,
	fixtureUnits: units.length, nullFixtureVoteSlots: votes.length,
}, null, 2));
