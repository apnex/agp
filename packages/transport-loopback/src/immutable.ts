export function immutableBytes(
  source: Readonly<Uint8Array>,
): Readonly<Uint8Array> {
  // ECMAScript rejects Object.freeze() for non-empty typed-array views.
  // Ownership, rather than a mutable public reference, provides stability:
  // this private copy is never returned to the sender or retained after the
  // receiver-facing copy is constructed.
  return Uint8Array.from(source);
}

export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
}

export function asyncTurn(): Promise<void> {
  return Promise.resolve();
}
