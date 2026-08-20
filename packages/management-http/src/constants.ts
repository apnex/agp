export const MANAGEMENT_API_VERSION = "agp.management/v1" as const;
export const MANAGEMENT_ALLOWED_METHODS = "GET, HEAD, OPTIONS" as const;
export const MANAGEMENT_HTTP_LIMITS = Object.freeze({
  maxRequestTargetBytes: 2_048,
  maxRequestHeaderBytes: 16 * 1_024,
  minimumResponseBytes: 1_024,
  defaultMaxResponseBytes: 4 * 1024 * 1024,
  maximumResponseBytes: 16 * 1024 * 1024,
});
