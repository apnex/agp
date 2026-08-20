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
  TransportPeerEvidence,
  TransportRef,
  TransportTerminal,
};
