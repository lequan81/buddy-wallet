/**
 * Redis Plugin for Elysia
 *
 * Lifecycle plugin — bootstraps Redis connection on app start,
 * tears down on stop, and injects redis/cache into context.
 *
 * Per Laravel convention, infrastructure lifecycle hooks live in
 * app/Providers/Plugins/Infrastructure/, NOT in Http/Middlewares/.
 */
import { Elysia } from 'elysia';
import { initRedis, closeRedis, getClient } from './Connection';
import { cache } from './Cache';
import { sessionCache } from './caches';

/**
 * Elysia plugin for Redis
 */
export const redisPlugin = new Elysia({ name: 'Redis_Plugin' })
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
