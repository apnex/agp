export const AGP_WEBSOCKET_SUBPROTOCOL = "agp.v1" as const;

export const TRUSTED_DEVELOPMENT_PEER_EVIDENCE = Object.freeze({
  locality: "network",
  protection: "none",
  authentication: Object.freeze({ kind: "none" as const }),
} as const);
