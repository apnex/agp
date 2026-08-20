import { AgpError } from "./errors.js";
import type {
  BoundedQueueSnapshot,
  CounterValue,
  UsageGauge,
} from "./types.js";

export interface CapacityReservation {
  readonly messages: number;
  readonly bytes: number;
  readonly released: boolean;
  release(): void;
}

export interface BoundedCapacityOptions {
  readonly maximumMessages: number;
  readonly maximumBytes: number;
}

/**
 * Atomic count-and-byte accounting used by data, inbound, and readiness
 * queues. Reservations never wait and release exactly once.
 */
export class BoundedCapacity {
  readonly #maximumMessages: number;
  readonly #maximumBytes: number;
  #currentMessages = 0;
  #currentBytes = 0;
  #highWaterMessages = 0;
  #highWaterBytes = 0;

  constructor(options: BoundedCapacityOptions) {
    this.#maximumMessages = positiveSafeInteger(
      options.maximumMessages,
      "maximumMessages",
    );
    this.#maximumBytes = positiveSafeInteger(
      options.maximumBytes,
      "maximumBytes",
    );
  }

  tryReserve(messages: number, bytes: number): CapacityReservation | undefined {
    const requestedMessages = nonNegativeSafeInteger(messages, "messages");
    const requestedBytes = nonNegativeSafeInteger(bytes, "bytes");
    if (requestedMessages === 0 && requestedBytes === 0) {
      return new Reservation(this, 0, 0);
    }
    if (
      requestedMessages > this.#maximumMessages - this.#currentMessages
      || requestedBytes > this.#maximumBytes - this.#currentBytes
    ) {
      return undefined;
    }
    this.#currentMessages += requestedMessages;
    this.#currentBytes += requestedBytes;
    this.#highWaterMessages = Math.max(
      this.#highWaterMessages,
      this.#currentMessages,
    );
    this.#highWaterBytes = Math.max(this.#highWaterBytes, this.#currentBytes);
    return new Reservation(this, requestedMessages, requestedBytes);
  }

  snapshot(): BoundedQueueSnapshot {
    return Object.freeze({
      currentMessages: counter(this.#currentMessages),
      maximumMessages: counter(this.#maximumMessages),
      highWaterMessages: counter(this.#highWaterMessages),
      currentBytes: counter(this.#currentBytes),
      maximumBytes: counter(this.#maximumBytes),
      highWaterBytes: counter(this.#highWaterBytes),
    });
  }

  get currentMessages(): number {
    return this.#currentMessages;
  }

  get currentBytes(): number {
    return this.#currentBytes;
  }

  _release(messages: number, bytes: number): void {
    if (messages > this.#currentMessages || bytes > this.#currentBytes) {
      throw new AgpError(
        "INTERNAL",
        "BoundedCapacity.release",
        "reservation accounting underflow",
      );
    }
    this.#currentMessages -= messages;
    this.#currentBytes -= bytes;
  }
}

class Reservation implements CapacityReservation {
  #released = false;
  readonly #owner: BoundedCapacity;
  readonly messages: number;
  readonly bytes: number;

  constructor(
    owner: BoundedCapacity,
    messages: number,
    bytes: number,
  ) {
    this.#owner = owner;
    this.messages = messages;
    this.bytes = bytes;
  }

  get released(): boolean {
    return this.#released;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    this.#owner._release(this.messages, this.bytes);
  }
}

export interface BoundedQueueEntry<T> {
  readonly value: T;
  readonly encodedBytes: number;
}

interface OwnedQueueEntry<T> extends BoundedQueueEntry<T> {
  readonly reservation: CapacityReservation;
}

/**
 * Finite FIFO. `tryEnqueue` linearizes item insertion with capacity
 * reservation and never silently drops.
 */
export class BoundedQueue<T> {
  readonly #capacity: BoundedCapacity;
  readonly #items: OwnedQueueEntry<T>[] = [];
  #head = 0;

  constructor(options: BoundedCapacityOptions) {
    this.#capacity = new BoundedCapacity(options);
  }

  tryEnqueue(value: T, encodedBytes: number): boolean {
    const bytes = nonNegativeSafeInteger(encodedBytes, "encodedBytes");
    const reservation = this.#capacity.tryReserve(1, bytes);
    if (reservation === undefined) return false;
    this.#items.push({ value, encodedBytes: bytes, reservation });
    return true;
  }

  dequeue(): BoundedQueueEntry<T> | undefined {
    const item = this.#items[this.#head];
    if (item === undefined) return undefined;
    this.#head += 1;
    item.reservation.release();
    this.#compact();
    return Object.freeze({
      value: item.value,
      encodedBytes: item.encodedBytes,
    });
  }

  peek(): BoundedQueueEntry<T> | undefined {
    const item = this.#items[this.#head];
    if (item === undefined) return undefined;
    return Object.freeze({
      value: item.value,
      encodedBytes: item.encodedBytes,
    });
  }

  clear(): readonly BoundedQueueEntry<T>[] {
    const discarded: BoundedQueueEntry<T>[] = [];
    while (true) {
      const next = this.dequeue();
      if (next === undefined) break;
      discarded.push(next);
    }
    return Object.freeze(discarded);
  }

  snapshot(): BoundedQueueSnapshot {
    return this.#capacity.snapshot();
  }

  get length(): number {
    return this.#capacity.currentMessages;
  }

  #compact(): void {
    if (this.#head > 64 && this.#head * 2 >= this.#items.length) {
      this.#items.splice(0, this.#head);
      this.#head = 0;
    }
  }
}

export interface ResourceLimits {
  readonly [resource: string]: number;
}

export interface ResourceReservation {
  readonly released: boolean;
  release(): void;
}

interface MutableGauge {
  readonly maximum: number;
  current: number;
  highWater: number;
}

/**
 * Atomically reserves any number of named finite scalar resources. It is used
 * to combine per-session and process-wide caps without partial admission.
 */
export class ResourceLedger {
  readonly #gauges = new Map<string, MutableGauge>();

  constructor(limits: ResourceLimits) {
    for (const [name, maximum] of Object.entries(limits)) {
      if (name.length === 0) {
        throw new AgpError(
          "CONFIG_INVALID",
          "ResourceLedger.constructor",
          "resource names may not be empty",
        );
      }
      this.#gauges.set(name, {
        maximum: positiveSafeInteger(maximum, `limits.${name}`),
        current: 0,
        highWater: 0,
      });
    }
    if (this.#gauges.size === 0) {
      throw new AgpError(
        "CONFIG_INVALID",
        "ResourceLedger.constructor",
        "at least one resource is required",
      );
    }
  }

  tryReserve(request: Readonly<Record<string, number>>): ResourceReservation | undefined {
    const normalized: [string, number, MutableGauge][] = [];
    for (const [name, amountValue] of Object.entries(request)) {
      const gauge = this.#gauges.get(name);
      if (gauge === undefined) {
        throw new AgpError(
          "CONFIG_INVALID",
          "ResourceLedger.tryReserve",
          `unknown resource: ${name}`,
        );
      }
      const amount = nonNegativeSafeInteger(amountValue, `request.${name}`);
      if (amount > gauge.maximum - gauge.current) return undefined;
      normalized.push([name, amount, gauge]);
    }
    for (const [, amount, gauge] of normalized) {
      gauge.current += amount;
      gauge.highWater = Math.max(gauge.highWater, gauge.current);
    }
    return new LedgerReservation(this, normalized.map(([name, amount]) => [
      name,
      amount,
    ]));
  }

  snapshot(resource: string): UsageGauge {
    const gauge = this.#gauges.get(resource);
    if (gauge === undefined) {
      throw new AgpError(
        "CONFIG_INVALID",
        "ResourceLedger.snapshot",
        `unknown resource: ${resource}`,
      );
    }
    return Object.freeze({
      current: counter(gauge.current),
      maximum: counter(gauge.maximum),
      highWater: counter(gauge.highWater),
    });
  }

  snapshots(): Readonly<Record<string, UsageGauge>> {
    const result: Record<string, UsageGauge> = {};
    for (const name of [...this.#gauges.keys()].sort()) {
      result[name] = this.snapshot(name);
    }
    return Object.freeze(result);
  }

  _release(request: readonly (readonly [string, number])[]): void {
    for (const [name, amount] of request) {
      const gauge = this.#gauges.get(name);
      if (gauge === undefined || amount > gauge.current) {
        throw new AgpError(
          "INTERNAL",
          "ResourceLedger.release",
          "resource accounting underflow",
        );
      }
    }
    for (const [name, amount] of request) {
      const gauge = this.#gauges.get(name);
      if (gauge !== undefined) gauge.current -= amount;
    }
  }
}

class LedgerReservation implements ResourceReservation {
  #released = false;
  readonly #owner: ResourceLedger;
  readonly #request: readonly (readonly [string, number])[];

  constructor(
    owner: ResourceLedger,
    request: readonly (readonly [string, number])[],
  ) {
    this.#owner = owner;
    this.#request = request;
  }

  get released(): boolean {
    return this.#released;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    this.#owner._release(this.#request);
  }
}

export function counter(value: number | bigint): CounterValue {
  if (
    (typeof value === "number"
      && (!Number.isSafeInteger(value) || value < 0))
    || (typeof value === "bigint" && value < 0n)
  ) {
    throw new AgpError(
      "INTERNAL",
      "counter",
      "counter values must be non-negative integers",
    );
  }
  return value.toString(10);
}

function positiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AgpError(
      "CONFIG_INVALID",
      "bounded-capacity",
      `${name} must be a positive safe integer`,
    );
  }
  return value;
}

function nonNegativeSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AgpError(
      "CONFIG_INVALID",
      "bounded-capacity",
      `${name} must be a non-negative safe integer`,
    );
  }
  return value;
}
