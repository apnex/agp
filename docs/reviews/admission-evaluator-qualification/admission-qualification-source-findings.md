# Admission evaluator source findings for static qualification

Tier 2: source observations at candidate `e705b3d749400d0a79efe98e5338e9c84a1695b8`, compared with frozen evaluator `6e6d0a92965a15ec473c661887b2b9c5037fedcf`.\
These are source findings, not executed conductor, provider or isolation results.

## Delivery and effective shape

| Surface | Source observation | AGP declaration inspected |
|---|---|---|
| [Arm composer](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/arm-composer.ts) | Instruction delivery adds an instruction; canaries also enter as instructions; only the other delivery kinds populate folder-file/on-request lists | Two instruction deliveries, no hooks or transforms |
| [Phase resolution](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/pack-schema.ts#L265) | Scenario phases override experiment phases; fallback maps the experiment's phase IDs and session modes | One scenario, no override, one fresh `answer` phase |
| [Property resolution](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/episode.ts#L132) | A property without a phase uses the final effective phase; trap properties can be assigned differently | Twenty-four ordinary comprehension properties, no phase overrides or trap pairs |
| [Pack check](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/pack-checker.ts#L312) | First-phase task/withhold declarations are now rejected; a declaration-check hook can execute if declared | No scenario fixture, notes, branching, held-out split or hooks |

The inspected declaration is the unchanged `admission-lifetime-assurance-r4` packet.\
Its experiment already states variation and a default, required by the newer registration method.\
No registration is performed for qualification.

---

## Changed paths used by a fresh run

| Candidate source | Change relative to frozen evaluator |
|---|---|
| [Adapters](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/adapters.ts) | Public route disclosure, one cached provider configuration per adapter, and positive-integer OpenCode reply cap mapped to its environment; Codex has no reply-cap support |
| [Conductor setup](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/run-conductor.ts#L249) | Snapshot adds variation/default and held-out exposure records; a variant's explicit revision takes precedence over the run revision; routes are recorded for readers and judges |
| [Conductor cell loop](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/run-conductor.ts#L344) | Unreachable-path diagnostics become per-attempt; episode ledger location is retained; every returned attempt is appended before the unchanged classified maximum-two-attempt decision |
| [Conductor scoring](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/run-conductor.ts#L376) | Phase state, scored snapshot and answer parsing remain on the fresh-run path; added restated-guidance records are diagnostics, not inputs to answers or score assignment |
| [Episode](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/episode.ts#L178) | Trees/diffs move to a separate bare ledger; `startCommit` is removed, `init` denotes a tree and `ledger` is added; snapshots remain per phase |
| [Episode phase control](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/episode.ts#L209) | Behavior failure ends its branch rather than every branch; other invalidity ends the attempt; trap files appear at their phase and new following sessions get fresh history |
| [Tally](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/tally.ts) | Held-out cells/properties move into separate sections; new variation/link/restatement/exposure fields are added; legacy per-cell scoring precedes those additions |
| [Measures](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/measures.ts) | Diagnostic calculations consume scores/text; they return no replacement score; pooled detectable difference treats cell outcomes as independent and the rendered result warns of that limitation |
| [Blinder](https://github.com/apnex/context-lab/blob/e705b3d749400d0a79efe98e5338e9c84a1695b8/packages/core/src/blinder.ts#L39) | The same seeded generator and shuffle loop are factored into named functions |

The candidate's probe file and validity classifier are byte-identical to the original frozen evaluator, as recorded in the [revision inventory](../admission-evaluator-compatibility-checks.json).\
The probe invokes once per question and exposes that answer's tool count; it still does not return a complete raw-outcome/attempt collection.\
The existing cell retry is separate from probe handling and still retains attempts before testing the classifier's retry disposition.

---

## Paths outside this qualification

| Surface | Boundary |
|---|---|
| Resume | New public `resumeRun` entry point exists; no resume call or resume qualification |
| Restricted tally | New `tallyRun` options can limit runs or suppress writes; no run subset is admitted into AGP's accounting |
| Comparisons and CLI | New generic comparison machinery, CLI flags and exports exist; this qualification uses the public index and does not call comparison/CLI execution paths |
| Branches, trap files and history replacement | Source inspected; no branch, trap, leak or security-fault case executed |
| Physical delivery and sandbox | No inference of real attachment/stdin delivery or filesystem isolation from assembled-arm data |
| Provider budgets | Configuration, client-emitted parameters and backend enforcement remain distinct; the latter two are unobserved |

Mechanics: retain these exact-source observations separately from the later independent suitability judgment.\
Rationale: the unchanged panel alone does not describe the changed execution and result paths.\
Consequence: any static qualification must name which paths were actually checked and which still require a separately authorized live stage.
