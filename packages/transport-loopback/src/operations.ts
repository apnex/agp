import type {
  TransportListenerTerminal,
  TransportTerminal,
} from "@agp/transport";

import {
  LOOPBACK_COUNTER_KEYS,
  MonotonicDomains,
} from "./domain.js";
import { deepFreeze } from "./immutable.js";
import type {
  LoopbackChannelSnapshot,
  LoopbackCounterKey,
  LoopbackCountersSnapshot,
  LoopbackFabricFailureSnapshot,
  LoopbackFabricId,
  LoopbackFabricSnapshot,
  LoopbackListenerSnapshot,
} from "./types.generated.js";

export interface ListenerOperationsView {
  readonly listenerId: string;
  readonly address: string;
  readonly state: "Listening" | "Closing" | "Terminal";
  readonly terminal?: TransportListenerTerminal;
  readonly activeChannels: number;
}

export interface ChannelOperationsView {
  readonly channelId: string;
  readonly leftTransport: string;
  readonly rightTransport: string;
  readonly state: "Open" | "Closing" | "Terminal";
  readonly leftTerminal?: TransportTerminal;
  readonly rightTerminal?: TransportTerminal;
  readonly queuedPacketsLeft: number;
  readonly queuedBytesLeft: number;
  readonly queuedPacketsRight: number;
  readonly queuedBytesRight: number;
}

export interface FabricOperationsView {
  readonly fabricId: LoopbackFabricId;
  readonly state: "Running" | "Closing" | "Closed" | "Failed";
  readonly failure?: LoopbackFabricFailureSnapshot;
  readonly domains: MonotonicDomains;
  readonly listeners: readonly ListenerOperationsView[];
  readonly channels: readonly ChannelOperationsView[];
  readonly resources: {
    readonly pendingAcquisitions: number;
    readonly activeChannels: number;
    readonly pendingSendBytes: number;
    readonly queuedPackets: number;
    readonly queuedBytes: number;
  };
}

export function preflightMonotonicDomain(
  domains: MonotonicDomains,
  deltas: Readonly<Partial<Record<LoopbackCounterKey, bigint>>> = {},
  arbitrationAllocations = 0n,
): void {
  domains.preflight(deltas, arbitrationAllocations);
}

export function snapshot(view: FabricOperationsView): LoopbackFabricSnapshot {
  const listeners = view.listeners
    .map(listenerSnapshot)
    .sort((left, right) =>
      compareUtf8(left.address, right.address)
      || compareUtf8(left.listenerId, right.listenerId)
    );
  const channels = view.channels
    .map(channelSnapshot)
    .sort((left, right) => compareUtf8(left.channelId, right.channelId));
  const counters = Object.fromEntries(
    LOOPBACK_COUNTER_KEYS.map((key) => [
      key,
      view.domains.counter(key).toString(10),
    ]),
  ) as unknown as LoopbackCountersSnapshot;
  const common = {
    fabricId: view.fabricId,
    state: view.state,
    revision: view.domains.revision.toString(10),
    listeners,
    channels,
    resources: { ...view.resources },
    counters,
  };
  return deepFreeze(
    view.state === "Failed"
      ? {
          ...common,
          state: "Failed" as const,
          failure: requireFailure(view.failure),
        }
      : {
          ...common,
          state: view.state,
        },
  ) as unknown as LoopbackFabricSnapshot;
}

function listenerSnapshot(
  value: ListenerOperationsView,
): LoopbackListenerSnapshot {
  return value.terminal === undefined
    ? {
        listenerId: value.listenerId,
        address: value.address,
        state: value.state,
        activeChannels: value.activeChannels,
      }
    : {
        listenerId: value.listenerId,
        address: value.address,
        state: value.state,
        terminal: value.terminal,
        activeChannels: value.activeChannels,
      };
}

function channelSnapshot(
  value: ChannelOperationsView,
): LoopbackChannelSnapshot {
  return {
    channelId: value.channelId,
    leftTransport: value.leftTransport,
    rightTransport: value.rightTransport,
    state: value.state,
    ...(value.leftTerminal === undefined
      ? {}
      : { leftTerminal: value.leftTerminal }),
    ...(value.rightTerminal === undefined
      ? {}
      : { rightTerminal: value.rightTerminal }),
    queuedPacketsLeft: value.queuedPacketsLeft,
    queuedBytesLeft: value.queuedBytesLeft,
    queuedPacketsRight: value.queuedPacketsRight,
    queuedBytesRight: value.queuedBytesRight,
  };
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function requireFailure(
  failure: LoopbackFabricFailureSnapshot | undefined,
): LoopbackFabricFailureSnapshot {
  if (failure === undefined) {
    throw new Error("Failed fabric has no failure record");
  }
  return failure;
}
