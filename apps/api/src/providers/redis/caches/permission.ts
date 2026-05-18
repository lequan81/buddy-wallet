/**
 * Permission Cache Module
 */
import { cache } from '../cache';
import { env } from '@repo/config';

const PERMISSION_CACHE_TTL = env.int('REDIS_PERMISSION_TTL', 600);

export const permissionCache = {
  async set(userId: string, permissions: string[], ttlSeconds: number = PERMISSION_CACHE_TTL) {
    return cache.set(`perm:${userId}`, permissions, ttlSeconds);
  },

  async get(userId: string) {
    return cache.get<string[]>(`perm:${userId}`);
  },

  async del(userId: string) {
    return cache.del(`perm:${userId}`);
  }
};

