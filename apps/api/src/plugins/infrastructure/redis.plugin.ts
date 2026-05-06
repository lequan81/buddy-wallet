import { Elysia } from 'elysia';
import { initRedis, closeRedis, getClient, cache, sessionCache } from '@/providers/redis';

/**
 * Redis lifecycle plugin for Elysia.
 * Infrastructure state is managed by providers, while lifecycle wiring lives in plugins.
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
