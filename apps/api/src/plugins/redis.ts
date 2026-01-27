/**
 * Redis Plugin for Elysia
 * 
 * Provides Redis client for caching, session management, and rate limiting.
 * Supports both TCP (Redis protocol) and REST API connections.
 * TCP is preferred for performance, REST as fallback.
 * 
 * Environment variables:
 * - REDIS_TCP_URL: Redis TCP URL (e.g., rediss://:token@host.upstash.io:6379)
 * - REDIS_REST_URL: Upstash REST API URL (e.g., https://host.upstash.io)
 * - REDIS_TOKEN: Upstash authentication token (for REST API)
 * - REDIS_TCP_ENABLED: Use TCP connection (default: true), set to 'false' for REST
 * - REDIS_ENABLED: Set to 'true' to enable Redis (default: false)
 * 
 * @see https://bun.sh/docs/api/redis
 * @see https://docs.upstash.com/redis/features/restapi
 */
import { Elysia } from 'elysia';
import { RedisClient } from 'bun';
import { log } from '@utils/logger';

let redisClient: RedisClient | null = null;
let redisRestUrl: string | null = null;
let redisToken: string | null = null;
let useTcp: boolean = true;

// Circuit breaker state
let failureCount = 0;
let lastFailureTime = 0;
const MAX_FAILURES = parseInt(Bun.env.REDIS_MAX_FAILURES || '3');
const CIRCUIT_RESET_MS = parseInt(Bun.env.REDIS_CIRCUIT_RESET_MS || '60000'); // 1 minute

// Daily command tracking for free tier (10,000 commands/day)
let dailyCommandCount = 0;
let lastCommandReset = Date.now();
const DAILY_COMMAND_LIMIT = parseInt(Bun.env.REDIS_DAILY_COMMAND_LIMIT || '9500'); // Leave buffer before 10k limit
const DAY_MS = 24 * 60 * 60 * 1000;

// Default TTLs (longer = fewer refresh commands)
const DEFAULT_CACHE_TTL = parseInt(Bun.env.REDIS_CACHE_TTL || '600'); // 10 minutes
const SESSION_CACHE_TTL = parseInt(Bun.env.REDIS_SESSION_TTL || '1800'); // 30 minutes
const RATE_LIMIT_TTL = parseInt(Bun.env.REDIS_RATE_LIMIT_TTL || '60'); // 1 minute
const USER_CACHE_TTL = parseInt(Bun.env.REDIS_USER_TTL || '300'); // 5 minutes
const PERMISSION_CACHE_TTL = parseInt(Bun.env.REDIS_PERMISSION_TTL || '600'); // 10 minutes
const IMPORT_PROGRESS_TTL = parseInt(Bun.env.REDIS_IMPORT_TTL || '3600'); // 1 hour
const JWT_BLACKLIST_TTL = parseInt(Bun.env.REDIS_JWT_BLACKLIST_TTL || '604800'); // 7 days (match JWT exp)

// Redis configuration from environment
const REDIS_TCP_URL = Bun.env.REDIS_TCP_URL;
const REDIS_REST_URL = Bun.env.REDIS_REST_URL;
const REDIS_TOKEN = Bun.env.REDIS_TOKEN;
const REDIS_TCP_ENABLED = Bun.env.REDIS_TCP_ENABLED !== 'false'; // default true
const REDIS_ENABLED = Bun.env.REDIS_ENABLED === 'true';
/**
 * Initialize Redis connection
 */
/**
 * Initialize Redis connection (TCP or REST)
 */
async function initRedis(): Promise<boolean> {
  if (!REDIS_ENABLED) {
    log.debug('REDIS', 'Disabled - using in-memory fallback');
    return false;
  }

  useTcp = REDIS_TCP_ENABLED;

  if (useTcp) {
    // Try TCP connection
    if (!REDIS_TCP_URL) {
      log.warn('REDIS', 'REDIS_TCP_URL not set - falling back to in-memory');
      return false;
    }

    try {
      const client = new RedisClient(REDIS_TCP_URL, {
        connectionTimeout: 5000,
        autoReconnect: true,
        maxRetries: 3,
        enableOfflineQueue: true,
      });

      // Set up connection handlers
      client.onconnect = () => {
        log.debug('REDIS', 'Connected via TCP');
      };

      client.onclose = (error) => {
        if (error) {
          log.error('REDIS', 'TCP connection closed with error', { error: String(error) });
        }
      };

      // Test connection
      await client.set('_health', 'ok');
      await client.del('_health');

      redisClient = client;
      log.debug('REDIS', 'TCP connection successful');
      return true;
    } catch (err) {
      log.error('REDIS', 'TCP connection failed, falling back to REST', { error: String(err) });
      useTcp = false;
      // Fall through to REST
    }
  }

  // REST fallback
  if (!REDIS_REST_URL || !REDIS_TOKEN) {
    log.warn('REDIS', 'REDIS_REST_URL or REDIS_TOKEN not set - using in-memory fallback');
    return false;
  }

  try {
    // Test REST connection
    const response = await fetch(`${REDIS_REST_URL}/get/_health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Set health check
    await fetch(`${REDIS_REST_URL}/set/_health`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: 'ok' }),
    });

    // Clean up
    await fetch(`${REDIS_REST_URL}/del/_health`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    redisRestUrl = REDIS_REST_URL;
    redisToken = REDIS_TOKEN;
    log.debug('REDIS', 'REST connection successful');
    return true;
  } catch (err) {
    log.error('REDIS', 'REST connection failed - using in-memory fallback', { error: String(err) });
    return false;
  }
}

/**
 * Check if Redis is available (includes circuit breaker)
 */
export function isRedisAvailable(): boolean {
  // Circuit breaker: if too many failures, temporarily disable
  if (failureCount >= MAX_FAILURES) {
    if (Date.now() - lastFailureTime > CIRCUIT_RESET_MS) {
      // Reset circuit after timeout
      failureCount = 0;
      log.debug('REDIS', 'Circuit breaker reset');
    } else {
      return false;
    }
  }

  // Reset daily counter if new day
  if (Date.now() - lastCommandReset > DAY_MS) {
    dailyCommandCount = 0;
    lastCommandReset = Date.now();
  }

  // Check daily limit for free tier
  if (dailyCommandCount >= DAILY_COMMAND_LIMIT) {
    log.warn('REDIS', 'Daily command limit approaching, using in-memory fallback');
    return false;
  }

  return useTcp ? (redisClient !== null) : (redisRestUrl !== null && redisToken !== null);
}

/**
 * Track command usage and handle failures
 */
function trackCommand(success: boolean): void {
  dailyCommandCount++;
  if (!success) {
    failureCount++;
    lastFailureTime = Date.now();
  } else if (failureCount > 0) {
    failureCount = Math.max(0, failureCount - 1); // Gradual recovery
  }
}

/**
 * Make a REST request to Redis
 */
async function redisRequest(command: string, args: Record<string, any> = {}): Promise<any> {
  if (!redisRestUrl || !redisToken) {
    throw new Error('Redis REST not available');
  }

  const response = await fetch(`${redisRestUrl}/${command}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`Redis REST error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisAvailable()) return null;
    try {
      let value: string | null = null;
      if (useTcp && redisClient) {
        value = await redisClient.get(key);
      } else {
        value = await redisRequest(`get/${encodeURIComponent(key)}`);
      }
      trackCommand(true);
      return value ? JSON.parse(value) : null;
    } catch {
      trackCommand(false);
      return null;
    }
  },

  /**
   * Set cached value with TTL (seconds)
   * Uses SETEX for atomic operation (1 command instead of 2)
   */
  async set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_CACHE_TTL): Promise<boolean> {
    if (!isRedisAvailable()) return false;
    try {
      if (useTcp && redisClient) {
        // Use SETEX for atomic set+expire (saves 1 command)
        await redisClient.send('SETEX', [key, String(ttlSeconds), JSON.stringify(value)]);
      } else {
        // REST API supports EX parameter in single call
        await redisRequest(`set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}/EX/${ttlSeconds}`);
      }
      trackCommand(true);
      return true;
    } catch {
      trackCommand(false);
      return false;
    }
  },

  /**
   * Delete cached value
   */
  async del(key: string): Promise<boolean> {
    if (!isRedisAvailable()) return false;
    try {
      if (useTcp && redisClient) {
        await redisClient.del(key);
      } else {
        await redisRequest(`del/${encodeURIComponent(key)}`);
      }
      trackCommand(true);
      return true;
    } catch {
      trackCommand(false);
      return false;
    }
  },

  /**
   * Increment counter (for rate limiting)
   * Note: For new keys, uses 2 commands (incr + expire). Consider using Lua script for production.
   */
  async incr(key: string, ttlSeconds: number = RATE_LIMIT_TTL): Promise<number> {
    if (!isRedisAvailable()) return -1;
    try {
      let count: number;
      if (useTcp && redisClient) {
        count = await redisClient.incr(key);
        trackCommand(true);
        if (count === 1) {
          await redisClient.expire(key, ttlSeconds);
          trackCommand(true);
        }
      } else {
        count = await redisRequest(`incr/${encodeURIComponent(key)}`);
        trackCommand(true);
        if (count === 1) {
          await redisRequest(`expire/${encodeURIComponent(key)}/${ttlSeconds}`);
          trackCommand(true);
        }
      }
      return count;
    } catch {
      trackCommand(false);
      return -1;
    }
  },

  /**
   * Get TTL of key (seconds remaining)
   */
  async ttl(key: string): Promise<number> {
    if (!isRedisAvailable()) return -1;
    try {
      let result: number;
      if (useTcp && redisClient) {
        result = await redisClient.ttl(key);
      } else {
        result = await redisRequest(`ttl/${encodeURIComponent(key)}`);
      }
      trackCommand(true);
      return result;
    } catch {
      trackCommand(false);
      return -1;
    }
  },

  /**
   * Get current daily command usage stats (for monitoring)
   */
  getStats(): { dailyCommands: number; limit: number; failureCount: number } {
    return {
      dailyCommands: dailyCommandCount,
      limit: DAILY_COMMAND_LIMIT,
      failureCount,
    };
  }
};

/**
 * Session cache helpers
 */
export const sessionCache = {
  /**
   * Cache session data (longer TTL to reduce DB queries)
   */
  async set(sessionId: string, data: Record<string, unknown>, ttlSeconds: number = SESSION_CACHE_TTL) {
    return cache.set(`session:${sessionId}`, data, ttlSeconds);
  },

  /**
   * Get cached session
   */
  async get(sessionId: string) {
    return cache.get<Record<string, unknown>>(`session:${sessionId}`);
  },

  /**
   * Invalidate session cache
   */
  async del(sessionId: string) {
    return cache.del(`session:${sessionId}`);
  }
};

/**
 * User profile cache helpers
 */
export const userCache = {
  /**
   * Cache user profile data
   */
  async set(userId: string, data: Record<string, unknown>, ttlSeconds: number = USER_CACHE_TTL) {
    return cache.set(`user:${userId}`, data, ttlSeconds);
  },

  /**
   * Get cached user profile
   */
  async get(userId: string) {
    return cache.get<Record<string, unknown>>(`user:${userId}`);
  },

  /**
   * Invalidate user cache (call on profile update)
   */
  async del(userId: string) {
    return cache.del(`user:${userId}`);
  }
};

/**
 * User permissions cache helpers
 */
export const permissionCache = {
  /**
   * Cache user permissions
   */
  async set(userId: string, permissions: string[], ttlSeconds: number = PERMISSION_CACHE_TTL) {
    return cache.set(`perm:${userId}`, permissions, ttlSeconds);
  },

  /**
   * Get cached permissions
   */
  async get(userId: string) {
    return cache.get<string[]>(`perm:${userId}`);
  },

  /**
   * Invalidate permissions cache (call on role/permission change)
   */
  async del(userId: string) {
    return cache.del(`perm:${userId}`);
  }
};

/**
 * Import progress cache helpers
 */
export const importCache = {
  /**
   * Store import progress
   */
  async setProgress(logId: string, progress: { current: number; total: number; status: string; errors?: string[] }, ttlSeconds: number = IMPORT_PROGRESS_TTL) {
    return cache.set(`import:${logId}`, progress, ttlSeconds);
  },

  /**
   * Get import progress
   */
  async getProgress(logId: string) {
    return cache.get<{ current: number; total: number; status: string; errors?: string[] }>(`import:${logId}`);
  },

  /**
   * Clear import progress
   */
  async del(logId: string) {
    return cache.del(`import:${logId}`);
  }
};

/**
 * JWT blacklist cache helpers (for token revocation before expiry)
 */
export const jwtBlacklist = {
  /**
   * Add token to blacklist (revoke before natural expiry)
   * @param jti - JWT ID or token hash
   * @param expiresInSeconds - Time until token would naturally expire
   */
  async add(jti: string, expiresInSeconds: number = JWT_BLACKLIST_TTL) {
    return cache.set(`jwt:blacklist:${jti}`, true, expiresInSeconds);
  },

  /**
   * Check if token is blacklisted
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await cache.get<boolean>(`jwt:blacklist:${jti}`);
    return result === true;
  },

  /**
   * Remove from blacklist (rarely needed)
   */
  async remove(jti: string) {
    return cache.del(`jwt:blacklist:${jti}`);
  }
};

/**
 * Elysia plugin for Redis
 */
export const redisPlugin = new Elysia({ name: 'Redis' })
  .onStart(async () => {
    await initRedis();
  })
  .onStop(async () => {
    if (redisClient) {
      redisClient.close();
      log.debug('REDIS', 'TCP connection closed');
    }
  })
  .derive({ as: 'global' }, () => ({
    redis: useTcp ? redisClient : { restUrl: redisRestUrl, token: redisToken },
    cache,
    sessionCache
  }));

export default redisPlugin;
