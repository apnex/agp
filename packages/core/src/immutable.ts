/**
 * Values this module has already cloned and deeply frozen.
 *
 * Membership is the exact claim "every reachable value below this one is
 * frozen", which `Object.isFrozen` alone does not make: a frozen object may
 * hold mutable children. Only this module adds to the set, and only after the
 * whole subtree is frozen, so a hostile caller cannot forge membership by
 * freezing a shallow object.
 */
const deeplyFrozen = new WeakSet<object>();

/**
 * Clone JSON-like/public DTO values and recursively freeze the clone. This
 * prevents consumers from mutating canonical state through query results.
 *
 * A value this module already produced is returned as it is. Sharing it is
 * safe precisely because it is frozen: two readers holding one reference can
 * no more disturb each other than two holding separate copies. Re-cloning it
 * was the cost that made a read materialise on every write, and canonical
 * state is written far more often than it is queried.
 */
export function immutableClone<T>(value: T): T {
  return freezeClone(value, new WeakMap<object, object>());
}

function freezeClone<T>(
  value: T,
  seen: WeakMap<object, object>,
): T {
  if (value === null || typeof value !== "object") return value;
  if (deeplyFrozen.has(value)) return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;

  if (Array.isArray(value)) {
    const array: unknown[] = [];
    seen.set(value, array);
    for (const item of value) array.push(freezeClone(item, seen));
    Object.freeze(array);
    deeplyFrozen.add(array);
    return array as T;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("immutableClone accepts only DTO objects and arrays");
  }
  const result: Record<string, unknown> = {};
  seen.set(value, result);
  for (const key of Object.keys(value)) {
    result[key] = freezeClone(
      (value as Record<string, unknown>)[key],
      seen,
    );
  }
  Object.freeze(result);
  deeplyFrozen.add(result);
  return result as T;
}

// One encoder, not one per comparison. A sort allocated two of these and two
// buffers for every pair it examined, which is O(n log n) allocations on a
// path that runs per committed message.
const utf8 = new TextEncoder();
// Below this code point a JavaScript string compares identically by code unit
// and by UTF-8 byte, so the common identifier case needs no encoding at all.
const ASCII_ONLY = /^[\u0000-\u007f]*$/u;

export function compareUtf8(left: string, right: string): number {
  if (left === right) return 0;
  if (ASCII_ONLY.test(left) && ASCII_ONLY.test(right)) {
    return left < right ? -1 : 1;
  }
  const a = utf8.encode(left);
  const b = utf8.encode(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index];
    const bv = b[index];
    if (av === undefined || bv === undefined) break;
    if (av !== bv) return av - bv;
  }
  return a.length - b.length;
}
