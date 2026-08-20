import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";
import {
  ControlledChannel,
  ControlledListenerTransport,
  eventually,
} from "../support/controlled-transport.js";

test("given competing read-terminal and write-failure outcomes, when one controller incarnation tears down, then exactly one disposition releases its channel and event", async () => {
  const transport = new ControlledListenerTransport("latch.listener");
  const node = createNode({
    nodeId: "latch.listener",
    listen: { transportRef: "latch.listener" },
  }, { transport: transport.port() });
  const events = node.operations.events({ bufferSize: 32 });
  const observed = [];
  const collecting = (async () => {
    for await (const event of events) observed.push(event);
  })();
  await node.start();

  const channel = new ControlledChannel({ holdWrites: true });
  transport.accept(channel);
  await eventually(
    () => channel.sendCalls === 1 && channel.readCalls === 1,
    "controller read and write authority",
  );
  channel.terminalize({ origin: "carrier", kind: "io-failure" });
  channel.failWrites();

  await eventually(
    () =>
      observed.filter(
        ({ kind }) => kind === "connection.preidentity-closed",
      ).length === 1,
    "single controller release",
  );
  await node.stop();
  await collecting;

  assert.equal(channel.closeCalls, 1);
  assert.equal(channel.abortCalls, 0);
  assert.equal(
    observed.filter(
      ({ kind }) => kind === "connection.preidentity-closed",
    ).length,
    1,
  );
});

test("given packets accepted before local close, when protocol authority is revoked, then the sole reader drains them to terminal before transport release", async () => {
  const transport = new ControlledListenerTransport("drain.listener");
  const node = createNode({
    nodeId: "drain.listener",
    listen: { transportRef: "drain.listener" },
  }, { transport: transport.port() });
  await node.start();

  const channel = new ControlledChannel({
    acceptedOnClose: [new Uint8Array([0xff, 0x00, 0x7f])],
  });
  transport.accept(channel);
  await eventually(
    () => channel.readCalls === 1,
    "active controller reader",
  );

  await node.stop();
  await eventually(
    () => channel.closeCalls === 1 && channel.readCalls >= 2,
    "accepted packet drain and terminal observation",
  );

  assert.equal(channel.closeCalls, 1);
  assert.equal(channel.abortCalls, 0);
});
