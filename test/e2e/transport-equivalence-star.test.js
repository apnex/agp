import assert from "node:assert/strict";
import test from "node:test";

import {
  captureLoopbackStar,
  captureWebSocketStar,
} from "./support/transport-equivalence.js";

test("Given equivalent three-node stars over production Loopback and independent-process WebSocket, when routes converge and one leaf sends JSON to the other, then normalized sessions RIB exports forwarding and delivery are identical", async () => {
  const loopback = await captureLoopbackStar();
  const webSocket = await captureWebSocketStar();

  assert.deepEqual(loopback, webSocket);
});
