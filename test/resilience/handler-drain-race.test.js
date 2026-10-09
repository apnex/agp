import assert from "node:assert/strict";
import test from "node:test";
import { waitForTestEvent } from "../support/test-waits.js";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  barrier,
  createChaosNode,
  stopAll,
} from "./support/fixture.js";

test("Given an admitted handler held beyond a zero-duration drain deadline, when stop revokes its binding and the handler settles late, then the signal aborts and terminal canonical state remains at its exact stopped revision", async (context) => {
  const network = new ChaosNetwork();
  const occupied = barrier("late handler");
  const returned = barrier("handler returned");
  const node = createChaosNode(network, {
    nodeId: "drain.node",
    capacity: { maxActiveHandlers: 1 },
  });
  context.after(() => {
    occupied.release();
    return stopAll(node);
  });
  let signal;
  await node.expose("drain/source", () => undefined);
  await node.expose("drain/destination", async (_payload, handlerContext) => {
    signal = handlerContext.signal;
    occupied.reach();
    await occupied.released;
    returned.reach();
  });
  await node.start();
  await node.send(
    "drain/source",
    "drain/destination",
    { phase: "held" },
  );
  await waitForTestEvent(occupied.reached, "late handler entered", { signal: context.signal });

  const report = await node.stop({ drainTimeoutMs: 0 });
  const terminal = node.operations.snapshot();
  assert.equal(signal.aborted, true);
  assert.equal(terminal.lifecycle.state, "Stopped");
  assert.equal(report.operationsRevision, terminal.revision);

  occupied.release();
  await waitForTestEvent(returned.reached, "late handler returned", { signal: context.signal });
  await new Promise((resolve) => setImmediate(resolve));
  await node.executor.quiesce();
  const afterLateSettlement = node.operations.snapshot();

  assert.equal(afterLateSettlement.revision, terminal.revision);
  assert.deepEqual(afterLateSettlement.counters, terminal.counters);
  assert.deepEqual(afterLateSettlement.lifecycle, terminal.lifecycle);
  assert.equal(report.discardedMessages, "0");
});
