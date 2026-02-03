/**
 * Redis Plugin for Elysia
 *
 * Modular Redis plugin with:
 * - Connection management (TCP only, component-based config)
 * - Circuit breaker for resilience
 * - Generic cache operations
 * - Domain-specific cache helpers
 */
import { Elysia } from 'elysia';
import { initRedis, closeRedis, isRedisAvailable, getClient } from './connection';
import { cache } from './cache';
import { sessionCache, userCache, permissionCache, importCache, jwtBlacklist } from './caches';

// Re-export everything for consumers
export { isRedisAvailable, getClient } from './connection';
export { cache } from './cache';
export { circuitBreaker } from './circuit-breaker';
export { sessionCache, userCache, permissionCache, importCache, jwtBlacklist } from './caches';
export type { ImportProgress } from './caches';

/**
 * Elysia plugin for Redis
 */
export const redisPlugin = new Elysia({ name: 'Redis' })
  .onStart(async () => {
    await initRedis();
  })
  .onStop(async () => {
    closeRedis();
  })
  .derive({ as: 'global' }, () => ({
    redis: getClient(),
    cache,
    sessionCache
  }));

export default redisPlugin;
