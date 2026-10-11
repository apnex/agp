import type { Cancellable, ClockPort } from "@agp/core";
import type { TransportAbortIntent } from "@agp/transport";

/** Owns one outbound acquisition deadline and cancellation until node adoption. */
export class OutboundAcquisition {
  readonly #clock: ClockPort;
  readonly #timeoutMs: number;
  readonly #startedAt: number;
  readonly #abort = new AbortController();
  #timer: Cancellable | undefined;
  #state: "pending" | "adopted" | "cancelled" | "finished" = "pending";
  #abortIntent: TransportAbortIntent | undefined;

  constructor(clock: ClockPort, timeoutMs: number) {
    this.#clock = clock;
    this.#timeoutMs = timeoutMs;
    this.#startedAt = clock.monotonicMs();
    this.#scheduleDeadline();
  }

  get signal(): AbortSignal {
    return this.#abort.signal;
  }

  get abortIntent(): TransportAbortIntent | undefined {
    return this.#abortIntent;
  }

  /** Check elapsed time at adoption as well as in the timer callback. */
  adopt(): boolean {
    if (this.#state !== "pending") return false;
    if (this.#remainingMs() <= 0) this.#expire();
    if (this.#state !== "pending") return false;
    this.#state = "adopted";
    this.finish();
    return true;
  }

  /** Cancel acquisition authority, not an already adopted channel. */
  cancel(): void {
    this.#cancel({ kind: "forced-stop", code: "ACQUISITION_CANCELLED" });
  }

  /** Release the deadline after settlement without revoking adopted authority. */
  finish(): void {
    this.#timer?.cancel();
    this.#timer = undefined;
    if (this.#state === "pending") this.#state = "finished";
  }

  #remainingMs(): number {
    return this.#timeoutMs - (this.#clock.monotonicMs() - this.#startedAt);
  }

  #scheduleDeadline(): void {
    if (this.#state !== "pending") return;
    const remaining = this.#remainingMs();
    if (remaining <= 0) {
      this.#expire();
      return;
    }
    // Round fractional clock values up; chunk delays beyond native timer width.
    this.#timer = this.#clock.schedule(Math.min(Math.ceil(remaining), 2_147_483_647), () => {
      this.#timer = undefined;
      this.#scheduleDeadline();
    });
  }

  #expire(): void {
    this.#cancel({ kind: "deadline", code: "CONNECT_TIMEOUT" });
  }

  #cancel(intent: TransportAbortIntent): void {
    if (this.#state !== "pending") return;
    this.#state = "cancelled";
    this.#abortIntent = Object.freeze(intent);
    this.finish();
    this.#abort.abort(this.#abortIntent);
  }
}
