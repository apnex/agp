export {
  AGP_V1_DELIVERY_ERROR_CODES,
  AGP_V1_DELIVERY_ERROR_REASONS,
  AGP_V1_FATAL_NOTIFICATION_CODES,
  AGP_V1_ROUTE_REJECTION_CODES,
} from "./code-catalogs.generated.js";

export const AGP_V1 = 1 as const;
export const AGP_V1_LIMITS = Object.freeze({
  defaultReceiveBytes: 1_048_576,
  minReceiveBytes: 131_072,
  maxReceiveBytes: 16_777_216,
  maxOpenBytes: 4_096,
  maxDepth: 32,
  maxRoutesPerSnapshot: 256,
  maxPathLength: 64,
  maxDataHopLimit: 255,
  maxWireRevision: 9_007_199_254_740_991,
  maxSafeIntegerMagnitude: 9_007_199_254_740_991,
  maxReasonCharacters: 256,
  maxExtensionKeys: 32,
  maxCloseReasonUtf8Bytes: 123,
} as const);
