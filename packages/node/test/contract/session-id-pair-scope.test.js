import assert from "node:assert/strict";
import test from "node:test";
import { createNode } from "../../dist/index.js";
import {
  eventually,
  MemoryPeerNetwork,
} from "../support/memory-transport.js";

test("Given two distinct remote nodes, when one node allocates the same six-hex ID, then both pair-scoped sessions coexist", async (t) => {
  const network = new MemoryPeerNetwork();
  const remoteOne = createNode({
    nodeId: "node.remote-one",
    listen: { transportRef: "remote.one" },
  }, {
    transport: network.transport({ listeners: ["remote.one"] }),
  });
  const remoteTwo = createNode({
    nodeId: "node.remote-two",
    listen: { transportRef: "remote.two" },
  }, {
    transport: network.transport({ listeners: ["remote.two"] }),
  });
  const local = createNode({
    nodeId: "node.local",
    peers: [
      {
        adjacencyId: "one",
        expectedNodeId: "node.remote-one",
        transportRef: "remote.one",
      },
      {
        adjacencyId: "two",
        expectedNodeId: "node.remote-two",
        transportRef: "remote.two",
      },
    ],
  }, {
    transport: network.transport({
      targets: ["remote.one", "remote.two"],
    }),
    ids: new RepeatingPairScopedIds(),
  });
  t.after(async () => {
    await Promise.allSettled([
      local.stop(),
      remoteOne.stop(),
      remoteTwo.stop(),
    ]);
  });

  await Promise.all([remoteOne.start(), remoteTwo.start()]);
  await local.start();
  const sessions = await eventually(() => {
    const items = local.operations.connections().items;
    return items.length === 2
      && items.every((session) => session.state === "Established")
      ? items
      : undefined;
  }, "two pair-scoped Established sessions");

  assert.deepEqual(
    sessions.map((session) => [session.remoteNodeId, session.sessionId]),
    [
      ["node.remote-one", "abc123"],
      ["node.remote-two", "abc123"],
    ],
  );
});

test("Given two accepted transports whose identities are not known at allocation, when distinct peers receive the same local six-hex ID, then identity admission retains both node pairs", async (t) => {
  const network = new MemoryPeerNetwork();
  const local = createNode({
    nodeId: "node.acceptor",
    listen: { transportRef: "acceptor.listener" },
  }, {
    transport: network.transport({ listeners: ["acceptor.listener"] }),
    ids: new RepeatingPairScopedIds(),
  });
  const remoteOne = createNode({
    nodeId: "node.dial-one",
    peers: [{
      adjacencyId: "acceptor",
      expectedNodeId: "node.acceptor",
      transportRef: "acceptor.listener",
    }],
  }, {
    transport: network.transport({ targets: ["acceptor.listener"] }),
  });
  const remoteTwo = createNode({
    nodeId: "node.dial-two",
    peers: [{
      adjacencyId: "acceptor",
      expectedNodeId: "node.acceptor",
      transportRef: "acceptor.listener",
    }],
  }, {
    transport: network.transport({ targets: ["acceptor.listener"] }),
  });
  t.after(async () => {
    await Promise.allSettled([
      remoteTwo.stop(),
      remoteOne.stop(),
      local.stop(),
    ]);
  });

  await local.start();
  await Promise.all([remoteOne.start(), remoteTwo.start()]);
  const sessions = await eventually(() => {
    const items = local.operations.connections().items;
    return items.length === 2
      && items.every((session) => session.state === "Established")
      ? items
      : undefined;
  }, "two accepted pair-scoped Established sessions");

  assert.deepEqual(
    sessions.map((session) => [session.remoteNodeId, session.sessionId]),
    [
      ["node.dial-one", "abc123"],
      ["node.dial-two", "abc123"],
    ],
  );
});

class RepeatingPairScopedIds {
  #sequence = 0;

  next(scope) {
    if (scope === "session") return "abc123";
    this.#sequence += 1;
    return `${scope}-${this.#sequence}`;
  }
}
