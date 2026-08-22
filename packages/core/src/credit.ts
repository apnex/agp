import type { CreditGrant } from "@agp/protocol";

import { AgpError } from "./errors.js";
import { LatencyRecorder } from "./latency.js";
import type {
  InboundCreditSnapshot,
  OutboundCreditSnapshot,
} from "./types.js";

/**
 * Per-hop credit, the peer-facing half of resource governance.
 *
 * `ResourceLedger` governs what this node may consume of itself. Credit governs
 * what a peer may consume of this node. One concern with two faces, per `D19`.
 *
 * A grant is a **cumulative ceiling**, not a remaining allowance, and the
 * distinction is load-bearing. A receiver cannot see its own channel ring: the
 * read loop consumes each packet before reading the next, so arrival and
 * consumption are indistinguishable from inside the node and a delta model
 * measures nothing. What the receiver can count is how much it has read.
 *
 * So the receiver advertises `read + capacity`, and the sender may send while
 * `sent < ceiling`. In-flight is then `sent - read`, which is exactly the ring
 * occupancy, bounded by capacity without either side observing the ring. This
 * is TCP's window expressed in two dimensions.
 */

export function isCreditGrant(value: unknown): value is CreditGrant {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<CreditGrant>;
  return Number.isSafeInteger(candidate.bytes)
    && Number.isSafeInteger(candidate.packets)
    && (candidate.bytes as number) >= 0
    && (candidate.packets as number) >= 0;
}

/**
 * What this node has sent toward a peer, against the ceiling that peer granted.
 *
 * Exceeding a ceiling is refused rather than dropped, because AGP does not
 * retransmit and a dropped message would be lost permanently.
 */
export class CreditSpend {
  #ceiling: CreditGrant | undefined;
  #sentBytes = 0;
  #sentPackets = 0;
  #waiters: Array<() => void> = [];
  // Pacing is invisible from the outside: a paced sender and an idle one look
  // identical unless the waiting is counted. `D20` requires it counted.
  readonly #replenishment = new LatencyRecorder();
  #stalls = 0;
  #stalledUs = 0;
  #stalledSinceMs: number | undefined;

  constructor(initial?: CreditGrant) {
    if (initial !== undefined && !isCreditGrant(initial)) {
      throw new AgpError(
        "CONFIG_INVALID",
        "CreditSpend.constructor",
        "initial credit must be a non-negative safe-integer grant",
      );
    }
    this.#ceiling = initial;
  }

  /** Unlimited while the peer has never advertised a ceiling. */
  get unlimited(): boolean {
    return this.#ceiling === undefined;
  }

  /** Headroom below the current ceiling, or undefined when unlimited. */
  get remaining(): CreditGrant | undefined {
    if (this.#ceiling === undefined) return undefined;
    return Object.freeze({
      bytes: Math.max(0, this.#ceiling.bytes - this.#sentBytes),
      packets: Math.max(0, this.#ceiling.packets - this.#sentPackets),
    });
  }

  get sent(): CreditGrant {
    return Object.freeze({ bytes: this.#sentBytes, packets: this.#sentPackets });
  }

  /**
   * A ceiling only ever advances.
   *
   * The channel is reliable and ordered while live under `D14`, so a stale
   * advertisement cannot arrive out of order. Refusing to move backwards keeps
   * that assumption from becoming load-bearing, and makes a peer that
   * miscomputes its grant unable to revoke capacity already granted.
   */
  observeGrant(grant: CreditGrant | undefined): void {
    if (grant === undefined) return;
    if (!isCreditGrant(grant)) {
      throw new AgpError(
        "INTERNAL",
        "CreditSpend.observeGrant",
        "peer advertised a malformed credit grant",
      );
    }
    const current = this.#ceiling;
    const next = current === undefined ? grant : Object.freeze({
      bytes: Math.max(current.bytes, grant.bytes),
      packets: Math.max(current.packets, grant.packets),
    });
    const advanced = current === undefined
      || next.bytes > current.bytes
      || next.packets > current.packets;
    this.#ceiling = next;
    if (!advanced) return;
    for (const wake of this.#waiters.splice(0)) wake();
  }

  /**
   * Resolves once the peer raises its ceiling, or once the signal aborts.
   *
   * A sender that reached its ceiling stops sending, so it cannot discover on
   * its own that the receiver has drained. Something must wake it, and the
   * receiver's half of that contract is `CreditGrantor.shouldAdvertise`.
   */
  whenAdvanced(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const wake = (): void => {
        signal.removeEventListener("abort", wake);
        const index = this.#waiters.indexOf(wake);
        if (index >= 0) this.#waiters.splice(index, 1);
        resolve();
      };
      this.#waiters.push(wake);
      signal.addEventListener("abort", wake, { once: true });
    });
  }

  canAdmit(bytes: number): boolean {
    const remaining = this.remaining;
    if (remaining === undefined) return true;
    return remaining.packets >= 1 && remaining.bytes >= bytes;
  }

  /**
   * Records that the sender has stopped because the peer has no room.
   *
   * Time is passed in rather than read, so the recorder holds no clock and a
   * test can state the duration it is asserting on.
   */
  beginStall(monotonicMs: number): void {
    if (this.#stalledSinceMs !== undefined) return;
    this.#stalledSinceMs = monotonicMs;
    this.#stalls += 1;
  }

  /** Records that the peer made room, and how long that took. */
  endStall(monotonicMs: number): void {
    const since = this.#stalledSinceMs;
    if (since === undefined) return;
    this.#stalledSinceMs = undefined;
    const waitedUs = Math.max(0, Math.round((monotonicMs - since) * 1000));
    this.#stalledUs += waitedUs;
    this.#replenishment.record(waitedUs);
  }

  /** How long this sender has waited for the peer to make room. */
  get replenishment(): LatencyRecorder {
    return this.#replenishment;
  }

  get stalledSinceMs(): number | undefined {
    return this.#stalledSinceMs;
  }

  /**
   * The projection `D20` requires, in the shape the operations plane fixes.
   *
   * `stalledUs` counts only completed waits. A stall still in progress is
   * reported by `stalledSince` instead, because adding a partial wait to a
   * total would make the same stall countable twice.
   */
  snapshot(stalledSince?: string): OutboundCreditSnapshot {
    const ceiling = this.#ceiling;
    const remaining = this.remaining;
    return Object.freeze({
      unlimited: ceiling === undefined,
      ...(ceiling === undefined ? {} : { ceiling: dimensions(ceiling) }),
      sent: dimensions({ bytes: this.#sentBytes, packets: this.#sentPackets }),
      ...(remaining === undefined ? {} : { remaining: dimensions(remaining) }),
      stalls: String(this.#stalls),
      stalledUs: this.#stalledUs,
      ...(stalledSince === undefined ? {} : { stalledSince }),
    });
  }

  admit(bytes: number): void {
    if (!this.canAdmit(bytes)) {
      throw new AgpError(
        "QUEUE_FULL",
        "CreditSpend.admit",
        "peer credit is exhausted",
      );
    }
    this.#sentBytes += bytes;
    this.#sentPackets += 1;
  }
}

/**
 * The ceiling this node advertises to a peer, computed from what it has read.
 *
 * The capacity offered never exceeds the channel limits this node supplied to
 * its adapter, so the receive ring cannot be oversubscribed by construction.
 * That is what makes `RECEIVE_OVERFLOW` unreachable between conforming peers
 * rather than a routine outcome of a burst.
 */
export class CreditGrantor {
  readonly #capacityBytes: number;
  readonly #capacityPackets: number;
  #readBytes = 0;
  #readPackets = 0;
  #advertisedPackets = 0;
  #advertisedBytes = 0;
  #announcements = 0;

  constructor(limits: { readonly bytes: number; readonly packets: number }) {
    if (
      !Number.isSafeInteger(limits.bytes) || limits.bytes < 1
      || !Number.isSafeInteger(limits.packets) || limits.packets < 1
    ) {
      throw new AgpError(
        "CONFIG_INVALID",
        "CreditGrantor.constructor",
        "credit limits must be positive safe integers",
      );
    }
    this.#capacityBytes = limits.bytes;
    this.#capacityPackets = limits.packets;
    this.#advertisedPackets = limits.packets;
    this.#advertisedBytes = limits.bytes;
  }

  /** The projection `D20` requires, in the shape the operations plane fixes. */
  snapshot(): InboundCreditSnapshot {
    return Object.freeze({
      capacity: dimensions({
        bytes: this.#capacityBytes,
        packets: this.#capacityPackets,
      }),
      read: dimensions({ bytes: this.#readBytes, packets: this.#readPackets }),
      advertised: dimensions({
        bytes: this.#advertisedBytes,
        packets: this.#advertisedPackets,
      }),
      announcements: String(this.#announcements),
    });
  }

  /** The cumulative ceiling to place on the next envelope. */
  get grant(): CreditGrant {
    return Object.freeze({
      bytes: this.#readBytes + this.#capacityBytes,
      packets: this.#readPackets + this.#capacityPackets,
    });
  }

  /** One packet was consumed, so the ceiling advances by one. */
  consumed(bytes: number): void {
    this.#readBytes += bytes;
    this.#readPackets += 1;
  }

  /** Records that the current ceiling has been put on the wire. */
  advertised(): void {
    const grant = this.grant;
    this.#advertisedPackets = grant.packets;
    this.#advertisedBytes = grant.bytes;
    this.#announcements += 1;
  }

  /**
   * True when the ceiling has advanced far enough to be worth announcing
   * unsolicited.
   *
   * A sender that reached its ceiling stops sending, so no envelope flows to
   * carry the replenishment. Announcing on every packet would add a control
   * message per data message; announcing never would deadlock. Half the
   * capacity is TCP's rule for the same problem, for the same reason.
   */
  get shouldAdvertise(): boolean {
    const advanced = this.grant.packets - this.#advertisedPackets;
    return advanced >= Math.max(1, Math.floor(this.#capacityPackets / 2));
  }

}

function dimensions(
  grant: { readonly bytes: number; readonly packets: number },
): { readonly bytes: string; readonly packets: string } {
  return Object.freeze({
    bytes: String(grant.bytes),
    packets: String(grant.packets),
  });
}
