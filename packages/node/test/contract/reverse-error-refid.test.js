import assert from "node:assert/strict";
import test from "node:test";
import { LabelTable } from "../../dist/index.js";
import { labelBinding } from "../support/fakes.js";

test("Given a matching token with the wrong refId, when reverse lookup runs, then fatal evidence does not consume the labelBinding", () => {
  const store = new LabelTable({
    maximumEntries: 4,
    maximumBytes: 1_024,
  }, () => 0);
  const entry = labelBinding();
  store.add(entry, 100);

  assert.equal(
    store.consume(
      entry.egress,
      entry.outboundReturnToken,
      "different-message",
      1_000,
    ).kind,
    "ref-mismatch",
  );
  assert.equal(store.usage().entries, 1);
  assert.equal(
    store.consume(
      entry.egress,
      entry.outboundReturnToken,
      entry.messageId,
      1_000,
    ).kind,
    "consumed",
  );
});
