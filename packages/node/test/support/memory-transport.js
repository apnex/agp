export class MemoryPeerNetwork {
  #listeners = new Map();
  #peerEvidence;
  // Every outbound packet, when a test asks for them. This is the only place
  // every message a node sends passes through as bytes, whatever built it, so
  // a gate over what AGP puts on the wire belongs here rather than over the
  // constructors it happens to know about.
  #captured;

  constructor({ peerEvidence = defaultPeerEvidence(), capture = false } = {}) {
    this.#peerEvidence = peerEvidence;
    this.#captured = capture ? [] : undefined;
  }

  /** Every packet sent since the network was created, as raw bytes. */
  captured() {
    if (this.#captured === undefined) {
      throw new Error("construct the network with { capture: true }");
    }
    return [...this.#captured];
  }

  observe(bytes) {
    this.#captured?.push(bytes);
  }

  transport({ listeners = [], targets = [] } = {}) {
    const listenerCapabilities = new Map(
      listeners.map((reference) => [
        reference,
        Object.freeze({
          listen: (options, callbacks, signal) =>
            this.#listen(reference, options, callbacks, signal),
        }),
      ]),
    );
    const targetCapabilities = new Map(
      targets.map((reference) => [
        reference,
        Object.freeze({
          connect: (options, signal) =>
            this.#connect(reference, options, signal),
        }),
      ]),
    );
    return Object.freeze({
      resolveListener: (reference) => listenerCapabilities.get(reference),
      resolveTarget: (reference) => targetCapabilities.get(reference),
    });
  }

  async #listen(reference, options, callbacks, signal) {
    throwIfAborted(signal);
    if (this.#listeners.has(reference)) throw new Error("address in use");
    const terminal = deferred();
    let committed;
    const commit = (value) => {
      if (committed !== undefined) return committed;
      committed = Object.freeze(value);
      this.#listeners.delete(reference);
      terminal.resolve(committed);
      return committed;
    };
    const record = {
      callbacks,
      limits: options.limits,
      activeChannels: 0,
      releaseChannel() {
        record.activeChannels -= 1;
      },
    };
    this.#listeners.set(reference, record);
    return Object.freeze({
      publication: Object.freeze({
        displayAddress: `memory://${reference}`,
      }),
      waitTerminal: (waitSignal) =>
        waitFor(terminal.promise, waitSignal),
      close: async (closeSignal) => {
        throwIfAborted(closeSignal);
        return commit({ origin: "local", kind: "graceful" });
      },
      abort: () => {
        commit({ origin: "local", kind: "aborted" });
      },
    });
  }

  async #connect(reference, options, signal) {
    throwIfAborted(signal);
    const listener = this.#listeners.get(reference);
    if (listener === undefined) throw new Error("connection refused");
    if (listener.activeChannels >= listener.limits.maxActiveChannels) {
      listener.callbacks.capacityRejected("active-channel");
      throw new Error("listener capacity exceeded");
    }
    listener.activeChannels += 1;
    const pair = createChannelPair(
      options.channel,
      listener.limits.channel,
      listener.releaseChannel,
      this.#peerEvidence,
      this,
    );
    queueMicrotask(() => {
      listener.callbacks.accept({ channel: pair.inbound });
    });
    return pair.outbound;
  }
}

class MemoryChannel {
  peer;
  readonlyLimits;
  peerEvidence;
  #reads = new AsyncQueue();
  #terminal;
  #release;

  constructor(limits, release, peerEvidence, network) {
    this.readonlyLimits = limits;
    this.#release = release;
    this.peerEvidence = peerEvidence;
    this.network = network;
  }

  async send(packet, signal) {
    throwIfAborted(signal);
    if (this.#terminal !== undefined || this.peer?.#terminal !== undefined) {
      throw new Error("channel terminal");
    }
    if (!(packet?.bytes instanceof Uint8Array)) {
      throw new TypeError("packet bytes must be Uint8Array");
    }
    if (packet.bytes.byteLength > this.readonlyLimits.maxPacketBytes) {
      throw new Error("packet too large");
    }
    const bytes = new Uint8Array(packet.bytes);
    this.network?.observe(bytes);
    this.peer.#reads.push(Object.freeze({
      kind: "packet",
      packet: Object.freeze({ bytes }),
    }));
  }

  async read(signal) {
    const result = await this.#reads.next(signal);
    if (!result.done) return result.value;
    if (this.#terminal !== undefined) {
      return Object.freeze({
        kind: "terminal",
        terminal: this.#terminal,
      });
    }
    throw new Error("channel input ended without a terminal disposition");
  }

  async close(_intent, signal) {
    throwIfAborted(signal);
    if (this.#terminal !== undefined) return this.#terminal;
    this.#commit(
      { origin: "local", kind: "graceful" },
      { origin: "remote", kind: "graceful" },
    );
    return this.#terminal;
  }

  abort(_intent) {
    if (this.#terminal !== undefined) return;
    this.#commit(
      { origin: "local", kind: "aborted" },
      { origin: "carrier", kind: "io-failure" },
    );
  }

  #commit(localTerminal, remoteTerminal) {
    this.#terminal = Object.freeze(localTerminal);
    this.#reads.push(Object.freeze({
      kind: "terminal",
      terminal: this.#terminal,
    }));
    this.#reads.finish();
    if (this.peer.#terminal === undefined) {
      this.peer.#terminal = Object.freeze(remoteTerminal);
      this.peer.#reads.push(Object.freeze({
        kind: "terminal",
        terminal: this.peer.#terminal,
      }));
      this.peer.#reads.finish();
    }
    const release = this.#release;
    this.#release = undefined;
    release?.();
    this.peer.#release = undefined;
  }
}

class AsyncQueue {
  #values = [];
  #waiters = [];
  #done = false;

  push(value) {
    if (this.#done) return;
    const waiter = this.#waiters.shift();
    if (waiter === undefined) {
      this.#values.push(value);
      return;
    }
    waiter.cleanup();
    waiter.resolve({ value, done: false });
  }

  finish() {
    this.#done = true;
    for (const waiter of this.#waiters.splice(0)) {
      waiter.cleanup();
      waiter.resolve({ value: undefined, done: true });
    }
  }

  next(signal) {
    if (signal.aborted) return Promise.reject(abortReason(signal));
    const value = this.#values.shift();
    if (value !== undefined) {
      return Promise.resolve({ value, done: false });
    }
    if (this.#done) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        const index = this.#waiters.indexOf(waiter);
        if (index !== -1) this.#waiters.splice(index, 1);
        reject(abortReason(signal));
      };
      const waiter = {
        resolve,
        cleanup: () => signal.removeEventListener("abort", onAbort),
      };
      this.#waiters.push(waiter);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}

function createChannelPair(
  outboundLimits,
  inboundLimits,
  release,
  peerEvidence,
  network,
) {
  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    release();
  };
  const outbound = new MemoryChannel(
    outboundLimits,
    releaseOnce,
    peerEvidence,
    network,
  );
  const inbound = new MemoryChannel(
    inboundLimits,
    releaseOnce,
    peerEvidence,
    network,
  );
  outbound.peer = inbound;
  inbound.peer = outbound;
  return { outbound, inbound };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function waitFor(promise, signal) {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then((value) => {
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    });
  });
}

function throwIfAborted(signal) {
  if (signal.aborted) throw abortReason(signal);
}

function abortReason(signal) {
  return signal.reason ?? new Error("operation aborted");
}

function defaultPeerEvidence() {
  return Object.freeze({
    locality: "process-local",
    protection: "none",
    authentication: Object.freeze({
      kind: "verified",
      principal: "memory-peer",
      method: "same-process-capability",
    }),
  });
}

export async function eventually(probe, description, attempts = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = probe();
    if (result !== undefined && result !== false) return result;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`did not observe ${description}`);
}
