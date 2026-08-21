import type { SecureContextOptions } from "node:tls";

import type {
  WebSocketListenerConfigData,
  WebSocketSecurityConfigData,
  WebSocketTargetConfigData,
} from "@agp/binding-websocket";
import { TRUSTED_DEVELOPMENT_PEER_EVIDENCE } from "@agp/binding-websocket";
import type {
  PresharedKeyPort,
  SecretIdentity,
  TransportPeerEvidence,
} from "@agp/transport";

import { NodeWsConfigurationError } from "./errors.js";

// TLS 1.3 only. Pre-shared-key suites carry no certificate, so a downgrade to a
// suite expecting one is a profile failure rather than a weaker channel.
const PSK_CIPHERS = "PSK";

/**
 * The identity a peer presented, stashed on the TLS socket during the
 * handshake. `pskCallback` is the only place it is observable, and the accepted
 * channel is created later, so it has to be carried across.
 */
export const PSK_IDENTITY = Symbol.for("agp.transport-node-ws.pskIdentity");
const TLS_VERSION = "TLSv1.3";

export type SecurityMode = WebSocketSecurityConfigData["mode"];

export function isSecure(
  config: WebSocketListenerConfigData | WebSocketTargetConfigData,
): boolean {
  return config.security.mode === "preshared-key";
}

export function assertPresharedKeyPort(
  config: WebSocketTransportSecurityInput,
  port: PresharedKeyPort | undefined,
): asserts port is PresharedKeyPort {
  if (port !== undefined) return;
  void config;
  throw new NodeWsConfigurationError(
    "PROFILE_UNSUPPORTED",
    "preshared-key configuration requires an injected preshared key port",
  );
}

export interface WebSocketTransportSecurityInput {
  readonly listeners: readonly WebSocketListenerConfigData[];
  readonly targets: readonly WebSocketTargetConfigData[];
}

/**
 * Listener TLS options.
 *
 * `pskCallback` must answer during the handshake, so the port is consulted
 * synchronously. Returning `undefined` from `resolve` is how a peer is refused;
 * OpenSSL turns a `null` here into a handshake failure, and the connection
 * never becomes a channel.
 */
export function listenerSecureOptions(
  port: PresharedKeyPort,
): SecureContextOptions & Record<string, unknown> {
  return {
    ciphers: PSK_CIPHERS,
    minVersion: TLS_VERSION,
    maxVersion: TLS_VERSION,
    // Replaying captured early data across connections that share a secret is
    // possible, and the neutral contract promises no such replay.
    enableTrace: false,
    pskCallback: (socket: unknown, identity: string) => {
      const secret = port.resolve(identity as SecretIdentity);
      if (secret === undefined) return null;
      (socket as Record<symbol, unknown>)[PSK_IDENTITY] = identity;
      return Buffer.from(secret);
    },
  };
}

/**
 * TLS 1.3 removed `psk_identity_hint`; it exists only in TLS 1.2 and earlier.
 * A dialer therefore observes no label for its peer, so it has no principal to
 * report. What it does know is that the peer possessed the secret registered
 * for the dialer's own identity, and `protection` carries that. Downgrading to
 * TLS 1.2 to recover a label would trade real security for reportable detail.
 */
export function targetSecureOptions(
  port: PresharedKeyPort,
): Record<string, unknown> {
  return {
    ciphers: PSK_CIPHERS,
    minVersion: TLS_VERSION,
    maxVersion: TLS_VERSION,
    // A pre-shared-key handshake presents no certificate, so the default
    // hostname/chain check has nothing to verify and would reject every peer.
    // Authentication comes from the secret, not from a name.
    checkServerIdentity: () => undefined,
    rejectUnauthorized: false,
    pskCallback: () => ({
      psk: Buffer.from(port.own()),
      identity: port.localIdentity,
    }),
  };
}

/**
 * Evidence must state what the handshake actually proved.
 *
 * Under `network` keying every holder can present any identity, so the label a
 * peer offered proves nothing about which peer connected and is deliberately
 * discarded. `protection` still separates an encrypted group link from
 * cleartext, so nothing truthful is lost.
 */
export function presharedKeyEvidence(
  security: WebSocketSecurityConfigData,
  observedIdentity: string | undefined,
): TransportPeerEvidence {
  if (security.mode !== "preshared-key") {
    return TRUSTED_DEVELOPMENT_PEER_EVIDENCE;
  }
  // A dialer passes undefined: TLS 1.3 gives it no observed peer label.
  if (security.keying === "network" || observedIdentity === undefined) {
    return Object.freeze({
      locality: "network",
      protection: "confidentiality-and-integrity",
      authentication: Object.freeze({ kind: "none" }),
    }) as TransportPeerEvidence;
  }
  return Object.freeze({
    locality: "network",
    protection: "confidentiality-and-integrity",
    authentication: Object.freeze({
      kind: "verified",
      principal: observedIdentity,
      method: "tls-psk",
    }),
  }) as TransportPeerEvidence;
}
