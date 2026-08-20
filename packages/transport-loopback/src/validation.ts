import type {
  TransportChannelLimits,
  TransportListenOptions,
  TransportRef,
} from "@agp/transport";

import { configurationError } from "./errors.js";
import type {
  LoopbackAddress,
  LoopbackFabricConfig,
  LoopbackFabricLimits,
  LoopbackListenerConfig,
  LoopbackTargetConfig,
  LoopbackTransportConfig,
} from "./types.generated.js";

const SEGMENT = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const REFERENCE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export function validateFabricConfig(
  config: LoopbackFabricConfig,
): LoopbackFabricConfig {
  assertExactKeys(config, ["fabricId", "limits"], "fabric");
  validateSegment(config.fabricId, "fabricId");
  validateLimits(config.limits);
  const requiredPendingBytes =
    2 * config.limits.maxActiveChannels * config.limits.maxPacketBytes;
  if (
    !Number.isSafeInteger(requiredPendingBytes)
    || config.limits.maxPendingSendBytesTotal < requiredPendingBytes
  ) {
    throw configurationError(
      "maxPendingSendBytesTotal cannot snapshot one send per channel endpoint",
    );
  }
  if (
    config.limits.maxBufferedPacketsPerChannel
      > config.limits.maxQueuedPacketsTotal
    || config.limits.maxBufferedBytesPerChannel
      > config.limits.maxQueuedBytesTotal
  ) {
    throw configurationError(
      "Per-channel queue limits cannot exceed fabric queue limits",
    );
  }
  if (
    config.limits.maxPacketBytes
      > config.limits.maxBufferedBytesPerChannel
  ) {
    throw configurationError(
      "maxBufferedBytesPerChannel must admit one maximum packet",
    );
  }
  return config;
}

export function validateTransportConfig(
  config: LoopbackTransportConfig,
): void {
  assertExactKeys(
    config,
    ["transportName", "capabilities"],
    "transport",
  );
  assertExactKeys(
    config.capabilities,
    ["listen", "connect"],
    "transport capabilities",
  );
  validateSegment(config.transportName, "transportName");
  if (
    typeof config.capabilities.listen !== "boolean"
    || typeof config.capabilities.connect !== "boolean"
    || (!config.capabilities.listen && !config.capabilities.connect)
  ) {
    throw configurationError(
      "Transport must declare at least one acquisition capability",
    );
  }
}

export function validateBoundConfig(
  expectedFabricId: string,
  value: LoopbackListenerConfig | LoopbackTargetConfig,
  kind: "listener" | "target",
): void {
  assertExactKeys(value, ["fabricId", "address"], kind);
  if (value.fabricId !== expectedFabricId) {
    throw configurationError(`${kind} belongs to another fabric identity`);
  }
  validateAddress(value.address);
  if (
    Buffer.byteLength(
      `loopback://${expectedFabricId}/${value.address}`,
      "utf8",
    ) > 253
  ) {
    throw configurationError(
      `${kind} display address exceeds 253 UTF-8 bytes`,
    );
  }
}

export function validateAddress(value: string): asserts value is LoopbackAddress {
  if (
    typeof value !== "string"
    || value.length === 0
    || Buffer.byteLength(value, "utf8") > 253
    || !value.split("/").every((segment) => SEGMENT.test(segment))
  ) {
    throw configurationError("Invalid Loopback address");
  }
}

export function validateReference(
  value: string,
): asserts value is TransportRef {
  if (
    typeof value !== "string"
    || value.length > 64
    || !REFERENCE.test(value)
  ) {
    throw configurationError("Invalid TransportRef");
  }
}

export function validateChannelLimits(
  limits: TransportChannelLimits,
  fabric: LoopbackFabricLimits,
): void {
  const names = [
    "maxPacketBytes",
    "maxBufferedPackets",
    "maxBufferedBytes",
  ] as const;
  assertExactKeys(limits, names, "channel limits");
  for (const name of names) {
    const value = limits[name];
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw configurationError(`Invalid channel limit ${name}`);
    }
  }
  if (limits.maxBufferedBytes < limits.maxPacketBytes) {
    throw configurationError(
      "maxBufferedBytes must admit one maximum packet",
    );
  }
  if (
    limits.maxPacketBytes > fabric.maxPacketBytes
    || limits.maxBufferedPackets > fabric.maxBufferedPacketsPerChannel
    || limits.maxBufferedBytes > fabric.maxBufferedBytesPerChannel
  ) {
    throw configurationError(
      "Channel limits exceed the owning fabric ceiling",
    );
  }
}

export function validateListenOptions(
  options: TransportListenOptions,
  fabric: LoopbackFabricLimits,
): void {
  assertExactKeys(options, ["limits"], "listen options");
  const limits = options.limits;
  assertExactKeys(
    limits,
    [
      "maxPendingAcquisitions",
      "maxActiveChannels",
      "channel",
    ],
    "listener limits",
  );
  for (const name of [
    "maxPendingAcquisitions",
    "maxActiveChannels",
  ] as const) {
    const value = limits[name];
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw configurationError(`Invalid listener limit ${name}`);
    }
  }
  if (
    limits.maxPendingAcquisitions > fabric.maxPendingAcquisitions
    || limits.maxActiveChannels > fabric.maxActiveChannels
  ) {
    throw configurationError(
      "Listener limits exceed the owning fabric ceiling",
    );
  }
  validateChannelLimits(limits.channel, fabric);
}

function validateLimits(limits: LoopbackFabricLimits): void {
  const names = [
    "maxTransports",
    "maxListeners",
    "maxPendingAcquisitions",
    "maxActiveChannels",
    "maxPacketBytes",
    "maxBufferedPacketsPerChannel",
    "maxBufferedBytesPerChannel",
    "maxQueuedPacketsTotal",
    "maxQueuedBytesTotal",
    "maxPendingSendBytesTotal",
  ] as const;
  assertExactKeys(limits, names, "fabric limits");
  for (const name of names) {
    const value = limits[name];
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw configurationError(`Invalid positive safe-integer limit ${name}`);
    }
  }
  if (limits.maxListeners > 4096 || limits.maxActiveChannels > 4096) {
    throw configurationError(
      "Snapshot-backed listener/channel limits cannot exceed 4096",
    );
  }
}

function validateSegment(value: string, field: string): void {
  if (typeof value !== "string" || !SEGMENT.test(value)) {
    throw configurationError(`Invalid ${field}`);
  }
}

function assertExactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    throw configurationError(`${label} must be an object record`);
  }
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== expected.length
    || actual.some(
      (key) =>
        typeof key !== "string"
        || !expected.includes(key),
    )
  ) {
    throw configurationError(`${label} has an invalid field set`);
  }
}
