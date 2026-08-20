import http, {
  type IncomingMessage,
  type Server as HttpServer,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import {
  AGP_WEBSOCKET_SUBPROTOCOL,
} from "@agp/binding-websocket";
import type {
  WebSocketListenerConfigData,
} from "@agp/binding-websocket";
import {
  emitTransportDiagnostic,
} from "@agp/transport";
import type {
  TransportAbortIntent,
  TransportAcceptCallbacks,
  TransportDiagnosticSinkPort,
  TransportListenOptions,
  TransportListenerPort,
  TransportListenerTerminal,
} from "@agp/transport";
import WebSocket, { WebSocketServer } from "ws";

import { NodeWsChannel } from "./channel.js";
import { NodeWsConfigurationError, operationError } from "./errors.js";
import { rejectUpgrade } from "./native.js";

interface ListenerTerminalWaiter {
  readonly resolve: (terminal: TransportListenerTerminal) => void;
}

export async function acquireNodeWsListener(
  config: WebSocketListenerConfigData,
  options: TransportListenOptions,
  callbacks: TransportAcceptCallbacks,
  signal: AbortSignal,
  diagnostics?: TransportDiagnosticSinkPort,
): Promise<TransportListenerPort> {
  assertListenerLimits(options);
  if (signal.aborted) {
    throw operationError(
      "OPERATION_ABORTED",
      "listen",
      "listener acquisition was cancelled",
    );
  }
  const url = new URL(config.url);
  const server = http.createServer((_request, response) => {
    response.writeHead(404, {
      "cache-control": "no-store",
      "content-length": "0",
    });
    response.end();
  });
  const webSockets = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    maxPayload: options.limits.channel.maxPacketBytes,
    perMessageDeflate: false,
    handleProtocols(protocols) {
      return protocols.has(AGP_WEBSOCKET_SUBPROTOCOL)
        ? AGP_WEBSOCKET_SUBPROTOCOL
        : false;
    },
  });

  let listener: NodeWsListener | undefined;
  const upgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    listener?.handleUpgrade(request, socket, head);
  };
  server.on("upgrade", upgrade);

  return await new Promise<TransportListenerPort>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort);
      server.off("error", onError);
    };
    const disposePartial = (): void => {
      server.off("upgrade", upgrade);
      try {
        webSockets.close();
      } catch {
        // No-server WebSocketServer has no independent listening authority.
      }
      try {
        server.close();
      } catch {
        // A not-yet-listening server has no remaining authority.
      }
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      disposePartial();
      reject(operationError(
        "OPERATION_ABORTED",
        "listen",
        "listener acquisition was cancelled",
      ));
    };
    const onError = (cause: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      disposePartial();
      reject(operationError(
        "LISTEN_FAILED",
        "listen",
        "WebSocket listener could not bind",
        { cause },
      ));
    };
    const onListening = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      listener = new NodeWsListener({
        server,
        webSockets,
        upgrade,
        config,
        options,
        callbacks,
        ...(diagnostics === undefined ? {} : { diagnostics }),
      });
      resolve(listener);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    server.once("error", onError);
    server.once("listening", onListening);
    try {
      server.listen({
        host: listenHostname(url.hostname),
        port: url.port === "" ? 80 : Number(url.port),
      });
    } catch (cause) {
      onError(cause instanceof Error ? cause : new Error("listen failed"));
    }
    if (signal.aborted) onAbort();
  });
}

class NodeWsListener implements TransportListenerPort {
  readonly #server: HttpServer;
  readonly #webSockets: WebSocketServer;
  readonly #upgrade: (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void;
  readonly #callbacks: TransportAcceptCallbacks;
  readonly #diagnostics: TransportDiagnosticSinkPort | undefined;
  readonly #config: WebSocketListenerConfigData;
  readonly #options: TransportListenOptions;
  readonly #pendingSockets = new Set<Duplex>();
  readonly #terminalWaiters = new Set<ListenerTerminalWaiter>();

  #pending = 0;
  #active = 0;
  #accepting = true;
  #closeStarted = false;
  #terminal: TransportListenerTerminal | undefined;

  readonly publication: Readonly<{ readonly displayAddress?: string }>;

  constructor(input: {
    readonly server: HttpServer;
    readonly webSockets: WebSocketServer;
    readonly upgrade: (
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
    ) => void;
    readonly callbacks: TransportAcceptCallbacks;
    readonly diagnostics?: TransportDiagnosticSinkPort;
    readonly config: WebSocketListenerConfigData;
    readonly options: TransportListenOptions;
  }) {
    this.#server = input.server;
    this.#webSockets = input.webSockets;
    this.#upgrade = input.upgrade;
    this.#callbacks = input.callbacks;
    this.#diagnostics = input.diagnostics;
    this.#config = input.config;
    this.#options = input.options;
    const displayAddress =
      input.config.displayAddress ?? boundDisplayAddress(
        input.server,
        input.config.url,
      );
    this.publication = Object.freeze(
      displayAddress === undefined ? {} : { displayAddress },
    );

    input.server.on("error", (cause) => {
      if (this.#terminal !== undefined) return;
      this.#commitTerminal({
        origin: "carrier",
        kind: "io-failure",
        diagnostic: { code: "LISTENER_IO_FAILURE" },
      }, cause);
      this.#stopAccepting();
    });
    input.server.on("close", () => {
      if (this.#terminal !== undefined) return;
      if (this.#closeStarted) {
        this.#commitTerminal({ origin: "local", kind: "graceful" });
      } else {
        this.#commitTerminal({
          origin: "carrier",
          kind: "io-failure",
          diagnostic: { code: "LISTENER_CLOSED" },
        });
      }
    });
  }

  handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    if (!this.#accepting || this.#terminal !== undefined) {
      socket.destroy();
      return;
    }
    const expected = new URL(this.#config.url);
    if ((request.url ?? "/") !== `${expected.pathname}${expected.search}`) {
      rejectUpgrade(socket, 404);
      return;
    }
    if (!protocolOffered(request)) {
      rejectUpgrade(socket, 400);
      return;
    }
    if (
      this.#pending >= this.#options.limits.maxPendingAcquisitions
    ) {
      rejectUpgrade(socket, 503);
      this.#invokeCapacityRejected("pending-acquisition");
      return;
    }
    if (this.#active >= this.#options.limits.maxActiveChannels) {
      rejectUpgrade(socket, 503);
      this.#invokeCapacityRejected("active-channel");
      return;
    }

    this.#pending += 1;
    this.#pendingSockets.add(socket);
    setImmediate(() => {
      // Keep the reservation through one complete carrier-I/O turn. That
      // gives maxPendingAcquisitions a real, observable meaning even when
      // Node dispatches ready upgrade sockets across adjacent poll turns.
      setImmediate(() => {
        if (!this.#pendingSockets.delete(socket)) return;
        this.#pending = Math.max(0, this.#pending - 1);
        if (!this.#accepting || this.#terminal !== undefined) {
          socket.destroy();
          return;
        }
        try {
          this.#webSockets.handleUpgrade(
            request,
            socket,
            head,
            (webSocket) => {
              this.#commitUpgradedSocket(webSocket);
            },
          );
        } catch (cause) {
          socket.destroy();
          this.#commitTerminal({
            origin: "carrier",
            kind: "adapter-fault",
            diagnostic: { code: "UPGRADE_FAILED" },
          }, cause);
          this.#stopAccepting();
        }
      });
    });
  }

  waitTerminal(signal: AbortSignal): Promise<TransportListenerTerminal> {
    if (this.#terminal !== undefined) {
      return Promise.resolve(this.#terminal);
    }
    if (signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "wait-terminal",
        "listener terminal wait was cancelled",
      ));
    }
    return new Promise<TransportListenerTerminal>((resolve, reject) => {
      let settled = false;
      const waiter: ListenerTerminalWaiter = {
        resolve: (terminal) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", onAbort);
          this.#terminalWaiters.delete(waiter);
          resolve(terminal);
        },
      };
      const onAbort = (): void => {
        if (settled || this.#terminal !== undefined) return;
        settled = true;
        this.#terminalWaiters.delete(waiter);
        reject(operationError(
          "OPERATION_ABORTED",
          "wait-terminal",
          "listener terminal wait was cancelled",
        ));
      };
      this.#terminalWaiters.add(waiter);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
      if (this.#terminal !== undefined) waiter.resolve(this.#terminal);
    });
  }

  close(signal: AbortSignal): Promise<TransportListenerTerminal> {
    if (this.#terminal !== undefined) {
      return Promise.resolve(this.#terminal);
    }
    if (!this.#closeStarted && signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "close",
        "listener close was cancelled before initiation",
      ));
    }
    if (!this.#closeStarted) {
      this.#closeStarted = true;
      this.#stopAccepting();
      this.#closeServer();
      if (this.#terminal === undefined) {
        this.#commitTerminal({ origin: "local", kind: "graceful" });
      }
    }
    if (this.#terminal !== undefined) {
      return Promise.resolve(this.#terminal);
    }
    return new Promise<TransportListenerTerminal>((resolve) => {
      let settled = false;
      const waiter: ListenerTerminalWaiter = {
        resolve: (terminal) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", onAbort);
          this.#terminalWaiters.delete(waiter);
          resolve(terminal);
        },
      };
      const onAbort = (): void => {
        if (settled) return;
        this.abort({ kind: "deadline", code: "LISTENER_CLOSE_ABORTED" });
      };
      this.#terminalWaiters.add(waiter);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
      if (this.#terminal !== undefined) waiter.resolve(this.#terminal);
    });
  }

  abort(intent: TransportAbortIntent): void {
    try {
      this.#commitTerminal({
        origin: "local",
        kind: "aborted",
        diagnostic: { code: intent.code },
      });
      this.#stopAccepting();
      this.#closeServer();
    } catch {
      // Abort remains synchronous, idempotent, and total.
    }
  }

  #commitUpgradedSocket(webSocket: WebSocket): void {
    if (!this.#accepting || this.#terminal !== undefined) {
      webSocket.terminate();
      return;
    }
    if (this.#active >= this.#options.limits.maxActiveChannels) {
      webSocket.terminate();
      this.#invokeCapacityRejected("active-channel");
      return;
    }
    this.#active += 1;
    const channel = new NodeWsChannel({
      socket: webSocket,
      limits: this.#options.limits.channel,
      ...(this.#diagnostics === undefined
        ? {}
        : { diagnostics: this.#diagnostics }),
      ...(this.#config.liveness === undefined
        ? {}
        : { liveness: this.#config.liveness }),
      onPhysicalClose: () => {
        this.#active = Math.max(0, this.#active - 1);
      },
    });
    try {
      this.#callbacks.accept({ channel });
    } catch (cause) {
      channel.abort({
        kind: "invariant",
        code: "ACCEPT_CALLBACK_FAILED",
      });
      this.#callbackFault("ACCEPT_CALLBACK_FAILED", cause);
    }
  }

  #invokeCapacityRejected(
    kind: "pending-acquisition" | "active-channel",
  ): void {
    if (!this.#accepting || this.#terminal !== undefined) return;
    try {
      this.#callbacks.capacityRejected(kind);
    } catch (cause) {
      this.#callbackFault(
        "CAPACITY_REJECTED_CALLBACK_FAILED",
        cause,
      );
    }
  }

  #callbackFault(
    code: "ACCEPT_CALLBACK_FAILED" | "CAPACITY_REJECTED_CALLBACK_FAILED",
    cause: unknown,
  ): void {
    this.#stopAccepting();
    this.#commitTerminal({
      origin: "carrier",
      kind: "adapter-fault",
      diagnostic: { code },
    });
    emitTransportDiagnostic(this.#diagnostics, { code }, cause);
    this.#closeServer();
  }

  #stopAccepting(): void {
    if (!this.#accepting) return;
    this.#accepting = false;
    this.#server.off("upgrade", this.#upgrade);
    for (const socket of this.#pendingSockets) socket.destroy();
    this.#pendingSockets.clear();
    this.#pending = 0;
  }

  #closeServer(): void {
    try {
      this.#server.close((error) => {
        if (error !== undefined && this.#terminal === undefined) {
          this.#commitTerminal({
            origin: "carrier",
            kind: "io-failure",
            diagnostic: { code: "LISTENER_CLOSE_FAILED" },
          }, error);
        }
      });
    } catch (cause) {
      if (
        cause instanceof Error
        && "code" in cause
        && cause.code === "ERR_SERVER_NOT_RUNNING"
      ) {
        if (this.#closeStarted && this.#terminal === undefined) {
          this.#commitTerminal({ origin: "local", kind: "graceful" });
        }
        return;
      }
      if (this.#terminal === undefined) {
        this.#commitTerminal({
          origin: "carrier",
          kind: "adapter-fault",
          diagnostic: { code: "LISTENER_CLOSE_FAILED" },
        }, cause);
      }
    }
  }

  #commitTerminal(
    value: TransportListenerTerminal,
    cause?: unknown,
  ): void {
    if (this.#terminal !== undefined) return;
    const diagnostic = value.diagnostic === undefined
      ? undefined
      : Object.freeze({ ...value.diagnostic });
    this.#terminal = Object.freeze({
      ...value,
      ...(diagnostic === undefined ? {} : { diagnostic }),
    }) as TransportListenerTerminal;
    for (const waiter of this.#terminalWaiters) {
      waiter.resolve(this.#terminal);
    }
    this.#terminalWaiters.clear();
    if (value.diagnostic !== undefined && cause !== undefined) {
      emitTransportDiagnostic(this.#diagnostics, value.diagnostic, cause);
    }
  }
}

function protocolOffered(request: IncomingMessage): boolean {
  const header = request.headers["sec-websocket-protocol"];
  if (typeof header !== "string") return false;
  return header.split(",").some(
    (token) => token.trim() === AGP_WEBSOCKET_SUBPROTOCOL,
  );
}

function listenHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function boundDisplayAddress(
  server: HttpServer,
  configuredUrl: string,
): string | undefined {
  const address = server.address();
  if (address === null || typeof address === "string") return undefined;
  const url = new URL(configuredUrl);
  if (
    url.hostname === "0.0.0.0"
    || url.hostname === "[::]"
    || url.hostname === "::"
  ) {
    return undefined;
  }
  url.port = String((address as AddressInfo).port);
  return url.toString();
}

function assertListenerLimits(options: TransportListenOptions): void {
  for (const [name, value] of Object.entries({
    ...options.limits,
    ...options.limits.channel,
  })) {
    if (
      name === "channel"
      || !Number.isSafeInteger(value)
      || (typeof value === "number" && value <= 0)
    ) {
      if (name === "channel") continue;
      throw new NodeWsConfigurationError(
        "LIMITS_INVALID",
        `listener limit ${name} must be a positive safe integer`,
      );
    }
  }
  if (
    options.limits.channel.maxBufferedBytes
      < options.limits.channel.maxPacketBytes
  ) {
    throw new NodeWsConfigurationError(
      "LIMITS_INVALID",
      "maxBufferedBytes must admit one maximum packet",
    );
  }
}
