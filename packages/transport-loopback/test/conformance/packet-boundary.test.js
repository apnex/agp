import assert from "node:assert/strict";
import test from "node:test";

import {
  acquirePair,
  closeFabric,
  createFixture,
  disposePair,
  liveSignal,
} from "../support/topology.js";

test("given a mutable sender byte view when send returns its promise then later mutation cannot alter the received packet", async () => {
  const fixture = createFixture({ fabricId: "copy-boundary" });
  const pair = await acquirePair(fixture);
  const source = new Uint8Array([0, 1, 127, 128, 255]);

  const acceptance = pair.left.send({ bytes: source }, liveSignal());
  source.fill(42);
  await acceptance;
  const result = await pair.right.read(liveSignal());

  assert.equal(result.kind, "packet");
  assert.deepEqual([...result.packet.bytes], [0, 1, 127, 128, 255]);
  assert.notStrictEqual(result.packet.bytes, source);

  await disposePair(pair);
  await closeFabric(fixture.fabric);
});

test("given an oversized byte view when send validates byteLength then rejection is known not accepted and the channel remains usable", async () => {
  const fixture = createFixture({ fabricId: "packet-limit" });
  const pair = await acquirePair(fixture);

  await assert.rejects(
    pair.left.send({ bytes: new Uint8Array(17) }, liveSignal()),
    {
      code: "PACKET_TOO_LARGE",
      phase: "send",
      acceptance: "not-accepted",
    },
  );
  await pair.left.send({ bytes: new Uint8Array([7]) }, liveSignal());
  const result = await pair.right.read(liveSignal());
  assert.deepEqual([...result.packet.bytes], [7]);

  await disposePair(pair);
  await closeFabric(fixture.fabric);
});
