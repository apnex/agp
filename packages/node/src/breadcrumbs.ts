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
    return this.#fits(retainedBytes);
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

  add(input: BreadcrumbInput, retainedBytes: number): boolean {
    if (!this.canReserve(retainedBytes)) return false;
    let tokens = this.#byController.get(input.egress.identity);
    if (tokens === undefined) {
      tokens = new Map();
      this.#byController.set(input.egress.identity, tokens);
    }
    if (tokens.has(input.outboundReturnToken)) {
      throw new Error("return token reused by exact controller");
    }
    tokens.set(input.outboundReturnToken, { input, retainedBytes });
    this.#entries += 1;
    this.#version += 1;
    this.#bytes += retainedBytes;
    this.#highWaterEntries = Math.max(this.#highWaterEntries, this.#entries);
    this.#highWaterBytes = Math.max(this.#highWaterBytes, this.#bytes);
    return true;
  }

  consume(
    controller: ExactController,
    token: ReturnToken,
    refId: MessageId,
    nowMonotonicMs: number,
  ): BreadcrumbLookup {
    const tokens = this.#byController.get(controller.identity);
    const stored = tokens?.get(token);
    if (stored === undefined) return Object.freeze({ kind: "unreturnable" });
    if (stored.input.expiresAtMonotonicMs <= nowMonotonicMs) {
      this.#delete(controller.identity, token, stored);
      return Object.freeze({ kind: "unreturnable" });
    }
    if (stored.input.messageId !== refId) {
      return Object.freeze({
        kind: "ref-mismatch",
        breadcrumb: stored.input,
      });
    }
    this.#delete(controller.identity, token, stored);
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
