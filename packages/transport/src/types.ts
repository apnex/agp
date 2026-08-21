import type {
  TransportAbortIntent,
  TransportAcquisitionOptions,
  TransportChannelLimits,
  TransportCloseIntent,
  TransportDiagnostic,
  TransportInputRejected,
  TransportListenerPublication,
  TransportListenerTerminal,
  TransportListenOptions,
  SecretIdentity,
  TransportPeerEvidence,
  TransportRef,
  TransportTerminal,
} from "./types.generated.js";

export interface TransportPacket {
  readonly bytes: Readonly<Uint8Array>;
}

export type TransportRead =
  | { readonly kind: "packet"; readonly packet: TransportPacket }
  | TransportInputRejected
  | { readonly kind: "terminal"; readonly terminal: TransportTerminal };

export interface TransportDiagnosticSinkPort {
  emit(diagnostic: TransportDiagnostic, cause?: unknown): void;
}

export interface TransportChannelPort {
  readonly peerEvidence: TransportPeerEvidence;
  send(packet: TransportPacket, signal: AbortSignal): Promise<void>;
  read(signal: AbortSignal): Promise<TransportRead>;
  close(
    intent: TransportCloseIntent,
    signal: AbortSignal,
  ): Promise<TransportTerminal>;
  abort(intent: TransportAbortIntent): void;
}

export interface TransportAcceptedChannel {
  readonly channel: TransportChannelPort;
}

export interface TransportAcceptCallbacks {
  accept(value: TransportAcceptedChannel): void;
  capacityRejected(
    kind: "pending-acquisition" | "active-channel",
  ): void;
}

export interface TransportListenerPort {
  readonly publication: TransportListenerPublication;
  waitTerminal(signal: AbortSignal): Promise<TransportListenerTerminal>;
  close(signal: AbortSignal): Promise<TransportListenerTerminal>;
  abort(intent: TransportAbortIntent): void;
}

export interface TransportListenCapability {
  listen(
    options: TransportListenOptions,
    callbacks: TransportAcceptCallbacks,
    signal: AbortSignal,
  ): Promise<TransportListenerPort>;
}

export interface TransportConnectCapability {
  connect(
    options: TransportAcquisitionOptions,
    signal: AbortSignal,
  ): Promise<TransportChannelPort>;
}

/**
 * Supplies pre-shared secrets to a binding that protects its channels with one.
 *
 * The concept is mechanism-free: TLS-PSK, SSH, and IPsec all select a secret by
 * identity, so each binding maps this port to its own handshake rather than
 * restating the model. Naming it here keeps one definition when a second
 * protected binding exists.
 *
 * Both methods are synchronous because a handshake cannot await a key: the
 * underlying callback must answer while the connection is being established.
 * Rotation therefore works by returning a different value on a later call.
 */
export interface PresharedKeyPort {
  /** Identity this node presents when it dials. */
  readonly localIdentity: SecretIdentity;
  /** This node's own secret. */
  own(): Readonly<Uint8Array>;
  /**
   * The secret registered for a presented identity, or `undefined` to refuse.
   * Returning `undefined` is the only rejection mechanism; the port never
   * throws to deny a peer.
   *
   * Under `network` keying this returns the same secret for every identity, so
   * a completed handshake proves group membership and not which peer connected.
   * Evidence must report that difference truthfully.
   */
  resolve(identity: SecretIdentity): Readonly<Uint8Array> | undefined;
}

export interface PeerTransportPort {
  resolveListener(
    reference: TransportRef,
  ): TransportListenCapability | undefined;
  resolveTarget(
    reference: TransportRef,
  ): TransportConnectCapability | undefined;
}

export type {
  TransportAbortIntent,
  TransportAcquisitionOptions,
  TransportChannelLimits,
  TransportCloseIntent,
  TransportDiagnostic,
  TransportInputRejected,
  TransportListenerPublication,
  TransportListenerTerminal,
  TransportListenOptions,
  SecretIdentity,
  TransportPeerEvidence,
  TransportRef,
  TransportTerminal,
};
