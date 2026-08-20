import assert from "node:assert/strict";
import test from "node:test";

import {
  runAcceptanceCallbackFaultCase,
} from "@agp/transport/conformance";

import {
  CHANNEL_LIMITS,
  closeFabric,
  createFixture,
  disposePair,
  liveSignal,
} from "../support/topology.js";

async function exerciseCallbackFault(input) {
  let diagnostic;
  let diagnosticCause;
  let authorityReleased = false;
  let fixture;
  fixture = createFixture({
    fabricId: `callback-${input.kind}`,
    dependencies: {
      diagnostics: {
        emit(value, cause) {
          diagnostic = value;
          diagnosticCause = cause;
          authorityReleased =
            fixture.fabric.snapshot().resources.pendingAcquisitions === 0;
        },
      },
    },
  });
  const accepted = [];
  let callbackCount = 0;
  const listener = await fixture.listenCapability.listen(
    {
      limits: {
        maxPendingAcquisitions:
          input.kind === "pending-acquisition" ? 1 : 3,
        maxActiveChannels:
          input.kind === "active-channel" ? 1 : 3,
        channel: CHANNEL_LIMITS,
      },
    },
    {
      accept(value) {
        callbackCount += 1;
        if (input.kind === "accept" && callbackCount === 2) {
          throw input.thrown;
        }
        accepted.push(value.channel);
      },
      capacityRejected(kind) {
        callbackCount += 1;
        assert.equal(kind, input.kind);
        throw input.thrown;
      },
    },
    liveSignal(),
  );

  let firstPromise;
  let triggeringPromise;
  if (input.kind === "pending-acquisition") {
    firstPromise = fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    );
    triggeringPromise = fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    );
  } else {
    firstPromise = fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    );
  }
  const first = await firstPromise;
  if (triggeringPromise === undefined) {
    triggeringPromise = fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    );
  }
  await assert.rejects(triggeringPromise);
  const countAtFault = callbackCount;
  await assert.rejects(
    fixture.connectCapability.connect(
      { channel: CHANNEL_LIMITS },
      liveSignal(),
    ),
    { code: "BINDING_UNAVAILABLE" },
  );

  let transferredChannelSurvived = false;
  await first.send({ bytes: new Uint8Array([37]) }, liveSignal());
  const received = await accepted[0].read(liveSignal());
  transferredChannelSurvived =
    received.kind === "packet" && received.packet.bytes[0] === 37;
  const terminal = await listener.waitTerminal(liveSignal());
  const observation = {
    callbackEscaped: false,
    triggeringAuthorityReleasedBeforeDiagnostic: authorityReleased,
    laterCallbackCount: callbackCount - countAtFault,
    transferredChannelSurvived,
    terminal,
    diagnostic,
    diagnosticCause,
  };

  await disposePair({
    left: first,
    right: accepted[0],
    listener,
  });
  await closeFabric(fixture.fabric);
  return observation;
}

test("given Error and non-Error callback failures when the neutral fault case runs then authority is released and the listener fails closed exactly once", async () => {
  const result = await runAcceptanceCallbackFaultCase({
    exerciseCallbackFault,
  });
  assert.equal(result.observations.length, 3);
  assert.deepEqual(
    result.observations.map(
      (value) => value.terminal.diagnostic.code,
    ),
    [
      "ACCEPT_CALLBACK_FAILED",
      "CAPACITY_REJECTED_CALLBACK_FAILED",
      "CAPACITY_REJECTED_CALLBACK_FAILED",
    ],
  );
});

test("given capacity callback throws undefined when the adapter contains it then absence of an Error value still commits the exact callback-fault terminal", async () => {
  const observation = await exerciseCallbackFault({
    kind: "active-channel",
    thrown: undefined,
  });
  assert.deepEqual(observation.terminal, {
    origin: "carrier",
    kind: "adapter-fault",
    diagnostic: { code: "CAPACITY_REJECTED_CALLBACK_FAILED" },
  });
  assert.equal(observation.laterCallbackCount, 0);
  assert.equal(observation.transferredChannelSurvived, true);
});
