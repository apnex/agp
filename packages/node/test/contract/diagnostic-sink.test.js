import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";
import { TransportOperationError } from "@agp/transport";

// Owns: the node-owned diagnostic sink boundary. A diagnostic is a frozen
// schema-shaped capture; the raw cause stays a separate process-local argument;
// and an absent, throwing, or re-entrant sink cannot alter canonical outcomes.

const DIAGNOSTIC_FIELDS = new Set([
  "schemaVersion",
  "nodeId",
  "instanceId",
  "occurredAt",
  "operationsRevision",
  "domain",
  "severity",
  "code",
  "message",
]);

// A target that always refuses to connect, which is the node's diagnostic path
// that does not require a live peer.
function failingDialTransport(reference, error) {
  return Object.freeze({
    resolveListener: () => undefined,
    resolveTarget: (value) =>
      value === reference
        ? Object.freeze({ connect: async () => { throw error; } })
        : undefined,
  });
}

function dialingNode(nodeId, reference, dependencies) {
  return createNode({
    nodeId,
    peers: [{
      adjacencyId: "primary",
      expectedNodeId: "peer.remote",
      transportRef: reference,
      reconnect: {
        enabled: false,
        initialDelayMs: 1_000,
        maximumDelayMs: 1_000,
        multiplier: 1,
        jitterRatio: 0,
      },
    }],
  }, dependencies);
}

async function settle() {
  for (let index = 0; index < 50; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("given a dial that fails with a typed transport error, when the sink observes it, then the record is a frozen closed capture and the raw cause arrives separately", async () => {
  const cause = new Error("socket refused by the operating system");
  const error = new TransportOperationError({
    code: "CONNECT_FAILED",
    phase: "connect",
    message: "connect rejected",
    cause,
  });
  const captured = [];
  const node = dialingNode("diag.typed", "diag.target", {
    transport: failingDialTransport("diag.target", error),
    diagnostics: {
      emit: (record, rawCause) => captured.push({ record, rawCause }),
    },
  });

  await node.start();
  await settle();
  await node.stop();

  assert.ok(captured.length >= 1, "a failed dial must emit a diagnostic");
  const { record, rawCause } = captured[0];

  assert.equal(record.schemaVersion, "agp.diagnostic/v1");
  assert.equal(record.nodeId, "diag.typed");
  assert.equal(record.domain, "transport");
  assert.equal(record.severity, "warning");
  assert.equal(record.code, "CONNECT_FAILED");
  assert.equal(Object.isFrozen(record), true, "the record must be immutable");
  for (const key of Object.keys(record)) {
    assert.equal(DIAGNOSTIC_FIELDS.has(key), true, `unexpected field ${key}`);
  }

  // The raw cause is a separate argument and is never serialised into the
  // record, so native error material cannot escape through the contract.
  assert.equal(rawCause, cause);
  assert.equal(JSON.stringify(record).includes("socket refused"), false);
});

test("given an untyped dial failure, when the sink observes it, then the code degrades to the closed vocabulary rather than leaking the native message", async () => {
  const cause = new Error("EACCES /var/run/secret.sock");
  const captured = [];
  const node = dialingNode("diag.untyped", "diag.target", {
    transport: failingDialTransport("diag.target", cause),
    diagnostics: { emit: (record) => captured.push(record) },
  });

  await node.start();
  await settle();
  await node.stop();

  assert.ok(captured.length >= 1);
  assert.equal(captured[0].code, "CONNECT_FAILED");
  assert.equal(JSON.stringify(captured[0]).includes("EACCES"), false);
});

test("given no sink at all, when a dial fails, then the node lifecycle is unchanged and remains inspectable", async () => {
  const node = dialingNode("diag.absent", "diag.target", {
    transport: failingDialTransport(
      "diag.target",
      new TransportOperationError({
        code: "CONNECT_FAILED",
        phase: "connect",
        message: "connect rejected",
      }),
    ),
  });

  await node.start();
  await settle();
  const lifecycle = node.operations.snapshot().lifecycle.state;
  await node.stop();

  assert.equal(lifecycle, "Running");
  assert.equal(node.operations.snapshot().lifecycle.state, "Stopped");
});

test("given a sink that throws and a sink that re-enters the reader, when a dial fails, then canonical state is identical to the absent-sink outcome", async () => {
  const makeError = () => new TransportOperationError({
    code: "CONNECT_FAILED",
    phase: "connect",
    message: "connect rejected",
  });

  const throwing = dialingNode("diag.hostile", "diag.target", {
    transport: failingDialTransport("diag.target", makeError()),
    diagnostics: {
      emit: () => { throw new Error("sink is hostile"); },
    },
  });
  await throwing.start();
  await settle();
  const throwingRevision = throwing.operations.snapshot().revision;
  const throwingState = throwing.operations.snapshot().lifecycle.state;
  await throwing.stop();

  let reentrantReads = 0;
  const reentrant = dialingNode("diag.hostile", "diag.target", {
    transport: failingDialTransport("diag.target", makeError()),
    diagnostics: {
      emit: () => {
        reentrantReads += 1;
        // Reading canonical state from inside the sink must be safe: the
        // record is emitted after the executor has released.
        reentrant.operations.snapshot();
        reentrant.operations.connections();
      },
    },
  });
  await reentrant.start();
  await settle();
  const reentrantRevision = reentrant.operations.snapshot().revision;
  const reentrantState = reentrant.operations.snapshot().lifecycle.state;
  await reentrant.stop();

  assert.ok(reentrantReads >= 1, "the re-entrant sink must actually have run");
  assert.equal(throwingState, "Running");
  assert.equal(reentrantState, "Running");
  assert.equal(throwingRevision, reentrantRevision);
});
