import {
  classifyWebSocketMessage,
  classifyWebSocketNativeInputFailure,
  TRUSTED_DEVELOPMENT_PEER_EVIDENCE,
  webSocketCloseAction,
  webSocketReceiveOverflowAction,
} from "@agp/binding-websocket";
import {
  emitTransportDiagnostic,
} from "@agp/transport";
import type {
  TransportAbortIntent,
  TransportChannelLimits,
  TransportChannelPort,
  TransportCloseIntent,
  TransportDiagnosticSinkPort,
  TransportInputRejected,
  TransportPeerEvidence,
  TransportPacket,
  TransportRead,
  TransportTerminal,
} from "@agp/transport";
import WebSocket, { type RawData } from "ws";

import { operationError } from "./errors.js";
import { rawDataSnapshot } from "./native.js";

interface PendingRead {
  readonly resolve: (value: TransportRead) => void;
  readonly reject: (reason: unknown) => void;
  readonly signal: AbortSignal;
  readonly onAbort: () => void;
}

interface PendingSend {
  dispatched: boolean;
  settled: boolean;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
  readonly signal: AbortSignal;
  readonly onAbort: () => void;
}

interface QueuedRead {
  readonly value: TransportRead;
  readonly packetBytes: number;
}

interface TerminalWaiter {
  readonly resolve: (terminal: TransportTerminal) => void;
}

type WebSocketError = Error & { readonly code?: string };

export class NodeWsChannel implements TransportChannelPort {
  readonly #socket: WebSocket;
  readonly #limits: TransportChannelLimits;
  readonly #diagnostics: TransportDiagnosticSinkPort | undefined;
  readonly #onPhysicalClose: () => void;
  readonly #queue: QueuedRead[] = [];
  readonly #terminalWaiters = new Set<TerminalWaiter>();
  readonly #liveness:
    | {
        readonly pingIntervalMs: number;
        readonly pongTimeoutMs: number;
      }
    | undefined;

  #bufferedPackets = 0;
  #bufferedBytes = 0;
  #pendingRead: PendingRead | undefined;
  #pendingSend: PendingSend | undefined;
  #terminal: TransportTerminal | undefined;
  #physicalReleased = false;
  #paused = false;
  #closeStarted = false;
  #closeIntent: TransportCloseIntent | undefined;
  #pingInterval: ReturnType<typeof setInterval> | undefined;
  #pongDeadline: ReturnType<typeof setTimeout> | undefined;

  readonly peerEvidence: TransportPeerEvidence;

  constructor(input: {
    readonly socket: WebSocket;
    readonly limits: TransportChannelLimits;
    readonly diagnostics?: TransportDiagnosticSinkPort;
    readonly liveness?: {
      readonly pingIntervalMs: number;
      readonly pongTimeoutMs: number;
    };
    readonly onPhysicalClose?: () => void;
    readonly peerEvidence?: TransportPeerEvidence;
  }) {
    this.peerEvidence = input.peerEvidence ?? TRUSTED_DEVELOPMENT_PEER_EVIDENCE;
    this.#socket = input.socket;
    this.#limits = input.limits;
    this.#diagnostics = input.diagnostics;
    this.#liveness = input.liveness;
    this.#onPhysicalClose = input.onPhysicalClose ?? (() => undefined);

    input.socket.on("message", (data, isBinary) => {
      this.#onMessage(data, isBinary);
    });
    input.socket.on("error", (error: WebSocketError) => {
      this.#onError(error);
    });
    input.socket.on("close", (code) => {
      this.#onClose(code);
    });
    input.socket.on("pong", () => {
      this.#onPong();
    });
    if (input.socket.readyState === WebSocket.OPEN) this.#startLiveness();
    else input.socket.once("open", () => this.#startLiveness());
  }

  send(packet: TransportPacket, signal: AbortSignal): Promise<void> {
    let snapshot: Uint8Array;
    try {
      snapshot = Uint8Array.from(packet.bytes);
    } catch (cause) {
      return Promise.reject(operationError(
        "ADAPTER_FAULT",
        "send",
        "packet bytes could not be snapshotted",
        { acceptance: "not-accepted", cause },
      ));
    }
    if (snapshot.byteLength > this.#limits.maxPacketBytes) {
      return Promise.reject(operationError(
        "PACKET_TOO_LARGE",
        "send",
        "packet exceeds the configured channel limit",
        { acceptance: "not-accepted" },
      ));
    }
    if (
      this.#terminal !== undefined
      || this.#closeStarted
      || this.#socket.readyState !== WebSocket.OPEN
    ) {
      return Promise.reject(operationError(
        "CHANNEL_TERMINAL",
        "send",
        "channel is closing or terminal",
        { acceptance: "not-accepted" },
      ));
    }
    if (this.#pendingSend !== undefined) {
      return Promise.reject(operationError(
        "CONCURRENT_OPERATION",
        "send",
        "one send is already active",
        { acceptance: "not-accepted" },
      ));
    }
    if (signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "send",
        "send was cancelled before dispatch",
        { acceptance: "not-accepted" },
      ));
    }

    return new Promise<void>((resolve, reject) => {
      const pending: PendingSend = {
        dispatched: false,
        settled: false,
        resolve,
        reject,
        signal,
        onAbort: () => this.#cancelSend(pending),
      };
      this.#pendingSend = pending;
      signal.addEventListener("abort", pending.onAbort, { once: true });
      if (signal.aborted) {
        this.#cancelSend(pending);
        return;
      }
      try {
        this.#socket.send(
          snapshot,
          { binary: true, compress: false },
          (error?: Error) => this.#completeSend(pending, error),
        );
        pending.dispatched = true;
      } catch (cause) {
        this.#settleSendFailure(pending, "not-accepted", cause);
      }
    });
  }

  read(signal: AbortSignal): Promise<TransportRead> {
    if (this.#terminal !== undefined && this.#queue.length === 0) {
      return Promise.resolve({
        kind: "terminal",
        terminal: this.#terminal,
      });
    }
    if (this.#pendingRead !== undefined) {
      return Promise.reject(operationError(
        "CONCURRENT_OPERATION",
        "read",
        "one read is already active",
      ));
    }
    if (signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "read",
        "read wait was cancelled",
      ));
    }
    const queued = this.#queue.shift();
    if (queued !== undefined) {
      this.#releaseQueuedBudget(queued);
      return Promise.resolve(queued.value);
    }
    return new Promise<TransportRead>((resolve, reject) => {
      const pending: PendingRead = {
        resolve,
        reject,
        signal,
        onAbort: () => {
          if (this.#pendingRead !== pending) return;
          this.#pendingRead = undefined;
          signal.removeEventListener("abort", pending.onAbort);
          reject(operationError(
            "OPERATION_ABORTED",
            "read",
            "read wait was cancelled",
          ));
        },
      };
      this.#pendingRead = pending;
      signal.addEventListener("abort", pending.onAbort, { once: true });
      if (signal.aborted) pending.onAbort();
    });
  }

  close(
    intent: TransportCloseIntent,
    signal: AbortSignal,
  ): Promise<TransportTerminal> {
    if (this.#terminal !== undefined) {
      return Promise.resolve(this.#terminal);
    }
    if (!this.#closeStarted && this.#pendingSend !== undefined) {
      return Promise.reject(operationError(
        "CONCURRENT_OPERATION",
        "close",
        "close cannot begin while a send is active",
      ));
    }
    if (!this.#closeStarted && signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "close",
        "close was cancelled before initiation",
      ));
    }
    if (!this.#closeStarted) {
      this.#closeStarted = true;
      this.#closeIntent = intent;
      const action = webSocketCloseAction(intent);
      try {
        if (this.#socket.readyState === WebSocket.OPEN) {
          this.#socket.close(action.code, action.reason);
        } else if (this.#socket.readyState === WebSocket.CLOSED) {
          this.#commitTerminal({
            origin: "carrier",
            kind: "io-failure",
            diagnostic: { code: "CARRIER_CLOSED" },
          });
        } else {
          this.#socket.terminate();
          this.#commitTerminal({
            origin: "carrier",
            kind: "io-failure",
            diagnostic: { code: "CLOSE_FAILED" },
          });
        }
      } catch (cause) {
        this.#commitTerminal({
          origin: "carrier",
          kind: "io-failure",
          diagnostic: { code: "CLOSE_FAILED" },
        }, cause);
        this.#terminateNative();
      }
    }
    if (this.#terminal !== undefined) {
      return Promise.resolve(this.#terminal);
    }
    return this.#waitForTerminalWithCloseSignal(signal);
  }

  abort(intent: TransportAbortIntent): void {
    try {
      this.#commitTerminal({
        origin: "local",
        kind: "aborted",
        diagnostic: { code: intent.code },
      });
      this.#terminateNative();
    } catch {
      // Abort is total local authority and never throws.
    }
  }

  #onMessage(data: RawData, isBinary: boolean): void {
    if (this.#terminal !== undefined) return;
    let bytes: Uint8Array;
    try {
      bytes = rawDataSnapshot(data);
    } catch (cause) {
      this.#commitTerminal({
        origin: "carrier",
        kind: "adapter-fault",
        diagnostic: { code: "MESSAGE_SNAPSHOT_FAILED" },
      }, cause);
      this.#terminateNative();
      return;
    }
    const result = classifyWebSocketMessage({
      bytes,
      isBinary,
      maxPacketBytes: this.#limits.maxPacketBytes,
    });
    if (result.kind === "input-rejected") {
      this.#commitInputRejection(
        result.rejection,
        result.terminal,
        result.close,
      );
      return;
    }
    this.#admitPacket(result.packet);
  }

  #admitPacket(packet: TransportPacket): void {
    const packetBytes = packet.bytes.byteLength;
    if (
      this.#pendingRead === undefined
      && (
        this.#bufferedPackets + 1 > this.#limits.maxBufferedPackets
        || this.#bufferedBytes + packetBytes > this.#limits.maxBufferedBytes
      )
    ) {
      this.#receiveOverflow();
      return;
    }
    this.#deliverOrQueue(
      Object.freeze({ kind: "packet", packet }),
      packetBytes,
    );
    if (
      this.#pendingRead === undefined
      && (
        this.#bufferedPackets >= this.#limits.maxBufferedPackets
        || this.#bufferedBytes >= this.#limits.maxBufferedBytes
      )
    ) {
      this.#pauseNative();
    }
  }

  #commitInputRejection(
    rejection: TransportInputRejected,
    terminal: TransportTerminal,
    close: { readonly code: number; readonly reason: string },
  ): void {
    this.#deliverOrQueue(rejection, 0);
    this.#commitTerminal(terminal);
    try {
      if (this.#socket.readyState === WebSocket.OPEN) {
        this.#socket.close(close.code, close.reason);
      } else {
        this.#terminateNative();
      }
    } catch {
      this.#terminateNative();
    }
  }

  #deliverOrQueue(value: TransportRead, packetBytes: number): void {
    const pending = this.#pendingRead;
    if (pending !== undefined) {
      this.#pendingRead = undefined;
      pending.signal.removeEventListener("abort", pending.onAbort);
      pending.resolve(value);
      return;
    }
    this.#queue.push({ value, packetBytes });
    if (packetBytes > 0) {
      this.#bufferedPackets += 1;
      this.#bufferedBytes += packetBytes;
    }
  }

  #releaseQueuedBudget(value: QueuedRead): void {
    if (value.packetBytes === 0) return;
    this.#bufferedPackets -= 1;
    this.#bufferedBytes -= value.packetBytes;
    if (
      this.#paused
      && this.#terminal === undefined
      && this.#bufferedPackets < this.#limits.maxBufferedPackets
      && this.#bufferedBytes < this.#limits.maxBufferedBytes
    ) {
      this.#paused = false;
      try {
        this.#socket.resume();
      } catch (cause) {
        this.#commitTerminal({
          origin: "carrier",
          kind: "adapter-fault",
          diagnostic: { code: "RESUME_FAILED" },
        }, cause);
        this.#terminateNative();
      }
    }
  }

  #pauseNative(): void {
    if (this.#paused) return;
    try {
      this.#socket.pause();
      this.#paused = true;
    } catch (cause) {
      this.#commitTerminal({
        origin: "carrier",
        kind: "adapter-fault",
        diagnostic: { code: "PAUSE_FAILED" },
      }, cause);
      this.#terminateNative();
    }
  }

  #receiveOverflow(): void {
    this.#commitTerminal({
      origin: "local",
      kind: "resource-exhausted",
      diagnostic: { code: "RECEIVE_OVERFLOW" },
    });
    const action = webSocketReceiveOverflowAction();
    try {
      if (this.#socket.readyState === WebSocket.OPEN) {
        this.#socket.close(action.code, action.reason);
      } else {
        this.#terminateNative();
      }
    } catch {
      this.#terminateNative();
    }
  }

  #onError(error: WebSocketError): void {
    if (this.#terminal !== undefined) return;
    const rejection = classifyWebSocketNativeInputFailure(error.code);
    if (rejection !== undefined) {
      this.#commitInputRejection(
        rejection.rejection,
        rejection.terminal,
        rejection.close,
      );
      return;
    }
    this.#commitTerminal({
      origin: "carrier",
      kind: "io-failure",
      diagnostic: { code: "CARRIER_IO_FAILURE" },
    }, error);
  }

  #onClose(code: number): void {
    this.#releasePhysical();
    if (this.#terminal !== undefined) return;
    if (code === 1006) {
      this.#commitTerminal({
        origin: "carrier",
        kind: "io-failure",
        diagnostic: { code: "CARRIER_CLOSED" },
      });
      return;
    }
    if (this.#closeStarted) {
      this.#commitTerminal({
        origin: "local",
        kind: "graceful",
        ...(this.#closeIntent === undefined
          ? {}
          : { diagnostic: { code: this.#closeIntent.code } }),
      });
      return;
    }
    this.#commitTerminal({
      origin: "remote",
      kind: "graceful",
      diagnostic: { code: "PEER_CLOSED" },
    });
  }

  #commitTerminal(terminal: TransportTerminal, cause?: unknown): void {
    if (this.#terminal !== undefined) return;
    this.#terminal = freezeTerminal(terminal);
    this.#stopLiveness();
    const pendingSend = this.#pendingSend;
    if (pendingSend !== undefined) {
      this.#settleSendFailure(
        pendingSend,
        pendingSend.dispatched ? "unknown" : "not-accepted",
        cause,
        false,
      );
    }
    if (this.#pendingRead !== undefined && this.#queue.length === 0) {
      const pending = this.#pendingRead;
      this.#pendingRead = undefined;
      pending.signal.removeEventListener("abort", pending.onAbort);
      pending.resolve({ kind: "terminal", terminal: this.#terminal });
    }
    for (const waiter of this.#terminalWaiters) {
      waiter.resolve(this.#terminal);
    }
    this.#terminalWaiters.clear();
    if (terminal.diagnostic !== undefined && cause !== undefined) {
      emitTransportDiagnostic(
        this.#diagnostics,
        terminal.diagnostic,
        cause,
      );
    }
  }

  #cancelSend(pending: PendingSend): void {
    if (pending.settled || this.#pendingSend !== pending) return;
    if (!pending.dispatched) {
      this.#finishPendingSend(pending);
      pending.reject(operationError(
        "OPERATION_ABORTED",
        "send",
        "send was cancelled before dispatch",
        { acceptance: "not-accepted" },
      ));
      return;
    }
    this.#settleSendFailure(pending, "unknown");
  }

  #completeSend(pending: PendingSend, error?: Error): void {
    if (pending.settled || this.#pendingSend !== pending) return;
    if (error != null) {
      this.#settleSendFailure(pending, "unknown", error);
      return;
    }
    this.#finishPendingSend(pending);
    pending.resolve();
  }

  #settleSendFailure(
    pending: PendingSend,
    acceptance: "not-accepted" | "unknown",
    cause?: unknown,
    commit = true,
  ): void {
    if (pending.settled) return;
    this.#finishPendingSend(pending);
    pending.reject(operationError(
      "SEND_FAILED",
      "send",
      "WebSocket send did not reach a proven acceptance point",
      { acceptance, cause },
    ));
    if (commit && this.#terminal === undefined) {
      this.#commitTerminal({
        origin: "carrier",
        kind: "io-failure",
        diagnostic: { code: "SEND_FAILED" },
      }, cause);
      this.#terminateNative();
    }
  }

  #finishPendingSend(pending: PendingSend): void {
    pending.settled = true;
    pending.signal.removeEventListener("abort", pending.onAbort);
    if (this.#pendingSend === pending) this.#pendingSend = undefined;
  }

  #waitForTerminalWithCloseSignal(
    signal: AbortSignal,
  ): Promise<TransportTerminal> {
    return new Promise<TransportTerminal>((resolve) => {
      let settled = false;
      const waiter: TerminalWaiter = {
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
        this.abort({ kind: "deadline", code: "CLOSE_ABORTED" });
      };
      this.#terminalWaiters.add(waiter);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
      if (this.#terminal !== undefined) waiter.resolve(this.#terminal);
    });
  }

  #startLiveness(): void {
    if (
      this.#liveness === undefined
      || this.#pingInterval !== undefined
      || this.#terminal !== undefined
    ) {
      return;
    }
    this.#pingInterval = setInterval(() => {
      if (
        this.#terminal !== undefined
        || this.#socket.readyState !== WebSocket.OPEN
      ) {
        return;
      }
      if (this.#pongDeadline !== undefined) return;
      try {
        this.#socket.ping();
        this.#pongDeadline = setTimeout(() => {
          this.#pongDeadline = undefined;
          this.#commitTerminal({
            origin: "carrier",
            kind: "io-failure",
            diagnostic: { code: "PONG_TIMEOUT" },
          });
          this.#terminateNative();
        }, this.#liveness?.pongTimeoutMs);
      } catch (cause) {
        this.#commitTerminal({
          origin: "carrier",
          kind: "io-failure",
          diagnostic: { code: "PING_FAILED" },
        }, cause);
        this.#terminateNative();
      }
    }, this.#liveness.pingIntervalMs);
    this.#pingInterval.unref?.();
  }

  #onPong(): void {
    if (this.#pongDeadline === undefined) return;
    clearTimeout(this.#pongDeadline);
    this.#pongDeadline = undefined;
  }

  #stopLiveness(): void {
    if (this.#pingInterval !== undefined) {
      clearInterval(this.#pingInterval);
      this.#pingInterval = undefined;
    }
    if (this.#pongDeadline !== undefined) {
      clearTimeout(this.#pongDeadline);
      this.#pongDeadline = undefined;
    }
  }

  #terminateNative(): void {
    try {
      if (this.#socket.readyState !== WebSocket.CLOSED) {
        this.#socket.terminate();
      }
    } catch {
      // Stable terminal ownership cannot be replaced by cleanup failure.
    }
  }

  #releasePhysical(): void {
    if (this.#physicalReleased) return;
    this.#physicalReleased = true;
    try {
      this.#onPhysicalClose();
    } catch (cause) {
      emitTransportDiagnostic(
        this.#diagnostics,
        { code: "PHYSICAL_RELEASE_CALLBACK_FAILED" },
        cause,
      );
    }
  }
}

function freezeTerminal(value: TransportTerminal): TransportTerminal {
  const diagnostic = value.diagnostic === undefined
    ? undefined
    : Object.freeze({ ...value.diagnostic });
  return Object.freeze({
    ...value,
    ...(diagnostic === undefined ? {} : { diagnostic }),
  }) as TransportTerminal;
}
