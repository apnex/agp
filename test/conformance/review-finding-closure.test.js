import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reviewPath = path.join(
  root,
  "docs/design/agp-uniform-node/transport-sovereignty-review.md",
);

function rows(source) {
  return source
    .split(/\r?\n/gu)
    .filter((line) => /^\| TSR-\d+ \|/u.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

test("Given the transport review and closure ledger, when AX0 audits durable findings, then TSR-01 through TSR-57 are unique resolved and owned with downstream evidence", async () => {
  const source = await readFile(reviewPath, "utf8");
  const allRows = rows(source);
  const findingRows = allRows.slice(0, 57);
  const closureRows = allRows.slice(57);
  const expectedFindings = Array.from(
    { length: 57 },
    (_, index) => `TSR-${String(index + 1).padStart(2, "0")}`,
  );
  const expectedClosure = Array.from(
    { length: 14 },
    (_, index) => `TSR-${index + 44}`,
  );

  assert.deepEqual(findingRows.map(([id]) => id), expectedFindings);
  assert.deepEqual(closureRows.map(([id]) => id), expectedClosure);
  assert.equal(new Set(findingRows.map(([id]) => id)).size, 57);
  for (const [id, status, rootCause, disposition] of findingRows) {
    assert.ok(status.length > 0, `${id}: status`);
    assert.ok(rootCause.length > 0, `${id}: root cause`);
    assert.ok(disposition.length > 0, `${id}: disposition`);
    assert.doesNotMatch(status, /\b(?:open|investigating)\b/iu, `${id}: status`);
  }
  for (const [id, status, owner, evidence] of closureRows) {
    assert.match(status, /design-resolved/iu, `${id}: status`);
    assert.ok(owner.length > 0, `${id}: owner`);
    assert.ok(evidence.length > 0, `${id}: downstream evidence`);
  }
  assert.match(source, /Remaining design\/trace blockers:\*\* none/u);
});
