/**
 * User Cache Module
 */
import { cache } from '../Cache';

const USER_CACHE_TTL = parseInt(Bun.env.REDIS_USER_TTL || '300');

export const userCache = {
  async set(userId: string, data: Record<string, unknown>, ttlSeconds: number = USER_CACHE_TTL) {
    return cache.set(`user:${userId}`, data, ttlSeconds);
  },

  async get(userId: string) {
    return cache.get<Record<string, unknown>>(`user:${userId}`);
  },

  async del(userId: string) {
    return cache.del(`user:${userId}`);
  }
};

