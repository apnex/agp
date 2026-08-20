import assert from "node:assert/strict";
import test from "node:test";
import {
  validateWebSocketReferenceUniqueness,
} from "../../dist/index.js";

const binding = (transportRef) => ({
  transportRef,
  url: "ws://127.0.0.1:47000/agp",
  compression: { mode: "disabled" },
  security: { mode: "trusted-development" },
});

test("Given repeated references within one acquisition kind, when WebSocket reference uniqueness is evaluated, then the duplicate kind and reference are reported", () => {
  assert.deepEqual(validateWebSocketReferenceUniqueness({
    listeners: [binding("edge"), binding("edge")],
    targets: [],
  }), {
    ok: false,
    code: "REFERENCE_DUPLICATE",
    kind: "listener",
    transportRef: "edge",
  });
  assert.deepEqual(validateWebSocketReferenceUniqueness({
    listeners: [],
    targets: [binding("peer"), binding("peer")],
  }), {
    ok: false,
    code: "REFERENCE_DUPLICATE",
    kind: "target",
    transportRef: "peer",
  });
});

test("Given one reference used once as listener and once as target, when WebSocket reference uniqueness is evaluated, then explicit resolver kinds keep both capabilities legal", () => {
  assert.deepEqual(validateWebSocketReferenceUniqueness({
    listeners: [binding("shared")],
    targets: [binding("shared")],
  }), { ok: true, code: "ACCEPT" });
});
