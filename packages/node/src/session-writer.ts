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

/**
 * The peer's grant, as the writer needs to see it.
 *
 * Credit governs what goes on the wire rather than what the caller offers, so
 * it belongs here and not at admission. The queue is the send buffer that
 * absorbs the difference between the local offer rate and the remote drain
 * rate; the grant is the window that paces the wire. Gating admission instead
 * would reject a caller whose messages the queue could hold, and gating
 * nothing is `MX1`.
 *
 * Only data is gated. Control draws on a reserve the receiver holds back from
 * the ceiling it advertises, which is what keeps a stalled data queue from
 * silencing the announcement that would clear it.
 */
export interface WriterCreditPort {
  canSendData(encodedBytes: number): boolean;
  recordDataSent(encodedBytes: number): void;
  /** Resolves once the peer raises its ceiling, or once the signal aborts. */
  whenCreditAdvances(signal: AbortSignal): Promise<void>;
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
  #credit: WriterCreditPort | undefined;
  #stallAbort: AbortController | undefined;
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

  /**
   * Attaches the peer's grant.
   *
   * The controller constructs its writer before it can build a credit port,
   * because the port encodes packets and encoding needs the negotiated send
   * limit the controller owns. Until this is called the writer paces nothing,
   * which is the behaviour of a peer that never negotiated credit.
   */
  useCredit(credit: WriterCreditPort): void {
    this.#credit = credit;
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
    // A pump held at a credit stall is not waiting on the queue, so emptying
    // the queue does not release it.
    this.#stallAbort?.abort(reason);
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
    // A stalled pump is waiting on the peer, not on the queue, so pushing does
    // not rouse it. Control is the one kind that may go out during a stall, so
    // it is the one kind that has to.
    if (task.kind === "control") this.#stallAbort?.abort("control enqueued");
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
      const index = this.#nextSendable();
      if (index === -1) {
        // The stall ends in credit or in shutdown. Discard settles every task,
        // so a shutdown leaves nothing to write.
        if (!(await this.#stallForCredit())) break;
        continue;
      }
      const [task] = this.#queue.splice(index, 1);
      if (task === undefined) break;
      try {
        await this.#channel.send(
          { bytes: task.packet },
          this.#writeAbort.signal,
        );
        this.#record("written", task);
        if (task.kind === "data") this.#credit?.recordDataSent(task.encodedBytes);
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

  /**
   * The index of the next task that may go on the wire, or -1 to stall.
   *
   * Credit never blocks control. When the head is data the peer has no room
   * for, control passes it; nothing else overtakes anything, ever.
   *
   * That single exception is what makes the arrangement deadlock free. A
   * peer's grant arrives on a control message, so control held behind stalled
   * data would silence exactly the message that clears the stall: two peers
   * saturating each other would each hold the other's replenishment. It also
   * silences `route.ack`, and a peer timing an acknowledgement it will never
   * receive tears down a session that was merely busy. Both were observed
   * before this exception existed.
   *
   * A route snapshot must not overtake data, and does not. Epoch closure is
   * synchronous with admission, so data admitted under an epoch is already
   * queued ahead of the snapshot withdrawing it. Letting the withdrawal pass
   * would put data behind a route the peer had been told to forget, and the
   * peer would refuse it as unauthorized.
   *
   * Control passing a route is safe where a route passing data is not. A
   * `route.ack` names the peer's revision by reference and a snapshot carries
   * this node's own, so neither reads the other; a keepalive and a
   * notification order against nothing at all.
   */
  #nextSendable(): number {
    const head = this.#queue[0];
    if (head === undefined) return -1;
    const credit = this.#credit;
    if (
      head.kind !== "data"
      || credit === undefined
      || credit.canSendData(head.encodedBytes)
    ) {
      return 0;
    }
    return this.#queue.findIndex((task) => task.kind === "control");
  }

  /**
   * Holds the queue until the peer makes room, or until control needs the wire.
   *
   * Returns false only when the wait ended in shutdown, so the caller stops
   * rather than writing into a channel that is going away. Any other wake
   * returns true and the queue is re-examined, because the reason to wake and
   * the thing now sendable are not always the same.
   */
  async #stallForCredit(): Promise<boolean> {
    const credit = this.#credit;
    if (credit === undefined || !this.#accepting) return false;
    if (this.#writeAbort.signal.aborted) return false;
    const stall = new AbortController();
    this.#stallAbort = stall;
    const signal = AbortSignal.any([this.#writeAbort.signal, stall.signal]);
    try {
      await credit.whenCreditAdvances(signal);
      return this.#accepting && !this.#writeAbort.signal.aborted;
    } finally {
      this.#stallAbort = undefined;
    }
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
