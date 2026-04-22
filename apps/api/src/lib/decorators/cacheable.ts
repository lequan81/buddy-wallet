/**
 * @Cacheable Decorator - Redis-backed caching with fallback
 * Automatically caches method results with TTL
 * Performance: O(1) cache hit, O(n) cache miss where n = method complexity
 */

import { logger } from '@repo/logger';

export interface CacheableOptions {
  key: string;
  ttl: number; // seconds
  condition?: (...args: any[]) => boolean; // Optional condition to cache
}

/**
 * In-memory cache fallback when Redis unavailable
 * Performance: O(1) Map operations
 */
const memoryCache = new Map<string, { value: any; expiry: number }>();

/**
 * Optional Redis client (injected by bootstrap)
 */
let redisClient: any = null;

export function setRedisClient(client: any) {
  redisClient = client;
  logger.info('Redis client initialized for @Cacheable');
}

/**
 * Apply caching to method results
 * Usage:
 *   @Cacheable({ key: 'user', ttl: 300 })
 *   async getUserById(id: string) { ... }
 */
export function Cacheable(options: CacheableOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = `${className}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      // Check cache condition
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      const cacheKey = `${options.key}:${args.map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') return JSON.stringify(a);
        return String(a);
      }).join(':')}`;

      try {
        // Try Redis first
        if (redisClient) {
          try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
              logger.debug(`Cache hit (Redis): ${cacheKey}`);
              return JSON.parse(cached);
            }
          } catch (error) {
            logger.warn(`Redis cache read error: ${String(error)}`);
            // Fall through to memory cache
          }
        }

        // Try memory cache
        const memoryCached = memoryCache.get(cacheKey);
        if (memoryCached && memoryCached.expiry > Date.now()) {
          logger.debug(`Cache hit (memory): ${cacheKey}`);
          return memoryCached.value;
        }

        // Cache miss - compute result
        logger.debug(`Cache miss: ${cacheKey}`);
        const result = await originalMethod.apply(this, args);

        // Store in both caches
        const ttlMs = options.ttl * 1000;
        memoryCache.set(cacheKey, {
          value: result,
          expiry: Date.now() + ttlMs
        });

        // Store in Redis if available
        if (redisClient) {
          try {
            await redisClient.setex(
              cacheKey,
              options.ttl,
              JSON.stringify(result)
            );
          } catch (error) {
            logger.warn(`Redis cache write error: ${String(error)}`);
            // Continue anyway, memory cache is sufficient
          }
        }

        return result;
      } catch (error) {
        logger.error(`Cache operation error in ${methodName}`, {
          error: String(error),
          cacheKey
        });

        // Fallback: compute result without caching
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

