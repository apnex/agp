import {
  assertTransportSchema,
  isTransportRef,
} from "@agp/transport";

import { validateWebSocketBindingSchema } from "./schema.js";
import type {
  WebSocketListenerConfigData,
  WebSocketSecurityConfigData,
  WebSocketTargetConfigData,
  WebSocketTransportConfigData,
} from "./types.generated.js";

const TRANSPORT_SCHEMA_ID =
  "urn:agp:schema:v1:binding-websocket:configuration:transport";
const CONTROL = /[\u0000-\u001F\u007F]/u;

export interface WebSocketReferenceDuplicate {
  readonly ok: false;
  readonly code: "REFERENCE_DUPLICATE";
  readonly kind: "listener" | "target";
  readonly transportRef: string;
}

export type WebSocketReferenceUniqueness =
  | { readonly ok: true; readonly code: "ACCEPT" }
  | WebSocketReferenceDuplicate;

export class WebSocketBindingConfigurationError extends TypeError {
  readonly code:
    | "SCHEMA_INVALID"
    | "REFERENCE_DUPLICATE"
    | "URL_INVALID"
    | "PROFILE_UNSUPPORTED";

  constructor(
    code: WebSocketBindingConfigurationError["code"],
    message: string,
  ) {
    super(message);
    this.name = "WebSocketBindingConfigurationError";
    this.code = code;
  }
}

export function validateWebSocketReferenceUniqueness(
  config: WebSocketTransportConfigData,
): WebSocketReferenceUniqueness {
  const listener = duplicate(config.listeners);
  if (listener !== undefined) {
    return Object.freeze({
      ok: false,
      code: "REFERENCE_DUPLICATE",
      kind: "listener",
      transportRef: listener,
    });
  }
  const target = duplicate(config.targets);
  if (target !== undefined) {
    return Object.freeze({
      ok: false,
      code: "REFERENCE_DUPLICATE",
      kind: "target",
      transportRef: target,
    });
  }
  return Object.freeze({ ok: true, code: "ACCEPT" });
}

export function assertWebSocketTransportConfig(
  value: unknown,
): asserts value is WebSocketTransportConfigData {
  const result = validateWebSocketBindingSchema<WebSocketTransportConfigData>(
    TRANSPORT_SCHEMA_ID,
    value,
  );
  if (!result.ok) {
    throw new WebSocketBindingConfigurationError(
      "SCHEMA_INVALID",
      "WebSocket transport configuration does not match its schema",
    );
  }
  const uniqueness = validateWebSocketReferenceUniqueness(result.value);
  if (!uniqueness.ok) {
    throw new WebSocketBindingConfigurationError(
      "REFERENCE_DUPLICATE",
      `duplicate ${uniqueness.kind} transportRef`,
    );
  }
  for (const listener of result.value.listeners) {
    assertReferenceAndProfile(listener);
    validateWebSocketUrl(listener.url, listener.security.mode);
  }
  for (const target of result.value.targets) {
    assertReferenceAndProfile(target);
    validateWebSocketUrl(target.url, target.security.mode);
  }
}

export function validateTrustedDevelopmentWebSocketUrl(value: string): URL {
  return validateWebSocketUrl(value, "trusted-development");
}

/**
 * Profile and scheme are bound. A cleartext locator under the secure profile,
 * or a TLS locator under the development profile, is a configuration error
 * rather than a silently weaker or stronger channel.
 */
export function validateWebSocketUrl(
  value: string,
  mode: WebSocketSecurityConfigData["mode"],
): URL {
  if (
    value.length < 1
    || [...value].length > 2048
    || CONTROL.test(value)
  ) {
    throw new WebSocketBindingConfigurationError(
      "URL_INVALID",
      "WebSocket URL is outside its bounded character domain",
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WebSocketBindingConfigurationError(
      "URL_INVALID",
      "WebSocket URL is not an absolute WHATWG URL",
    );
  }
  const expected = mode === "preshared-key" ? "wss:" : "ws:";
  if (
    url.protocol !== expected
    || url.hostname.length === 0
    || url.username.length > 0
    || url.password.length > 0
    || url.hash.length > 0
  ) {
    throw new WebSocketBindingConfigurationError(
      // A wrong-but-valid scheme is a profile mismatch. Anything else, including
      // an embedded credential under the right scheme, is an invalid locator.
      url.protocol !== expected
        && (url.protocol === "ws:" || url.protocol === "wss:")
        ? "PROFILE_UNSUPPORTED"
        : "URL_INVALID",
      `${mode} WebSocket configuration requires a credential-free ${expected} locator`,
    );
  }
  return url;
}

function assertReferenceAndProfile(
  value: WebSocketListenerConfigData | WebSocketTargetConfigData,
): void {
  if (!isTransportRef(value.transportRef)) {
    assertTransportSchema(
      "urn:agp:schema:v1:transport:common:transport-ref",
      value.transportRef,
    );
  }
  const mode = value.security.mode;
  if (mode !== "trusted-development" && mode !== "preshared-key") {
    throw new WebSocketBindingConfigurationError(
      "PROFILE_UNSUPPORTED",
      "security mode is outside the closed WebSocket profile set",
    );
  }
  if (
    value.security.mode === "preshared-key"
    && value.security.keying !== "network"
    && value.security.keying !== "node"
  ) {
    throw new WebSocketBindingConfigurationError(
      "PROFILE_UNSUPPORTED",
      "preshared-key configuration requires network or node keying",
    );
  }
}

function duplicate(
  values: readonly { readonly transportRef: string }[],
): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.transportRef)) return value.transportRef;
    seen.add(value.transportRef);
  }
  return undefined;
}
