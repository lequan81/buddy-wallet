/**
 * Session Cache Repository
 *
 * Redis-backed session cache for fast access token lookups.
 * Falls back to DB via SessionRepository if cache miss.
 *
 * @logicType infrastructure
 */

import { getClient, isRedisAvailable } from '@/providers/redis';
import { logger } from '@repo/logger';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 15 * 60; // 15 minutes

/**
 * Session Cache Repository
 * Handles fast session lookups in Redis.
 */
export class SessionCacheRepository {
  /**
   * Cache a session by access token hash
   */
  async set(accessTokenHash: string, sessionData: { userId: string; sessionId: string; sessionVersion: number }): Promise<void> {
    if (!isRedisAvailable()) return;
    try {
      const client = getClient();
      if (!client) return;
      
      const key = `${SESSION_PREFIX}${accessTokenHash}`;
      // Bun Redis: use send('SETEX', ...) for consistency with other providers
      await client.send('SETEX', [key, String(SESSION_TTL), JSON.stringify(sessionData)]);
    } catch (error) {
      logger.error('Failed to cache session', { error: String(error) });
    }
  }

  /**
   * Get cached session by access token hash
   */
  async get(accessTokenHash: string): Promise<{ userId: string; sessionId: string; sessionVersion: number } | null> {
    if (!isRedisAvailable()) return null;
    try {
      const client = getClient();
      if (!client) return null;
      
      const key = `${SESSION_PREFIX}${accessTokenHash}`;
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to read session cache', { error: String(error) });
      return null;
    }
  }

  /**
   * Invalidate a cached session
   */
  async invalidate(accessTokenHash: string): Promise<void> {
    if (!isRedisAvailable()) return;
    try {
      const client = getClient();
      if (!client) return;
      
      const key = `${SESSION_PREFIX}${accessTokenHash}`;
      await client.del(key);
    } catch (error) {
      logger.error('Failed to invalidate session cache', { error: String(error) });
    }
  }

  /**
   * Invalidate all sessions for a user (by pattern)
   */
  async invalidateAllForUser(userId: string): Promise<void> {
    if (!isRedisAvailable()) return;
    try {
      const client = getClient();
      if (!client) return;
      
      const pattern = `${SESSION_PREFIX}*`;
      let cursor = "0";
      do {
        // Bun Redis scan returns [nextCursor, keys]
        const result = await client.scan(cursor, pattern, 100);
        const [nextCursor, keys] = result as [string, string[]];
        cursor = nextCursor;
        
        for (const key of keys) {
          const data = await client.get(key);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.userId === userId) {
                await client.del(key);
              }
            } catch {
              // Ignore parse errors for non-session keys
            }
          }
        }
      } while (cursor !== "0");
    } catch (error) {
      logger.error('Failed to invalidate user sessions from cache', { error: String(error) });
    }
  }
}
