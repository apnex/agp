import catalogDocument from "./semantic-rules/v1/semantic-rules.catalog.json" with {
  type: "json",
};
import type { JsonObject } from "./types.generated.js";

deepFreeze(catalogDocument);

export const protocolSemanticRulesCatalogV1 =
  catalogDocument as unknown as Readonly<JsonObject>;

function deepFreeze(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  Object.freeze(value);
}
