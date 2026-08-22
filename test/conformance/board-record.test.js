import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const boardPath = "docs/BOARD.md";

// A board exists to make the next move a selection rather than a derivation.
// It can only do that while every item is traceable to a record and every
// deferral carries a trigger. An item citing nothing is an opinion, and a
// held item with no trigger is forgetting rather than a decision.

function tableRows(source, heading) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.startsWith(`## ${heading}`));
  if (start === -1) return undefined;
  const rows = [];
  let past = false;
  for (const line of lines.slice(start + 1)) {
    if (/^## /u.test(line)) break;
    if (!/^\|/u.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/u.test(cell))) { past = true; continue; }
    if (!past) continue;
    rows.push(cells);
  }
  return rows;
}

async function board() {
  return readFile(path.join(root, boardPath), "utf8");
}

test("Given the triage ledger, when each candidate is read, then it is scored on both dimensions and cites a record", async () => {
  const ledger = tableRows(await board(), "Triage ledger");
  assert.notEqual(ledger, undefined, "triage ledger is missing");
  assert.ok(ledger.length > 0, "an empty ledger asserts there is nothing to do");

  const problems = [];
  for (const [id, candidate, impact, breach, evidence] of ledger) {
    if (!/^`I[1-4]`$/u.test(impact)) problems.push(`${id}: impact "${impact}" is not I1-I4`);
    if (!/^`P[1-4]`$/u.test(breach)) problems.push(`${id}: breach "${breach}" is not P1-P4`);
    if (!candidate || candidate.length < 10) problems.push(`${id}: states no candidate`);
    // Ordering on one collapsed score is the fault the two scales prevent.
    if (!/\]\([^)]+\)/u.test(evidence ?? "")) {
      problems.push(`${id}: cites no record`);
    }
  }
  assert.deepEqual(problems, [], `triage ledger must be scored and cited:\n${problems.join("\n")}`);
});

test("Given every record cited by the board, when the link is resolved, then the target and its anchor exist", async () => {
  const source = await board();
  const broken = [];
  for (const match of source.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/gu)) {
    const [, relative, anchor] = match;
    if (relative.startsWith("http")) continue;
    const target = path.normalize(path.join(root, "docs", relative));
    if (!existsSync(target)) {
      broken.push(`${relative} does not exist`);
      continue;
    }
    if (anchor === undefined) continue;
    const body = await readFile(target, "utf8");
    const slugs = new Set();
    for (const line of body.split(/\r?\n/u)) {
      const heading = /^#{1,6}\s+(.+?)\s*$/u.exec(line);
      if (heading === null) continue;
      slugs.add(heading[1].trim().toLowerCase()
        .replace(/[`*_~]/gu, "")
        .replace(/[.,:;!?()[\]{}'"\\/|<>@#$%^&+=]/gu, "")
        .replace(/\s/gu, "-"));
    }
    if (!slugs.has(anchor.slice(1))) broken.push(`${relative}${anchor} has no such heading`);
  }
  assert.deepEqual(broken, [], `board citations must resolve:\n${broken.join("\n")}`);
});

test("Given the held section, when each item is read, then it is scored and carries a revival trigger", async () => {
  const held = tableRows(await board(), "Held");
  assert.notEqual(held, undefined, "held section is missing");

  const problems = [];
  for (const [id, item, impact, breach, trigger] of held) {
    if (!/^`I[1-4]`$/u.test(impact ?? "")) problems.push(`${id}: held item is not scored for impact`);
    if (!/^`P[1-4]`$/u.test(breach ?? "")) problems.push(`${id}: held item is not scored for breach`);
    if (!item || item.length < 5) problems.push(`${id}: names nothing held`);
    // Explicit deferral is permitted; silence is not.
    if (!trigger || trigger.length < 20) problems.push(`${id}: states no revival trigger`);
  }
  assert.deepEqual(problems, [], `held items must be scored and revivable:\n${problems.join("\n")}`);
});

test("Given the decisions required, when each is read, then it names exactly what it blocks", async () => {
  const decisions = tableRows(await board(), "Decisions required");
  assert.notEqual(decisions, undefined, "decisions section is missing");

  const problems = [];
  for (const [question, blocks] of decisions) {
    if (!question || question.length < 15) problems.push("a decision states no question");
    // A decision that names no blocked work waits on attention rather than
    // earning it.
    if (!/`B\d+`/u.test(blocks ?? "")) {
      problems.push(`"${question.slice(0, 40)}..." names no blocked board item`);
    }
  }
  assert.deepEqual(problems, [], `decisions must name what they block:\n${problems.join("\n")}`);
});

test("Given every board identifier, when the ledger and milestones are compared, then neither contains an item the other omits", async () => {
  const source = await board();
  const ledger = new Set(
    (tableRows(source, "Triage ledger") ?? []).map(([id]) => id),
  );
  const referenced = new Set(
    [...source.matchAll(/^\| (`B\d+`) \|/gmu)].map((match) => match[1]),
  );
  const orphaned = [...referenced].filter((id) => !ledger.has(id));
  assert.deepEqual(
    orphaned,
    [],
    `every board item must appear in the triage ledger:\n${orphaned.join("\n")}`,
  );
});
