import assert from "node:assert/strict";
import test from "node:test";
import { BreadcrumbStore } from "../../dist/index.js";
import { breadcrumb } from "../support/fakes.js";

test("Given a valid exact-controller token and refId, when consumed twice, then only the first lookup returns the breadcrumb", () => {
  const store = new BreadcrumbStore({
    maximumEntries: 4,
    maximumBytes: 1_024,
  });
  const entry = breadcrumb();
  assert.equal(store.add(entry, 100), true);

  assert.equal(
    store.consume(
      entry.egress,
      entry.outboundReturnToken,
      entry.messageId,
      1_000,
    ).kind,
    "consumed",
  );
  assert.equal(
    store.consume(
      entry.egress,
      entry.outboundReturnToken,
      entry.messageId,
      1_000,
    ).kind,
    "unreturnable",
  );
  assert.deepEqual(store.usage(), {
    entries: 0,
    bytes: 0,
    highWaterEntries: 1,
    highWaterBytes: 100,
  });
});
