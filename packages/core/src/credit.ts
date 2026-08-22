import type { CreditGrant } from "@agp/protocol";

import { AgpError } from "./errors.js";

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
    this.#ceiling = current === undefined ? grant : Object.freeze({
      bytes: Math.max(current.bytes, grant.bytes),
      packets: Math.max(current.packets, grant.packets),
    });
  }

  canAdmit(bytes: number): boolean {
    const remaining = this.remaining;
    if (remaining === undefined) return true;
    return remaining.packets >= 1 && remaining.bytes >= bytes;
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
    this.#advertisedPackets = this.grant.packets;
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
