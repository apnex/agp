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

test("given spending against a ceiling, when the same ceiling is re-advertised, then it is not treated as fresh allowance", () => {
  const spend = new CreditSpend({ bytes: 100, packets: 4 });
  spend.admit(50);
  assert.deepEqual(spend.remaining, { bytes: 50, packets: 3 });

  // Cumulative, so a repeated advertisement grants nothing new.
  spend.observeGrant({ bytes: 100, packets: 4 });
  assert.deepEqual(spend.remaining, { bytes: 50, packets: 3 });
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

test("given a receiver that has read nothing, when it advertises, then the ceiling is exactly its channel capacity", () => {
  const grantor = new CreditGrantor({ bytes: 1_000, packets: 4 });
  assert.deepEqual(grantor.grant, { bytes: 1_000, packets: 4 });
});

test("given a receiver consuming packets, when it advertises, then the ceiling advances by what it read so in-flight stays bounded by capacity", () => {
  const grantor = new CreditGrantor({ bytes: 1_000, packets: 4 });
  const spend = new CreditSpend(grantor.grant);

  // A sender fills the window and stops. In-flight is exactly capacity.
  for (let index = 0; index < 4; index += 1) {
    assert.equal(spend.canAdmit(10), true);
    spend.admit(10);
  }
  assert.equal(spend.canAdmit(10), false, "the sender must stop at the ceiling");
  assert.equal(spend.sent.packets - 0, 4, "in-flight equals capacity, never more");

  // The receiver drains two, advancing the ceiling by two.
  grantor.consumed(10);
  grantor.consumed(10);
  assert.deepEqual(grantor.grant, { bytes: 1_020, packets: 6 });

  spend.observeGrant(grantor.grant);
  assert.equal(spend.canAdmit(10), true);
  spend.admit(10);
  spend.admit(10);
  assert.equal(spend.canAdmit(10), false, "the sender stops again at the new ceiling");
  assert.equal(
    spend.sent.packets - 2,
    4,
    "in-flight is sent minus read, still exactly capacity",
  );
});

test("given a ceiling already observed, when a lower one arrives, then capacity already granted is not revoked", () => {
  const spend = new CreditSpend({ bytes: 100, packets: 4 });
  spend.observeGrant({ bytes: 50, packets: 2 });
  assert.deepEqual(
    spend.remaining,
    { bytes: 100, packets: 4 },
    "a ceiling only ever advances",
  );
});

test("given a receiver draining, when the ceiling has advanced by half its capacity, then it becomes worth announcing unsolicited", () => {
  const grantor = new CreditGrantor({ bytes: 1_000, packets: 4 });
  assert.equal(grantor.shouldAdvertise, false, "nothing has been read yet");

  grantor.consumed(10);
  assert.equal(grantor.shouldAdvertise, false, "one of four is not worth a control message");
  grantor.consumed(10);
  // A sender at its ceiling sends nothing, so no envelope carries the update.
  assert.equal(grantor.shouldAdvertise, true, "half the window has reopened");

  grantor.advertised();
  assert.equal(grantor.shouldAdvertise, false, "announcing resets the trigger");
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
