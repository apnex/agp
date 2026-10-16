---
id: admission-runtime-amendment-01
title: Use the installed OpenCode version for the admission comparison
date: 2026-10-16
status: ratified
authority: [director]
amends: [admission-provider-amendment-01]
supersedes: []
affects: [admission-execution-config.json]
---

# Admission comparison runtime amendment

[DIRECTOR] The user selected "continue, amend" after the choice between restoring the previously pinned runtime and prospectively amending the experiment to the installed OpenCode version.\
This authorizes the version amendment, a bounded independent readiness recheck and the existing conditional whole-comparison execution, not a gate override.

## Ruling and scope

[DIRECTOR] Change only `expectedRuntimeVersions.opencode` in [the execution configuration](admission-execution-config.json) from `1.19.0` to `1.19.2`.\
The selected provider, models, families, six reader cells, questions, keys, inputs, controls, scoring, thresholds, retry bounds, evaluator revision and final non-author gate remain unchanged.

[DIRECTOR] No shared runtime installation or operator configuration is changed.\
AGP runtime implementation, public-contract ratification, publication, Zorg correspondence and B53 closure remain outside this authorization.

## Preserved history

[MEASURED] The [previous preflight](admission-execution-preflight-02.json) records OpenCode `1.19.2` against the then-required `1.19.0`, before registration or any model call.\
That stop remains correct for its checkpoint and is preserved unchanged.

[MEASURED] The [preceding independent review](admission-provider-readiness-05.txt) passed only static instrument readiness and explicitly did not waive that mismatch.\
Its verdict, earlier failures, raw evidence and the [provider amendment](admission-provider-amendment-01.md) remain unchanged.

## Alternatives and cost

[DIRECTOR] Restoring `1.19.0` was not selected.\
The user chose the installed version; continued waiting would leave the approved comparison unrun.

[ARGUED] This changes the runtime under which the prospective comparison will be measured, so previous static readiness cannot establish live compatibility.\
The cost is a bounded exact-checkpoint recheck followed by all existing delivery and isolation probes before scored execution.

[OPEN] A CLI version identifies the reported runtime, not backend equivalence, availability or correct live behavior.\
Those properties are not inferred from the amendment or from a version query.

## Execution conditions

[DIRECTOR] Commit the scoped amendment and retain a non-author readiness verdict against its exact source checkpoint before invoking the existing public execution path.\
The recheck concerns the one-field delta, preservation and the pinned runtime interface, not a new semantic-key audit.

[DIRECTOR] All six reader-profile and three judge-profile probes must pass before any scored invocation.\
Any failed prerequisite stops scored execution; no model substitution, reduced population or favorable rerun is permitted.

[DIRECTOR] Retain the registration, actual versions, every reader attempt and judge reply, replayed tally and full accounting for all 144 outcomes and 288 intended vote slots.\
Incomplete or invalid execution has no assurance verdict; completed evidence still requires independent judgment under the existing rules.
