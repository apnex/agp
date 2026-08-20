/**
 * Small deterministic command executor. It never runs more than one command
 * at once and an individual rejection cannot poison later commands.
 */
export class SerializedExecutor {
  #tail: Promise<void> = Promise.resolve();
  #closed = false;

  run<T>(command: () => T | Promise<T>): Promise<T> {
    if (this.#closed) {
      return Promise.reject(new Error("serialized executor is closed"));
    }
    const result = this.#tail.then(command);
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async quiesce(): Promise<void> {
    await this.#tail;
  }

  async close(): Promise<void> {
    this.#closed = true;
    await this.#tail;
  }
}
