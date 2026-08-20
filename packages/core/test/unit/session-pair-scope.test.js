import test from "node:test";
import assert from "node:assert/strict";
import { SessionDirectory, sessionPublicKey } from "../../dist/index.js";

// Owns: pair-scoped six-hex identity; excludes cross-dial policy.
test("given one six-hex local ID, when different remote pairs retain it, then coexistence is allowed only across peers", () => {
  const directory = new SessionDirectory();
  const base = {
    localNodeId: "local",
    localSessionId: "abcdef",
    remoteSessionId: "000001",
    direction: "outbound",
  };
  directory.retain({ ...base, controllerId: "a", remoteNodeId: "peer.a" });
  directory.retain({ ...base, controllerId: "b", remoteNodeId: "peer.b" });
  assert.equal(directory.values().length, 2);
  assert.notEqual(
    sessionPublicKey("peer.a", "abcdef"),
    sessionPublicKey("peer.b", "abcdef"),
  );
  assert.throws(() => directory.retain({
    ...base,
    controllerId: "c",
    remoteNodeId: "peer.a",
  }));
});
