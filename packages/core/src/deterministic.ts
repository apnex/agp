import { AgpError } from "./errors.js";
import type {
  Cancellable,
  ClockPort,
  IdScope,
  IdSourcePort,
  RandomPort,
  Timestamp,
} from "./types.js";

export class SystemClock implements ClockPort {
  wallTime(): Timestamp {
    return new Date().toISOString();
  }

  monotonicMs(): number {
    return performance.now();
  }

  schedule(delayMs: number, callback: () => void): Cancellable {
    assertDelay(delayMs);
    const handle = setTimeout(callback, delayMs);
    return Object.freeze({
      cancel(): void {
        clearTimeout(handle);
      },
    });
  }
}

interface ScheduledTask {
  readonly id: number;
  readonly due: number;
  readonly callback: () => void;
  cancelled: boolean;
}

/**
 * Controllable monotonic/wall clock. Tasks due at the same instant run in
 * insertion order. Callbacks scheduled by a callback for the current instant
 * are run in that same `advanceBy` operation.
 */
export class ManualClock implements ClockPort {
  #monotonic: number;
  #wallEpochMs: number;
  #nextTaskId = 1;
  readonly #tasks: ScheduledTask[] = [];

  constructor(
    input: {
      readonly monotonicMs?: number;
      readonly wallTime?: Timestamp;
    } = {},
  ) {
    this.#monotonic = input.monotonicMs ?? 0;
    this.#wallEpochMs = Date.parse(input.wallTime ?? "2026-01-01T00:00:00.000Z")
      - this.#monotonic;
    if (!Number.isFinite(this.#monotonic) || this.#monotonic < 0) {
      throw new AgpError(
        "CONFIG_INVALID",
        "ManualClock.constructor",
        "monotonicMs must be finite and non-negative",
      );
    }
    if (!Number.isFinite(this.#wallEpochMs)) {
      throw new AgpError(
        "CONFIG_INVALID",
        "ManualClock.constructor",
        "wallTime must be an RFC 3339 timestamp",
      );
    }
  }

  wallTime(): Timestamp {
    return new Date(this.#wallEpochMs + this.#monotonic).toISOString();
  }

  monotonicMs(): number {
    return this.#monotonic;
  }

  schedule(delayMs: number, callback: () => void): Cancellable {
    assertDelay(delayMs);
    const task: ScheduledTask = {
      id: this.#nextTaskId++,
      due: this.#monotonic + delayMs,
      callback,
      cancelled: false,
    };
    this.#tasks.push(task);
    return Object.freeze({
      cancel(): void {
        task.cancelled = true;
      },
    });
  }

  advanceBy(delayMs: number): void {
    assertDelay(delayMs);
    this.advanceTo(this.#monotonic + delayMs);
  }

  advanceTo(monotonicMs: number): void {
    if (!Number.isFinite(monotonicMs) || monotonicMs < this.#monotonic) {
      throw new AgpError(
        "CONFIG_INVALID",
        "ManualClock.advanceTo",
        "target must be finite and may not move backwards",
      );
    }

    while (true) {
      const next = this.#nextDue(monotonicMs);
      if (next === undefined) break;
      this.#monotonic = next.due;
      next.cancelled = true;
      next.callback();
    }
    this.#monotonic = monotonicMs;
    this.#discardCancelled();
  }

  pendingTasks(): number {
    return this.#tasks.reduce(
      (count, task) => count + (task.cancelled ? 0 : 1),
      0,
    );
  }

  #nextDue(target: number): ScheduledTask | undefined {
    let selected: ScheduledTask | undefined;
    for (const task of this.#tasks) {
      if (task.cancelled || task.due > target) continue;
      if (
        selected === undefined
        || task.due < selected.due
        || (task.due === selected.due && task.id < selected.id)
      ) {
        selected = task;
      }
    }
    return selected;
  }

  #discardCancelled(): void {
    let write = 0;
    for (const task of this.#tasks) {
      if (!task.cancelled) this.#tasks[write++] = task;
    }
    this.#tasks.length = write;
  }
}

export class SequenceIdSource implements IdSourcePort {
  readonly #prefix: string;
  readonly #counters = new Map<IdScope, bigint>();

  constructor(prefix = "test") {
    if (prefix.length === 0) {
      throw new AgpError(
        "CONFIG_INVALID",
        "SequenceIdSource.constructor",
        "prefix may not be empty",
      );
    }
    this.#prefix = prefix;
  }

  next(scope: IdScope): string {
    const next = (this.#counters.get(scope) ?? 0n) + 1n;
    this.#counters.set(scope, next);
    return `${this.#prefix}-${scope}-${next.toString(10)}`;
  }
}

const SESSION_ID_SPACE = 0x1000000;

/**
 * Production ID source backed by Web Crypto UUIDs.
 *
 * Session IDs are node-local correlation tokens, so they use a compact
 * six-character hexadecimal representation. Each source starts at a random
 * 24-bit position and walks the complete space without repetition. Other
 * scopes retain namespaced UUIDs because those identifiers cross session
 * lifetimes and require collision resistance beyond a single node process.
 */
export class CryptoIdSource implements IdSourcePort {
  readonly #namespace: string;
  #sessionCursor: number | undefined;
  #sessionIdsIssued = 0;

  constructor(namespace = "agp") {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(namespace)) {
      throw new AgpError(
        "CONFIG_INVALID",
        "CryptoIdSource.constructor",
        "namespace must be a short identifier",
      );
    }
    this.#namespace = namespace;
  }

  next(scope: IdScope): string {
    if (scope === "session") return this.#nextSessionId();
    return `${this.#namespace}-${scope}-${this.#randomUuid()}`;
  }

  #nextSessionId(): string {
    if (this.#sessionIdsIssued >= SESSION_ID_SPACE) {
      throw new AgpError(
        "INTERNAL",
        "CryptoIdSource.next",
        "six-character session ID space is exhausted",
      );
    }
    if (this.#sessionCursor === undefined) {
      const seed = this.#randomUuid().slice(0, 6).toLowerCase();
      if (!/^[0-9a-f]{6}$/.test(seed)) {
        throw new AgpError(
          "INTERNAL",
          "CryptoIdSource.next",
          "Web Crypto randomUUID returned an invalid value",
        );
      }
      this.#sessionCursor = Number.parseInt(seed, 16);
    }

    const id = this.#sessionCursor.toString(16).padStart(6, "0");
    this.#sessionCursor = (this.#sessionCursor + 1) % SESSION_ID_SPACE;
    this.#sessionIdsIssued += 1;
    return id;
  }

  #randomUuid(): string {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID !== "function") {
      throw new AgpError(
        "INTERNAL",
        "CryptoIdSource.next",
        "Web Crypto randomUUID is unavailable",
      );
    }
    return randomUUID.call(globalThis.crypto);
  }
}

export class FixedRandom implements RandomPort {
  readonly #value: number;

  constructor(value: number) {
    assertUnit(value);
    this.#value = value;
  }

  nextUnit(): number {
    return this.#value;
  }
}

export class SequenceRandom implements RandomPort {
  readonly #values: readonly number[];
  #offset = 0;

  constructor(values: readonly number[]) {
    if (values.length === 0) {
      throw new AgpError(
        "CONFIG_INVALID",
        "SequenceRandom.constructor",
        "at least one value is required",
      );
    }
    for (const value of values) assertUnit(value);
    this.#values = Object.freeze([...values]);
  }

  nextUnit(): number {
    const value = this.#values[this.#offset];
    if (value === undefined) {
      throw new AgpError(
        "INTERNAL",
        "SequenceRandom.nextUnit",
        "deterministic random sequence exhausted",
      );
    }
    this.#offset += 1;
    return value;
  }

  remaining(): number {
    return this.#values.length - this.#offset;
  }
}

function assertDelay(value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new AgpError(
      "CONFIG_INVALID",
      "ClockPort.schedule",
      "delay must be a finite non-negative integer",
    );
  }
}

function assertUnit(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new AgpError(
      "CONFIG_INVALID",
      "RandomPort.nextUnit",
      "random value must be finite and in [0, 1)",
    );
  }
}
