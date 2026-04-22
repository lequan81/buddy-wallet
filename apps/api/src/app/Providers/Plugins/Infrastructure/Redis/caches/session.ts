/**
 * Session Cache Module
 */
import { hashToken } from '@/lib/security/password';
import { cache } from '../Cache';

const SESSION_CACHE_TTL = parseInt(Bun.env.REDIS_SESSION_TTL || '1800');

export const sessionCache = {
  /**
   * Set session data by token (hashed internally)
   */
  async set(token: string, data: Record<string, unknown>, ttlSeconds: number = SESSION_CACHE_TTL) {
    const hashed = await hashToken(token);
    return cache.set(`session:${hashed}`, data, ttlSeconds);
  },

  /**
   * Get session data by token (hashed internally)
   */
  async get(token: string) {
    const hashed = await hashToken(token);
    return cache.get<Record<string, unknown>>(`session:${hashed}`);
  },

  /**
   * Delete session by token (hashed internally)
   */
  async del(token: string) {
    const hashed = await hashToken(token);
    return cache.del(`session:${hashed}`);
  }
};

