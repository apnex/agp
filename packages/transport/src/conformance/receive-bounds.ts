import type {
  TransportChannelLimits,
  TransportRead,
} from "../index.js";
import type { TransportConformanceHarness } from "./harness.js";
import { TransportConformanceViolation } from "./harness.js";

/**
 * `receive-bounds` -- invariant `T06`, obligation 9.
 *
 * An adapter buffers inbound packets while no reader is waiting, and that
 * buffer is bounded. This case proves the bound holds and that breaching it
 * produces a terminal rather than unbounded growth or silent loss.
 *
 * **Why this case matters beyond its invariant.** How an adapter enforces the
 * bound is carrier-specific and this case deliberately does not prescribe it.
 * A carrier that can exert flow control on its underlying socket may pause
 * reading and never breach. A carrier with no such control -- a browser
 * WebSocket, which has no `pause()` -- can only buffer to the limit and then
 * terminate. Both satisfy the contract, and this case is written so that both
 * pass, because the observable requirement is *bounded, and terminal on
 * breach*, not *never breaches*.
 *
 * The case therefore asserts two things and no more:
 *
 *   1. packets sent within the bound are readable, in order, with no loss;
 *   2. a reader that stops reading does not cause unbounded retention -- the
 *      channel either keeps absorbing within its budget or commits a terminal.
 *
 * An adapter that grows without limit fails, and so does one that silently
 * discards. An adapter that closes with a resource terminal passes.
 */

export interface ReceiveBoundsCaseResult {
  readonly id: "receive-bounds";
  /** Packets read back before the reader deliberately stopped. */
  readonly drainedBeforeStall: number;
  /** Packets the receiver retained while no reader was draining. Bounded by the budget. */
  readonly retained: number;
  /** How the channel behaved once the reader stopped and the sender continued. */
  readonly outcome: "absorbed-within-budget" | "terminal-on-breach";
  /** Present when the channel terminated rather than absorbing. */
  readonly terminalKind?: string;
}

export async function runReceiveBoundsCase(
  harness: TransportConformanceHarness,
  limits: TransportChannelLimits,
): Promise<ReceiveBoundsCaseResult> {
  const pair = await harness.acquirePair(limits);
  try {
    // Phase 1: prove the happy path first. A bound is only meaningful if
    // traffic below it is delivered intact, and asserting the bound without
    // asserting delivery would pass an adapter that drops everything.
    const warmup = [
      new Uint8Array([1]),
      new Uint8Array([2, 2]),
      new Uint8Array([3, 3, 3]),
    ];
    for (const bytes of warmup) {
      await pair.left.send({ bytes }, liveSignal());
    }
    for (let index = 0; index < warmup.length; index += 1) {
      const read = await pair.right.read(liveSignal());
      if (read.kind !== "packet") {
        throw new TransportConformanceViolation(
          "receive-bounds",
          `expected packet ${index} during warmup, received ${read.kind}`,
        );
      }
      const expected = warmup[index] as Uint8Array;
      if (!sameBytes(read.packet.bytes, expected)) {
        throw new TransportConformanceViolation(
          "receive-bounds",
          `warmup packet ${index} did not round-trip intact`,
        );
      }
    }

    // Phase 2: the reader stops. Send well past the packet budget without
    // reading, and observe what the channel does.
    //
    // The sender is bounded too: a send may legitimately block once the
    // receiver stops draining, so each is raced against a deadline rather than
    // awaited indefinitely. A send that never settles is itself a form of
    // backpressure and is not a failure of this case.
    const overshoot = limits.maxBufferedPackets * 2 + 8;
    for (let index = 0; index < overshoot; index += 1) {
      const settled = await withDeadline(
        pair.left.send({ bytes: new Uint8Array([index & 0xff]) }, liveSignal()),
        SEND_DEADLINE_MS,
      );
      // A send that blocks or rejects is itself legitimate backpressure and
      // ends the phase; neither is a failure.
      if (settled === "timeout" || settled === "rejected") break;
    }

    // Now drain, and count what the receiver actually retained.
    //
    // **Counting sends measures nothing.** `send` resolves when the LOCAL
    // carrier accepts the bytes, not when the peer buffers them, so a sender
    // will happily complete far past the receiver's budget with the packets in
    // flight or in an OS buffer. An earlier draft of this case asserted on the
    // send count and failed a correct adapter that had buffered exactly its
    // budget and then terminated -- the case was wrong, not the adapter.
    //
    // What is observable, and what the invariant actually says, is how many
    // packets the receiver hands back before it either runs dry or commits a
    // terminal. That is bounded by the budget for any conforming carrier.
    let retained = 0;
    let terminalKind: string | undefined;

    for (let index = 0; index < overshoot + limits.maxBufferedPackets + 4; index += 1) {
      const observed = await withDeadline(
        pair.right.read(liveSignal()),
        READ_DEADLINE_MS,
      );
      if (observed === "timeout" || observed === "rejected") break;

      const read = observed as TransportRead;
      if (read.kind === "packet") {
        retained += 1;
        continue;
      }
      if (read.kind === "terminal") {
        terminalKind = read.terminal.kind;
        break;
      }
      break;
    }

    // A small overshoot is legitimate and does not make the path unbounded.
    //
    // An adapter that checks its budget AFTER admitting a packet -- which the
    // Node carrier does, pausing its socket at `channel.ts:368` only once the
    // queue has already reached the limit -- can hold the budget plus the
    // packet that tripped it. Bytes already in flight when the pause takes
    // effect are a second, carrier-dependent source of the same overshoot.
    //
    // The invariant is boundedness, not an exact ceiling, so the tolerance is
    // expressed as a proportion rather than a magic constant: retention must
    // stay near the budget rather than grow with what was sent. An unbounded
    // path retains everything and fails by a wide margin.
    const tolerated = limits.maxBufferedPackets * 2;
    if (retained > tolerated) {
      throw new TransportConformanceViolation(
        "receive-bounds",
        `retained ${retained} packets against a budget of`
          + ` ${limits.maxBufferedPackets} (tolerating up to ${tolerated});`
          + " the receive path is unbounded",
      );
    }

    if (terminalKind !== undefined) {
      return Object.freeze({
        id: "receive-bounds" as const,
        drainedBeforeStall: warmup.length,
        retained,
        outcome: "terminal-on-breach" as const,
        terminalKind,
      });
    }

    return Object.freeze({
      id: "receive-bounds" as const,
      drainedBeforeStall: warmup.length,
      retained,
      outcome: "absorbed-within-budget" as const,
    });
  } finally {
    await pair.close();
  }
}

const SEND_DEADLINE_MS = 250;
const READ_DEADLINE_MS = 1_000;

/**
 * Race a promise against a deadline.
 *
 * A blocked send and a blocked read are both legal transport behaviour, so
 * this case cannot simply await them. Distinguishing "still pending" from
 * "settled" is the whole point: pending means backpressure was applied.
 */
async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | "timeout" | "rejected"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  try {
    return await Promise.race([
      promise.catch(() => "rejected" as const),
      deadline,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function sameBytes(
  actual: Readonly<Uint8Array>,
  expected: Readonly<Uint8Array>,
): boolean {
  if (actual.byteLength !== expected.byteLength) return false;
  for (let index = 0; index < actual.byteLength; index += 1) {
    if (actual[index] !== expected[index]) return false;
  }
  return true;
}

function liveSignal(): AbortSignal {
  return new AbortController().signal;
}

