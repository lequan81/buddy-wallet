/**
 * Plugins - Central export for all Elysia plugins
 *
 * Organized into subfolders:
 * - guards/     - Permission and access control guards
 * - middleware/ - Request processing, security, logging
 * - auth/       - JWT and session authentication
 * - redis/      - Redis caching and connection
 */

// Auth plugins
export * from './auth';

// Guards
export * from './guards';

// Middleware
export * from './middleware';

// Access control (combined plugin)
export { accessControlPlugin } from './guards/access-control.plugin';

// Redis (re-exported from lib/redis for convenience)
export { redisPlugin, isRedisAvailable, getClient, cache, rawCache, circuitBreaker } from '@lib/redis';
export { sessionCache, userCache, permissionCache, importCache, jwtBlacklist } from '@lib/redis';
export type { ImportProgress } from '@lib/redis';

// Services DI plugin (re-exported from lib/di for convenience)
export { servicesPlugin, services, containerPlugin } from '@lib/di';
