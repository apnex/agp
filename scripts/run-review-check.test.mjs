import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./run-review-check.mjs", import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));

function reviewFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agp-review-runner-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const temporary = path.join(directory, "temporary");
  fs.mkdirSync(temporary);
  const sentinel = path.join(directory, "keep.txt");
  fs.writeFileSync(sentinel, "outside the command-owned directory");
  const env = { ...process.env, TMPDIR: temporary, TMP: temporary, TEMP: temporary };
  delete env.NODE_TEST_CONTEXT;
  return { directory, temporary, sentinel, env };
}

function runReviewFixture(fixture, source, flags = []) {
  return spawnSync(process.execPath, [runner, ...flags, "--", process.execPath,
    "--input-type=module", "-e", source], {
    cwd: root, env: fixture.env, encoding: "utf8", timeout: 10000,
  });
}

test("Given a successful nested review, when its command ends, then scratch is removed after evidence consumption", (t) => {
  const f = reviewFixture(t);
  const result = runReviewFixture(f, `
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    import { execFileSync } from 'node:child_process';
    const work = os.tmpdir();
    const source = "require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(), 'evidence'), 'complete')";
    execFileSync(process.execPath, ['-e', source]);
    fs.symlinkSync(${JSON.stringify(f.sentinel)}, path.join(work, 'external'));
    console.log(JSON.stringify({ work, value: fs.readFileSync(path.join(work, 'evidence'), 'utf8'),
      redirected: [process.env.TMPDIR, process.env.TMP, process.env.TEMP] }));
  `);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.value, "complete");
  assert.equal(path.dirname(observed.work), f.temporary);
  assert.deepEqual(observed.redirected, [observed.work, observed.work, observed.work]);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
  assert.equal(fs.readFileSync(f.sentinel, "utf8"), "outside the command-owned directory");
  assert.match(result.stderr, /Review scratch removed:/u);
});

test("Given a failing review, when it exits nonzero, then scratch is removed and the exit code is preserved", (t) => {
  const f = reviewFixture(t);
  const result = runReviewFixture(f, `
    import fs from 'node:fs';
    import os from 'node:os';
    import path from 'node:path';
    fs.writeFileSync(path.join(os.tmpdir(), 'partial'), 'incomplete');
    process.exitCode = 7;
  `);
  assert.equal(result.status, 7, result.stderr);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
});

test("Given read-only review variants, when cleanup runs, then owned directories are removed without changing linked external objects", (t) => {
  const f = reviewFixture(t);
  const external = path.join(f.directory, "external-directory");
  fs.mkdirSync(external);
  fs.chmodSync(external, 0o555);
  fs.chmodSync(f.sentinel, 0o444);
  try {
    const result = runReviewFixture(f, `
      import fs from 'node:fs';
      import os from 'node:os';
      import path from 'node:path';
      const locked = path.join(os.tmpdir(), 'variant');
      fs.mkdirSync(locked);
      fs.linkSync(${JSON.stringify(f.sentinel)}, path.join(locked, 'linked-file'));
      fs.symlinkSync(${JSON.stringify(external)}, path.join(locked, 'external-directory'));
      fs.chmodSync(locked, 0o500);
    `);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(f.temporary), []);
    assert.equal(fs.statSync(external).mode & 0o777, 0o555);
    assert.equal(fs.statSync(f.sentinel).mode & 0o777, 0o444);
  } finally {
    fs.chmodSync(external, 0o755);
    // Leave no failed-test residue when exercising a missing-cleanup regression.
    for (const entry of fs.readdirSync(f.temporary)) {
      const variant = path.join(f.temporary, entry, "variant");
      if (fs.existsSync(variant)) fs.chmodSync(variant, 0o700);
    }
  }
});

for (const exitCode of [0, 7]) {
  test(`Given explicit retention and exit ${exitCode}, when a review ends, then its scratch remains inspectable`, (t) => {
    const f = reviewFixture(t);
    const result = runReviewFixture(f, `
      import fs from 'node:fs';
      import os from 'node:os';
      import path from 'node:path';
      fs.writeFileSync(path.join(os.tmpdir(), 'evidence'), 'retained');
      console.log(JSON.stringify({ work: os.tmpdir() }));
      process.exitCode = ${exitCode};
    `, ["--keep-work"]);
    assert.equal(result.status, exitCode, result.stderr);
    const { work } = JSON.parse(result.stdout);
    assert.equal(path.dirname(work), f.temporary);
    assert.equal(fs.readFileSync(path.join(work, "evidence"), "utf8"), "retained");
    assert.match(result.stderr, /Review scratch retained:/u);
  });
}

test("Given an unavailable command, when spawning fails, then its scratch is removed", (t) => {
  const f = reviewFixture(t);
  const result = spawnSync(process.execPath, [runner, "--", path.join(f.directory, "absent-command")], {
    cwd: root, env: f.env, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/u);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
});

test("Given an unknown option, when the runner rejects it, then no scratch is created", (t) => {
  const f = reviewFixture(t);
  const result = spawnSync(process.execPath, [runner, "--keep-wrok", "--", process.execPath], {
    cwd: root, env: f.env, encoding: "utf8", timeout: 10000,
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Review check usage:/u);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
});

test("Given the historical receipt fixtures, when run repeatedly through the runner, then no temporary Git repositories remain", (t) => {
  const f = reviewFixture(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = spawnSync(process.execPath, [runner, "--", process.execPath, "--test",
      "docs/reviews/admission-lifetime-assurance-r4/admission-execution-receipt.test.mjs"], {
      cwd: root, env: f.env, encoding: "utf8", timeout: 20000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /pass 2/u);
    assert.deepEqual(fs.readdirSync(f.temporary), [], `fixture residue after attempt ${attempt + 1}`);
  }
});

test("Given a POSIX review with an inherited-output descendant, when the command ends, then that descendant cannot keep the runner open", {
  skip: process.platform === "win32",
}, (t) => {
  const f = reviewFixture(t);
  const result = runReviewFixture(f, `
    import { spawn } from 'node:child_process';
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });
    child.unref();
  `);
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
});

test("Given a running POSIX review, when interrupted, then its command stops and scratch is removed", {
  skip: process.platform === "win32", timeout: 10000,
}, async (t) => {
  const f = reviewFixture(t);
  const child = spawn(process.execPath, [runner, "--", process.execPath, "-e",
    "console.log('review-ready'); setInterval(() => {}, 1000)"], {
    cwd: root, env: f.env, stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Review fixture did not become ready")), 5000);
    let stdout = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes("review-ready")) { clearTimeout(timer); resolve(); }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", () => { clearTimeout(timer); reject(new Error(stderr)); });
  });
  child.kill("SIGTERM");
  assert.deepEqual(await closed, { code: 143, signal: null }, stderr);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
});
