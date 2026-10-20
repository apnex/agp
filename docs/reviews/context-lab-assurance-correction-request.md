# AGP assurance compatibility correction request

Status: local draft, not sent.\
From: AGP, to the context-lab maintainer.\
Assessment: AGP interpretation (Tier 3) against the frozen direct-peer protocol; maintainer statements and source facts are separated below.

The delivered controls address part of AGP's direct-peer documentation comparison, but execution remains unready.\
Please address judge eligibility and replay evidence first, establish the pre-extraction response bound, and close or explicitly restrict the retry-policy gaps.\
AGP retains responsibility for the experiment's accounting and adoption decision.

## Acknowledged support and current scope

Your [latest capability reply](../../../context-lab/incoming/agp-assurance-capability-feedback-response.md) narrows the supported single-attempt path to a declaration in the experiment, acknowledges the CLI-only resume exclusion, and marks pre-extraction byte enforcement as proposed, not started.\
We accept those qualifications and are not asking you to repeat that mapping.

The [existing regression test](../../../context-lab/packages/core/test/run-conductor.test.ts), lines 459-488, asserts the experiment-declared `maxAttemptsPerCell: 1` path and `answerSource: "final"` without `scoredFile`.\
Those assertions are source evidence, not an AGP test-run result or approval of an execution profile.

This request concerns the direct-peer documentation comparison under the [frozen preparation protocol](direct-peer-send-assurance/direct-peer-assurance-preparation.md).\
The [earlier assurance feedback](context-lab-assurance-feedback.md) remains applicable to the separate admission diagnostic; its numerical limits are not imported here.

Review basis:

- Context-lab revision: `d17feb9ea7cec067176804e7e3c25f92281e6d04`; the execution and test files cited below are unchanged from the reviewed `fe0a7b0092b477dc3424ff3ac1a239fd9d57a266`.
- Latest reply SHA-256: `67aa9b96c32789003db28015625bc188f9c8ec785cc3ee0e2a4898731ed0b50e`.
- [Earlier direct-peer reply](../../../context-lab/incoming/agp-direct-peer-assurance-contract-response.md) SHA-256: `7c43b3f23f7f307285e9cad7d004d0c019521b9fed5d264e13693af46a5cccfc`.
- Evidence class: static source and test inspection, with no runtime reproduction, model calls or provider probes; source links name workspace files, while revision and line references identify the reviewed content.

## Pinned source findings

| Finding | Source fact |
|---|---|
| Judge eligibility | The [judge panel](../../../context-lab/packages/core/src/judge-panel.ts), lines 193-221, rejects tool-using replies before parsing but does not gate vote acceptance on `exit`, `stop`, `filtered` or `error` |
| Judge replay | The same loop stores only the first prompt and each reply's `final`, tool count and error message; it does not retain each retry's prompt and local answer mapping, or the full outcome fields and event locator |
| Retry policy | The [run conductor](../../../context-lab/packages/core/src/run-conductor.ts), lines 252-262, 378-379 and 662-663, does not freeze the effective override in the run record; normal execution reads the option before the experiment setting, while resume reads only the experiment setting or default |
| Invalid retry settings | The [CLI flag parser](../../../context-lab/packages/core/src/cli-flags.ts), lines 6-12, silently omits a supplied value outside `1` or `2`, allowing the experiment setting or default to apply instead of rejecting the input |
| Response bound | The run conductor splits answers at lines 404-411 before calling the measure hook at lines 438-449; the [code measurer](../../../context-lab/packages/core/src/code-measurer.ts), lines 23-44, accepts scores, not replacement response text |
| Record completeness | The run conductor's `snapshot.experiment`, lines 137-143 and 257-260, contains variation/default only, not the full experiment or effective retry policy; the [blinder](../../../context-lab/packages/core/src/blinder.ts), lines 105-129, omits unusable cells and places absent answers outside `units` |

## Requested corrections and acceptance evidence

### Judge eligibility and replay

Please make invocation eligibility an explicit prerequisite to accepting a vote, separate from parsing its score.\
A parseable answer and zero tool calls do not establish successful completion or a valid invocation.

The public record must let AGP trace each accepted or missing vote to its exact attempt, prompt, answer mapping and scrubbed raw response, with the completion, exit, filter, error and isolation evidence used to decide eligibility.\
Retained event references and resource observations must remain attributable to that attempt; an unknown eligibility state must not become a valid score.

Acceptance evidence should establish that:

- A well-formed score from an ineligible invocation is not accepted, while an eligible invocation remains scoreable.
- Missing items retried in a smaller prompt retain their correct unit mapping and all earlier attempts, including rejected replies.
- A missing required eligible judgment remains explicitly not cast, rather than becoming zero or disappearing from the records.

Please specify the handling of non-zero exits, timeout, filtering, runtime/provider errors and tool use in the public contract.\
Name termination paths that cannot retain complete evidence instead of claiming replayability for them.

### Uniform response bound

Please provide a supported mechanism applying the same 24 KiB, or 24,576 UTF-8 bytes, before answer extraction and judging for every selected reader.\
The current score hook cannot perform that transformation, and post-run rejection does not enforce the required bound.

Acceptance evidence should cover the byte boundary, valid UTF-8 at a multi-byte cut, oversized output and unchanged in-budget output.\
Retain the applicable limit, effective byte count, original byte count where observable, explicit truncation status/reason and enough response provenance to audit the transformation.\
Define how truncation affects completion, eligibility and partially extracted answers before any scored run.

Keep a bound on scored response text distinct from capture-memory, generation and provider-spending bounds.\
A token limit or local process termination does not establish all of those guarantees.

### Retry policy and record accuracy

The registered experiment-declared setting is a viable candidate binding for AGP; the CLI-only override is not equivalent across resume.\
Please either preserve a validated effective policy through every supported execution/resume path, or make unsupported combinations fail explicitly and document the supported restriction.

Acceptance evidence should distinguish experiment, API and CLI inputs; reject invalid supplied settings; and show that resume cannot silently increase the attempt allowance.\
It must also establish what happens to an interrupted, already-dispatched cell whose completion was not recorded, rather than assuming an empty cell record means no invocation occurred.\
If that case cannot preserve the one-attempt rule and its evidence, expose the limitation and refuse the incompatible continuation.

Please correct the earlier reply's full-experiment-snapshot claim and state which frozen configuration artifacts must accompany a run for replay.\
A content hash identifies an input; it is not a retained copy of that input or of an unrecorded option override.

These requests do not prescribe internal modules, a new API shape, or a universal one-attempt policy for probes and judges.\
Those retry policies remain separate choices to freeze and account for before AGP selects execution.

## AGP owned acceptance work

AGP will use supported public records and hooks, not copy the runner or replace context-lab's judging mechanism.\
The project-owned binding must:

- Enumerate all six reader cells, 72 question outcomes and 144 expected other-family vote slots from the frozen declaration, then attach cells, absent answers, units, attempts and explicit not-cast reasons; a join starting only from present units cannot enumerate the missing cases.
- Distinguish a completed eligible reader's missing answer, which scores zero, from unestablished delivery, isolation, invocation or response eligibility, which leaves `NO VERDICT`; context-lab's generic `behaviour` classification is not sufficient by itself.
- Deliver every applicable common rule, required decision, wrong conclusion and `judgeGuidance` through the supported judge fields, without private role/order labels or `supportNote`.
- Check exact quotations against the assigned reading with whitespace-only normalization, then combine both eligible other-family votes with the quotation cap and the frozen candidate/control decision rules; the generic aggregate tally is not AGP's adoption verdict.
- Validate the 64 KiB input limit and separately account for the harness wrapper, runtime context limits, profiles, isolation evidence and the full run's spending/time envelope.

These are remaining preparation duties, not completed acceptance evidence.\
Neither this request nor eventual capability fixes authorize an AGP scored run or close Zorg's runtime requirements.

## Requested owner response

Please respond only to the unresolved items above, prioritizing judge eligibility and replay, then response enforcement and retry-policy completeness.\
For each, identify the supported contract or proposed correction, its revision when delivered, the relevant test/evidence locations and remaining exclusions.\
If an item is not scheduled or requires another authority, say so; no new provider investigation or live execution is requested.

AGP will review the resulting public contract and evidence before selecting an execution binding, budgets and a separate execution approval.
