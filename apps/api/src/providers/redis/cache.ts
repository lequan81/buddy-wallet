/**
 * Generic Cache Module
 *
 * Provides get/set/del/incr/ttl operations.
 * Uses native Bun RedisClient for Redis access.
 */
import { log } from '@repo/logger';
import { env } from '@repo/config';
import { getClient, isRedisAvailable } from './connection';
import { circuitBreaker } from './circuit-breaker';

const DEFAULT_CACHE_TTL = env.int('REDIS_CACHE_TTL', 600);
const RATE_LIMIT_TTL = env.int('REDIS_RATE_LIMIT_TTL', 60);

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

      if (!value) return null;

      // Guard against non-JSON Responses (e.g., Bun Redis "no such tab" error)
      if (typeof value === 'string' && !value.startsWith('{') && !value.startsWith('[') && !value.startsWith('"')) {
        log.warn('REDIS', 'Invalid cache value format', { key, value: value.slice(0, 50) });
        return null;
      }

      return JSON.parse(value) as T;
    } catch (err) {
      log.debug('REDIS', 'Cache get failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return null;
    }
  },

  /**
   * Get multiple cached values (mget to prevent N+1 queries)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!isRedisAvailable() || keys.length === 0) return keys.map(() => null);
    try {
      const client = getClient();
      if (!client) return keys.map(() => null);

      const namespacedKeys = keys.map(validateCacheKey);
      const values = await client.mget(...namespacedKeys);

      circuitBreaker.trackCommand(true);

      return values.map(value => {
        if (!value) return null;
        if (typeof value === 'string' && !value.startsWith('{') && !value.startsWith('[') && !value.startsWith('"')) {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (err) {
      log.debug('REDIS', 'Cache mget failed', { error: String(err) });
      circuitBreaker.trackCommand(false);
      return keys.map(() => null);
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
   * Sliding window rate limiting using Redis Sorted Sets (ZSET)
   */
  async rateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; current: number; retryAfter: number }> {
    if (!isRedisAvailable()) return { allowed: true, current: 0, retryAfter: 0 };
    try {
      const client = getClient();
      if (!client) return { allowed: true, current: 0, retryAfter: 0 };

      const namespacedKey = validateCacheKey(key);
      const now = Date.now();
      const uuid = crypto.randomUUID();
      const member = `${now}:${uuid}`;
      const minScore = now - windowSeconds * 1000;

      // Remove expired requests
      await client.send('ZREMRANGEBYSCORE', [namespacedKey, '-inf', String(minScore)]);
      // Add current request
      await client.send('ZADD', [namespacedKey, String(now), member]);
      // Count total requests in window
      const countResult = await client.send('ZCARD', [namespacedKey]);
      const current = Number(countResult);
      // Extend TTL of key so it cleans up when idle
      await client.send('EXPIRE', [namespacedKey, String(windowSeconds)]);

      circuitBreaker.trackCommand(true);

      const allowed = current <= maxRequests;
      let retryAfter = 0;

      if (!allowed) {
        // Query the oldest element to calculate precisely when a slot opens up
        const oldest = await client.send('ZRANGE', [namespacedKey, '0', '0', 'WITHSCORES']);
        circuitBreaker.trackCommand(true);

        if (Array.isArray(oldest) && oldest.length >= 2) {
          const oldestTimestamp = Number(oldest[1]);
          const retryAfterMs = oldestTimestamp + windowSeconds * 1000 - now;
          retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
        } else {
          retryAfter = windowSeconds;
        }
      }

      return { allowed, current, retryAfter };
    } catch (err) {
      log.debug('REDIS', 'Cache rateLimit failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return { allowed: true, current: 0, retryAfter: 0 };
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

/**
 * Raw Cache for binary data (Images/Files)
 * Avoids JSON.stringify which bloats Buffers
 */
export const rawCache = {
  async getBuffer(key: string): Promise<Buffer | null> {
    if (!isRedisAvailable()) return null;
    try {
      const client = getClient();
      if (!client) return null;

      const namespacedKey = validateCacheKey(key);
      const value = await client.send('GET', [namespacedKey]) as unknown;

      circuitBreaker.trackCommand(true);

      if (!value) return null;
      if (Buffer.isBuffer(value)) return value;
      if (typeof value === 'string') return Buffer.from(value, 'binary');

      return null;
    } catch (err) {
      log.debug('REDIS', 'Raw Cache get failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return null;
    }
  },

  async setBuffer(key: string, buffer: Buffer, ttlSeconds: number = DEFAULT_CACHE_TTL): Promise<boolean> {
    if (!isRedisAvailable()) return false;
    try {
      const client = getClient();
      if (!client) return false;

      const namespacedKey = validateCacheKey(key);
      // Send as Buffer directly to store without string manipulation
      await client.send('SETEX', [namespacedKey, String(ttlSeconds), buffer as unknown as string]);

      circuitBreaker.trackCommand(true);
      return true;
    } catch (err) {
      log.debug('REDIS', 'Raw Cache set failed', { key, error: String(err) });
      circuitBreaker.trackCommand(false);
      return false;
    }
  }
};

