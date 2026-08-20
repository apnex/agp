import type { TransportChannelPort } from "@agp/transport";

export type WriterTaskKind = "data" | "route" | "control";

export interface WriterLedgerEntry {
  readonly sequence: number;
  readonly action: "admitted" | "written" | "discarded" | "failed";
  readonly kind: WriterTaskKind;
  readonly epoch?: string;
  readonly packet: Readonly<Uint8Array>;
}

export interface SessionWriterLimits {
  readonly maximumQueuedDataMessages: number;
  readonly maximumQueuedDataBytes: number;
  readonly maximumQueuedControlMessages: number;
}

export type DataAdmission =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: "epoch-closed" | "queue-full" };

interface WriterTask {
  readonly kind: WriterTaskKind;
  readonly packet: Readonly<Uint8Array>;
  readonly encodedBytes: number;
  readonly epoch?: string;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

/**
 * One ordered writer per exact controller.
 *
 * Data reservation and epoch closure are synchronous. Consequently a route
 * snapshot enqueued while closing an epoch is behind every data frame already
 * admitted under that epoch, and later data cannot join it.
 */
export class SessionWriter {
  readonly #channel: TransportChannelPort;
  readonly #limits: SessionWriterLimits;
  readonly #onFailure: ((error: unknown) => void) | undefined;
  readonly #onWritten: ((kind: WriterTaskKind) => void) | undefined;
  readonly #queue: WriterTask[] = [];
  readonly #closedEpochs = new Set<string>();
  readonly #ledger: WriterLedgerEntry[] = [];
  #queuedDataMessages = 0;
  #queuedDataBytes = 0;
  #queuedControlMessages = 0;
  #sequence = 0;
  #pumping = false;
  #accepting = true;
  #idleWaiters: Array<() => void> = [];
  readonly #writeAbort = new AbortController();

  constructor(
    channel: TransportChannelPort,
    limits: SessionWriterLimits,
    onFailure?: (error: unknown) => void,
    onWritten?: (kind: WriterTaskKind) => void,
  ) {
    for (const [name, value] of Object.entries(limits)) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError(`${name} must be a positive safe integer`);
      }
    }
    this.#channel = channel;
    this.#limits = Object.freeze({ ...limits });
    this.#onFailure = onFailure;
    this.#onWritten = onWritten;
  }

  admitData(input: {
    readonly packet: Readonly<Uint8Array>;
    readonly encodedBytes: number;
    readonly epoch: string;
  }): DataAdmission {
    if (!this.canAdmitData(input.epoch, input.encodedBytes)) {
      if (!this.#accepting || this.#closedEpochs.has(input.epoch)) {
        return Object.freeze({ accepted: false, reason: "epoch-closed" });
      }
      return Object.freeze({ accepted: false, reason: "queue-full" });
    }
    if (!this.#accepting || this.#closedEpochs.has(input.epoch)) {
      return Object.freeze({ accepted: false, reason: "epoch-closed" });
    }
    this.#queuedDataMessages += 1;
    this.#queuedDataBytes += input.encodedBytes;
    const written = this.#enqueue({
      kind: "data",
      packet: input.packet,
      encodedBytes: input.encodedBytes,
      epoch: input.epoch,
    });
    // Data admission completes at bounded enqueue, not at downstream write.
    // The writer owns post-admission failure reporting.
    void written.catch(() => undefined);
    return Object.freeze({ accepted: true });
  }

  canAdmitData(epoch: string, encodedBytes: number): boolean {
    return this.#accepting
      && !this.#closedEpochs.has(epoch)
      && Number.isSafeInteger(encodedBytes)
      && encodedBytes >= 0
      && this.#queuedDataMessages + 1
        <= this.#limits.maximumQueuedDataMessages
      && this.#queuedDataBytes + encodedBytes
        <= this.#limits.maximumQueuedDataBytes;
  }

  enqueueControl(
    packet: Readonly<Uint8Array>,
    encodedBytes: number,
  ): Promise<void> {
    if (
      !this.#accepting
      || this.#queuedControlMessages + 1
        > this.#limits.maximumQueuedControlMessages
    ) {
      return Promise.reject(new Error("control queue full"));
    }
    this.#queuedControlMessages += 1;
    return this.#enqueue({ kind: "control", packet, encodedBytes });
  }

  /**
   * Atomically closes every named source-export epoch and admits its successor
   * snapshot into the same ordered writer.
   */
  enqueueRouteSnapshot(
    packet: Readonly<Uint8Array>,
    encodedBytes: number,
    closedEpochs: readonly string[],
  ): Promise<void> {
    if (
      !this.#accepting
      || this.#queuedControlMessages + 1
        > this.#limits.maximumQueuedControlMessages
    ) {
      return Promise.reject(new Error("control queue full"));
    }
    for (const epoch of closedEpochs) this.#closedEpochs.add(epoch);
    this.#queuedControlMessages += 1;
    return this.#enqueue({ kind: "route", packet, encodedBytes });
  }

  closeEpochs(epochs: readonly string[]): void {
    for (const epoch of epochs) this.#closedEpochs.add(epoch);
  }

  async drain(): Promise<void> {
    if (!this.#pumping && this.#queue.length === 0) return;
    await new Promise<void>((resolve) => this.#idleWaiters.push(resolve));
  }

  discard(reason = "writer stopped"): number {
    this.#accepting = false;
    const tasks = this.#queue.splice(0);
    for (const task of tasks) {
      this.#release(task);
      this.#record("discarded", task);
      task.reject(new Error(reason));
    }
    this.#settleIdle();
    return tasks.length;
  }

  stop(reason = "writer stopped"): number {
    this.#writeAbort.abort(reason);
    return this.discard(reason);
  }

  usage(): {
    readonly dataMessages: number;
    readonly dataBytes: number;
    readonly controlMessages: number;
  } {
    return Object.freeze({
      dataMessages: this.#queuedDataMessages,
      dataBytes: this.#queuedDataBytes,
      controlMessages: this.#queuedControlMessages,
    });
  }

  ledger(): readonly WriterLedgerEntry[] {
    return Object.freeze(this.#ledger.map((entry) => Object.freeze({ ...entry })));
  }

  #enqueue(input: {
    readonly kind: WriterTaskKind;
    readonly packet: Readonly<Uint8Array>;
    readonly encodedBytes: number;
    readonly epoch?: string;
  }): Promise<void> {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const result = new Promise<void>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    const task: WriterTask = {
      ...input,
      resolve,
      reject,
    };
    this.#queue.push(task);
    this.#record("admitted", task);
    this.#pump();
    return result;
  }

  #pump(): void {
    if (this.#pumping) return;
    this.#pumping = true;
    void this.#pumpLoop();
  }

  async #pumpLoop(): Promise<void> {
    while (this.#queue.length > 0) {
      const task = this.#queue.shift();
      if (task === undefined) break;
      try {
        await this.#channel.send(
          { bytes: task.packet },
          this.#writeAbort.signal,
        );
        this.#record("written", task);
        task.resolve();
        try {
          this.#onWritten?.(task.kind);
        } catch {
          // Timer bookkeeping cannot retroactively fail a completed write.
        }
      } catch (error) {
        this.#record("failed", task);
        task.reject(error);
        this.#onFailure?.(error);
      } finally {
        this.#release(task);
      }
    }
    this.#pumping = false;
    this.#settleIdle();
    if (this.#queue.length > 0) this.#pump();
  }

  #release(task: WriterTask): void {
    if (task.kind === "data") {
      this.#queuedDataMessages -= 1;
      this.#queuedDataBytes -= task.encodedBytes;
    } else {
      this.#queuedControlMessages -= 1;
    }
  }

  #record(
    action: WriterLedgerEntry["action"],
    task: Pick<WriterTask, "kind" | "epoch" | "packet">,
  ): void {
    this.#sequence += 1;
    this.#ledger.push(Object.freeze({
      sequence: this.#sequence,
      action,
      kind: task.kind,
      ...(task.epoch === undefined ? {} : { epoch: task.epoch }),
      packet: task.packet,
    }));
  }

  #settleIdle(): void {
    if (this.#pumping || this.#queue.length > 0) return;
    const waiters = this.#idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}
