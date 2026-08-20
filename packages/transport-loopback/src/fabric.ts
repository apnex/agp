import {
  emitTransportDiagnostic,
  type PeerTransportPort,
  type TransportAbortIntent,
  type TransportAcceptCallbacks,
  type TransportAcquisitionOptions,
  type TransportChannelLimits,
  type TransportChannelPort,
  type TransportCloseIntent,
  type TransportConnectCapability,
  type TransportDiagnostic,
  type TransportDiagnosticSinkPort,
  type TransportListenCapability,
  type TransportListenerPort,
  type TransportListenerTerminal,
  type TransportListenOptions,
  type TransportPacket,
  type TransportPeerEvidence,
  type TransportRead,
  type TransportRef,
  type TransportTerminal,
} from "@agp/transport";

import {
  LAST_ORDINARY_REVISION,
  MonotonicDomains,
  MonotonicExhaustion,
  type MonotonicSeed,
  UNSIGNED_64_MAX,
} from "./domain.js";
import { configurationError, operationError } from "./errors.js";
import { asyncTurn, deepFreeze, immutableBytes } from "./immutable.js";
import {
  snapshot as createOperationsSnapshot,
  type ChannelOperationsView,
  type FabricOperationsView,
  type ListenerOperationsView,
} from "./operations.js";
import type {
  LoopbackCounterKey,
  LoopbackFabricConfig,
  LoopbackFabricFailureSnapshot,
  LoopbackFabricSnapshot,
  LoopbackListenerConfig,
  LoopbackTargetConfig,
  LoopbackTransportConfig,
} from "./types.generated.js";
import type {
  LoopbackFabric,
  LoopbackFabricDependencies,
  LoopbackPortOptions,
  LoopbackTransportBuilder,
} from "./types.js";
import {
  validateBoundConfig,
  validateChannelLimits,
  validateFabricConfig,
  validateListenOptions,
  validateReference,
  validateTransportConfig,
} from "./validation.js";

type FabricState = "Running" | "Closing" | "Closed" | "Failed";
type Side = "left" | "right";
type CounterDeltas = Readonly<
  Partial<Record<LoopbackCounterKey, bigint>>
>;

const FAILURE_DIAGNOSTIC = deepFreeze({
  code: "MONOTONIC_DOMAIN_EXHAUSTED",
} satisfies TransportDiagnostic);
const ADAPTER_FAULT_DIAGNOSTIC = deepFreeze({
  code: "ADAPTER_FAULT",
} satisfies TransportDiagnostic);
const PEER_ABORTED_DIAGNOSTIC = deepFreeze({
  code: "PEER_ABORTED",
} satisfies TransportDiagnostic);

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

interface MutationResult {
  readonly committed: boolean;
  readonly firstArbitrationSequence?: bigint;
}

interface PendingSend {
  readonly pair: ChannelPair;
  readonly sender: ChannelEndpoint;
  readonly receiver: ChannelEndpoint;
  readonly bytes: Readonly<Uint8Array>;
  readonly signal: AbortSignal;
  readonly deferred: Deferred<void>;
  sequence: bigint | undefined;
  signalHandler: (() => void) | undefined;
  state: "precommit" | "pending" | "accepted" | "settled";
}

interface PendingRead {
  readonly signal: AbortSignal;
  readonly deferred: Deferred<TransportRead>;
  signalHandler: (() => void) | undefined;
  scheduled: boolean;
}

interface PacketRecord {
  readonly bytes: Readonly<Uint8Array>;
}

export function createLoopbackFabric(
  config: LoopbackFabricConfig,
  dependencies: LoopbackFabricDependencies = {},
): LoopbackFabric {
  return new LoopbackFabricRuntime(config, dependencies);
}

/**
 * Package-private certification seam. It is intentionally not re-exported by
 * the package root and cannot be expressed by production configuration.
 */
export function createLoopbackFabricWithMonotonicSeedForTest(
  config: LoopbackFabricConfig,
  dependencies: LoopbackFabricDependencies,
  seed: MonotonicSeed,
): LoopbackFabric {
  if (
    seed.revision !== undefined
    && seed.revision > LAST_ORDINARY_REVISION
  ) {
    throw new RangeError(
      "A running test fabric cannot begin at the failure barrier",
    );
  }
  return new LoopbackFabricRuntime(config, dependencies, seed);
}

/** Package-private certification seam; not exported from the package root. */
export function failLoopbackFabricForTest(
  fabric: LoopbackFabric,
  code: string,
  cause?: unknown,
): void {
  if (!(fabric instanceof LoopbackFabricRuntime)) {
    throw new TypeError("Test fabric is not a production Loopback fabric");
  }
  fabric.failAdapterInvariant(code, cause);
}

class LoopbackFabricRuntime implements LoopbackFabric {
  readonly fabricId: string;
  readonly #config: LoopbackFabricConfig;
  readonly #diagnostics: TransportDiagnosticSinkPort | undefined;
  readonly #domains: MonotonicDomains;
  readonly #transportNames = new Set<string>();
  readonly #listenersByAddress = new Map<string, ListenerRuntime>();
  readonly #listenerRows = new Set<ListenerRuntime>();
  readonly #channels = new Map<string, ChannelPair>();
  readonly #pendingConnections = new Set<PendingConnection>();
  readonly #pendingSends: PendingSend[] = [];
  readonly #resources = {
    pendingAcquisitions: 0,
    activeChannels: 0,
    pendingSendBytes: 0,
    queuedPackets: 0,
    queuedBytes: 0,
  };

  #state: FabricState = "Running";
  #failure: LoopbackFabricFailureSnapshot | undefined;
  #frozenFailureSnapshot: LoopbackFabricSnapshot | undefined;
  #nextListenerIdentity = 1n;
  #nextChannelIdentity = 1n;
  #reservedActiveChannels = 0;
  #scheduledWork = 0;
  #closeCompletion: Deferred<void> | undefined;
  #failureCleanup: Deferred<void> | undefined;
  #failureCleanupComplete = false;
  #completionCheckScheduled = false;

  constructor(
    config: LoopbackFabricConfig,
    dependencies: LoopbackFabricDependencies,
    seed: MonotonicSeed = {},
  ) {
    validateFabricConfig(config);
    this.#config = deepFreeze({
      fabricId: config.fabricId,
      limits: { ...config.limits },
    });
    this.fabricId = this.#config.fabricId;
    this.#diagnostics = dependencies.diagnostics;
    this.#domains = new MonotonicDomains(seed);
  }

  createTransport(
    config: LoopbackTransportConfig,
  ): LoopbackTransportBuilder {
    validateTransportConfig(config);
    if (this.#state !== "Running") {
      throw configurationError("Loopback fabric is not accepting transports");
    }
    if (this.#transportNames.has(config.transportName)) {
      throw configurationError(
        `Loopback transport name is already reserved: ${config.transportName}`,
      );
    }
    if (this.#transportNames.size >= this.#config.limits.maxTransports) {
      throw configurationError("Loopback transport capacity is exhausted");
    }
    const captured = deepFreeze({
      transportName: config.transportName,
      capabilities: { ...config.capabilities },
    });
    this.#transportNames.add(captured.transportName);
    return new TransportBuilderRuntime(this, captured);
  }

  snapshot(): LoopbackFabricSnapshot {
    if (this.#frozenFailureSnapshot !== undefined) {
      return this.#frozenFailureSnapshot;
    }
    return createOperationsSnapshot(this.#operationsView());
  }

  close(signal: AbortSignal): Promise<void> {
    if (this.#state === "Closed") {
      return asyncTurn();
    }
    if (this.#state === "Failed") {
      return waitFor(
        this.#failureCleanup?.promise ?? asyncTurn(),
        signal,
        "close",
        () => this.#failureCleanupComplete,
      );
    }
    if (this.#state === "Running") {
      if (signal.aborted) {
        return Promise.reject(
          operationError(
            "OPERATION_ABORTED",
            "close",
            "Loopback fabric close was cancelled before initiation",
          ),
        );
      }
      this.#closeCompletion = deferred<void>();
      if (
        !this.#commitMutation({}, 0n, () => {
          this.#state = "Closing";
        }).committed
      ) {
        return waitFor(
          this.#failureCleanup?.promise ?? asyncTurn(),
          signal,
          "close",
          () => this.#failureCleanupComplete,
        );
      }
      for (const connection of [...this.#pendingConnections]) {
        connection.rejectForListenerClosure();
      }
      for (const listener of [...this.#listenerRows]) {
        listener.beginFabricClose();
      }
      this.#scheduleCompletionCheck();
    }
    return waitFor(
      this.#closeCompletion?.promise ?? asyncTurn(),
      signal,
      "close",
      () => this.#state === "Closed",
    );
  }

  createPort(
    transport: LoopbackTransportConfig,
    options: LoopbackPortOptions,
  ): PeerTransportPort {
    const listeners = new Map<
      TransportRef,
      TransportListenCapability
    >();
    const targets = new Map<
      TransportRef,
      TransportConnectCapability
    >();

    for (const [reference, value] of options.listeners) {
      validateReference(reference);
      if (!transport.capabilities.listen) {
        throw configurationError(
          "Listener binding is forbidden by transport capabilities",
        );
      }
      validateBoundConfig(this.fabricId, value, "listener");
      listeners.set(
        reference,
        new BoundListenCapability(
          this,
          transport.transportName,
          deepFreeze({ ...value }),
        ),
      );
    }
    for (const [reference, value] of options.targets) {
      validateReference(reference);
      if (listeners.has(reference)) {
        throw configurationError(
          `Logical transport reference is bound twice: ${reference}`,
        );
      }
      if (!transport.capabilities.connect) {
        throw configurationError(
          "Target binding is forbidden by transport capabilities",
        );
      }
      validateBoundConfig(this.fabricId, value, "target");
      targets.set(
        reference,
        new BoundConnectCapability(
          this,
          transport.transportName,
          deepFreeze({ ...value }),
        ),
      );
    }
    return new ResolverRuntime(listeners, targets);
  }

  listen(
    transportName: string,
    config: LoopbackListenerConfig,
    options: TransportListenOptions,
    callbacks: TransportAcceptCallbacks,
    signal: AbortSignal,
  ): Promise<TransportListenerPort> {
    try {
      validateListenOptions(options, this.#config.limits);
    } catch (cause) {
      return Promise.reject(
        operationError(
          "LISTEN_FAILED",
          "listen",
          "Loopback listener options are invalid",
          { cause },
        ),
      );
    }
    if (
      callbacks === null
      || typeof callbacks !== "object"
      || typeof callbacks.accept !== "function"
      || typeof callbacks.capacityRejected !== "function"
    ) {
      return Promise.reject(
        operationError(
          "LISTEN_FAILED",
          "listen",
          "Loopback listener callbacks are invalid",
        ),
      );
    }
    if (signal.aborted) {
      return Promise.reject(
        operationError(
          "OPERATION_ABORTED",
          "listen",
          "Loopback listen was cancelled before registration",
        ),
      );
    }
    if (
      this.#state !== "Running"
      || !this.#transportNames.has(transportName)
    ) {
      return Promise.reject(
        operationError(
          "BINDING_UNAVAILABLE",
          "listen",
          "Loopback listener binding is unavailable",
        ),
      );
    }
    if (this.#listenersByAddress.has(config.address)) {
      return Promise.reject(
        operationError(
          "BINDING_UNAVAILABLE",
          "listen",
          "Loopback listener address is already registered",
        ),
      );
    }
    if (this.#listenerRows.size >= this.#config.limits.maxListeners) {
      return Promise.reject(
        operationError(
          "CAPACITY_EXCEEDED",
          "listen",
          "Loopback listener capacity is exhausted",
        ),
      );
    }

    const listenerId = this.#allocateIdentity(
      "listener",
      this.#nextListenerIdentity,
    );
    const listener = new ListenerRuntime(
      this,
      listenerId,
      transportName,
      config.address,
      deepFreeze({
        limits: {
          maxPendingAcquisitions:
            options.limits.maxPendingAcquisitions,
          maxActiveChannels: options.limits.maxActiveChannels,
          channel: { ...options.limits.channel },
        },
      }),
      callbacks,
    );
    const committed = this.#commitMutation({}, 0n, () => {
      this.#nextListenerIdentity += 1n;
      this.#listenersByAddress.set(config.address, listener);
      this.#listenerRows.add(listener);
    }).committed;
    if (!committed) {
      return Promise.reject(this.#adapterFault("listen"));
    }
    return asyncTurn().then(() => listener);
  }

  connect(
    transportName: string,
    config: LoopbackTargetConfig,
    options: TransportAcquisitionOptions,
    signal: AbortSignal,
  ): Promise<TransportChannelPort> {
    try {
      validateChannelLimits(options.channel, this.#config.limits);
    } catch (cause) {
      return Promise.reject(
        operationError(
          "CONNECT_FAILED",
          "connect",
          "Loopback acquisition options are invalid",
          { cause },
        ),
      );
    }
    if (signal.aborted) {
      return Promise.reject(
        operationError(
          "OPERATION_ABORTED",
          "connect",
          "Loopback connect was cancelled before acquisition",
        ),
      );
    }
    if (
      this.#state !== "Running"
      || !this.#transportNames.has(transportName)
    ) {
      return Promise.reject(
        operationError(
          "BINDING_UNAVAILABLE",
          "connect",
          "Loopback target binding is unavailable",
        ),
      );
    }
    const listener = this.#listenersByAddress.get(config.address);
    if (listener === undefined || !listener.isListening) {
      return Promise.reject(
        operationError(
          "BINDING_UNAVAILABLE",
          "connect",
          "No live Loopback listener owns the target address",
        ),
      );
    }
    if (
      this.#pendingConnections.size
        >= this.#config.limits.maxPendingAcquisitions
    ) {
      if (!this.recordUnreservedRejection()) {
        return Promise.reject(this.#adapterFault("connect"));
      }
      // The hard fabric ceiling also bounds asynchronous rejection
      // dispositions. An invocation beyond it never acquires listener
      // authority and therefore has no callback authority to release.
      return Promise.reject(
        operationError(
          "CAPACITY_EXCEEDED",
          "connect",
          "Loopback fabric acquisition-disposition capacity is exhausted",
        ),
      );
    }

    const connection = new PendingConnection(
      this,
      listener,
      transportName,
      deepFreeze({ ...options.channel }),
      signal,
    );
    this.#pendingConnections.add(connection);
    connection.begin();
    return connection.promise;
  }

  reserveAcquisition(connection: PendingConnection): boolean {
    const listener = connection.listener;
    if (
      this.#state !== "Running"
      || !listener.isListening
      || this.#listenersByAddress.get(listener.address) !== listener
    ) {
      connection.rejectBindingUnavailable();
      return false;
    }
    if (
      this.#resources.pendingAcquisitions
        >= this.#config.limits.maxPendingAcquisitions
      || listener.pendingAcquisitions
        >= listener.options.limits.maxPendingAcquisitions
    ) {
      connection.queueCapacityRejection("pending-acquisition");
      return false;
    }
    if (
      this.#resources.activeChannels + this.#reservedActiveChannels
        >= this.#config.limits.maxActiveChannels
      || listener.activeChannels + listener.reservedActiveChannels
        >= listener.options.limits.maxActiveChannels
    ) {
      connection.queueCapacityRejection("active-channel");
      return false;
    }

    const committed = this.#commitMutation({}, 0n, () => {
      this.#resources.pendingAcquisitions += 1;
      this.#reservedActiveChannels += 1;
      listener.pendingAcquisitions += 1;
      listener.reservedActiveChannels += 1;
      connection.reserved = true;
    }).committed;
    if (!committed) {
      connection.rejectAdapterFault();
      return false;
    }

    const channelId = this.#allocateIdentity(
      "channel",
      this.#nextChannelIdentity,
    );
    // Identity ownership transfers to this acquisition reservation. Failed or
    // cancelled acquisitions deliberately do not recycle identities.
    this.#nextChannelIdentity += 1n;
    const pair = new ChannelPair(
      this,
      channelId,
      connection.connectingTransportName,
      listener.transportName,
      connection.connectingLimits,
      listener.options.limits.channel,
      listener,
    );
    connection.pair = pair;
    listener.enqueueConnection(connection);
    return true;
  }

  commitConnection(connection: PendingConnection): boolean {
    const pair = connection.pair;
    if (pair === undefined || !connection.reserved) {
      this.failAdapterInvariant("CONNECT_COMMIT_INVARIANT");
      return false;
    }
    const listener = connection.listener;
    const committed = this.#commitMutation(
      { connectionsAccepted: 1n },
      0n,
      () => {
        this.#resources.pendingAcquisitions -= 1;
        this.#resources.activeChannels += 1;
        this.#reservedActiveChannels -= 1;
        listener.pendingAcquisitions -= 1;
        listener.reservedActiveChannels -= 1;
        listener.activeChannels += 1;
        connection.reserved = false;
        pair.markCommitted();
        this.#channels.set(pair.channelId, pair);
      },
    ).committed;
    if (!committed) {
      pair.discardUncommitted(FAILURE_DIAGNOSTIC);
      return false;
    }
    pair.activateAfterCommit();
    return true;
  }

  releaseConnection(
    connection: PendingConnection,
    countRejected: boolean,
  ): void {
    if (!connection.reserved) {
      this.#pendingConnections.delete(connection);
      return;
    }
    const listener = connection.listener;
    const deltas = countRejected
      ? { connectionsRejected: 1n }
      : {};
    const committed = this.#commitMutation(deltas, 0n, () => {
      this.#resources.pendingAcquisitions -= 1;
      this.#reservedActiveChannels -= 1;
      listener.pendingAcquisitions -= 1;
      listener.reservedActiveChannels -= 1;
      connection.reserved = false;
    }).committed;
    if (!committed) {
      connection.rejectAdapterFault();
    }
    this.#pendingConnections.delete(connection);
    connection.pair?.discardUncommitted(
      this.#state === "Failed"
        ? FAILURE_DIAGNOSTIC
        : ADAPTER_FAULT_DIAGNOSTIC,
    );
    this.#scheduleCompletionCheck();
  }

  recordUnreservedRejection(): boolean {
    return this.#commitMutation(
      { connectionsRejected: 1n },
      0n,
      () => {},
    ).committed;
  }

  finishConnection(connection: PendingConnection): void {
    this.#pendingConnections.delete(connection);
    this.#scheduleCompletionCheck();
  }

  unregisterListener(listener: ListenerRuntime): void {
    if (this.#listenersByAddress.get(listener.address) === listener) {
      this.#listenersByAddress.delete(listener.address);
    }
  }

  commitListenerMutation(action: () => void): boolean {
    return this.#commitMutation({}, 0n, action).committed;
  }

  releaseListener(listener: ListenerRuntime): void {
    if (!this.#listenerRows.has(listener) || this.#state === "Failed") {
      return;
    }
    if (
      !this.#commitMutation({}, 0n, () => {
        this.#listenerRows.delete(listener);
        listener.releasePhysical();
      }).committed
    ) {
      return;
    }
    this.#scheduleCompletionCheck();
  }

  emitCallbackDiagnostic(
    code: "ACCEPT_CALLBACK_FAILED"
      | "CAPACITY_REJECTED_CALLBACK_FAILED",
    cause: unknown,
  ): void {
    this.#emit(deepFreeze({ code }), cause);
  }

  schedule(task: () => void): void {
    this.#scheduledWork += 1;
    queueMicrotask(() => {
      try {
        task();
      } catch (cause) {
        this.failAdapterInvariant("SCHEDULER_CALLBACK_FAILED", cause);
      } finally {
        this.#scheduledWork -= 1;
        this.#scheduleCompletionCheck();
      }
    });
  }

  createSend(
    pair: ChannelPair,
    sender: ChannelEndpoint,
    receiver: ChannelEndpoint,
    packet: TransportPacket,
    signal: AbortSignal,
  ): Promise<void> {
    if (sender.sendOperation !== undefined) {
      return Promise.reject(
        operationError(
          "CONCURRENT_OPERATION",
          "send",
          "A Loopback send is already in flight",
          { acceptance: "not-accepted" },
        ),
      );
    }
    if (
      sender.terminal !== undefined
      || !pair.admissionOpen
      || this.#state === "Failed"
    ) {
      return Promise.reject(
        operationError(
          "CHANNEL_TERMINAL",
          "send",
          "The Loopback channel is terminal",
          { acceptance: "not-accepted" },
        ),
      );
    }
    if (signal.aborted) {
      return Promise.reject(
        operationError(
          "OPERATION_ABORTED",
          "send",
          "Loopback send was cancelled before acceptance",
          { acceptance: "not-accepted" },
        ),
      );
    }
    if (
      !(packet.bytes instanceof Uint8Array)
      || packet.bytes.byteLength
        > Math.min(
          sender.limits.maxPacketBytes,
          receiver.limits.maxPacketBytes,
          this.#config.limits.maxPacketBytes,
        )
    ) {
      return Promise.reject(
        operationError(
          "PACKET_TOO_LARGE",
          "send",
          "Loopback packet exceeds the effective channel limit",
          { acceptance: "not-accepted" },
        ),
      );
    }

    // The complete caller-owned byte view is captured before this method
    // returns its promise.
    const bytes = immutableBytes(packet.bytes);
    const operation: PendingSend = {
      pair,
      sender,
      receiver,
      bytes,
      signal,
      deferred: deferred<void>(),
      state: pair.committed ? "pending" : "precommit",
      sequence: undefined,
      signalHandler: undefined,
    };
    sender.sendOperation = operation;
    const onAbort = (): void => {
      if (
        operation.state === "pending"
        || operation.state === "precommit"
      ) {
        this.#cancelSend(operation);
      }
    };
    operation.signalHandler = onAbort;
    signal.addEventListener("abort", onAbort, { once: true });

    if (pair.committed) {
      this.#activateSend(operation);
    } else {
      pair.precommitSends.add(operation);
    }
    return operation.deferred.promise;
  }

  createRead(
    endpoint: ChannelEndpoint,
    signal: AbortSignal,
  ): Promise<TransportRead> {
    if (endpoint.readOperation !== undefined) {
      return Promise.reject(
        operationError(
          "CONCURRENT_OPERATION",
          "read",
          "A Loopback read is already in flight",
        ),
      );
    }
    if (
      endpoint.inbound.length === 0
      && endpoint.terminal === undefined
      && signal.aborted
    ) {
      return Promise.reject(
        operationError(
          "OPERATION_ABORTED",
          "read",
          "Loopback read was cancelled before item commit",
        ),
      );
    }
    const operation: PendingRead = {
      signal,
      deferred: deferred<TransportRead>(),
      scheduled: false,
      signalHandler: undefined,
    };
    endpoint.readOperation = operation;
    const terminalReady =
      endpoint.inbound.length === 0
      && endpoint.terminal !== undefined;
    if (!terminalReady) {
      const onAbort = (): void => {
        if (endpoint.readOperation !== operation) return;
        endpoint.readOperation = undefined;
        operation.deferred.reject(
          operationError(
            "OPERATION_ABORTED",
            "read",
            "Loopback read was cancelled before item commit",
          ),
        );
      };
      operation.signalHandler = onAbort;
      signal.addEventListener("abort", onAbort, { once: true });
    }
    this.settleRead(endpoint);
    return operation.deferred.promise;
  }

  settleRead(endpoint: ChannelEndpoint): void {
    const operation = endpoint.readOperation;
    if (
      operation === undefined
      || operation.scheduled
      || (
        endpoint.inbound.length === 0
        && endpoint.terminal === undefined
      )
    ) {
      return;
    }
    operation.scheduled = true;
    this.schedule(() => {
      operation.scheduled = false;
      if (endpoint.readOperation !== operation) return;
      if (
        operation.signal.aborted
        && !(
          endpoint.inbound.length === 0
          && endpoint.terminal !== undefined
        )
      ) {
        endpoint.readOperation = undefined;
        this.#removeReadAbort(operation);
        operation.deferred.reject(
          operationError(
            "OPERATION_ABORTED",
            "read",
            "Loopback read was cancelled before item commit",
          ),
        );
        return;
      }
      const record = endpoint.inbound[0];
      if (record !== undefined) {
        const byteLength = record.bytes.byteLength;
        const committed = this.#commitMutation({}, 0n, () => {
          endpoint.inbound.shift();
          endpoint.inboundBytes -= byteLength;
          this.#resources.queuedPackets -= 1;
          this.#resources.queuedBytes -= byteLength;
        }).committed;
        if (!committed) {
          this.settleRead(endpoint);
          return;
        }
        endpoint.readOperation = undefined;
        this.#removeReadAbort(operation);
        const result = Object.freeze({
          kind: "packet" as const,
          packet: Object.freeze({
            bytes: Uint8Array.from(record.bytes),
          }),
        });
        operation.deferred.resolve(result);
        this.#drainPendingSends();
        endpoint.pair.maybeRelease();
        return;
      }
      if (endpoint.terminal !== undefined) {
        endpoint.readOperation = undefined;
        this.#removeReadAbort(operation);
        operation.deferred.resolve(
          Object.freeze({
            kind: "terminal" as const,
            terminal: endpoint.terminal,
          }),
        );
        endpoint.pair.maybeRelease();
      }
    });
  }

  beginChannelClose(
    endpoint: ChannelEndpoint,
    intent: TransportCloseIntent,
    signal: AbortSignal,
  ): Promise<TransportTerminal> {
    if (endpoint.terminal !== undefined) {
      return asyncTurn().then(() => endpoint.terminal as TransportTerminal);
    }
    if (endpoint.sendOperation !== undefined) {
      return Promise.reject(
        operationError(
          "CONCURRENT_OPERATION",
          "close",
          "Loopback close overlaps an in-flight send",
        ),
      );
    }
    if (endpoint.closeCompletion !== undefined) {
      endpoint.attachCloseCancellation(signal);
      return endpoint.closeCompletion.promise;
    }
    if (signal.aborted) {
      return Promise.reject(
        operationError(
          "OPERATION_ABORTED",
          "close",
          "Loopback channel close was cancelled before initiation",
        ),
      );
    }
    endpoint.closeCompletion = deferred<TransportTerminal>();
    const pair = endpoint.pair;
    const initiated = !pair.committed
      ? (pair.admissionOpen = false, endpoint.closing = true, true)
      : this.#commitMutation({}, 0n, () => {
          pair.admissionOpen = false;
          endpoint.closing = true;
        }).committed;
    if (!initiated) {
      endpoint.closeCompletion.resolve(
        endpoint.terminal
          ?? carrierTerminal(FAILURE_DIAGNOSTIC),
      );
      return endpoint.closeCompletion.promise;
    }
    endpoint.attachCloseCancellation(signal);
    const code = sanitizeDiagnosticCode(intent.code);
    this.schedule(() => {
      if (endpoint.terminal !== undefined) return;
      endpoint.pair.commitLocalGraceful(endpoint.side, code);
    });
    return endpoint.closeCompletion.promise;
  }

  abortChannel(
    endpoint: ChannelEndpoint,
    intent: TransportAbortIntent,
  ): void {
    if (endpoint.terminal !== undefined) return;
    const code = sanitizeDiagnosticCode(intent.code);
    endpoint.pair.commitLocalAbort(endpoint.side, code);
  }

  commitPairTerminal(
    pair: ChannelPair,
    endpoint: ChannelEndpoint,
    terminal: TransportTerminal,
    deltas: CounterDeltas,
  ): boolean {
    if (endpoint.terminal !== undefined) return true;
    if (!pair.committed) {
      pair.admissionOpen = false;
      endpoint.terminal = terminal;
      endpoint.closing = true;
      endpoint.resolveClose();
      this.settleRead(endpoint);
      return true;
    }
    const committed = this.#commitMutation(deltas, 0n, () => {
      pair.admissionOpen = false;
      endpoint.terminal = terminal;
      endpoint.closing = true;
    }).committed;
    if (!committed) return false;
    endpoint.resolveClose();
    this.#cancelPairPendingSends(pair);
    this.settleRead(endpoint);
    pair.maybeRelease();
    return true;
  }

  releasePair(pair: ChannelPair): void {
    if (
      !pair.committed
      || this.#state === "Failed"
      || !this.#channels.has(pair.channelId)
    ) {
      return;
    }
    const committed = this.#commitMutation({}, 0n, () => {
      this.#channels.delete(pair.channelId);
      this.#resources.activeChannels -= 1;
      pair.listener.activeChannels -= 1;
      pair.released = true;
    }).committed;
    if (!committed) return;
    this.#scheduleCompletionCheck();
  }

  isFailed(): boolean {
    return this.#state === "Failed";
  }

  adapterFaultForSend(): ReturnType<typeof operationError> {
    return this.#adapterFault("send");
  }

  adapterFaultForConnect(): ReturnType<typeof operationError> {
    return this.#adapterFault("connect");
  }

  activateCommittedSend(operation: PendingSend): void {
    this.#activateSend(operation);
  }

  rejectUncommittedSend(
    operation: PendingSend,
    diagnostic: TransportDiagnostic,
  ): void {
    this.#settleSendFailure(
      operation,
      operationError(
        "ADAPTER_FAULT",
        "send",
        `Loopback acquisition failed before send acceptance (${diagnostic.code})`,
        { acceptance: "not-accepted" },
      ),
    );
  }

  #activateSend(operation: PendingSend): void {
    if (operation.state === "settled") return;
    if (
      operation.signal.aborted
      || operation.sender.terminal !== undefined
      || !operation.pair.admissionOpen
    ) {
      this.#cancelSend(operation);
      return;
    }
    operation.state = "pending";
    if (
      this.#pendingSends.length === 0
      && this.#canAdmit(operation)
    ) {
      this.#admitSend(operation, false);
      return;
    }
    if (
      operation.bytes.byteLength
        > this.#config.limits.maxPendingSendBytesTotal
          - this.#resources.pendingSendBytes
    ) {
      this.failAdapterInvariant("PENDING_SEND_BUDGET_EXCEEDED");
      this.#settleSendFailure(operation, this.#adapterFault("send"));
      return;
    }
    const result = this.#commitMutation(
      { backpressureActivations: 1n },
      1n,
      () => {
        this.#resources.pendingSendBytes += operation.bytes.byteLength;
      },
    );
    if (!result.committed) {
      this.#settleSendFailure(operation, this.#adapterFault("send"));
      return;
    }
    operation.sequence = result.firstArbitrationSequence;
    this.#pendingSends.push(operation);
    this.#pendingSends.sort((left, right) =>
      compareBigInt(
        left.sequence ?? UNSIGNED_64_MAX,
        right.sequence ?? UNSIGNED_64_MAX,
      )
    );
  }

  #admitSend(operation: PendingSend, wasPending: boolean): void {
    const direction =
      operation.sender.side === "left"
        ? {
            packetsAcceptedLeftToRight: 1n,
            bytesAcceptedLeftToRight:
              BigInt(operation.bytes.byteLength),
          }
        : {
            packetsAcceptedRightToLeft: 1n,
            bytesAcceptedRightToLeft:
              BigInt(operation.bytes.byteLength),
          };
    const record: PacketRecord = { bytes: operation.bytes };
    const committed = this.#commitMutation(direction, 0n, () => {
      if (wasPending) {
        this.#removePendingSend(operation);
        this.#resources.pendingSendBytes -= operation.bytes.byteLength;
      }
      operation.receiver.inbound.push(record);
      operation.receiver.inboundBytes += operation.bytes.byteLength;
      this.#resources.queuedPackets += 1;
      this.#resources.queuedBytes += operation.bytes.byteLength;
      operation.state = "accepted";
    }).committed;
    if (!committed) {
      this.#settleSendFailure(operation, this.#adapterFault("send"));
      return;
    }
    this.#removeSendAbort(operation);
    this.settleRead(operation.receiver);
    this.schedule(() => {
      if (operation.state !== "accepted") return;
      operation.state = "settled";
      operation.sender.sendOperation = undefined;
      operation.deferred.resolve();
    });
  }

  #cancelSend(operation: PendingSend, drain = true): void {
    if (
      operation.state === "accepted"
      || operation.state === "settled"
    ) {
      return;
    }
    if (operation.state === "precommit") {
      operation.pair.precommitSends.delete(operation);
      this.#settleSendFailure(
        operation,
        operation.signal.aborted
          ? operationError(
              "OPERATION_ABORTED",
              "send",
              "Loopback send was cancelled before acceptance",
              { acceptance: "not-accepted" },
            )
          : operationError(
              "CHANNEL_TERMINAL",
              "send",
              "The Loopback channel terminated before send acceptance",
              { acceptance: "not-accepted" },
            ),
      );
      return;
    }
    if (operation.sequence !== undefined) {
      const committed = this.#commitMutation({}, 0n, () => {
        this.#removePendingSend(operation);
        this.#resources.pendingSendBytes -= operation.bytes.byteLength;
      }).committed;
      if (!committed) {
        this.#settleSendFailure(operation, this.#adapterFault("send"));
        return;
      }
    }
    this.#settleSendFailure(
      operation,
      operation.signal.aborted
        ? operationError(
            "OPERATION_ABORTED",
            "send",
            "Loopback send was cancelled before acceptance",
            { acceptance: "not-accepted" },
          )
        : operationError(
            "CHANNEL_TERMINAL",
            "send",
            "The Loopback channel terminated before send acceptance",
            { acceptance: "not-accepted" },
          ),
    );
    if (drain) this.#drainPendingSends();
  }

  #settleSendFailure(operation: PendingSend, reason: unknown): void {
    if (operation.state === "settled") return;
    operation.state = "settled";
    this.#removePendingSend(operation);
    this.#removeSendAbort(operation);
    operation.sender.sendOperation = undefined;
    operation.deferred.reject(reason);
  }

  #cancelPairPendingSends(pair: ChannelPair): void {
    for (const endpoint of [pair.left, pair.right]) {
      const operation = endpoint.sendOperation;
      if (
        operation !== undefined
        && operation.state !== "accepted"
        && operation.state !== "settled"
      ) {
        this.#cancelSend(operation);
      }
    }
  }

  #canAdmit(operation: PendingSend): boolean {
    const receiver = operation.receiver;
    const bytes = operation.bytes.byteLength;
    return (
      operation.pair.admissionOpen
      && receiver.terminal === undefined
      && receiver.inbound.length
        < receiver.limits.maxBufferedPackets
      && bytes
        <= receiver.limits.maxBufferedBytes - receiver.inboundBytes
      && this.#resources.queuedPackets
        < this.#config.limits.maxQueuedPacketsTotal
      && bytes
        <= this.#config.limits.maxQueuedBytesTotal
          - this.#resources.queuedBytes
    );
  }

  #drainPendingSends(): void {
    if (this.#state === "Failed") return;
    for (;;) {
      const operation = this.#pendingSends[0];
      if (operation === undefined) return;
      if (operation.signal.aborted) {
        this.#cancelSend(operation, false);
        continue;
      }
      if (
        operation.sender.terminal !== undefined
        || !operation.pair.admissionOpen
      ) {
        this.#cancelSend(operation, false);
        continue;
      }
      if (!this.#canAdmit(operation)) return;
      this.#admitSend(operation, true);
    }
  }

  #removePendingSend(operation: PendingSend): void {
    const index = this.#pendingSends.indexOf(operation);
    if (index >= 0) this.#pendingSends.splice(index, 1);
  }

  #removeSendAbort(operation: PendingSend): void {
    if (operation.signalHandler !== undefined) {
      operation.signal.removeEventListener(
        "abort",
        operation.signalHandler,
      );
      operation.signalHandler = undefined;
    }
  }

  #removeReadAbort(operation: PendingRead): void {
    if (operation.signalHandler !== undefined) {
      operation.signal.removeEventListener(
        "abort",
        operation.signalHandler,
      );
      operation.signalHandler = undefined;
    }
  }

  #commitMutation(
    deltas: CounterDeltas,
    arbitrationAllocations: bigint,
    action: () => void,
  ): MutationResult {
    if (this.#state === "Failed") return { committed: false };
    try {
      this.#domains.preflight(deltas, arbitrationAllocations);
    } catch (cause) {
      if (cause instanceof MonotonicExhaustion) {
        this.#failMonotonic(cause);
        return { committed: false };
      }
      throw cause;
    }
    action();
    const firstArbitrationSequence = this.#domains.commit(
      deltas,
      arbitrationAllocations,
    );
    return firstArbitrationSequence === undefined
      ? { committed: true }
      : { committed: true, firstArbitrationSequence };
  }

  #failMonotonic(exhaustion: MonotonicExhaustion): void {
    if (this.#state === "Failed") return;
    const failure: LoopbackFabricFailureSnapshot =
      exhaustion.domain === "counter"
        ? deepFreeze({
            code: "MONOTONIC_DOMAIN_EXHAUSTED" as const,
            domain: "counter" as const,
            counterKey: requireCounterKey(exhaustion.counterKey),
          })
        : deepFreeze({
            code: "MONOTONIC_DOMAIN_EXHAUSTED" as const,
            domain: exhaustion.domain,
          });
    this.#terminalizeFailure(failure, FAILURE_DIAGNOSTIC);
    this.#domains.commitFailureRevision();
    this.#freezeAndScheduleFailureCleanup();
  }

  failAdapterInvariant(code: string, cause?: unknown): void {
    if (this.#state === "Failed") return;
    const deltas = { adapterInvariantFaults: 1n } as const;
    try {
      this.#domains.preflight(deltas);
    } catch (preflightFailure) {
      if (preflightFailure instanceof MonotonicExhaustion) {
        this.#failMonotonic(preflightFailure);
        return;
      }
      throw preflightFailure;
    }
    this.#terminalizeFailure(
      deepFreeze({ code: "ADAPTER_FAULT" as const }),
      ADAPTER_FAULT_DIAGNOSTIC,
    );
    this.#domains.commit(deltas);
    this.#freezeAndScheduleFailureCleanup();
    this.#emit(
      deepFreeze({
        code: "ADAPTER_FAULT",
        message: sanitizeMessage(code),
      }),
      cause,
    );
  }

  #terminalizeFailure(
    failure: LoopbackFabricFailureSnapshot,
    diagnostic: TransportDiagnostic,
  ): void {
    this.#failure = failure;
    this.#state = "Failed";
    this.#listenersByAddress.clear();

    for (const connection of [...this.#pendingConnections]) {
      connection.failFromFabric(diagnostic);
    }
    this.#pendingConnections.clear();
    for (const operation of [...this.#pendingSends]) {
      this.#settleSendFailure(operation, this.#adapterFault("send"));
    }
    this.#pendingSends.length = 0;
    for (const listener of this.#listenerRows) {
      listener.failFromFabric(diagnostic);
    }
    for (const pair of this.#channels.values()) {
      pair.failFromFabric(diagnostic);
    }
    this.#reservedActiveChannels = 0;
    this.#resources.pendingAcquisitions = 0;
    this.#resources.activeChannels = 0;
    this.#resources.pendingSendBytes = 0;
    this.#resources.queuedPackets = 0;
    this.#resources.queuedBytes = 0;
  }

  #freezeAndScheduleFailureCleanup(): void {
    this.#frozenFailureSnapshot = createOperationsSnapshot(
      this.#operationsView(),
    );
    this.#failureCleanup = deferred<void>();
    this.schedule(() => {
      for (const listener of this.#listenerRows) {
        listener.releasePhysical();
      }
      this.#listenerRows.clear();
      this.#channels.clear();
      this.#transportNames.clear();
      this.#failureCleanupComplete = true;
      this.#failureCleanup?.resolve();
      this.#closeCompletion?.resolve();
    });
  }

  #adapterFault(
    phase: "listen" | "connect" | "send",
  ): ReturnType<typeof operationError> {
    return operationError(
      "ADAPTER_FAULT",
      phase,
      "Loopback fabric entered a terminal adapter-fault state",
      phase === "send"
        ? { acceptance: "not-accepted" }
        : {},
    );
  }

  #emit(diagnostic: TransportDiagnostic, cause?: unknown): void {
    emitTransportDiagnostic(this.#diagnostics, diagnostic, cause);
  }

  #allocateIdentity(kind: "listener" | "channel", value: bigint): string {
    if (value > UNSIGNED_64_MAX) {
      this.failAdapterInvariant("IDENTITY_DOMAIN_EXHAUSTED");
      throw this.#adapterFault(
        kind === "listener" ? "listen" : "connect",
      );
    }
    return `${kind}-${value.toString(16).padStart(16, "0")}`;
  }

  #operationsView(): FabricOperationsView {
    const listeners: ListenerOperationsView[] = [
      ...this.#listenerRows,
    ].map((listener) => listener.operationsView());
    const channels: ChannelOperationsView[] = [
      ...this.#channels.values(),
    ].map((channel) => channel.operationsView());
    return {
      fabricId: this.fabricId,
      state: this.#state,
      ...(this.#failure === undefined
        ? {}
        : { failure: this.#failure }),
      domains: this.#domains,
      listeners,
      channels,
      resources: { ...this.#resources },
    };
  }

  #scheduleCompletionCheck(): void {
    if (
      this.#state !== "Closing"
      || this.#completionCheckScheduled
    ) {
      return;
    }
    this.#completionCheckScheduled = true;
    queueMicrotask(() => {
      this.#completionCheckScheduled = false;
      if (
        this.#state !== "Closing"
        || this.#scheduledWork !== 0
        || this.#listenerRows.size !== 0
        || this.#channels.size !== 0
        || this.#pendingConnections.size !== 0
        || this.#pendingSends.length !== 0
      ) {
        return;
      }
      if (
        this.#commitMutation({}, 0n, () => {
          this.#state = "Closed";
        }).committed
      ) {
        this.#closeCompletion?.resolve();
      }
    });
  }
}

class TransportBuilderRuntime implements LoopbackTransportBuilder {
  readonly transportName: string;
  readonly #fabric: LoopbackFabricRuntime;
  readonly #config: LoopbackTransportConfig;

  constructor(
    fabric: LoopbackFabricRuntime,
    config: LoopbackTransportConfig,
  ) {
    this.#fabric = fabric;
    this.#config = config;
    this.transportName = config.transportName;
  }

  createPort(options: LoopbackPortOptions): PeerTransportPort {
    return this.#fabric.createPort(this.#config, options);
  }
}

class ResolverRuntime implements PeerTransportPort {
  readonly #listeners: ReadonlyMap<
    TransportRef,
    TransportListenCapability
  >;
  readonly #targets: ReadonlyMap<
    TransportRef,
    TransportConnectCapability
  >;

  constructor(
    listeners: ReadonlyMap<TransportRef, TransportListenCapability>,
    targets: ReadonlyMap<TransportRef, TransportConnectCapability>,
  ) {
    this.#listeners = new Map(listeners);
    this.#targets = new Map(targets);
  }

  resolveListener(
    reference: TransportRef,
  ): TransportListenCapability | undefined {
    try {
      validateReference(reference);
    } catch (cause) {
      throw operationError(
        "REFERENCE_INVALID",
        "resolve-listener",
        "Loopback listener reference is malformed",
        { cause },
      );
    }
    return this.#listeners.get(reference);
  }

  resolveTarget(
    reference: TransportRef,
  ): TransportConnectCapability | undefined {
    try {
      validateReference(reference);
    } catch (cause) {
      throw operationError(
        "REFERENCE_INVALID",
        "resolve-target",
        "Loopback target reference is malformed",
        { cause },
      );
    }
    return this.#targets.get(reference);
  }
}

class BoundListenCapability implements TransportListenCapability {
  readonly #fabric: LoopbackFabricRuntime;
  readonly #transportName: string;
  readonly #config: LoopbackListenerConfig;

  constructor(
    fabric: LoopbackFabricRuntime,
    transportName: string,
    config: LoopbackListenerConfig,
  ) {
    this.#fabric = fabric;
    this.#transportName = transportName;
    this.#config = config;
  }

  listen(
    options: TransportListenOptions,
    callbacks: TransportAcceptCallbacks,
    signal: AbortSignal,
  ): Promise<TransportListenerPort> {
    return this.#fabric.listen(
      this.#transportName,
      this.#config,
      options,
      callbacks,
      signal,
    );
  }
}

class BoundConnectCapability implements TransportConnectCapability {
  readonly #fabric: LoopbackFabricRuntime;
  readonly #transportName: string;
  readonly #config: LoopbackTargetConfig;

  constructor(
    fabric: LoopbackFabricRuntime,
    transportName: string,
    config: LoopbackTargetConfig,
  ) {
    this.#fabric = fabric;
    this.#transportName = transportName;
    this.#config = config;
  }

  connect(
    options: TransportAcquisitionOptions,
    signal: AbortSignal,
  ): Promise<TransportChannelPort> {
    return this.#fabric.connect(
      this.#transportName,
      this.#config,
      options,
      signal,
    );
  }
}

class PendingConnection {
  readonly listener: ListenerRuntime;
  readonly connectingTransportName: string;
  readonly connectingLimits: TransportChannelLimits;
  readonly promise: Promise<TransportChannelPort>;
  readonly #fabric: LoopbackFabricRuntime;
  readonly #signal: AbortSignal;
  readonly #deferred = deferred<TransportChannelPort>();

  pair: ChannelPair | undefined;
  reserved = false;
  #state:
    | "Pending"
    | "InCallback"
    | "Committed"
    | "Rejected" = "Pending";
  #capacityKind:
    | "pending-acquisition"
    | "active-channel"
    | undefined;
  #signalHandler: (() => void) | undefined;
  #closureObserved = false;

  constructor(
    fabric: LoopbackFabricRuntime,
    listener: ListenerRuntime,
    connectingTransportName: string,
    connectingLimits: TransportChannelLimits,
    signal: AbortSignal,
  ) {
    this.#fabric = fabric;
    this.listener = listener;
    this.connectingTransportName = connectingTransportName;
    this.connectingLimits = connectingLimits;
    this.#signal = signal;
    this.promise = this.#deferred.promise;
  }

  begin(): void {
    const onAbort = (): void => {
      if (this.#state === "InCallback") {
        // Callback entry owns the serialized disposition gate.
        return;
      }
      if (this.#state !== "Pending") return;
      this.#state = "Rejected";
      if (this.reserved) this.#fabric.releaseConnection(this, false);
      else this.#fabric.finishConnection(this);
      this.pair?.discardUncommitted(ADAPTER_FAULT_DIAGNOSTIC);
      this.#removeAbort();
      this.#deferred.reject(
        operationError(
          "OPERATION_ABORTED",
          "connect",
          "Loopback connect was cancelled before callback entry",
        ),
      );
    };
    this.#signalHandler = onAbort;
    this.#signal.addEventListener("abort", onAbort, { once: true });
    if (this.#signal.aborted) {
      onAbort();
      return;
    }
    this.#fabric.reserveAcquisition(this);
  }

  queueCapacityRejection(
    kind: "pending-acquisition" | "active-channel",
  ): void {
    if (this.#state !== "Pending") return;
    this.#capacityKind = kind;
    this.listener.enqueueConnection(this);
  }

  deliver(): void {
    if (this.#state !== "Pending") return;
    if (this.#signal.aborted) {
      this.#signalHandler?.();
      return;
    }
    if (!this.listener.isListening) {
      this.rejectForListenerClosure();
      return;
    }
    this.#state = "InCallback";
    if (this.#capacityKind !== undefined) {
      this.#deliverCapacityRejection(this.#capacityKind);
      return;
    }
    const pair = this.pair;
    if (pair === undefined) {
      this.rejectAdapterFault();
      return;
    }
    const callbacks = this.listener.callbacks;
    if (callbacks === undefined) {
      this.rejectAdapterFault();
      return;
    }
    try {
      callbacks.accept({ channel: pair.right });
    } catch (cause) {
      this.#state = "Rejected";
      this.#fabric.releaseConnection(this, true);
      this.#removeAbort();
      this.#deferred.reject(this.#fabric.adapterFaultForConnect());
      this.listener.commitCallbackFault(
        "ACCEPT_CALLBACK_FAILED",
        cause,
      );
      return;
    }

    if (this.#closureObserved || !this.listener.isListening) {
      this.#state = "Rejected";
      this.#fabric.releaseConnection(this, true);
      this.#removeAbort();
      this.#deferred.reject(
        operationError(
          "CONNECT_FAILED",
          "connect",
          "Loopback acquisition was closed before commit",
        ),
      );
      return;
    }
    if (!this.#fabric.commitConnection(this)) {
      this.#state = "Rejected";
      this.#fabric.finishConnection(this);
      this.#removeAbort();
      this.#deferred.reject(this.#fabric.adapterFaultForConnect());
      return;
    }
    this.#state = "Committed";
    this.#fabric.finishConnection(this);
    this.#removeAbort();
    this.#deferred.resolve(pair.left);
  }

  rejectForListenerClosure(): void {
    if (this.#state === "InCallback") {
      this.#closureObserved = true;
      return;
    }
    if (this.#state !== "Pending") return;
    this.#state = "Rejected";
    if (this.reserved) this.#fabric.releaseConnection(this, true);
    else {
      this.#fabric.recordUnreservedRejection();
      this.#fabric.finishConnection(this);
    }
    this.#removeAbort();
    this.#deferred.reject(
      operationError(
        "CONNECT_FAILED",
        "connect",
        "Loopback listener closed before acquisition commit",
      ),
    );
  }

  rejectBindingUnavailable(): void {
    if (this.#state !== "Pending") return;
    this.#state = "Rejected";
    this.#fabric.finishConnection(this);
    this.#removeAbort();
    this.#deferred.reject(
      operationError(
        "BINDING_UNAVAILABLE",
        "connect",
        "Loopback listener binding became unavailable",
      ),
    );
  }

  rejectAdapterFault(): void {
    if (
      this.#state === "Committed"
      || this.#state === "Rejected"
    ) {
      return;
    }
    this.#state = "Rejected";
    this.#fabric.finishConnection(this);
    this.#removeAbort();
    this.pair?.discardUncommitted(FAILURE_DIAGNOSTIC);
    this.#deferred.reject(this.#fabric.adapterFaultForConnect());
  }

  failFromFabric(diagnostic: TransportDiagnostic): void {
    if (
      this.#state === "Committed"
      || this.#state === "Rejected"
    ) {
      return;
    }
    this.#state = "Rejected";
    this.reserved = false;
    this.#removeAbort();
    this.pair?.discardUncommitted(diagnostic);
    this.#deferred.reject(this.#fabric.adapterFaultForConnect());
  }

  #deliverCapacityRejection(
    kind: "pending-acquisition" | "active-channel",
  ): void {
    if (!this.#fabric.recordUnreservedRejection()) {
      this.rejectAdapterFault();
      return;
    }
    let callbackThrew = false;
    let thrown: unknown;
    const callbacks = this.listener.callbacks;
    if (callbacks === undefined) {
      this.rejectAdapterFault();
      return;
    }
    try {
      callbacks.capacityRejected(kind);
    } catch (cause) {
      callbackThrew = true;
      thrown = cause;
    }
    this.#state = "Rejected";
    this.#fabric.finishConnection(this);
    this.#removeAbort();
    this.#deferred.reject(
      operationError(
        "CAPACITY_EXCEEDED",
        "connect",
        `Loopback ${kind} capacity is exhausted`,
      ),
    );
    if (callbackThrew) {
      this.listener.commitCallbackFault(
        "CAPACITY_REJECTED_CALLBACK_FAILED",
        thrown,
      );
    }
  }

  #removeAbort(): void {
    if (this.#signalHandler !== undefined) {
      this.#signal.removeEventListener("abort", this.#signalHandler);
      this.#signalHandler = undefined;
    }
  }
}

class ListenerRuntime implements TransportListenerPort {
  readonly listenerId: string;
  readonly transportName: string;
  readonly address: string;
  readonly options: TransportListenOptions;
  callbacks: TransportAcceptCallbacks | undefined;
  readonly publication: Readonly<{ displayAddress: string }>;
  readonly #fabric: LoopbackFabricRuntime;
  readonly #queue: PendingConnection[] = [];
  readonly #waiters = new Set<{
    readonly signal: AbortSignal;
    readonly deferred: Deferred<TransportListenerTerminal>;
    readonly onAbort: () => void;
  }>();
  readonly #closeSignals = new Map<AbortSignal, () => void>();

  pendingAcquisitions = 0;
  reservedActiveChannels = 0;
  activeChannels = 0;
  #state: "Listening" | "Closing" | "Terminal" = "Listening";
  #terminal: TransportListenerTerminal | undefined;
  #gateScheduled = false;
  #currentConnection: PendingConnection | undefined;
  #releaseScheduled = false;
  #closeCompletion: Deferred<TransportListenerTerminal> | undefined;

  constructor(
    fabric: LoopbackFabricRuntime,
    listenerId: string,
    transportName: string,
    address: string,
    options: TransportListenOptions,
    callbacks: TransportAcceptCallbacks,
  ) {
    this.#fabric = fabric;
    this.listenerId = listenerId;
    this.transportName = transportName;
    this.address = address;
    this.options = options;
    this.callbacks = callbacks;
    this.publication = deepFreeze({
      displayAddress:
        `loopback://${fabric.fabricId}/${address}`,
    });
  }

  get isListening(): boolean {
    return this.#state === "Listening";
  }

  waitTerminal(
    signal: AbortSignal,
  ): Promise<TransportListenerTerminal> {
    if (this.#terminal !== undefined) {
      return asyncTurn().then(
        () => this.#terminal as TransportListenerTerminal,
      );
    }
    if (signal.aborted) {
      return Promise.reject(
        operationError(
          "OPERATION_ABORTED",
          "wait-terminal",
          "Loopback listener terminal wait was cancelled",
        ),
      );
    }
    const result = deferred<TransportListenerTerminal>();
    const waiter = {
      signal,
      deferred: result,
      onAbort: (): void => {
        if (!this.#waiters.delete(waiter)) return;
        result.reject(
          operationError(
            "OPERATION_ABORTED",
            "wait-terminal",
            "Loopback listener terminal wait was cancelled",
          ),
        );
      },
    };
    this.#waiters.add(waiter);
    signal.addEventListener("abort", waiter.onAbort, { once: true });
    return result.promise;
  }

  close(
    signal: AbortSignal,
  ): Promise<TransportListenerTerminal> {
    if (this.#terminal !== undefined) {
      return asyncTurn().then(
        () => this.#terminal as TransportListenerTerminal,
      );
    }
    if (this.#state === "Closing") {
      this.#attachCloseSignal(signal);
      return requireValue(this.#closeCompletion).promise;
    }
    if (signal.aborted) {
      return Promise.reject(
        operationError(
          "OPERATION_ABORTED",
          "close",
          "Loopback listener close was cancelled before initiation",
        ),
      );
    }
    this.#closeCompletion = deferred<TransportListenerTerminal>();
    if (
      !this.#fabric.commitListenerMutation(() => {
        this.#state = "Closing";
        this.#fabric.unregisterListener(this);
      })
    ) {
      return asyncTurn().then(
        () =>
          this.#terminal
          ?? listenerCarrierTerminal(FAILURE_DIAGNOSTIC),
      );
    }
    this.#currentConnection?.rejectForListenerClosure();
    this.#rejectQueuedConnections();
    this.#attachCloseSignal(signal);
    this.#fabric.schedule(() => {
      this.#commitTerminal(
        deepFreeze({ origin: "local", kind: "graceful" }),
      );
    });
    return this.#closeCompletion.promise;
  }

  abort(intent: TransportAbortIntent): void {
    if (this.#terminal !== undefined) return;
    const terminal = deepFreeze({
      origin: "local" as const,
      kind: "aborted" as const,
      diagnostic: {
        code: sanitizeDiagnosticCode(intent.code),
      },
    });
    this.#commitTerminal(terminal);
  }

  enqueueConnection(connection: PendingConnection): void {
    this.#queue.push(connection);
    this.#scheduleGate();
  }

  beginFabricClose(): void {
    if (this.#terminal !== undefined || this.#state === "Closing") {
      return;
    }
    this.#closeCompletion = deferred<TransportListenerTerminal>();
    if (
      !this.#fabric.commitListenerMutation(() => {
        this.#state = "Closing";
        this.#fabric.unregisterListener(this);
      })
    ) {
      return;
    }
    this.#currentConnection?.rejectForListenerClosure();
    this.#rejectQueuedConnections();
    this.#fabric.schedule(() => {
      this.#commitTerminal(
        deepFreeze({ origin: "local", kind: "graceful" }),
      );
    });
  }

  commitCallbackFault(
    code: "ACCEPT_CALLBACK_FAILED"
      | "CAPACITY_REJECTED_CALLBACK_FAILED",
    cause: unknown,
  ): void {
    if (this.#terminal === undefined) {
      this.#commitTerminal(
        deepFreeze({
          origin: "carrier" as const,
          kind: "adapter-fault" as const,
          diagnostic: { code },
        }),
      );
    }
    this.#fabric.emitCallbackDiagnostic(code, cause);
  }

  failFromFabric(diagnostic: TransportDiagnostic): void {
    this.#state = "Terminal";
    this.#terminal ??= listenerCarrierTerminal(diagnostic);
    this.pendingAcquisitions = 0;
    this.reservedActiveChannels = 0;
    this.activeChannels = 0;
    this.#rejectQueuedConnections();
    this.#resolveTerminalObservers();
    if (this.#terminal !== undefined) {
      this.#closeCompletion?.resolve(this.#terminal);
    }
  }

  releasePhysical(): void {
    this.callbacks = undefined;
    this.#queue.length = 0;
    this.#currentConnection = undefined;
  }

  operationsView(): ListenerOperationsView {
    return {
      listenerId: this.listenerId,
      address: this.address,
      state: this.#state,
      ...(this.#terminal === undefined
        ? {}
        : { terminal: this.#terminal }),
      activeChannels: this.activeChannels,
    };
  }

  #scheduleGate(): void {
    if (this.#gateScheduled) return;
    this.#gateScheduled = true;
    this.#fabric.schedule(() => {
      this.#gateScheduled = false;
      const connection = this.#queue.shift();
      if (connection === undefined) return;
      if (this.#state !== "Listening") {
        connection.rejectForListenerClosure();
      } else {
        this.#currentConnection = connection;
        try {
          connection.deliver();
        } finally {
          this.#currentConnection = undefined;
        }
      }
      if (this.#queue.length > 0 && this.#state === "Listening") {
        this.#scheduleGate();
      } else if (this.#state !== "Listening") {
        this.#rejectQueuedConnections();
      }
    });
  }

  #rejectQueuedConnections(): void {
    for (const connection of this.#queue.splice(0)) {
      connection.rejectForListenerClosure();
    }
  }

  #commitTerminal(terminal: TransportListenerTerminal): void {
    if (this.#terminal !== undefined) return;
    const committed = this.#fabric.commitListenerMutation(() => {
      this.#state = "Terminal";
      this.#terminal = terminal;
      this.#fabric.unregisterListener(this);
    });
    if (!committed) {
      if (this.#terminal === undefined && this.#fabric.isFailed()) {
        this.#terminal = listenerCarrierTerminal(FAILURE_DIAGNOSTIC);
        this.#state = "Terminal";
      }
    }
    this.#currentConnection?.rejectForListenerClosure();
    this.#rejectQueuedConnections();
    this.#resolveTerminalObservers();
    if (!this.#releaseScheduled && !this.#fabric.isFailed()) {
      this.#releaseScheduled = true;
      this.#fabric.schedule(() => {
        this.#fabric.releaseListener(this);
        this.#closeCompletion?.resolve(terminal);
      });
    }
  }

  #resolveTerminalObservers(): void {
    const terminal = this.#terminal;
    if (terminal === undefined) return;
    for (const waiter of this.#waiters) {
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      waiter.deferred.resolve(terminal);
    }
    this.#waiters.clear();
    for (const [signal, handler] of this.#closeSignals) {
      signal.removeEventListener("abort", handler);
    }
    this.#closeSignals.clear();
  }

  #attachCloseSignal(signal: AbortSignal): void {
    if (this.#terminal !== undefined) return;
    const forceAbort = (): void => {
      this.abort({
        kind: "deadline",
        code: "CLOSE_CANCELLED",
      });
    };
    if (signal.aborted) {
      forceAbort();
      return;
    }
    if (!this.#closeSignals.has(signal)) {
      this.#closeSignals.set(signal, forceAbort);
      signal.addEventListener("abort", forceAbort, { once: true });
    }
  }
}

class ChannelPair {
  readonly channelId: string;
  readonly listener: ListenerRuntime;
  readonly left: ChannelEndpoint;
  readonly right: ChannelEndpoint;
  readonly precommitSends = new Set<PendingSend>();
  readonly #fabric: LoopbackFabricRuntime;

  committed = false;
  released = false;
  admissionOpen = true;
  #releaseScheduled = false;
  #gracefulCounted = false;
  #abortCounted = false;

  constructor(
    fabric: LoopbackFabricRuntime,
    channelId: string,
    leftTransport: string,
    rightTransport: string,
    leftLimits: TransportChannelLimits,
    rightLimits: TransportChannelLimits,
    listener: ListenerRuntime,
  ) {
    this.#fabric = fabric;
    this.channelId = channelId;
    this.listener = listener;
    this.left = new ChannelEndpoint(
      this,
      "left",
      leftTransport,
      leftLimits,
      peerEvidence(rightTransport),
    );
    this.right = new ChannelEndpoint(
      this,
      "right",
      rightTransport,
      rightLimits,
      peerEvidence(leftTransport),
    );
  }

  markCommitted(): void {
    this.committed = true;
  }

  activateAfterCommit(): void {
    for (const operation of [...this.precommitSends]) {
      this.precommitSends.delete(operation);
      this.#fabric.activateCommittedSend(operation);
    }
    this.#fabric.settleRead(this.left);
    this.#fabric.settleRead(this.right);
    this.maybeRelease();
  }

  discardUncommitted(diagnostic: TransportDiagnostic): void {
    if (this.committed) return;
    this.admissionOpen = false;
    this.left.terminal ??= carrierTerminal(diagnostic);
    this.right.terminal ??= carrierTerminal(diagnostic);
    this.left.closing = true;
    this.right.closing = true;
    for (const operation of [...this.precommitSends]) {
      this.precommitSends.delete(operation);
      this.#fabric.rejectUncommittedSend(operation, diagnostic);
    }
    this.left.resolveClose();
    this.right.resolveClose();
    this.#fabric.settleRead(this.left);
    this.#fabric.settleRead(this.right);
  }

  commitLocalGraceful(side: Side, code: string): void {
    const endpoint = this.endpoint(side);
    if (endpoint.terminal !== undefined) return;
    const terminal = deepFreeze({
      origin: "local" as const,
      kind: "graceful" as const,
      diagnostic: { code },
    });
    const deltas = this.#gracefulCounted
      ? {}
      : { gracefulChannelCloses: 1n };
    if (
      !this.#fabric.commitPairTerminal(
        this,
        endpoint,
        terminal,
        deltas,
      )
    ) {
      return;
    }
    this.#gracefulCounted = true;
    this.#fabric.schedule(() => {
      this.#commitPeerTerminal(
        opposite(side),
        deepFreeze({
          origin: "remote" as const,
          kind: "graceful" as const,
        }),
      );
    });
  }

  commitLocalAbort(side: Side, code: string): void {
    const endpoint = this.endpoint(side);
    if (endpoint.terminal !== undefined) return;
    const terminal = deepFreeze({
      origin: "local" as const,
      kind: "aborted" as const,
      diagnostic: { code },
    });
    const deltas = this.#abortCounted
      ? {}
      : { forcedChannelAborts: 1n };
    if (
      !this.#fabric.commitPairTerminal(
        this,
        endpoint,
        terminal,
        deltas,
      )
    ) {
      return;
    }
    this.#abortCounted = true;
    this.#fabric.schedule(() => {
      this.#commitPeerTerminal(
        opposite(side),
        deepFreeze({
          origin: "remote" as const,
          kind: "io-failure" as const,
          diagnostic: PEER_ABORTED_DIAGNOSTIC,
        }),
      );
    });
  }

  failFromFabric(diagnostic: TransportDiagnostic): void {
    this.admissionOpen = false;
    this.left.terminal ??= carrierTerminal(diagnostic);
    this.right.terminal ??= carrierTerminal(diagnostic);
    this.left.closing = true;
    this.right.closing = true;
    this.left.inbound.length = 0;
    this.left.inboundBytes = 0;
    this.right.inbound.length = 0;
    this.right.inboundBytes = 0;
    this.left.resolveClose();
    this.right.resolveClose();
    this.#fabric.settleRead(this.left);
    this.#fabric.settleRead(this.right);
  }

  maybeRelease(): void {
    if (
      !this.committed
      || this.released
      || this.#releaseScheduled
      || this.left.terminal === undefined
      || this.right.terminal === undefined
      || this.left.inbound.length !== 0
      || this.right.inbound.length !== 0
    ) {
      return;
    }
    this.#releaseScheduled = true;
    this.#fabric.schedule(() => {
      this.#releaseScheduled = false;
      if (
        this.left.terminal !== undefined
        && this.right.terminal !== undefined
        && this.left.inbound.length === 0
        && this.right.inbound.length === 0
      ) {
        this.#fabric.releasePair(this);
      }
    });
  }

  operationsView(): ChannelOperationsView {
    return {
      channelId: this.channelId,
      leftTransport: this.left.transportName,
      rightTransport: this.right.transportName,
      state:
        this.left.terminal !== undefined
          && this.right.terminal !== undefined
          ? "Terminal"
          : this.left.closing
              || this.right.closing
              || this.left.terminal !== undefined
              || this.right.terminal !== undefined
            ? "Closing"
            : "Open",
      ...(this.left.terminal === undefined
        ? {}
        : { leftTerminal: this.left.terminal }),
      ...(this.right.terminal === undefined
        ? {}
        : { rightTerminal: this.right.terminal }),
      queuedPacketsLeft: this.left.inbound.length,
      queuedBytesLeft: this.left.inboundBytes,
      queuedPacketsRight: this.right.inbound.length,
      queuedBytesRight: this.right.inboundBytes,
    };
  }

  endpoint(side: Side): ChannelEndpoint {
    return side === "left" ? this.left : this.right;
  }

  peer(side: Side): ChannelEndpoint {
    return side === "left" ? this.right : this.left;
  }

  owner(): LoopbackFabricRuntime {
    return this.#fabric;
  }

  #commitPeerTerminal(
    side: Side,
    terminal: TransportTerminal,
  ): void {
    const endpoint = this.endpoint(side);
    if (endpoint.terminal !== undefined) return;
    this.#fabric.commitPairTerminal(this, endpoint, terminal, {});
  }
}

class ChannelEndpoint implements TransportChannelPort {
  readonly pair: ChannelPair;
  readonly side: Side;
  readonly transportName: string;
  readonly limits: TransportChannelLimits;
  readonly peerEvidence: TransportPeerEvidence;
  readonly inbound: PacketRecord[] = [];
  readonly #closeSignals = new Map<AbortSignal, () => void>();

  inboundBytes = 0;
  terminal: TransportTerminal | undefined;
  closing = false;
  sendOperation: PendingSend | undefined;
  readOperation: PendingRead | undefined;
  closeCompletion: Deferred<TransportTerminal> | undefined;

  constructor(
    pair: ChannelPair,
    side: Side,
    transportName: string,
    limits: TransportChannelLimits,
    peer: TransportPeerEvidence,
  ) {
    this.pair = pair;
    this.side = side;
    this.transportName = transportName;
    this.limits = limits;
    this.peerEvidence = peer;
  }

  send(packet: TransportPacket, signal: AbortSignal): Promise<void> {
    return this.pairFabric().createSend(
      this.pair,
      this,
      this.pair.peer(this.side),
      packet,
      signal,
    );
  }

  read(signal: AbortSignal): Promise<TransportRead> {
    return this.pairFabric().createRead(this, signal);
  }

  close(
    intent: TransportCloseIntent,
    signal: AbortSignal,
  ): Promise<TransportTerminal> {
    return this.pairFabric().beginChannelClose(this, intent, signal);
  }

  abort(intent: TransportAbortIntent): void {
    this.pairFabric().abortChannel(this, intent);
  }

  attachCloseCancellation(signal: AbortSignal): void {
    if (this.terminal !== undefined) return;
    const forceAbort = (): void => {
      this.pair.commitLocalAbort(this.side, "CLOSE_CANCELLED");
    };
    if (signal.aborted) {
      forceAbort();
      return;
    }
    if (!this.#closeSignals.has(signal)) {
      this.#closeSignals.set(signal, forceAbort);
      signal.addEventListener("abort", forceAbort, { once: true });
    }
  }

  resolveClose(): void {
    const terminal = this.terminal;
    if (terminal === undefined) return;
    for (const [signal, handler] of this.#closeSignals) {
      signal.removeEventListener("abort", handler);
    }
    this.#closeSignals.clear();
    this.closeCompletion?.resolve(terminal);
  }

  pairFabric(): LoopbackFabricRuntime {
    // The fabric remains private to this implementation; endpoint consumers
    // receive no registry or administrative authority.
    return this.pair.owner();
  }
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function waitFor<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  phase: "close" | "wait-terminal",
  terminalCommitted: () => boolean = () => false,
): Promise<T> {
  if (terminalCommitted()) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(
      operationError(
        "OPERATION_ABORTED",
        phase,
        `Loopback ${phase} wait was cancelled`,
      ),
    );
  }
  const result = deferred<T>();
  let settled = false;
  const onAbort = (): void => {
    if (settled) return;
    if (terminalCommitted()) return;
    settled = true;
    result.reject(
      operationError(
        "OPERATION_ABORTED",
        phase,
        `Loopback ${phase} wait was cancelled`,
      ),
    );
  };
  signal.addEventListener("abort", onAbort, { once: true });
  promise.then(
    (value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      result.resolve(value);
    },
    (cause: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      result.reject(cause);
    },
  );
  return result.promise;
}

function peerEvidence(principal: string): TransportPeerEvidence {
  return deepFreeze({
    locality: "process-local",
    protection: "none",
    authentication: {
      kind: "verified",
      principal,
      method: "same-process-capability",
    },
  });
}

function carrierTerminal(
  diagnostic: TransportDiagnostic,
): TransportTerminal {
  return deepFreeze({
    origin: "carrier",
    kind: "adapter-fault",
    diagnostic,
  });
}

function listenerCarrierTerminal(
  diagnostic: TransportDiagnostic,
): TransportListenerTerminal {
  return deepFreeze({
    origin: "carrier",
    kind: "adapter-fault",
    diagnostic,
  });
}

function sanitizeDiagnosticCode(value: string): string {
  if (/^[A-Z][A-Z0-9_]{0,63}$/.test(value)) return value;
  return "INVALID_INTENT_CODE";
}

function sanitizeMessage(value: string): string {
  return [...value]
    .filter((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point > 31 && point !== 127;
    })
    .slice(0, 256)
    .join("");
}

function compareBigInt(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function opposite(side: Side): Side {
  return side === "left" ? "right" : "left";
}

function requireCounterKey(
  value: LoopbackCounterKey | undefined,
): LoopbackCounterKey {
  if (value === undefined) {
    throw new Error("Counter exhaustion omitted its counter key");
  }
  return value;
}

function requireValue<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Loopback lifecycle completion is missing");
  }
  return value;
}
