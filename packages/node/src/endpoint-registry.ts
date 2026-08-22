import type {
  EndpointName,
  JsonObject,
} from "@agp/protocol";
import type { EndpointDeliveryContext } from "@agp/core";

export interface EndpointHandlerContext {
  readonly delivery: EndpointDeliveryContext;
  readonly signal: AbortSignal;
}

export type { EndpointDeliveryContext };

export type EndpointHandler = (
  payload: JsonObject,
  context: EndpointHandlerContext,
) => void | Promise<void>;

export interface RegisteredEndpoint {
  readonly endpoint: EndpointName;
  readonly bindingId: string;
  readonly registeredAt: string;
  readonly token: object;
  readonly handler: EndpointHandler;
  readonly controller: AbortController;
}

export class EndpointRegistry {
  readonly #maximum: number;
  readonly #byEndpoint = new Map<EndpointName, RegisteredEndpoint>();
  readonly #byBinding = new Map<string, RegisteredEndpoint>();
  #version = 0;

  constructor(maximum: number) {
    if (!Number.isSafeInteger(maximum) || maximum < 1) {
      throw new RangeError("endpoint capacity must be a positive safe integer");
    }
    this.#maximum = maximum;
  }

  /** Membership generation. Changes exactly when the set of endpoints does. */
  get version(): number {
    return this.#version;
  }

  get size(): number {
    return this.#byEndpoint.size;
  }

  has(endpoint: EndpointName): boolean {
    return this.#byEndpoint.has(endpoint);
  }

  get(endpoint: EndpointName): RegisteredEndpoint | undefined {
    return this.#byEndpoint.get(endpoint);
  }

  values(): readonly RegisteredEndpoint[] {
    return Object.freeze([...this.#byEndpoint.values()]);
  }

  register(input: {
    readonly endpoint: EndpointName;
    readonly bindingId: string;
    readonly registeredAt: string;
    readonly handler: EndpointHandler;
  }): RegisteredEndpoint {
    if (this.#byEndpoint.has(input.endpoint)) {
      throw new Error("endpoint already exposed");
    }
    if (this.#byBinding.has(input.bindingId)) {
      throw new Error("binding identifier already retained");
    }
    if (this.#byEndpoint.size >= this.#maximum) {
      throw new Error("endpoint capacity reached");
    }
    const value = Object.freeze({
      ...input,
      token: Object.freeze({}),
      controller: new AbortController(),
    });
    this.#byEndpoint.set(input.endpoint, value);
    this.#byBinding.set(input.bindingId, value);
    this.#version += 1;
    return value;
  }

  remove(bindingId: string): RegisteredEndpoint | undefined {
    const value = this.#byBinding.get(bindingId);
    if (value === undefined) return undefined;
    this.#byBinding.delete(bindingId);
    this.#byEndpoint.delete(value.endpoint);
    this.#version += 1;
    value.controller.abort();
    return value;
  }

  isCurrent(value: RegisteredEndpoint): boolean {
    return this.#byBinding.get(value.bindingId)?.token === value.token;
  }

  closeAll(): readonly RegisteredEndpoint[] {
    const values = [...this.#byBinding.values()];
    this.#byBinding.clear();
    this.#byEndpoint.clear();
    this.#version += 1;
    for (const value of values) value.controller.abort();
    return Object.freeze(values);
  }
}
