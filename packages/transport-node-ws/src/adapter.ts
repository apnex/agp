import {
  AGP_WEBSOCKET_SUBPROTOCOL,
  assertWebSocketTransportConfig,
} from "@agp/binding-websocket";
import type {
  WebSocketListenerConfigData,
  WebSocketTargetConfigData,
  WebSocketTransportConfigData,
} from "@agp/binding-websocket";
import {
  isTransportRef,
} from "@agp/transport";
import type {
  PeerTransportPort,
  TransportAcquisitionOptions,
  TransportAcceptCallbacks,
  TransportChannelLimits,
  TransportChannelPort,
  TransportConnectCapability,
  TransportDiagnosticSinkPort,
  TransportListenCapability,
  TransportListenOptions,
  TransportRef,
} from "@agp/transport";
import WebSocket from "ws";

import { NodeWsChannel } from "./channel.js";
import { NodeWsConfigurationError, operationError } from "./errors.js";
import { acquireNodeWsListener } from "./listener.js";

export interface WebSocketTransportCapabilities {
  readonly diagnostics?: TransportDiagnosticSinkPort;
}

export function createNodeWsTransport(
  config: WebSocketTransportConfigData,
  capabilities: WebSocketTransportCapabilities = {},
): PeerTransportPort {
  assertCapabilities(capabilities);
  assertWebSocketTransportConfig(config);
  for (const value of [...config.listeners, ...config.targets]) {
    if (value.compression.mode !== "disabled") {
      throw new NodeWsConfigurationError(
        "COMPRESSION_UNSUPPORTED",
        "the certified Node ws adapter currently requires disabled compression",
      );
    }
  }

  const listeners = new Map<TransportRef, TransportListenCapability>();
  const targets = new Map<TransportRef, TransportConnectCapability>();
  for (const listener of config.listeners) {
    listeners.set(
      listener.transportRef,
      createListenerCapability(listener, capabilities.diagnostics),
    );
  }
  for (const target of config.targets) {
    targets.set(
      target.transportRef,
      createTargetCapability(target, capabilities.diagnostics),
    );
  }

  return Object.freeze({
    resolveListener(reference: TransportRef) {
      assertResolverReference(reference, "resolve-listener");
      return listeners.get(reference);
    },
    resolveTarget(reference: TransportRef) {
      assertResolverReference(reference, "resolve-target");
      return targets.get(reference);
    },
  });
}

function createListenerCapability(
  config: WebSocketListenerConfigData,
  diagnostics: TransportDiagnosticSinkPort | undefined,
): TransportListenCapability {
  const capability: TransportListenCapability = {
    listen(
      options: TransportListenOptions,
      callbacks: TransportAcceptCallbacks,
      signal: AbortSignal,
    ) {
      return acquireNodeWsListener(
        config,
        options,
        callbacks,
        signal,
        diagnostics,
      );
    },
  };
  return Object.freeze(capability);
}

function createTargetCapability(
  config: WebSocketTargetConfigData,
  diagnostics: TransportDiagnosticSinkPort | undefined,
): TransportConnectCapability {
  const capability: TransportConnectCapability = {
    connect(
      options: TransportAcquisitionOptions,
      signal: AbortSignal,
    ) {
      return acquireNodeWsChannel(config, options, signal, diagnostics);
    },
  };
  return Object.freeze(capability);
}

function acquireNodeWsChannel(
  config: WebSocketTargetConfigData,
  options: TransportAcquisitionOptions,
  signal: AbortSignal,
  diagnostics?: TransportDiagnosticSinkPort,
): Promise<TransportChannelPort> {
  assertChannelLimits(options.channel);
  if (signal.aborted) {
    return Promise.reject(operationError(
      "OPERATION_ABORTED",
      "connect",
      "outbound acquisition was cancelled",
    ));
  }

  let socket: WebSocket;
  try {
    socket = new WebSocket(config.url, AGP_WEBSOCKET_SUBPROTOCOL, {
      maxPayload: options.channel.maxPacketBytes,
      perMessageDeflate: false,
    });
  } catch (cause) {
    return Promise.reject(operationError(
      "CONNECT_FAILED",
      "connect",
      "WebSocket acquisition could not start",
      { cause },
    ));
  }
  const channel = new NodeWsChannel({
    socket,
    limits: options.channel,
    ...(diagnostics === undefined ? {} : { diagnostics }),
    ...(config.liveness === undefined ? {} : { liveness: config.liveness }),
  });

  return new Promise<TransportChannelPort>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort);
      socket.off("open", onOpen);
      socket.off("error", onError);
      socket.off("close", onClose);
      socket.off("unexpected-response", onUnexpectedResponse);
    };
    const fail = (
      code: "BINDING_UNAVAILABLE" | "CONNECT_FAILED",
      message: string,
      cause?: unknown,
    ): void => {
      if (settled) return;
      settled = true;
      cleanup();
      channel.abort({ kind: "forced-stop", code });
      reject(operationError(code, "connect", message, { cause }));
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      channel.abort({
        kind: "deadline",
        code: "CONNECT_ABORTED",
      });
      reject(operationError(
        "OPERATION_ABORTED",
        "connect",
        "outbound acquisition was cancelled",
      ));
    };
    const onOpen = (): void => {
      if (settled) return;
      if (socket.protocol !== AGP_WEBSOCKET_SUBPROTOCOL) {
        fail(
          "BINDING_UNAVAILABLE",
          "peer did not select the exact AGP WebSocket binding",
        );
        return;
      }
      settled = true;
      cleanup();
      resolve(channel);
    };
    const onError = (cause: Error): void => {
      const bindingMismatch =
        /subprotocol|Sec-WebSocket-Protocol/iu.test(cause.message);
      fail(
        bindingMismatch ? "BINDING_UNAVAILABLE" : "CONNECT_FAILED",
        bindingMismatch
          ? "peer did not establish the configured WebSocket binding"
          : "WebSocket connection failed before channel commit",
        cause,
      );
    };
    const onClose = (): void => {
      fail(
        "CONNECT_FAILED",
        "WebSocket closed before channel commit",
      );
    };
    const onUnexpectedResponse = (): void => {
      fail(
        "BINDING_UNAVAILABLE",
        "peer rejected the configured WebSocket binding",
      );
    };

    signal.addEventListener("abort", onAbort, { once: true });
    socket.once("open", onOpen);
    socket.once("error", onError);
    socket.once("close", onClose);
    socket.once("unexpected-response", onUnexpectedResponse);
    if (signal.aborted) onAbort();
  });
}

function assertResolverReference(
  reference: TransportRef,
  phase: "resolve-listener" | "resolve-target",
): void {
  if (!isTransportRef(reference)) {
    throw operationError(
      "REFERENCE_INVALID",
      phase,
      "transport reference is outside the neutral bounded domain",
    );
  }
}

function assertCapabilities(
  value: WebSocketTransportCapabilities,
): void {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.keys(value).some((key) => key !== "diagnostics")
    || (
      value.diagnostics !== undefined
      && typeof value.diagnostics.emit !== "function"
    )
  ) {
    throw new NodeWsConfigurationError(
      "CAPABILITIES_INVALID",
      "only the optional neutral diagnostics capability is supported",
    );
  }
}

function assertChannelLimits(limits: TransportChannelLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new NodeWsConfigurationError(
        "LIMITS_INVALID",
        `channel limit ${name} must be a positive safe integer`,
      );
    }
  }
  if (limits.maxBufferedBytes < limits.maxPacketBytes) {
    throw new NodeWsConfigurationError(
      "LIMITS_INVALID",
      "maxBufferedBytes must admit one maximum packet",
    );
  }
}
