import type { LatencySample } from "./types.js";

/**
 * One recorder for every duration the node measures.
 *
 * A timing is state, not a log line, so it is retained where any authorized
 * actor can read it rather than emitted where only a live observer can. `D20`
 * fixes the shape; this is the only thing that produces it, so a timing added
 * later reuses a primitive instead of inventing another field pair.
 *
 * What it keeps is deliberately three numbers. An aggregate is constant-time
 * and allocation-free, so it can be always on without changing the timing it
 * reports, which a retained per-event history could not claim.
 *
 * The count is carried because a high-water mark drawn from three samples and
 * one drawn from three thousand are not the same claim, and a reader who
 * cannot tell them apart will over-trust the smaller one.
 */
export class LatencyRecorder {
  #count = 0;
  #lastUs = 0;
  #highWaterUs = 0;

  /**
   * Records one observation, in whole microseconds.
   *
   * Microseconds because the durations worth watching here are routinely
   * below a millisecond, and an integer millisecond would report them as
   * nothing at all. A negative or non-finite value is refused rather than
   * recorded, because it is not an observation.
   */
  record(durationUs: number): void {
    if (!Number.isFinite(durationUs) || durationUs < 0) return;
    this.#count += 1;
    const whole = Math.round(durationUs);
    this.#lastUs = whole;
    if (whole > this.#highWaterUs) this.#highWaterUs = whole;
  }

  get observed(): boolean {
    return this.#count > 0;
  }

  /** Undefined until something has been measured, so an unobserved timing
   * reports nothing rather than reporting zero. */
  get sample(): LatencySample | undefined {
    if (this.#count === 0) return undefined;
    return Object.freeze({
      count: String(this.#count),
      lastUs: this.#lastUs,
      highWaterUs: this.#highWaterUs,
    });
  }
}
