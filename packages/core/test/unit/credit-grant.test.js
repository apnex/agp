import assert from "node:assert/strict";
import test from "node:test";

import { CreditGrantor, CreditSpend, isCreditGrant } from "../../dist/index.js";

// Owns: the per-hop credit primitives from D19. Two dimensions, because a
// channel has two exhaustible resources; an absent grant means unlimited,
// because that is how a peer that never negotiated credit behaves.

test("given a peer that never advertised a grant, when admission is tested, then credit is unlimited and nothing is refused", () => {
  const spend = new CreditSpend();

  assert.equal(spend.unlimited, true);
  assert.equal(spend.remaining, undefined);
  assert.equal(spend.canAdmit(Number.MAX_SAFE_INTEGER), true);
  spend.admit(1_000_000);
  assert.equal(spend.canAdmit(1_000_000), true, "spending never exhausts an absent grant");
});

test("given a grant with room in bytes but not packets, when admission is tested, then the packet dimension refuses it", () => {
  const spend = new CreditSpend({ bytes: 1_000, packets: 2 });

  spend.admit(10);
  spend.admit(10);
  assert.deepEqual(spend.remaining, { bytes: 980, packets: 0 });
  // A byte budget alone would admit this. The packet ring would not survive it.
  assert.equal(spend.canAdmit(1), false);
  assert.throws(() => spend.admit(1), (error) => error.code === "QUEUE_FULL");
});

test("given a grant with room in packets but not bytes, when admission is tested, then the byte dimension refuses it", () => {
  const spend = new CreditSpend({ bytes: 100, packets: 50 });

  spend.admit(90);
  assert.deepEqual(spend.remaining, { bytes: 10, packets: 49 });
  assert.equal(spend.canAdmit(11), false, "a large message cannot fit the byte budget");
  assert.equal(spend.canAdmit(10), true, "one that fits exactly is admissible");
});

test("given spending against a grant, when the peer advertises again, then the grant is an absolute ceiling rather than an increment", () => {
  const spend = new CreditSpend({ bytes: 100, packets: 4 });
  spend.admit(50);
  assert.deepEqual(spend.remaining, { bytes: 50, packets: 3 });

  // Absolute, so a replayed or reordered advertisement cannot inflate a grant.
  spend.observeGrant({ bytes: 100, packets: 4 });
  assert.deepEqual(spend.remaining, { bytes: 100, packets: 4 });

  spend.observeGrant({ bytes: 8, packets: 1 });
  assert.deepEqual(spend.remaining, { bytes: 8, packets: 1 }, "a grant may shrink");
});

test("given a malformed advertisement, when it is observed, then it is rejected rather than silently accepted", () => {
  const spend = new CreditSpend();
  for (const bad of [
    { bytes: -1, packets: 1 },
    { bytes: 1, packets: -1 },
    { bytes: 1.5, packets: 1 },
    { bytes: 1 },
    "unlimited",
  ]) {
    assert.equal(isCreditGrant(bad), false, `${JSON.stringify(bad)} is not a grant`);
    assert.throws(() => spend.observeGrant(bad));
  }
  // Absence is legal and means unlimited; it is not malformed.
  spend.observeGrant(undefined);
  assert.equal(spend.unlimited, true);
});

test("given a grantor at its channel limits, when packets arrive and drain, then the advertised grant tracks outstanding capacity", () => {
  const grantor = new CreditGrantor({ bytes: 1_000, packets: 4 });
  assert.deepEqual(grantor.grant, { bytes: 1_000, packets: 4 });

  for (let index = 0; index < 4; index += 1) grantor.received(100);
  assert.deepEqual(
    grantor.grant,
    { bytes: 600, packets: 0 },
    "a grant never exceeds what the ring can still hold",
  );

  grantor.drained(100);
  assert.deepEqual(grantor.grant, { bytes: 700, packets: 1 });
});

test("given a grantor whose capacity was exhausted, when a packet drains, then the reopening is observable so it can be advertised unsolicited", () => {
  const grantor = new CreditGrantor({ bytes: 1_000, packets: 2 });
  grantor.received(10);
  grantor.received(10);
  assert.equal(grantor.grant.packets, 0);

  grantor.drained(10);
  // A sender that spent its grant stops sending, so no envelope carries the
  // replenishment. This is the case that needs an unsolicited advertisement.
  assert.equal(grantor.reopened, true);
  assert.equal(grantor.grant.packets, 1);
});

test("given invalid construction, when a grantor or spend is created, then it fails rather than governing nothing", () => {
  for (const bad of [{ bytes: 0, packets: 1 }, { bytes: 1, packets: 0 }, { bytes: -1, packets: 1 }]) {
    assert.throws(() => new CreditGrantor(bad), (error) => error.code === "CONFIG_INVALID");
  }
  assert.throws(
    () => new CreditSpend({ bytes: -1, packets: 1 }),
    (error) => error.code === "CONFIG_INVALID",
  );
});
