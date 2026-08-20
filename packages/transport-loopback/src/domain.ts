import type { LoopbackCounterKey } from "./types.generated.js";

export const UNSIGNED_64_MAX = 18_446_744_073_709_551_615n;
export const LAST_ORDINARY_REVISION = UNSIGNED_64_MAX - 1n;

export interface MonotonicSeed {
  readonly revision?: bigint;
  readonly arbitrationSequence?: bigint;
  readonly counters?: Readonly<Partial<Record<LoopbackCounterKey, bigint>>>;
}

export class MonotonicExhaustion extends Error {
  readonly domain: "revision" | "counter" | "arbitration-sequence";
  readonly counterKey?: LoopbackCounterKey;

  constructor(
    domain: "revision" | "counter" | "arbitration-sequence",
    counterKey?: LoopbackCounterKey,
  ) {
    super(`Loopback monotonic domain exhausted: ${domain}`);
    this.name = "MonotonicExhaustion";
    this.domain = domain;
    if (counterKey !== undefined) {
      this.counterKey = counterKey;
    }
  }
}

export const LOOPBACK_COUNTER_KEYS = Object.freeze([
  "connectionsAccepted",
  "connectionsRejected",
  "packetsAcceptedLeftToRight",
  "bytesAcceptedLeftToRight",
  "packetsAcceptedRightToLeft",
  "bytesAcceptedRightToLeft",
  "backpressureActivations",
  "gracefulChannelCloses",
  "forcedChannelAborts",
  "adapterInvariantFaults",
] as const satisfies readonly LoopbackCounterKey[]);

export class MonotonicDomains {
  #revision: bigint;
  #arbitrationSequence: bigint;
  readonly #counters: Record<LoopbackCounterKey, bigint>;

  constructor(seed: MonotonicSeed = {}) {
    this.#revision = checkedSeed(seed.revision ?? 0n, "revision");
    this.#arbitrationSequence = checkedSeed(
      seed.arbitrationSequence ?? 0n,
      "arbitration-sequence",
    );
    this.#counters = Object.fromEntries(
      LOOPBACK_COUNTER_KEYS.map((key) => [
        key,
        checkedSeed(seed.counters?.[key] ?? 0n, "counter"),
      ]),
    ) as Record<LoopbackCounterKey, bigint>;
  }

  get revision(): bigint {
    return this.#revision;
  }

  get arbitrationSequence(): bigint {
    return this.#arbitrationSequence;
  }

  counter(key: LoopbackCounterKey): bigint {
    return this.#counters[key];
  }

  preflight(
    deltas: Readonly<Partial<Record<LoopbackCounterKey, bigint>>> = {},
    arbitrationAllocations = 0n,
  ): void {
    if (this.#revision + 1n > LAST_ORDINARY_REVISION) {
      throw new MonotonicExhaustion("revision");
    }
    if (
      arbitrationAllocations < 0n
      || this.#arbitrationSequence + arbitrationAllocations > UNSIGNED_64_MAX
    ) {
      throw new MonotonicExhaustion("arbitration-sequence");
    }
    for (const key of LOOPBACK_COUNTER_KEYS) {
      const delta = deltas[key] ?? 0n;
      if (delta < 0n || this.#counters[key] + delta > UNSIGNED_64_MAX) {
        throw new MonotonicExhaustion("counter", key);
      }
    }
  }

  commit(
    deltas: Readonly<Partial<Record<LoopbackCounterKey, bigint>>> = {},
    arbitrationAllocations = 0n,
  ): bigint | undefined {
    this.preflight(deltas, arbitrationAllocations);
    this.#revision += 1n;
    for (const key of LOOPBACK_COUNTER_KEYS) {
      this.#counters[key] += deltas[key] ?? 0n;
    }
    if (arbitrationAllocations === 0n) {
      return undefined;
    }
    const first = this.#arbitrationSequence + 1n;
    this.#arbitrationSequence += arbitrationAllocations;
    return first;
  }

  commitFailureRevision(): void {
    if (this.#revision >= UNSIGNED_64_MAX) {
      throw new RangeError("Fabric failure revision cannot advance");
    }
    this.#revision += 1n;
  }
}

function checkedSeed(
  value: bigint,
  domain: "revision" | "counter" | "arbitration-sequence",
): bigint {
  if (value < 0n || value > UNSIGNED_64_MAX) {
    throw new RangeError(`Invalid ${domain} seed`);
  }
  return value;
}
