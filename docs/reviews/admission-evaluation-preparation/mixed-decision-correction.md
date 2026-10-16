# Mixed-decision diagnostic correction

Tier 3: prospective correction to the static preparation, not an assurance result or scoring-rule waiver.

## Finding and preserved checkpoint

The [first independent artifact review](readiness-review-01.txt) is FAIL at `bd95232aae3c22a8aaad965c5507080a1d601faa`.\
Its complete report and output are preserved at `4a61bb63fb16aa19b4f48b8885130baf5b546a67`.\
The author raised the mixed-decision concern during review; the reviewer independently confirmed the contradiction and its blocking consequence.

The former reason contract required aggregate `DECISION=wrong` for any wrong decision but `DECISION=withheld` for any material conflict.\
A single answer can contain both, affecting different numbered decisions; neither aggregate value could then satisfy the checker.\
The defect falsely flagged a legitimate score-zero record even though it did not alter that score.

---

## Correction and consequence

Any wrong/unsafe required decision retains score-zero precedence and aggregate `DECISION=wrong`.\
A separate material conflict retains `HEDGE=yes`, its issue and affected-decision IDs; it requires `DECISION=withheld` only when no wrong decision takes precedence.\
The checker continues to require zero for any wrong-decision finding and rejects nonzero/full-credit mixed records.\
Original scores/reasons are returned unchanged, and semantic truth still requires independent review.

This restores the existing wrong-decision rule for compound answers; it does not relax score 2, drop an issue, accept a new retry policy or change any historical result.\
The design's raw-vote, no-repair and independent-review boundaries remain unchanged.

---

## Checks and retention

The new ordinary guard failed before the correction with exactly the false conflict finding, then passed afterwards.\
An additional unrelated semantic case gives a wrong loan period and separately conflicting renewal rules, retaining all three exact source excerpts and an expected raw score of zero.\
The [second author output](author-test-output-02.txt) preserves both the failing-before output and the complete 40-test passing run: 12 preparation checks plus 28 existing checks.

The second complete synthetic capture is `capture-only-evidence-02.json.gz.base64`.\
Its decoded JSON SHA-256 is `2945c82c888e6f486bd4bc466dd09081c515dcbed882076d2ef4081f203e7435`.\
It retains the updated delivered policy with the same 144/288 complete fixture and 120-present/24-absent, 240-cast/48-uncast fixture.\
The first capture, test output and independent FAIL remain intact rather than being overwritten.

Independent exact-artifact recheck is still required.\
The evaluator's probe retry/attempt-recording blocker, unselected live cap and diagnostic/calibration authority remain unchanged.\
No model experiment, AGP runtime change, push or Zorg correspondence occurred.
