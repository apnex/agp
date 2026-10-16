import assert from 'node:assert/strict';

/** Reject executable hooks and unsupported delivery before any hook-capable pack operation. */
export function assertAdmissionRawShape(pack) {
  assert.deepEqual(pack.hooks, [], 'Admission qualification: hooks are outside this shape');
  assert.ok(Array.isArray(pack.variants) && pack.variants.length > 0, 'Admission qualification: variants are required');
  for (const variant of pack.variants) {
    assert.equal(variant.transform, undefined, 'Admission qualification: transforms are outside this shape');
    assert.equal(variant.revision, undefined, 'Admission qualification: variant revision overrides are outside this shape');
  }
  assert.ok(Array.isArray(pack.arms) && pack.arms.length > 0, 'Admission qualification: arms are required');
  for (const arm of pack.arms) {
    assert.equal(arm.deliver.length, 1, 'Admission qualification: exactly one instruction delivery per arm');
    assert.equal(arm.deliver[0].as, 'instruction', 'Admission qualification: delivery must be instruction-only');
  }
}

/** Check effective single-phase shape against separately pinned original population and limits. */
export function assertAdmissionResolvedShape({ core, pack, experiment, scenarios, limits, baseline }) {
  assertAdmissionRawShape(pack);
  assert.deepEqual(pack.population, baseline.pack.population, 'Admission qualification: population or routes changed');
  assert.deepEqual(pack.arms, baseline.pack.arms, 'Admission qualification: arm declarations changed');
  assert.deepEqual(pack.variants, baseline.pack.variants, 'Admission qualification: variant declarations changed');
  assert.deepEqual(pack.sources, baseline.pack.sources, 'Admission qualification: source declarations changed');
  assert.deepEqual(experiment.factors, baseline.experiment.factors, 'Admission qualification: factors changed');
  assert.deepEqual(experiment.judging, baseline.experiment.judging, 'Admission qualification: judging identities or batching changed');
  assert.equal(experiment.runsPerCell, baseline.experiment.runsPerCell, 'Admission qualification: run count changed');
  assert.deepEqual(limits, baseline.limits, 'Admission qualification: execution limits changed');
  assert.deepEqual(experiment.phases, [{ id: 'answer', session: 'new' }], 'Admission qualification: experiment phase changed');
  assert.equal(scenarios.length, 1, 'Admission qualification: exactly one scenario is required');
  for (const scenario of scenarios) {
    assert.equal(scenario.fixture, null, 'Admission qualification: fixtures are outside this shape');
    assert.notEqual(scenario.heldOut, true, 'Admission qualification: held-out scenarios are outside this shape');
    assert.deepEqual(scenario.trapPairs ?? [], [], 'Admission qualification: trap pairs are outside this shape');
    assert.equal(scenario.scoredFile, 'answers.md', 'Admission qualification: answer-file contract changed');
    const phases = core.phasesOf(scenario, experiment);
    assert.deepEqual(phases, [{ id: 'answer', session: 'new' }], 'Admission qualification: effective phases changed');
    const properties = core.propertiesOf(scenario);
    assert.equal(properties.length, 24, 'Admission qualification: expected 24 properties');
    assert.equal(new Set(properties.map((p) => p.id)).size, 24, 'Admission qualification: duplicate property');
    assert.equal(new Set(properties.map((p) => p.answerHeading)).size, 24, 'Admission qualification: duplicate answer heading');
    for (const property of properties) {
      assert.equal(property.type, 'comprehension', 'Admission qualification: property type changed');
      assert.equal(property.decidedBy, 'judge', 'Admission qualification: property authority changed');
      assert.deepEqual(property.scale, [0, 2], 'Admission qualification: property scale changed');
      assert.equal(typeof property.answerHeading, 'string', 'Admission qualification: missing answer heading');
      assert.ok(property.answerHeading.trim(), 'Admission qualification: empty answer heading');
      assert.deepEqual(property.judgedWith ?? [], [], 'Admission qualification: added judge context is outside this shape');
      assert.equal(property.measure, undefined, 'Admission qualification: measurement hooks are outside this shape');
      assert.equal(core.propertyPhase(scenario, phases, property.id, []), 'answer', 'Admission qualification: property phase changed');
    }
  }
}

/** Check actual composed reader and judge delivery, including source revision and instruction identities. */
export function assertAdmissionComposedShape({ core, pack, readerArms, judgeArm, revision }) {
  assert.deepEqual(readerArms.map((a) => a.arm).sort(), pack.arms.map((a) => a.id).sort(), 'Admission qualification: composed arm inventory differs');
  for (const arm of readerArms) {
    const delivery = pack.arms.find((a) => a.id === arm.arm).deliver[0];
    assert.deepEqual(arm.folderFiles, [], 'Admission qualification: composed folder files are forbidden');
    assert.deepEqual(arm.onRequest, [], 'Admission qualification: composed on-request folders are forbidden');
    assert.deepEqual(arm.instructions.map(({ variant, file }) => ({ variant, file })), [
      { variant: delivery.variant, file: delivery.file }, { variant: delivery.variant, file: core.CANARY_FILE },
    ], 'Admission qualification: composed instruction inventory differs');
    assert.deepEqual(arm.revisions, { [delivery.variant]: revision }, 'Admission qualification: composed revision differs');
    assert.deepEqual(arm.canaries, pack.variants.find((v) => v.id === delivery.variant).canaries, 'Admission qualification: composed canaries differ');
  }
  for (const field of ['instructions', 'folderFiles', 'onRequest', 'canaries', 'negativeCanaries']) {
    assert.deepEqual(judgeArm[field], [], `Admission qualification: judge ${field} is not empty`);
  }
  assert.deepEqual(judgeArm.revisions, {}, 'Admission qualification: judge revisions are not empty');
}
