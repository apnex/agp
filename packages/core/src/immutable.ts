/**
 * Clone JSON-like/public DTO values and recursively freeze the clone. This
 * prevents consumers from mutating canonical state through query results.
 */
export function immutableClone<T>(value: T): T {
  return freezeClone(value, new WeakMap<object, object>());
}

function freezeClone<T>(
  value: T,
  seen: WeakMap<object, object>,
): T {
  if (value === null || typeof value !== "object") return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;

  if (Array.isArray(value)) {
    const array: unknown[] = [];
    seen.set(value, array);
    for (const item of value) array.push(freezeClone(item, seen));
    return Object.freeze(array) as T;
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
  return Object.freeze(result) as T;
}

export function compareUtf8(left: string, right: string): number {
  if (left === right) return 0;
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index];
    const bv = b[index];
    if (av === undefined || bv === undefined) break;
    if (av !== bv) return av - bv;
  }
  return a.length - b.length;
}
