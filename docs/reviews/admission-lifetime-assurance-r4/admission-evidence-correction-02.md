# Admission judge replay job boundary correction

The [second readiness review](admission-provider-readiness-04.txt) found that equal global votes did not prove correct attribution of replies to each judge job.\
This prospective correction makes the public panel's completed job records authoritative for both job transitions and evidence reconciliation.

Status: author correction awaiting independent recheck; no live comparison has started.\
The failed checkpoint is `9b18d1657ac4ed37e09a723887b0e73bc25078cb`; its report is preserved verbatim in `3e324f380a0a8fca50b7c909c38a56ec13da421b`.

## Corrected boundary

Tier 2: source changes in [judge replay](replay-admission-judgments.mjs), using the unchanged evaluator revision in the [manifest](admission-input-manifest.json).

- A replay job stays active until the serial public panel writes that job's completion record; consuming its last retained reply cannot advance to another job.
- Unconsumed replies at a completed job are rejected before any next-job reply is supplied.
- The complete public job inventory must equal the retained inventory, and each job's initial prompt, ordered replies and failure must match exactly.
- Only the temporary records-directory warning is normalized; the public panel still owns prompt generation, parsing, acceptance and pending-only completion.

The existing analyzer passes any replay issues to project accounting, which cannot declare evidence complete when they exist.\
The live run remains six-way parallel; this no-model reconciliation remains serial.\
No design, input, question, key, control, provider, scoring rule, threshold or retry allowance changes.

## Author checks and remaining gate

The [captured author checks](admission-evidence-author-checks-02.json) record 26 passing static tests against a freshly restored and built evaluator at the same pin.\
The additional test covers 144 synthetic units, 288 vote slots and 48 genuine public-panel jobs, with pending completion or a retained exception in a later job of the same judge.\
It compares every completed job record and the complete votes, not only totals.

These checks contain no scored reader answers and do not repeat the prior review's constructed record reassignment.\
A non-author must review the correction's actual job boundary and its accounting consumer before launch.\
The previous two readiness FAILs remain unchanged; runtime delivery/isolation and the final completed-measurement verdict are separate requirements.
