// Generated from sovereign management JSON Schemas by scripts/generate-contracts.mjs.
// DO NOT EDIT.

import type {
  AdvertisementSnapshot,
  CandidateRouteSnapshot,
  ConfigurationSnapshot,
  CountersSnapshot,
  ForwardingEntrySnapshot,
  InstanceId,
  LifecycleSnapshot,
  LocalEndpointSnapshot,
  OperationsRevision,
  OperationsSnapshot,
  ResourcesSnapshot,
  SelectedRouteSnapshot,
  ConnectionSnapshot,
  NodeId,
  Timestamp,
} from "@agp/core";

export interface ManagementMeta {
  readonly nodeId: NodeId;
  readonly instanceId: InstanceId;
  readonly capturedAt: Timestamp;
  readonly revision: OperationsRevision;
}

export interface ManagementError {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Error";
  readonly code:
    | "BAD_REQUEST"
    | "METHOD_NOT_ALLOWED"
    | "NOT_FOUND"
    | "RESPONSE_TOO_LARGE"
    | "INTERNAL";
  readonly message: string;
}

export interface ManagementHealth {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Health";
  readonly meta: ManagementMeta;
  readonly data: {
    readonly lifecycle: LifecycleSnapshot;
    readonly healthy: boolean;
    readonly ready: boolean;
  };
}

export interface ManagementOperationsSnapshot {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "OperationsSnapshot";
  readonly meta: ManagementMeta;
  readonly data: Omit<OperationsSnapshot, "schemaVersion" | "nodeId" | "instanceId" | "capturedAt" | "revision">;
}

export interface ManagementConfiguration {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Configuration";
  readonly meta: ManagementMeta;
  readonly data: ConfigurationSnapshot;
}

export interface ManagementLocalEndpointList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "LocalEndpointList";
  readonly meta: ManagementMeta;
  readonly items: readonly LocalEndpointSnapshot[];
}

export interface ManagementConnectionList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "ConnectionList";
  readonly meta: ManagementMeta;
  readonly items: readonly ConnectionSnapshot[];
}

export interface ManagementAdvertisementList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "AdvertisementList";
  readonly meta: ManagementMeta;
  readonly items: readonly AdvertisementSnapshot[];
}

export interface ManagementRouteTable {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "RouteTable";
  readonly meta: ManagementMeta;
  readonly candidates: readonly CandidateRouteSnapshot[];
  readonly selected: readonly SelectedRouteSnapshot[];
}

export interface ManagementForwardingList {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "ForwardingList";
  readonly meta: ManagementMeta;
  readonly items: readonly ForwardingEntrySnapshot[];
}

export interface ManagementResources {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Resources";
  readonly meta: ManagementMeta;
  readonly data: ResourcesSnapshot;
}

export interface ManagementCounters {
  readonly apiVersion: "agp.management/v1";
  readonly kind: "Counters";
  readonly meta: ManagementMeta;
  readonly data: CountersSnapshot;
}

export type ManagementValue =
  | ManagementHealth
  | ManagementOperationsSnapshot
  | ManagementConfiguration
  | ManagementLocalEndpointList
  | ManagementConnectionList
  | ManagementAdvertisementList
  | ManagementRouteTable
  | ManagementForwardingList
  | ManagementResources
  | ManagementCounters;
