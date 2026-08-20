import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyWebSocketNativeInputFailure,
  webSocketCloseAction,
  webSocketReceiveOverflowAction,
} from "../../dist/index.js";

test("Given every neutral graceful-close intent, when WebSocket close mapping runs, then Close 1000 with an empty reason is selected", () => {
  for (const kind of [
    "normal",
    "node-stop",
    "session-replaced",
    "protocol-fatal",
  ]) {
    assert.deepEqual(
      webSocketCloseAction({ kind, code: "LOCAL_DETAIL" }),
      { code: 1000, reason: "" },
    );
  }
});

test("Given native framing and UTF-8 failures, when safe WebSocket mapping runs, then only bounded common rejection and empty close actions cross the binding", () => {
  assert.equal(
    classifyWebSocketNativeInputFailure("WS_ERR_INVALID_UTF8").close.code,
    1007,
  );
  assert.equal(
    classifyWebSocketNativeInputFailure("WS_ERR_INVALID_OPCODE").close.code,
    1002,
  );
  assert.equal(
    classifyWebSocketNativeInputFailure("UNRELATED"),
    undefined,
  );
  assert.deepEqual(webSocketReceiveOverflowAction(), {
    code: 1011,
    reason: "",
  });
});
