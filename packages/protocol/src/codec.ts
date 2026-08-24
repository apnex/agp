import { AGP_V1_LIMITS } from "./constants.js";
import {
  hasUnpairedUtf16Surrogate,
  preflightRawJson,
} from "./preflight.js";
import { validateAgpMessage } from "./schema.js";
import type {
  AgpMessage,
  EncodeResult,
  ParseLimits,
  ParseResult,
} from "./types.js";

export function parseAgpPacket(
  input: Readonly<Uint8Array>,
  limits: ParseLimits,
): ParseResult {
  if (!isWireByteLimit(limits.receiveLimitBytes)) {
    return { ok: false, reasonCode: "LIMIT_INVALID" };
  }

  if (!(input instanceof Uint8Array)) {
    return {
      ok: false,
      reasonCode: "INVALID_UTF8",
      notificationCode: "INVALID_MESSAGE",
    };
  }
  const utf8Bytes = input.byteLength;
  if (utf8Bytes > limits.receiveLimitBytes) {
    return {
      ok: false,
      reasonCode: "MESSAGE_TOO_LARGE",
      notificationCode: "INVALID_MESSAGE",
    };
  }
  let text: string;
  try {
    // Retain a leading BOM so packet and JSON grammar behavior is explicit.
    text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(input);
  } catch {
    return {
      ok: false,
      reasonCode: "INVALID_UTF8",
      notificationCode: "INVALID_MESSAGE",
    };
  }

  const rawFailure = preflightRawJson(text);
  if (rawFailure !== undefined) {
    return {
      ok: false,
      reasonCode: rawFailure,
      notificationCode: "INVALID_MESSAGE",
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      ok: false,
      reasonCode: "INVALID_JSON",
      notificationCode: "INVALID_MESSAGE",
    };
  }

  const validation = validateAgpMessage(value);
  if (!validation.ok) {
    return validation;
  }

  if (
    validation.message.type === "open" &&
    utf8Bytes > AGP_V1_LIMITS.maxOpenBytes
  ) {
    return {
      ok: false,
      reasonCode: "MESSAGE_TOO_LARGE",
      notificationCode: "INVALID_MESSAGE",
    };
  }

  return {
    ok: true,
    message: validation.message,
    utf8Bytes,
  };
}

export function encodeAgpPacket(
  message: AgpMessage,
  sendLimitBytes: number,
): EncodeResult {
  if (!isWireByteLimit(sendLimitBytes)) {
    return { ok: false, reasonCode: "LIMIT_INVALID" };
  }

  // Not validated against its schema here.
  //
  // This message was built by this node from its own generated types, so the
  // check proved that our own construction matched our own contract, and it
  // cost between a fifth and a quarter of throughput to prove it on every
  // message forever. It is proven once instead, over the bytes a real topology
  // puts on the wire, by `outbound-wire-validity`.
  //
  // What a peer sends is a different question and is still validated on parse.
  // Nothing about trusting a peer changed. See `D27`.
  let text: string;
  try {
    text = JSON.stringify(message);
  } catch {
    return { ok: false, reasonCode: "INVALID_MESSAGE" };
  }

  if (hasUnpairedUtf16Surrogate(text)) {
    return { ok: false, reasonCode: "INVALID_MESSAGE" };
  }
  const bytes = new TextEncoder().encode(text);
  const utf8Bytes = bytes.byteLength;
  if (
    utf8Bytes > sendLimitBytes ||
    (message.type === "open" &&
      utf8Bytes > AGP_V1_LIMITS.maxOpenBytes)
  ) {
    return { ok: false, reasonCode: "MESSAGE_TOO_LARGE" };
  }

  return { ok: true, bytes, utf8Bytes };
}

function isWireByteLimit(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= AGP_V1_LIMITS.minReceiveBytes &&
    value <= AGP_V1_LIMITS.maxReceiveBytes
  );
}
