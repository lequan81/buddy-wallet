/**
 * Redis Infrastructure
 *
 * Stateful Redis connection management and cache operations.
 * Located in app/Providers/Plugins/Infrastructure/ per Laravel convention.
 */

// Re-export core connectivity
export { isRedisAvailable, getClient, initRedis, closeRedis } from './Connection';
export * from './Cache';
export * from './CircuitBreaker';
export { sessionCache, userCache, permissionCache, importCache, jwtBlacklist } from './caches';
export type { ImportProgress } from './caches';

// Elysia plugin
export { redisPlugin } from './RedisPlugin';
