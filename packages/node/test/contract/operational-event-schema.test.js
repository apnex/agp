import assert from "node:assert/strict";
import test from "node:test";
import {
  OPERATIONAL_EVENT_KINDS,
  validateCoreSchema,
} from "@agp/core";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

const OPERATIONAL_EVENT_SCHEMA_ID =
  "urn:agp:schema:v1:core:event:operational-event";

test("given a live uniform-node lifecycle with routing and data activity, when its subscribed events are validated, then every emitted kind and data object belongs to the generated sovereign union", async (context) => {
  const network = new MemoryPeerNetwork();
  const listener = createNode({
    nodeId: "node.event-listener",
    listen: { transportRef: "events.listener" },
    transit: { enabled: true },
  }, {
    transport: network.transport({ listeners: ["events.listener"] }),
  });
  const dialer = createNode({
    nodeId: "node.event-dialer",
    peers: [{
      adjacencyId: "listener",
      expectedNodeId: "node.event-listener",
      transportRef: "events.listener",
    }],
    transit: { enabled: true },
  }, {
    transport: network.transport({ targets: ["events.listener"] }),
  });
  context.after(async () => {
    await Promise.allSettled([dialer.stop(), listener.stop()]);
  });
  const subscription = listener.operations.events({ bufferSize: 256 });
  const observed = [];
  const collecting = (async () => {
    for await (const event of subscription) observed.push(event);
  })();

  await listener.expose("events/source", () => undefined);
  await listener.expose("events/success", () => undefined);
  const failing = await listener.expose("events/failure", async () => {
    throw new Error("expected handler failure");
  });
  await dialer.expose("events/dialer", () => undefined);
  await listener.start();
  await dialer.start();
  await eventually(() => {
    const listenerSnapshot = listener.operations.snapshot();
    const dialerSnapshot = dialer.operations.snapshot();
    const listenerSource = listenerSnapshot.routeExports.some(
      (route) =>
        route.endpoint === "events/source"
        && route.state === "acked",
    );
    const dialerSource = dialerSnapshot.routeExports.some(
      (route) =>
        route.endpoint === "events/dialer"
        && route.state === "acked",
    );
    return listenerSnapshot.connections[0]?.state === "Established"
        && dialerSnapshot.connections[0]?.state === "Established"
        && listenerSource
        && dialerSource
      ? true
      : undefined;
  }, "Established sessions and ACKed source exports");

  await listener.send(
    "events/source",
    "events/success",
    { delivery: "local-success" },
  );
  await listener.send(
    "events/source",
    "events/failure",
    { delivery: "local-failure" },
  );
  await listener.send(
    "events/source",
    "events/dialer",
    { delivery: "remote" },
  );
  await dialer.send(
    "events/dialer",
    "events/success",
    { delivery: "received" },
  );
  await eventually(
    () =>
      observed.some(({ kind }) => kind === "handler.completed")
      && observed.some(({ kind }) => kind === "handler.failed")
      && observed.some(({ kind }) => kind === "message.received"),
    "local handler and received-message event settlement",
  );
  await failing.close();
  await eventually(
    () => observed.some(({ kind }) => kind === "endpoint.closed"),
    "endpoint close event",
  );
  await dialer.stop();
  await eventually(
    () => observed.some(({ kind }) => kind === "session.closed"),
    "session close event",
  );
  await listener.stop();
  await collecting;

  const vocabulary = new Set(OPERATIONAL_EVENT_KINDS);
  for (const event of observed) {
    assert.equal(vocabulary.has(event.kind), true, event.kind);
    const result = validateCoreSchema(
      OPERATIONAL_EVENT_SCHEMA_ID,
      event,
    );
    assert.equal(
      result.ok,
      true,
      `${event.kind}: ${result.ok ? "" : JSON.stringify(result.issues)}`,
    );
  }
  const kinds = new Set(observed.map(({ kind }) => kind));
  for (const expected of [
    "endpoint.exposed",
    "lifecycle.starting",
    "lifecycle.running",
    "session.transition",
    "session.established",
    "route.imported",
    "route.export-acked",
    "message.accepted",
    "message.received",
    "handler.completed",
    "handler.failed",
    "endpoint.closed",
    "session.routes-purged",
    "session.closed",
    "lifecycle.stopped",
  ]) {
    assert.equal(kinds.has(expected), true, `missing ${expected}`);
  }
});
