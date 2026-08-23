import type {
  MessageId,
  ReturnToken,
} from "@agp/protocol";
import type {
  BreadcrumbInput,
  ExactController,
} from "./controller.js";

export interface BreadcrumbCapacity {
  readonly maximumEntries: number;
  readonly maximumBytes: number;
  /**
   * What a full table does.
   *
   * Evicting the oldest binding keeps a reverse-path concern from stopping the
   * data plane, which is the relationship D23 requires between them: the table
   * exists to report on traffic, so it must never be the thing that prevents
   * traffic. Refusing is offered for a deployment that would rather stop than
   * lose a disposition.
   *
   * Eviction and completion need each other. Completion keeps the table small
   * enough that eviction is rare, and eviction guarantees the table cannot cap
   * throughput when completion does not arrive. Eviction alone would routinely
   * discard dispositions for messages that succeeded.
   */
  readonly onCapacity: "evict-oldest" | "refuse";
}

export interface BreadcrumbUsage {
  readonly entries: number;
  readonly bytes: number;
  readonly highWaterEntries: number;
  readonly highWaterBytes: number;
}

export type BreadcrumbLookup =
  | { readonly kind: "unreturnable" }
  | { readonly kind: "ref-mismatch"; readonly breadcrumb: BreadcrumbInput }
  | { readonly kind: "consumed"; readonly breadcrumb: BreadcrumbInput };

interface StoredBreadcrumb {
  readonly input: BreadcrumbInput;
  readonly retainedBytes: number;
  /**
   * Destinations still owed against this binding, not copies sent.
   *
   * Every message today has exactly one next hop, so this is one and settling
   * once releases the entry, which is the behaviour without the field. It is
   * written as a count anyway so that a message divided across several
   * destinations needs no exception: the rule stays `released at zero`.
   * Counting copies sent instead would go negative the first time a hop
   * downstream divided further. See D23.
   */
  outstanding: number;
}

/**
 * Bounded reverse-path forwarding state. The first map is keyed by the exact
 * controller identity object; no public node/session identifier can hit it.
 */
export class BreadcrumbStore {
  readonly #capacity: BreadcrumbCapacity;
  readonly #monotonicNow: () => number;
  #lastSweepMs = Number.NEGATIVE_INFINITY;
  readonly #byController = new Map<object, Map<ReturnToken, StoredBreadcrumb>>();
  #entries = 0;
  // Increments on every membership change, so a consumer can memoise a
  // projection of the set against an exact signal rather than rebuilding it.
  #version = 0;
  #bytes = 0;
  #highWaterEntries = 0;
  #highWaterBytes = 0;
  #evicted = 0;

  constructor(capacity: BreadcrumbCapacity, monotonicNow: () => number) {
    this.#monotonicNow = monotonicNow;
    if (
      !Number.isSafeInteger(capacity.maximumEntries)
      || capacity.maximumEntries < 1
      || !Number.isSafeInteger(capacity.maximumBytes)
      || capacity.maximumBytes < 1
    ) {
      throw new RangeError("breadcrumb capacity must use positive safe integers");
    }
    this.#capacity = Object.freeze({ ...capacity });
  }

  /** Bindings evicted since start, because their table was full. */
  get evicted(): number {
    return this.#evicted;
  }

  canReserve(retainedBytes: number): boolean {
    if (!Number.isSafeInteger(retainedBytes) || retainedBytes < 0) return false;
    if (this.#fits(retainedBytes)) return true;
    // Only sweep when the answer would otherwise be no.
    //
    // A breadcrumb is released by expiry rather than by delivery, so without a
    // sweep the store fills once and never empties: a node accepted exactly
    // `maximumEntries` messages and refused every one after that for the rest
    // of its life. Sweeping on every admission instead would make each message
    // pay for every breadcrumb held, which is the shape `D21` exists to
    // forbid, so the cost is paid only at the bound and at most once a
    // millisecond. See `MX5`.
    this.#sweep();
    if (this.#fits(retainedBytes)) return true;
    if (this.#capacity.onCapacity === "refuse") return false;
    // Nothing has expired and completion has not kept up, so make room. A
    // Map preserves insertion order, so the first entry of the first
    // controller is the oldest binding held.
    while (!this.#fits(retainedBytes) && this.#entries > 0) {
      if (!this.#evictOldest()) return false;
    }
    return this.#fits(retainedBytes);
  }

  #evictOldest(): boolean {
    for (const [identity, tokens] of this.#byController) {
      for (const [token, stored] of tokens) {
        this.#delete(identity, token, stored);
        this.#evicted += 1;
        return true;
      }
    }
    return false;
  }

  #fits(retainedBytes: number): boolean {
    return this.#entries + 1 <= this.#capacity.maximumEntries
      && this.#bytes + retainedBytes <= this.#capacity.maximumBytes;
  }

  #sweep(): void {
    const now = this.#monotonicNow();
    if (now - this.#lastSweepMs < 1) return;
    this.#lastSweepMs = now;
    this.expire(now);
  }

  add(
    input: BreadcrumbInput,
    retainedBytes: number,
    outstanding = 1,
  ): boolean {
    if (!Number.isSafeInteger(outstanding) || outstanding < 1) {
      throw new RangeError("a binding must owe at least one destination");
    }
    if (!this.canReserve(retainedBytes)) return false;
    let tokens = this.#byController.get(input.egress.identity);
    if (tokens === undefined) {
      tokens = new Map();
      this.#byController.set(input.egress.identity, tokens);
    }
    if (tokens.has(input.outboundReturnToken)) {
      throw new Error("return token reused by exact controller");
    }
    tokens.set(input.outboundReturnToken, { input, retainedBytes, outstanding });
    this.#entries += 1;
    this.#version += 1;
    this.#bytes += retainedBytes;
    this.#highWaterEntries = Math.max(this.#highWaterEntries, this.#entries);
    this.#highWaterBytes = Math.max(this.#highWaterBytes, this.#bytes);
    return true;
  }

  /**
   * Settle a failure against its binding.
   *
   * A failure echoes the end-to-end identity of the message it concerns, so
   * this path checks it and reports a mismatch as fatal. A delivery carries no
   * identity to check and settles through `settleDelivered` instead: the label
   * is unique to one controller and consumed once, so it already names the
   * message, and a peer able to invent a label could equally supply an
   * identity that matched it. See D23.
   */
  consume(
    controller: ExactController,
    token: ReturnToken,
    refId: MessageId,
    nowMonotonicMs: number,
  ): BreadcrumbLookup {
    return this.#settle(controller, token, nowMonotonicMs, refId);
  }

  /** Settle a delivery against its binding. */
  settleDelivered(
    controller: ExactController,
    token: ReturnToken,
    nowMonotonicMs: number,
  ): BreadcrumbLookup {
    return this.#settle(controller, token, nowMonotonicMs, undefined);
  }

  #settle(
    controller: ExactController,
    token: ReturnToken,
    nowMonotonicMs: number,
    refId: MessageId | undefined,
  ): BreadcrumbLookup {
    const tokens = this.#byController.get(controller.identity);
    const stored = tokens?.get(token);
    if (stored === undefined) return Object.freeze({ kind: "unreturnable" });
    if (stored.input.expiresAtMonotonicMs <= nowMonotonicMs) {
      this.#delete(controller.identity, token, stored);
      return Object.freeze({ kind: "unreturnable" });
    }
    if (refId !== undefined && stored.input.messageId !== refId) {
      return Object.freeze({
        kind: "ref-mismatch",
        breadcrumb: stored.input,
      });
    }
    // Released at zero rather than on the first outcome, so a message divided
    // across several destinations needs no separate rule. Today every count is
    // one and this deletes on the first settle. See D23.
    stored.outstanding -= 1;
    if (stored.outstanding <= 0) {
      this.#delete(controller.identity, token, stored);
    }
    return Object.freeze({ kind: "consumed", breadcrumb: stored.input });
  }

  expire(nowMonotonicMs: number): readonly BreadcrumbInput[] {
    const expired: BreadcrumbInput[] = [];
    for (const [identity, tokens] of this.#byController) {
      for (const [token, stored] of tokens) {
        if (stored.input.expiresAtMonotonicMs <= nowMonotonicMs) {
          expired.push(stored.input);
          this.#delete(identity, token, stored);
        }
      }
    }
    return Object.freeze(expired);
  }

  removeForController(
    controller: ExactController,
  ): {
    readonly asIngress: readonly BreadcrumbInput[];
    readonly asEgress: readonly BreadcrumbInput[];
  } {
    const asIngress: BreadcrumbInput[] = [];
    const asEgress: BreadcrumbInput[] = [];
    for (const [identity, tokens] of this.#byController) {
      for (const [token, stored] of tokens) {
        if (identity === controller.identity) {
          asEgress.push(stored.input);
          this.#delete(identity, token, stored);
        } else if (
          stored.input.ingress.kind === "session"
          && stored.input.ingress.controller.identity === controller.identity
        ) {
          asIngress.push(stored.input);
          this.#delete(identity, token, stored);
        }
      }
    }
    return Object.freeze({
      asIngress: Object.freeze(asIngress),
      asEgress: Object.freeze(asEgress),
    });
  }

  clear(): readonly BreadcrumbInput[] {
    const removed: BreadcrumbInput[] = [];
    for (const tokens of this.#byController.values()) {
      for (const stored of tokens.values()) removed.push(stored.input);
    }
    this.#byController.clear();
    this.#entries = 0;
    this.#bytes = 0;
    return Object.freeze(removed);
  }

  usage(): BreadcrumbUsage {
    return Object.freeze({
      entries: this.#entries,
      bytes: this.#bytes,
      highWaterEntries: this.#highWaterEntries,
      highWaterBytes: this.#highWaterBytes,
    });
  }

  /** Membership generation. Changes exactly when the set does. */
  get version(): number {
    return this.#version;
  }

  snapshot(): readonly BreadcrumbInput[] {
    const values: BreadcrumbInput[] = [];
    for (const tokens of this.#byController.values()) {
      for (const stored of tokens.values()) values.push(stored.input);
    }
    return Object.freeze(values);
  }

  #delete(
    identity: object,
    token: ReturnToken,
    stored: StoredBreadcrumb,
  ): void {
    const tokens = this.#byController.get(identity);
    if (tokens?.delete(token) !== true) return;
    this.#entries -= 1;
    this.#version += 1;
    this.#bytes -= stored.retainedBytes;
    if (tokens.size === 0) this.#byController.delete(identity);
  }
}
