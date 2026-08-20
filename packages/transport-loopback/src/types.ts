import type {
  PeerTransportPort,
  TransportDiagnosticSinkPort,
  TransportRef,
} from "@agp/transport";

import type {
  LoopbackFabricConfig,
  LoopbackFabricId,
  LoopbackFabricSnapshot,
  LoopbackListenerConfig,
  LoopbackTargetConfig,
  LoopbackTransportConfig,
  LoopbackTransportName,
} from "./types.generated.js";

export interface LoopbackFabricDependencies {
  readonly diagnostics?: TransportDiagnosticSinkPort;
}

export interface LoopbackPortOptions {
  readonly listeners: ReadonlyMap<TransportRef, LoopbackListenerConfig>;
  readonly targets: ReadonlyMap<TransportRef, LoopbackTargetConfig>;
}

export interface LoopbackTransportBuilder {
  readonly transportName: LoopbackTransportName;
  createPort(options: LoopbackPortOptions): PeerTransportPort;
}

export interface LoopbackFabric {
  readonly fabricId: LoopbackFabricId;
  createTransport(config: LoopbackTransportConfig): LoopbackTransportBuilder;
  snapshot(): LoopbackFabricSnapshot;
  close(signal: AbortSignal): Promise<void>;
}

export type {
  LoopbackAddress,
  LoopbackChannelSnapshot,
  LoopbackCounterKey,
  LoopbackCountersSnapshot,
  LoopbackFabricConfig,
  LoopbackFabricFailureSnapshot,
  LoopbackFabricId,
  LoopbackFabricLimits,
  LoopbackFabricRevision,
  LoopbackFabricSnapshot,
  LoopbackListenerConfig,
  LoopbackListenerSnapshot,
  LoopbackResourcesSnapshot,
  LoopbackTargetConfig,
  LoopbackTransportConfig,
  LoopbackTransportName,
} from "./types.generated.js";
