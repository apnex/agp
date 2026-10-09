import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { startProcessNode } from "../support/node-handle.js";
import { awaitConvergence, buildGeometry, GEOMETRIES } from "../support/geometry.js";
import { waitForTestEvent } from "../support/test-waits.js";

const fixture = fileURLToPath(new URL("./fixtures/silent-node-process.mjs", import.meta.url));

test("Given an isolated child that never announces readiness, when acquisition expires, then the child exits and its configuration directory is removed", { timeout: 10_000 }, async (context) => {
  const probe = processProbe(context, "no-ready");
  await assert.rejects(startProcessNode(probe.options), /Test event timeout: isolated node readiness/);
  assert.equal(probe.child.exitCode, 0);
  assert.equal(isAlive(probe.child.pid), false);
  await assert.rejects(access(probe.directory), { code: "ENOENT" });
});

test("Given a child that ignores an IPC request, when the request deadline expires, then its command is named and later cleanup reaps the child", { timeout: 10_000 }, async (context) => {
  const probe = processProbe(context, "no-reply");
  const node = await startProcessNode(probe.options);
  context.after(() => node.stop());
  await assert.rejects(node.snapshot(), /Test event timeout: isolated node test.silent snapshot reply/);
  await node.stop();
  assert.equal(isAlive(node.pid), false);
  await assert.rejects(access(probe.directory), { code: "ENOENT" });
});

test("Given a child that exits before replying, when the request and repeated stops settle, then failure is immediate and no second exit is awaited", { timeout: 10_000 }, async (context) => {
  const probe = processProbe(context, "exit-on-request");
  const node = await startProcessNode(probe.options);
  context.after(() => node.stop());
  await assert.rejects(node.snapshot(), /Test node process exited: code=3/);
  const stopping = node.stop();
  assert.equal(node.stop(), stopping);
  await stopping;
  assert.equal(isAlive(node.pid), false);
  await assert.rejects(access(probe.directory), { code: "ENOENT" });
});

test("Given a child that ignores orderly stop, when the grace bound expires, then forced termination is observed before temporary files disappear", { timeout: 10_000 }, async (context) => {
  const probe = processProbe(context, "ignore-stop");
  const node = await startProcessNode(probe.options);
  context.after(() => node.stop());
  await node.stop();
  assert.equal(probe.child.signalCode, "SIGKILL");
  assert.equal(isAlive(node.pid), false);
  await assert.rejects(access(probe.directory), { code: "ENOENT" });
});

for (const transport of ["websocket", "websocket-psk"]) {
  test(`Given real isolated nodes over ${transport}, when routing converges and a message is sent, then IPC retains the receipt and arrival and shutdown reaps both children`, { timeout: 20_000 }, async (context) => {
    const topology = await buildGeometry({ geometry: GEOMETRIES.chain(2), transport, isolation: "process", context });
    try {
      await awaitConvergence(topology, 5_000);
      await waitForTestEvent((async () => {
        while (!(await topology.nodes[1].snapshot()).routeExports.some(
          ({ endpoint, state }) => endpoint === "n1/ep0" && state === "acked")) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      })(), `${transport} isolated source export ACK`, { signal: context.signal });
      const receipt = await topology.nodes[1].send("n1/ep0", "n0/ep0", { proof: transport });
      assert.equal(typeof receipt.messageId, "string");
      await waitForTestEvent((async () => {
        while ((await topology.nodes[0].arrivals("n0/ep0")).count !== 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      })(), `${transport} isolated delivery`, { signal: context.signal });
      assert.deepEqual(topology.deliveries, [{ endpoint: "n0/ep0", payload: { proof: transport } }]);
    } finally {
      await Promise.all(topology.nodes.map((node) => node.stop()));
    }
    assert.ok(topology.nodes.every((node) => !isAlive(node.pid)));
  });
}

function processProbe(context, mode) {
  const probe = {};
  // Fallback cleanup owns only this fixture child. Assertions above measure the
  // harness first, so this safety net cannot turn a leaked child into a pass.
  context.after(async () => {
    if (!probe.child) return;
    if (isAlive(probe.child.pid)) probe.child.kill("SIGKILL");
    await waitForTestEvent(probe.closed, "silent process fixture cleanup", { timeoutMs: 2_000 });
    await rm(probe.directory, { recursive: true, force: true });
  });
  probe.options = {
    config: { mode }, transport: {}, endpoints: [], deliveries: [],
    readyTimeoutMs: mode === "no-ready" ? 1_000 : 5_000,
    requestTimeoutMs: 100, stopTimeoutMs: 100,
    forkProcess(_runner, args, options) {
      probe.directory = path.dirname(args[0]);
      probe.child = fork(fixture, args, options);
      probe.closed = once(probe.child, "close");
      return probe.child;
    },
  };
  return probe;
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}
