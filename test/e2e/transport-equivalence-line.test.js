import assert from "node:assert/strict";
import test from "node:test";

import {
  captureLoopbackLine,
  captureWebSocketLine,
} from "./support/transport-equivalence.js";

test("Given equivalent three-node lines over production Loopback and independent-process WebSocket, when both edge directions traverse one transit node, then normalized sessions RIB exports forwarding and deliveries are identical", async () => {
  const loopback = await captureLoopbackLine();
  const webSocket = await captureWebSocketLine();

  assert.deepEqual(loopback, webSocket);
});
