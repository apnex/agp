import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  cliRoot,
  readJsonFixture,
  runProcess,
} from "../fixtures/process-fixture.js";

const template = path.join(cliRoot, "tpl/tpl.connections.list.jq");

async function project(document) {
  return runProcess("/usr/bin/jq", ["-f", template], {
    input: `${JSON.stringify(document)}\n`,
  });
}

test("Given an empty connection view, when the static template projects it, then an empty array remains a successful display input", async () => {
  const result = await project(await readJsonFixture("connections-empty.json"));

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), []);
});

test("Given admitted and hostile connection fields, when the static template projects them, then row shape is stable and controls are sanitized", async () => {
  const result = await project(await readJsonFixture("connections-cases.json"));
  const rows = JSON.parse(result.stdout);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    session_id: "75c4ae",
    remote_node: "spoke.alpha",
    direction: "inbound",
    state: "Established",
    uptime: "01:00:00",
    ttl: "21s",
    last_event: "KeepaliveReceived",
  });
  assert.doesNotMatch(JSON.stringify(rows[1]), /[\u0000-\u001f\u007f]/u);
  assert.doesNotMatch(rows[1].remote_node, /\u202e/u);
});

test("Given a pre-identity controller without remote authority, when the static template projects it, then its local session is shown and remote node is a dash", async () => {
  const result = await project({
    apiVersion: "agp.management/v1",
    kind: "ConnectionList",
    items: [{
      identityState: "pending",
      localSessionId: "75c4af",
      direction: "outbound",
      state: "Active",
      lastTransition: { event: "RetryExpired" },
      timers: [],
    }],
  });
  const rows = JSON.parse(result.stdout);

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(rows, [{
    session_id: "75c4af",
    remote_node: "-",
    direction: "outbound",
    state: "Active",
    uptime: "-",
    ttl: "-",
    last_event: "RetryExpired",
  }]);
});

test("Given consecutive SDK snapshots materialized one second apart, when connection rows are projected, then TTL follows the supplied monotonic remaining duration", async () => {
  const document = (remainingMs) => ({
    apiVersion: "agp.management/v1",
    kind: "ConnectionList",
    meta: {
      nodeId: "node.local",
      instanceId: "instance-1",
      capturedAt: "2026-07-29T06:00:00.000Z",
      revision: "1",
    },
    items: [{
      sessionId: "75c4ae",
      direction: "inbound",
      state: "Established",
      establishedDurationMs: 3_600_000,
      lastTransition: { event: "KeepaliveReceived" },
      timers: [{
        name: "hold",
        state: "armed",
        durationMs: 30_000,
        remainingMs,
      }],
    }],
  });
  const first = await project(document(30_000));
  const second = await project(document(29_000));

  assert.equal(first.code, 0, first.stderr);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(JSON.parse(first.stdout)[0].ttl, "30s");
  assert.equal(JSON.parse(second.stdout)[0].ttl, "29s");
});

test("Given an established connection older than one day, when the static template projects it, then materialized uptime retains total elapsed hours", async () => {
  const result = await project({
    apiVersion: "agp.management/v1",
    kind: "ConnectionList",
    meta: {
      nodeId: "node.local",
      instanceId: "instance-1",
      capturedAt: "2026-07-29T06:00:00.000Z",
      revision: "1",
    },
    items: [{
      sessionId: "75c4ae",
      direction: "inbound",
      state: "Established",
      establishedDurationMs: 176_523_000,
      lastTransition: {
        event: "KeepaliveReceived",
        reasonCode: "PEER_CONFIRMED",
      },
      timers: [],
    }],
  });
  const rows = JSON.parse(result.stdout);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(rows[0].uptime, "49:02:03");
});

test("Given a wrong-version connection document, when the static template validates it, then projection fails closed", async () => {
  const result = await project({
    apiVersion: "agp.management/v2",
    kind: "ConnectionList",
    items: [],
  });

  assert.notEqual(result.code, 0);
});
