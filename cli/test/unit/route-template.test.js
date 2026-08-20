import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  cliRoot,
  readJsonFixture,
  runProcess,
} from "../fixtures/process-fixture.js";

const template = path.join(cliRoot, "tpl/tpl.routes.list.jq");

async function project(document) {
  return runProcess("/usr/bin/jq", ["-f", template], {
    input: `${JSON.stringify(document)}\n`,
  });
}

test("Given an empty route view, when the static template projects it, then an empty array remains a successful display input", async () => {
  const result = await project(await readJsonFixture("routes-empty.json"));

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), []);
});

test("Given local session selected and losing routes, when the static template projects them, then next hops paths and winner markers are canonical", async () => {
  const result = await project(await readJsonFixture("routes-cases.json"));
  const rows = JSON.parse(result.stdout);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].selected, ">");
  assert.equal(rows[0].next_hop, "local");
  assert.equal(rows[0].learned_kind, "");
  assert.equal(rows[1].selected, "");
  assert.equal(rows[1].next_hop, "spoke.alpha@75c4ae");
  assert.equal(rows[1].path, "spoke.alpha>hub.local");
  assert.doesNotMatch(rows[1].endpoint, /\u001b/u);
});

test("Given a wrong-kind route document, when the static template validates it, then projection fails closed", async () => {
  const result = await project({
    apiVersion: "agp.management/v1",
    kind: "ConnectionList",
    candidates: [],
    selected: [],
  });

  assert.notEqual(result.code, 0);
});
