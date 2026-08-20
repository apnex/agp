import assert from "node:assert/strict";
import test from "node:test";
import { runTerminalOnceCase } from "../../dist/index.js";
import { createTerminalChannel } from "../support/scripted-channel.js";

test("Given a channel receiving repeated abort authority, when the terminal-once case reads repeatedly, then one stable immutable terminal wins", async () => {
  const result = await runTerminalOnceCase(
    createTerminalChannel(),
    { kind: "forced-stop", code: "TEST_ABORT" },
  );

  assert.deepEqual(result.terminal, {
    origin: "local",
    kind: "aborted",
    diagnostic: { code: "TEST_ABORT" },
  });
  assert.equal(Object.isFrozen(result.terminal), true);
});
