import type { CreditGrant } from "@agp/protocol";

import { AgpError } from "./errors.js";

/**
 * Per-hop credit, the peer-facing half of resource governance.
 *
 * `ResourceLedger` governs what this node may consume of itself. Credit governs
 * what a peer may consume of this node. One concern with two faces, per `D19`.
 *
 * Credit is granted per adjacency and per direction, so each hop governs its
 * own ingress and no end-to-end state is implied.
 */

/** An absent grant means unlimited, which is how an unnegotiated peer behaves. */
export const UNLIMITED_CREDIT = undefined;

export function isCreditGrant(value: unknown): value is CreditGrant {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<CreditGrant>;
  return Number.isSafeInteger(candidate.bytes)
    && Number.isSafeInteger(candidate.packets)
    && (candidate.bytes as number) >= 0
    && (candidate.packets as number) >= 0;
}

/**
 * Tracks what a peer has granted this node, and what this node has spent.
 *
 * The sender never admits beyond its grant. Exceeding one is a protocol
 * violation rather than a drop, because AGP does not retransmit and a dropped
 * message would be lost permanently.
 */
export class CreditSpend {
  #grant: CreditGrant | undefined;
  #bytesSpent = 0;
  #packetsSpent = 0;

  constructor(initial?: CreditGrant) {
    if (initial !== undefined && !isCreditGrant(initial)) {
      throw new AgpError(
        "CONFIG_INVALID",
        "CreditSpend.constructor",
        "initial credit must be a non-negative safe-integer grant",
      );
    }
    this.#grant = initial;
  }

  /** Unlimited while the peer has never advertised a grant. */
  get unlimited(): boolean {
    return this.#grant === undefined;
  }

  get remaining(): CreditGrant | undefined {
    if (this.#grant === undefined) return undefined;
    return Object.freeze({
      bytes: Math.max(0, this.#grant.bytes - this.#bytesSpent),
      packets: Math.max(0, this.#grant.packets - this.#packetsSpent),
    });
  }

  /**
   * A grant is an absolute ceiling rather than an increment, so a replayed or
   * reordered advertisement cannot inflate it. Reordering cannot occur on a
   * live channel under `D14`, and treating it as absolute keeps that assumption
   * from becoming load-bearing.
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
    this.#grant = grant;
    this.#bytesSpent = 0;
    this.#packetsSpent = 0;
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
    this.#bytesSpent += bytes;
    this.#packetsSpent += 1;
  }
}

/**
 * Computes the grant this node advertises to a peer.
 *
 * A grant never exceeds the channel limits this node supplied to its adapter,
 * so the receive ring cannot be oversubscribed by construction. That is what
 * makes `RECEIVE_OVERFLOW` unreachable between conforming peers rather than a
 * routine outcome of a burst.
 */
export class CreditGrantor {
  readonly #maxBytes: number;
  readonly #maxPackets: number;
  #outstandingBytes = 0;
  #outstandingPackets = 0;
  #advertised: CreditGrant;

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
    this.#maxBytes = limits.bytes;
    this.#maxPackets = limits.packets;
    this.#advertised = this.#current();
  }

  #current(): CreditGrant {
    return Object.freeze({
      bytes: Math.max(0, this.#maxBytes - this.#outstandingBytes),
      packets: Math.max(0, this.#maxPackets - this.#outstandingPackets),
    });
  }

  /** The grant to place on the next envelope. */
  get grant(): CreditGrant {
    this.#advertised = this.#current();
    return this.#advertised;
  }

  /** A packet arrived and has not yet been drained by the consumer. */
  received(bytes: number): void {
    this.#outstandingBytes += bytes;
    this.#outstandingPackets += 1;
  }

  /** The consumer took ownership, so the capacity is available again. */
  drained(bytes: number): void {
    this.#outstandingBytes = Math.max(0, this.#outstandingBytes - bytes);
    this.#outstandingPackets = Math.max(0, this.#outstandingPackets - 1);
  }

  /**
   * True when capacity reopened after being exhausted.
   *
   * A sender that has spent its grant stops sending, so no envelope flows to
   * carry the replenishment. This is the one case that needs an unsolicited
   * advertisement, and it is exactly the regime in which keepalive already
   * fires.
   */
  get reopened(): boolean {
    const advertised = this.#advertised;
    const current = this.#current();
    const wasExhausted = advertised.packets === 0 || advertised.bytes === 0;
    const nowOpen = current.packets > 0 && current.bytes > 0;
    return wasExhausted && nowOpen;
  }
}
