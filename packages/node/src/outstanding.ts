import type {
  CorrelationId,
  EndpointName,
  MessageDisposition,
  MessageId,
  MessageOutcome,
} from "@agp/core";

/**
 * What an origin retains about the messages it has sent and not yet heard about.
 *
 * An intermediate hop retains only how many destinations it owes, because it
 * never needs to name them and a count is smaller. An origin does need to name
 * them, because that is what an application asks. Retaining the set here also
 * makes a repeated report harmless, rather than leaving a bare integer to be
 * defended by the consume-once rule of a hop further away. See D23 section 4.6.
 *
 * The same shape would serve a request and response surface for calls in
 * flight: an entry keyed by correlation, carrying what is outstanding, released
 * when nothing is.
 */
interface Entry {
  readonly messageId: MessageId;
  readonly correlationId: CorrelationId | undefined;
  readonly source: EndpointName;
  readonly destination: EndpointName;
  readonly openedAtMonotonicMs: number;
  readonly outcomes: MessageOutcome[];
  /** Undefined until an outcome arrives carrying the denominator. */
  total: number | undefined;
  settled: boolean;
  waiters: ((disposition: MessageDisposition) => void)[] | undefined;
}

export interface OutstandingSummary {
  readonly tracked: number;
  readonly settled: number;
  readonly oldestAgeMs: number;
  readonly dropped: number;
}

export interface OriginOutstandingOptions {
  readonly maximumEntries: number;
  readonly monotonicNow: () => number;
  readonly onDisposition: (disposition: MessageDisposition) => void;
}

export class OriginOutstanding {
  readonly #options: OriginOutstandingOptions;
  // Insertion-ordered, so the first entry is the oldest and dropping under
  // pressure needs no scan.
  readonly #byMessage = new Map<MessageId, Entry>();
  #dropped = 0;

  constructor(options: OriginOutstandingOptions) {
    this.#options = options;
  }

  /** Begin tracking a message this node originated. */
  open(input: {
    readonly messageId: MessageId;
    readonly correlationId?: CorrelationId;
    readonly source: EndpointName;
    readonly destination: EndpointName;
  }): void {
    if (this.#byMessage.has(input.messageId)) return;
    while (this.#byMessage.size >= this.#options.maximumEntries) {
      if (!this.#dropOldest()) break;
    }
    this.#byMessage.set(input.messageId, {
      messageId: input.messageId,
      correlationId: input.correlationId,
      source: input.source,
      destination: input.destination,
      openedAtMonotonicMs: this.#options.monotonicNow(),
      outcomes: [],
      total: undefined,
      settled: false,
      waiters: undefined,
    });
  }

  /**
   * Record one terminal outcome against a message.
   *
   * The count of what remains outstanding decrements unconditionally, because
   * every code in the vocabulary names an outcome: a disposition arriving
   * always means something settled. The denominator arrives with the outcome
   * rather than ahead of it, so a message with several destinations becomes
   * countable as soon as the first of them reports.
   */
  settle(
    messageId: MessageId,
    outcome: MessageOutcome,
    destinations: number,
  ): void {
    const entry = this.#byMessage.get(messageId);
    if (entry === undefined || entry.settled) return;
    entry.outcomes.push(outcome);
    entry.total = destinations;
    if (entry.outcomes.length >= destinations) {
      entry.settled = true;
    }
    const disposition = project(entry);
    this.#options.onDisposition(disposition);
    if (entry.settled) this.#resolve(entry, disposition);
  }

  /**
   * Stop expecting anything further for a message.
   *
   * Called when the binding behind it went away without an answer, so that a
   * caller waiting on it learns that no outcome is coming instead of waiting
   * forever. The entry keeps its non-zero outstanding count, which is the
   * stall an application can see.
   */
  abandon(messageId: MessageId): void {
    const entry = this.#byMessage.get(messageId);
    if (entry === undefined || entry.settled) return;
    const disposition = project(entry);
    this.#options.onDisposition(disposition);
    this.#resolve(entry, disposition);
    this.#byMessage.delete(messageId);
  }

  get(messageId: MessageId): MessageDisposition | undefined {
    const entry = this.#byMessage.get(messageId);
    return entry === undefined ? undefined : project(entry);
  }

  /**
   * Resolve when nothing further will be learned about a message.
   *
   * A waiter is allocated only when one is asked for, so a caller that never
   * asks pays nothing beyond the entry itself.
   */
  settled(messageId: MessageId): Promise<MessageDisposition> | undefined {
    const entry = this.#byMessage.get(messageId);
    if (entry === undefined) return undefined;
    if (entry.settled) return Promise.resolve(project(entry));
    return new Promise((resolve) => {
      entry.waiters ??= [];
      entry.waiters.push(resolve);
    });
  }

  summary(): OutstandingSummary {
    let settled = 0;
    let oldest = 0;
    const now = this.#options.monotonicNow();
    for (const entry of this.#byMessage.values()) {
      if (entry.settled) settled += 1;
      else oldest = Math.max(oldest, now - entry.openedAtMonotonicMs);
    }
    return Object.freeze({
      tracked: this.#byMessage.size,
      settled,
      oldestAgeMs: oldest,
      dropped: this.#dropped,
    });
  }

  clear(): void {
    for (const entry of this.#byMessage.values()) {
      this.#resolve(entry, project(entry));
    }
    this.#byMessage.clear();
  }

  #dropOldest(): boolean {
    for (const [messageId, entry] of this.#byMessage) {
      // A dropped entry resolves rather than hangs. Never resolving would
      // match the best-effort contract in letter and leak a promise in fact.
      this.#resolve(entry, project(entry));
      this.#byMessage.delete(messageId);
      this.#dropped += 1;
      return true;
    }
    return false;
  }

  #resolve(entry: Entry, disposition: MessageDisposition): void {
    const waiters = entry.waiters;
    if (waiters === undefined) return;
    entry.waiters = undefined;
    for (const waiter of waiters) waiter(disposition);
  }
}

function project(entry: Entry): MessageDisposition {
  return Object.freeze({
    messageId: entry.messageId,
    ...(entry.correlationId === undefined
      ? {}
      : { correlationId: entry.correlationId }),
    source: entry.source,
    destination: entry.destination,
    outcomes: Object.freeze([...entry.outcomes]),
    outstanding: entry.total === undefined
      ? 1
      : Math.max(0, entry.total - entry.outcomes.length),
    total: entry.total,
    settled: entry.settled,
  });
}
