export class ControlledListenerTransport {
  #reference;
  #terminal = deferred();
  #committedTerminal;
  #callbacks;
  listenCalls = 0;
  closeCalls = 0;

  constructor(reference = "controlled.listener") {
    this.#reference = reference;
  }

  port() {
    return Object.freeze({
      resolveListener: (reference) =>
        reference === this.#reference
          ? Object.freeze({
              listen: (options, callbacks, signal) =>
                this.#listen(options, callbacks, signal),
            })
          : undefined,
      resolveTarget: () => undefined,
    });
  }

  accept(channel) {
    assertListening(this.#callbacks);
    this.#callbacks.accept({ channel });
  }

  capacityRejected(kind = "active-channel") {
    assertListening(this.#callbacks);
    this.#callbacks.capacityRejected(kind);
  }

  terminalize(terminal) {
    if (this.#committedTerminal !== undefined) {
      return this.#committedTerminal;
    }
    this.#committedTerminal = Object.freeze(terminal);
    this.#terminal.resolve(this.#committedTerminal);
    return this.#committedTerminal;
  }

  async #listen(_options, callbacks, signal) {
    throwIfAborted(signal);
    this.listenCalls += 1;
    this.#callbacks = callbacks;
    return Object.freeze({
      publication: Object.freeze({
        displayAddress: `controlled://${this.#reference}`,
      }),
      waitTerminal: (waitSignal) =>
        waitFor(this.#terminal.promise, waitSignal),
      close: async (closeSignal) => {
        throwIfAborted(closeSignal);
        this.closeCalls += 1;
        return this.terminalize({ origin: "local", kind: "graceful" });
      },
      abort: () => {
        this.terminalize({ origin: "local", kind: "aborted" });
      },
    });
  }
}

export class ControlledChannel {
  peerEvidence;
  closeCalls = 0;
  abortCalls = 0;
  sendCalls = 0;
  readCalls = 0;
  #reads = [];
  #readWaiter;
  #terminal;
  #pendingWrites = [];
  #holdWrites;
  #acceptedOnClose;
  #closeCompletion;

  constructor({
    peerEvidence = defaultPeerEvidence(),
    holdWrites = false,
    acceptedOnClose = [],
  } = {}) {
    this.peerEvidence = peerEvidence;
    this.#holdWrites = holdWrites;
    this.#acceptedOnClose = [...acceptedOnClose];
  }

  async send(_packet, signal) {
    throwIfAborted(signal);
    this.sendCalls += 1;
    if (!this.#holdWrites) return;
    await new Promise((resolve, reject) => {
      this.#pendingWrites.push({ resolve, reject });
    });
  }

  read(signal) {
    throwIfAborted(signal);
    if (this.#readWaiter !== undefined) {
      return Promise.reject(new Error("concurrent read"));
    }
    this.readCalls += 1;
    const next = this.#reads.shift();
    if (next !== undefined) {
      this.#observeRead(next);
      return Promise.resolve(next);
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.#readWaiter = undefined;
        reject(abortReason(signal));
      };
      this.#readWaiter = {
        resolve: (value) => {
          signal.removeEventListener("abort", onAbort);
          this.#readWaiter = undefined;
          this.#observeRead(value);
          resolve(value);
        },
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  async close(_intent, signal) {
    throwIfAborted(signal);
    this.closeCalls += 1;
    if (this.#terminal === undefined) {
      this.#closeCompletion = deferred();
      for (const bytes of this.#acceptedOnClose) {
        this.#enqueue(Object.freeze({
          kind: "packet",
          packet: Object.freeze({ bytes }),
        }));
      }
      this.terminalize({ origin: "local", kind: "graceful" });
    }
    if (this.#closeCompletion !== undefined) {
      await waitFor(this.#closeCompletion.promise, signal);
    }
    return this.#terminal;
  }

  abort() {
    this.abortCalls += 1;
    this.terminalize({ origin: "local", kind: "aborted" });
  }

  failWrites(error = new Error("controlled write failure")) {
    for (const pending of this.#pendingWrites.splice(0)) {
      pending.reject(error);
    }
  }

  releaseWrites() {
    for (const pending of this.#pendingWrites.splice(0)) pending.resolve();
  }

  terminalize(terminal) {
    if (this.#terminal !== undefined) return this.#terminal;
    this.#terminal = Object.freeze(terminal);
    this.#enqueue(Object.freeze({
      kind: "terminal",
      terminal: this.#terminal,
    }));
    return this.#terminal;
  }

  #enqueue(value) {
    const waiter = this.#readWaiter;
    if (waiter === undefined) this.#reads.push(value);
    else waiter.resolve(value);
  }

  #observeRead(value) {
    if (value.kind === "terminal") this.#closeCompletion?.resolve();
  }
}

export async function eventually(probe, description, attempts = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = probe();
    if (result !== undefined && result !== false) return result;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`did not observe ${description}`);
}

function defaultPeerEvidence() {
  return Object.freeze({
    locality: "process-local",
    protection: "none",
    authentication: Object.freeze({ kind: "none" }),
  });
}

function assertListening(callbacks) {
  if (callbacks === undefined) throw new Error("listener is not active");
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
