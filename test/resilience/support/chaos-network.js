import { TransportOperationError } from "@agp/transport";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const peerEvidence = Object.freeze({
  locality: "process-local",
  protection: "none",
  authentication: Object.freeze({ kind: "none" }),
});

export class ChaosNetwork {
  #listeners = new Map();
  #connections = new Set();
  #rules = [];
  #held = [];
  #sequence = 0;
  #ruleSequence = 0;
  #dialBarrier;

  ledger = [];

  transport(nodeId, bindings) {
    const listeners = new Map(bindings.listeners);
    const targets = new Map(bindings.targets);
    return Object.freeze({
      resolveListener: (transportRef) => {
        const url = listeners.get(transportRef);
        if (url === undefined) return undefined;
        return Object.freeze({
          listen: (options, callbacks, signal) =>
            this.#listen(nodeId, url, options, callbacks, signal),
        });
      },
      resolveTarget: (transportRef) => {
        const url = targets.get(transportRef);
        if (url === undefined) return undefined;
        return Object.freeze({
          connect: (options, signal) =>
            this.#connect(nodeId, url, options.channel, signal),
        });
      },
    });
  }

  fault(action, match = {}, count = 1) {
    if (!["drop", "fail-write", "hold", "block", "fail-close"].includes(action)) {
      throw new Error(`unsupported chaos action: ${action}`);
    }
    const rule = {
      id: `fault-${++this.#ruleSequence}`,
      action,
      match: { ...match },
      remaining: count,
    };
    this.#rules.push(rule);
    this.#record("fault-armed", {
      ruleId: rule.id,
      faultAction: action,
      match: JSON.stringify(match),
      count,
    });
    return rule.id;
  }

  dialBarrier(expected) {
    if (this.#dialBarrier !== undefined) {
      throw new Error("a dial barrier is already active");
    }
    let release;
    let reached;
    const releasePromise = new Promise((resolve) => {
      release = resolve;
    });
    const reachedPromise = new Promise((resolve) => {
      reached = resolve;
    });
    this.#dialBarrier = {
      expected,
      pending: 0,
      release,
      reached,
      releasePromise,
    };
    return Object.freeze({
      reached: reachedPromise,
      release: () => {
        const barrier = this.#dialBarrier;
        if (barrier === undefined) return;
        this.#record("dial-barrier-released", { count: barrier.pending });
        this.#dialBarrier = undefined;
        barrier.release();
      },
    });
  }

  release(ruleId, options = {}) {
    const selected = this.#held.filter((item) => item.ruleId === ruleId);
    const ordered = options.reverse ? [...selected].reverse() : selected;
    this.#held = this.#held.filter((item) => item.ruleId !== ruleId);
    for (const item of ordered) {
      this.#deliver(item.connection, item.bytes, item.metadata, "release");
      item.resolve?.();
    }
    this.#record("fault-released", { ruleId, count: ordered.length });
    return ordered.length;
  }

  injectText(from, to, document) {
    const receiver = this.#connection(to, from);
    const metadata = describeDocument(document);
    this.#record("inject-text", { from, to, ...metadata, document });
    receiver.inject({
      kind: "packet",
      packet: { bytes: immutableBytes(encoder.encode(document)) },
    });
  }

  injectInputRejected(from, to, rejection) {
    const receiver = this.#connection(to, from);
    this.#record("inject-input-rejected", {
      from,
      to,
      code: rejection.code,
    });
    receiver.inject({ kind: "input-rejected", code: rejection.code });
  }

  forceLink(from, to, reason = "injected-link-loss") {
    const connection = this.#connection(from, to);
    this.abort(connection, reason);
  }

  entries(action, match = {}) {
    return this.ledger.filter(
      (entry) => entry.action === action && matches(entry, match),
    );
  }

  last(action, match = {}) {
    return this.entries(action, match).at(-1);
  }

  async write(connection, packet, signal) {
    const bytes = immutableBytes(packet.bytes);
    const document = decoder.decode(bytes);
    const metadata = describeDocument(document);
    const facts = {
      from: connection.localNodeId,
      to: connection.remoteNodeId,
      direction: connection.direction,
      ...metadata,
      document,
    };
    this.#record("write-attempt", facts);
    if (signal.aborted) {
      throw operationError(
        "OPERATION_ABORTED",
        "send",
        "chaos send was cancelled before acceptance",
        "not-accepted",
      );
    }
    if (connection.closed || connection.peer?.closed) {
      this.#record("write-failed", { ...facts, reason: "closed" });
      throw operationError(
        "CHANNEL_TERMINAL",
        "send",
        "chaos channel is terminal",
        "not-accepted",
      );
    }
    if (bytes.byteLength > connection.limits.maxPacketBytes) {
      throw operationError(
        "PACKET_TOO_LARGE",
        "send",
        "chaos packet exceeds the channel limit",
        "not-accepted",
      );
    }
    const rule = this.#takeRule("write", facts);
    if (rule?.action === "drop") {
      this.#record("write-dropped", { ...facts, ruleId: rule.id });
      return;
    }
    if (rule?.action === "fail-write") {
      this.#record("write-failed", {
        ...facts,
        ruleId: rule.id,
        reason: "injected",
      });
      throw operationError(
        "SEND_FAILED",
        "send",
        `injected write failure: ${rule.id}`,
        "not-accepted",
      );
    }
    if (rule?.action === "hold") {
      this.#held.push({
        ruleId: rule.id,
        connection,
        bytes,
        metadata,
      });
      this.#record("write-held", { ...facts, ruleId: rule.id });
      return;
    }
    if (rule?.action === "block") {
      await new Promise((resolve, reject) => {
        this.#held.push({
          ruleId: rule.id,
          connection,
          bytes,
          metadata,
          resolve,
          reject,
        });
        this.#record("write-blocked", { ...facts, ruleId: rule.id });
      });
      return;
    }
    this.#deliver(connection, bytes, metadata, "write");
  }

  close(connection, intent, signal) {
    if (signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "close",
        "chaos close was cancelled before initiation",
      ));
    }
    const facts = {
      from: connection.localNodeId,
      to: connection.remoteNodeId,
      direction: connection.direction,
      code: intent.code,
      closeKind: intent.kind,
    };
    this.#record("close-attempt", facts);
    const rule = this.#takeRule("close", facts);
    if (rule?.action === "fail-close") {
      this.#record("close-failed", { ...facts, ruleId: rule.id });
      const terminal = Object.freeze({
        origin: "carrier",
        kind: "adapter-fault",
        diagnostic: Object.freeze({ code: "INJECTED_CLOSE_FAILURE" }),
      });
      this.#terminatePair(
        connection,
        terminal,
        Object.freeze({
          origin: "carrier",
          kind: "io-failure",
          diagnostic: Object.freeze({ code: "PEER_CLOSE_FAILED" }),
        }),
      );
      return Promise.resolve(terminal);
    }
    const terminal = Object.freeze({ origin: "local", kind: "graceful" });
    this.#terminatePair(
      connection,
      terminal,
      Object.freeze({ origin: "remote", kind: "graceful" }),
    );
    this.#record("closed", facts);
    return Promise.resolve(terminal);
  }

  abort(connection, reason) {
    this.#record("force-abort", {
      from: connection.localNodeId,
      to: connection.remoteNodeId,
      direction: connection.direction,
      reason,
    });
    this.#terminatePair(
      connection,
      Object.freeze({
        origin: "local",
        kind: "aborted",
        diagnostic: Object.freeze({ code: String(reason) }),
      }),
      Object.freeze({
        origin: "remote",
        kind: "io-failure",
        diagnostic: Object.freeze({ code: "PEER_ABORTED" }),
      }),
    );
  }

  async #listen(nodeId, url, options, callbacks, signal) {
    if (signal.aborted) {
      throw operationError(
        "OPERATION_ABORTED",
        "listen",
        "chaos listen was cancelled",
      );
    }
    if (this.#listeners.has(url)) {
      throw operationError(
        "BINDING_UNAVAILABLE",
        "listen",
        `address in use: ${url}`,
      );
    }
    const listener = new ChaosListener(
      this,
      nodeId,
      url,
      options,
      callbacks,
    );
    this.#listeners.set(url, listener);
    this.#record("listen", { nodeId, url });
    await asyncTurn();
    return listener;
  }

  async #connect(nodeId, url, limits, signal) {
    this.#record("dial-attempt", { from: nodeId, url });
    await this.#awaitDialBarrier(nodeId, url);
    if (signal.aborted) {
      throw operationError(
        "OPERATION_ABORTED",
        "connect",
        "chaos connect was cancelled",
      );
    }
    const listener = this.#listeners.get(url);
    if (listener === undefined || listener.terminal !== undefined) {
      this.#record("dial-refused", { from: nodeId, url });
      throw operationError(
        "BINDING_UNAVAILABLE",
        "connect",
        `connection refused: ${url}`,
      );
    }
    if (listener.active >= listener.options.limits.maxActiveChannels) {
      listener.callbacks.capacityRejected("active-channel");
      throw operationError(
        "CAPACITY_EXCEEDED",
        "connect",
        "chaos listener channel capacity is exhausted",
      );
    }
    const pair = { listener, released: false };
    const outbound = new ChaosConnection(
      this,
      "outbound",
      nodeId,
      listener.nodeId,
      limits,
      pair,
    );
    const inbound = new ChaosConnection(
      this,
      "inbound",
      listener.nodeId,
      nodeId,
      listener.options.limits.channel,
      pair,
    );
    outbound.peer = inbound;
    inbound.peer = outbound;
    this.#connections.add(outbound);
    this.#connections.add(inbound);
    listener.active += 1;
    try {
      listener.callbacks.accept({ channel: inbound });
    } catch (cause) {
      this.#terminatePair(
        outbound,
        Object.freeze({ origin: "carrier", kind: "adapter-fault" }),
        Object.freeze({ origin: "carrier", kind: "adapter-fault" }),
      );
      throw new TransportOperationError({
        code: "ADAPTER_FAULT",
        phase: "connect",
        message: "chaos accept callback failed",
        cause,
      });
    }
    this.#record("dial-connected", {
      from: nodeId,
      to: listener.nodeId,
    });
    await asyncTurn();
    return outbound;
  }

  closeListener(listener, aborted, reason) {
    if (listener.terminal !== undefined) {
      return listener.terminal;
    }
    if (this.#listeners.get(listener.url) === listener) {
      this.#listeners.delete(listener.url);
    }
    const terminal = Object.freeze(
      aborted
        ? {
            origin: "local",
            kind: "aborted",
            diagnostic: Object.freeze({ code: String(reason) }),
          }
        : { origin: "local", kind: "graceful" },
    );
    listener.commitTerminal(terminal);
    this.#record("listener-close", {
      nodeId: listener.nodeId,
      url: listener.url,
    });
    return terminal;
  }

  #deliver(connection, bytes, metadata, cause) {
    const document = decoder.decode(bytes);
    if (connection.closed || connection.peer?.closed) {
      this.#record("delivery-discarded", {
        from: connection.localNodeId,
        to: connection.remoteNodeId,
        ...metadata,
        cause,
      });
      return;
    }
    this.#record("delivered", {
      from: connection.localNodeId,
      to: connection.remoteNodeId,
      ...metadata,
      document,
      cause,
    });
    connection.peer.inject({
      kind: "packet",
      packet: { bytes: immutableBytes(bytes) },
    });
  }

  #takeRule(kind, facts) {
    const rule = this.#rules.find(
      (candidate) =>
        candidate.remaining > 0
        && (kind === "write"
          ? candidate.action !== "fail-close"
          : candidate.action === "fail-close")
        && matches(facts, candidate.match),
    );
    if (rule === undefined) return undefined;
    rule.remaining -= 1;
    return rule;
  }

  #connection(localNodeId, remoteNodeId) {
    const connection = [...this.#connections].findLast(
      (candidate) =>
        !candidate.closed
        && candidate.localNodeId === localNodeId
        && candidate.remoteNodeId === remoteNodeId,
    );
    if (connection === undefined) {
      throw new Error(`no live connection ${localNodeId} -> ${remoteNodeId}`);
    }
    return connection;
  }

  #terminatePair(connection, localTerminal, peerTerminal) {
    const pair = connection.pair;
    connection.commitTerminal(localTerminal);
    connection.peer?.commitTerminal(peerTerminal);
    if (!pair.released) {
      pair.released = true;
      pair.listener.active -= 1;
    }
    const affected = this.#held.filter(
      (item) =>
        item.connection === connection || item.connection === connection.peer,
    );
    this.#held = this.#held.filter((item) => !affected.includes(item));
    for (const item of affected) {
      item.reject?.(operationError(
        "SEND_FAILED",
        "send",
        "chaos channel terminated during a blocked send",
        "unknown",
      ));
    }
  }

  async #awaitDialBarrier(nodeId, url) {
    const barrier = this.#dialBarrier;
    if (barrier === undefined) return;
    barrier.pending += 1;
    this.#record("dial-barrier-reached", {
      from: nodeId,
      url,
      count: barrier.pending,
    });
    if (barrier.pending === barrier.expected) barrier.reached(barrier.pending);
    await barrier.releasePromise;
  }

  #record(action, facts) {
    const entry = Object.freeze({
      sequence: ++this.#sequence,
      action,
      ...facts,
    });
    this.ledger.push(entry);
    return entry;
  }
}

class ChaosListener {
  publication;
  terminal;
  active = 0;
  #network;
  #waiters = new Set();

  constructor(network, nodeId, url, options, callbacks) {
    this.#network = network;
    this.nodeId = nodeId;
    this.url = url;
    this.options = options;
    this.callbacks = callbacks;
    this.publication = Object.freeze({ displayAddress: url });
  }

  waitTerminal(signal) {
    if (this.terminal !== undefined) {
      return asyncTurn().then(() => this.terminal);
    }
    if (signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "wait-terminal",
        "chaos listener wait was cancelled",
      ));
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.#waiters.delete(waiter);
        reject(operationError(
          "OPERATION_ABORTED",
          "wait-terminal",
          "chaos listener wait was cancelled",
        ));
      };
      const waiter = { resolve, signal, onAbort };
      this.#waiters.add(waiter);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  close(signal) {
    if (signal.aborted && this.terminal === undefined) {
      this.#network.closeListener(this, true, "LISTENER_CLOSE_ABORTED");
    } else {
      this.#network.closeListener(this, false);
    }
    return asyncTurn().then(() => this.terminal);
  }

  abort(intent) {
    this.#network.closeListener(this, true, intent.code);
  }

  commitTerminal(terminal) {
    if (this.terminal !== undefined) return;
    this.terminal = terminal;
    for (const waiter of this.#waiters) {
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      waiter.resolve(terminal);
    }
    this.#waiters.clear();
  }
}

class ChaosConnection {
  peerEvidence = peerEvidence;
  peer;
  closed = false;
  terminal;
  #network;
  #reads = new ReadQueue();

  constructor(
    network,
    direction,
    localNodeId,
    remoteNodeId,
    limits,
    pair,
  ) {
    this.#network = network;
    this.direction = direction;
    this.localNodeId = localNodeId;
    this.remoteNodeId = remoteNodeId;
    this.limits = Object.freeze({ ...limits });
    this.pair = pair;
  }

  send(packet, signal) {
    return this.#network.write(this, packet, signal);
  }

  read(signal) {
    return this.#reads.read(signal);
  }

  close(intent, signal) {
    return this.#network.close(this, intent, signal);
  }

  abort(intent) {
    this.#network.abort(this, intent.code);
  }

  inject(read) {
    this.#reads.push(read);
  }

  commitTerminal(terminal) {
    if (this.terminal !== undefined) return;
    this.closed = true;
    this.terminal = terminal;
    this.#reads.terminal(terminal);
  }
}

class ReadQueue {
  #values = [];
  #waiter;
  #terminal;

  push(value) {
    if (this.#terminal !== undefined) return;
    if (this.#waiter === undefined) {
      this.#values.push(value);
      return;
    }
    const waiter = this.#waiter;
    this.#waiter = undefined;
    waiter.signal.removeEventListener("abort", waiter.onAbort);
    waiter.resolve(value);
  }

  terminal(terminal) {
    if (this.#terminal !== undefined) return;
    this.#terminal = terminal;
    if (this.#waiter !== undefined && this.#values.length === 0) {
      const waiter = this.#waiter;
      this.#waiter = undefined;
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      waiter.resolve({ kind: "terminal", terminal });
    }
  }

  read(signal) {
    const value = this.#values.shift();
    if (value !== undefined) return asyncTurn().then(() => value);
    if (this.#terminal !== undefined) {
      return asyncTurn().then(() => ({
        kind: "terminal",
        terminal: this.#terminal,
      }));
    }
    if (signal.aborted) {
      return Promise.reject(operationError(
        "OPERATION_ABORTED",
        "read",
        "chaos read was cancelled",
      ));
    }
    if (this.#waiter !== undefined) {
      return Promise.reject(operationError(
        "CONCURRENT_OPERATION",
        "read",
        "chaos permits one pending read",
      ));
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.#waiter = undefined;
        reject(operationError(
          "OPERATION_ABORTED",
          "read",
          "chaos read was cancelled",
        ));
      };
      this.#waiter = { resolve, reject, signal, onAbort };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

function operationError(code, phase, message, acceptance) {
  return new TransportOperationError({
    code,
    phase,
    message,
    ...(acceptance === undefined ? {} : { acceptance }),
  });
}

function immutableBytes(value) {
  const copy = Uint8Array.from(value);
  Object.freeze(copy.buffer);
  return copy;
}

function asyncTurn() {
  return new Promise((resolve) => queueMicrotask(resolve));
}

function matches(facts, expected) {
  return Object.entries(expected).every(([key, value]) => facts[key] === value);
}

function describeDocument(document) {
  try {
    const value = JSON.parse(document);
    return {
      plane: typeof value?.plane === "string" ? value.plane : "unknown",
      type: typeof value?.type === "string" ? value.type : "unknown",
      messageId: typeof value?.id === "string" ? value.id : "unknown",
    };
  } catch {
    return { plane: "invalid", type: "invalid", messageId: "invalid" };
  }
}
