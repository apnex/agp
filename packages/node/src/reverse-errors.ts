import {
  AGP_V1_DELIVERY_ERROR_REASONS,
  type AgpMessage,
  type DataMessage,
  type DeliveryErrorBody,
  type DeliveryErrorCode,
  type ErrorMessage,
  type Extensions,
  type MessageId,
  type NodeId,
} from "@agp/protocol";
import type { BreadcrumbStore } from "./breadcrumbs.js";
import type { ExactController } from "./controller.js";

export type ReturnedErrorOutcome =
  | { readonly kind: "discarded"; readonly reason: "unreturnable" }
  | { readonly kind: "invalid-ref" }
  | { readonly kind: "delivered-local"; readonly error: DeliveryErrorBody }
  | { readonly kind: "relayed"; readonly ingress: ExactController };

export interface ReverseErrorEngineOptions {
  readonly localNodeId: NodeId;
  readonly breadcrumbs: BreadcrumbStore;
  readonly monotonicNow: () => number;
  readonly nextMessageId: () => MessageId;
  readonly encode: (message: AgpMessage) => Readonly<Uint8Array>;
  readonly publishLocal: (error: DeliveryErrorBody) => void;
}

/**
 * Correlated reverse delivery. This module deliberately has no RIB port.
 */
export class ReverseErrorEngine {
  readonly #options: ReverseErrorEngineOptions;

  constructor(options: ReverseErrorEngineOptions) {
    this.#options = options;
  }

  async sendImmediateFailure(
    ingress: ExactController,
    message: DataMessage,
    code: DeliveryErrorCode,
  ): Promise<void> {
    const error = this.#localError(
      code,
      message.id,
      message.body.returnToken,
    );
    await ingress.writeControl(this.#options.encode(error));
  }

  async receive(
    egress: ExactController,
    message: ErrorMessage,
  ): Promise<ReturnedErrorOutcome> {
    const lookup = this.#options.breadcrumbs.consume(
      egress,
      message.body.returnToken,
      message.body.refId,
      this.#options.monotonicNow(),
    );
    if (lookup.kind === "unreturnable") {
      return Object.freeze({ kind: "discarded", reason: "unreturnable" });
    }
    if (lookup.kind === "ref-mismatch") {
      egress.terminate("INVALID_MESSAGE");
      return Object.freeze({ kind: "invalid-ref" });
    }

    if (lookup.breadcrumb.ingress.kind === "local") {
      this.#options.publishLocal(message.body);
      return Object.freeze({
        kind: "delivered-local",
        error: message.body,
      });
    }

    const ingress = lookup.breadcrumb.ingress.controller;
    if (!ingress.isLive()) {
      return Object.freeze({ kind: "discarded", reason: "unreturnable" });
    }
    const relay: ErrorMessage = Object.freeze({
      agp: 1,
      plane: "control",
      type: "error",
      id: this.#options.nextMessageId(),
      body: Object.freeze({
        ...message.body,
        returnToken: lookup.breadcrumb.ingress.upstreamReturnToken,
      }),
      ...(message.extensions === undefined
        ? {}
        : { extensions: message.extensions as Extensions }),
    });
    await ingress.writeControl(this.#options.encode(relay));
    return Object.freeze({ kind: "relayed", ingress });
  }

  createControllerLossFailure(
    refId: MessageId,
    returnToken: DeliveryErrorBody["returnToken"],
  ): ErrorMessage {
    return this.#localError("NEXT_HOP_UNAVAILABLE", refId, returnToken);
  }

  #localError(
    code: DeliveryErrorCode,
    refId: MessageId,
    returnToken: DeliveryErrorBody["returnToken"],
  ): ErrorMessage {
    return Object.freeze({
      agp: 1,
      plane: "control",
      type: "error",
      id: this.#options.nextMessageId(),
      body: Object.freeze({
        code,
        refId,
        returnToken,
        failedAtNodeId: this.#options.localNodeId,
        reason: AGP_V1_DELIVERY_ERROR_REASONS[code],
      }) as DeliveryErrorBody,
    });
  }
}
