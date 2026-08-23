import {
  AGP_V1_DELIVERY_ERROR_REASONS,
  type AgpMessage,
  type DataMessage,
  type DeliveryFailure,
  type DeliveryErrorCode,
  type DispositionMessage,
  destinationsOf,
  type LabelRange,
  type MessageId,
  type NodeId,
  type ReturnToken,
} from "@agp/protocol";
import type { Cancellable } from "@agp/core";
import type { LabelTable } from "./label-table.js";
import type { LabelBinding, ExactController } from "./controller.js";

/**
 * How long a batch may wait, and how large it may grow.
 *
 * Both bounds are needed. The interval alone would let acknowledgement latency
 * stay bounded only while a session is idle; the count alone would let a
 * trickle of traffic wait forever. Whichever is reached first sends the batch.
 * See D23.
 */
export interface DispositionBatchPolicy {
  readonly debounceMs: number;
  readonly maximumOutcomes: number;
  /**
   * The most outcomes this node will read out of one arriving batch.
   *
   * A range is a span rather than a list, so its cost to write is constant
   * while its cost to read is its width. Without this bound a peer sending one
   * range from zero to the largest label would occupy the node forever, having
   * spent fifty bytes to do it. The bound is checked before any of the batch is
   * applied, and a peer that exceeds it is answered as a protocol violation
   * rather than partially obeyed.
   */
  readonly maximumInboundOutcomes: number;
}

export const DEFAULT_DISPOSITION_BATCH: DispositionBatchPolicy = Object.freeze({
  debounceMs: 50,
  maximumOutcomes: 256,
  maximumInboundOutcomes: 4096,
});

export type DispositionOutcome =
  | { readonly kind: "delivered"; readonly token: ReturnToken }
  | { readonly kind: "failed"; readonly failure: DeliveryFailure };

export type SettledOutcome =
  | { readonly kind: "discarded"; readonly reason: "unreturnable" }
  | { readonly kind: "invalid-ref" }
  | {
    readonly kind: "delivered-local";
    readonly binding: LabelBinding;
    readonly outcome: DispositionOutcome;
    readonly destinations: number;
  }
  | { readonly kind: "relayed"; readonly ingress: ExactController };

export interface DispositionEngineOptions {
  readonly localNodeId: NodeId;
  readonly labelBindings: LabelTable;
  readonly batch: DispositionBatchPolicy;
  readonly monotonicNow: () => number;
  readonly nextMessageId: () => MessageId;
  readonly schedule: (delayMs: number, callback: () => void) => Cancellable;
  readonly encode: (message: AgpMessage) => Readonly<Uint8Array>;
  readonly publishLocal: (
    binding: LabelBinding,
    outcome: DispositionOutcome,
    destinations: number,
  ) => void;
  readonly onWriteFailure: (
    controller: ExactController,
    cause: unknown,
  ) => void;
}

interface PendingBatch {
  readonly controller: ExactController;
  readonly delivered: ReturnToken[];
  readonly failed: DeliveryFailure[];
  timer: Cancellable | undefined;
}

/**
 * Batched reverse-path disposition. This module deliberately has no RIB port:
 * an outcome finds its way back along the bindings the forward path left, and
 * never by a route lookup, because a lookup would let any node report on an
 * endpoint it was never authorised to reach. See D8 and D23.
 */
export class DispositionEngine {
  readonly #options: DispositionEngineOptions;
  readonly #pending = new Map<object, PendingBatch>();

  constructor(options: DispositionEngineOptions) {
    this.#options = options;
  }

  /**
   * Report that a message arriving on `ingress` reached its endpoint.
   *
   * This is the outcome AGP did not have. A binding used to be released by a
   * failure or by expiry and never by success, so a flow that never failed
   * filled the table and capped the node at capacity divided by the retention
   * window. See MX7.
   */
  reportDelivered(ingress: ExactController, token: ReturnToken): void {
    this.#enqueue(ingress, (batch) => batch.delivered.push(token));
  }

  reportFailed(ingress: ExactController, failure: DeliveryFailure): void {
    this.#enqueue(ingress, (batch) => batch.failed.push(failure));
  }

  /** Report a failure for a message that was refused before it was forwarded. */
  reportImmediateFailure(
    ingress: ExactController,
    message: DataMessage,
    code: DeliveryErrorCode,
  ): void {
    this.reportFailed(
      ingress,
      this.#localFailure(code, message.id, message.body.returnToken),
    );
  }

  /**
   * Report that every message still bound to a lost peer will never be answered.
   *
   * The node knows both facts at this moment: which bindings pointed at the
   * peer that went away, and which ingress each of them came from. Without this
   * the upstream waits out the expiry backstop for an answer that cannot
   * arrive, which is the stall D23 leaves to expiry only when nothing better is
   * known. Here something better is known.
   */
  reportNextHopLost(
    lost: readonly {
      readonly messageId: MessageId;
      readonly ingress: ExactController;
      readonly upstreamReturnToken: ReturnToken;
    }[],
  ): void {
    for (const binding of lost) {
      if (!binding.ingress.isLive()) continue;
      this.reportFailed(
        binding.ingress,
        this.#localFailure(
          "NEXT_HOP_UNAVAILABLE",
          binding.messageId,
          binding.upstreamReturnToken,
        ),
      );
    }
  }

  /**
   * Apply an arriving batch, outcome by outcome.
   *
   * Each outcome settles its own binding, so a batch that mixes deliveries and
   * failures needs no ordering rule between them.
   */
  receive(
    egress: ExactController,
    message: DispositionMessage,
  ): readonly SettledOutcome[] {
    if (!this.#withinInboundBound(message)) {
      egress.terminate("INVALID_MESSAGE");
      return Object.freeze([Object.freeze({ kind: "invalid-ref" } as const)]);
    }
    const settled: SettledOutcome[] = [];
    for (const range of message.body.delivered ?? []) {
      const destinations = destinationsOf(range);
      for (const token of expandLabelRange(range)) {
        settled.push(this.#settleDelivered(egress, token, destinations));
      }
    }
    for (const failure of message.body.failed ?? []) {
      settled.push(this.#settleFailed(egress, failure));
    }
    return Object.freeze(settled);
  }

  /**
   * Measure the batch before applying any of it.
   *
   * The widths are summed as big integers because a single range can span the
   * whole label domain, which no safe integer holds. Nothing is settled until
   * the whole batch is known to be within the bound, so a batch that exceeds it
   * has no partial effect.
   */
  #withinInboundBound(message: DispositionMessage): boolean {
    const limit = BigInt(this.#options.batch.maximumInboundOutcomes);
    let outcomes = BigInt((message.body.failed ?? []).length);
    if (outcomes > limit) return false;
    for (const range of message.body.delivered ?? []) {
      const width = labelRangeWidth(range);
      if (width === undefined) return false;
      outcomes += width;
      if (outcomes > limit) return false;
    }
    return true;
  }

  /** Send whatever is pending for one peer, now. */
  flush(controller: ExactController): void {
    const batch = this.#pending.get(controller.identity);
    if (batch === undefined) return;
    this.#send(batch);
  }

  flushAll(): void {
    for (const batch of [...this.#pending.values()]) this.#send(batch);
  }

  /** Drop what was pending for a peer that is gone; it cannot be told. */
  forgetController(controller: ExactController): void {
    const batch = this.#pending.get(controller.identity);
    if (batch === undefined) return;
    batch.timer?.cancel();
    this.#pending.delete(controller.identity);
  }

  #settleDelivered(
    egress: ExactController,
    token: ReturnToken,
    destinations: number,
  ): SettledOutcome {
    const lookup = this.#options.labelBindings.settleDelivered(
      egress,
      token,
      this.#options.monotonicNow(),
    );
    if (lookup.kind !== "consumed") {
      return Object.freeze({ kind: "discarded", reason: "unreturnable" });
    }
    if (lookup.labelBinding.ingress.kind === "local") {
      const outcome = Object.freeze({
        kind: "delivered",
        token,
      } as const);
      this.#options.publishLocal(lookup.labelBinding, outcome, destinations);
      return Object.freeze({
        kind: "delivered-local",
        binding: lookup.labelBinding,
        outcome,
        destinations,
      });
    }
    const ingress = lookup.labelBinding.ingress.controller;
    if (!ingress.isLive()) {
      return Object.freeze({ kind: "discarded", reason: "unreturnable" });
    }
    // The label is translated to the one the upstream hop knows. Relaying the
    // downstream label instead would name a binding that peer never made.
    this.reportDelivered(
      ingress,
      lookup.labelBinding.ingress.upstreamReturnToken,
    );
    return Object.freeze({ kind: "relayed", ingress });
  }

  #settleFailed(
    egress: ExactController,
    failure: DeliveryFailure,
  ): SettledOutcome {
    const lookup = this.#options.labelBindings.consume(
      egress,
      failure.returnToken,
      failure.refId,
      this.#options.monotonicNow(),
    );
    if (lookup.kind === "unreturnable") {
      return Object.freeze({ kind: "discarded", reason: "unreturnable" });
    }
    if (lookup.kind === "ref-mismatch") {
      egress.terminate("INVALID_MESSAGE");
      return Object.freeze({ kind: "invalid-ref" });
    }
    if (lookup.labelBinding.ingress.kind === "local") {
      const outcome = Object.freeze({ kind: "failed", failure } as const);
      this.#options.publishLocal(
        lookup.labelBinding,
        outcome,
        destinationsOf(failure),
      );
      return Object.freeze({
        kind: "delivered-local",
        binding: lookup.labelBinding,
        outcome,
        destinations: destinationsOf(failure),
      });
    }
    const ingress = lookup.labelBinding.ingress.controller;
    if (!ingress.isLive()) {
      return Object.freeze({ kind: "discarded", reason: "unreturnable" });
    }
    this.reportFailed(
      ingress,
      Object.freeze({
        ...failure,
        returnToken: lookup.labelBinding.ingress.upstreamReturnToken,
      }) as DeliveryFailure,
    );
    return Object.freeze({ kind: "relayed", ingress });
  }

  #enqueue(
    controller: ExactController,
    add: (batch: PendingBatch) => void,
  ): void {
    let batch = this.#pending.get(controller.identity);
    if (batch === undefined) {
      batch = { controller, delivered: [], failed: [], timer: undefined };
      this.#pending.set(controller.identity, batch);
    }
    add(batch);
    const outcomes = batch.delivered.length + batch.failed.length;
    if (outcomes >= this.#options.batch.maximumOutcomes) {
      this.#send(batch);
      return;
    }
    if (batch.timer === undefined) {
      const pending = batch;
      batch.timer = this.#options.schedule(
        this.#options.batch.debounceMs,
        () => {
          pending.timer = undefined;
          this.#send(pending);
        },
      );
    }
  }

  #send(batch: PendingBatch): void {
    batch.timer?.cancel();
    batch.timer = undefined;
    this.#pending.delete(batch.controller.identity);
    if (batch.delivered.length === 0 && batch.failed.length === 0) return;
    if (!batch.controller.isLive()) return;

    const delivered = compressLabels(batch.delivered);
    const message: DispositionMessage = Object.freeze({
      agp: 1,
      plane: "control",
      type: "disposition",
      id: this.#options.nextMessageId(),
      body: Object.freeze({
        ...(delivered.length === 0 ? {} : { delivered }),
        ...(batch.failed.length === 0
          ? {}
          : { failed: Object.freeze([...batch.failed]) }),
      }),
    });
    try {
      void batch.controller.writeControl(this.#options.encode(message));
    } catch (cause) {
      this.#options.onWriteFailure(batch.controller, cause);
    }
  }

  #localFailure(
    code: DeliveryErrorCode,
    refId: MessageId,
    returnToken: ReturnToken,
  ): DeliveryFailure {
    return Object.freeze({
      code,
      refId,
      returnToken,
      failedAtNodeId: this.#options.localNodeId,
      reason: AGP_V1_DELIVERY_ERROR_REASONS[code],
    }) as DeliveryFailure;
  }
}

/**
 * Compress labels into inclusive runs.
 *
 * Labels are allocated monotonically per session, so a batch of them is
 * usually contiguous and this collapses to one range. A scattered batch
 * degrades to one range per label, which is exact rather than wrong.
 */
export function compressLabels(
  tokens: readonly ReturnToken[],
): readonly LabelRange[] {
  if (tokens.length === 0) return Object.freeze([]);
  // Fixed-width lowercase hex sorts lexically in exactly unsigned numeric
  // order, so no parse is needed to order them. See the ReturnToken contract.
  const sorted = [...tokens].sort();
  const ranges: LabelRange[] = [];
  let from = sorted[0] as ReturnToken;
  let to = from;
  for (let index = 1; index < sorted.length; index += 1) {
    const token = sorted[index] as ReturnToken;
    if (token === to) continue;
    if (isSuccessor(to, token)) {
      to = token;
      continue;
    }
    ranges.push(Object.freeze({ from, to }));
    from = token;
    to = token;
  }
  ranges.push(Object.freeze({ from, to }));
  return Object.freeze(ranges);
}

/**
 * How many labels a range names, or `undefined` if it names none.
 *
 * A range whose end precedes its start is not an empty range but a malformed
 * one, and is reported as such rather than silently skipped.
 */
export function labelRangeWidth(range: LabelRange): bigint | undefined {
  const first = BigInt(`0x${range.from}`);
  const last = BigInt(`0x${range.to}`);
  if (last < first) return undefined;
  return last - first + 1n;
}

/**
 * Materialise the labels a range names.
 *
 * Only call this after the batch has been measured against the inbound bound:
 * the width of a range is chosen by the peer, and this allocates one token per
 * label in it.
 */
export function expandLabelRange(range: LabelRange): readonly ReturnToken[] {
  const width = labelRangeWidth(range);
  if (width === undefined) return Object.freeze([]);
  const first = BigInt(`0x${range.from}`);
  const tokens: ReturnToken[] = [];
  for (let offset = 0n; offset < width; offset += 1n) {
    tokens.push((first + offset).toString(16).padStart(16, "0") as ReturnToken);
  }
  return Object.freeze(tokens);
}

function isSuccessor(current: ReturnToken, candidate: ReturnToken): boolean {
  return BigInt(`0x${current}`) + 1n === BigInt(`0x${candidate}`);
}
