import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANNEL_LIMITS,
  closeFabric,
  createFixture,
  liveSignal,
} from "../support/topology.js";

test("given a diagnostic sink that throws when an accept callback faults then the sink cannot alter terminal or connection outcomes", async () => {
  const fixture = createFixture({
    fabricId: "throwing-diagnostic-sink",
    dependencies: {
      diagnostics: {
        emit() {
          throw new Error("observer failure");
        },
      },
    },
  });
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions: 1,
        maxActiveChannels: 1,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept() {
        throw new Error("private callback failure");
      },
      capacityRejected() {},
    },
    liveSignal(),
  );

  await assert.rejects(
    fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
    { code: "ADAPTER_FAULT", phase: "connect" },
  );
  assert.deepEqual(await listener.waitTerminal(liveSignal()), {
    origin: "carrier",
    kind: "adapter-fault",
    diagnostic: { code: "ACCEPT_CALLBACK_FAILED" },
  });
  assert.deepEqual(fixture.fabric.snapshot().resources, {
    pendingAcquisitions: 0,
    activeChannels: 0,
    pendingSendBytes: 0,
    queuedPackets: 0,
    queuedBytes: 0,
  });
  await closeFabric(fixture.fabric);
});
