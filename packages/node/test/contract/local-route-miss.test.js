import assert from "node:assert/strict";
import test from "node:test";
import {
  createDataPlaneHarness,
} from "../support/data-plane-harness.js";
import { selectedLocal } from "../support/fakes.js";

test("Given a selected local source but missing destination, when send runs, then NO_ROUTE creates no reservation or data write", async () => {
  const harness = createDataPlaneHarness();
  const source = harness.expose("demo/source");
  harness.installSelected(selectedLocal("demo/source", source.bindingId));
  const unrelated = harness.makeController();

  await assert.rejects(
    harness.plane.send("demo/source", "missing/destination", {}),
    { code: "NO_ROUTE" },
  );
  assert.equal(harness.breadcrumbs.usage().entries, 0);
  assert.deepEqual(unrelated.writer.usage(), {
    dataMessages: 0,
    dataBytes: 0,
    controlMessages: 0,
  });
  assert.deepEqual(unrelated.dataWrites, []);
});
