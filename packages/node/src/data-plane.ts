import {
  encodeAgpPacket,
  type CorrelationId,
  type CreditGrant,
  type DataMessage,
  type DeliveryErrorBody,
  type DeliveryErrorCode,
  type EndpointName,
  type EndpointSource,
  type JsonObject,
  type MessageId,
  type NodeId,
  type ReturnToken,
} from "@agp/protocol";
import type {
  ExactSessionOwner,
  ForwardingEntrySnapshot,
  OperationsRevision,
  SelectedRouteSnapshot,
  SendReceipt,
} from "@agp/core";
import type { BreadcrumbStore } from "./breadcrumbs.js";
import type {
  BreadcrumbIngress,
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
import type { ReverseErrorEngine } from "./reverse-errors.js";
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
  readonly reverseCorrelationLifetimeMs: number;
  readonly routing: DataRoutingPort;
  readonly sessions: SessionLookupPort;
  readonly endpoints: EndpointRegistry;
  readonly handlers: HandlerLedger;
  readonly breadcrumbs: BreadcrumbStore;
  readonly reverseErrors: ReverseErrorEngine;
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
      await this.#options.reverseErrors.sendImmediateFailure(
        ingress,
        message,
        failure,
      );
    }
  }

  #sendInExecutor(
    sourceEndpoint: EndpointName,
    destination: EndpointName,
    payload: JsonObject,
    correlationId?: CorrelationId,
  ): DataSendReceipt {
    const binding = this.#options.endpoints.get(sourceEndpoint);
    const sourceRoute = this.#options.routing.selectedRoute(sourceEndpoint);
    if (
      binding === undefined
      || sourceRoute === undefined
      || sourceRoute.sourceKind !== "local"
      || sourceRoute.originNodeId !== this.#options.localNodeId
      || sourceRoute.nextHop.kind !== "local"
      || sourceRoute.nextHop.bindingId !== binding.bindingId
    ) {
      throw new DataPlaneFailure("SOURCE_NOT_OWNED");
    }

    const selected = this.#options.routing.selectedRoute(destination);
    const forwarding = this.#options.routing.forwardingEntry(destination);
    if (
      selected === undefined
      || forwarding === undefined
      || forwarding.selectedRouteId !== selected.routeId
    ) {
      throw new DataPlaneFailure("NO_ROUTE");
    }

    const messageId = this.#options.nextMessageId();
    const acceptedAt = this.#options.wallTime();
    const source = Object.freeze({
      endpoint: sourceEndpoint,
      originNodeId: this.#options.localNodeId,
    });

    if (forwarding.nextHop.kind === "local") {
      const destinationBinding = this.#options.endpoints.get(destination);
      if (
        destinationBinding === undefined
        || destinationBinding.bindingId !== forwarding.nextHop.bindingId
      ) {
        throw new DataPlaneFailure("NO_ROUTE");
      }
      const bytes = jsonBytes(payload);
      if (!this.#options.handlers.canReserve(bytes)) {
        throw new DataPlaneFailure("QUEUE_FULL");
      }
      const revision = this.#options.commit.commit({
        kind: "message.accepted",
        messageId,
        subjectId: destination,
      });
      const delivery = deliveryContext({
        messageId,
        ...(correlationId === undefined ? {} : { correlationId }),
        source,
        destination,
        receivedAt: acceptedAt,
        operationsRevision: revision,
      });
      this.#dispatch(destinationBinding, payload, delivery, bytes);
      return Object.freeze({
        messageId,
        ...(correlationId === undefined ? {} : { correlationId }),
        acceptedAt,
        operationsRevision: revision,
        selectedRouteId: selected.routeId,
        nextHop: forwarding.nextHop,
      });
    }

    const egress = this.#options.sessions.resolve(
      forwarding.nextHop.nodeId,
      forwarding.nextHop.owningSessionId,
    );
    if (egress === undefined || !egress.isLive() || !egress.returnTokens.usable) {
      if (egress !== undefined && !egress.returnTokens.usable) {
        this.#options.onTokenExhausted(egress);
      }
      throw new DataPlaneFailure("NEXT_HOP_UNAVAILABLE");
    }
    const hopLimit = Math.min(
      this.#options.defaultHopLimit,
      egress.maximumDataHopLimit,
    );
    // Read the ceiling once, so the encoded size cannot move under the
    // admission checks that follow it.
    const grant = egress.creditGrant;

    // Everything that does not need the encoded size is decided first, so the
    // packet is built once. This used to encode a preview with a placeholder
    // token to size the admission, then encode again with the real token and
    // assert the two matched. The assertion could not fail: the token is
    // fixed-width by contract, which is the whole reason a preview was legal.
    // So the second encode proved what the contract already guaranteed, and
    // charged a JSON serialisation and a schema validation per message to do
    // it. See `MX3`.
    if (!this.#options.routing.hasAckedSource(egress.owner, source)) {
      throw new DataPlaneFailure("SOURCE_NOT_ADVERTISED");
    }
    const epoch = this.#options.routing.sourceExportEpoch(egress.owner, source);
    if (epoch === undefined) {
      throw new DataPlaneFailure("SOURCE_NOT_ADVERTISED");
    }
    const allocation = egress.returnTokens.allocate();
    if (allocation.kind === "exhausted") {
      this.#options.onTokenExhausted(egress);
      throw new DataPlaneFailure("NEXT_HOP_UNAVAILABLE");
    }
    const message = makeDataMessage(
      messageId,
      source,
      destination,
      payload,
      allocation.token,
      hopLimit,
      grant,
      correlationId,
    );
    const encoded = encodeAgpPacket(message, egress.peerReceiveLimitBytes);
    if (!encoded.ok) {
      throw new DataPlaneFailure(
        encoded.reasonCode === "MESSAGE_TOO_LARGE"
          ? "MESSAGE_TOO_LARGE"
          : "NEXT_HOP_UNAVAILABLE",
      );
    }
    const retainedBytes = reverseRetainedBytes(encoded.utf8Bytes);
    if (
      !this.#options.breadcrumbs.canReserve(retainedBytes)
      || !egress.writer.canAdmitData(epoch, encoded.utf8Bytes)
    ) {
      throw new DataPlaneFailure("QUEUE_FULL");
    }
    const revision = this.#options.commit.commit({
      kind: "message.accepted",
      messageId,
      subjectId: destination,
    });
    this.#addBreadcrumb({
      message,
      ingress: { kind: "local" },
      egress,
      retainedBytes,
      revision,
    });
    const admitted = egress.writer.admitData({
      packet: encoded.bytes,
      encodedBytes: encoded.utf8Bytes,
      epoch,
    });
    if (!admitted.accepted) {
      throw new Error("writer reservation changed inside serialized admission");
    }
    return Object.freeze({
      messageId,
      ...(correlationId === undefined ? {} : { correlationId }),
      acceptedAt,
      operationsRevision: revision,
      selectedRouteId: selected.routeId,
      nextHop: forwarding.nextHop,
    });
  }

  #receiveInExecutor(
    ingress: DataSessionController,
    message: DataMessage,
  ): DeliveryErrorCode | undefined {
    const failure = this.#classifyInboundFailure(ingress, message);
    if (failure !== undefined) {
      this.#options.commit.commit({
        kind: "message.failed",
        messageId: message.id,
        subjectId: message.body.destination,
        code: failure,
      });
      return failure;
    }

    const selected = this.#options.routing.selectedRoute(
      message.body.destination,
    );
    const forwarding = this.#options.routing.forwardingEntry(
      message.body.destination,
    );
    if (selected === undefined || forwarding === undefined) {
      throw new Error("inbound classification admitted an absent route");
    }

    if (forwarding.nextHop.kind === "local") {
      const binding = this.#options.endpoints.get(message.body.destination);
      if (binding === undefined) {
        throw new Error("inbound classification admitted a stale binding");
      }
      const bytes = jsonBytes(message.body.payload);
      const revision = this.#options.commit.commit({
        kind: "message.received",
        messageId: message.id,
        subjectId: message.body.destination,
      });
      const delivery = deliveryContext({
        messageId: message.id,
        ...(message.body.correlationId === undefined
          ? {}
          : { correlationId: message.body.correlationId }),
        source: message.body.source,
        destination: message.body.destination,
        receivedAt: this.#options.wallTime(),
        ingressNodeId: ingress.remoteNodeId,
        ingressSessionId: ingress.owningSessionId,
        operationsRevision: revision,
      });
      this.#dispatch(binding, message.body.payload, delivery, bytes);
      return undefined;
    }

    const egress = this.#options.sessions.resolve(
      forwarding.nextHop.nodeId,
      forwarding.nextHop.owningSessionId,
    );
    if (egress === undefined) {
      throw new Error("inbound classification admitted a stale egress");
    }
    const source = message.body.source;
    const epoch = this.#options.routing.sourceExportEpoch(egress.owner, source);
    if (epoch === undefined) {
      throw new Error("inbound classification admitted an absent export epoch");
    }
    const hopLimit = Math.min(
      message.body.hopLimit - 1,
      egress.maximumDataHopLimit,
    );
    const allocation = egress.returnTokens.allocate();
    if (allocation.kind === "exhausted") {
      throw new Error("inbound classification admitted exhausted token domain");
    }
    const forwarded = makeDataMessage(
      message.id,
      source,
      message.body.destination,
      message.body.payload,
      allocation.token,
      hopLimit,
      egress.creditGrant,
      message.body.correlationId,
      message.extensions,
    );
    const encoded = encodeAgpPacket(forwarded, egress.peerReceiveLimitBytes);
    if (!encoded.ok) {
      throw new Error("inbound classification admitted an unencodable message");
    }
    const revision = this.#options.commit.commit({
      kind: "message.forwarded",
      messageId: message.id,
      subjectId: message.body.destination,
    });
    this.#addBreadcrumb({
      message: forwarded,
      ingress: {
        kind: "session",
        controller: ingress,
        nodeId: ingress.remoteNodeId,
        owningSessionId: ingress.owningSessionId,
        upstreamReturnToken: message.body.returnToken,
      },
      egress,
      retainedBytes: reverseRetainedBytes(encoded.utf8Bytes),
      revision,
    });
    const admitted = egress.writer.admitData({
      packet: encoded.bytes,
      encodedBytes: encoded.utf8Bytes,
      epoch,
    });
    if (!admitted.accepted) {
      throw new Error("writer reservation changed inside serialized admission");
    }
    return undefined;
  }

  #classifyInboundFailure(
    ingress: DataSessionController,
    message: DataMessage,
  ): DeliveryErrorCode | undefined {
    if (!this.#options.routing.feasibleSource(ingress.owner, message.body.source)) {
      return "SOURCE_NOT_AUTHORIZED";
    }
    const selected = this.#options.routing.selectedRoute(
      message.body.destination,
    );
    const forwarding = this.#options.routing.forwardingEntry(
      message.body.destination,
    );
    if (
      selected === undefined
      || forwarding === undefined
      || forwarding.selectedRouteId !== selected.routeId
    ) {
      return "NO_ROUTE";
    }
    if (forwarding.nextHop.kind === "local") {
      const binding = this.#options.endpoints.get(message.body.destination);
      if (
        binding === undefined
        || binding.bindingId !== forwarding.nextHop.bindingId
      ) {
        return "NO_ROUTE";
      }
      return this.#options.handlers.canReserve(jsonBytes(message.body.payload))
        ? undefined
        : "QUEUE_FULL";
    }
    if (!this.#options.transitEnabled) return "TRANSIT_DISABLED";
    if (message.body.hopLimit <= 1) return "HOP_LIMIT_EXCEEDED";

    const egress = this.#options.sessions.resolve(
      forwarding.nextHop.nodeId,
      forwarding.nextHop.owningSessionId,
    );
    if (
      egress === undefined
      || egress.identity === ingress.identity
      || !egress.isLive()
      || !egress.returnTokens.usable
    ) {
      if (egress !== undefined && !egress.returnTokens.usable) {
        this.#options.onTokenExhausted(egress);
      }
      return "NEXT_HOP_UNAVAILABLE";
    }
    const preview = makeDataMessage(
      message.id,
      message.body.source,
      message.body.destination,
      message.body.payload,
      "0000000000000000" as ReturnToken,
      Math.min(message.body.hopLimit - 1, egress.maximumDataHopLimit),
      egress.creditGrant,
      message.body.correlationId,
      message.extensions,
    );
    const encoded = encodeAgpPacket(preview, egress.peerReceiveLimitBytes);
    if (!encoded.ok) {
      return encoded.reasonCode === "MESSAGE_TOO_LARGE"
        ? "MESSAGE_TOO_LARGE"
        : "NEXT_HOP_UNAVAILABLE";
    }
    if (!this.#options.routing.hasAckedSource(egress.owner, message.body.source)) {
      return "SOURCE_NOT_ADVERTISED";
    }
    const epoch = this.#options.routing.sourceExportEpoch(
      egress.owner,
      message.body.source,
    );
    if (epoch === undefined) return "SOURCE_NOT_ADVERTISED";
    const retainedBytes = reverseRetainedBytes(encoded.utf8Bytes);
    if (
      !this.#options.breadcrumbs.canReserve(retainedBytes)
      || !egress.writer.canAdmitData(epoch, encoded.utf8Bytes)
    ) {
      return "QUEUE_FULL";
    }
    return undefined;
  }

  #addBreadcrumb(input: {
    readonly message: DataMessage;
    readonly ingress: BreadcrumbIngress;
    readonly egress: DataSessionController;
    readonly retainedBytes: number;
    readonly revision: OperationsRevision;
  }): void {
    const now = this.#options.monotonicNow();
    const expires = now + this.#options.reverseCorrelationLifetimeMs;
    const added = this.#options.breadcrumbs.add({
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
          + this.#options.reverseCorrelationLifetimeMs,
      ).toISOString(),
      expiresAtMonotonicMs: expires,
    }, input.retainedBytes);
    if (!added) {
      throw new Error("breadcrumb reservation changed inside serialized admission");
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

function jsonBytes(value: JsonObject): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function reverseRetainedBytes(frameBytes: number): number {
  return frameBytes + 256;
}
