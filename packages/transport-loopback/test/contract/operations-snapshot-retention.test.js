import assert from "node:assert/strict";
import test from "node:test";

import { createLoopbackFabric } from "../../dist/index.js";
import {
  FABRIC_LIMITS,
  acquirePair,
  closeFabric,
  createFixture,
  liveSignal,
} from "../support/topology.js";

test("given a live channel when its terminals commit and resources release then snapshots expose separate revisions without tombstone growth", async () => {
  const fixture = createFixture({ fabricId: "snapshot-retention" });
  const pair = await acquirePair(fixture);
  const open = fixture.fabric.snapshot();
  assert.equal(open.channels.length, 1);
  assert.equal(open.channels[0].state, "Open");
  assert.equal(open.resources.activeChannels, 1);
  assert.ok(Object.isFrozen(open));
  assert.ok(Object.isFrozen(open.channels));
  assert.ok(Object.isFrozen(open.resources));
  assert.throws(() => {
    open.resources.activeChannels = 99;
  }, TypeError);

  pair.left.abort({ kind: "forced-stop", code: "RETENTION_TEST" });
  const closing = fixture.fabric.snapshot();
  assert.equal(closing.channels[0].state, "Closing");
  assert.ok(BigInt(closing.revision) > BigInt(open.revision));

  await Promise.resolve();
  const terminal = fixture.fabric.snapshot();
  assert.equal(terminal.channels[0].state, "Terminal");
  assert.equal(terminal.channels[0].leftTerminal.origin, "local");
  assert.equal(terminal.channels[0].rightTerminal.origin, "remote");
  assert.ok(BigInt(terminal.revision) > BigInt(closing.revision));

  await Promise.resolve();
  const released = fixture.fabric.snapshot();
  assert.equal(released.channels.length, 0);
  assert.equal(released.resources.activeChannels, 0);
  assert.equal(released.counters.forcedChannelAborts, "1");
  assert.equal(open.channels.length, 1);

  pair.listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});

test("given listeners registered out of order when a snapshot is produced then rows use deterministic UTF-8 address order", async () => {
  const fabric = createLoopbackFabric({
    fabricId: "snapshot-order",
    limits: FABRIC_LIMITS,
  });
  const port = fabric.createTransport({
    transportName: "owner",
    capabilities: { listen: true, connect: false },
  }).createPort({
    listeners: new Map([
      ["z.listener", {
        fabricId: "snapshot-order",
        address: "zeta",
      }],
      ["a.listener", {
        fabricId: "snapshot-order",
        address: "alpha",
      }],
    ]),
    targets: new Map(),
  });
  const callbacks = {
    accept() {},
    capacityRejected() {},
  };
  const options = {
    limits: {
      maxPendingAcquisitions: 1,
      maxActiveChannels: 1,
      channel: {
        maxPacketBytes: 16,
        maxBufferedPackets: 1,
        maxBufferedBytes: 16,
      },
    },
  };
  const zeta = await port.resolveListener("z.listener").listen(
    options,
    callbacks,
    liveSignal(),
  );
  const alpha = await port.resolveListener("a.listener").listen(
    options,
    callbacks,
    liveSignal(),
  );
  assert.deepEqual(
    fabric.snapshot().listeners.map((row) => row.address),
    ["alpha", "zeta"],
  );

  alpha.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  zeta.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fabric);
});

test("given opaque packet content when operations are queried then no payload bytes enter public state", async () => {
  const fixture = createFixture({ fabricId: "snapshot-redaction" });
  const pair = await acquirePair(fixture);
  const secret = new TextEncoder().encode("private-payload");
  await pair.left.send({ bytes: secret }, liveSignal());
  const encoded = JSON.stringify(fixture.fabric.snapshot());
  assert.equal(encoded.includes("private-payload"), false);
  assert.equal(encoded.includes("[112,114,105,118,97,116,101"), false);

  assert.equal((await pair.right.read(liveSignal())).kind, "packet");
  pair.left.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await Promise.all([
    pair.left.read(liveSignal()),
    pair.right.read(liveSignal()),
  ]);
  pair.listener.abort({ kind: "forced-stop", code: "TEST_CLEANUP" });
  await closeFabric(fixture.fabric);
});
