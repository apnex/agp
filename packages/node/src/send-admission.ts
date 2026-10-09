import { AgpError, type Cancellable, type ClockPort } from "@agp/core";

/** Owns send cancellation until admission commits; a rejected queued send cannot run later. */
export class SendAdmissionGuard {
  readonly #clock: ClockPort;
  readonly #timeoutMs: number | undefined;
  readonly #signal: AbortSignal | undefined;
  readonly #startedAt: number;
  readonly #cancelled: Promise<never>;
  readonly #reject: (error: AgpError) => void;
  #timer: Cancellable | undefined;
  #failure: AgpError | undefined;
  #committed = false;

  constructor(clock: ClockPort, timeoutMs?: number, signal?: AbortSignal) {
    this.#clock = clock;
    this.#timeoutMs = timeoutMs;
    this.#signal = signal;
    this.#startedAt = clock.monotonicMs();
    let reject!: (error: AgpError) => void;
    this.#cancelled = new Promise<never>((_resolve, rejectPromise) => {
      reject = rejectPromise;
    });
    this.#reject = reject;
    signal?.addEventListener("abort", this.#onAbort, { once: true });
    if (timeoutMs !== undefined) this.#scheduleDeadline();
  }

  /** Reject promptly while waiting, and retain that refusal for the queued admission. */
  async waitFor<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await Promise.race([Promise.resolve().then(work), this.#cancelled]);
    } finally {
      this.#cleanup();
    }
  }

  /** Recheck after each asynchronous wait and immediately before the admission commit. */
  check(): void {
    if (this.#committed) return;
    if (this.#signal?.aborted) this.#cancel("ABORTED");
    if (this.#timeoutMs !== undefined
      && this.#clock.monotonicMs() - this.#startedAt >= this.#timeoutMs) {
      this.#cancel("TIMEOUT");
    }
    if (this.#failure !== undefined) throw this.#failure;
  }

  /** End cancellation authority before any handler or peer write can be admitted. */
  commit(): void {
    this.check();
    this.#committed = true;
    this.#cleanup();
  }

  readonly #onAbort = (): void => { this.#cancel("ABORTED"); };

  #cancel(code: "ABORTED" | "TIMEOUT"): void {
    if (this.#committed || this.#failure !== undefined) return;
    this.#failure = new AgpError(code, "node.send",
      code === "ABORTED" ? "Send admission cancelled" : "Send admission deadline expired");
    this.#cleanup();
    this.#reject(this.#failure);
  }

  #scheduleDeadline(): void {
    const remaining = this.#timeoutMs! - (this.#clock.monotonicMs() - this.#startedAt);
    if (remaining <= 0) {
      this.#cancel("TIMEOUT");
      return;
    }
    // ClockPort requires whole milliseconds; round up so fractional elapsed time
    // cannot shorten the deadline. Node timers also have a signed 32-bit limit.
    this.#timer = this.#clock.schedule(Math.min(Math.ceil(remaining), 2_147_483_647), () => {
      this.#timer = undefined;
      this.#scheduleDeadline();
    });
  }

  #cleanup(): void {
    this.#timer?.cancel();
    this.#timer = undefined;
    this.#signal?.removeEventListener("abort", this.#onAbort);
  }
}
