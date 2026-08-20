import assert from "node:assert/strict";
import test from "node:test";
import { ChaosNetwork } from "./support/chaos-network.js";
import {
  createChaosNode,
  stopAll,
} from "./support/fixture.js";

test("Given a one-event observer buffer over canonical node state, when three endpoint events overflow it before consumption, then explicit observer.gap evidence is retained while every endpoint remains queryable", async (context) => {
  const network = new ChaosNetwork();
  const node = createChaosNode(network, {
    nodeId: "observer.node",
    capacity: {
      maxEventSubscribers: 1,
      eventSubscriberBuffer: 1,
    },
  });
  context.after(() => stopAll(node));
  const subscription = node.operations.events({ bufferSize: 1 });

  await node.expose("observer/one", () => undefined);
  await node.expose("observer/two", () => undefined);
  await node.expose("observer/three", () => undefined);
  const observed = await subscription.next();
  subscription.close();
  const snapshot = node.operations.snapshot();

  assert.equal(observed.done, false);
  assert.equal(observed.value.kind, "observer.gap");
  assert.equal(
    BigInt(observed.value.data.droppedFrom)
      <= BigInt(observed.value.data.droppedTo),
    true,
  );
  assert.deepEqual(
    snapshot.localEndpoints.map((endpoint) => endpoint.endpoint),
    ["observer/one", "observer/three", "observer/two"],
  );
  assert.deepEqual(
    snapshot.selectedRoutes.map((route) => route.endpoint),
    ["observer/one", "observer/three", "observer/two"],
  );
});
