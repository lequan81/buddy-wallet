import { Elysia, type Context } from 'elysia';
import { logger } from '@utils/logger';
import { cache, isRedisAvailable } from './redis';
import type { RateLimitEntry, RateLimitConfig } from '@/types';
import type { User } from '@repo/db';

// In-memory fallback store (used when Redis is not available)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (only for in-memory store)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Get client IP address from request
 * Uses X-Forwarded-For for simplicity (as requested)
 */
function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

/**
 * Custom key generator that prioritizes authenticated User ID
 */
const defaultKeyGenerator = (req: Request, ctx?: Context & { user?: User | null }): string => {
  // 1. Prefer authenticated User ID (cannot be spoofed via headers)
  if (ctx?.user?.id) {
    return `user:${ctx.user.id}`;
  }

  // 2. Fallback to IP for unauthenticated requests
  return `ip:${getClientIP(req)}`;
};

/**
 * Create a rate limiting plugin with configurable options
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skip,
    message = 'Too many requests, please try again later'
  } = config;

  return new Elysia({ name: `Rate_Limiter_${windowMs}_${maxRequests}` }).onBeforeHandle(
    async (ctx) => {
      const { request, set } = ctx;
      // Skip if configured
      if (skip && skip(request)) {
        return;
      }

      // Pass full context to keyGenerator so it can access user if available
      const key = `ratelimit:${keyGenerator(request, ctx as any)}`;
      const now = Date.now();
      const windowSeconds = Math.ceil(windowMs / 1000);

      let count: number;
      let resetAt: number;

      // Try Redis first, fall back to in-memory
      if (isRedisAvailable()) {
        // Use Redis for distributed rate limiting
        count = await cache.incr(key, windowSeconds);
        const ttl = await cache.ttl(key);
        resetAt = now + (ttl > 0 ? ttl * 1000 : windowMs);
      } else {
        // Fallback to in-memory store
        let entry = rateLimitStore.get(key);

        if (!entry || entry.resetAt < now) {
          entry = {
            count: 1,
            resetAt: now + windowMs
          };
          rateLimitStore.set(key, entry);
        } else {
          entry.count++;
        }
        count = entry.count;
        resetAt = entry.resetAt;
      }

      // Set rate limit headers
      set.headers['X-RateLimit-Limit'] = String(maxRequests);
      set.headers['X-RateLimit-Remaining'] = String(Math.max(0, maxRequests - count));
      set.headers['X-RateLimit-Reset'] = String(Math.ceil(resetAt / 1000));

      // Check if limit exceeded
      if (count > maxRequests) {
        logger.rateLimit(`Exceeded: ${key} (${count}/${maxRequests})`);
        set.status = 429;
        set.headers['Retry-After'] = String(Math.ceil((resetAt - now) / 1000));
        return {
          success: false,
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((resetAt - now) / 1000)
        };
      }
    }
  );
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Strict: 5 requests per minute (for sensitive endpoints like public lookup)
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many requests. Please wait before trying again.'
});

// Auth: 10 requests per minute (for login/register)
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many authentication attempts. Please wait before trying again.'
});

// Standard: 100 requests per minute (for general API)
export const standardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Rate limit exceeded. Please slow down.'
});

// Burst: 30 requests per 10 seconds (for quick bursts)
export const burstRateLimiter = createRateLimiter({
  windowMs: 10 * 1000, // 10 seconds
  maxRequests: 30,
  message: 'Too many requests in a short time. Please slow down.'
});
