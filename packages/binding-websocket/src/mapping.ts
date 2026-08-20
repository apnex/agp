import type {
  TransportCloseIntent,
  TransportInputRejected,
  TransportPacket,
  TransportTerminal,
} from "@agp/transport";

import type { WebSocketBindingRejectionCode } from "./types.generated.js";

export interface WebSocketCloseAction {
  readonly code: 1000 | 1002 | 1003 | 1007 | 1009 | 1011;
  readonly reason: "";
}

export interface WebSocketMessageObservation {
  readonly bytes: Readonly<Uint8Array>;
  readonly isBinary: boolean;
  readonly maxPacketBytes: number;
}

export type WebSocketMessageClassification =
  | {
      readonly kind: "packet";
      readonly packet: TransportPacket;
    }
  | {
      readonly kind: "input-rejected";
      readonly bindingCode: WebSocketBindingRejectionCode;
      readonly rejection: TransportInputRejected;
      readonly terminal: TransportTerminal;
      readonly close: WebSocketCloseAction;
    };

export function classifyWebSocketMessage(
  observation: WebSocketMessageObservation,
): WebSocketMessageClassification {
  if (observation.bytes.byteLength > observation.maxPacketBytes) {
    return rejected(
      "PACKET_TOO_LARGE",
      "PACKET_TOO_LARGE",
      1009,
    );
  }
  if (!observation.isBinary) {
    return rejected(
      "TEXT_MESSAGE",
      "MALFORMED_CARRIER_INPUT",
      1003,
    );
  }
  return Object.freeze({
    kind: "packet",
    packet: Object.freeze({
      bytes: observation.bytes,
    }),
  });
}

export function classifyWebSocketNativeInputFailure(
  nativeCode: string | undefined,
): Exclude<WebSocketMessageClassification, { kind: "packet" }> | undefined {
  if (nativeCode === "WS_ERR_INVALID_UTF8") {
    return rejected(
      "INVALID_TEXT_UTF8",
      "MALFORMED_CARRIER_INPUT",
      1007,
    );
  }
  if (nativeCode === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH") {
    return rejected(
      "PACKET_TOO_LARGE",
      "PACKET_TOO_LARGE",
      1009,
    );
  }
  if (
    nativeCode === "WS_ERR_UNEXPECTED_RSV_1"
    || nativeCode === "WS_ERR_INVALID_OPCODE"
    || nativeCode === "WS_ERR_EXPECTED_FIN"
  ) {
    return rejected(
      "MALFORMED_FRAMING",
      "MALFORMED_CARRIER_INPUT",
      1002,
    );
  }
  return undefined;
}

export function webSocketCloseAction(
  _intent: TransportCloseIntent,
): WebSocketCloseAction {
  return Object.freeze({ code: 1000, reason: "" });
}

export function webSocketReceiveOverflowAction(): WebSocketCloseAction {
  return Object.freeze({ code: 1011, reason: "" });
}

function rejected(
  bindingCode: WebSocketBindingRejectionCode,
  code: TransportInputRejected["code"],
  closeCode: WebSocketCloseAction["code"],
): Exclude<WebSocketMessageClassification, { kind: "packet" }> {
  const rejection = Object.freeze({ kind: "input-rejected" as const, code });
  return Object.freeze({
    kind: "input-rejected",
    bindingCode,
    rejection,
    terminal: Object.freeze({
      origin: "remote" as const,
      kind: "binding-violation" as const,
      diagnostic: Object.freeze({ code }),
    }),
    close: Object.freeze({ code: closeCode, reason: "" as const }),
  });
}
