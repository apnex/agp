import type {
  EndpointSource,
  NodeId,
} from "@agp/protocol";
import type {
  ExactSessionOwner,
  RoutingTable,
} from "@agp/core";
import type { DataRoutingPort } from "./data-plane.js";

/** Capability adapter; all routing truth remains owned by @agp/core. */
export class CoreDataRoutingAdapter implements DataRoutingPort {
  readonly #routing: RoutingTable;

  constructor(routing: RoutingTable) {
    this.#routing = routing;
  }

  selectedRoute(endpoint: EndpointSource["endpoint"]) {
    return this.#routing.selectedRoute(endpoint);
  }

  forwardingEntry(endpoint: EndpointSource["endpoint"]) {
    return this.#routing.forwardingEntry(endpoint);
  }

  routeToInstance(endpoint: EndpointSource["endpoint"], originNodeId: NodeId) {
    return this.#routing.routeToInstance(endpoint, originNodeId);
  }

  feasibleSource(
    ingress: ExactSessionOwner,
    source: EndpointSource,
  ): boolean {
    return this.#routing.feasibleSource({
      owner: ingress,
      endpoint: source.endpoint,
      originNodeId: source.originNodeId,
    });
  }

  hasAckedSource(
    egress: ExactSessionOwner,
    source: EndpointSource,
  ): boolean {
    return this.#routing.hasAckedSource({
      owner: egress,
      endpoint: source.endpoint,
      originNodeId: source.originNodeId,
    });
  }

  sourceExportEpoch(
    egress: ExactSessionOwner,
    source: EndpointSource,
  ): string | undefined {
    const epoch = this.#routing.sourceExportEpoch({
      owner: egress,
      endpoint: source.endpoint,
      originNodeId: source.originNodeId,
    });
    return epoch === undefined
      ? undefined
      : `${egress.controllerId}:${source.endpoint}:${source.originNodeId}:${epoch}`;
  }
}
