import assert from "node:assert/strict";
import test from "node:test";

import { createNode } from "../../dist/index.js";
import {
  ControlledChannel,
  ControlledListenerTransport,
  eventually,
} from "../support/controlled-transport.js";

test("given a transferred accepted channel, when the listener reports an acceptance-callback adapter fault, then the running node fails once and session-owned transport closes once", async () => {
  const transport = new ControlledListenerTransport("fault.listener");
  const node = createNode({
    nodeId: "fault.listener",
    listen: { transportRef: "fault.listener" },
  }, { transport: transport.port() });

  await node.start();
  const channel = new ControlledChannel();
  transport.accept(channel);
  await eventually(
    () => node.operations.connections().items.length === 1,
    "accepted controller ownership",
  );

  transport.terminalize({
    origin: "carrier",
    kind: "adapter-fault",
    diagnostic: { code: "ACCEPT_CALLBACK_FAILED" },
  });
  await eventually(
    () => node.operations.lifecycle().state === "Failed",
    "terminal failed lifecycle",
  );
  await eventually(
    () => channel.closeCalls === 1,
    "session-owned channel close",
  );

  const counters = node.operations.counters().values;
  assert.equal(counters["lifecycle.failed"], "1");
  assert.equal(counters["transport.listener_terminal"], "1");
  assert.equal(channel.closeCalls, 1);
  assert.equal(channel.abortCalls, 0);

  await node.stop();
  await eventually(
    () => node.operations.connections().items.length === 0,
    "released transferred controller",
  );
});
