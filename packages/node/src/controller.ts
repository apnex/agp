import type {
  MessageId,
  NodeId,
  ReturnToken,
  SessionId,
} from "@agp/protocol";

/**
 * Runtime authority for one exact transport/session incarnation. Equality is
 * object identity; public six-hex session IDs never substitute for it.
 */
export interface ExactController {
  readonly remoteNodeId: NodeId;
  readonly owningSessionId: SessionId;
  readonly identity: object;
  isLive(): boolean;
  writeControl(packet: Readonly<Uint8Array>): Promise<void>;
  terminate(reason: string): void;
}

export type BreadcrumbIngress =
  | { readonly kind: "local" }
  | {
      readonly kind: "session";
      readonly controller: ExactController;
      readonly nodeId: NodeId;
      readonly owningSessionId: SessionId;
      readonly upstreamReturnToken: ReturnToken;
    };

export interface BreadcrumbInput {
  readonly messageId: MessageId;
  readonly outboundReturnToken: ReturnToken;
  readonly sourceEndpoint: string;
  readonly sourceOriginNodeId: NodeId;
  readonly destination: string;
  readonly ingress: BreadcrumbIngress;
  readonly egress: ExactController;
  readonly admittedAtRevision: string;
  readonly expiresAt: string;
  readonly expiresAtMonotonicMs: number;
}
