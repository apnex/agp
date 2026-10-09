import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { createNode } from "@agp/node";
import { nextTestEvent, waitForTestEvent } from "../support/test-waits.js";

const run = promisify(execFile);
const root = new URL("../../", import.meta.url);
const cases = [
  {
    file: "test/resilience/cross-dial-race.test.js",
    before: "network.dialBarrier(2)", after: "network.dialBarrier(3)",
    event: "both reciprocal dials at barrier",
    cleanup: "return stopAll(higher, lower);", nodes: ["higher", "lower"],
  },
  {
    file: "test/resilience/queue-saturation.test.js",
    before: "occupied.reach();", after: "/* arrival deliberately withheld */",
    event: "saturation handler entered",
    cleanup: "return stopAll(peerNode, node);", nodes: ["peerNode", "node"],
  },
  {
    file: "packages/node/test/contract/late-handler-settlement.test.js",
    before: "markStarted();", after: "/* arrival deliberately withheld */",
    event: "late handler started",
    cleanup: 'return waitForTestEvent(node.stop({ drainTimeoutMs: 0 }), "late handler node cleanup");',
    nodes: ["node"],
  },
];

test("Given a full subscriber allowance and an absent matching event, when the wait expires, then the pending read ends and a new subscriber can be admitted", { timeout: 10_000 }, async (context) => {
  const node = createNode({ nodeId: "wait-cleanup.node", capacity: { maxEventSubscribers: 1 } });
  context.after(() => waitForTestEvent(node.stop(), "subscriber test node cleanup"));
  const subscription = node.operations.events();
  await assert.rejects(nextTestEvent(subscription, () => false, "absent operational event", { timeoutMs: 25 }),
    { code: "TEST_EVENT_TIMEOUT" });
  assert.equal((await waitForTestEvent(subscription.next(), "closed subscriber read")).done, true);
  const replacement = node.operations.events();
  context.after(() => replacement.close());
  await node.expose("wait/endpoint", () => {});
  const event = await nextTestEvent(replacement, (item) => item.kind === "endpoint.exposed", "replacement subscriber receives");
  assert.equal(event.subjectId, "wait/endpoint");
});

for (const entry of cases) {
  test(`Given a missing ${entry.event}, when the actual test runs with that stimulus withheld, then it fails by event name and completes node cleanup`, { timeout: 20_000 }, async () => {
    const original = await readFile(new URL(entry.file, root), "utf8");
    assert.equal(original.split(entry.before).length, 2, "the intended stimulus mutation must land exactly once");
    assert.equal(original.split(entry.cleanup).length, 2, "the cleanup witness must attach exactly once");
    const afterCleanup = entry.cleanup.slice(0, -1) + `.then(() => {
      for (const stoppedNode of [${entry.nodes.join(", ")}]) {
        assert.equal(stoppedNode.operations.lifecycle().state, "Stopped");
      }
      process.stdout.write("TEST_WAIT_CLEANUP_CONFIRMED\\n");
    }).catch((error) => {
      process.stderr.write("TEST_WAIT_CLEANUP_FAILED: " + error.stack + "\\n");
      throw error;
    });`;
    // Only the event stimulus is removed. The production test's actual wait and
    // registered cleanup stay intact; the added witness checks their end state.
    const source = original.replace(entry.before, entry.after).replace(entry.cleanup, afterCleanup)
      .replace(/from "([^"]+)"/gu, (match, specifier) => {
        if (specifier.startsWith("node:")) return match;
        const resolved = specifier.startsWith(".")
          ? new URL(specifier, new URL(entry.file, root)).href : import.meta.resolve(specifier);
        return `from "${resolved}"`;
      });
    const directory = await mkdtemp(path.join(tmpdir(), "agp-missing-event-"));
    const file = path.join(directory, "missing-event.mjs");
    try {
      await writeFile(file, source);
      let outcome;
      try {
        await run(process.execPath, ["--test", "--test-isolation=none", "--test-reporter=tap", file], {
          timeout: 12_000, killSignal: "SIGKILL", maxBuffer: 1_048_576,
          env: { ...process.env, NODE_TEST_CONTEXT: "" },
        });
      } catch (error) { outcome = error; }
      assert.ok(outcome, "withheld event must not pass");
      assert.equal(outcome.signal, null, "outer watchdog must not be the failure mechanism");
      assert.equal(outcome.code, 1);
      assert.ok(outcome.stdout.includes(`Test event timeout: ${entry.event}`), outcome.stdout);
      assert.ok(outcome.stdout.includes("TEST_WAIT_CLEANUP_CONFIRMED"), outcome.stdout + outcome.stderr);
      assert.doesNotMatch(outcome.stdout + outcome.stderr, /hookFailed|unhandledRejection|uncaughtException/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
