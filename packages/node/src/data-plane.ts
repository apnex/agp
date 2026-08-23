import {
  encodeAgpPacket,
  type ReturnToken,
  type CorrelationId,
  type CreditGrant,
  type DataMessage,
  type DeliveryFailure,
  type DeliveryErrorCode,
  type EndpointName,
  type EndpointSource,
  type JsonObject,
  type MessageId,
  type NodeId,
} from "@agp/protocol";
import type {
  ExactSessionOwner,
  ForwardingEntrySnapshot,
  OperationsRevision,
  SelectedRouteSnapshot,
  SendReceipt,
} from "@agp/core";
import type { LabelTable } from "./label-table.js";
import type {
  LabelBindingIngress,
  ExactController,
} from "./controller.js";
import type {
  EndpointDeliveryContext,
  EndpointRegistry,
} from "./endpoint-registry.js";
import type { HandlerLedger } from "./handler-ledger.js";
import type {
  ReturnTokenAllocatorPort,
} from "./return-token.js";
import type { DispositionEngine } from "./dispositions.js";
import type { SerializedExecutor } from "./serialized-executor.js";
import type { SessionWriter } from "./session-writer.js";

export interface DataSessionController extends ExactController {
  readonly owner: ExactSessionOwner;
  readonly writer: SessionWriter;
  readonly returnTokens: ReturnTokenAllocatorPort;
  readonly peerReceiveLimitBytes: number;
  readonly maximumDataHopLimit: number;
  /** This node's current ceiling, to ride out on the data it is already sending. */
  readonly creditGrant: CreditGrant | undefined;
}

export interface DataRoutingPort {
  selectedRoute(endpoint: EndpointName): SelectedRouteSnapshot | undefined;
  forwardingEntry(endpoint: EndpointName): ForwardingEntrySnapshot | undefined;
  feasibleSource(
    ingress: ExactSessionOwner,
    source: EndpointSource,
  ): boolean;
  hasAckedSource(
    egress: ExactSessionOwner,
    source: EndpointSource,
  ): boolean;
  sourceExportEpoch(
    egress: ExactSessionOwner,
    source: EndpointSource,
  ): string | undefined;
}

export interface SessionLookupPort {
  resolve(
    remoteNodeId: NodeId,
    localSessionId: string,
  ): DataSessionController | undefined;
}

export interface DataPlaneCommitPort {
  commit(input: {
    readonly kind:
      | "message.accepted"
      | "message.received"
      | "message.forwarded"
      | "message.failed"
      | "handler.completed"
      | "handler.failed";
    readonly messageId: MessageId;
    readonly subjectId: string;
    readonly code?: DeliveryErrorCode;
  }): OperationsRevision;
}

export interface DataPlaneOptions {
  readonly localNodeId: NodeId;
  readonly transitEnabled: boolean;
  readonly defaultHopLimit: number;
  readonly labelBindingLifetimeMs: number;
  readonly routing: DataRoutingPort;
  readonly sessions: SessionLookupPort;
  readonly endpoints: EndpointRegistry;
  readonly handlers: HandlerLedger;
  readonly labelBindings: LabelTable;
  readonly dispositions: DispositionEngine;
  readonly executor: SerializedExecutor;
  readonly nextMessageId: () => MessageId;
  readonly wallTime: () => string;
  readonly monotonicNow: () => number;
  readonly commit: DataPlaneCommitPort;
  readonly onTokenExhausted: (controller: DataSessionController) => void;
}

export type DataSendReceipt = SendReceipt;

export type LocalSendFailure =
  | "SOURCE_NOT_OWNED"
  | "NO_ROUTE"
  | "SOURCE_NOT_ADVERTISED"
  | "NEXT_HOP_UNAVAILABLE"
  | "MESSAGE_TOO_LARGE"
  | "QUEUE_FULL";

export class DataPlaneFailure extends Error {
  readonly code: LocalSendFailure;

  constructor(code: LocalSendFailure) {
    super(code);
    this.name = "DataPlaneFailure";
    this.code = code;
  }
}

/** Why a message may not be forwarded, across both admission paths. */
export type ForwardingRefusal =
  | "SOURCE_NOT_OWNED"
  | "SOURCE_NOT_AUTHORIZED"
  | "NO_ROUTE"
  | "TRANSIT_DISABLED"
  | "HOP_LIMIT_EXCEEDED"
  | "NEXT_HOP_UNAVAILABLE"
  | "SOURCE_NOT_ADVERTISED"
  | "MESSAGE_TOO_LARGE"
  | "QUEUE_FULL";

/**
 * Where a message came from, which is the only thing the two admission paths
 * genuinely disagree about.
 *
 * A locally originated message must prove it owns its source. One arriving on
 * a session must prove the source is feasible from that ingress, must find
 * transit enabled, must have hops left, and must not leave by the session it
 * arrived on.
 */
export type ForwardingArrival =
  | { readonly kind: "local"; readonly sourceEndpoint: EndpointName }
  | {
      readonly kind: "session";
      readonly ingress: DataSessionController;
      readonly hopLimit: number;
    };

/** What the resolver decided, before any message is built or encoded. */
export type ForwardingDecision =
  | { readonly kind: "refuse"; readonly code: ForwardingRefusal }
  | {
      readonly kind: "local";
      readonly binding: NonNullable<ReturnType<EndpointRegistry["get"]>>;
      readonly bytes: number;
      readonly selectedRouteId: string;
      readonly nextHop: ForwardingEntrySnapshot["nextHop"];
    }
  | {
      readonly kind: "session";
      readonly egress: DataSessionController;
      readonly epoch: string;
      readonly message: DataMessage;
      readonly packet: Readonly<Uint8Array>;
      readonly encodedBytes: number;
      readonly retainedBytes: number;
      readonly selectedRouteId: string;
      readonly nextHop: ForwardingEntrySnapshot["nextHop"];
    };

/**
 * The sole local/transit data admission path. Every decision is made inside
 * the node executor against the same routing revision.
 */
export class DataPlane {
  readonly #options: DataPlaneOptions;

  constructor(options: DataPlaneOptions) {
    this.#options = options;
  }

  send(
    source: EndpointName,
    destination: EndpointName,
    payload: JsonObject,
    correlationId?: CorrelationId,
  ): Promise<DataSendReceipt> {
    return this.#options.executor.run(() =>
      this.#sendInExecutor(source, destination, payload, correlationId));
  }

  async receive(
    ingress: DataSessionController,
    message: DataMessage,
  ): Promise<void> {
    const failure = await this.#options.executor.run(() =>
      this.#receiveInExecutor(ingress, message));
    if (failure !== undefined) {
      this.#options.dispositions.reportImmediateFailure(
        ingress,
        message,
        failure,
      );
    }
  }

  /**
   * Resolve one forwarding decision, for both admission paths.
   *
   * This decision used to be made three times: once when a local message was
   * admitted, once when an inbound message was classified, and again when the
   * forward it authorised was executed. Route resolution, the local against
   * session branch, the hop limit, the source export and the capacity checks
   * all appeared more than once, and every future destination mode or
   * disposition would have had to be written into each of them.
   *
   * Everything that depends on the encoded size stays with the caller,
   * because that is where the message is built and the two paths build
   * different messages. Everything before it is here.
   */
  #resolveForwarding(input: {
    readonly source: EndpointSource;
    readonly destination: EndpointName;
    readonly payload: JsonObject;
    readonly arrival: ForwardingArrival;
    readonly build: (context: {
      readonly egress: DataSessionController;
      readonly hopLimit: number;
      readonly token: ReturnToken;
    }) => DataMessage;
  }): ForwardingDecision {
    const refuse = (code: ForwardingRefusal): ForwardingDecision =>
      Object.freeze({ kind: "refuse", code });

    if (input.arrival.kind === "local") {
      const binding = this.#options.endpoints.get(input.arrival.sourceEndpoint);
      const sourceRoute = this.#options.routing.selectedRoute(
        input.arrival.sourceEndpoint,
      );
      if (
        binding === undefined
        || sourceRoute === undefined
        || sourceRoute.sourceKind !== "local"
        || sourceRoute.originNodeId !== this.#options.localNodeId
        || sourceRoute.nextHop.kind !== "local"
        || sourceRoute.nextHop.bindingId !== binding.bindingId
      ) {
        return refuse("SOURCE_NOT_OWNED");
      }
    } else if (
      !this.#options.routing.feasibleSource(
        input.arrival.ingress.owner,
        input.source,
      )
    ) {
      return refuse("SOURCE_NOT_AUTHORIZED");
    }

    const selected = this.#options.routing.selectedRoute(input.destination);
    const forwarding = this.#options.routing.forwardingEntry(input.destination);
    if (
      selected === undefined
      || forwarding === undefined
      || forwarding.selectedRouteId !== selected.routeId
    ) {
      return refuse("NO_ROUTE");
    }

    if (forwarding.nextHop.kind === "local") {
      const binding = this.#options.endpoints.get(input.destination);
      if (
        binding === undefined
        || binding.bindingId !== forwarding.nextHop.bindingId
      ) {
        return refuse("NO_ROUTE");
      }
      const bytes = jsonBytes(input.payload);
      if (!this.#options.handlers.canReserve(bytes)) {
        return refuse("QUEUE_FULL");
      }
      return Object.freeze({
        kind: "local",
        binding,
        bytes,
        selectedRouteId: selected.routeId,
        nextHop: forwarding.nextHop,
      });
    }

    if (input.arrival.kind === "session") {
      if (!this.#options.transitEnabled) return refuse("TRANSIT_DISABLED");
      if (input.arrival.hopLimit <= 1) return refuse("HOP_LIMIT_EXCEEDED");
    }

    const egress = this.#options.sessions.resolve(
      forwarding.nextHop.nodeId,
      forwarding.nextHop.owningSessionId,
    );
    if (
      egress === undefined
      || (input.arrival.kind === "session"
        && egress.identity === input.arrival.ingress.identity)
      || !egress.isLive()
      || !egress.returnTokens.usable
    ) {
      if (egress !== undefined && !egress.returnTokens.usable) {
        this.#options.onTokenExhausted(egress);
      }
      return refuse("NEXT_HOP_UNAVAILABLE");
    }

    const hopLimit = input.arrival.kind === "local"
      ? Math.min(this.#options.defaultHopLimit, egress.maximumDataHopLimit)
      : Math.min(input.arrival.hopLimit - 1, egress.maximumDataHopLimit);

    const allocation = egress.returnTokens.allocate();
    if (allocation.kind === "exhausted") {
      this.#options.onTokenExhausted(egress);
      return refuse("NEXT_HOP_UNAVAILABLE");
    }

    // Size is decided before source export, and that order is specified
    // rather than incidental: `data-failure-precedence` asserts that an
    // oversized frame beats a missing export when both are true.
    const message = input.build({ egress, hopLimit, token: allocation.token });
    const encoded = encodeAgpPacket(message, egress.peerReceiveLimitBytes);
    if (!encoded.ok) {
      return refuse(
        encoded.reasonCode === "MESSAGE_TOO_LARGE"
          ? "MESSAGE_TOO_LARGE"
          : "NEXT_HOP_UNAVAILABLE",
      );
    }

    if (!this.#options.routing.hasAckedSource(egress.owner, input.source)) {
      return refuse("SOURCE_NOT_ADVERTISED");
    }
    const epoch = this.#options.routing.sourceExportEpoch(
      egress.owner,
      input.source,
    );
    if (epoch === undefined) return refuse("SOURCE_NOT_ADVERTISED");

    const retainedBytes = reverseRetainedBytes(encoded.utf8Bytes);
    if (
      !this.#options.labelBindings.canReserve(retainedBytes)
      || !egress.writer.canAdmitData(epoch, encoded.utf8Bytes)
    ) {
      return refuse("QUEUE_FULL");
    }

    return Object.freeze({
      kind: "session",
      egress,
      epoch,
      message,
      packet: encoded.bytes,
      encodedBytes: encoded.utf8Bytes,
      retainedBytes,
      selectedRouteId: selected.routeId,
      nextHop: forwarding.nextHop,
    });
  }

  #sendInExecutor(
    sourceEndpoint: EndpointName,
    destination: EndpointName,
    payload: JsonObject,
    correlationId?: CorrelationId,
  ): DataSendReceipt {
    const source = Object.freeze({
      endpoint: sourceEndpoint,
      originNodeId: this.#options.localNodeId,
    });
    const messageId = this.#options.nextMessageId();
    const decision = this.#resolveForwarding({
      source,
      destination,
      payload,
      arrival: { kind: "local", sourceEndpoint },
      build: ({ egress, hopLimit, token }) => makeDataMessage(
        messageId,
        source,
        destination,
        payload,
        token,
        hopLimit,
        egress.creditGrant,
        correlationId,
      ),
    });
    if (decision.kind === "refuse") {
      throw new DataPlaneFailure(asLocalFailure(decision.code));
    }

    const acceptedAt = this.#options.wallTime();
    const revision = this.#options.commit.commit({
      kind: "message.accepted",
      messageId,
      subjectId: destination,
    });
    if (decision.kind === "local") {
      this.#dispatch(
        decision.binding,
        payload,
        deliveryContext({
          messageId,
          ...(correlationId === undefined ? {} : { correlationId }),
          source,
          destination,
          receivedAt: acceptedAt,
          operationsRevision: revision,
        }),
        decision.bytes,
      );
    } else {
      this.#admitToEgress(decision, { kind: "local" }, revision);
    }
    return Object.freeze({
      messageId,
      ...(correlationId === undefined ? {} : { correlationId }),
      acceptedAt,
      operationsRevision: revision,
      selectedRouteId: decision.selectedRouteId,
      nextHop: decision.nextHop,
    });
  }

  /** Retain the reverse path and hand the packet to the ordered writer. */
  #admitToEgress(
    decision: Extract<ForwardingDecision, { kind: "session" }>,
    ingress: LabelBindingIngress,
    revision: OperationsRevision,
  ): void {
    this.#addLabelBinding({
      message: decision.message,
      ingress,
      egress: decision.egress,
      retainedBytes: decision.retainedBytes,
      revision,
    });
    const admitted = decision.egress.writer.admitData({
      packet: decision.packet,
      encodedBytes: decision.encodedBytes,
      epoch: decision.epoch,
    });
    if (!admitted.accepted) {
      throw new Error("writer reservation changed inside serialized admission");
    }
  }

  #receiveInExecutor(
    ingress: DataSessionController,
    message: DataMessage,
  ): DeliveryErrorCode | undefined {
    const source = message.body.source;
    const destination = message.body.destination;

    const decision = this.#resolveForwarding({
      source,
      destination,
      payload: message.body.payload,
      arrival: { kind: "session", ingress, hopLimit: message.body.hopLimit },
      // Built once. Classification used to encode a preview with a
      // placeholder token to size the admission and the forward encoded
      // again with the real one, which proved what the fixed-width token
      // contract already guaranteed.
      build: ({ egress, hopLimit, token }) => makeDataMessage(
        message.id,
        source,
        destination,
        message.body.payload,
        token,
        hopLimit,
        egress.creditGrant,
        message.body.correlationId,
        message.extensions,
      ),
    });

    if (decision.kind === "refuse") {
      const code = asDeliveryError(decision.code);
      this.#options.commit.commit({
        kind: "message.failed",
        messageId: message.id,
        subjectId: destination,
        code,
      });
      return code;
    }

    if (decision.kind === "local") {
      const revision = this.#options.commit.commit({
        kind: "message.received",
        messageId: message.id,
        subjectId: destination,
      });
      this.#dispatch(
        decision.binding,
        message.body.payload,
        deliveryContext({
          messageId: message.id,
          ...(message.body.correlationId === undefined
            ? {}
            : { correlationId: message.body.correlationId }),
          source,
          destination,
          receivedAt: this.#options.wallTime(),
          ingressNodeId: ingress.remoteNodeId,
          ingressSessionId: ingress.owningSessionId,
          operationsRevision: revision,
        }),
        decision.bytes,
      );
      // The message reached its endpoint, so the hop it came from may release
      // the binding it is holding for it. This is the outcome AGP never had:
      // without it a binding is released by a failure or by expiry and never
      // by success, so a flow that never fails fills the table and caps the
      // node. Reported here rather than after the handler runs, because this
      // layer promises delivery to the endpoint and not processing by it.
      // See D23 and MX7.
      this.#options.dispositions.reportDelivered(
        ingress,
        message.body.returnToken,
      );
      return undefined;
    }

    const revision = this.#options.commit.commit({
      kind: "message.forwarded",
      messageId: message.id,
      subjectId: destination,
    });
    this.#admitToEgress(decision, {
      kind: "session",
      controller: ingress,
      nodeId: ingress.remoteNodeId,
      owningSessionId: ingress.owningSessionId,
      upstreamReturnToken: message.body.returnToken,
    }, revision);
    return undefined;
  }

  #addLabelBinding(input: {
    readonly message: DataMessage;
    readonly ingress: LabelBindingIngress;
    readonly egress: DataSessionController;
    readonly retainedBytes: number;
    readonly revision: OperationsRevision;
  }): void {
    const now = this.#options.monotonicNow();
    const expires = now + this.#options.labelBindingLifetimeMs;
    const added = this.#options.labelBindings.add({
      messageId: input.message.id,
      outboundReturnToken: input.message.body.returnToken,
      sourceEndpoint: input.message.body.source.endpoint,
      sourceOriginNodeId: input.message.body.source.originNodeId,
      destination: input.message.body.destination,
      ingress: input.ingress,
      egress: input.egress,
      admittedAtRevision: input.revision,
      expiresAt: new Date(
        Date.parse(this.#options.wallTime())
          + this.#options.labelBindingLifetimeMs,
      ).toISOString(),
      expiresAtMonotonicMs: expires,
    }, input.retainedBytes);
    if (!added) {
      throw new Error("labelBinding reservation changed inside serialized admission");
    }
  }

  #dispatch(
    binding: NonNullable<ReturnType<EndpointRegistry["get"]>>,
    payload: JsonObject,
    delivery: EndpointDeliveryContext,
    bytes: number,
  ): void {
    const dispatched = this.#options.handlers.dispatch(
      binding,
      payload,
      Object.freeze({
        delivery,
        signal: binding.controller.signal,
      }),
      bytes,
      (outcome) => {
        // Handler settlement is asynchronous. Re-enter the node's sole
        // executor and retain authority only while this exact binding
        // generation is current. Binding close and terminal stop revoke the
        // generation before aborting its signal, so a late promise cannot
        // advance canonical operations after authority has moved on.
        void this.#options.executor.run(() => {
          if (!this.#options.endpoints.isCurrent(binding)) return;
          this.#options.commit.commit({
            kind: outcome === "completed"
              ? "handler.completed"
              : "handler.failed",
            messageId: delivery.messageId as MessageId,
            subjectId: delivery.destination,
          });
        });
      },
    );
    if (!dispatched) throw new Error("handler reservation changed before dispatch");
  }
}

function makeDataMessage(
  id: MessageId,
  source: EndpointSource,
  destination: EndpointName,
  payload: JsonObject,
  returnToken: DataMessage["body"]["returnToken"],
  hopLimit: number,
  credit: CreditGrant | undefined,
  correlationId?: CorrelationId,
  extensions?: DataMessage["extensions"],
): DataMessage {
  return Object.freeze({
    agp: 1,
    plane: "data",
    type: "message",
    id,
    ...(credit === undefined ? {} : { credit }),
    body: Object.freeze({
      source,
      destination,
      ...(correlationId === undefined ? {} : { correlationId }),
      returnToken,
      hopLimit,
      payload,
    }),
    ...(extensions === undefined ? {} : { extensions }),
  });
}

function deliveryContext(input: {
  readonly messageId: MessageId;
  readonly correlationId?: CorrelationId;
  readonly source: EndpointSource;
  readonly destination: EndpointName;
  readonly receivedAt: string;
  readonly ingressNodeId?: NodeId;
  readonly ingressSessionId?: import("@agp/protocol").SessionId;
  readonly operationsRevision: string;
}): EndpointDeliveryContext {
  return Object.freeze({
    messageId: input.messageId,
    ...(input.correlationId === undefined
      ? {}
      : { correlationId: input.correlationId }),
    source: input.source,
    destination: input.destination,
    receivedAt: input.receivedAt,
    ...(input.ingressNodeId === undefined
      ? {}
      : { ingressNodeId: input.ingressNodeId }),
    ...(input.ingressSessionId === undefined
      ? {}
      : { ingressSessionId: input.ingressSessionId }),
    operationsRevision: input.operationsRevision,
  });
}

/**
 * Narrow a refusal to the codes a local send can produce.
 *
 * The transit-only refusals cannot arise from local origination: nothing
 * arrived on a session, so there is no feasibility check, no transit gate and
 * no hop limit to exhaust.
 */
function asLocalFailure(code: ForwardingRefusal): LocalSendFailure {
  switch (code) {
    case "SOURCE_NOT_AUTHORIZED":
    case "TRANSIT_DISABLED":
    case "HOP_LIMIT_EXCEEDED":
      throw new Error(`local admission cannot refuse with ${code}`);
    default:
      return code;
  }
}

/**
 * Narrow a refusal to the codes a delivery error can carry.
 *
 * `SOURCE_NOT_OWNED` is the mirror case: it is asked only of a locally
 * originated message, which by definition did not arrive on a session.
 */
function asDeliveryError(code: ForwardingRefusal): DeliveryErrorCode {
  if (code === "SOURCE_NOT_OWNED") {
    throw new Error("transit admission cannot refuse with SOURCE_NOT_OWNED");
  }
  return code;
}

function jsonBytes(value: JsonObject): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function reverseRetainedBytes(frameBytes: number): number {
  return frameBytes + 256;
}
