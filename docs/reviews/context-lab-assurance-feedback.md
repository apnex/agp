# AGP assurance capability feedback

Status: local draft, not sent.\
From: AGP, to the context-lab maintainer.

Thank you for the [admission capability correction](../../../context-lab/incoming/agp-admission-diagnostic-correction-response.md) and [direct-peer contract response](../../../context-lab/incoming/agp-direct-peer-assurance-contract-response.md).\
The correction answers the requested provenance, runtime-version and retry-attribution questions; the remaining execution requirements are still unresolved.

## Admission diagnostic

We retain the [capability-first zero-call stop](admission-diagnostic-capability-result.md).\
Your distinction between harness invocations and hidden provider requests is essential: an invocation ceiling, tools-off setting or post-call token total does not by itself establish the required pre-dispatch request and spending bound.

The outstanding requirements remain those in the [correction request](admission-diagnostic-correction-request.md): whole-run admission and reservation controls, request attribution, records retained through the relevant termination paths, and matching evidence for the exact execution profile.\
An ambiguous remote request must remain accounted for; stopping a local process does not demonstrate remote cancellation.

Your proposed streaming writer and reservation ledger could address parts of those requirements, but are not established capabilities.\
AGP will route the still-unknown provider/account contacts separately; naming the workstation owner as a routing lead does not establish either provider's guarantees.\
No new provider investigation, configuration change or execution is requested by this draft.

## Direct-peer documentation comparison

The [frozen preparation protocol](direct-peer-send-assurance/direct-peer-assurance-preparation.md) remains the acceptance authority.\
Its runtime profiles and total budgets are unselected; it does not inherit the admission diagnostic's numerical limits.

| Requirement | AGP assessment and remaining contract |
|---|---|
| No automatic cell retry | Rejecting or ignoring a second attempt after execution cannot prevent its dispatch; a supported pre-execution single-attempt setting is the compatible direction |
| Response-based answers | Select the eligible final response explicitly; asking readers to write a file would change the task, and an implicit fallback between file and response would leave its source ambiguous |
| Eligibility | A missing answer within an established eligible response scores zero; unestablished invocation or response eligibility supplies no comparison verdict, even if the generic tally classifies the failure as behavior |
| Complete accounting | Derive all 72 expected outcomes and 144 vote slots from the frozen experiment, then reconcile cells, absent answers, units and judge records; present blinded units alone do not enumerate absent or ineligible cases |
| Response bound | Apply the common 24 KiB UTF-8 bound with explicit truncation accounting before answer extraction and judging; rejecting a large answer afterward is not the same measurement, and a scoring bound does not bound capture memory or provider spending |
| Whole-run limits | Per-call deadlines are not a total deadline or spending ceiling; probes, readers, judges and any permitted retries need their own explicit accounting within the selected run envelope |

Context-lab has now committed `maxAttemptsPerCell` and explicit `answerSource` at `de6f7d3246dff4893714d7df70d10901450d4d01`, including public operations documentation.\
We recognize that progress; it is a candidate for AGP's scoped compatibility review, not yet an adopted execution revision or closure of the other limits.

Please update the response's capability mapping to that committed public contract and identify the existing verification records and remaining exclusions.\
The contract needs to preserve the effective retry setting across execution and any supported resume path, reject invalid settings rather than silently restore retries, and make response eligibility and extraction provenance explicit.\
Probe and judge-format retry policies remain distinct from cell retries and need separate bindings before AGP selects execution.

The record and judge-payload mappings are useful starting points, not yet a complete AGP acceptance calculation.\
AGP will own its exact scoring and quote checks through supported interfaces; it will not copy the runner, silently change its frozen experiment, or treat the generic aggregate result as its adoption verdict.

## Next handoff

Please distinguish delivered support, work in progress, proposed owner work and provider-side unknowns in the next capability update.\
Name the revision, public interface, existing evidence and remaining exclusions for each changed capability; no repeat of unchanged answers is needed.

This draft does not select an implementation project, an execution pack, model calls or spending.\
AGP preparation and execution remain separate later decisions once compatible public contracts and the applicable prerequisites are established.
