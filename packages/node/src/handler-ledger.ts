import type {
  JsonObject,
} from "@agp/protocol";
import type {
  EndpointHandlerContext,
  RegisteredEndpoint,
} from "./endpoint-registry.js";

export interface HandlerLimits {
  readonly maximumConcurrent: number;
  readonly maximumBytes: number;
}

export class HandlerLedger {
  readonly #limits: HandlerLimits;
  readonly #active = new Set<Promise<void>>();
  #activeBytes = 0;
  #highWaterConcurrent = 0;
  #highWaterBytes = 0;

  constructor(limits: HandlerLimits) {
    if (
      !Number.isSafeInteger(limits.maximumConcurrent)
      || limits.maximumConcurrent < 1
      || !Number.isSafeInteger(limits.maximumBytes)
      || limits.maximumBytes < 1
    ) {
      throw new RangeError("handler limits must be positive safe integers");
    }
    this.#limits = Object.freeze({ ...limits });
  }

  canReserve(bytes: number): boolean {
    return Number.isSafeInteger(bytes)
      && bytes >= 0
      && this.#active.size + 1 <= this.#limits.maximumConcurrent
      && this.#activeBytes + bytes <= this.#limits.maximumBytes;
  }

  dispatch(
    binding: RegisteredEndpoint,
    payload: JsonObject,
    context: EndpointHandlerContext,
    bytes: number,
    onComplete: (outcome: "completed" | "failed", error?: unknown) => void,
  ): boolean {
    if (!this.canReserve(bytes)) return false;
    this.#activeBytes += bytes;
    this.#highWaterConcurrent = Math.max(
      this.#highWaterConcurrent,
      this.#active.size + 1,
    );
    this.#highWaterBytes = Math.max(this.#highWaterBytes, this.#activeBytes);

    const task = Promise.resolve()
      .then(async () => binding.handler(payload, context))
      .then(
        () => onComplete("completed"),
        (error: unknown) => onComplete("failed", error),
      )
      .finally(() => {
        this.#active.delete(task);
        this.#activeBytes -= bytes;
      });
    this.#active.add(task);
    return true;
  }

  async drain(): Promise<void> {
    while (this.#active.size > 0) {
      await Promise.allSettled([...this.#active]);
    }
  }

  usage(): {
    readonly concurrent: number;
    readonly bytes: number;
    readonly highWaterConcurrent: number;
    readonly highWaterBytes: number;
  } {
    return Object.freeze({
      concurrent: this.#active.size,
      bytes: this.#activeBytes,
      highWaterConcurrent: this.#highWaterConcurrent,
      highWaterBytes: this.#highWaterBytes,
    });
  }
}
