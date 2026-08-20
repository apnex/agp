import http, {
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import type {
  LifecycleSnapshot,
  SnapshotMeta,
} from "@agp/core";

import {
  MANAGEMENT_ALLOWED_METHODS,
  MANAGEMENT_API_VERSION,
  MANAGEMENT_HTTP_LIMITS,
} from "./constants.js";
import {
  MANAGEMENT_SCHEMA_IDS,
  validateManagementSchema,
} from "./schema.js";
import {
  ManagementHttpServerError,
  type ManagementError,
  type ManagementHttpConfig,
  type ManagementHttpServer,
  type ManagementMeta,
  type ManagementOperationsReader,
  type ManagementValue,
} from "./types.js";

const META_KEYS = new Set([
  "schemaVersion",
  "nodeId",
  "instanceId",
  "capturedAt",
  "revision",
]);

interface Projection {
  readonly schemaId: string;
  readonly value: ManagementValue;
}

function validateConfig(
  config: ManagementHttpConfig,
): Required<ManagementHttpConfig> {
  const host = config.host ?? "127.0.0.1";
  const port = config.port ?? 0;
  const maxResponseBytes =
    config.maxResponseBytes ?? MANAGEMENT_HTTP_LIMITS.defaultMaxResponseBytes;
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new ManagementHttpServerError(
      "CONFIG_INVALID",
      "management listener must use a literal loopback host",
    );
  }
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new ManagementHttpServerError("CONFIG_INVALID", "invalid port");
  }
  if (
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < MANAGEMENT_HTTP_LIMITS.minimumResponseBytes ||
    maxResponseBytes > MANAGEMENT_HTTP_LIMITS.maximumResponseBytes
  ) {
    throw new ManagementHttpServerError(
      "CONFIG_INVALID",
      "invalid maxResponseBytes",
    );
  }
  return { host, port, maxResponseBytes };
}

function metaOf(value: SnapshotMeta): ManagementMeta {
  return Object.freeze({
    nodeId: value.nodeId,
    instanceId: value.instanceId,
    capturedAt: value.capturedAt,
    revision: value.revision,
  });
}

function withoutMeta<T extends object>(value: T): Omit<T, keyof SnapshotMeta> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !META_KEYS.has(key)),
  ) as Omit<T, keyof SnapshotMeta>;
}

function project(
  reader: ManagementOperationsReader,
  pathname: string,
): Projection | undefined {
  switch (pathname) {
    case "/v1/health": {
      const value = reader.lifecycle();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.healthResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "Health",
          meta: metaOf(value),
          data: {
            lifecycle: withoutMeta(value) as LifecycleSnapshot,
            healthy: value.state !== "Failed",
            ready: value.state === "Running",
          },
        },
      };
    }
    case "/v1/snapshot": {
      const value = reader.snapshot();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.operationsResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "OperationsSnapshot",
          meta: metaOf(value),
          data: withoutMeta(value),
        },
      };
    }
    case "/v1/configuration": {
      const value = reader.configuration();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.configurationResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "Configuration",
          meta: metaOf(value),
          data: withoutMeta(value),
        },
      };
    }
    case "/v1/endpoints": {
      const value = reader.endpoints();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.localEndpointsResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "LocalEndpointList",
          meta: metaOf(value),
          items: value.items,
        },
      };
    }
    case "/v1/connections": {
      const value = reader.connections();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.connectionsResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "ConnectionList",
          meta: metaOf(value),
          items: value.items,
        },
      };
    }
    case "/v1/advertisements": {
      const value = reader.advertisements();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.advertisementsResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "AdvertisementList",
          meta: metaOf(value),
          items: value.items,
        },
      };
    }
    case "/v1/routes": {
      const value = reader.routes();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.routesResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "RouteTable",
          meta: metaOf(value),
          candidates: value.candidates,
          selected: value.selected,
        },
      };
    }
    case "/v1/forwarding": {
      const value = reader.forwarding();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.forwardingResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "ForwardingList",
          meta: metaOf(value),
          items: value.items,
        },
      };
    }
    case "/v1/resources": {
      const value = reader.resources();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.resourcesResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "Resources",
          meta: metaOf(value),
          data: withoutMeta(value),
        },
      };
    }
    case "/v1/counters": {
      const value = reader.counters();
      return {
        schemaId: MANAGEMENT_SCHEMA_IDS.countersResponse,
        value: {
          apiVersion: MANAGEMENT_API_VERSION,
          kind: "Counters",
          meta: metaOf(value),
          data: withoutMeta(value),
        },
      };
    }
    default:
      return undefined;
  }
}

function errorValue(
  code: ManagementError["code"],
  message: string,
): ManagementError {
  return { apiVersion: MANAGEMENT_API_VERSION, kind: "Error", code, message };
}

function sendJson(
  response: ServerResponse,
  status: number,
  schemaId: string,
  candidate: ManagementValue | ManagementError,
  maxResponseBytes: number,
  headOnly = false,
): void {
  let finalStatus = status;
  let value: ManagementValue | ManagementError = candidate;
  let finalSchemaId = schemaId;

  if (!validateManagementSchema(finalSchemaId, value).ok) {
    finalStatus = 500;
    finalSchemaId = MANAGEMENT_SCHEMA_IDS.errorResponse;
    value = errorValue("INTERNAL", "management projection failed validation");
  }

  let body: string;
  try {
    body = JSON.stringify(value);
  } catch {
    finalStatus = 500;
    finalSchemaId = MANAGEMENT_SCHEMA_IDS.errorResponse;
    value = errorValue("INTERNAL", "management projection failed");
    body = JSON.stringify(value);
  }

  if (Buffer.byteLength(body, "utf8") > maxResponseBytes) {
    finalStatus = 507;
    finalSchemaId = MANAGEMENT_SCHEMA_IDS.errorResponse;
    value = errorValue(
      "RESPONSE_TOO_LARGE",
      "management response exceeded its bound",
    );
    body = JSON.stringify(value);
  }

  if (!validateManagementSchema(finalSchemaId, value).ok) {
    throw new ManagementHttpServerError(
      "INTERNAL",
      "static management error response failed validation",
    );
  }

  response.writeHead(finalStatus, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body, "utf8"),
    "x-content-type-options": "nosniff",
  });
  response.end(headOnly ? undefined : body);
}

class ManagementHttpServerImpl implements ManagementHttpServer {
  readonly #reader: ManagementOperationsReader;
  readonly #config: Required<ManagementHttpConfig>;
  #server: HttpServer | undefined;
  #started: Readonly<{ url: string }> | undefined;

  constructor(
    reader: ManagementOperationsReader,
    config: ManagementHttpConfig,
  ) {
    this.#reader = reader;
    this.#config = validateConfig(config);
  }

  async start(): Promise<{ readonly url: string }> {
    if (this.#started !== undefined) return this.#started;
    if (this.#server !== undefined) {
      throw new ManagementHttpServerError(
        "LIFECYCLE_INVALID",
        "management start is already in progress",
      );
    }

    const server = http.createServer(
      { maxHeaderSize: MANAGEMENT_HTTP_LIMITS.maxRequestHeaderBytes },
      (request, response) => this.#handle(request, response),
    );
    this.#server = server;
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
        server.listen(this.#config.port, this.#config.host);
      });
    } catch (error) {
      this.#server = undefined;
      throw new ManagementHttpServerError(
        "LISTEN_FAILED",
        "management listener failed",
        error,
      );
    }

    const address = server.address();
    if (address === null || typeof address === "string") {
      await this.stop();
      throw new ManagementHttpServerError(
        "INTERNAL",
        "management listener exposed no TCP address",
      );
    }
    const host = this.#config.host === "::1" ? "[::1]" : this.#config.host;
    this.#started = Object.freeze({ url: `http://${host}:${address.port}` });
    return this.#started;
  }

  async stop(): Promise<void> {
    const server = this.#server;
    if (server === undefined) return;
    this.#server = undefined;
    this.#started = undefined;
    if (!server.listening) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  #handle(request: IncomingMessage, response: ServerResponse): void {
    response.setHeader("allow", MANAGEMENT_ALLOWED_METHODS);
    const headOnly = request.method === "HEAD";
    const requestTarget = request.url ?? "/";

    if (
      Buffer.byteLength(requestTarget, "utf8") >
      MANAGEMENT_HTTP_LIMITS.maxRequestTargetBytes
    ) {
      sendJson(
        response,
        414,
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        errorValue("BAD_REQUEST", "request target exceeded its bound"),
        this.#config.maxResponseBytes,
        headOnly,
      );
      return;
    }

    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.method !== "OPTIONS"
    ) {
      sendJson(
        response,
        405,
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        errorValue("METHOD_NOT_ALLOWED", "management API is read-only"),
        this.#config.maxResponseBytes,
      );
      return;
    }

    if (hasRequestBody(request)) {
      sendJson(
        response,
        400,
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        errorValue("BAD_REQUEST", "request bodies are unsupported"),
        this.#config.maxResponseBytes,
        headOnly,
      );
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "cache-control": "no-store",
        "content-length": "0",
      });
      response.end();
      return;
    }

    let url: URL;
    try {
      url = new URL(requestTarget, "http://management.invalid");
      decodeURIComponent(url.pathname);
    } catch {
      sendJson(
        response,
        400,
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        errorValue("BAD_REQUEST", "invalid request target"),
        this.#config.maxResponseBytes,
        headOnly,
      );
      return;
    }
    if (url.search !== "") {
      sendJson(
        response,
        400,
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        errorValue("BAD_REQUEST", "query parameters are unsupported"),
        this.#config.maxResponseBytes,
        headOnly,
      );
      return;
    }

    try {
      const projection = project(this.#reader, url.pathname);
      if (projection === undefined) {
        sendJson(
          response,
          404,
          MANAGEMENT_SCHEMA_IDS.errorResponse,
          errorValue("NOT_FOUND", "management resource does not exist"),
          this.#config.maxResponseBytes,
          headOnly,
        );
        return;
      }
      sendJson(
        response,
        200,
        projection.schemaId,
        projection.value,
        this.#config.maxResponseBytes,
        headOnly,
      );
    } catch {
      sendJson(
        response,
        500,
        MANAGEMENT_SCHEMA_IDS.errorResponse,
        errorValue("INTERNAL", "management projection failed"),
        this.#config.maxResponseBytes,
        headOnly,
      );
    }
  }
}

export function createManagementHttpServer(
  reader: ManagementOperationsReader,
  config: ManagementHttpConfig = {},
): ManagementHttpServer {
  if (!hasReaderSurface(reader)) {
    throw new ManagementHttpServerError(
      "CONFIG_INVALID",
      "a complete synchronous OperationsReader is required",
    );
  }
  return new ManagementHttpServerImpl(reader, config);
}

function hasRequestBody(request: IncomingMessage): boolean {
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined && contentLength !== "0") return true;
  return request.headers["transfer-encoding"] !== undefined;
}

function hasReaderSurface(
  value: ManagementOperationsReader,
): value is ManagementOperationsReader {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as unknown as Record<string, unknown>;
  return [
    "snapshot",
    "configuration",
    "lifecycle",
    "endpoints",
    "connections",
    "advertisements",
    "routes",
    "forwarding",
    "resources",
    "counters",
  ].every((name) => typeof candidate[name] === "function");
}
