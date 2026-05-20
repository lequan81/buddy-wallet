/**
 * Redis Provider
 *
 * Stateful Redis connection management and cache operations.
 * Pure function exports for ElysiaJS FP architecture.
 */

// Re-export core connectivity
export { isRedisAvailable, getClient, initRedis, closeRedis } from './connection';
export * from './cache';
export * from './circuit-breaker';
export { sessionCache, sessionMetaCache, userCache, permissionCache, importCache, jwtBlacklist } from './caches';
