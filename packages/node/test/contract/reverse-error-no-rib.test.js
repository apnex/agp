import assert from "node:assert/strict";
import test from "node:test";
import { LabelTable } from "../../dist/index.js";
import { labelBinding, fakeController } from "../support/fakes.js";

test("Given equal public session fields on distinct controllers, when reverse lookup runs, then exact identity wins without a RIB callback", () => {
  const store = new LabelTable({
    maximumEntries: 4,
    maximumBytes: 1_024,
  }, () => 0);
  const entry = labelBinding();
  store.add(entry, 100);

  const samePublicIdentityDifferentController = fakeController({
    remoteNodeId: entry.egress.remoteNodeId,
    owningSessionId: entry.egress.owningSessionId,
  });
  assert.equal(
    store.consume(
      samePublicIdentityDifferentController,
      entry.outboundReturnToken,
      entry.messageId,
      1_000,
    ).kind,
    "unreturnable",
  );
  assert.equal(store.usage().entries, 1);
});
