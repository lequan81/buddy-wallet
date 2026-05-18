/**
 * Session Cache Module
 */
import { cache } from '../cache';
import { env } from '@repo/config';

const SESSION_CACHE_TTL = env.int('REDIS_SESSION_TTL', 1800);

export const sessionCache = {
  /**
   * Set session data by pre-hashed token.
   */
  async set(tokenHash: string, data: Record<string, unknown>, ttlSeconds: number = SESSION_CACHE_TTL) {
    return cache.set(`session:${tokenHash}`, data, ttlSeconds);
  },

  /**
   * Get session data by pre-hashed token.
   */
  async get(tokenHash: string) {
    return cache.get<Record<string, unknown>>(`session:${tokenHash}`);
  },

  /**
   * Delete session by pre-hashed token.
   */
  async del(tokenHash: string) {
    return cache.del(`session:${tokenHash}`);
  }
};

/**
 * Session Metadata Cache
 *
 * Stores volatile session metadata (userAgent, ipAddress, location) in Redis
 * instead of SQLite to reduce write bloat on the sessions table.
 * TTL matches refresh token lifetime (90 days).
 */
export const sessionMetaCache = {
  async get(sessionId: string) {
    return cache.get<Record<string, unknown>>(`session:meta:${sessionId}`);
  },

  async set(sessionId: string, meta: Record<string, unknown>, ttlSeconds: number) {
    return cache.set(`session:meta:${sessionId}`, meta, ttlSeconds);
  },

  async delete(sessionId: string) {
    return cache.del(`session:meta:${sessionId}`);
  }
};
