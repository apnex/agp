import type { ReturnToken } from "@agp/protocol";

export type ReturnTokenAllocation =
  | { readonly kind: "token"; readonly token: ReturnToken }
  | { readonly kind: "exhausted" };

export interface ReturnTokenAllocatorSnapshot {
  readonly allocationCount: string;
  readonly exhausted: boolean;
  readonly domainMaximum: ReturnToken;
}

export interface ReturnTokenAllocatorPort {
  readonly usable: boolean;
  allocate(): ReturnTokenAllocation;
  snapshot(): ReturnTokenAllocatorSnapshot;
}

const UINT64_MAX = 0xffff_ffff_ffff_ffffn;

/**
 * A controller-scoped, non-reusing unsigned-64 token allocator.
 *
 * `initial` and `domainMaximum` make terminal behavior executable in unit
 * tests. Production construction uses the defaults: zero through UINT64_MAX.
 */
export class ReturnTokenAllocator implements ReturnTokenAllocatorPort {
  #next: bigint;
  readonly #domainMaximum: bigint;
  #allocationCount = 0n;
  #exhausted = false;

  constructor(initial = 0n, domainMaximum = UINT64_MAX) {
    if (
      initial < 0n
      || domainMaximum < 0n
      || domainMaximum > UINT64_MAX
      || initial > domainMaximum
    ) {
      throw new RangeError("return-token allocator bounds are invalid");
    }
    this.#next = initial;
    this.#domainMaximum = domainMaximum;
  }

  get usable(): boolean {
    return !this.#exhausted;
  }

  allocate(): ReturnTokenAllocation {
    if (this.#exhausted) return Object.freeze({ kind: "exhausted" });

    const token = this.#next.toString(16).padStart(16, "0") as ReturnToken;
    this.#allocationCount += 1n;
    if (this.#next === this.#domainMaximum) {
      this.#exhausted = true;
    } else {
      this.#next += 1n;
    }
    return Object.freeze({ kind: "token", token });
  }

  snapshot(): ReturnTokenAllocatorSnapshot {
    return Object.freeze({
      allocationCount: this.#allocationCount.toString(10),
      exhausted: this.#exhausted,
      domainMaximum: this.#domainMaximum
        .toString(16)
        .padStart(16, "0") as ReturnToken,
    });
  }
}
