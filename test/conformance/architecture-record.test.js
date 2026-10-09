import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("Given the confirmed intent record, when its numbered subsections are read, then every number is unique and ordered", async () => {
  const source = await readFile(new URL("../../docs/DECISIONS.md", import.meta.url), "utf8");
  const numbers = [...source.matchAll(/^### 2\.(\d+) /gmu)].map((match) => Number(match[1]));
  assert.ok(numbers.length >= 6, "confirmed intent subsections were not found");
  assert.deepEqual(numbers, numbers.map((_, index) => index + 1));
});

test("Given the reconciled architecture, when its current paths and scope owners are resolved, then none points at a fictional module or a forked deferred list", async () => {
  const source = await readFile(new URL("../../docs/ARCHITECTURE.md", import.meta.url), "utf8");
  const modules = source.split("| Module boundary | One exact concern |")[1].split("Internal module boundaries")[0];
  const homes = modules.split("\n").map((line) => line.split("|")[1] ?? "").join("\n");
  const paths = [...homes.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
  assert.ok(paths.length >= 20, "module table was not found");
  for (const module of paths) {
    const prefix = /^(cli|rustcli)\//u.test(module) ? "../../" : "../../packages/";
    await access(new URL(prefix + module, import.meta.url));
  }
  const scope = source.split("## 10. Scope boundary")[1].split("## 11.")[0];
  assert.match(scope, /\[vision\]\(\.\.\/VISION.md\)/u);
  assert.match(scope, /\(design\/mechanisms.md\)/u);
  assert.doesNotMatch(scope, /^\s*(?:Included|Deferred):|^\| F\d+/mu);
  // This is a structural currency check, not a semantic judgement of the prose.
  const body = source.slice(source.indexOf("## 2. Mandate"));
  for (let decision = 20; decision <= 32; decision += 1) {
    assert.match(body, new RegExp(`\\bD${decision}\\b`, "u"));
  }
});
