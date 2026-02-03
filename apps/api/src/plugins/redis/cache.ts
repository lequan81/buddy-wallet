/**
 * Generic Cache Module
 *
 * Provides get/set/del/incr/ttl operations.
 * Uses native Bun RedisClient for Redis access.
 */
import { log } from '@utils/logger';
import { getClient, isRedisAvailable } from './connection';
import { circuitBreaker } from './circuit-breaker';

const DEFAULT_CACHE_TTL = parseInt(Bun.env.REDIS_CACHE_TTL || '600');
const RATE_LIMIT_TTL = parseInt(Bun.env.REDIS_RATE_LIMIT_TTL || '60');

/**
 * Validate and namespace cache key
 */
function validateCacheKey(key: string): string {
  if (!/^[a-zA-Z0-9:_-]+$/.test(key)) {
    throw new Error(`Invalid cache key format: ${key}`);
  }
  if (key.length > 200) {
    throw new Error('Cache key too long');
  }
  return `bw:${key}`;
}

export const cache = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisAvailable()) return null;
    try {
      const client = getClient();
      if (!client) return null;

      const namespacedKey = validateCacheKey(key);
      const value = await client.get(namespacedKey);

      circuitBreaker.trackCommand(true);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      log.debug('REDIS', 'Cache get failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return null;
    }
  },

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_CACHE_TTL): Promise<boolean> {
    if (!isRedisAvailable()) return false;
    try {
      const client = getClient();
      if (!client) return false;

      const namespacedKey = validateCacheKey(key);
      await client.send('SETEX', [namespacedKey, String(ttlSeconds), JSON.stringify(value)]);

      circuitBreaker.trackCommand(true);
      return true;
    } catch (err) {
      log.debug('REDIS', 'Cache set failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return false;
    }
  },

  /**
   * Delete cached value
   */
  async del(key: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;
    try {
      const client = getClient();
      if (!client) return false;

      const namespacedKey = validateCacheKey(key);
      await client.del(namespacedKey);

      circuitBreaker.trackCommand(true);
      return true;
    } catch (err) {
      log.debug('REDIS', 'Cache del failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return false;
    }
  },

  /**
   * Increment counter (for rate limiting)
   */
  async incr(key: string, ttlSeconds: number = RATE_LIMIT_TTL): Promise<number> {
    if (!isRedisAvailable()) return -1;
    try {
      const client = getClient();
      if (!client) return -1;

      const namespacedKey = validateCacheKey(key);
      const count = await client.incr(namespacedKey);
      circuitBreaker.trackCommand(true);

      if (count === 1) {
        await client.expire(namespacedKey, ttlSeconds);
        circuitBreaker.trackCommand(true);
      }

      return count;
    } catch (err) {
      log.debug('REDIS', 'Cache incr failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return -1;
    }
  },

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    if (!isRedisAvailable()) return -1;
    try {
      const client = getClient();
      if (!client) return -1;

      const namespacedKey = validateCacheKey(key);
      const result = await client.ttl(namespacedKey);

      circuitBreaker.trackCommand(true);
      return result;
    } catch (err) {
      log.debug('REDIS', 'Cache ttl failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return -1;
    }
  },

  /**
   * Get stats
   */
  getStats() {
    return circuitBreaker.getStats();
  }
};
