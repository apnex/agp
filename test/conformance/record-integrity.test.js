import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const boardPath = path.join(root, "docs/BOARD.md");

// These gates check what one record asserts about another. Structure inside a
// single board row belongs to board-record.test.js; this file owns the joins
// between records, which is where every drift found by hand has lived.
//
// Every gate below asserts that its own inputs are non-empty before it judges
// them. A checker that parses nothing passes everything, and the hand-run
// version of these checks reported clean on a board whose ledger row had been
// deleted, precisely because the lookup it keyed on returned nothing.

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  ".github",
]);

async function collectMarkdown(directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      await collectMarkdown(path.join(directory, entry.name), output);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      output.push(path.join(directory, entry.name));
    }
  }
  return output;
}

function sectionOf(source, heading) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.startsWith(`## ${heading}`));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /u.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

function rowsOf(section) {
  if (section === undefined) return [];
  const rows = [];
  let past = false;
  for (const line of section.split(/\r?\n/u)) {
    if (!/^\|/u.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/u.test(cell))) { past = true; continue; }
    if (past) rows.push(cells);
  }
  return rows;
}

function identifiersIn(text) {
  return [...text.matchAll(/`(B\d+)`/gu)].map((match) => match[1]);
}

async function boardSource() {
  return readFile(boardPath, "utf8");
}

// The triage ledger is the sole register of board items; every other section of
// the board and every other record defers to it for an item's state.
async function ledger() {
  const rows = rowsOf(sectionOf(await boardSource(), "Triage ledger"));
  const entries = new Map();
  for (const [id, candidate, impact, breach, evidence, status] of rows) {
    const identifier = id.replaceAll("`", "");
    entries.set(identifier, { candidate, impact, breach, evidence, status });
  }
  return entries;
}

test("Given every board item, when its ledger status is compared with where it sits, then the board does not disagree with itself about its state", async () => {
  const source = await boardSource();
  const items = await ledger();
  assert.ok(items.size > 10, "triage ledger parsed no items, so this gate would pass vacuously");

  const queued = new Set(
    rowsOf(sectionOf(source, "Build order")).flatMap(([, item]) => identifiersIn(item ?? "")),
  );
  const held = new Set(
    rowsOf(sectionOf(source, "Held")).map(([id]) => (id ?? "").replaceAll("`", "")),
  );
  assert.ok(queued.size > 0, "build order parsed no items");
  assert.ok(held.size > 0, "held section parsed no items");

  const problems = [];
  for (const [id, { status }] of items) {
    // A landed item that is still queued makes the board a history rather than
    // a set of legal next moves.
    if (status === "landed" && queued.has(id)) {
      problems.push(`${id}: landed but still in build order`);
    }
    if (status === "held" && !held.has(id)) {
      problems.push(`${id}: held in the ledger but absent from the held section`);
    }
    if (status !== "held" && held.has(id)) {
      problems.push(`${id}: in the held section but reads ${status} in the ledger`);
    }
    // Not choosing an item is a judgement and stays visible; losing it is not.
    if (status !== "landed" && !queued.has(id) && !held.has(id)) {
      problems.push(`${id}: reads ${status} but is in neither build order nor held`);
    }
  }
  for (const id of [...queued, ...held]) {
    if (!items.has(id)) problems.push(`${id}: placed on the board with no ledger row`);
  }
  assert.deepEqual(problems, [], `board state must agree with the ledger:\n${problems.join("\n")}`);
});

test("Given the milestones, when each is read, then no landed item is presented as a live move and the closed count matches the closed set", async () => {
  const source = await boardSource();
  const items = await ledger();
  assert.ok(items.size > 10, "triage ledger parsed no items, so this gate would pass vacuously");

  const problems = [];
  const milestones = [...source.matchAll(/^## (M\d+) - .*$/gmu)];
  assert.ok(milestones.length > 0, "no milestone sections found");
  for (const [, name] of milestones) {
    const heading = source.slice(source.indexOf(`## ${name} - `));
    const body = heading.slice(0, heading.indexOf("\n---"));
    for (const [id] of rowsOf(body)) {
      const identifier = (id ?? "").replaceAll("`", "");
      if (items.get(identifier)?.status === "landed") {
        problems.push(`${identifier}: landed but listed as a live move in ${name}`);
      }
    }
  }

  // The closed section states its own size in prose, and prose does not follow
  // the set it describes unless something makes it.
  const closed = sectionOf(source, "Closed");
  assert.notEqual(closed, undefined, "closed section is missing");
  const declared = /^(\w+) milestones are complete/mu.exec(closed ?? "");
  assert.notEqual(declared, null, "closed section declares no count");
  const words = new Map([
    ["One", 1], ["Two", 2], ["Three", 3], ["Four", 4], ["Five", 5], ["Six", 6],
    ["Seven", 7], ["Eight", 8], ["Nine", 9], ["Ten", 10], ["Eleven", 11], ["Twelve", 12],
  ]);
  const stated = words.get(declared[1]);
  assert.notEqual(stated, undefined, `closed count "${declared[1]}" is not a word this gate knows`);
  const present = (closed?.match(/^\*\*.+\*\*\\$/gmu) ?? []).length;
  if (stated !== present) {
    problems.push(`closed section says ${declared[1]} milestones and carries ${present}`);
  }
  assert.deepEqual(problems, [], `milestones must match the ledger:\n${problems.join("\n")}`);
});

test("Given every record that cites a board item, when the citation is resolved, then the item exists on the board", async () => {
  const items = await ledger();
  assert.ok(items.size > 10, "triage ledger parsed no items, so this gate would pass vacuously");

  const files = await collectMarkdown(root, []);
  assert.ok(files.length > 20, `only ${files.length} markdown files found, so this gate would pass vacuously`);

  const problems = [];
  let citations = 0;
  for (const file of files) {
    if (file === boardPath) continue;
    const relative = path.relative(root, file);
    for (const identifier of new Set(identifiersIn(await readFile(file, "utf8")))) {
      citations += 1;
      // The board gates that its own items reach the ledger. This is the other
      // direction: a document may cite a move that was never filed, and that
      // citation reads as a commitment to anyone who follows it.
      if (!items.has(identifier)) {
        problems.push(`${relative}: cites ${identifier}, which is not on the board`);
      }
    }
  }
  assert.ok(citations > 0, "no board citations found outside the board");
  assert.deepEqual(problems, [], `a record may not cite a board item that does not exist:\n${problems.join("\n")}`);
});

test("Given confirmed intent, when a row says it was amended, then it names the decision that amended it", async () => {
  const decisions = await readFile(path.join(root, "docs/DECISIONS.md"), "utf8");
  const intent = sectionOf(decisions, "2. Confirmed intent");
  assert.notEqual(intent, undefined, "confirmed intent section is missing");

  const rows = rowsOf(intent);
  assert.ok(rows.length > 5, `confirmed intent parsed ${rows.length} rows, so this gate would pass vacuously`);

  // The absorption gate reads decision numbers. An amendment recorded as prose
  // alone therefore changes direction where no gate is looking, which is how
  // Q1(b) widened the unit of reachability and reached the vision only because
  // D26 happened to arrive carrying it.
  const problems = [];
  for (const cells of rows) {
    const row = cells.join(" | ");
    if (!/mended/u.test(row)) continue;
    if (!/`D\d+`/u.test(row)) {
      problems.push(`${cells[0]}: says it was amended and names no decision`);
    }
  }
  assert.deepEqual(problems, [], `an amended intent must name its decision:\n${problems.join("\n")}`);
});

test("Given every ratified decision, when it is checked against the vision, then it has been absorbed or explicitly ruled not to change purpose", async () => {
  const decisions = await readFile(path.join(root, "docs/DECISIONS.md"), "utf8");
  const register = JSON.parse(
    await readFile(path.join(root, "docs/design/vision-absorption.json"), "utf8"),
  );

  const ratified = [...decisions.matchAll(/^### D(\d+) - /gmu)].map(([, n]) => Number(n));
  assert.ok(ratified.length > 10, "decision register parsed no decisions, so this gate would pass vacuously");

  const known = new Set(Object.keys(register.dispositions));
  const problems = [];
  for (const number of ratified) {
    // The vision was authored with everything up to the watermark in view, so
    // those are absorbed by authorship. Everything after it owes a judgement.
    if (number <= register.absorbedThrough) continue;
    const entry = register.decisions[`D${number}`];
    if (entry === undefined) {
      problems.push(`D${number}: ratified after the vision was written and never resolved against it`);
      continue;
    }
    if (!known.has(entry.disposition)) {
      problems.push(`D${number}: disposition "${entry.disposition}" is not one this register defines`);
    }
    // A reason is the whole value of the register; a disposition alone records
    // that someone clicked rather than that someone judged.
    if (typeof entry.reason !== "string" || entry.reason.length < 60) {
      problems.push(`D${number}: states no reason of substance`);
    }
  }
  for (const key of Object.keys(register.decisions)) {
    const number = Number(key.slice(1));
    if (!ratified.includes(number)) {
      problems.push(`${key}: resolved against the vision but is not a ratified decision`);
    }
    if (number <= register.absorbedThrough) {
      problems.push(`${key}: is at or below the authorship watermark and needs no entry`);
    }
  }
  assert.deepEqual(problems, [], `every decision must be resolved against the vision:\n${problems.join("\n")}`);
});
